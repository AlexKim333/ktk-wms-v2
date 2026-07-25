<template>
  <div class="samdori-container" :class="{ active: isPttHolding || isListening }">
    <div
      class="samdori-button"
      role="button"
      aria-label="Samdori"
      :class="{ pulsing: isPttHolding || isListening }"
      @pointerdown="onPttDown"
      @pointerup="onPttUp"
      @pointercancel="onPttUp"
      @contextmenu.prevent
      @dragstart.prevent
    >
      <!-- img 대신 배경 이미지: iOS 길게 누르기 시 사진 확대/저장 팝업 방지 -->
      <span class="samdori-avatar" aria-hidden="true"></span>
    </div>
    
    <div class="samdori-panel" v-if="isOpen">
      <div class="panel-header">
        <h3>🤖 삼돌이 (Samdori AI)</h3>
        <button class="close-btn" @click="isOpen = false">X</button>
      </div>
      
      <div class="panel-body">
        <div class="status-indicator">
          상태: <strong>{{ statusText }}</strong>
        </div>
        
        <div class="transcript-box">
          <p v-if="!transcript && !finalTranscript && !manualInput && !lastQuestionText" class="placeholder">버튼을 누른 채 말씀하시고, 손을 떼면 바로 분석합니다.</p>
          <p class="final-text" v-if="lastQuestionText && !finalTranscript && !transcript"><span class="badge bg-purple">질문</span> {{ lastQuestionText }}</p>
          <p class="final-text" v-if="finalTranscript"><span class="badge bg-purple">인식중</span> {{ finalTranscript }}</p>
          <p class="interim-text">{{ transcript }}</p>
          <input type="text" v-model="manualInput" @keyup.enter="submitManual" placeholder="음성 대신 타자로 명령 입력 (엔터)" class="manual-input" />
        </div>
        
        <div class="error-box" v-if="debugError">
          <span class="badge bg-red">디버그 에러</span>
          <p>{{ debugError }}</p>
        </div>
        
        <div class="intent-box" v-if="lastIntent">
          <div v-if="lastIntent._tokenUsage" style="margin-bottom: 10px; font-size: 11px; color: #64748b; background: #f8fafc; padding: 4px 8px; border-radius: 4px; display: inline-block;">
            <strong>Tokens:</strong> 입력 {{ lastIntent._tokenUsage.promptTokenCount }} | 출력 {{ lastIntent._tokenUsage.candidatesTokenCount }} | 총 {{ lastIntent._tokenUsage.totalTokenCount }}
          </div>
          <h4>🤖 AI 분석 결과:</h4>
          <div v-if="lastIntent.intent === 'search'">
            <span class="badge bg-blue">재고조회</span> <strong>{{ lastIntent.item }}</strong>
            <span v-if="lastIntent.warehouse" style="margin-left:5px; color:#94a3b8;">[{{ lastIntent.warehouse }}]</span>
          </div>
          <div v-else-if="lastIntent.intent === 'add_order'">
            <span class="badge bg-green">장바구니</span> <strong>{{ lastIntent.item }}</strong> ({{ lastIntent.qty }}개)
          </div>
          <div v-else-if="lastIntent.intent === 'check'">
            <span class="badge bg-purple">내역확인</span> 장바구니 내역 확인
          </div>
          <div v-else-if="lastIntent.intent === 'submit'">
            <span class="badge bg-orange">전송완료</span> 전표 데이터 전송
          </div>
        </div>
        
        <div class="response-box" v-if="lastResponseText">
          <h4>💬 자비스의 대답:</h4>
          <p>{{ lastResponseText }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseIntent, parseIntentFromAudio } from '../utils/SamdoriBrain'

const isIOS = typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/**
 * 입력 모드
 * - 'ptt'  : 버튼을 누르는 동안만 녹음, 손을 떼면 즉시 분석 (현재 기본)
 * - 'wake' : 호출어 연속 듣기 (검증된 레거시 — 기본 비활성, 복구용으로만 유지)
 * PosView 장바구니/전송 로직은 이 파일 밖이므로 건드리지 않음.
 */
const INPUT_MODE = 'ptt'

const props = defineProps({
  validItems: {
    type: Array,
    default: () => []
  },
  /** 관리자가 창고명 재질문 대기 중인 품목 코드 (PosView pendingVoiceStockItem) */
  pendingStockItem: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['intent-parsed'])
const { locale } = useI18n()

const isListening = ref(false)
const isPttHolding = ref(false)
const isOpen = ref(false)
const statusText = ref(INPUT_MODE === 'ptt' ? '버튼을 누른 채 말씀하세요' : '대기 중')
const transcript = ref('')
const finalTranscript = ref('')
const manualInput = ref('')
const lastIntent = ref(null)
const lastResponseText = ref('')
const lastQuestionText = ref('')
const debugError = ref('')
const queuedCommand = ref(null)

let recognition = null
let mediaRecorder = null
let audioChunks = []
let activeMicStream = null
let audioSessionId = 0
let synthesis = window.speechSynthesis
let isAwake = false
let silenceTimer = null
let commandWindowTimer = null
let isTTSPlaying = false
let retryTimer = null
let pttPointerId = null
/** "다시 말해줘"용 — 분석 안내 TTS/버튼 뗌으로는 지우지 않음 */
let cachedReply = ''
/** iOS: 제스처 없이 speak() 하면 무음으로 차단됨 */
let iosSpeechUnlocked = false
let iosAudioCtx = null
let iosSpeakTimer = null

const stopMicTracks = (stream) => {
  try {
    ;(stream || activeMicStream)?.getTracks?.().forEach((t) => t.stop())
  } catch (e) {}
  if (!stream || stream === activeMicStream) activeMicStream = null
}

/** iOS 녹음 세션이 TTS를 죽이지 않도록 WebAudio도 함께 언락 */
const unlockAudioContextForIOS = () => {
  if (!isIOS) return
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    if (!iosAudioCtx) iosAudioCtx = new AC()
    if (iosAudioCtx.state === 'suspended') {
      iosAudioCtx.resume().catch(() => {})
    }
    const buf = iosAudioCtx.createBuffer(1, 1, 22050)
    const src = iosAudioCtx.createBufferSource()
    src.buffer = buf
    src.connect(iosAudioCtx.destination)
    src.start(0)
  } catch (e) {
    console.warn('iOS AudioContext unlock failed', e)
  }
}

/** 레거시(wake) 전용 타이머 상수 — PTT에서는 사용하지 않음 */
const COMMAND_WINDOW_MS = 6000
const SILENCE_COMMIT_MS = 1800

const clearCommandWindow = () => {
  if (commandWindowTimer) {
    clearTimeout(commandWindowTimer)
    commandWindowTimer = null
  }
}

const startCommandWindow = (ms = COMMAND_WINDOW_MS) => {
  if (INPUT_MODE === 'ptt') return
  clearCommandWindow()
  commandWindowTimer = setTimeout(() => {
    commandWindowTimer = null
    if (isAwake && !transcript.value && !finalTranscript.value) {
      sleep('timeout')
    }
  }, ms)
}

/** 로컬 처리(캐시 재생/취소). true면 API(parseIntent) 호출 안 함 */
const tryLocalCommand = (rawText) => {
  const text = (rawText || '').trim()
  if (!text) return false
  const lower = text.toLowerCase()

  if (/(취소|아니다|무시해|cancelar|cancela|olvídalo|olvidalo)/i.test(lower)) {
    const cancelMsg = locale.value === 'es' ? 'Comando cancelado.' : '명령이 취소되었습니다.'
    speak(cancelMsg, { continueListening: false })
    sleep('timeout')
    return true
  }

  // "다시 말해줘" — cachedReply만 재생, Gemini 호출 없음 (버튼 뗌/분석중 멘트로 캐시 안 지움)
  if (/(다시|뭐라고|못들었|한번 더|repetir|otra vez|repite)/i.test(lower)) {
    if (cachedReply) {
      statusText.value = '이전 답변 재생 (캐시)'
      speak(cachedReply, { continueListening: false, saveCache: false })
    } else {
      const noMsg = locale.value === 'es' ? 'No hay respuesta anterior.' : '이전에 대답한 내용이 없습니다.'
      speak(noMsg, { continueListening: false, saveCache: false })
      sleep('timeout')
    }
    return true
  }

  return false
}

/**
 * iOS Safari: speechSynthesis는 사용자 제스처 안 speak로 언락 필요.
 * 주의: getUserMedia 녹음이 오디오 세션을 가로채면 언락이 무효화되므로
 * pointerdown + pointerup(녹음 종료 직후) 모두에서 호출한다.
 */
const unlockSpeechForIOS = (force = false) => {
  if (!isIOS || !synthesis) return
  unlockAudioContextForIOS()
  try {
    synthesis.getVoices()
  } catch (e) {}
  if (iosSpeechUnlocked && !force) return
  try {
    // volume 0은 일부 iOS에서 언락으로 인정 안 됨 → 아주 작게
    const warm = new SpeechSynthesisUtterance('.')
    warm.volume = 0.01
    warm.rate = 2
    warm.lang = locale.value === 'es' ? 'es-MX' : 'ko-KR'
    const voices = synthesis.getVoices() || []
    const match = voices.find((v) =>
      v.lang?.toLowerCase().startsWith(locale.value === 'es' ? 'es' : 'ko')
    )
    if (match) warm.voice = match
    synthesis.speak(warm)
    iosSpeechUnlocked = true
  } catch (e) {
    console.warn('iOS speech unlock failed', e)
  }
}

const submitManual = () => {
  if (!manualInput.value.trim()) return
  unlockSpeechForIOS()
  if (recognition && (isListening.value || isPttHolding.value)) {
    isPttHolding.value = false
    try { recognition.stop() } catch (e) {}
  }
  isListening.value = false
  const cmd = manualInput.value
  manualInput.value = ''
  finalTranscript.value = cmd
  if (tryLocalCommand(cmd)) return
  processAwakeCommand(cmd)
}

const onPttDown = async (e) => {
  if (INPUT_MODE !== 'ptt') return
  e.preventDefault()
  if (typeof e.button === 'number' && e.button !== 0) return

  try {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pttPointerId = e.pointerId
  } catch (err) {}

  // 이전 TTS 큐 정리 후 제스처 안에서 언락 (녹음 전)
  if (synthesis) {
    try { synthesis.cancel() } catch (err) {}
  }
  isTTSPlaying = false
  unlockSpeechForIOS(true)

  isOpen.value = true
  isPttHolding.value = true
  isAwake = true
  finalTranscript.value = ''
  transcript.value = ''
  statusText.value = '녹음 중... 손을 떼면 분석합니다'

  if (isIOS) {
    const sessionId = ++audioSessionId
    try {
      // 이전 세션 마이크가 남아 있으면 정리
      stopMicTracks()
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try { mediaRecorder.stop() } catch (e) {}
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // 권한 대기 중 손을 이미 뗐으면 녹음 시작하지 않음 (레이스 방지)
      if (!isPttHolding.value || sessionId !== audioSessionId) {
        stopMicTracks(stream)
        return
      }

      activeMicStream = stream
      audioChunks = []
      const preferredMime = MediaRecorder.isTypeSupported?.('audio/mp4')
        ? 'audio/mp4'
        : (MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '')
      mediaRecorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream)

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.push(event.data)
      }
      mediaRecorder.onstop = () => {
        const mime = mediaRecorder?.mimeType || preferredMime || 'audio/mp4'
        const audioBlob = new Blob(audioChunks, { type: mime })
        stopMicTracks(stream)

        if (sessionId !== audioSessionId) return
        if (!audioBlob.size || audioChunks.length === 0) {
          statusText.value = '버튼을 누른 채 말씀해 주세요'
          isAwake = false
          return
        }

        const reader = new FileReader()
        reader.onloadend = () => {
          if (sessionId !== audioSessionId) return
          const base64data = String(reader.result || '').split(',')[1]
          if (!base64data) {
            statusText.value = '오디오 변환에 실패했습니다.'
            return
          }
          processAudioCommand(base64data, mime)
        }
        reader.onerror = () => {
          statusText.value = '오디오 변환에 실패했습니다.'
        }
        reader.readAsDataURL(audioBlob)
      }
      mediaRecorder.start()
      isListening.value = true
    } catch (err) {
      console.error('iOS MediaRecorder start failed:', err)
      statusText.value = '마이크 권한이 거부되었거나 녹음을 시작할 수 없습니다.'
      isListening.value = false
      isPttHolding.value = false
      stopMicTracks()
    }
    return
  }

  if (!recognition) initSpeech()
  if (!recognition) return

  isListening.value = true
  try {
    recognition.start()
  } catch (err) {
    // 이미 시작된 경우 무시
  }
}

const onPttUp = (e) => {
  if (INPUT_MODE !== 'ptt') return
  if (!isPttHolding.value) return
  if (pttPointerId != null && e.pointerId !== pttPointerId) return

  e.preventDefault()
  isPttHolding.value = false
  pttPointerId = null

  try {
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  } catch (err) {}

  isListening.value = false

  if (isIOS) {
    // getUserMedia 대기 중 손을 뗀 경우: 세션 무효화 후 마이크 정리
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      audioSessionId += 1
      stopMicTracks()
      statusText.value = '버튼을 누른 채 말씀해 주세요'
      isAwake = false
      return
    }
    try {
      mediaRecorder.stop()
    } catch (err) {
      stopMicTracks()
      statusText.value = '녹음 종료에 실패했습니다.'
    }
    // 녹음 종료 직후(여전히 pointerup 제스처) TTS 재언락 — 마이크 세션이 언락을 무력화함
    stopMicTracks()
    unlockSpeechForIOS(true)
    return
  }

  const cmd = `${finalTranscript.value || ''} ${transcript.value || ''}`.trim()
  if (recognition) {
    try { recognition.stop() } catch (err) {}
  }

  if (!cmd) {
    statusText.value = '버튼을 누른 채 말씀해 주세요'
    isAwake = false
    return
  }

  // 다시/취소는 캐시·로컬만 — API 사이드 이펙트 없음
  if (tryLocalCommand(cmd)) return
  processAwakeCommand(cmd)
}

const initSpeech = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) {
    statusText.value = '브라우저가 음성 인식을 지원하지 않습니다.'
    return
  }

  recognition = new SpeechRecognition()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = locale.value === 'es' ? 'es-MX' : 'ko-KR'

  recognition.onstart = () => {
    isListening.value = true
    if (INPUT_MODE === 'ptt') {
      statusText.value = isPttHolding.value
        ? '녹음 중... 손을 떼면 분석합니다'
        : '버튼을 누른 채 말씀하세요'
    } else {
      statusText.value = '마이크 켜짐 (호출어 대기중...)'
    }
  }

  recognition.onresult = (event) => {
    if (synthesis && synthesis.speaking) return

    let interim = ''
    let final = ''

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript
      } else {
        interim += event.results[i][0].transcript
      }
    }

    // PTT: 누르는 동안만 텍스트 누적. 자동 확정/호출어/침묵 타이머 없음.
    if (INPUT_MODE === 'ptt') {
      if (!isPttHolding.value) return
      transcript.value = interim
      if (final) {
        finalTranscript.value += (finalTranscript.value ? ' ' : '') + final
      }
      return
    }

    // ----- 아래는 wake 레거시 (INPUT_MODE === 'wake' 일 때만) -----
    if (isAwake) {
      if (interim || final) clearCommandWindow()

      transcript.value = interim
      if (final) {
        finalTranscript.value += (finalTranscript.value ? ' ' : '') + final
        handleFinalText(final)
      }

      clearTimeout(silenceTimer)
      silenceTimer = setTimeout(() => {
        const cmd = `${finalTranscript.value || ''} ${transcript.value || ''}`.trim()
        if (cmd) {
          processAwakeCommand(cmd)
        } else if (isAwake) {
          startCommandWindow(2000)
        }
      }, SILENCE_COMMIT_MS)
    } else if (final) {
      const lowerText = final.toLowerCase().trim()
      const wakeRegex = /(삼돌이|삼돌야|삼돌|잠돌이|잠돌|산돌이|산돌|samdori|paquito|파키토|자비스|jarvis)/i
      const wakeMatch = lowerText.match(wakeRegex)
      if (wakeMatch) {
        const afterWake = lowerText
          .slice(wakeMatch.index + wakeMatch[0].length)
          .replace(/^[\s,.\-~]+/, '')
          .trim()
        if (afterWake.length >= 2) {
          isAwake = true
          isOpen.value = true
          processAwakeCommand(afterWake)
        } else {
          wakeUp()
        }
      }
    }
  }

  recognition.onerror = (event) => {
    console.error('Speech recognition error', event.error)
    if (event.error === 'not-allowed') {
      statusText.value = '마이크 권한이 거부되었습니다.'
      isListening.value = false
      isPttHolding.value = false
    } else if (event.error === 'aborted' || event.error === 'no-speech') {
      // PTT 손 뗌/짧은 무음 — 치명 아님
    }
  }

  recognition.onend = () => {
    // PTT: 누르고 있는 동안에만 재시작 (Chrome이 중간에 끊는 경우)
    if (INPUT_MODE === 'ptt') {
      if (isPttHolding.value && !isTTSPlaying) {
        setTimeout(() => {
          if (!isPttHolding.value || !recognition) return
          try { recognition.start() } catch (e) {}
        }, 200)
      } else {
        isListening.value = false
      }
      return
    }

    if (isListening.value && !isTTSPlaying) {
      setTimeout(() => {
        try { recognition.start() } catch (e) {}
      }, 500)
    }
  }
}

/** wake 레거시 전용 — PTT에서는 호출되지 않음 */
const handleFinalText = (text) => {
  if (INPUT_MODE === 'ptt') return
  const lowerText = text.toLowerCase()

  if (isAwake) {
    if (/(취소|아니다|무시해|cancelar|cancela|olvídalo|olvidalo)/i.test(lowerText)) {
      clearTimeout(silenceTimer)
      const cancelMsg = locale.value === 'es' ? 'Comando cancelado.' : '명령이 취소되었습니다.'
      speak(cancelMsg, { continueListening: false })
      sleep('timeout')
      return
    }

    if (tryLocalCommand(lowerText)) {
      clearTimeout(silenceTimer)
      return
    }

    const executeRegex = /(실행|끝|오버|이상|처리해|완료|입력완료|엔터|enter|ya|listo|ejecutar|ejecuta)/i
    if (executeRegex.test(lowerText)) {
      clearTimeout(silenceTimer)
      clearCommandWindow()
      const finalCmd = finalTranscript.value.replace(new RegExp(executeRegex.source, 'gi'), '').trim()
      if (finalCmd) {
        processAwakeCommand(finalCmd)
      }
      return
    }
  }
}

const wakeUp = () => {
  if (INPUT_MODE === 'ptt') return
  clearCommandWindow()
  clearTimeout(silenceTimer)
  silenceTimer = null
  isAwake = true
  isOpen.value = true
  statusText.value = '듣고 있습니다! 명령을 내려주세요.'
  finalTranscript.value = ''
  transcript.value = ''
  lastResponseText.value = ''
  lastQuestionText.value = ''

  const reply = locale.value === 'es' ? 'Dígame, señor.' : '네, 말씀하세요.'
  speak(reply, { continueListening: true })
}

const sleep = (reason = '') => {
  clearTimeout(silenceTimer)
  silenceTimer = null
  clearCommandWindow()
  isAwake = false
  isPttHolding.value = false
  transcript.value = ''
  finalTranscript.value = ''
  statusText.value = INPUT_MODE === 'ptt'
    ? '버튼을 누른 채 말씀하세요'
    : '대기중 (호출어 대기중...)'
}

const silentWakeUp = () => {
  // PTT에서는 TTS 후 자동 마이크 개방 금지 (사이드 이펙트 차단)
  if (INPUT_MODE === 'ptt') return
  setTimeout(() => {
    if (!isListening.value) return

    isAwake = true
    isOpen.value = true
    statusText.value = '이어서 듣고 있습니다...'
    finalTranscript.value = ''
    transcript.value = ''

    clearTimeout(silenceTimer)
    silenceTimer = null
    startCommandWindow(COMMAND_WINDOW_MS)
  }, 600)
}

const manualWakeUp = () => {
  if (INPUT_MODE === 'ptt') return
  clearCommandWindow()
  clearTimeout(silenceTimer)
  silenceTimer = null
  isAwake = true
  isOpen.value = true
  statusText.value = '듣고 있습니다! 명령을 내려주세요.'
  finalTranscript.value = ''
  transcript.value = ''
  startCommandWindow(COMMAND_WINDOW_MS)
}


/** Gemini/로컬 후속 보정용 컨텍스트 (직전 intent 또는 창고 재질문 대기 품목) */
const getIntentContext = () => {
  if (lastIntent.value?.item) return lastIntent.value
  if (props.pendingStockItem) {
    return { intent: 'search', item: props.pendingStockItem }
  }
  return null
}

const processAudioCommand = async (base64Audio, mimeType) => {
  if (!base64Audio) {
    statusText.value = '오디오가 비어 있습니다.'
    return
  }
  clearTimeout(silenceTimer)
  silenceTimer = null
  clearCommandWindow()
  statusText.value = 'AI 오디오 분석 중...'
  debugError.value = ''
  lastQuestionText.value = '(음성 명령)'
  transcript.value = ''
  finalTranscript.value = '오디오 전송 완료 (분석 중)'

  // iOS: 분석중 TTS는 결과 TTS를 더 잘 막음 → 스킵 (화면 상태로만 표시)
  if (!isIOS) {
    const analyzingMsg = locale.value === 'es' ? 'Analizando audio...' : '오디오 분석 중입니다.'
    speak(analyzingMsg, { continueListening: false, saveCache: false })
  }

  try {
    const safeMime = mimeType && String(mimeType).includes('/') ? mimeType : 'audio/mp4'
    const intent = await parseIntentFromAudio(base64Audio, safeMime, props.validItems, getIntentContext())
    // 오디오 경로는 원문 텍스트가 없음 — 창고 재질문 폴백은 handleParsedIntent에서 처리
    handleParsedIntent(intent, null, { fromAudio: true })
  } catch (error) {
    handleIntentError(error, null)
  }
}

const handleParsedIntent = (intent, cmdRawText, options = {}) => {
  if (!intent || typeof intent !== 'object') {
    statusText.value = '명령이 명확하지 않아 무시됨'
    sleep('timeout')
    return
  }

  // 창고 후속: 직전 search 또는 관리자 창고 재질문 대기(pendingStockItem)
  const followItem = lastIntent.value?.item || props.pendingStockItem || null
  const canWarehouseFollow =
    !!followItem &&
    (lastIntent.value?.intent === 'search' || !!props.pendingStockItem) &&
    (intent.intent === 'none' || intent.intent === 'search')

  if (canWarehouseFollow) {
    const whHint =
      intent.warehouse ||
      intent._warehouseHint ||
      (!options.fromAudio ? cmdRawText : null) ||
      intent.raw_spoken_item ||
      ''
    const looksWh =
      !!intent.warehouse ||
      !!intent._warehouseHint ||
      (whHint &&
        String(whHint).length <= 40 &&
        !/(불또|박스|담아|넣어|재고|검색|[A-Za-z]{1,3}-?\d+)/i.test(String(whHint)) &&
        /(알라르꼰|알라르콘|알라르|알라콘|alarcon|carmen|까르멘|카르멘|까르맨|본사|메인|tienda|티엔다|창고|지점|sucursal)/i.test(
          String(whHint)
        ))

    // 재질문 대기 중이면 짧은 답변을 창고명으로 간주 (별칭 정규식에 안 걸려도 PosView에서 resolve)
    const pendingShortWh =
      !!props.pendingStockItem &&
      !!whHint &&
      String(whHint).length <= 40 &&
      !/(불또|박스|담아|넣어|재고|검색|[A-Za-z]{1,3}-?\d+)/i.test(String(whHint))

    if ((looksWh || pendingShortWh) && whHint) {
      intent.intent = 'search'
      intent.item = followItem
      intent.warehouse = String(intent.warehouse || intent._warehouseHint || whHint).trim()
      intent._warehouseHint = intent.warehouse
      intent.raw_spoken_item = followItem
    }
  }

  if (intent.intent === 'none') {
    statusText.value = '명령이 명확하지 않아 무시됨'
    sleep('timeout')
    return
  }

  if ((intent.intent === 'add_order' || intent.intent === 'search') && lastIntent.value?.item) {
    const rawItem = String(intent.item || '').trim()
    const weakItem = !rawItem || /^(이거|이것|그거|그것|얘|this|that|eso|este|esta)$/i.test(rawItem)
    if (weakItem) intent.item = lastIntent.value.item
  }
  // 창고만 말한 search인데 item이 비면 직전 품목 유지
  if (intent.intent === 'search' && intent.warehouse && !intent.item && lastIntent.value?.item) {
    intent.item = lastIntent.value.item
  }
  if (intent.intent === 'add_order') {
    const n = Number(intent.qty)
    intent.qty = Number.isFinite(n) && n > 0 ? n : 1
  }

  lastIntent.value = intent
  emit('intent-parsed', intent)
  statusText.value = '명령 분석 완료'
  sleep()
}

const handleIntentError = (error, queuedFullText) => {
  console.error(error)
  statusText.value = '분석 실패: ' + error.message
  
  if (error.response) {
    debugError.value = `Server Error [${error.response.status}]: ${JSON.stringify(error.response.data)}`
  } else {
    debugError.value = `Client/Parser Error: ${error.name} - ${error.message}\n${error.stack}`
  }
  
  let errorMsg = locale.value === 'es' ? 'Lo siento, no entendí.' : '죄송합니다. 무슨 말인지 이해하지 못했습니다.'
  
  if (error.response && error.response.status === 503) {
    errorMsg = locale.value === 'es' ? 'El servidor está retrasado.' : '서버 접속 대기열에 등록되었습니다.'
    if (queuedFullText) {
      queuedCommand.value = queuedFullText
      startRetryTimer()
    }
  } else if (error.response && error.response.status === 429) {
    errorMsg = locale.value === 'es' ? 'Límite superado.' : 'AI 호출 한도를 초과했습니다.'
  }
  
  speak(errorMsg, { continueListening: false })
  sleep('timeout')
}

const processAwakeCommand = async (fullText) => {

  const cmd = (fullText || '').trim()
  if (!cmd) return

  clearTimeout(silenceTimer)
  silenceTimer = null
  clearCommandWindow()
  statusText.value = 'AI 분석 중...'
  debugError.value = '' // 이전 에러 지우기
  // cachedReply는 유지 — 버튼 뗌/새 분석 시작으로 "다시 말해줘" 캐시를 날리지 않음
  lastQuestionText.value = cmd
  finalTranscript.value = cmd
  transcript.value = ''

  const analyzingMsg = locale.value === 'es' ? 'Analizando...' : '분석 중입니다.'
  // 분석 안내는 캐시에 저장하지 않음
  speak(analyzingMsg, { continueListening: false, saveCache: false })

  try {
    const intent = await parseIntent(cmd, props.validItems, getIntentContext())
    handleParsedIntent(intent, cmd)
  } catch (error) {
    handleIntentError(error, fullText)
  }
}

const startRetryTimer = () => {
  if (retryTimer) clearInterval(retryTimer)
  
  retryTimer = setInterval(async () => {
    if (!queuedCommand.value) {
      clearInterval(retryTimer)
      retryTimer = null
      return
    }
    
    try {
      statusText.value = 'AI 서버 재접속 시도 중...'
      const queued = queuedCommand.value
      const intent = await parseIntent(queued, props.validItems, getIntentContext())
      
      // 성공하면 큐 비우고 처리 (창고 후속 보정 포함)
      queuedCommand.value = null
      clearInterval(retryTimer)
      retryTimer = null
      statusText.value = '대기 명령 분석 완료'
      handleParsedIntent(intent, queued)
      
      const successMsg = locale.value === 'es' ? 'El servidor se ha recuperado. Comando ejecutado.' : '서버가 복구되었습니다. 대기 중이던 명령 처리를 완료했습니다.'
      speak(successMsg)
      
    } catch (error) {
      if (error.response && error.response.status === 503) {
        statusText.value = '서버 503 - 다음 재시도 대기 중...'
      } else {
        // 503이 아닌 다른 실패면 큐에서 삭제
        queuedCommand.value = null
        clearInterval(retryTimer)
        retryTimer = null
        
        let errorMsg = locale.value === 'es' ? 'Error al reintentar el comando en cola.' : '대기 명령 처리 중 오류가 발생하여 취소되었습니다.'
        speak(errorMsg)
      }
    }
  }, 15000) // 15초마다 재시도
}

let currentUtterance = null

const speak = (text, options = {}) => {
  // PTT: 부모(PosView)가 continueListening을 넘겨도 자동 마이크 개방하지 않음
  const continueListening = INPUT_MODE === 'wake' && (options.continueListening !== false)
  const saveCache = options.saveCache !== false
  lastResponseText.value = text
  // 실제 답변만 "다시 말해줘" 캐시에 저장 (분석중/재생 멘트 제외)
  if (saveCache && text) {
    cachedReply = text
  }
  if (!synthesis) {
    if (continueListening) silentWakeUp()
    return
  }

  const runSpeak = () => {
    try {
      if (synthesis.paused) synthesis.resume()
      synthesis.cancel()
    } catch (e) {}

    currentUtterance = new SpeechSynthesisUtterance(text)
    const targetLang = locale.value === 'es' ? 'es-MX' : 'ko-KR'
    currentUtterance.lang = targetLang
    currentUtterance.rate = 1.0
    currentUtterance.volume = 1

    const voices = synthesis.getVoices() || []
    const langVoices = voices.filter((v) =>
      v.lang?.toLowerCase().startsWith(locale.value === 'es' ? 'es' : 'ko')
    )

    const maleVoice = langVoices.find((v) =>
      v.name.toLowerCase().includes('male') ||
      v.name.toLowerCase().includes('남성') ||
      v.name.toLowerCase().includes('hombre') ||
      v.name.toLowerCase().includes('pablo') ||
      v.name.toLowerCase().includes('diego') ||
      v.name.toLowerCase().includes('yuna') ||
      v.name.toLowerCase().includes('sora')
    )

    if (maleVoice) {
      currentUtterance.voice = maleVoice
    } else if (langVoices.length > 0) {
      currentUtterance.voice = langVoices[0]
    }

    currentUtterance.onend = () => {
      if (!isTTSPlaying) return
      isTTSPlaying = false
      clearTimeout(window.ttsFallbackTimer)

      if (INPUT_MODE === 'ptt') {
        isListening.value = false
        return
      }

      if (isListening.value && recognition) {
        try { recognition.start() } catch (e) {}
      }
      if (continueListening) {
        silentWakeUp()
      }
    }

    currentUtterance.onerror = (ev) => {
      console.warn('TTS error', ev?.error)
      isTTSPlaying = false
      clearTimeout(window.ttsFallbackTimer)
    }

    isTTSPlaying = true
    isPttHolding.value = false
    if (recognition) {
      try { recognition.stop() } catch (e) {}
    }

    if (window.ttsFallbackTimer) clearTimeout(window.ttsFallbackTimer)
    const expectedDuration = Math.max(String(text || '').length * 160 + 2000, 3500)
    window.ttsFallbackTimer = setTimeout(() => {
      if (isTTSPlaying && currentUtterance && currentUtterance.onend) {
        console.warn('TTS onend fallback triggered')
        currentUtterance.onend()
      }
    }, expectedDuration)

    try {
      synthesis.speak(currentUtterance)
      if (isIOS) {
        setTimeout(() => {
          try {
            if (synthesis.paused) synthesis.resume()
          } catch (e) {}
        }, 120)
      }
    } catch (e) {
      console.warn('synthesis.speak failed', e)
      isTTSPlaying = false
    }
  }

  // iOS: 마이크 녹음 세션이 완전히 풀린 뒤 TTS (바로 speak하면 무음인 경우 많음)
  if (isIOS) {
    stopMicTracks()
    unlockAudioContextForIOS()
    if (iosSpeakTimer) clearTimeout(iosSpeakTimer)
    iosSpeakTimer = setTimeout(runSpeak, 450)
    return
  }

  runSpeak()
}

/** wake 레거시 토글 — PTT에서는 버튼이 pointer 이벤트를 사용 */
const toggleListen = () => {
  if (INPUT_MODE === 'ptt') return
  if (isListening.value) {
    isListening.value = false
    recognition.stop()
    isOpen.value = false
  } else {
    isOpen.value = true
    if (!recognition) initSpeech()
    try {
      recognition.start()
    } catch (e) {
      console.log('Already started')
    }
    manualWakeUp()
  }
}

onMounted(() => {
  initSpeech()
})

onUnmounted(() => {
  if (recognition) {
    isListening.value = false
    recognition.stop()
  }
})

// Expose speak function for parent components to use
defineExpose({
  speak
})
</script>

<style scoped>
.samdori-container {
  position: fixed;
  bottom: 30px;
  right: 30px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

  .samdori-button {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #3b82f6, #ec4899);
    background-size: 200% 200%;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    position: relative;
    z-index: 10;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  
  .samdori-button:hover {
    transform: translateY(-3px) scale(1.05);
    box-shadow: 0 8px 25px rgba(99, 102, 241, 0.6);
  }
  
  .samdori-avatar {
    width: 85%;
    height: 85%;
    border-radius: 50%;
    background-image: url('/samdori-icon.jpg');
    background-size: cover;
    background-position: center;
    box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
    pointer-events: none;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }
  
  .samdori-button.pulsing {
    background: linear-gradient(135deg, #ef4444, #f59e0b, #ec4899);
    animation: gradientShift 3s ease infinite, pulseGlow 1.5s infinite;
  }

  .samdori-button.pulsing::before,
  .samdori-button.pulsing::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    border-radius: 50%;
    background: inherit;
    z-index: -1;
    animation: ripple 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
  }
  
  .samdori-button.pulsing::after {
    animation-delay: 0.75s;
  }
  
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  
  @keyframes ripple {
    0% { transform: scale(1); opacity: 0.7; }
    100% { transform: scale(1.7); opacity: 0; }
  }
  
  @keyframes pulseGlow {
    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
    70% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
  }

.samdori-panel {
  width: 320px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
  margin-bottom: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid #e5e7eb;
}

.panel-header {
  background: #f8fafc;
  padding: 12px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e5e7eb;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  color: #1e293b;
}

.close-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #64748b;
}

.panel-body {
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-indicator {
  font-size: 13px;
  color: #3b82f6;
  background: #eff6ff;
  padding: 8px;
  border-radius: 6px;
  text-align: center;
}

@media (max-width: 768px) {
  .samdori-container {
    bottom: 85px;
    right: 20px;
  }
  .samdori-button {
    width: 50px;
    height: 50px;
    font-size: 20px;
  }
}

.transcript-box {
  background: #f1f5f9;
  padding: 10px;
  border-radius: 8px;
  min-height: 80px;
}

.placeholder {
  color: #94a3b8;
  font-style: italic;
  font-size: 13px;
  margin: 0;
}

.final-text {
  color: #334155;
  margin: 0 0 4px 0;
  font-weight: 500;
}

.interim-text {
  color: #64748b;
  margin: 0;
  font-style: italic;
}

.intent-box {
  background: #1e293b;
  color: #a7f3d0;
  padding: 10px;
  border-radius: 8px;
  font-size: 12px;
}

.intent-box h4 {
  margin: 0 0 8px 0;
  color: white;
}

.intent-box pre {
  margin: 0;
  white-space: pre-wrap;
}

.response-box {
  margin-top: 12px;
  background: #f0fdf4;
  color: #15803d;
  padding: 12px;
  border-radius: 8px;
  border-left: 4px solid #22c55e;
  font-size: 13px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.response-box h4 {
  margin: 0 0 5px 0;
  color: #166534;
  font-size: 12px;
}

.response-box p {
  margin: 0;
  font-weight: 500;
  line-height: 1.4;
}

.badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
  color: white;
  margin-right: 6px;
}
.bg-blue { background-color: #3b82f6; }
.bg-green { background-color: #10b981; }
.bg-purple { background-color: #8b5cf6; }
.bg-orange { background-color: #f97316; }
.bg-red { background-color: #ef4444; }

.manual-input {
  width: 100%;
  margin-top: 10px;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}

.manual-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.error-box {
  background: #fee2e2;
  border-left: 4px solid #ef4444;
  padding: 10px;
  margin-top: 10px;
  border-radius: 4px;
  font-size: 12px;
  color: #b91c1c;
  word-break: break-all;
  white-space: pre-wrap;
}
</style>

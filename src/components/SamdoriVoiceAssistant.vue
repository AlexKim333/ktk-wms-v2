<template>
  <div class="samdori-container" :class="{ active: isListening }">
    <div class="samdori-button" @click="toggleListen" :class="{ pulsing: isListening }">
      <img src="/samdori-icon.jpg" class="samdori-avatar" alt="Samdori" />
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
          <p v-if="!transcript && !finalTranscript && !manualInput && !lastQuestionText" class="placeholder">"자비스~" 라고 부른 뒤 명령을 말씀해 보세요.</p>
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
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseIntent } from '../utils/SamdoriBrain'

const props = defineProps({
  validItems: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['intent-parsed'])
const { locale } = useI18n()

const isListening = ref(false)
const isOpen = ref(false)
const statusText = ref('대기 중')
const transcript = ref('')
const finalTranscript = ref('')
const manualInput = ref('')
const lastIntent = ref(null)
const lastResponseText = ref('')
const lastQuestionText = ref('')
const debugError = ref('')
const queuedCommand = ref(null)

let recognition = null
let synthesis = window.speechSynthesis
let isAwake = false
let silenceTimer = null
let isTTSPlaying = false
let retryTimer = null

const submitManual = () => {
  if (!manualInput.value.trim()) return
  // 수동 입력 시 마이크를 끄고 직접 명령어 전달
  if (recognition && isListening.value) {
    recognition.stop()
  }
  isAwake = true // 수동 입력은 호출어 생략
  finalTranscript.value = manualInput.value
  processAwakeCommand(manualInput.value)
  manualInput.value = ''
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
  // UI 언어 설정에 따라 음성 인식 언어 동적 설정 (스페인어 vs 한국어)
  recognition.lang = locale.value === 'es' ? 'es-MX' : 'ko-KR' 
  
  recognition.onstart = () => {
    isListening.value = true
    statusText.value = '마이크 켜짐 (호출어 대기중...)'
  }
  
  recognition.onresult = (event) => {
    // TTS가 말하고 있는 동안에는 마이크에 들어오는 소리(자기 목소리)를 무시합니다 (에코 방지)
    if (synthesis && synthesis.speaking) {
      return
    }

    let interim = ''
    let final = ''
    
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript
      } else {
        interim += event.results[i][0].transcript
      }
    }
    
    if (isAwake) {
      transcript.value = interim
      if (final) {
        finalTranscript.value += (finalTranscript.value ? ' ' : '') + final
        handleFinalText(final)
      }
      
      // Silence detection for auto-processing
      clearTimeout(silenceTimer)
      silenceTimer = setTimeout(() => {
        if (transcript.value || finalTranscript.value) {
          processAwakeCommand(finalTranscript.value + ' ' + transcript.value)
        }
      }, 2000)
    } else {
      // 대기 모드일 때는 화면에 텍스트 표시하지 않고 조용히 호출어만 감지
      if (final || interim) {
        const lowerText = (final || interim).toLowerCase()
        if (/(삼돌|3돌|잠돌|산돌|상돌|섬돌|참돌|탐돌|산더라|삼도라|잠도라|한돌|samdori|paquito|밖에 있다|바퀴토|파키토|자비스|jarvis)/i.test(lowerText)) {
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
    }
  }
  
  recognition.onend = () => {
    if (isListening.value && !isTTSPlaying) {
      // 계속 듣기 (에러 방지용)
      setTimeout(() => {
        try { recognition.start() } catch (e) {}
      }, 500)
    }
  }
}

const handleFinalText = (text) => {
  const lowerText = text.toLowerCase()
  
  if (isAwake) {
    // 취소 명령어 감지 (한국어/스페인어)
    if (/(취소|아니다|무시해|cancelar|cancela|olvídalo|olvidalo)/i.test(lowerText)) {
      clearTimeout(silenceTimer)
      const cancelMsg = locale.value === 'es' ? 'Comando cancelado.' : '명령이 취소되었습니다.'
      speak(cancelMsg)
      sleep()
      return
    }

    // 다시 말해줘 (Repeat) 감지: API 과금을 방지하고 로컬에서 바로 다시 읽어줌
    if (/(다시|뭐라고|못들었|한번 더|repetir|otra vez|repite)/i.test(lowerText)) {
      clearTimeout(silenceTimer)
      if (lastResponseText.value) {
        speak(lastResponseText.value)
      } else {
        const noMsg = locale.value === 'es' ? 'No hay respuesta anterior.' : '이전에 대답한 내용이 없습니다.'
        speak(noMsg)
      }
      sleep()
      return
    }
    
    // 즉시 실행(Fast-track) 명령어 감지
    const executeRegex = /(실행|끝|전송|오버|이상|처리해|완료|ya|listo|ejecutar|ejecuta)/i
    if (executeRegex.test(lowerText)) {
      clearTimeout(silenceTimer)
      // 전체 누적된 문장에서 실행 명령어만 제거 후 바로 전송
      const finalCmd = finalTranscript.value.replace(new RegExp(executeRegex.source, 'gi'), '').trim()
      processAwakeCommand(finalCmd)
      return
    }
    // 그 외는 silenceTimer에 의해 2초 후 자동 전송됨
  }
}

const wakeUp = () => {
  isAwake = true
  isOpen.value = true
  statusText.value = '듣고 있습니다! 명령을 내려주세요.'
  finalTranscript.value = ''
  transcript.value = ''
  lastResponseText.value = ''
  lastQuestionText.value = ''
  
  const reply = locale.value === 'es' ? 'Dígame, señor.' : '네, 말씀하세요.'
  speak(reply)
  
  // 3초간 입력이 없으면 자동으로 대기 모드로
  setTimeout(() => {
    if (isAwake && !transcript.value && !finalTranscript.value) {
      sleep('timeout')
    }
  }, 3000)
}

const sleep = (reason = '') => {
  if (isAwake && reason === 'timeout') {
    const sleepMsg = locale.value === 'es' ? 'Volviendo al modo de espera.' : '대기 모드로 돌아갑니다.'
    speak(sleepMsg)
  }
  isAwake = false
  statusText.value = '대기중 (호출어 대기중...)'
  transcript.value = ''
  finalTranscript.value = ''
}

const silentWakeUp = () => {
  // TTS 메아리(자신이 한 말)가 마이크에 들어가는 것을 방지하기 위해 0.8초 후 마이크 개방
  setTimeout(() => {
    isAwake = true
    isOpen.value = true
    statusText.value = '이어서 듣고 있습니다...'
    finalTranscript.value = ''
    transcript.value = ''
    
    clearTimeout(silenceTimer)
    silenceTimer = setTimeout(() => {
      if (isAwake && !transcript.value && !finalTranscript.value) {
        sleep('timeout')
      }
    }, 3000)
  }, 800)
}

const manualWakeUp = () => {
  isAwake = true
  isOpen.value = true
  statusText.value = '듣고 있습니다! 명령을 내려주세요.'
  finalTranscript.value = ''
  transcript.value = ''
  
  clearTimeout(silenceTimer)
  silenceTimer = setTimeout(() => {
    if (isAwake && !transcript.value && !finalTranscript.value) {
      sleep('timeout')
    }
  }, 3000)
}

const processAwakeCommand = async (fullText) => {
  clearTimeout(silenceTimer)
  statusText.value = 'AI 분석 중...'
  debugError.value = '' // 이전 에러 지우기
  lastResponseText.value = '' // 이전 답변 초기화
  lastQuestionText.value = fullText
  
  const analyzingMsg = locale.value === 'es' ? 'Analizando...' : '분석 중입니다.'
  speak(analyzingMsg)
  
  try {
    const intent = await parseIntent(fullText, props.validItems, lastIntent.value)
    
    // meaningless noise filter
    if (intent.intent === 'none') {
      statusText.value = '명령이 명확하지 않아 무시됨'
      sleep('timeout')
      return
    }
    
    lastIntent.value = intent
    emit('intent-parsed', intent)
    statusText.value = '명령 분석 완료'
    sleep()
  } catch (error) {
    console.error(error)
    lastIntent.value = null // 에러 시 이전 성공 결과 숨김
    statusText.value = '분석 실패: ' + error.message
    
    // 에러 원인 상세 출력 (디버그용)
    if (error.response) {
      debugError.value = `Server Error [${error.response.status}]: ${JSON.stringify(error.response.data)}`
    } else {
      debugError.value = `Client/Parser Error: ${error.name} - ${error.message}\n${error.stack}`
    }
    
    let errorMsg = locale.value === 'es' ? 'Lo siento, no entendí.' : '죄송합니다. 무슨 말인지 이해하지 못했습니다.'
    
    if (error.response && error.response.status === 503) {
      errorMsg = locale.value === 'es' ? 'El servidor de Google AI está retrasado. Puesto en cola para reintento automático.' : '현재 구글 AI 서버에 사용자가 몰려 지연되고 있습니다. 접속 대기열에 등록되었으며, 복구 시 자동 처리됩니다.'
      
      // 큐에 등록하고 자동 재시도 시작
      queuedCommand.value = fullText
      startRetryTimer()
    } else if (error.response && error.response.status === 429) {
      errorMsg = locale.value === 'es' ? 'Se ha superado el límite de uso de IA. Por favor, inténtelo de nuevo más tarde.' : 'AI 호출 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.'
    } else if (error.response && error.response.status === 404) {
      errorMsg = locale.value === 'es' ? 'Modelo de IA no encontrado.' : 'AI 모델을 찾을 수 없습니다.'
    } else if (error.name === 'SyntaxError') {
      errorMsg = locale.value === 'es' ? 'Error al procesar la respuesta de la IA.' : 'AI가 올바르지 않은 형식으로 대답했습니다.'
    }
    
    speak(errorMsg)
    sleep()
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
      const intent = await parseIntent(queuedCommand.value, props.validItems, lastIntent.value)
      
      // 성공하면 큐 비우고 처리
      lastIntent.value = intent
      emit('intent-parsed', intent)
      statusText.value = '대기 명령 분석 완료'
      
      const successMsg = locale.value === 'es' ? 'El servidor se ha recuperado. Comando ejecutado.' : '서버가 복구되었습니다. 대기 중이던 명령 처리를 완료했습니다.'
      speak(successMsg)
      
      queuedCommand.value = null
      clearInterval(retryTimer)
      retryTimer = null
      
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

const speak = (text) => {
  lastResponseText.value = text
  if (!synthesis) return
  currentUtterance = new SpeechSynthesisUtterance(text)
  const targetLang = locale.value === 'es' ? 'es-MX' : 'ko-KR'
  currentUtterance.lang = targetLang
  currentUtterance.rate = 1.1
  
  // 남성 목소리 찾기 시도
  const voices = synthesis.getVoices()
  const langVoices = voices.filter(v => v.lang.startsWith(locale.value === 'es' ? 'es' : 'ko'))
  
  // 이름에 남자(Male, 남성, Hombre, Pablo 등)가 들어간 목소리 우선 선택
  const maleVoice = langVoices.find(v => 
    v.name.toLowerCase().includes('male') || 
    v.name.toLowerCase().includes('남성') || 
    v.name.toLowerCase().includes('hombre') ||
    v.name.toLowerCase().includes('pablo') ||
    v.name.toLowerCase().includes('diego')
  )
  
  if (maleVoice) {
    currentUtterance.voice = maleVoice
  } else if (langVoices.length > 0) {
    // 남성 목소리를 명시적으로 못 찾으면 해당 언어의 기본 목소리 사용
    currentUtterance.voice = langVoices[0]
  }

  currentUtterance.onend = () => {
    if (!isTTSPlaying) return // 이미 처리됨
    isTTSPlaying = false
    clearTimeout(window.ttsFallbackTimer)
    if (isListening.value && recognition) {
      try { recognition.start() } catch (e) {}
    }
    // 대답을 마친 후 바로 다시 마이크를 열어 연속 대화를 가능하게 함
    silentWakeUp()
  }

  isTTSPlaying = true
  if (recognition) {
    try { recognition.stop() } catch (e) {}
  }
  
  // 안드로이드 크롬 TTS onend 미발동 버그 방지용 폴백(안전장치)
  if (window.ttsFallbackTimer) clearTimeout(window.ttsFallbackTimer)
  const expectedDuration = Math.max(text.length * 150 + 1500, 3000)
  window.ttsFallbackTimer = setTimeout(() => {
    if (isTTSPlaying && currentUtterance && currentUtterance.onend) {
      console.warn('TTS onend fallback triggered')
      currentUtterance.onend()
    }
  }, expectedDuration)
  
  synthesis.speak(currentUtterance)
}

const toggleListen = () => {
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
    // 마이크 버튼을 수동으로 누른 경우 즉시 깨워서 대기시간을 없앰
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
  }
  
  .samdori-button:hover {
    transform: translateY(-3px) scale(1.05);
    box-shadow: 0 8px 25px rgba(99, 102, 241, 0.6);
  }
  
  .samdori-avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    transform: scale(0.85); /* Creates a glowing ring effect from the background gradient */
    box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
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

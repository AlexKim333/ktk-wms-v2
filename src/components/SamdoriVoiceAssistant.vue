<template>
  <div class="samdori-container" :class="{ active: isListening }">
    <div class="samdori-button" @click="toggleListen" :class="{ pulsing: isListening }">
      <i class="fas fa-microphone"></i>
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
          <p v-if="!transcript && !finalTranscript" class="placeholder">"삼돌아~" 라고 부른 뒤 명령을 말씀해 보세요.</p>
          <p class="final-text">{{ finalTranscript }}</p>
          <p class="interim-text">{{ transcript }}</p>
        </div>
        
        <div class="intent-box" v-if="lastIntent">
          <h4>💡 AI 분석 결과:</h4>
          <pre>{{ JSON.stringify(lastIntent, null, 2) }}</pre>
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
const lastIntent = ref(null)

let recognition = null
let synthesis = window.speechSynthesis
let isAwake = false
let silenceTimer = null

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
    let interim = ''
    let final = ''
    
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript
      } else {
        interim += event.results[i][0].transcript
      }
    }
    
    transcript.value = interim
    
    if (final) {
      finalTranscript.value += (finalTranscript.value ? ' ' : '') + final
      handleFinalText(final)
    }
    
    // Silence detection for auto-processing
    if (isAwake) {
      clearTimeout(silenceTimer)
      silenceTimer = setTimeout(() => {
        if (transcript.value || finalTranscript.value) {
          processAwakeCommand(finalTranscript.value + ' ' + transcript.value)
        }
      }, 2000)
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
    if (isListening.value) {
      // 자동 재시작 (마이크 꺼짐 방지)
      setTimeout(() => recognition.start(), 500)
    }
  }
}

const handleFinalText = (text) => {
  const lowerText = text.toLowerCase()
  
  if (isAwake) {
    // 취소 명령어 감지 (한국어/스페인어)
    if (/(취소|아니다|다시|무시해|cancelar|cancela|olvídalo|olvidalo)/i.test(lowerText)) {
      clearTimeout(silenceTimer)
      const cancelMsg = locale.value === 'es' ? 'Comando cancelado.' : '명령이 취소되었습니다.'
      speak(cancelMsg)
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
  } else {
    // "삼돌"이 포함되면 삼돌, 삼돌이, 삼돌아 모두 매칭됨. 스페인어는 paquito 매칭. 한국어 모드에서 paquito를 '밖에 있다'로 잘못 알아듣는 경우 포함.
    if (/(삼돌|3돌|잠돌|산돌|상돌|섬돌|참돌|탐돌|산더라|삼도라|잠도라|한돌|samdori|paquito|밖에 있다|바퀴토|파키토)/i.test(lowerText)) {
      wakeUp()
    }
  }
}

const wakeUp = () => {
  isAwake = true
  isOpen.value = true
  statusText.value = '듣고 있습니다! 명령을 내려주세요.'
  finalTranscript.value = ''
  transcript.value = ''
  
  const reply = locale.value === 'es' ? 'Dígame, señor.' : '네, 말씀하세요.'
  speak(reply)
  
  // 10초간 명령이 없으면 다시 대기 모드로
  setTimeout(() => {
    if (isAwake && !transcript.value && !finalTranscript.value) {
      sleep()
    }
  }, 10000)
}

const sleep = () => {
  isAwake = false
  statusText.value = '마이크 켜짐 (호출어 대기중...)'
  transcript.value = ''
  finalTranscript.value = ''
}

const processAwakeCommand = async (fullText) => {
  clearTimeout(silenceTimer)
  statusText.value = 'AI 분석 중...'
  
  const analyzingMsg = locale.value === 'es' ? 'Analizando...' : '분석 중입니다.'
  speak(analyzingMsg)
  
  try {
    const intent = await parseIntent(fullText, props.validItems)
    lastIntent.value = intent
    emit('intent-parsed', intent)
    statusText.value = '명령 처리 완료'
    sleep()
  } catch (error) {
    console.error(error)
    statusText.value = '분석 실패: ' + error.message
    const errorMsg = locale.value === 'es' ? 'Lo siento, no entendí.' : '죄송합니다. 무슨 말인지 이해하지 못했습니다.'
    speak(errorMsg)
    sleep()
  }
}

const speak = (text) => {
  if (!synthesis) return
  const utterance = new SpeechSynthesisUtterance(text)
  const targetLang = locale.value === 'es' ? 'es-MX' : 'ko-KR'
  utterance.lang = targetLang
  utterance.rate = 1.1
  
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
    utterance.voice = maleVoice
  } else if (langVoices.length > 0) {
    // 남성 목소리를 명시적으로 못 찾으면 해당 언어의 기본 목소리 사용
    utterance.voice = langVoices[0]
  }

  synthesis.speak(utterance)
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
  background-color: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  transition: all 0.3s ease;
}

.samdori-button:hover {
  transform: scale(1.1);
}

.samdori-button.pulsing {
  background-color: #ef4444;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
  70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
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
</style>

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
import { parseIntent } from '../utils/SamdoriBrain'

const emit = defineEmits(['intent-parsed'])

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
  recognition.lang = 'ko-KR' // 기본 한국어, 스페인어 혼용 가능 여부는 브라우저 엔진에 따라 다름
  
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
      finalTranscript.value = final
      handleFinalText(final)
    }
    
    // Silence detection for auto-processing
    if (isAwake) {
      clearTimeout(silenceTimer)
      silenceTimer = setTimeout(() => {
        if (transcript.value || finalTranscript.value) {
          processAwakeCommand(finalTranscript.value + ' ' + transcript.value)
        }
      }, 2000) // 2 seconds of silence triggers processing
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
  if (!isAwake && (lowerText.includes('삼돌') || lowerText.includes('samdori'))) {
    wakeUp()
  } else if (isAwake) {
    // Already handled by silence timer, but we can fast-track if needed
  }
}

const wakeUp = () => {
  isAwake = true
  isOpen.value = true
  statusText.value = '듣고 있습니다! 명령을 내려주세요.'
  finalTranscript.value = ''
  transcript.value = ''
  speak("네, 말씀하세요.")
  
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
  speak("분석 중입니다.")
  
  try {
    const intent = await parseIntent(fullText)
    lastIntent.value = intent
    emit('intent-parsed', intent)
    statusText.value = '명령 처리 완료'
    sleep()
  } catch (error) {
    console.error(error)
    statusText.value = '분석 실패: ' + error.message
    speak("죄송합니다. 무슨 말인지 이해하지 못했습니다.")
    sleep()
  }
}

const speak = (text) => {
  if (!synthesis) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ko-KR'
  utterance.rate = 1.1
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

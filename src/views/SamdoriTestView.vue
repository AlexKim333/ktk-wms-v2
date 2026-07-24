<template>
  <div class="test-view">
    <div class="header-area">
      <button class="back-btn" @click="$router.push('/')">
        <i class="fas fa-arrow-left"></i> 뒤로가기
      </button>
      <h2>삼돌이 (Samdori) 테스트 랩 🧪</h2>
    </div>

    <div class="test-content">
      <div class="instructions">
        <h3>사용 방법</h3>
        <ol>
          <li>우측 하단의 마이크 버튼을 클릭하여 삼돌이를 깨웁니다.</li>
          <li><strong>"삼돌아~"</strong> 라고 부릅니다. (상태가 '듣고 있습니다!'로 변경됨)</li>
          <li>원하는 명령을 자연스럽게 말합니다.
            <ul>
              <li>예: "삼돌아, P-160 검정색 2박스 주문 리스트에 추가해줘"</li>
              <li>예: "Agrega tres cajas de P-160 rojo por favor"</li>
              <li>예: "주문 리스트 확인"</li>
            </ul>
          </li>
          <li>아래 로그에서 AI가 어떻게 의도를 파악(JSON)했는지 확인합니다.</li>
        </ol>
      </div>

      <div class="log-area">
        <h3>명령 히스토리</h3>
        <div v-if="intentLogs.length === 0" class="empty-log">
          아직 명령이 없습니다. 삼돌이를 부르고 명령해 보세요.
        </div>
        <div v-for="(log, idx) in intentLogs" :key="idx" class="log-item">
          <div class="log-time">{{ log.time }}</div>
          <pre>{{ JSON.stringify(log.intent, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <SamdoriVoiceAssistant ref="samdori" @intent-parsed="handleIntent" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import SamdoriVoiceAssistant from '../components/SamdoriVoiceAssistant.vue'

const samdori = ref(null)
const intentLogs = ref([])

const handleIntent = (intent) => {
  intentLogs.value.unshift({
    time: new Date().toLocaleTimeString(),
    intent: intent
  })
  
  // 간단한 피드백 음성 (테스트용)
  if (intent.intent === 'add_order') {
    samdori.value.speak(`${intent.item} ${intent.color || ''} ${intent.qty}개 장바구니에 담았습니다.`)
  } else if (intent.intent === 'search') {
    samdori.value.speak(`${intent.item} 재고를 검색합니다.`)
  } else if (intent.intent === 'check') {
    samdori.value.speak(`현재 장바구니 리스트를 불러옵니다.`)
  } else if (intent.intent === 'submit') {
    samdori.value.speak(`주문을 전송합니다.`)
  }
}
</script>

<style scoped>
.test-view {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.header-area {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 30px;
}

.back-btn {
  padding: 8px 16px;
  background: #f1f5f9;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
}

.instructions {
  background: white;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  margin-bottom: 20px;
  line-height: 1.6;
}

.instructions h3 {
  margin-top: 0;
  color: #3b82f6;
}

.log-area {
  background: #1e293b;
  color: #e2e8f0;
  padding: 20px;
  border-radius: 10px;
  min-height: 300px;
}

.empty-log {
  color: #64748b;
  font-style: italic;
  text-align: center;
  margin-top: 50px;
}

.log-item {
  background: #0f172a;
  padding: 10px;
  border-radius: 6px;
  margin-bottom: 10px;
  border-left: 4px solid #3b82f6;
}

.log-time {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 5px;
}

.log-item pre {
  margin: 0;
  color: #a7f3d0;
  font-size: 13px;
}
</style>

<template>
  <div class="setup-container">
    <div class="setup-card">
      <h2>시스템 초기화 (관리자 전용)</h2>
      <p>새로운 아키텍처(4단계 단가 및 바코드 분리) 적용을 위해 Frappe 백엔드에 필수 커스텀 필드를 생성합니다.</p>
      
      <div class="logs">
        <div v-for="(log, idx) in logs" :key="idx" :class="['log-item', log.type]">
          {{ log.message }}
        </div>
      </div>

      <div class="setup-actions">
        <button @click="startSetup" class="btn-setup" :disabled="isProcessing">
          1. 커스텀 필드 자동 생성
        </button>
        <button @click="createPriceLists" class="btn-setup btn-secondary-setup" :disabled="isProcessing">
          2. 지점별 전용 단가표(Price List) 일괄 생성
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'

const logs = ref([])
const isProcessing = ref(false)

const frappeApi = axios.create({
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  withCredentials: true 
})

const logInfo = (msg) => logs.value.push({ message: msg, type: 'info' })
const logSuccess = (msg) => logs.value.push({ message: msg, type: 'success' })
const logError = (msg) => logs.value.push({ message: msg, type: 'error' })

const customFields = [
  // Item fields
  { dt: 'Item', fieldname: 'custom_tier_1_barcode', label: 'Tier 1 Barcode (1qty)', fieldtype: 'Data', insert_after: 'item_group' },
  { dt: 'Item', fieldname: 'custom_tier_1_qty', label: 'Tier 1 Qty', fieldtype: 'Float', default: '1', insert_after: 'custom_tier_1_barcode' },
  { dt: 'Item', fieldname: 'custom_tier_2_barcode', label: 'Tier 2 Barcode', fieldtype: 'Data', insert_after: 'custom_tier_1_qty' },
  { dt: 'Item', fieldname: 'custom_tier_2_qty', label: 'Tier 2 Qty', fieldtype: 'Float', default: '12', insert_after: 'custom_tier_2_barcode' },
  { dt: 'Item', fieldname: 'custom_tier_3_barcode', label: 'Tier 3 Barcode', fieldtype: 'Data', insert_after: 'custom_tier_2_qty' },
  { dt: 'Item', fieldname: 'custom_tier_3_qty', label: 'Tier 3 Qty', fieldtype: 'Float', default: '100', insert_after: 'custom_tier_3_barcode' },
  { dt: 'Item', fieldname: 'custom_tier_4_barcode', label: 'Tier 4 Barcode', fieldtype: 'Data', insert_after: 'custom_tier_3_qty' },
  { dt: 'Item', fieldname: 'custom_tier_4_qty', label: 'Tier 4 Qty', fieldtype: 'Float', default: '300', insert_after: 'custom_tier_4_barcode' },
  
  // Item Price fields
  { dt: 'Item Price', fieldname: 'custom_tier_2_price', label: 'Tier 2 Price', fieldtype: 'Currency', insert_after: 'price_list_rate' },
  { dt: 'Item Price', fieldname: 'custom_tier_3_price', label: 'Tier 3 Price', fieldtype: 'Currency', insert_after: 'custom_tier_2_price' },
  { dt: 'Item Price', fieldname: 'custom_tier_4_price', label: 'Tier 4 Price', fieldtype: 'Currency', insert_after: 'custom_tier_3_price' }
]

const startSetup = async () => {
  if (isProcessing.value) return
  isProcessing.value = true
  logs.value = []
  logInfo('초기화 시작...')

  for (const field of customFields) {
    try {
      // Check if field exists
      const checkRes = await frappeApi.get(`/api/resource/Custom Field?filters=[["dt", "=", "${field.dt}"], ["fieldname", "=", "${field.fieldname}"]]`)
      
      if (checkRes.data.data && checkRes.data.data.length > 0) {
        logSuccess(`[${field.dt}] ${field.fieldname} 이미 존재함.`)
      } else {
        logInfo(`[${field.dt}] ${field.fieldname} 생성 중...`)
        await frappeApi.post('/api/resource/Custom Field', field)
        logSuccess(`[${field.dt}] ${field.fieldname} 생성 완료!`)
      }
    } catch (error) {
      logError(`[${field.dt}] ${field.fieldname} 생성 실패: ${error.response?.data?.exc || error.message}`)
    }
  }

  logInfo('초기화가 완료되었습니다. 콘솔에서 오류가 없는지 확인하세요.')
  isProcessing.value = false
}

const createPriceLists = async () => {
  if (isProcessing.value) return
  isProcessing.value = true
  logs.value = []
  logInfo('지점별 단가표(Price List) 생성 시작...')

  try {
    // 1. 하위 창고(지점) 목록 가져오기
    const resWh = await frappeApi.get('/api/resource/Warehouse', {
      params: {
        fields: JSON.stringify(['name', 'warehouse_name']),
        filters: JSON.stringify([['disabled', '=', 0]])
      }
    })
    
    // SCURUSAL - K 하위 지점 필터링 로직이 POS에 있지만, 여기선 안전하게 이름에 하이픈이 있거나 지점명일만한 것들을 다 가져오거나, 
    // 그냥 모든 창고 이름으로 단가표를 만듭니다 (메인 창고 포함).
    const branches = resWh.data.data

    for (const branch of branches) {
      const plName = branch.name
      try {
        // 이미 있는지 체크
        await frappeApi.get(`/api/resource/Price List/${encodeURIComponent(plName)}`)
        logSuccess(`[Price List] ${plName} 이미 존재함.`)
      } catch (e) {
        if (e.response && e.response.status === 404) {
          // 없으면 생성
          logInfo(`[Price List] ${plName} 생성 중...`)
          await frappeApi.post('/api/resource/Price List', {
            price_list_name: plName,
            selling: 1,
            buying: 0,
            currency: 'USD', // 기본 통화가 USD라고 가정 (ERPNext 기본값에 따름)
            enabled: 1
          })
          logSuccess(`[Price List] ${plName} 생성 완료!`)
        } else {
          logError(`[Price List] ${plName} 확인 중 에러: ${e.message}`)
        }
      }
    }
    logInfo('단가표 일괄 생성이 완료되었습니다!')
  } catch (error) {
    logError(`단가표 생성 실패: ${error.message}`)
  }
  isProcessing.value = false
}
</script>

<style scoped>
.setup-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: var(--theme-bg-gradient);
  font-family: var(--sans);
  color: var(--text-primary);
  padding: 20px;
}
.setup-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  padding: 40px;
  border-radius: 12px;
  max-width: 600px;
  width: 100%;
}
.logs {
  background: rgba(0, 0, 0, 0.3);
  padding: 20px;
  border-radius: 8px;
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
  margin: 20px 0;
  font-family: monospace;
}
.log-item {
  margin-bottom: 5px;
  font-size: 13px;
}
.log-item.info { color: #aaa; }
.log-item.success { color: var(--accent-green); }
.log-item.error { color: #ff5555; }

.setup-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.btn-setup {
  width: 100%;
  background: var(--accent-green);
  color: white;
  border: none;
  padding: 15px;
  font-size: 16px;
  font-weight: bold;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}
.btn-setup:hover:not(:disabled) {
  filter: brightness(1.1);
}
.btn-setup:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-secondary-setup {
  background: #3b82f6; /* Blue for secondary action */
}
</style>

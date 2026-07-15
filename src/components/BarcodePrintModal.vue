<template>
  <div class="modal-overlay">
    <div class="modal-content">
      <header class="modal-header">
        <h3>🖨️ Barcode Print Wizard</h3>
        <button class="close-btn" @click="handleClose">✕</button>
      </header>

      <div class="modal-body">
        <!-- 🌟 Step 1: 대상 선택 -->
        <div class="step-container" :class="{ active: currentStep === 1 }">
          <h4 class="step-title">Step 1. What to print?</h4>
          <div class="radio-group">
            <label class="radio-card" :class="{ selected: targetSelection === 'selected' }">
              <input type="radio" v-model="targetSelection" value="selected" />
              <div class="card-content">
                <strong>Selected Items ({{ selectedItems.length }})</strong>
                <p>Print only the checked items.</p>
              </div>
            </label>
            <label class="radio-card" :class="{ selected: targetSelection === 'all' }">
              <input type="radio" v-model="targetSelection" value="all" />
              <div class="card-content">
                <strong>All Items</strong>
                <p>Print all registered items.</p>
              </div>
            </label>
          </div>
        </div>

        <!-- 🌟 Step 2: 인쇄 규격 선택 -->
        <div class="step-container" :class="{ active: currentStep === 2 }">
          <h4 class="step-title">Step 2. Select Print Layout</h4>
          <div class="radio-group layout-row">
            <label class="radio-card print-card" :class="{ selected: printMethod === 'label' }">
              <input type="radio" v-model="printMethod" value="label" />
              <div class="card-content centered">
                <span class="print-icon">🏷️</span>
                <strong>Label Printer</strong>
                <p>Roll-type labels</p>
              </div>
            </label>
            <label class="radio-card print-card" :class="{ selected: printMethod === 'a4' }">
              <input type="radio" v-model="printMethod" value="a4" />
              <div class="card-content centered">
                <span class="print-icon">📄</span>
                <strong>A4 / Letter</strong>
                <p>Grid-type sheets</p>
              </div>
            </label>
          </div>
        </div>
        
        <!-- 🌟 Step 3: 바코드 렌더링 영역 (인쇄용) -->
        <div v-show="currentStep === 3" class="step-container active print-preview-area">
          <h4 class="step-title">Preview (Forwarding to Print screen...)</h4>
          <div id="print-zone" :class="printMethod === 'label' ? 'print-label' : 'print-a4'">
            <div v-for="item in itemsToPrint" :key="item.item_code" class="barcode-wrapper">
              <div class="barcode-meta">{{ item.item_name }} ({{ item.custom_color || 'Base' }})</div>
              <svg class="barcode-svg" :data-value="item.barcodeSerial"></svg>
            </div>
          </div>
        </div>
      </div>

      <footer class="modal-footer">
        <button type="button" class="btn-cancel" @click="goBack" v-if="currentStep > 1 && currentStep < 3">Back</button>
        <button type="button" class="btn-cancel" @click="handleClose" v-else>Cancel</button>
        
        <button type="button" class="btn-next" @click="goNext" v-if="currentStep < 2">
          Next
        </button>
        <button type="button" class="btn-print" @click="generateAndPrint" v-if="currentStep === 2">
          Generate & Print
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import axios from 'axios'
// JsBarcode 라이브러리 동적 로드 (실제 프로젝트에선 npm install jsbarcode 권장)
import JsBarcode from 'jsbarcode'

const props = defineProps({
  selectedItems: { type: Array, default: () => [] }
})
const emit = defineEmits(['close'])

const currentStep = ref(1)
const targetSelection = ref('selected')
const printMethod = ref('label')

const itemsToPrint = ref([])
const isGenerating = ref(false)

const frappeApi = axios.create({
  headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
  withCredentials: true
})

const goBack = () => {
  if (currentStep.value > 1) currentStep.value--
}

const goNext = () => {
  if (currentStep.value === 1) {
    if (targetSelection.value === 'selected' && props.selectedItems.length === 0) {
      alert("No items selected.")
      return
    }
    currentStep.value = 2
  }
}

const generateAndPrint = async () => {
  currentStep.value = 3
  isGenerating.value = true
  try {
    let rawItems = []
    if (targetSelection.value === 'selected') {
      const filters = JSON.stringify([["name", "in", props.selectedItems]])
      const res = await frappeApi.get('/api/resource/Item', {
        params: { filters, fields: JSON.stringify(['name', 'item_code', 'item_name', 'custom_color', 'custom_pack_qty']), limit_page_length: 999 }
      })
      rawItems = res.data.data
    } else {
      const res = await frappeApi.get('/api/resource/Item', {
        params: { fields: JSON.stringify(['name', 'item_code', 'item_name', 'custom_color', 'custom_pack_qty']), limit_page_length: 999 }
      })
      rawItems = res.data.data
    }

    // 시리얼 조합 로직 적용
    itemsToPrint.value = rawItems.map(item => {
      let serial = `${item.item_name}-${item.custom_color || ''}`
      if (item.custom_pack_qty > 1) serial += `-${item.custom_pack_qty}`
      return {
        ...item,
        barcodeSerial: serial
      }
    })

    // DOM 렌더링 대기 후 JsBarcode 실행
    await nextTick()
    
    document.querySelectorAll('.barcode-svg').forEach(el => {
      const val = el.getAttribute('data-value')
      if (val) {
        JsBarcode(el, val, {
          format: "CODE128",
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          margin: 10
        })
      }
    })

    // 바코드 그려진 후 시스템 프린트창 호출
    setTimeout(() => {
      window.print()
      emit('close') // 프린트 창 띄우고 모달 닫기
    }, 500)

  } catch (err) {
    console.error("Barcode Generation Error:", err)
    alert("Failed to load barcode data.")
    currentStep.value = 2
  } finally {
    isGenerating.value = false
  }
}

const handleClose = () => {
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
}

.modal-content {
  background: white; width: 100%; max-width: 550px;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
  display: flex; flex-direction: column;
}

.modal-header {
  padding: 20px 24px; border-bottom: 1px solid #e2e8f0;
  display: flex; justify-content: space-between; align-items: center;
}
.modal-header h3 { margin: 0; font-size: 18px; color: #1e293b; }
.close-btn { background: none; border: none; font-size: 20px; color: #94a3b8; cursor: pointer; }

.modal-body { padding: 24px; }

.step-container { display: none; }
.step-container.active { display: block; animation: fadeIn 0.3s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

.step-title { margin: 0 0 16px; font-size: 16px; color: #334155; }

.radio-group { display: flex; flex-direction: column; gap: 12px; }
.layout-row { flex-direction: row; }

.radio-card {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 16px; border: 2px solid #e2e8f0; border-radius: 8px;
  cursor: pointer; transition: all 0.2s;
}
.radio-card input { margin-top: 4px; }
.radio-card.selected {
  border-color: #00a896;
  background: #f0fdfa;
}
.card-content strong { display: block; font-size: 15px; color: #1e293b; margin-bottom: 4px; }
.card-content p { margin: 0; font-size: 13px; color: #64748b; }

.print-card { flex: 1; justify-content: center; text-align: center; }
.print-card input { display: none; }
.card-content.centered { display: flex; flex-direction: column; align-items: center; }
.print-icon { font-size: 32px; margin-bottom: 8px; }

.modal-footer {
  padding: 16px 24px; border-top: 1px solid #e2e8f0;
  display: flex; justify-content: space-between; background: #f8fafc;
  border-radius: 0 0 12px 12px;
}

.btn-cancel { padding: 10px 20px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: bold; cursor: pointer; }
.btn-next, .btn-print { padding: 10px 24px; background: #00a896; border: none; border-radius: 6px; font-weight: bold; color: white; cursor: pointer; margin-left: auto;}
.btn-print { background: #0f766e; }

/* 인쇄 미리보기 영역 숨김 처리 (실제 모니터에선 보이지 않지만 인쇄시에만 나타남) */
.print-preview-area {
  max-height: 300px;
  overflow: auto;
  text-align: center;
}
.barcode-wrapper {
  margin-bottom: 20px;
  display: inline-block;
  text-align: center;
}
.barcode-meta { font-weight: bold; font-size: 14px; margin-bottom: 4px; }

/* 🌟 프린트 스타일 (Ctrl+P 시 동작) */
@media print {
  body * { visibility: hidden; }
  #print-zone, #print-zone * { visibility: visible; }
  #print-zone {
    position: absolute; left: 0; top: 0; width: 100%;
  }
  
  .print-label .barcode-wrapper {
    display: block;
    page-break-after: always;
    margin: 0;
    padding: 10px;
  }
  
  .print-a4 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
  }
}
</style>

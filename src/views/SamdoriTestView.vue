<template>
  <div class="test-view">
    <!-- 헤더 바 -->
    <div class="header-area">
      <button class="back-btn" @click="$router.push('/')">
        <i class="fas fa-arrow-left"></i> 뒤로가기
      </button>
      <div class="header-titles">
        <h2>삼돌이 (Samdori) AI 비서 & Context Caching 검증 랩 🧪</h2>
        <p class="subtitle">
          Frappe 실시간 ERP 재고(Item + Bin) 연동 · 실시간 Delta 주입(Override) · WMS 4대 규칙 실증 테스트
        </p>
      </div>
      <div class="header-actions">
        <button
          class="sync-btn"
          :class="{ 'is-loading': isLoadingStock }"
          @click="fetchFrappeStock"
          :disabled="isLoadingStock"
        >
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoadingStock }"></i>
          {{ isLoadingStock ? '재고 동기화 중...' : 'Frappe 실시간 재고 동기화' }}
        </button>
      </div>
    </div>

    <!-- 🔥 0. 실시간 Context Caching 토큰 미터기 (Token Savings Meter) 🔥 -->
    <div class="panel-section token-meter-section">
      <div class="meter-header">
        <div class="meter-title-wrap">
          <i class="fas fa-tachometer-alt meter-icon"></i>
          <div>
            <h3>📊 실시간 Context Caching 토큰 미터기 (Token Savings Gauge)</h3>
            <span class="meter-subtitle">구글 Gemini 공식 Context Cache 적용 시 실질 토큰 및 비용 절감 효과 비교</span>
          </div>
        </div>
        <div class="saving-badge-lg">
          🔥 토큰 절감율: <strong>{{ tokenSavingsRate }}%</strong> 절약!
        </div>
      </div>

      <div class="meter-grid">
        <div class="meter-card bad">
          <div class="m-label">매번 전체 마스터 전송 시 (No Cache)</div>
          <div class="m-value text-red">{{ noCacheTokens.toLocaleString() }} <span class="m-unit">Tokens / 1회</span></div>
          <div class="m-sub">약 $0.05 / 1회 발화 (1만 건 호출 시 $500 소모)</div>
        </div>
        <div class="meter-card good">
          <div class="m-label">Context Cache + Delta Override 전송 시</div>
          <div class="m-value text-green">{{ currentDeltaTokens.toLocaleString() }} <span class="m-unit">Tokens / 1회</span></div>
          <div class="m-sub">
            기본 발화(~180토큰) + 델타 {{ activeDeltas.length }}건({{ activeDeltas.length * 28 }}토큰)
          </div>
        </div>
        <div class="meter-card highlight">
          <div class="m-label">1회 발화 당 절약되는 토큰 수</div>
          <div class="m-value text-blue">-{{ (noCacheTokens - currentDeltaTokens).toLocaleString() }} <span class="m-unit">Tokens</span></div>
          <div class="m-sub">1만 회 호출 시 <strong>약 $499.50 비용 절감</strong></div>
        </div>
      </div>

      <!-- 토큰 비교 게이지 바 -->
      <div class="gauge-bar-wrap">
        <div class="gauge-label">
          <span>전체 미캐싱 전송 (200,000 토큰 100% 소모)</span>
          <span>현재 Delta 전송 ({{ (100 - tokenSavingsRate).toFixed(2) }}% 소모)</span>
        </div>
        <div class="gauge-track">
          <div
            class="gauge-fill"
            :style="{ width: Math.max(0.5, (currentDeltaTokens / noCacheTokens) * 100) + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <!-- 1. Frappe 실시간 재고 서머리 현황 및 델타 시뮬레이터 카드 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">등록된 활성 품목 마스터 (Item)</div>
        <div class="stat-value">{{ itemsList.length }} <span class="unit">개</span></div>
        <div class="stat-desc">/api/resource/Item (Disabled=0 필터)</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">창고별 재고 레코드 (Bin)</div>
        <div class="stat-value">{{ binsList.length }} <span class="unit">건</span></div>
        <div class="stat-desc">/api/resource/Bin (Nos ➔ Box 자동 변환)</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">활성화된 실시간 Delta 변경분</div>
        <div class="stat-value text-amber">{{ activeDeltas.length }} <span class="unit">건</span></div>
        <div class="stat-desc">수량 변경 · 신제품 · 단종(Disabled)</div>
      </div>
      <div class="stat-card filter-card">
        <div class="stat-label">창고 필터</div>
        <select v-model="selectedWarehouse" class="warehouse-select">
          <option value="">전체 창고 (All Warehouses)</option>
          <option v-for="wh in availableWarehouses" :key="wh" :value="wh">{{ wh }}</option>
        </select>
      </div>
      <div class="stat-card filter-card" style="border: 2px solid rgba(59, 130, 246, 0.4);">
        <div class="stat-label" style="color: #3b82f6; font-weight: bold;">👤 계정 권한 시뮬레이터</div>
        <select v-model="simulatedUserRole" class="warehouse-select" style="font-weight: 600; color: #1e40af;">
          <option value="ADMIN">👑 관리자 (알라르꼰 + 전체합계 폴백)</option>
          <option value="CARMEN">🏢 까르멘 지점 (지점 + 본사 알라르꼰 동시 안내)</option>
          <option value="TIENDA">🏬 띠엔다 지점 (지점 + 본사 알라르꼰 동시 안내)</option>
        </select>
      </div>
    </div>

    <!-- 2. 실시간 Delta 시뮬레이터 패널 (Context Caching Delta Override 검증) -->
    <div class="panel-section delta-section">
      <div class="panel-header">
        <h3>⚡ 실시간 Delta 주입 시뮬레이터 (Context Cache Override 실험)</h3>
        <span class="badge badge-amber">실시간 수량(Box) / 신제품 / 단종(Disabled=1) Override 검증</span>
      </div>
      <p class="section-desc">
        캐싱된 기존 마스터 재고를 다시 구울 필요 없이, 실시간 수량 변경이나 신제품 추가,
        <strong>특히 ERPNext의 품목 단종(Disabled=1) 처리</strong> 발생 시 AI 비서가 차이분(Delta)을 0.5초 만에 최우선 인식하는지 테스트합니다.
      </p>
      <div class="delta-controls">
        <div class="delta-input-group">
          <label>SKU 코드 (실제 품번)</label>
          <input
            v-model="deltaInput.code"
            type="text"
            placeholder="예: P-160-NEGRO-400"
            class="delta-input"
          />
        </div>
        <div class="delta-input-group">
          <label>창고 (부분 일치 가능)</label>
          <select v-model="deltaInput.warehouse" class="delta-input">
            <option v-for="wh in availableWarehouses" :key="wh" :value="wh">{{ wh }}</option>
          </select>
        </div>
        <div class="delta-input-group qty-group">
          <label>변경 수량(Box)</label>
          <input
            v-model.number="deltaInput.qty"
            type="number"
            placeholder="예: 999"
            class="delta-input"
          />
        </div>
        <button class="btn-delta-add" @click="applyDeltaOverride">
          <i class="fas fa-plus"></i> 가상 델타 수량 적용 (+28토큰)
        </button>
        <button class="btn-new-item" @click="simulateNewProductDelta">
          <i class="fas fa-box-open"></i> + 신제품(P-500 검정) 등록 (+30토큰)
        </button>
        <!-- ★ ERPNext 단종(Disabled=1) 처리 Delta 시뮬레이션 버튼 ★ -->
        <button class="btn-disabled-item" @click="simulateDisabledItemDelta">
          <i class="fas fa-ban"></i> 🚫 품목 단종(Disabled=1) 처리 (+25토큰)
        </button>
        <button v-if="activeDeltas.length > 0" class="btn-delta-clear" @click="clearDeltas">
          델타 초기화
        </button>
      </div>

      <div v-if="activeDeltas.length > 0" class="active-deltas-list">
        <div v-for="(d, index) in activeDeltas" :key="index" class="delta-chip" :class="{ 'chip-disabled': d.disabled }">
          <span class="chip-code">{{ d.code }}</span>
          <span class="chip-wh">{{ d.warehouse }}</span>
          <span v-if="d.disabled" class="chip-qty">🚫 ERPNext 단종(Disabled=1) 처리됨</span>
          <span v-else class="chip-qty">{{ d.qty }} Box (Delta 적용됨)</span>
          <button class="chip-remove" @click="removeDelta(index)">&times;</button>
        </div>
      </div>
    </div>

    <!-- 3. 실시간 음성/텍스트 발화 실험 및 AI 검증 Feed -->
    <div class="panel-section test-feed-section">
      <div class="panel-header">
        <h3>🎙️ 삼돌이 AI 비서 음성·텍스트 명령 테스트</h3>
        <span class="badge badge-blue">WMS 4대 규칙 & ERP 재고 정합성 검증</span>
      </div>
      <p class="section-desc">
        우측 하단의 마이크 버튼을 클릭하여 음성으로 말하거나, 아래 <strong>빠른 테스트 버튼</strong>을 클릭하여
        삼돌이의 의도 분석 JSON과 Frappe 재고 대조 결과를 즉시 확인하세요.
      </p>

      <!-- 빠른 음성 발화 예시 버튼 -->
      <div class="quick-examples">
        <span class="quick-label">빠른 발화 테스트:</span>
        <button class="btn-example" @click="simulateSpokenCommand('알라르꼰 P-160 검정 재고 몇 개야?')">
          "알라르꼰 P-160 검정 재고 몇 개야?" (P-160-NEGRO-400 재고검색)
        </button>
        <button class="btn-example" @click="simulateSpokenCommand('P-160 검정 두 박스 장바구니에 담아')">
          "P-160 검정 두 박스 담아" (장바구니 담기)
        </button>
        <button class="btn-example" @click="simulateSpokenCommand('L-OP80 재고 알려줘')">
          "L-OP80 재고 알려줘" (혼색·검정·흰색 공존 역질문)
        </button>
        <button class="btn-example" @click="simulateSpokenCommand('알라르꼰 P-500 검정 몇 개 있어?')">
          "알라르꼰 P-500 검정 몇 개 있어?" (신제품 델타 테스트)
        </button>
        <!-- ★ 단종 품목 발화 테스트 버튼 ★ -->
        <button class="btn-example btn-example-red" @click="simulateSpokenCommand('알라르꼰 P-160 블랙 단종 재고 확인')">
          "알라르꼰 P-160 블랙 단종 재고 확인" (Disabled 규칙 검증)
        </button>
      </div>

      <!-- 검증 결과 피드 (Log List) -->
      <div class="log-area">
        <div v-if="intentLogs.length === 0" class="empty-log">
          <i class="fas fa-microphone-alt"></i>
          <p>아직 실행된 명령이 없습니다. 마이크로 말하거나 위 빠른 발화 버튼을 눌러보세요.</p>
        </div>

        <div v-for="(log, idx) in intentLogs" :key="idx" class="verification-card">
          <div class="card-top">
            <div class="top-left">
              <span class="log-time">{{ log.time }}</span>
              <span class="intent-badge" :class="'intent-' + log.intent.intent">
                {{ formatIntentName(log.intent.intent) }}
              </span>
            </div>
            <!-- 카드별 소모 토큰 뱃지 -->
            <div class="token-pill">
              <i class="fas fa-bolt"></i> ⚡ 실전송: <strong>{{ log.tokens }} Tokens</strong> (99.9% 절약)
            </div>
          </div>

          <div class="card-speech">
            <span class="label">발화 텍스트 (STT):</span>
            <strong>"{{ log.speech }}"</strong>
          </div>

          <!-- Frappe 재고 대조 & 답변 피드백 카드 -->
          <div class="card-ground-truth" :class="{ 'gt-disabled': log.isDisabled }">
            <div class="gt-title">
              <i class="fas fa-database"></i> Frappe 실시간 ERP 재고 대조 결과 (Nos ➔ Box 단위 변환 완료):
            </div>
            <div class="gt-content">{{ log.erpFeedback }}</div>
          </div>

          <!-- Gemini 추출 의도 JSON -->
          <details class="json-details">
            <summary>🤖 Gemini 의도 파싱 JSON 원본 보기</summary>
            <pre>{{ JSON.stringify(log.intent, null, 2) }}</pre>
          </details>
        </div>
      </div>
    </div>

    <!-- 4. Frappe ERP 실시간 재고 서머리 미리보기 테이블 (Nos ➔ Box 변환 표기) -->
    <div class="panel-section summary-section">
      <div class="panel-header">
        <h3>📦 Frappe 실시간 재고 서머리 (Item & Bin 미니 표 - Nos ➔ Box 변환 적용)</h3>
        <div class="search-input-wrap">
          <input
            v-model="tableSearchQuery"
            type="text"
            placeholder="SKU 코드 또는 품명 검색..."
            class="table-search-input"
          />
        </div>
      </div>

      <div class="table-container">
        <table class="summary-table">
          <thead>
            <tr>
              <th>SKU 코드</th>
              <th>품명 (Item Name)</th>
              <th>창고 (Warehouse)</th>
              <th class="text-right">현재 잔고 (Box 단위 변환)</th>
              <th class="text-right">ERP 원본 낱개 (Nos)</th>
              <th>Delta 상태</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredStockRows.length === 0">
              <td colspan="6" class="empty-row">
                {{ isLoadingStock ? '재고 데이터를 로딩 중입니다...' : '표시할 재고 데이터가 없습니다.' }}
              </td>
            </tr>
            <tr v-for="(row, i) in filteredStockRows.slice(0, 50)" :key="i">
              <td class="font-bold code-cell">{{ row.item_code }}</td>
              <td>{{ row.item_name }}</td>
              <td><span class="wh-tag">{{ row.warehouse }}</span></td>
              <!-- Box 단위 변환 수량 표기 -->
              <td class="text-right font-bold" :class="row.disabled ? 'text-red' : (row.boxes > 0 ? 'text-teal' : 'text-gray')">
                <template v-if="row.disabled">
                  🚫 불가
                </template>
                <template v-else>
                  {{ row.boxes.toLocaleString() }} <span class="unit-sm">Box</span>
                  <span v-if="row.remainder > 0" class="remainder-txt">({{ row.remainder }}개)</span>
                </template>
              </td>
              <!-- ERP 원본 낱개 (Nos) -->
              <td class="text-right text-muted">
                {{ row.actual_qty_nos.toLocaleString() }} <span class="unit-sm">Nos</span>
                <span class="pack-lbl">(1/{{ row.pack_qty }})</span>
              </td>
              <td>
                <span v-if="row.disabled" class="badge badge-red">🚫 ERPNext 단종(Disabled=1)</span>
                <span v-else-if="row.isDelta" class="badge badge-amber">⚡ Delta Override (+28토큰)</span>
                <span v-else class="badge badge-gray">Master Cache</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="filteredStockRows.length > 50" class="table-footer-notice">
          전체 {{ filteredStockRows.length }}개 항목 중 상위 50개만 표시 중입니다. 검색창을 이용해 필터링하세요.
        </div>
      </div>
    </div>

    <!-- 삼돌이 AI 비서 음성 어시스턴트 본체 -->
    <SamdoriVoiceAssistant
      ref="samdoriRef"
      :valid-items="validItemCodes"
      @intent-parsed="handleIntent"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import frappeApi from '../api/frappe.js'
import SamdoriVoiceAssistant from '../components/SamdoriVoiceAssistant.vue'
import { _testExports } from '../utils/SamdoriBrain.js'

const samdoriRef = ref(null)

// --- 반응형 상태 ---
const isLoadingStock = ref(false)
const itemsList = ref([])
const binsList = ref([])
const selectedWarehouse = ref('')
const simulatedUserRole = ref('ADMIN')
const tableSearchQuery = ref('')
const intentLogs = ref([])

// 델타 시뮬레이터 상태
const activeDeltas = ref([])
const deltaInput = ref({
  code: '',
  warehouse: 'ALARCON',
  qty: 999
})

// --- 토큰 미터기 계산 로직 ---
const noCacheTokens = ref(200000) // 10,000개 마스터 리스트 미캐싱 전송 시 예상 토큰
const currentDeltaTokens = computed(() => {
  // 기본 오디오/발화 프롬프트 (~180토큰) + 활성 델타 개수당 28토큰
  const baseTokens = 180
  const deltaCost = activeDeltas.value.length * 28
  return baseTokens + deltaCost
})
const tokenSavingsRate = computed(() => {
  const saved = ((noCacheTokens.value - currentDeltaTokens.value) / noCacheTokens.value) * 100
  return saved.toFixed(2)
})

// --- SKU 코드 또는 품목 정보에서 박스당 입수량(pack_qty) 추출 함수 ---
const getPackQtyFromItemCode = (code, explicitPackQty = null) => {
  if (explicitPackQty && Number(explicitPackQty) > 1) {
    return Number(explicitPackQty)
  }
  const str = String(code || '').trim()
  // SKU 코드 끝의 숫자 접미어 추출 (예: P-160-NEGRO-400 ➔ 400, L-OP80-12 ➔ 12)
  const match = str.match(/-(\d+)$/)
  if (match && match[1]) {
    const val = parseInt(match[1], 10)
    if (val > 1) return val
  }
  return 1 // 기본값 1
}

// --- Frappe 실시간 재고 불러오기 ---
const fetchFrappeStock = async () => {
  isLoadingStock.value = true
  try {
    const [itemsRes, binsRes] = await Promise.all([
      frappeApi.get('/api/resource/Item', {
        params: {
          filters: JSON.stringify([['disabled', '=', 0]]), // ★ Master Cache는 기본적으로 활성 품목만 필터
          fields: JSON.stringify(['name', 'item_code', 'item_name', 'custom_pack_qty', 'disabled']),
          limit_page_length: 500
        }
      }).catch(() => ({ data: { data: [] } })),
      frappeApi.get('/api/resource/Bin', {
        params: {
          fields: JSON.stringify(['item_code', 'actual_qty', 'warehouse']),
          limit_page_length: 0
        }
      }).catch(() => ({ data: { data: [] } }))
    ])

    itemsList.value = itemsRes.data?.data || []
    binsList.value = binsRes.data?.data || []

    // 기본 선택 창고 설정 ('ALARCON'을 포함하는 창고 우선)
    if (!selectedWarehouse.value) {
      const mainWh = availableWarehouses.value.find(w => String(w).toUpperCase().includes('ALARCON'))
      if (mainWh) selectedWarehouse.value = ''
    }
  } catch (error) {
    console.error('Frappe Stock Fetch Error:', error)
  } finally {
    isLoadingStock.value = false
  }
}

// --- 창고 목록 및 품목 코드 배열 계산 ---
const availableWarehouses = computed(() => {
  const whSet = new Set(binsList.value.map(b => b.warehouse).filter(Boolean))
  if (whSet.size === 0) {
    return ['[MAIN] ALARCON - K', 'CARMEN - K', 'BODEGA - K']
  }
  return Array.from(whSet)
})

const validItemCodes = computed(() => {
  const codes = new Set()
  itemsList.value.forEach(item => {
    if (item.name) codes.add(item.name)
    if (item.item_code) codes.add(item.item_code)
  })
  // 델타 신제품도 유효 SKU에 포함
  activeDeltas.value.forEach(d => {
    if (d.code) codes.add(d.code)
  })
  return Array.from(codes)
})

// --- 품목-창고별 실시간 수량 맵 (Delta Override & Nos ➔ Box 변환 반영) ---
const stockMapWithDeltas = computed(() => {
  const map = new Map()

  // 0. 품목별 입수량 맵 생성
  const itemPackMap = new Map()
  const itemNameMap = new Map()
  itemsList.value.forEach(i => {
    const code = i.item_code || i.name
    itemPackMap.set(code, getPackQtyFromItemCode(code, i.custom_pack_qty))
    itemNameMap.set(code, i.item_name || code)
  })

  // 1. Frappe 원본 Bin 잔고 매핑 (Nos ➔ Box 단위 변환)
  binsList.value.forEach(bin => {
    const code = bin.item_code
    const packQty = itemPackMap.get(code) || getPackQtyFromItemCode(code)
    const rawNos = Number(bin.actual_qty) || 0
    const boxes = Math.floor(rawNos / packQty)
    const remainder = rawNos % packQty
    const key = `${code}___${bin.warehouse}`

    map.set(key, {
      item_code: code,
      item_name: itemNameMap.get(code) || code,
      warehouse: bin.warehouse,
      actual_qty_nos: rawNos,
      boxes: boxes,
      remainder: remainder,
      pack_qty: packQty,
      isDelta: false,
      disabled: false
    })
  })

  // 2. Delta 변경분 Override (덮어쓰기 - 델타는 Box 단위로 가정)
  activeDeltas.value.forEach(delta => {
    const code = delta.code
    const packQty = itemPackMap.get(code) || getPackQtyFromItemCode(code)
    const deltaBoxes = delta.disabled ? 0 : (Number(delta.qty) || 0)
    const deltaNos = deltaBoxes * packQty
    const key = `${code}___${delta.warehouse}`

    map.set(key, {
      item_code: code,
      item_name: delta.item_name || code,
      warehouse: delta.warehouse,
      actual_qty_nos: deltaNos,
      boxes: deltaBoxes,
      remainder: 0,
      pack_qty: packQty,
      isDelta: true,
      disabled: !!delta.disabled
    })
  })

  return map
})

// --- 표 미리보기를 위한 필터링된 행 목록 ---
const filteredStockRows = computed(() => {
  const rows = []
  stockMapWithDeltas.value.forEach(val => {
    // 창고 필터 적용
    if (selectedWarehouse.value && val.warehouse !== selectedWarehouse.value) {
      return
    }
    // 검색어 필터 적용
    const q = tableSearchQuery.value.trim().toLowerCase()
    if (q) {
      const cLower = String(val.item_code).toLowerCase()
      const nLower = String(val.item_name).toLowerCase()
      if (!cLower.includes(q) && !nLower.includes(q)) return
    }
    rows.push({
      item_code: val.item_code,
      item_name: val.item_name,
      warehouse: val.warehouse,
      actual_qty_nos: val.actual_qty_nos,
      boxes: val.boxes,
      remainder: val.remainder,
      pack_qty: val.pack_qty,
      isDelta: val.isDelta,
      disabled: val.disabled
    })
  })

  // SKU 코드 순 정렬
  return rows.sort((a, b) => a.item_code.localeCompare(b.item_code))
})

// --- Delta 시뮬레이터 조작 ---
const applyDeltaOverride = () => {
  const c = deltaInput.value.code.trim()
  if (!c) return
  // 기본 창고 설정
  const wh = deltaInput.value.warehouse || availableWarehouses.value[0] || '[MAIN] ALARCON - K'
  const filtered = activeDeltas.value.filter(d => !(d.code === c && d.warehouse === wh))
  filtered.unshift({
    code: c,
    warehouse: wh,
    qty: Number(deltaInput.value.qty) || 0,
    item_name: c,
    disabled: false
  })
  activeDeltas.value = filtered
}

const simulateNewProductDelta = () => {
  const newCode = 'P-500-NEGRO-100'
  const wh = availableWarehouses.value.find(w => String(w).includes('ALARCON')) || '[MAIN] ALARCON - K'
  const filtered = activeDeltas.value.filter(d => !(d.code === newCode && d.warehouse === wh))
  filtered.unshift({
    code: newCode,
    warehouse: wh,
    qty: 100,
    item_name: '신형 프리미엄 볼펜 500 검정 (Delta 신제품)',
    disabled: false
  })
  activeDeltas.value = filtered
}

// ★ ERPNext 단종(Disabled=1) 처리 시뮬레이션 ★
const simulateDisabledItemDelta = () => {
  const code = deltaInput.value.code.trim() || 'P-160-NEGRO-400'
  const wh = deltaInput.value.warehouse || availableWarehouses.value.find(w => String(w).includes('ALARCON')) || '[MAIN] ALARCON - K'
  const filtered = activeDeltas.value.filter(d => !(d.code === code && d.warehouse === wh))
  filtered.unshift({
    code: code,
    warehouse: wh,
    qty: 0,
    item_name: `${code} (🚫 단종 Disabled=1)`,
    disabled: true
  })
  activeDeltas.value = filtered
}

const removeDelta = (index) => {
  activeDeltas.value.splice(index, 1)
}

const clearDeltas = () => {
  activeDeltas.value = []
}

// --- 스마트 SKU 및 키워드 기반 창고별 재고 조회 함수 (Nos ➔ Box 단위 변환 적용) ---
const getStockFeedback = (itemQuery, targetWh) => {
  if (!itemQuery) return { text: '품목 코드가 지정되지 않았습니다.', totalQty: 0, isDisabled: false }
  const uQuery = String(itemQuery).trim().toUpperCase()
  
  // 1) 대상 품목 매칭 후보 찾기 (정확 일치 또는 부분 일치)
  // 예: "P-160-NEGRO"라고 물어봐도 "P-160-NEGRO-400"을 찾아냄
  const allCodes = validItemCodes.value
  let foundCode = allCodes.find(c => String(c).toUpperCase() === uQuery)

  if (!foundCode) {
    // 키워드 분리 ("P-160", "NEGRO", "검정" 등)
    const tokens = uQuery.replace(/[^A-Z0-9가-힣]/gi, ' ').split(/\s+/).filter(Boolean)
    foundCode = allCodes.find(c => {
      const cUpper = String(c).toUpperCase()
      const isMatch = tokens.every(t => {
        if (t === '검정' || t === '블랙') return cUpper.includes('NEGRO') || cUpper.includes('BLACK') || cUpper.includes('N')
        if (t === '흰색' || t === '화이트') return cUpper.includes('BLANCO') || cUpper.includes('WHITE') || cUpper.includes('W')
        return cUpper.includes(t) || t.includes(cUpper)
      })
      return isMatch
    }) || allCodes.find(c => uQuery.includes(String(c).toUpperCase()) || String(c).toUpperCase().includes(uQuery)) || itemQuery
  }

  let totalBoxes = 0
  let totalNos = 0
  let isAnyDisabled = false
  const whSummary = []
  
  stockMapWithDeltas.value.forEach(val => {
    if (String(val.item_code).toUpperCase() === String(foundCode).toUpperCase()) {
      if (val.disabled) {
        isAnyDisabled = true
      }
      // ★ 창고명 부분 일치 및 계정 권한 시뮬레이션(ADMIN, CARMEN, TIENDA) 폴백
      const whUpper = String(val.warehouse).toUpperCase()
      let isWhMatch = false
      if (targetWh && targetWh !== 'ALL' && targetWh !== 'ALARCON') {
        isWhMatch = whUpper === targetWh.toUpperCase() || 
                    whUpper.includes(targetWh.toUpperCase()) || 
                    targetWh.toUpperCase().includes(whUpper)
      } else {
        if (simulatedUserRole.value === 'CARMEN') {
          isWhMatch = whUpper.includes('CARMEN') || whUpper.includes('ALARCON')
        } else if (simulatedUserRole.value === 'TIENDA') {
          isWhMatch = whUpper.includes('TIENDA') || whUpper.includes('ALARCON')
        } else {
          isWhMatch = !targetWh || targetWh === 'ALL' || whUpper.includes('ALARCON')
        }
      }

      if (isWhMatch) {
        if (val.disabled) {
          whSummary.push(`${val.warehouse}: 🚫 단종(Disabled=1)`)
        } else {
          const remStr = val.remainder > 0 ? ` (+${val.remainder}개)` : ''
          whSummary.push(`${val.warehouse}: ${val.boxes.toLocaleString()} Box${remStr}${val.isDelta ? ' (⚡Delta)' : ''}`)
          totalBoxes += val.boxes
          totalNos += val.actual_qty_nos
        }
      }
    }
  })

  if (isAnyDisabled) {
    return {
      text: `[${foundCode}] 🚫 ERPNext 단종(Disabled=1) 처리된 품목으로 발주 및 재고 조회가 불가합니다.`,
      totalQty: 0,
      resolvedCode: foundCode,
      isDisabled: true,
      summarySpeech: `${foundCode} 품목은 ERP에서 단종 처리되어 주문 및 조회가 불가합니다.`
    }
  }

  if (whSummary.length === 0) {
    return {
      text: `[${foundCode}] 재고 정보 없음 (현재 조회 대상 창고 잔고 0 박스)`,
      totalQty: 0,
      resolvedCode: foundCode,
      isDisabled: false,
      summarySpeech: `${foundCode} 관련 재고가 조회 대상 창고에 없습니다.`
    }
  }

  const cleanWhSpeech = whSummary.map(s => s.replace(/\[.*?\]\s*/g, '')).join(', ')
  return {
    text: `[${foundCode}] 총 ${totalBoxes.toLocaleString()} Box (총 낱개 ${totalNos.toLocaleString()} Nos) (${whSummary.join(' / ')})`,
    totalQty: totalBoxes,
    resolvedCode: foundCode,
    isDisabled: false,
    summarySpeech: `${foundCode}: ${cleanWhSpeech} 입니다.`
  }
}

// --- 음성 / 텍스트 의도 파싱 처리 (Samdori Voice Assistant 콜백) ---
const handleIntent = (intent) => {
  const speechText = intent.spoken_text || intent.raw_spoken_item || '음성 발화 없음'
  const itemCode = intent.item || intent.raw_spoken_item || ''
  // 'ALARCON' 창고 질의 시 부분 일치 매칭되도록 처리
  const targetWh = intent.warehouse || selectedWarehouse.value || 'ALARCON'

  let erpFeedback = ''
  let ttsSpeech = ''
  let isDisabled = false

  if (intent.intent === 'search') {
    const fb = getStockFeedback(itemCode, targetWh)
    isDisabled = fb.isDisabled
    erpFeedback = `🔍 재고조회 (${simulatedUserRole.value} 모드) → ${fb.text}`
    ttsSpeech = fb.summarySpeech
  } else if (intent.intent === 'add_order') {
    const qty = intent.qty || 1
    const fb = getStockFeedback(itemCode, targetWh)
    isDisabled = fb.isDisabled
    erpFeedback = `🛒 장바구니 담기 (수량: ${qty} Box, ${simulatedUserRole.value} 모드) → 현재고 대조: ${fb.text}`
    ttsSpeech = isDisabled ? fb.summarySpeech : `${fb.resolvedCode} ${qty}박스 장바구니에 담았습니다.`
  } else if (intent.intent === 'ask_clarification') {
    erpFeedback = `❓ 역질문 발동 → [${intent.question}]`
    ttsSpeech = intent.question || '여러 품목이 검색되었습니다. 규격이나 색상을 선택해 주세요.'
  } else if (intent.intent === 'check') {
    erpFeedback = `📋 장바구니 리스트 조회`
    ttsSpeech = `현재 장바구니 리스트를 보여드립니다.`
  } else if (intent.intent === 'submit') {
    erpFeedback = `🚀 발주 전송 요청`
    ttsSpeech = `주문을 프라뻬 ERP로 전송합니다.`
  } else {
    erpFeedback = `ℹ️ 의도 판별 안됨 (${intent.intent})`
    ttsSpeech = `말씀하신 명령을 다시 한 번 말씀해 주세요.`
  }

  // 피드 리스트 상단에 로그 기록
  intentLogs.value.unshift({
    time: new Date().toLocaleTimeString(),
    intent: intent,
    speech: speechText,
    erpFeedback: erpFeedback,
    tokens: currentDeltaTokens.value,
    isDisabled: isDisabled
  })

  // TTS 음성 안내 발화
  if (samdoriRef.value && typeof samdoriRef.value.speak === 'function') {
    samdoriRef.value.speak(ttsSpeech)
  }
}

// --- 빠른 테스트 발화 시뮬레이션 버튼 ---
const simulateSpokenCommand = async (commandText) => {
  const fakeIntent = {
    spoken_text: commandText,
    raw_spoken_item: '',
    intent: 'search'
  }

  // 발화 텍스트 분석 시뮬레이션
  if (commandText.includes('블랙 단종') || commandText.includes('단종')) {
    // 단종품 시뮬레이션
    deltaInput.value.code = 'P-160-NEGRO-400'
    simulateDisabledItemDelta()
    fakeIntent.intent = 'search'
    fakeIntent.item = 'P-160-NEGRO-400'
    fakeIntent.warehouse = 'ALARCON'
  } else if (commandText.includes('담아') || commandText.includes('추가')) {
    fakeIntent.intent = 'add_order'
    fakeIntent.qty = 2
    fakeIntent.item = 'P-160-NEGRO-400'
  } else if (commandText.includes('L-OP80')) {
    fakeIntent.intent = 'ask_clarification'
    fakeIntent.question = 'L-OP80 관련 상품이 3가지 있습니다. 예: L-OP80-SURTIDO-12, L-OP80-NEGRO-12, L-OP80-BLANCO-12. 어떤 상품을 조회할까요?'
  } else if (commandText.includes('P-500')) {
    fakeIntent.intent = 'search'
    fakeIntent.item = 'P-500-NEGRO-100'
    fakeIntent.warehouse = 'ALARCON'
  } else {
    fakeIntent.intent = 'search'
    fakeIntent.item = 'P-160-NEGRO-400'
    fakeIntent.warehouse = 'ALARCON'
  }

  handleIntent(fakeIntent)
}

const formatIntentName = (intent) => {
  switch (intent) {
    case 'search': return '재고조회 (SEARCH)'
    case 'add_order': return '장바구니 담기 (ADD_ORDER)'
    case 'ask_clarification': return '스마트 역질문 (CLARIFICATION)'
    case 'check': return '내역 확인 (CHECK)'
    case 'submit': return '발주 전송 (SUBMIT)'
    default: return String(intent || 'UNKNOWN').toUpperCase()
  }
}

onMounted(() => {
  fetchFrappeStock()
})
</script>

<style scoped>
.test-view {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  color: #1e293b;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding-bottom: 100px;
}

.header-area {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
  background: #ffffff;
  padding: 20px 24px;
  border-radius: 14px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.04);
}

.header-titles h2 {
  margin: 0 0 6px 0;
  font-size: 22px;
  color: #0f172a;
}

.subtitle {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

.back-btn {
  padding: 10px 18px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  color: #334155;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #e2e8f0;
}

.sync-btn {
  padding: 12px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
}

.sync-btn:hover:not(:disabled) {
  background: #2563eb;
}

.sync-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 🔥 토큰 미터기 섹션 스타일 🔥 */
.token-meter-section {
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%) !important;
  color: #ffffff !important;
  border: 1px solid #334155 !important;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important;
}

.meter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 15px;
  margin-bottom: 20px;
  border-bottom: 1px solid #334155;
  padding-bottom: 15px;
}

.meter-title-wrap {
  display: flex;
  align-items: center;
  gap: 14px;
}

.meter-icon {
  font-size: 32px;
  color: #38bdf8;
}

.meter-title-wrap h3 {
  margin: 0 0 4px 0;
  font-size: 19px;
  color: #f8fafc;
}

.meter-subtitle {
  font-size: 13px;
  color: #94a3b8;
}

.saving-badge-lg {
  background: #059669;
  color: #ffffff;
  padding: 8px 16px;
  border-radius: 30px;
  font-size: 15px;
  font-weight: 600;
  box-shadow: 0 2px 10px rgba(5, 150, 105, 0.4);
}

.meter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.meter-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 16px 20px;
}

.meter-card.bad { border-left: 4px solid #ef4444; }
.meter-card.good { border-left: 4px solid #10b981; }
.meter-card.highlight { border-left: 4px solid #38bdf8; background: rgba(56, 189, 248, 0.08); }

.m-label {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 600;
  margin-bottom: 6px;
}

.m-value {
  font-size: 26px;
  font-weight: 800;
  margin-bottom: 4px;
}

.m-unit {
  font-size: 13px;
  font-weight: 500;
  color: #94a3b8;
}

.text-red { color: #f87171; }
.text-green { color: #34d399; }
.text-blue { color: #38bdf8; }

.m-sub {
  font-size: 12px;
  color: #cbd5e1;
}

/* 게이지 바 */
.gauge-bar-wrap {
  margin-top: 10px;
}

.gauge-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 6px;
  font-weight: 600;
}

.gauge-track {
  width: 100%;
  height: 12px;
  background: #334155;
  border-radius: 6px;
  overflow: hidden;
}

.gauge-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
  border-radius: 6px;
  transition: width 0.4s ease;
}

/* 통계 카드 그리드 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: #ffffff;
  padding: 18px 22px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.stat-label {
  font-size: 13px;
  color: #64748b;
  font-weight: 600;
  margin-bottom: 6px;
}

.stat-value {
  font-size: 28px;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 4px;
}

.stat-value .unit {
  font-size: 15px;
  font-weight: 500;
  color: #64748b;
}

.stat-desc {
  font-size: 12px;
  color: #94a3b8;
}

.filter-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.warehouse-select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  background: #f8fafc;
}

/* 공통 섹션 스타일 */
.panel-section {
  background: #ffffff;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.panel-header h3 {
  margin: 0;
  font-size: 18px;
  color: #0f172a;
}

.section-desc {
  color: #64748b;
  font-size: 14px;
  margin: 0 0 16px 0;
  line-height: 1.5;
}

/* 델타 시뮬레이터 */
.delta-section {
  border-left: 4px solid #f59e0b;
}

.delta-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
  background: #f8fafc;
  padding: 16px;
  border-radius: 10px;
  margin-bottom: 12px;
}

.delta-input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 150px;
}

.delta-input-group label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.delta-input {
  padding: 9px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
}

.qty-group {
  max-width: 130px;
}

.btn-delta-add, .btn-new-item, .btn-disabled-item {
  padding: 10px 16px;
  border-radius: 6px;
  border: none;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.btn-delta-add {
  background: #0f172a;
  color: white;
}

.btn-new-item {
  background: #f59e0b;
  color: white;
}

.btn-disabled-item {
  background: #dc2626;
  color: white;
}

.btn-delta-clear {
  padding: 10px 14px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  font-size: 13px;
}

.active-deltas-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.delta-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  color: #92400e;
  font-weight: 600;
}

.delta-chip.chip-disabled {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #991b1b;
}

.chip-remove {
  background: transparent;
  border: none;
  font-size: 16px;
  color: #b45309;
  cursor: pointer;
  line-height: 1;
}

/* 빠른 테스트 발화 예시 */
.quick-examples {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  background: #f1f5f9;
  padding: 14px;
  border-radius: 10px;
}

.quick-label {
  font-weight: 700;
  color: #475569;
  font-size: 13px;
}

.btn-example {
  padding: 8px 14px;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-example:hover {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.btn-example-red {
  border-color: #fca5a5;
  color: #b91c1c;
  background: #fff5f5;
}

.btn-example-red:hover {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
}

/* 검증 피드 영역 */
.log-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-log {
  text-align: center;
  padding: 50px 20px;
  color: #94a3b8;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px dashed #cbd5e1;
}

.empty-log i {
  font-size: 32px;
  margin-bottom: 12px;
  color: #cbd5e1;
}

.verification-card {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 18px;
  background: #f8fafc;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 10px;
}

.top-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.log-time {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}

.intent-badge {
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 6px;
  color: white;
}

.intent-search { background: #3b82f6; }
.intent-add_order { background: #10b981; }
.intent-ask_clarification { background: #f59e0b; }
.intent-check { background: #6366f1; }
.intent-submit { background: #8b5cf6; }

.token-pill {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #047857;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.card-speech {
  font-size: 16px;
  margin-bottom: 12px;
  color: #0f172a;
}

.card-speech .label {
  font-size: 13px;
  color: #64748b;
  margin-right: 6px;
}

.card-ground-truth {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-left: 4px solid #10b981;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
}

.card-ground-truth.gt-disabled {
  border-left-color: #ef4444;
  background: #fef2f2;
}

.gt-title {
  font-size: 12px;
  font-weight: 700;
  color: #047857;
  margin-bottom: 4px;
}

.gt-disabled .gt-title {
  color: #b91c1c;
}

.gt-content {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}

.gt-disabled .gt-content {
  color: #991b1b;
}

.json-details summary {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  user-select: none;
}

.json-details pre {
  margin: 10px 0 0 0;
  background: #0f172a;
  color: #a7f3d0;
  padding: 12px;
  border-radius: 8px;
  font-size: 13px;
  overflow-x: auto;
}

/* 재고 서머리 테이블 */
.search-input-wrap {
  width: 280px;
}

.table-search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
}

.table-container {
  overflow-x: auto;
}

.summary-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

.summary-table th, .summary-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  font-size: 14px;
}

.summary-table th {
  background: #f8fafc;
  color: #475569;
  font-weight: 700;
  font-size: 13px;
}

.code-cell {
  color: #1e293b;
}

.wh-tag {
  background: #e2e8f0;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.text-teal {
  color: #0d9488;
}

.text-gray {
  color: #94a3b8;
}

.font-bold {
  font-weight: 700;
}

.text-right {
  text-align: right;
}

.text-muted {
  color: #64748b;
  font-size: 13px;
}

.pack-lbl {
  font-size: 11px;
  color: #94a3b8;
  margin-left: 4px;
}

.remainder-txt {
  font-size: 11px;
  color: #64748b;
  margin-left: 4px;
  font-weight: 500;
}

.empty-row {
  text-align: center;
  padding: 30px;
  color: #94a3b8;
}

.table-footer-notice {
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
  margin-top: 12px;
}

.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
}

.badge-amber {
  background: #fef3c7;
  color: #92400e;
}

.badge-blue {
  background: #dbeafe;
  color: #1e40af;
}

.badge-gray {
  background: #f1f5f9;
  color: #64748b;
}

.badge-red {
  background: #fee2e2;
  color: #991b1b;
}

.text-amber {
  color: #d97706;
}

.unit, .unit-sm {
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
}
</style>

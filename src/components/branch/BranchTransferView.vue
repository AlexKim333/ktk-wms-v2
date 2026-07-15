<template>
  <div class="workspace-body branch-pos" style="padding: 15px; gap: 15px; background: #f8fafc;">
    <!-- Left Pane: Search or Quick Pick -->
    <div class="workspace-left" style="flex: 0.95; display: flex; flex-direction: column; gap: 15px; overflow-y: auto; background: transparent; border: none;">
      <!-- Dual Search Bar (상품명 / 바코드) -->
      <div class="search-section dual-search" style="display: flex; gap: 10px; width: 100%;">
        <div class="search-box-wrapper" style="position: relative; flex: 1; display: flex; align-items: center;">
          <span class="search-icon" style="position: absolute; left: 12px; font-size: 14px; color: #94a3b8;">🔍</span>
          <input
            type="text"
            v-model="searchQuery"
            @focus="isSearching = true"
            :placeholder="'상품명 또는 속성 검색...'"
            class="search-bar"
            style="width: 100%; padding: 12px 12px 12px 35px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 14px; box-sizing: border-box;"
            autocomplete="off"
            ref="searchInputRef"
          />
        </div>
        <div class="search-box-wrapper" style="position: relative; flex: 1; display: flex; align-items: center;">
          <span class="search-icon" style="position: absolute; left: 12px; font-size: 14px; color: #f59e0b;">🏷️</span>
          <input
            type="text"
            placeholder="바코드 스캔..."
            class="search-bar barcode-bar"
            style="width: 100%; padding: 12px 12px 12px 35px; border-radius: 6px; border: 1px solid #fcd34d; font-size: 14px; box-sizing: border-box; background: #fffbeb;"
            autocomplete="off"
          />
        </div>
        <button v-if="isSearching" class="btn-cancel-search" @click="cancelSearch" style="padding: 10px 15px; border: 1px solid #cbd5e1; background: white; border-radius: 6px; cursor: pointer; color: #475569; font-weight: bold;">✕ 닫기</button>
      </div>

      <div class="quick-pick-zone" style="flex: 1; overflow: hidden; display: flex; flex-direction: column; position: relative;">
        <!-- 렌더링 반전: 검색 중일 때는 리스트 뷰, 아니면 퀵픽 버튼 -->
        <div v-if="isSearching" class="search-results-overlay" style="position: absolute; inset: 0; background: white; z-index: 10; overflow-y: auto; border-radius: 8px; border: 1px solid #e2e8f0;">
          <table class="inventory-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="background: #f1f5f9; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 13px; position: sticky; top: 0; z-index: 2;">품명 (상품명)</th>
                <th style="background: #f1f5f9; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 13px; position: sticky; top: 0; z-index: 2;">컬러</th>
                <th style="background: #f1f5f9; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 13px; position: sticky; top: 0; z-index: 2;">팩 수량</th>
                <th class="highlight-branch" style="background: #e0f2fe; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #0284c7; font-size: 13px; position: sticky; top: 0; z-index: 2;">지점 재고 ({{ authStore.user?.branch_name }})</th>
                <th class="highlight-main" style="background: #f1f5f9; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 13px; position: sticky; top: 0; z-index: 2;">메인 재고</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in displayedItems" :key="item.name" class="inventory-row clickable" @click="addToCart(item)">
                <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0;">
                  <strong>{{ item.item_name }}</strong><br/>
                  <span style="font-size: 11px; color: #94a3b8;">{{ item.name }}</span>
                </td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0;">{{ item.custom_color || '-' }}</td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b; font-weight: bold;">
                  {{ item.custom_pack_qty || 1 }}
                </td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0;">
                  <strong>{{ getStock(item.name, authStore.user?.branch_name) }}</strong>
                </td>
                <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0;">
                  <strong>{{ getStock(item.name, '[MAIN] ALARCON - K') }}</strong>
                </td>
              </tr>
              <tr v-if="listHasMore">
                <td colspan="5" style="text-align:center; padding: 16px; background:#fffbeb;">
                  <button type="button" @click.stop="loadMoreItems" style="background:#fef3c7;border:1px solid #f59e0b;color:#b45309;font-weight:bold;padding:10px 20px;border-radius:6px;cursor:pointer;">
                    결과 더보기 (+{{ listRemaining }})
                  </button>
                </td>
              </tr>
              <tr v-if="displayedItems.length === 0">
                <td colspan="5" style="text-align: center; padding: 40px; color: #94a3b8;">검색 결과가 없습니다.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="quick-pick-buttons" style="overflow-y: auto; display: flex; flex-direction: column; gap: 20px;">
          
          <div class="hotkey-block">
            <div class="block-header">
              <h3>⚡ Quick Pick (단일 베스트)</h3>
            </div>
            <div class="grid-3x4">
              <div class="hotkey-card" v-for="i in 8" :key="i">
                <button class="hotkey-btn-core" disabled>
                  <div class="line-1">AD2015</div>
                  <div class="line-2">(SURTIDO - 100入)</div>
                  <div class="line-2 text-teal" style="font-weight: bold; margin-top: 4px;">📦 7 상자 / 10 개</div>
                </button>
                <button class="hotkey-sub-edit-btn" disabled>⚙ edit</button>
              </div>
            </div>
          </div>

          <div class="hotkey-block">
            <div class="block-header">
              <h3 style="color: #00a896;">🌐 Grid Quick Pick (묶음 품목)</h3>
            </div>
            <div class="grid-3x4">
              <div class="hotkey-card" v-for="i in 8" :key="'grid-'+i">
                <button class="hotkey-btn-core empty-slot" disabled>
                  <div class="line-1" style="font-size: 18px; color: #8b5cf6;">+</div>
                  <div class="line-2" style="font-size: 11px;">상품 지정</div>
                </button>
                <button class="hotkey-sub-edit-btn" disabled>⚙ edit</button>
              </div>
            </div>
          </div>

          <div class="hotkey-block">
            <div class="block-header">
              <h3 style="color: #f59e0b;">🤝 Customer Quick Pick (주요 지점)</h3>
            </div>
            <div class="grid-3x4">
              <div class="hotkey-card" v-for="i in 4" :key="'cust-'+i">
                <button class="hotkey-btn-core empty-slot" disabled>
                  <div class="line-1" style="font-size: 18px; color: #f59e0b;">+</div>
                  <div class="line-2" style="font-size: 11px;">지점 지정</div>
                </button>
                <button class="hotkey-sub-edit-btn" disabled>⚙ edit</button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- Right Pane: Cart & Header -->
    <div class="workspace-right" style="flex: 1.05; background: white; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden;">
      
      <!-- 탭 컨트롤 헤더 (일관성 유지 - VENTA와 동일한 스타일) -->
      <div class="tabs-control-header" style="display: flex; justify-content: space-between; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; padding: 6px 10px 0 10px;">
        <div class="tabs-list" style="display: flex; gap: 4px;">
          <div v-for="(tab, idx) in tabs" :key="tab.id" class="tab-wrapper-item" :class="{ active: currentTabIndex === idx }" @click="currentTabIndex = idx" style="display: flex; align-items: center; gap: 6px; background: #e2e8f0; border: 1px solid #cbd5e1; border-bottom: none; padding: 8px 12px; border-radius: 6px 6px 0 0; font-size: 12.5px; font-weight: bold; cursor: pointer; color: #64748b;">
            <span class="tab-title-text">{{ tab.title }}</span>
            <button v-if="tabs.length > 1" class="tab-close-x-btn" @click.stop="removeTab(idx)" style="background: none; border: none; font-size: 14px; font-weight: bold; color: #94a3b8; cursor: pointer; padding: 0 2px; line-height: 1;">×</button>
          </div>
        </div>
        <div class="tabs-header-actions" style="display: flex; align-items: center; gap: 10px; padding-bottom: 6px;">
          <button class="add-tab-action-btn" @click="addNewTab" style="background: none; border: none; color: #00a896; font-weight: bold; cursor: pointer; font-size: 13px;">＋ 탭추가</button>
        </div>
      </div>

      <!-- 우측 상단 정보 영역 (2x2 그리드) -->
      <div class="pos-cart-header" style="background: white; padding: 15px; border-bottom: 1px solid #e2e8f0;">
        <div class="header-fields" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="field-group">
            <label style="display: block; font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 4px;">📍 소스 (출발):</label>
            <input type="text" value="[MAIN] ALARCON - K" disabled class="form-input" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 13px; background: #f8fafc; color: #94a3b8;" />
          </div>
          <div class="field-group">
            <label style="display: block; font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 4px;">🏢 담당 지점 (창고):</label>
            <input type="text" :value="authStore.user?.branch_name" disabled class="form-input" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 13px; background: #f8fafc; color: #94a3b8;" />
          </div>
          <div class="field-group">
            <label style="display: block; font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 4px;">🙋‍♂️ 지점 요청자 (점원):</label>
            <select v-if="currentTab" v-model="currentTab.selectedRequester" class="form-select" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; background: white;">
              <option value="">-- 점원 선택 --</option>
              <option v-for="user in branchUsers" :key="user.email" :value="user.email">{{ user.full_name }}</option>
            </select>
          </div>
          <div class="field-group">
            <label style="display: block; font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 4px;">✍️ 작성자 (지점장):</label>
            <select v-if="currentTab" v-model="currentTab.selectedCreator" class="form-select" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; background: white;">
              <option value="">-- 지점장 선택 --</option>
              <option v-for="user in branchUsers" :key="user.email" :value="user.email">{{ user.full_name }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Cart Table -->
      <div class="cart-table-wrapper" style="flex: 1; overflow-y: auto; padding: 15px;">
        <table class="pos-cart-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th rowspan="2" style="width: 45%; background: #f8fafc; font-weight: bold; color: #334155; border: 1px solid #e2e8f0; padding: 8px; font-size: 12.5px; text-align: center;">품명(컬러)</th>
              <th colspan="2" class="sub-th" style="background: #f8fafc; font-weight: bold; color: #334155; border: 1px solid #e2e8f0; font-size: 11px; padding: 4px; text-align: center;">수량 입력</th>
              <th rowspan="2" style="width: 15%; background: #f8fafc; font-weight: bold; color: #334155; border: 1px solid #e2e8f0; padding: 8px; font-size: 12.5px; text-align: center;">총 수량</th>
              <th rowspan="2" style="width: 10%; background: #f8fafc; font-weight: bold; color: #334155; border: 1px solid #e2e8f0; padding: 8px; font-size: 12.5px; text-align: center;">삭제</th>
            </tr>
            <tr>
              <th class="sub-th" style="background: #f8fafc; border: 1px solid #e2e8f0; font-size: 11px; padding: 4px; text-align: center;">Caja (박스)</th>
              <th class="sub-th" style="background: #f8fafc; border: 1px solid #e2e8f0; font-size: 11px; padding: 4px; text-align: center;">Pza (낱장)</th>
            </tr>
          </thead>
          <tbody v-if="currentTab">
            <tr v-for="(cartItem, idx) in currentTab.cartItems" :key="idx">
              <td class="product-cell" style="border: 1px solid #e2e8f0; padding: 8px; font-size: 12.5px; text-align: left !important; vertical-align: middle;">
                <div class="p-name" style="font-weight: bold; font-size: 13px; color: #0f172a;">
                  {{ cartItem.item_name }}
                  <span style="color: #ef4444; margin-left: 6px; font-size: 11px;">[가용: {{ Math.floor(getStock(cartItem.item_code, '[MAIN] ALARCON - K') / (cartItem.pack_qty || 1)) }} 박스]</span>
                </div>
                <div class="p-stock-info" style="font-size: 11px; color: #64748b; margin-top: 4px;">
                  {{ cartItem.custom_color || '-' }} | 1박스 = {{ cartItem.pack_qty }}개
                </div>
              </td>
              <td class="input-green" style="border: 1px solid #e2e8f0; padding: 2px !important; background-color: #dcfce7 !important; width: 60px;">
                <input type="number" v-model.number="cartItem.boxQty" @input="updateTotalQty(cartItem)" min="0" style="width: 100%; background: transparent; border: none; text-align: center; font-size: 14px; font-weight: bold; outline: none; color: #059669;" />
              </td>
              <td class="input-green" style="border: 1px solid #e2e8f0; padding: 2px !important; background-color: #dcfce7 !important; width: 60px;">
                <input type="number" v-model.number="cartItem.eachQty" @input="updateTotalQty(cartItem)" min="0" style="width: 100%; background: transparent; border: none; text-align: center; font-size: 14px; font-weight: bold; outline: none; color: #059669;" />
              </td>
              <td class="total-qty-cell" style="border: 1px solid #e2e8f0; padding: 8px; font-size: 12.5px; text-align: center; vertical-align: middle;">
                <strong style="color: #00a896; font-size: 14px;">{{ cartItem.totalQty }}</strong>
              </td>
              <td class="action-cell" style="border: 1px solid #e2e8f0; padding: 4px !important; text-align: center; vertical-align: middle;">
                <button @click="removeItem(idx)" class="btn-more-options" style="background: none; border: none; font-size: 18px; font-weight: bold; color: #94a3b8; cursor: pointer; padding: 4px 8px; border-radius: 4px;">🗑️</button>
              </td>
            </tr>
            <tr v-if="currentTab.cartItems.length === 0">
              <td colspan="5" class="empty-cart-msg" style="border: 1px solid #e2e8f0; text-align: center !important; padding: 40px !important; color: #94a3b8; font-style: italic;">이동할 상품을 검색하여 추가해주세요.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer Totals & Action -->
      <div class="right-footer-action-zone" style="border-top: 2px solid #e2e8f0; padding: 15px; background: #f8fafc; display: flex; flex-direction: column; gap: 12px;" v-if="currentTab">
        <div class="truck-counter-info-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="summary-label-box" style="background: white; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; font-size: 14px; font-weight: bold; color: #334155; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
            📦 박스 총 갯수: <strong style="font-size: 16px; color: #00a896; margin-left: 4px;">{{ totalBoxCount }} 상자</strong>
          </div>
          <div class="summary-label-box" style="background: white; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; font-size: 14px; font-weight: bold; color: #334155; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
            🔢 낱장 총 갯수: <strong style="font-size: 16px; color: #00a896; margin-left: 4px;">{{ totalEachCount }} 개</strong>
          </div>
        </div>
        
        <div class="action-btn-double-group" style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 10px;">
          <button class="btn-outbound-reserve" style="background: #475569; color: white; border: none; padding: 15px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 15px; transition: 0.2s;" @click="clearCart">
            장바구니 비우기
          </button>
          <button class="btn-final-submit" style="background: #00a896; color: white; border: none; padding: 15px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 15px; transition: 0.2s;" @click="submitTransfer" :disabled="currentTab.cartItems.length === 0 || isSubmitting">
            {{ isSubmitting ? '전송 중...' : (userRole === 'Representative' ? '1차 DRAFT 요청 (점원)' : (userRole === 'Manager' ? '2차 DRAFT 전송 (지점장)' : '최종 예약 발행 (관리자)')) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import { useItemSearch, rankItemNameMatches } from '../../composables/useItemSearch.js'
import { usePagedList } from '../../composables/usePagedList.js'
import axios from 'axios'

const frappeApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

const authStore = useAuthStore()
const userRole = computed(() => authStore.user?.access_level || 'Representative')
const props = defineProps({
  rawItems: { type: Array, default: () => [] },
  binData: { type: Object, default: () => ({}) },
  pendingReserved: { type: Object, default: () => ({}) },
  branchList: { type: Array, default: () => [] },
  injectedItem: { type: String, default: null } // Optional: To auto-add from BranchInventoryList
})

const emit = defineEmits(['refresh-items', 'clear-injected'])

// Search UI State
const isSearching = ref(false)
const searchQuery = ref('')
const searchInputRef = ref(null)
const { rebuildItemIndex, searchItemsOrAll } = useItemSearch()

// Tabs State
const tabs = ref([{
  id: 1,
  title: '이동 1',
  selectedRequester: '',
  selectedCreator: authStore.user?.email || '',
  cartItems: []
}])
const currentTabIndex = ref(0)
const nextTabId = ref(2)

const currentTab = computed(() => tabs.value[currentTabIndex.value])

const addNewTab = () => {
  tabs.value.push({
    id: nextTabId.value++,
    title: `이동 ${tabs.value.length + 1}`,
    selectedRequester: '',
    selectedCreator: authStore.user?.email || '',
    cartItems: []
  })
  currentTabIndex.value = tabs.value.length - 1
}

const removeTab = (idx) => {
  if (tabs.value.length <= 1) return
  tabs.value.splice(idx, 1)
  if (currentTabIndex.value >= tabs.value.length) {
    currentTabIndex.value = tabs.value.length - 1
  }
}

// Branch Users
const branchUsers = ref([])
const isSubmitting = ref(false)

// Init Search Index
watch(() => props.rawItems, (newVal) => {
  if (newVal && newVal.length > 0) {
    rebuildItemIndex(newVal)
  }
}, { immediate: true })

const filteredItems = computed(() => {
  const q = searchQuery.value.trim()
  if (!q) return searchItemsOrAll('', { limit: null, allLimit: 99999 })
  const hits = searchItemsOrAll(q, { limit: null, allLimit: 99999 })
  return rankItemNameMatches(hits, q)
})

const {
  visible: displayedItems,
  hasMore: listHasMore,
  remaining: listRemaining,
  loadMore: loadMoreItems,
  reset: resetListPage
} = usePagedList(filteredItems, 50)

watch(searchQuery, () => resetListPage())

const getStock = (itemCode, warehouse) => {
  if (!warehouse) return 0
  const actual = (props.binData[itemCode] && props.binData[itemCode][warehouse]) || 0
  const reserved = (props.pendingReserved[warehouse] && props.pendingReserved[warehouse][itemCode]) || 0
  return actual - reserved
}

const cancelSearch = () => {
  searchQuery.value = ''
  isSearching.value = false
  resetListPage()
}

// Fetch Branch Users
const fetchBranchUsers = async () => {
  try {
    const res = await frappeApi.get(`/api/resource/User`, {
      params: {
        filters: JSON.stringify([
          ['enabled', '=', 1],
          ['user_type', '=', 'System User']
        ]),
        fields: JSON.stringify(['name', 'email', 'full_name']),
        limit_page_length: 999
      }
    })
    if (res.data && res.data.data) {
      branchUsers.value = res.data.data
    }
  } catch (error) {
    console.error('Error fetching branch users:', error)
  }
}

onMounted(() => {
  fetchBranchUsers()
})

// Cart Logic
const addToCart = (item) => {
  if (!currentTab.value) return
  
  const mainQty = getStock(item.name, '[MAIN] ALARCON - K')
  const packQty = item.custom_pack_qty || 1
  const mainBoxQty = Math.floor(mainQty / packQty)
  
  const existing = currentTab.value.cartItems.find(c => c.item_code === item.name)
  if (existing) {
    if (existing.boxQty + 1 > mainBoxQty) {
      alert(`알라르꼰(메인창고) 가용 재고(${mainBoxQty} 박스)를 초과할 수 없습니다.`)
      return
    }
    existing.boxQty += 1
    updateTotalQty(existing)
  } else {
    if (mainBoxQty < 1) {
      alert('알라르꼰(메인창고)에 해당 상품의 가용 재고(박스)가 부족합니다.')
      return
    }
    currentTab.value.cartItems.push({
      item_code: item.name,
      item_name: item.item_name,
      custom_color: item.custom_color,
      pack_qty: packQty,
      boxQty: 1,
      eachQty: 0,
      totalQty: packQty
    })
  }
  cancelSearch()
}

const updateTotalQty = (cartItem) => {
  const mainQty = getStock(cartItem.item_code, '[MAIN] ALARCON - K')
  const mainBoxQty = Math.floor(mainQty / (cartItem.pack_qty || 1))
  
  if (cartItem.boxQty > mainBoxQty) {
    alert(`알라르꼰(메인창고) 가용 재고(${mainBoxQty} 박스)를 초과할 수 없습니다.`)
    cartItem.boxQty = mainBoxQty
  }
  
  cartItem.totalQty = (cartItem.boxQty * cartItem.pack_qty) + cartItem.eachQty
}

// Inject Item from other views (BranchInventoryList)
watch(() => props.injectedItem, (newVal) => {
  if (newVal && props.rawItems.length > 0) {
    const item = props.rawItems.find(i => i.name === newVal)
    if (item) {
      addToCart(item)
      emit('clear-injected')
    }
  }
}, { immediate: true })



const removeItem = (index) => {
  if (!currentTab.value) return
  currentTab.value.cartItems.splice(index, 1)
}

const clearCart = () => {
  if (!currentTab.value) return
  if(confirm('이동 장바구니를 정말 비우시겠습니까?')) {
    currentTab.value.cartItems = []
  }
}

const totalBoxCount = computed(() => {
  if (!currentTab.value) return 0
  return currentTab.value.cartItems.reduce((sum, item) => sum + (item.boxQty || 0), 0)
})
const totalEachCount = computed(() => {
  if (!currentTab.value) return 0
  return currentTab.value.cartItems.reduce((sum, item) => sum + (item.eachQty || 0), 0)
})

// Submit to Frappe
const submitTransfer = async () => {
  if (!currentTab.value || currentTab.value.cartItems.length === 0) return
  if (!currentTab.value.selectedRequester) {
    alert('지점 요청자를 선택해주세요.')
    return
  }

  isSubmitting.value = true
  try {
    const isClerk = userRole.value === 'Representative'
    const isManager = userRole.value === 'Manager'
    const isAdmin = ['Admin', 'Monitor'].includes(userRole.value)
    
    const scheduleDate = new Date()
    scheduleDate.setDate(scheduleDate.getDate() + 1)
    const dateStr = scheduleDate.toISOString().split('T')[0]

    const payload = {
      doctype: 'Material Request',
      material_request_type: 'Material Transfer',
      set_warehouse: '[MAIN] ALARCON - K',
      schedule_date: dateStr,
      docstatus: 0,
      owner: currentTab.value.selectedCreator || authStore.user?.email, // 작성자 드롭다운 반영
      custom_branch: authStore.user?.branch_name,
      custom_branch_requester: currentTab.value.selectedRequester,
      custom_approval_stage: isClerk ? '점원 요청' : '지점장 승인',
      items: currentTab.value.cartItems.map(item => ({
        item_code: item.item_code,
        qty: item.totalQty,
        s_warehouse: '[MAIN] ALARCON - K',
        t_warehouse: authStore.user?.branch_name,
        uom: 'Pza',
        conversion_factor: 1
      }))
    }

    const res = await frappeApi.post('/api/resource/Material Request', payload)
    const docName = res.data.data.name
    
    // Auto submit if Admin
    if (isAdmin) {
      await frappeApi.put(`/api/resource/Material Request/${docName}`, { docstatus: 1 })
      alert(`성공적으로 관리자 직권으로 예약 전표가 발행되었습니다: ${docName}`)
    } else if (isManager) {
      alert(`지점장 승인(2차 DRAFT) 상태로 예약이 전송되었습니다: ${docName}`)
    } else {
      alert(`점원 DRAFT 요청이 성공적으로 전송되었습니다: ${docName}`)
    }
    
    currentTab.value.cartItems = []
    emit('refresh-items')
  } catch (error) {
    console.error('Submit error:', error)
    alert('예약 전송 중 오류가 발생했습니다.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
/* Override or add styles for branch-pos */
.branch-pos { display: flex; height: 100%; font-family: var(--sans, sans-serif); }
.inventory-row.clickable:hover { background: #3b82f6; color: white; cursor: pointer; }
.inventory-row.clickable:hover td, .inventory-row.clickable:hover span, .inventory-row.clickable:hover strong { color: white !important; }

/* Custom Tab styling overrides for active state */
.tab-wrapper-item.active {
  background: white !important;
  color: #00a896 !important;
  border-color: #cbd5e1 !important;
  border-bottom-color: white !important;
  margin-bottom: -1px;
}
.tab-close-x-btn:hover { background: #ef4444; color: white !important; border-radius: 50%; }

/* Scrollbar styles matching PosView */
.workspace-body *::-webkit-scrollbar { width: 8px; height: 8px; }
.workspace-body *::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
.workspace-body *::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.workspace-body *::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

/* PosView exact matching styles for Quick Pick */
.hotkey-block { display: flex; flex-direction: column; gap: 8px; }
.block-header { border-bottom: 2px solid #00a896; padding-bottom: 4px; }
.block-header h3 { margin: 0; font-size: 14px; color: #f59e0b; }
.grid-3x4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.hotkey-card { display: flex; flex-direction: column; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.hotkey-btn-core { background: none; border: none; padding: 12px 4px; cursor: pointer; flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 55px; }
.hotkey-btn-core:hover:not(:disabled) { background: #f8fafc; }
.line-1 { font-size: 12.5px; font-weight: bold; color: #1e293b; }
.line-2 { font-size: 9.5px; color: #64748b; margin-top: 2px; }
.text-teal { color: #00a896 !important; }
.hotkey-sub-edit-btn { background: #f1f5f9; border: none; border-top: 1px solid #e2e8f0; padding: 4px 0; font-size: 10.5px; color: #64748b; cursor: pointer; text-align: center; }
.hotkey-sub-edit-btn:hover:not(:disabled) { background: #e2e8f0; color: black; }
.empty-slot { opacity: 0.5; }
</style>

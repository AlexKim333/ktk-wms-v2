<template>
  <div class="pos-app-layout">
    <aside class="sidebar-nav">
      <div class="nav-logo">🏆 WMS PRO</div>
      <div v-if="authStore.user" class="nav-user-info">
        <span class="nav-user-name">{{ authStore.user.member_name || authStore.user.full_name }}</span>
        <span class="nav-user-meta">{{ authStore.user.branch_name ?? '본부' }} · {{ authStore.user.access_level || '관리자' }}</span>
      </div>
      <nav class="nav-menu">
        <a href="#" class="nav-item" :class="{ active: activeNav === 'home' }" @click.prevent="activeNav = 'home'">🏠 시작</a>
        <a href="#" class="nav-item" :class="{ active: activeNav === 'outbound' }" @click.prevent="setTransactionMode('outbound')">📤 출고입력</a>
        <a href="#" class="nav-item" :class="{ active: activeNav === 'inbound' }" @click.prevent="setTransactionMode('inbound')">📥 입고입력</a>
        <a href="#" class="nav-item" :class="{ active: activeNav === 'move' }" @click.prevent="activeNav = 'move'">🔄 재고 이동</a>
        
        <!-- 🌟 신규 상품 관리 메뉴 그룹 -->
        <div class="nav-group">
          <a href="#" class="nav-item group-title" @click.prevent="isProductMenuOpen = !isProductMenuOpen">
            📦 상품 관리 {{ isProductMenuOpen ? '▴' : '▾' }}
          </a>
          <div v-show="isProductMenuOpen" class="nav-sub-menu">
            <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'product-list' }" @click.prevent="setActiveNav('product-list')">📋 상품 리스트</a>
            <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'product-move' }" @click.prevent="setActiveNav('product-move')">🔄 재고 이동</a>
            <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'product-adj' }" @click.prevent="setActiveNav('product-adj')">⚖️ 재고 조정</a>
            <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'product-reg' }" @click.prevent="setActiveNav('product-reg')">➕ 상품 등록 (New)</a>
          </div>
        </div>

        <!-- 기존 상품등록 (보존용) -->
        <a href="#" class="nav-item" :class="{ active: activeNav === 'product' }" @click.prevent="setActiveNav('product')">📦 상품등록 (Old)</a>
        <a href="#" class="nav-item" :class="{ active: activeNav === 'node' }" @click.prevent="setActiveNav('node')">🏢 Node Management</a>
        <a href="#" class="nav-item" :class="{ active: activeNav === 'report' }" @click.prevent="activeNav = 'report'">📊 리포트</a>
        <a href="#" class="nav-item" :class="{ active: activeNav === 'manager' }" @click.prevent="activeNav = 'manager'">👤 담당자 (입출고)</a>
        <a href="#" class="nav-item" :class="{ active: activeNav === 'search-edit' }" @click.prevent="activeNav = 'search-edit'">🔍 입출고검색수정</a>
        <a href="#" class="nav-item" :class="{ active: activeNav === 'reservation' }" @click.prevent="activeNav = 'reservation'">📅 예약상황</a>
        <a href="#" class="nav-item" :class="{ active: activeNav === 'settings' }" @click.prevent="activeNav = 'settings'">⚙️ 설정</a>
        <button type="button" class="nav-item nav-logout-btn" @click="handleLogout">🚪 로그아웃</button>
      </nav>
    </aside>

    <main class="main-content-zone">
      <!-- 🌟 신규 추가된 컴포넌트들 -->
      <ProductListView v-if="activeNav === 'product-list'" />
      <StockReconciliationMain v-else-if="activeNav === 'product-adj'" />
      
      <!-- 보존된 기존 컴포넌트 -->
      <ProductRegistrationPanel v-else-if="activeNav === 'product'" />

      <NodeManagement v-else-if="activeNav === 'node'" />

      <div v-else class="workspace-body">
        
        <div class="workspace-left">
          <div class="search-section">
            <input type="text" v-model="searchQuery" placeholder="Buscar... (상품 코드 또는 이름 검색)" class="search-bar" />
          </div>

          <div class="hotkey-block">
            <div class="block-header"><h3>⚡ Quick Pick (단일 베스트)</h3></div>
            <div class="grid-3x4">
              <div v-for="prod in singleHotkeys" :key="prod.name" class="hotkey-card">
                <button class="hotkey-btn-core" @click="addSingleHotkeyToCart(prod)">
                  <div class="line-1">{{ prod.item_name }}</div>
                  <div class="line-2">({{ prod.custom_color || '단일' }} · {{ prod.custom_pack_qty || 1 }}入)</div>
                </button>
                <button class="hotkey-sub-edit-btn" @click="openInlineEdit('single', prod)">⚙️ edit</button>
              </div>
            </div>
          </div>

          <div class="hotkey-block">
            <div class="block-header"><h3>🌐 Grid Quick Pick (묶음 품목)</h3></div>
            <div class="grid-3x4">
              <div v-for="group in gridHotkeys" :key="group.id" class="hotkey-card">
                <button class="hotkey-btn-core grid-style" @click="openGridModal(group)">
                  <div class="line-1">{{ group.group_name }}</div>
                  <div class="line-2 text-teal">({{ group.variants.length }}가지 컬러)</div>
                </button>
                <button class="hotkey-sub-edit-btn" @click="openInlineEdit('grid', group)">⚙️ edit</button>
              </div>
            </div>
          </div>
        </div>

        <div class="workspace-right" :class="{ 'inbound-mode': transactionMode === 'inbound' }">
          
          <div class="tabs-control-header" :class="{ 'inbound-mode': transactionMode === 'inbound' }">
            <div class="tabs-list">
              <div 
                v-for="tab in tabList" 
                :key="tab.id" 
                class="tab-wrapper-item"
                :class="{ 'active': activeTabId === tab.id, 'inbound-mode': transactionMode === 'inbound' }"
              >
                <span class="tab-title-text" @click="activeTabId = tab.id">{{ tab.title }}</span>
                <button v-if="tabList.length > 1" class="tab-close-x-btn" @click.stop="closeTab(tab.id)">×</button>
              </div>
            </div>
            <div class="tabs-header-actions">
              <span class="transaction-mode-label">{{ transactionMode === 'outbound' ? '출고 입력' : '입고 입력' }}</span>
              <button class="add-tab-action-btn" @click="addNewTab">+ 탭추가</button>
            </div>
          </div>

          <div class="tab-body-content" v-if="currentTab">
            <div class="tab-internal-master-header" :class="{ locked: !canEditMasterFields }">
              <div class="master-lock-group">
                <label>🏢 입출고 대상 (창고/업체):</label>
                <select v-model="currentTab.selectedWarehouse" :disabled="!canEditMasterFields">
                  <option v-for="wh in warehouseList" :key="wh.name" :value="wh.name">
                    {{ wh.warehouse_name }}
                  </option>
                </select>
              </div>
              <div class="master-lock-group">
                <label>👤 입력 담당자:</label>
                <input type="text" v-model="currentTab.selectedManager" :disabled="!canEditMasterFields" style="padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;"/>
              </div>
            </div>

            <table class="pos-cart-table">
              <thead>
                <tr><th>품명(컬러)</th><th colspan="2">수량 입력</th><th>총 수량</th></tr>
                <tr class="sub-th"><th></th><th>Caja (박스)</th><th>Pza (낱장)</th><th></th></tr>
              </thead>
              <tbody>
                <tr v-for="item in currentTab.cartItems" :key="item.name">
                  <td class="product-cell">
                    <div class="p-name">{{ item.item_name }} ({{ item.custom_color || '기본' }})</div>
                    <div class="p-stock-info">{{ item.custom_pack_qty || 1 }}入</div>
                  </td>
                  <td class="input-green">
                    <input type="text" inputmode="numeric" pattern="[0-9]*" v-model.number="item.input_box" placeholder="0" />
                  </td>
                  <td class="input-green">
                    <input type="text" inputmode="numeric" pattern="[0-9]*" v-model.number="item.input_each" placeholder="0" />
                  </td>
                  <td class="total-qty-cell"><strong>{{ (item.input_box * (item.custom_pack_qty || 1)) + item.input_each }}</strong> 개</td>
                </tr>
                <tr v-if="currentTab.cartItems.length === 0">
                  <td colspan="4" class="empty-cart-msg">핫키를 누르거나 검색하여 상품을 추가하세요.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="right-footer-action-zone" v-if="currentTab">
            <div class="truck-counter-info-grid">
              <div class="summary-label-box">
                📦 박스 총 개수: <strong>{{ currentTabSummary.boxes }} 상자</strong>
              </div>
              <div class="summary-label-box">
                🔢 낱장 총 개수: <strong>{{ currentTabSummary.eaches }} 개</strong>
              </div>
            </div>
            
            <div class="action-btn-double-group">
              <button class="btn-outbound-reserve" @click="fetchFrappeItems">🔄 품목 동기화</button>
              <button class="btn-final-submit" @click="submitToFrappe">전표 발행 (Frappe 전송)</button>
            </div>
          </div>

        </div>
      </div>
    </main>

    <div class="modal-overlay" v-if="isGridModalOpen">
      <div class="modal-content">
        <div class="modal-header">
          <div class="product-title">품명: <strong>{{ activeGroup.group_name }}</strong></div>
          <button class="submit-btn" @click="submitGridSelection">선택 완료</button>
        </div>
        <table class="grid-table">
          <thead>
            <tr><th>컬러</th><th colspan="2">수량 입력</th><th>선택 총 수량</th></tr>
          </thead>
          <tbody>
            <tr v-for="(v, idx) in activeGroup.variants" :key="idx">
              <td class="color-name">{{ v.custom_color }}</td>
              <td class="input-green"><input type="text" inputmode="numeric" pattern="[0-9]*" v-model.number="v.input_box" placeholder="0" /></td>
              <td class="input-green"><input type="text" inputmode="numeric" pattern="[0-9]*" v-model.number="v.input_each" placeholder="0" /></td>
              <td class="calc-total-qty">{{ ((v.input_box || 0) * activeGroup.pack_qty) + (v.input_each || 0) }}개</td>
            </tr>
          </tbody>
        </table>
        <button class="close-text-btn" @click="isGridModalOpen = false">창 닫기</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import axios from 'axios' // 🌟 Frappe 통신을 위한 Axios 엔진
import ProductRegistrationPanel from '../components/ProductRegistrationPanel.vue'
import NodeManagement from '../components/NodeManagement.vue'
import ProductListView from './ProductListView.vue' // 신규 리스트 뷰
import StockReconciliationMain from './StockReconciliationMain.vue' // 신규 재고조정 메인 뷰

const router = useRouter()
const authStore = useAuthStore()

// 프라페 통신 인스턴스 (vite.config.js 프록시 활용)
const frappeApi = axios.create({
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  withCredentials: true // 프라페 세션 쿠키 탑재 필수
})

/** admin 권한 등 마스터 제어 */
const canEditMasterFields = computed(() => true) // 권한 연결은 추후 Auth 스토어 정밀화 후 설정

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

// 상태 변수들
const searchQuery = ref('')
const isGridModalOpen = ref(false)
const activeGroup = ref(null)
const activeNav = ref('outbound')
const transactionMode = ref('outbound')
const isProductMenuOpen = ref(false) // 🌟 상품관리 서브메뉴 상태

// 🌟 Frappe에서 가져올 실시간 데이터 그릇
const singleHotkeys = ref([])
const gridHotkeys = ref([])
const warehouseList = ref([])

// Frappe API 호출 로직 (컴포넌트 로드 시 자동 실행)
const fetchFrappeItems = async () => {
  try {
    // 1. 창고 목록 가져오기
    const whRes = await frappeApi.get('/api/resource/Warehouse', {
      params: { fields: JSON.stringify(['name', 'warehouse_name']) }
    })
    warehouseList.value = whRes.data.data

    // 2. 품목(Item) 마스터 가져오기
    // 실제 프라페에 custom_color, custom_pack_qty 필드가 생성되어 있다고 가정하고 불러옵니다.
    const itemRes = await frappeApi.get('/api/resource/Item', {
      params: {
        fields: JSON.stringify(['name', 'item_name', 'item_group', 'custom_color', 'custom_pack_qty']),
        limit_page_length: 50
      }
    })
    
    // 가져온 데이터를 핫키 리스트에 주입
    singleHotkeys.value = itemRes.data.data.map(item => ({
      ...item,
      input_box: 0,
      input_each: 0
    }))
    
  } catch (error) {
    console.error('Frappe 마스터 데이터 로드 실패:', error)
  }
}

onMounted(() => {
  fetchFrappeItems()
})

const setTransactionMode = (mode) => {
  transactionMode.value = mode
  activeNav.value = mode
}

const setActiveNav = (nav) => {
  activeNav.value = nav
}

// 탭 리스트 및 활성 탭
const tabList = ref([
  { 
    id: 'tab_1', 
    title: '주문서 1',
    selectedWarehouse: '',
    selectedManager: authStore.user?.member_name || '',
    cartItems: []
  }
])
const activeTabId = ref('tab_1')

const currentTab = computed(() => {
  return tabList.value.find(t => t.id === activeTabId.value)
})

const currentTabSummary = computed(() => {
  if (!currentTab.value) return { boxes: 0, eaches: 0 }
  let boxes = 0
  let eaches = 0
  currentTab.value.cartItems.forEach(item => {
    boxes += (Number(item.input_box) || 0)
    eaches += (Number(item.input_each) || 0)
  })
  return { boxes, eaches }
})

const addNewTab = () => {
  const nextNum = Math.max(...tabList.value.map(t => parseInt(t.id.replace('tab_', '')) || 1)) + 1
  const newId = `tab_${nextNum}`
  tabList.value.push({ 
    id: newId, 
    title: `주문서 ${nextNum}`,
    selectedWarehouse: '',
    selectedManager: authStore.user?.member_name || '',
    cartItems: []
  })
  activeTabId.value = newId
}

const closeTab = (tabId) => {
  const index = tabList.value.findIndex(t => t.id === tabId)
  if (index === -1) return
  if (activeTabId.value === tabId) {
    if (index > 0) activeTabId.value = tabList.value[index - 1].id
    else if (tabList.value.length > 1) activeTabId.value = tabList.value[index + 1].id
  }
  tabList.value = tabList.value.filter(t => t.id !== tabId)
}

const addSingleHotkeyToCart = (prod) => {
  if (!currentTab.value) return
  const existing = currentTab.value.cartItems.find(item => item.name === prod.name)
  if (existing) { 
    existing.input_box += 1 
  } else { 
    currentTab.value.cartItems.push({ ...prod, input_box: 1, input_each: 0 }) 
  }
}

const openGridModal = (group) => {
  activeGroup.value = group
  isGridModalOpen.value = true
}

const submitGridSelection = () => {
  if (!currentTab.value) return
  activeGroup.value.variants.forEach(v => {
    if (v.input_box > 0 || v.input_each > 0) {
      currentTab.value.cartItems.push({
        name: v.name,
        item_name: activeGroup.value.group_name,
        custom_color: v.custom_color,
        custom_pack_qty: activeGroup.value.pack_qty,
        input_box: v.input_box || 0,
        input_each: v.input_each || 0
      })
    }
  })
  isGridModalOpen.value = false
}

const openInlineEdit = (type, target) => {
  alert(`[단축키 수정] 나중에 프라페 설정 페이지로 연결됩니다.`);
}

// 🌟 Frappe 백엔드로 실제 전표(Stock Entry) 전송 로직
const submitToFrappe = async () => {
  if (!currentTab.value || currentTab.value.cartItems.length === 0) {
    alert("장바구니가 비어 있습니다.");
    return;
  }

  try {
    // Frappe Stock Entry 규격에 맞게 페이로드 조립
    const stockEntryPayload = {
      docstatus: 0, // 0: Draft, 1: Submit
      stock_entry_type: transactionMode.value === 'inbound' ? 'Material Receipt' : 'Material Issue',
      to_warehouse: transactionMode.value === 'inbound' ? currentTab.value.selectedWarehouse : undefined,
      from_warehouse: transactionMode.value === 'outbound' ? currentTab.value.selectedWarehouse : undefined,
      items: currentTab.value.cartItems.map(item => {
        const totalQty = (Number(item.input_box) * (item.custom_pack_qty || 1)) + Number(item.input_each);
        return {
          item_code: item.name,
          qty: totalQty,
          t_warehouse: transactionMode.value === 'inbound' ? currentTab.value.selectedWarehouse : undefined,
          s_warehouse: transactionMode.value === 'outbound' ? currentTab.value.selectedWarehouse : undefined,
        }
      })
    }

    const response = await frappeApi.post('/api/resource/Stock Entry', stockEntryPayload);
    
    if (response.status === 200) {
      alert(`[발행 성공] ${currentTab.value.title} 전표가 프라페에 저장되었습니다!`);
      currentTab.value.cartItems = []; // 장바구니 비우기
    }
  } catch (error) {
    console.error('프라페 전송 에러:', error);
    alert('전송 중 에러가 발생했습니다. 개발자 도구를 확인하세요.');
  }
}
</script>

<style scoped>
/* =====================================================
사장님의 CSS는 단 1픽셀도 건드리지 않고 100% 그대로 유지했습니다!
에디터에 복사해 넣으실 때는 기존의 <style scoped> 안쪽 내용을 
그대로 유지하시면 됩니다. (생략 방지)
=====================================================
*/
.pos-app-layout {
  display: flex;
  align-items: flex-start;
  width: 100%;
  min-width: 1024px;
  min-height: 100vh;
  margin: 0 auto;
  overflow: auto;
  font-family: sans-serif;
  background: #f4f6f9;
  box-sizing: border-box;
}

.sidebar-nav {
  width: 220px;
  min-width: 220px;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  align-self: flex-start;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  background: #1e293b;
  color: #f8fafc;
  display: flex;
  flex-direction: column;
  padding: 20px 0;
  box-sizing: border-box;
}
.nav-logo { flex-shrink: 0; font-size: 18px; font-weight: bold; text-align: center; padding-bottom: 12px; border-bottom: 1px solid #334155; color: #38bdf8; }
.nav-user-info { flex-shrink: 0; padding: 10px 15px 14px; border-bottom: 1px solid #334155; text-align: center; }
.nav-user-name { display: block; font-size: 13px; font-weight: bold; color: #f8fafc; }
.nav-user-meta { display: block; font-size: 10.5px; color: #94a3b8; margin-top: 2px; text-transform: uppercase; }
.nav-menu {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 15px 10px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: #94a3b8 #334155;
}
.nav-menu::-webkit-scrollbar { width: 8px; }
.nav-menu::-webkit-scrollbar-track { background: #334155; border-radius: 4px; }
.nav-menu::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 4px; }
.nav-menu::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
.nav-item { display: flex; justify-content: space-between; color: #cbd5e1; text-decoration: none; padding: 12px 15px; border-radius: 6px; font-size: 14px; transition: all 0.2s; white-space: nowrap; flex-shrink: 0; }
.nav-item:hover, .nav-item.active { background: #334155; color: white; font-weight: bold; }
.nav-group { display: flex; flex-direction: column; }
.nav-sub-menu { display: flex; flex-direction: column; background: #0f172a; padding: 4px 8px; border-radius: 6px; margin-top: 4px; }
.sub-item { padding: 10px 15px 10px 30px; font-size: 13px; color: #94a3b8; }
.sub-item:hover, .sub-item.active { background: #1e293b; color: #38bdf8; }
.nav-logout-btn { width: 100%; text-align: left; background: none; border: none; cursor: pointer; font-family: inherit; margin-top: 8px; color: #fca5a5 !important; }
.nav-logout-btn:hover { background: #450a0a !important; color: white !important; }

.main-content-zone { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: visible; }
.workspace-body { display: flex; flex: 1; overflow: hidden; padding: 15px; gap: 15px; }
.workspace-left { flex: 1.1; display: flex; flex-direction: column; gap: 15px; overflow-y: auto; }
.workspace-right { flex: 0.9; background: white; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }

.search-bar { width: 100%; padding: 12px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 14px; }
.hotkey-block { display: flex; flex-direction: column; gap: 8px; }
.block-header { border-bottom: 2px solid #00a896; padding-bottom: 4px; }
.block-header h3 { margin: 0; font-size: 14px; }

.grid-3x4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.hotkey-card { display: flex; flex-direction: column; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.hotkey-btn-core { background: none; border: none; padding: 12px 4px; cursor: pointer; flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 55px; }
.grid-style { border-left: 4px solid #00a896; }
.line-1 { font-size: 12.5px; font-weight: bold; }
.line-2 { font-size: 9.5px; color: #64748b; margin-top: 2px; }
.hotkey-sub-edit-btn { background: #f1f5f9; border: none; border-top: 1px solid #e2e8f0; padding: 4px 0; font-size: 10.5px; color: #64748b; cursor: pointer; text-align: center; }
.hotkey-sub-edit-btn:hover { background: #e2e8f0; color: black; }
.empty-cell { border: 1px dashed #cbd5e1; border-radius: 6px; background: #f8fafc; }

.tabs-control-header { display: flex; justify-content: space-between; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; padding: 6px 10px 0 10px; }
.tabs-control-header.inbound-mode { background: #fce7f3; border-bottom-color: #f9a8d4; }
.tabs-list { display: flex; gap: 4px; }
.tab-wrapper-item { display: flex; align-items: center; gap: 6px; background: #e2e8f0; border: 1px solid #cbd5e1; border-bottom: none; padding: 8px 12px; border-radius: 6px 6px 0 0; font-size: 12.5px; font-weight: bold; cursor: pointer; color: #64748b; position: relative; }
.tab-wrapper-item.inbound-mode { background: #fbcfe8; border-color: #f9a8d4; }
.tab-wrapper-item.active { background: white; color: #00a896; border-color: #cbd5e1; border-bottom-color: white; margin-bottom: -1px; }
.tab-wrapper-item.inbound-mode.active { background: #fff1f2; color: #db2777; border-color: #f9a8d4; border-bottom-color: #fff1f2; }
.tab-title-text { cursor: pointer; }
.tab-close-x-btn { background: none; border: none; font-size: 14px; font-weight: bold; color: #94a3b8; cursor: pointer; padding: 0 2px; line-height: 1; border-radius: 50%; }
.tab-close-x-btn:hover { background: #ef4444; color: white; }
.tabs-header-actions { display: flex; align-items: center; gap: 10px; padding-bottom: 6px; }
.transaction-mode-label { font-size: 13px; font-weight: bold; color: #00a896; white-space: nowrap; }
.inbound-mode .transaction-mode-label { color: #db2777; }
.add-tab-action-btn { background: none; border: none; color: #00a896; font-weight: bold; cursor: pointer; font-size: 13px; }
.inbound-mode .add-tab-action-btn { color: #db2777; }
.workspace-right.inbound-mode { background: #fff1f2; border-color: #f9a8d4; }

.tab-body-content { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 15px; }

.tab-internal-master-header { display: flex; gap: 10px; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
.tab-internal-master-header.locked { background: #f1f5f9; }
.master-lock-group { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.master-lock-group label { font-size: 11px; font-weight: bold; color: #64748b; }
.master-lock-group select { padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12.5px; outline: none; background: white; }
.master-lock-group select:disabled { background: #e2e8f0; color: #64748b; cursor: not-allowed; }

.pos-cart-table { width: 100%; border-collapse: collapse; }
.pos-cart-table th, .pos-cart-table td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12.5px; text-align: center; }
.pos-cart-table th { background: #f8fafc; font-weight: bold; }
.sub-th th { font-size: 11px; padding: 3px; background: #f1f5f9; }
.empty-cart-msg { padding: 40px 0; color: #94a3b8; font-style: italic; }

.input-green { background-color: #00e676 !important; width: 52px; padding: 2px; }
.input-green input { width: 100%; background: transparent; border: none; text-align: center; font-size: 14px; font-weight: bold; outline: none; }
.product-cell { text-align: left; }
.p-name { font-weight: bold; }
.p-stock-info { font-size: 11px; color: #64748b; }
.total-qty-cell strong { color: #00a896; font-size: 14px; }

.right-footer-action-zone { border-top: 2px solid #e2e8f0; padding: 15px; background: #f8fafc; display: flex; flex-direction: column; gap: 12px; }
.truck-counter-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.summary-label-box { background: white; border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; font-size: 13px; font-weight: bold; color: #334155; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
.summary-label-box strong { font-size: 15px; color: #00a896; margin-left: 4px; }

.action-btn-double-group { display: grid; grid-template-columns: 1fr 1.2fr; gap: 10px; }
.btn-outbound-reserve { background: #475569; color: white; border: none; padding: 14px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14.5px; }
.btn-final-submit { background: #00a896; color: white; border: none; padding: 14px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14.5px; }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999; }
.modal-content { background: white; width: 85%; max-width: 850px; padding: 25px; border-radius: 6px; }
.grid-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
.grid-table th, .grid-table td { border: 1px solid #aaa; padding: 8px; text-align: center; }
.submit-btn { background: white; border: 1px solid #333; padding: 6px 20px; font-weight: bold; cursor: pointer; }
.close-text-btn { float: right; background: none; border: none; color: #888; cursor: pointer; margin-top: 10px; font-size: 12px; }
</style>
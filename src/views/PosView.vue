<template>
  <div class="pos-view-container">
    <MobilePosLayout 
    v-if="isMobile" 
    ref="mobileLayoutRef"
    :raw-items="rawSingleItems"
    :bin-data="binDataMap"
    :pending-reserved="pendingReservedMap"
    :branch-list="branchList"
    :editing-draft-name="editingBranchDraftName"
    :branch-reservation-count="branchReservationCount"
    @edit-reservation="handleBranchEditReservation"
    @refresh-items="fetchFrappeItems"
  />
  <div v-else class="pos-app-layout">
    <aside class="sidebar-nav">
      <div class="nav-logo">🏆 WMS PRO</div>
      <div v-if="authStore.user" class="nav-user-info">
        <span class="nav-user-name">{{ authStore.user.member_name || authStore.user.full_name }}</span>
        <span class="nav-user-meta">{{ authStore.user.branch_name ?? $t('pos.hq_label') }} · {{ isAdmin ? 'Admin' : (authStore.user.access_level || '-') }}</span>
        <span
          v-if="!isAdmin && branchSession.needsPinGate"
          class="nav-user-meta"
          style="display:block; margin-top:4px; font-weight:800;"
          :style="{ color: branchSession.isManagerMode ? '#86efac' : '#38bdf8' }"
        >
          {{ branchSession.isManagerMode ? $t('pos.mode_manager') : $t('pos.mode_clerk', { name: branchSession.selectedClerkName || '-' }) }}
        </span>
        <button
          v-if="!isAdmin && branchSession.needsPinGate && branchSession.isClerkMode"
          type="button"
          style="margin-top:8px; width:100%; background:#f59e0b; color:#111; border:none; border-radius:6px; padding:8px; font-weight:800; cursor:pointer; font-size:12px;"
          @click="branchSession.openPinModal()"
        >{{ $t('pos.btn_pin_unlock') }}</button>
        <button
          v-else-if="!isAdmin && branchSession.needsPinGate && branchSession.isManagerMode"
          type="button"
          style="margin-top:8px; width:100%; background:#334155; color:#e2e8f0; border:none; border-radius:6px; padding:8px; font-weight:700; cursor:pointer; font-size:12px;"
          @click="branchSession.lockToClerk()"
        >{{ $t('pos.btn_lock_clerk') }}</button>
      </div>
      <div class="nav-lang-switcher" style="padding: 0 12px; margin-bottom: 12px;">
        <LanguageSwitcher style="width: 100%; box-sizing: border-box;" />
      </div>
      <nav class="nav-menu">
        <!-- 지점 POS VENTA (항상 가장 먼저 노출: 지점장 및 관리자 모두 사용 가능) -->
        <a href="#" class="nav-item pos-venta-btn" :class="{ active: activeNav === 'branch-pos' }" @click.prevent="setActiveNav('branch-pos')" style="background: linear-gradient(135deg, #0ea5e9, #0284c7); color: #ffffff !important; font-weight: 800; border-radius: 8px; margin: 8px 12px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 12px rgba(14,165,233,0.35); text-decoration: none;">
          <span style="font-size: 15px;">🛒 {{ $t('nav.branch_pos', '지점 POS (VENTA)') }}</span>
          <span style="background: rgba(255,255,255,0.22); padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 900; letter-spacing: 0.5px;">POS</span>
        </a>

        <!-- 지점 전용 메뉴: 관리자가 지점장 UI로 오인되지 않도록 지점 계정에만 상단 노출 -->
        <div v-if="!isAdmin" class="nav-group" style="margin-top: 5px; margin-bottom: 5px;">
          <span style="padding: 5px 15px; font-size: 11px; color: #38bdf8; font-weight: bold; text-transform: uppercase;">{{ $t('nav.branch_group') }}</span>
          <div class="nav-sub-menu" style="background: rgba(0,0,0,0.2); padding-left:10px; margin-top: 0;">
            <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'branch-pos' }" @click.prevent="setActiveNav('branch-pos')">🛒 {{ $t('nav.branch_pos', '지점 POS (VENTA)') }}</a>
            <template v-if="branchSession.isManagerMode">
              <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'branch-transfer' }" @click.prevent="setActiveNav('branch-transfer')">{{ $t('nav.branch_transfer') }}</a>
              <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'branch-reservation' }" @click.prevent="setActiveNav('branch-reservation')">{{ $t('nav.branch_reservation') }} <span v-if="branchReservationCount > 0" class="res-badge">{{ branchReservationCount }}</span></a>
              <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'branch-inventory' }" @click.prevent="setActiveNav('branch-inventory')">{{ $t('nav.branch_inventory') }}</a>
            </template>
            <div v-else style="padding: 8px 15px; font-size: 11px; color: #94a3b8; line-height: 1.4;">
              {{ $t('pos.clerk_notice_1') }}<br/>{{ $t('pos.clerk_notice_2') }}
            </div>
          </div>
        </div>

        <template v-if="isAdmin">
          <div style="border-top: 1px solid #334155; margin: 5px 0;"></div>
          <span style="padding: 5px 15px; font-size: 11px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">{{ $t('nav.admin_group') }}</span>
          <a href="#" class="nav-item" :class="{ active: activeNav === 'home' }" @click.prevent="setActiveNav('home')">🏠 {{ $t('nav.home') }}</a>
          <button class="nav-item nav-btn-inline" @click.prevent="isOutboundMenuOpen = !isOutboundMenuOpen">
          {{ $t('nav.outbound_group') }} <span style="float:right;">{{ isOutboundMenuOpen ? '▲' : '▼' }}</span>
        </button>
        <div v-show="isOutboundMenuOpen" class="nav-sub-menu" style="background: rgba(0,0,0,0.1); padding-left:10px;">
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'outbound' }" @click.prevent="setActiveNav('outbound', 'outbound')">{{ $t('nav.outbound_entry') }}</a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'outbound-reservation' }" @click.prevent="setActiveNav('outbound-reservation'); setTransactionMode('outbound')">{{ $t('nav.outbound_res') }} <span v-if="incompleteReservationCount > 0" class="res-badge">{{ incompleteReservationCount }}</span></a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'outbound-list' }" @click.prevent="setActiveNav('outbound-list'); setTransactionMode('outbound')">{{ $t('nav.outbound_list') }}</a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'outbound-history' }" @click.prevent="setActiveNav('outbound-history'); setTransactionMode('outbound')">{{ $t('nav.outbound_history') }}</a>
        </div>
        <button class="nav-item nav-btn-inline" @click.prevent="isInboundMenuOpen = !isInboundMenuOpen">
          {{ $t('nav.inbound_group') }} <span style="float:right;">{{ isInboundMenuOpen ? '▲' : '▼' }}</span>
        </button>
        <div v-show="isInboundMenuOpen" class="nav-sub-menu" style="background: rgba(0,0,0,0.1); padding-left:10px;">
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'inbound' }" @click.prevent="setActiveNav('inbound', 'inbound')">{{ $t('nav.inbound_entry') }}</a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'inbound-list' }" @click.prevent="setActiveNav('inbound-list'); setTransactionMode('inbound')">{{ $t('nav.inbound_list') }}</a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'inbound-history' }" @click.prevent="setActiveNav('inbound-history'); setTransactionMode('inbound')">{{ $t('nav.inbound_history') }}</a>
        </div>
        <button class="nav-item nav-btn-inline" @click.prevent="isTransferMenuOpen = !isTransferMenuOpen">
          {{ $t('nav.move_group') }} <span style="float:right;">{{ isTransferMenuOpen ? '▲' : '▼' }}</span>
        </button>
        <div v-show="isTransferMenuOpen" class="nav-sub-menu" style="background: rgba(0,0,0,0.1); padding-left:10px;">
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'transfer' }" @click.prevent="setActiveNav('transfer', 'transfer')">{{ $t('nav.move_entry') }}</a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'transfer-reservation' }" @click.prevent="setActiveNav('transfer-reservation'); setTransactionMode('transfer')">{{ $t('nav.move_res') }} <span v-if="incompleteTransferReservationCount > 0 || incompleteTransferStockEntryCount > 0" class="res-badge"><template v-if="incompleteTransferStockEntryCount > 0">{{ incompleteTransferReservationCount }} - {{ incompleteTransferStockEntryCount }}</template><template v-else>{{ incompleteTransferReservationCount }}</template></span></a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'transfer-list' }" @click.prevent="setActiveNav('transfer-list'); setTransactionMode('transfer')">{{ $t('nav.move_list') }}</a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'transfer-history' }" @click.prevent="setActiveNav('transfer-history'); setTransactionMode('transfer')">{{ $t('nav.move_history') }}</a>
        </div>
        
        <!-- 🌟 신규 상품 관리 메뉴 그룹 -->
        <div class="nav-group">
          <a href="#" class="nav-item group-title" @click.prevent="isProductMenuOpen = !isProductMenuOpen">
            📦 {{ $t('nav.product_management') }} {{ isProductMenuOpen ? '▴' : '▾' }}
          </a>
          <div v-show="isProductMenuOpen" class="nav-sub-menu">
            <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'product-list' }" @click.prevent="setActiveNav('product-list')">📋 {{ $t('nav.product_list') }}</a>
            <!-- <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'product-move' }" @click.prevent="setActiveNav('product-move')">🔄 {{ $t('nav.product_move') }}</a> -->
            <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'product-adj' }" @click.prevent="setActiveNav('product-adj')">⚖️ {{ $t('nav.product_adj') }}</a>
            <!-- <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'product-reg' }" @click.prevent="setActiveNav('product-reg')">➕ {{ $t('nav.product_reg') }}</a> -->
          </div>
        </div>

        <!-- 기존 상품등록 (보존용) -->
        <!-- <a href="#" class="nav-item" :class="{ active: activeNav === 'product' }" @click.prevent="setActiveNav('product')">📦 {{ $t('nav.product_old') }}</a> -->
        <a href="#" class="nav-item" :class="{ active: activeNav === 'node' }" @click.prevent="setActiveNav('node')">🏢 {{ $t('nav.node') }}</a>
        <a href="#" class="nav-item" :class="{ active: activeNav === 'report' }" @click.prevent="activeNav = 'report'">📊 {{ $t('nav.report') }}</a>
        <a href="#" class="nav-item" :class="{ active: activeNav === 'manager' }" @click.prevent="activeNav = 'manager'">👤 {{ $t('nav.manager') }}</a>
        <!-- <a href="#" class="nav-item" :class="{ active: activeNav === 'search-edit' }" @click.prevent="setActiveNav('search-edit')">🔍 {{ $t('nav.search_edit') }}</a> -->
        </template>

        <template v-if="isAdmin">
          <a href="#" class="nav-item" :class="{ active: activeNav === 'settings' }" @click.prevent="activeNav = 'settings'">⚙️ {{ $t('nav.settings') }}</a>
          <a href="#" class="nav-item" :class="{ active: activeNav === 'staff-management' }" @click.prevent="activeNav = 'staff-management'">👨‍👩‍👧 {{ $t('nav.staff_management') }}</a>
        </template>
        <template v-else-if="branchSession.isManagerMode">
          <a href="#" class="nav-item" :class="{ active: activeNav === 'settings' }" @click.prevent="activeNav = 'settings'">⚙️ {{ $t('nav.settings') }}</a>
        </template>
        <button type="button" class="nav-item nav-logout-btn" :disabled="isLoggingOut" @click="handleLogout">
          {{ isLoggingOut ? '⏳ ' + $t('nav.logging_out') : '🚪 ' + $t('nav.logout') }}
        </button>
      </nav>
    </aside>

    <main class="main-content-zone">
      <!-- 🌟 신규 추가된 컴포넌트들 -->
      <ReservationListView v-if="activeNav === 'outbound-reservation'" :branch-list="branchList" :raw-items="rawSingleItems" reservation-type="Material Issue" @create-new="activeNav = 'outbound'" @edit-reservation="loadReservationToCart" @edit-draft="loadDraftToCart" @refresh-items="fetchFrappeItems" />
      <ReservationListView v-else-if="activeNav === 'transfer-reservation'" :branch-list="branchList" :raw-items="rawSingleItems" reservation-type="Material Transfer" @create-new="activeNav = 'transfer'" @edit-reservation="loadReservationToCart" @edit-draft="loadDraftToCart" @refresh-items="fetchFrappeItems" />
      <ProductListView v-else-if="activeNav === 'product-list'" @open-detail="openProductDetail" />
      <ProductDetailView v-else-if="activeNav === 'product-detail'" :item-id="activeProductId" @go-back="setActiveNav(previousNavForProductDetail)" />
      <BranchProductDetailView v-else-if="activeNav === 'branch-product-detail'" :item-id="activeProductId" :current-branch="authStore.user?.branch_name" :raw-items="rawSingleItems" @go-back="setActiveNav(previousNavForProductDetail)" />
      <StockReconciliationMain v-else-if="activeNav === 'product-adj'" />
      
      <!-- 지점 전용 영역 -->
      <BranchPosView 
        v-else-if="activeNav === 'branch-pos'" 
        :raw-items="rawSingleItems"
        :bin-data="binDataMap"
        :pending-reserved="pendingReservedMap"
        :branch-list="branchList"
        :customer-list="customerList"
        :sales-person-list="salesPersonList"
        @refresh-items="fetchFrappeItems"
      />
      <!-- 지점 재고 이동 예약 -->
      <BranchTransferView 
        v-else-if="activeNav === 'branch-transfer'" 
        ref="branchTransferRef"
        :raw-items="rawSingleItems"
        :bin-data="binDataMap"
        :pending-reserved="pendingReservedMap"
        :branch-list="branchList"
        :editing-draft-name="editingBranchDraftName"
        @refresh-items="fetchFrappeItems"
      />
      <!-- 지점 예약 리스트 (DRAFT) -->
      <BranchTransferReservationList 
        v-else-if="activeNav === 'branch-reservation'" 
        :raw-items="rawSingleItems"
        @create-new="setActiveNav('branch-transfer')"
        @edit-reservation="handleBranchEditReservation"
        @refresh-items="fetchFrappeItems"
      />
      <BranchInventoryList 
        v-else-if="activeNav === 'branch-inventory'" 
        :raw-items="rawSingleItems"
        :bin-data="binDataMap"
        :pending-reserved="pendingReservedMap"
        @open-detail="openProductDetail"
        
      />
      
      <OutboundListView v-else-if="activeNav === 'outbound-list'" :branch-list="branchList" :raw-items="rawSingleItems" @edit-outbound="loadOutboundToCart" @refresh-items="fetchFrappeItems" list-type="Material Issue" />
      <OutboundListView v-else-if="activeNav === 'transfer-list'" :branch-list="branchList" :raw-items="rawSingleItems" @edit-outbound="loadTransferToCart" @refresh-items="fetchFrappeItems" list-type="Material Transfer" />
      <OutboundHistoryListView v-else-if="activeNav === 'outbound-history'" :branch-list="branchList" :raw-items="rawSingleItems" @edit-history="loadOutboundToCart" list-type="Material Issue" />
      <OutboundHistoryListView v-else-if="activeNav === 'transfer-history'" :branch-list="branchList" :raw-items="rawSingleItems" @edit-history="loadTransferToCart" list-type="Material Transfer" />
      <InboundListView v-else-if="activeNav === 'inbound-list'" :branch-list="branchList" :raw-items="rawSingleItems" @edit-inbound="loadInboundToCart" />
      <InboundHistoryListView v-else-if="activeNav === 'inbound-history'" :branch-list="branchList" :raw-items="rawSingleItems" @edit-history="loadInboundToCart" />
      
      <!-- 보존된 기존 컴포넌트 -->
      <ProductRegistrationPanel v-else-if="activeNav === 'product'" />
      
      <NodeManagement v-else-if="activeNav === 'node'" />
      
      <StaffManagementView v-else-if="activeNav === 'staff-management'" />
      
      <!-- 지점 및 일반 설정창 -->
      <BranchSettingsView 
        v-else-if="activeNav === 'settings'"
        :current-branch="authStore.user?.branch_name"
        @close="setActiveNav('branch-pos')"
      />

      
      <PcTransactionCart ref="pcCartRef" 
        v-else-if="['outbound', 'inbound', 'transfer'].includes(activeNav)"
        :raw-items="rawSingleItems"
        :bin-data="binDataMap"
        :pending-reserved="pendingReservedMap"
        :branch-list="branchList"
        :customer-list="customerList"
        :sales-person-list="salesPersonList"
        :supplier-list="supplierList"
        :warehouse-list="warehouseList"
        :transaction-mode="transactionMode"
        @refresh-items="fetchFrappeItems"
        @navigate="(nav) => setActiveNav(nav)"
      />
    </main>

  <ReceiptPrint ref="receiptPrintRef" :receiptData="receiptPrintData" :items="receiptPrintItems" />
  <SamdoriVoiceAssistant
    ref="samdori"
    :valid-items="validItemCodes"
    :pending-stock-item="pendingVoiceStockItem"
    @intent-parsed="handleSamdoriIntent"
  />
  <!-- 지점장 PIN (사이드바에서도 열림 — 프론트 전용) -->
  <PinUnlockModal variant="desktop" @unlock="onBranchPinUnlock" />
  </div>
  </div>
</template>

<script setup>
import SamdoriVoiceAssistant from '../components/SamdoriVoiceAssistant.vue'
import { useMobile } from '../composables/useMobile.js'
import MobilePosLayout from './mobile/MobilePosLayout.vue'
import { useI18n } from 'vue-i18n'
import { ref, computed, onMounted, nextTick, watch, onUnmounted } from 'vue'
import ReceiptPrint from '../components/ReceiptPrint.vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import { branchPriceListCandidates } from '../utils/branchPriceList.js'
import { useBranchSessionStore } from '../stores/branchSession.js'
import { useItemSearch, rankItemNameMatches } from '../composables/useItemSearch.js'
import { usePagedList } from '../composables/usePagedList.js'
import { APPROVAL_STAGE, stageFilter } from '../constants/approvalStage.js'
import axios from 'axios'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import ProductRegistrationPanel from '../components/ProductRegistrationPanel.vue'
import NodeManagement from '../components/NodeManagement.vue'
import StaffManagementView from '../components/StaffManagementView.vue'
import ProductListView from './ProductListView.vue'
import StockReconciliationMain from './StockReconciliationMain.vue'
import BranchPosView from '../components/branch/BranchPosView.vue'
import BranchTransferView from '../components/branch/BranchTransferView.vue'
import BranchTransferReservationList from '../components/branch/BranchTransferReservationList.vue'
import BranchInventoryList from '../components/branch/BranchInventoryList.vue'
import BranchSettingsView from '../components/branch/BranchSettingsView.vue'
import BranchProductDetailView from '../components/branch/BranchProductDetailView.vue'
import PinUnlockModal from '../components/PinUnlockModal.vue'
import ReservationListView from './ReservationListView.vue'
import OutboundListView from './OutboundListView.vue'
import OutboundHistoryListView from './OutboundHistoryListView.vue'
import InboundListView from './InboundListView.vue'
import InboundHistoryListView from './InboundHistoryListView.vue'
import ProductDetailView from './ProductDetailView.vue'
import PcTransactionCart from '../components/pc/PcTransactionCart.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { isMobile } = useMobile()
const isAdmin = computed(() => authStore.isAdmin)
const branchSession = useBranchSessionStore()
const { t, locale } = useI18n();

const pcCartRef = ref(null);

const executeCartAction = async (nav, actionName, payload) => {
  activeNav.value = nav;
  await nextTick();
  if (pcCartRef.value && pcCartRef.value[actionName]) {
    pcCartRef.value[actionName](payload);
  }
};

const loadReservationToCart = (res) => executeCartAction(res.material_request_type === 'Material Transfer' ? 'transfer' : 'outbound', 'loadReservationToCart', res);
const loadDraftToCart = (docName) => executeCartAction(activeNav.value.startsWith('outbound') ? 'outbound' : 'transfer', 'loadDraftToCart', docName);
const loadOutboundToCart = (entry) => executeCartAction('outbound', 'loadOutboundToCart', entry);
const loadTransferToCart = (entry) => executeCartAction('transfer', 'loadTransferToCart', entry);
const loadInboundToCart = (entry) => executeCartAction('inbound', 'loadInboundToCart', entry);



const {
  rebuildItemIndex,
  addOrUpdateItem,
  searchItems,
  searchItemsOrAll,
  rebuildGridIndex,
  searchGridsOrAll
} = useItemSearch()

const frappeApi = axios.create({
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  withCredentials: true
})

const canEditMasterFields = computed(() => true)

const isLoggingOut = ref(false)

const handleLogout = async () => {
  if (isLoggingOut.value) return
  isLoggingOut.value = true
  try {
    const serverCleared = await authStore.logout()
    if (!serverCleared) {
      alert(t('pos.msg_logout_server_failed'))
    }
    await router.replace('/login')
  } finally {
    isLoggingOut.value = false
  }
}

const searchQuery = ref('')

// --- Receipt Print & Copy ---
const receiptPrintRef = ref(null)
const receiptPrintData = ref({ summary: {} })
const receiptPrintItems = ref([])

const isShippingAddressModalOpen = ref(false)
const shippingAddressList = ref([])
const shippingPhone = ref('')
const pendingPrintData = ref(null)

const isPartialCloseModalOpen = ref(false)
const partialCloseReservationId = ref(null)

const confirmPartialClose = async () => {
  if (!partialCloseReservationId.value) return;
  isPartialCloseModalOpen.value = false;
  try {
    await frappeApi.post('/api/method/erpnext.stock.doctype.material_request.material_request.update_status', {
      status: 'Stopped',
      name: partialCloseReservationId.value
    })
    alert(t('pos.msg_res_stopped_ok'));
  } catch (e) {
    console.warn('Stopped 메서드 호출 실패, set_value 로 백업 시도', e);
    try {
      await frappeApi.post('/api/method/frappe.client.set_value', {
        doctype: 'Material Request',
        name: partialCloseReservationId.value,
        fieldname: 'status',
        value: 'Stopped'
      })
      alert(t('pos.msg_res_stopped_ok'));
    } catch (e2) {
      console.error('잔여분 종결 실패', e2)
    }
  }
}

const cancelPartialClose = () => {
  isPartialCloseModalOpen.value = false;
  partialCloseReservationId.value = null;
}

const selectShippingAddress = (addr) => {
  isShippingAddressModalOpen.value = false;
  if (pendingPrintData.value) {
    const { docName, mode, fromWh, toWh, branch, items } = pendingPrintData.value;
    triggerPrintAndCopy(docName, mode, fromWh, toWh, branch, items, { address: addr, phone: shippingPhone.value });
  }
}

const cancelShippingAddress = () => {
  isShippingAddressModalOpen.value = false;
  if (pendingPrintData.value) {
    const { docName, mode, fromWh, toWh, branch, items } = pendingPrintData.value;
    triggerPrintAndCopy(docName, mode, fromWh, toWh, branch, items, null);
  }
}

const triggerPrintAndCopy = async (docName, mode, source, target, branch, items, shippingInfo = null) => {
  const dateStr = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' })
  
  let title = 'COMPROBANTE DE SALIDA'
  let ubicacion = target || branch || 'N/A'
  
  if (mode === 'inbound') {
    title = 'COMPROBANTE DE ENTRADA'
    ubicacion = source || 'N/A'
  } else if (mode === 'transfer') {
    title = 'COMPROBANTE DE TRASLADO'
    ubicacion = `${source} -> ${target}`
  } else if (mode === 'outbound') {
    title = 'COMPROBANTE DE SALIDA'
    const customer = currentTab.value?.selectedCustomer || 'N/A'
    ubicacion = `${source || 'N/A'} -> ${customer}`
  }

  const vendedor = authStore.user?.member_name || authStore.user?.full_name || 'ADMIN'
  const solicitante = currentTab.value?.selectedResponder || 'ADMIN'
  const creador = currentTab.value?.selectedCreator || vendedor
  
  let totalBulto = 0
  let totalPzs = 0
  items.forEach(item => {
    totalBulto += Number(item.input_box) || 0
    totalPzs += Number(item.input_each) || 0
  })

  receiptPrintData.value = {
    title,
    no: docName,
    date: dateStr,
    ubicacion,
    vendedor,
    mode,
    solicitante,
    creador,
    shippingInfo,
    summary: { items: items.length, bulto: totalBulto, pzs: totalPzs }
  }
  
  receiptPrintItems.value = JSON.parse(JSON.stringify(items))
  
  await nextTick() // Wait for Vue to render the print DOM
  
  if (receiptPrintRef.value) {
    const success = await receiptPrintRef.value.copyToClipboard()
    if (success) {
      alert(t('pos.msg_receipt_copied'))
    } else {
      alert(t('pos.msg_err_receipt_copy'))
    }
  }
  
  // 브라우저 인쇄창 호출
  window.print()
}
// ----------------------------
const isGridModalOpen = ref(false)
const activeGroup = ref(null)
// 지점 사용자는 POS VENTA(판매) 화면을 기본값으로 사용
const activeNav = ref(isAdmin.value ? 'outbound' : 'branch-pos')

// 역할 복구 타이밍에 activeNav가 지점으로 고정되는 것 방지
watch(
  isAdmin,
  (admin) => {
    if (admin && String(activeNav.value || '').startsWith('branch')) {
      activeNav.value = 'outbound'
    }
  },
  { immediate: true }
)
const transactionMode = ref('outbound')
const isProductMenuOpen = ref(false)
const isInboundMenuOpen = ref(false)
const isOutboundMenuOpen = ref(true)
const isTransferMenuOpen = ref(true)
const activeProductId = ref(null)
const previousNavForProductDetail = ref('product-list')

const openProductDetail = (itemId) => {
  activeProductId.value = itemId
  previousNavForProductDetail.value = activeNav.value
  if (!isAdmin.value || activeNav.value === 'branch-inventory') {
    activeNav.value = 'branch-product-detail'
  } else {
    activeNav.value = 'product-detail'
  }
}

const barcodeQuery = ref('')
const isSearchDropdownOpen = ref(false)

const rawSingleItems = ref([])
const gridHotkeys = ref([])
const warehouseList = ref([])
const binData = ref([])
const pendingReservedMap = ref({}) // 🌟 예약(진행중) 수량 맵: { warehouse: { item_code: qty } }
const customerList = ref([])
const salesPersonList = ref([])
const supplierList = ref([])
const incompleteReservationCount = ref(0)
const incompleteTransferReservationCount = ref(0)
const incompleteTransferStockEntryCount = ref(0)
const branchReservationCount = ref(0)
const branchDraftWaitCount = ref(0)

const isQuickItemModalOpen = ref(false)
const isQuickCustomerModalOpen = ref(false)
const isQuickSalesPersonModalOpen = ref(false)

const branchList = computed(() => {
  // 지점 목록은 회사 산하 지점 창고 (SCURUSAL - K 하위)
  let list = warehouseList.value.filter(wh => wh.parent_warehouse === 'SCURUSAL - K')
  
  if (!authStore.isAdmin) {
    const uBranch = (authStore.userBranch || authStore.user?.branch_name || '').toUpperCase()
    list = list.filter(wh => {
      const wName = wh.name.toUpperCase()
      return wName.includes('ALARCON') || (uBranch && (wName === uBranch || wName.includes(uBranch)))
    })
  }
  return list
})

const filteredSalesPersonList = computed(() => {
  const targetBranch = transactionMode.value === 'transfer' 
    ? currentTab.value?.selectedTarget 
    : currentTab.value?.selectedBranch;
    
  const selected = currentTab.value?.selectedResponder
  let list = !targetBranch
    ? [...salesPersonList.value]
    : salesPersonList.value.filter(sp => sp.custom_branch === targetBranch)

  // 현재 선택된 요청자는 지점 필터와 달라도 옵션에 유지 (Draft 로드 시 빈칸 방지)
  if (selected && !list.some(sp => sp.name === selected)) {
    const missing = salesPersonList.value.find(sp => sp.name === selected)
    if (missing) list = [...list, missing]
  }

  // name 기준 중복 제거
  const seen = new Set()
  return list.filter(sp => {
    if (seen.has(sp.name)) return false
    seen.add(sp.name)
    return true
  })
})

const isQuickAdjustModalOpen = ref(false)
const quickAdjustItem = ref(null)
const quickAdjustForm = ref({ input_box: 0, input_each: 0, valuation_rate: 0 })
const isAdjusting = ref(false)
const pendingCartAction = ref(null)

const userKey = authStore.user?.member_name || 'default_user'
const singleStorageKey = `wms_quick_pick_slots_${userKey}`
const gridStorageKey = `wms_grid_quick_pick_slots_${userKey}`
const customerStorageKey = `wms_customer_quick_pick_slots_${userKey}`
const supplierStorageKey = `wms_supplier_quick_pick_slots_${userKey}`
const targetStorageKey = `wms_target_quick_pick_slots_${userKey}`

const quickPickSlotNames = ref(JSON.parse(localStorage.getItem(singleStorageKey)) || new Array(8).fill(null))
const gridPickSlotNames = ref(JSON.parse(localStorage.getItem(gridStorageKey)) || new Array(8).fill(null))
const customerPickSlotNames = ref(JSON.parse(localStorage.getItem(customerStorageKey)) || new Array(8).fill(null))
const supplierPickSlotNames = ref(JSON.parse(localStorage.getItem(supplierStorageKey)) || new Array(8).fill(null))
const targetPickSlotNames = ref(JSON.parse(localStorage.getItem(targetStorageKey)) || new Array(8).fill(null))

const activePartnerPickSlotNames = computed(() => {
  if (transactionMode.value === 'inbound') return supplierPickSlotNames.value
  if (transactionMode.value === 'transfer') return targetPickSlotNames.value
  return customerPickSlotNames.value
})

const quickPickSlots = computed(() => {
  return quickPickSlotNames.value.map(name => {
    if (!name) return null;
    return rawSingleItems.value.find(i => i.name === name) || null;
  })
})

const gridPickSlots = computed(() => {
  return gridPickSlotNames.value.map(id => {
    if (!id) return null;
    return gridHotkeys.value.find(g => g.id === id) || null;
  })
})

const activePartnerPickSlots = computed(() => {
  return activePartnerPickSlotNames.value.map(name => {
    if (!name) return null;
    if (transactionMode.value === 'inbound') return supplierList.value.find(s => s.name === name) || null;
    if (transactionMode.value === 'transfer') return branchList.value.find(w => w.name === name) || null;
    return customerList.value.find(c => c.name === name) || null;
  })
})

const binDataMap = computed(() => {
  const map = {};
  binData.value.forEach(bin => {
    if (!map[bin.item_code]) map[bin.item_code] = {};
    if (!map[bin.item_code][bin.warehouse]) map[bin.item_code][bin.warehouse] = 0;
    map[bin.item_code][bin.warehouse] += (Number(bin.actual_qty) || 0);
  });
  return map;
});

// 재고 현황 계산 (binDataMap O(1) 조회 — 검색 드롭다운 병목 제거)
const getAvailableStock = (itemCode, targetWarehouse = null) => {
  const warehouse = targetWarehouse || (transactionMode.value === 'inbound' 
    ? currentTab.value?.selectedTarget 
    : currentTab.value?.selectedSource);

  let totalActual = 0;
  const itemBins = binDataMap.value[itemCode];
  if (itemBins) {
    if (warehouse) {
      const targetUpper = String(warehouse).toUpperCase();
      for (const wh in itemBins) {
        if (wh.toUpperCase() === targetUpper || wh.toUpperCase().includes(targetUpper) || targetUpper.includes(wh.toUpperCase())) {
          totalActual += Number(itemBins[wh]) || 0;
        }
      }
    } else {
      for (const wh in itemBins) {
        totalActual += Number(itemBins[wh]) || 0;
      }
    }
  }

  let totalReserved = 0;
  if (warehouse) {
    const targetUpper = String(warehouse).toUpperCase();
    for (const wh in pendingReservedMap.value) {
      if (wh.toUpperCase() === targetUpper || wh.toUpperCase().includes(targetUpper) || targetUpper.includes(wh.toUpperCase())) {
        totalReserved += pendingReservedMap.value[wh][itemCode] || 0;
      }
    }
  } else {
    for (const wh in pendingReservedMap.value) {
      totalReserved += pendingReservedMap.value[wh][itemCode] || 0;
    }
  }

  return totalActual - totalReserved;
}

const getFormattedStockFor = (item) => {
  if (!item) return '';
  const availableQty = getAvailableStock(item.name);
  
  const packQty = item.custom_pack_qty || 1;
  const boxes = Math.floor(availableQty / packQty);
  const eaches = availableQty % packQty;
  
  return `📦 ${boxes} ${t('pos.unit_box')} / ${eaches} ${t('pos.unit_ea')}`;
}

const isSlotEditModalOpen = ref(false)
const editSlotIndex = ref(-1)
const slotSearchQuery = ref('')

/** FlexSearch는 충분히 찾고, 화면에는 50개씩만 렌더 (결과 더보기) */
const MAIN_SEARCH_MATCH_CAP = 2000
const mainSearchHits = computed(() => {
  if (!searchQuery.value.trim()) return []
  const hits = searchItems(searchQuery.value, { limit: MAIN_SEARCH_MATCH_CAP })
  return rankItemNameMatches(hits, searchQuery.value)
})
const {
  visible: filteredMainSearchItems,
  hasMore: mainSearchHasMore,
  remaining: mainSearchRemaining,
  loadMore: loadMoreMainSearch,
  reset: resetMainSearchPage
} = usePagedList(mainSearchHits, 50)

watch(searchQuery, () => resetMainSearchPage())

let searchDropdownBlurTimer = null
const openSearchDropdown = () => {
  if (searchDropdownBlurTimer) {
    clearTimeout(searchDropdownBlurTimer)
    searchDropdownBlurTimer = null
  }
  isSearchDropdownOpen.value = true
}
const closeSearchDropdown = () => {
  searchDropdownBlurTimer = setTimeout(() => {
    isSearchDropdownOpen.value = false
  }, 150)
}

const selectSearchItem = (item) => {
  addSingleHotkeyToCart(item)
  searchQuery.value = ''
  isSearchDropdownOpen.value = false
  resetMainSearchPage()
}

const handleBarcodeScan = () => {
  const code = barcodeQuery.value.trim()
  if (!code) return
  
  let foundQty = null
  const codeLower = code.toLowerCase()

  const item = rawSingleItems.value.find(i => {
    if (i.custom_tier_1_barcode && i.custom_tier_1_barcode.toLowerCase() === codeLower) { foundQty = i.custom_tier_1_qty || 1; return true }
    if (i.custom_tier_2_barcode && i.custom_tier_2_barcode.toLowerCase() === codeLower) { foundQty = i.custom_tier_2_qty || 12; return true }
    if (i.custom_tier_3_barcode && i.custom_tier_3_barcode.toLowerCase() === codeLower) { foundQty = i.custom_tier_3_qty || 100; return true }
    if (i.custom_tier_4_barcode && i.custom_tier_4_barcode.toLowerCase() === codeLower) { foundQty = i.custom_tier_4_qty || 300; return true }
    if (i.name.toLowerCase() === codeLower || (i.custom_name_number && String(i.custom_name_number).toLowerCase() === codeLower)) {
      foundQty = null
      return true
    }
    return false
  })

  if (item) {
    addSingleHotkeyToCart(item, foundQty)
  } else {
    alert(t('pos.msg_err_barcode', { code: code }))
  }
  barcodeQuery.value = ''
}

const filteredSlotItems = computed(() => searchItemsOrAll(slotSearchQuery.value, { limit: 100, allLimit: 300 }))

const openSlotEdit = (idx) => {
  editSlotIndex.value = idx
  slotSearchQuery.value = ''
  isSlotEditModalOpen.value = true
}

const assignSlotItem = (item) => {
  const newArr = [...quickPickSlotNames.value]
  newArr[editSlotIndex.value] = item.name
  quickPickSlotNames.value = newArr
  localStorage.setItem(singleStorageKey, JSON.stringify(newArr))
  isSlotEditModalOpen.value = false
}

const clearSlot = () => {
  const newArr = [...quickPickSlotNames.value]
  newArr[editSlotIndex.value] = null
  quickPickSlotNames.value = newArr
  localStorage.setItem(singleStorageKey, JSON.stringify(newArr))
  isSlotEditModalOpen.value = false
}

const isGridSlotEditModalOpen = ref(false)
const editGridSlotIndex = ref(-1)
const gridSlotSearchQuery = ref('')

const filteredGridSlotItems = computed(() => searchGridsOrAll(gridSlotSearchQuery.value, { limit: 100, allLimit: 300 }))

const openGridSlotEdit = (idx) => {
  editGridSlotIndex.value = idx
  gridSlotSearchQuery.value = ''
  isGridSlotEditModalOpen.value = true
}

const assignGridSlotItem = (group) => {
  const newArr = [...gridPickSlotNames.value]
  newArr[editGridSlotIndex.value] = group.id
  gridPickSlotNames.value = newArr
  localStorage.setItem(gridStorageKey, JSON.stringify(newArr))
  isGridSlotEditModalOpen.value = false
}

const clearGridSlot = () => {
  const newArr = [...gridPickSlotNames.value]
  newArr[editGridSlotIndex.value] = null
  gridPickSlotNames.value = newArr
  localStorage.setItem(gridStorageKey, JSON.stringify(newArr))
  isGridSlotEditModalOpen.value = false
}

// 동적 파트너 슬롯 모달 관리
const isPartnerSlotEditModalOpen = ref(false)
const editPartnerSlotIndex = ref(-1)
const partnerSlotSearchQuery = ref('')

const filteredPartnerSlotItems = computed(() => {
  const currentAssigned = new Set(activePartnerPickSlotNames.value.filter(n => n !== null))
  const q = partnerSlotSearchQuery.value.toLowerCase()
  
  let targetList = []
  if (transactionMode.value === 'outbound') {
    targetList = customerList.value
  } else if (transactionMode.value === 'inbound') {
    targetList = supplierList.value
  } else if (transactionMode.value === 'transfer') {
    targetList = branchList.value
  }
  
  return targetList.filter(item => {
    if (currentAssigned.has(item.name)) return false
    const nameStr = (item.customer_name || item.supplier_name || item.warehouse_name || item.name || '').toLowerCase()
    const idStr = (item.name || '').toLowerCase()
    return nameStr.includes(q) || idStr.includes(q)
  }).slice(0, 50)
})

const openPartnerSlotEdit = (idx) => {
  editPartnerSlotIndex.value = idx
  partnerSlotSearchQuery.value = ''
  isPartnerSlotEditModalOpen.value = true
}

const assignPartnerToSlot = (ptn) => {
  const newArr = [...activePartnerPickSlotNames.value]
  newArr[editPartnerSlotIndex.value] = ptn.name
  
  if (transactionMode.value === 'inbound') {
    supplierPickSlotNames.value = newArr
    localStorage.setItem(supplierStorageKey, JSON.stringify(newArr))
  } else if (transactionMode.value === 'transfer') {
    targetPickSlotNames.value = newArr
    localStorage.setItem(targetStorageKey, JSON.stringify(newArr))
  } else {
    customerPickSlotNames.value = newArr
    localStorage.setItem(customerStorageKey, JSON.stringify(newArr))
  }
  
  isPartnerSlotEditModalOpen.value = false
}

const clearPartnerSlot = () => {
  const newArr = [...activePartnerPickSlotNames.value]
  newArr[editPartnerSlotIndex.value] = null
  
  if (transactionMode.value === 'inbound') {
    supplierPickSlotNames.value = newArr
    localStorage.setItem(supplierStorageKey, JSON.stringify(newArr))
  } else if (transactionMode.value === 'transfer') {
    targetPickSlotNames.value = newArr
    localStorage.setItem(targetStorageKey, JSON.stringify(newArr))
  } else {
    customerPickSlotNames.value = newArr
    localStorage.setItem(customerStorageKey, JSON.stringify(newArr))
  }
  
  isPartnerSlotEditModalOpen.value = false
}

const selectPartner = (ptn) => {
  if (currentTab.value) {
    if (transactionMode.value === 'inbound') {
      currentTab.value.selectedSupplier = ptn.name
    } else if (transactionMode.value === 'transfer') {
      currentTab.value.selectedTarget = ptn.name
    } else {
      currentTab.value.selectedCustomer = ptn.name
    }
  }
}


// 고객 마스터 입력칸 자동완성 로직
const isCustomerDropdownOpen = ref(false)

const filteredCustomerSearchItems = computed(() => {
  if (!currentTab.value) return []
  const q = (currentTab.value.selectedCustomer || '').toLowerCase()
  if (!q) return customerList.value.slice(0, 50)
  
  return customerList.value.filter(cust => 
    (cust.name && cust.name.toLowerCase().includes(q)) ||
    (cust.customer_name && cust.customer_name.toLowerCase().includes(q))
  ).slice(0, 50)
})

const selectCustomerFromDropdown = (custName) => {
  if (currentTab.value) {
    currentTab.value.selectedCustomer = custName
  }
  isCustomerDropdownOpen.value = false
}

const closeCustomerDropdown = () => {
  setTimeout(() => {
    isCustomerDropdownOpen.value = false
  }, 150)
}

// 🌟 퀵 추가 모달 성공 핸들러 🌟
const handleItemSuccess = (newItem) => {
  // rawSingleItems 맨 앞에 추가 + FlexSearch 인덱스 즉시 반영
  rawSingleItems.value.unshift(newItem)
  addOrUpdateItem(newItem)

  // 성공적으로 만들었으면 즉시 장바구니에 0개로 담기
  addSingleHotkeyToCart(newItem)
  isQuickItemModalOpen.value = false
}

const handleCustomerSuccess = (newCustomer) => {
  customerList.value.push(newCustomer)
  if (currentTab.value) {
    currentTab.value.selectedCustomer = newCustomer.name
  }
  isQuickCustomerModalOpen.value = false
}

const handleSalesPersonSuccess = (newSp) => {
  salesPersonList.value.push(newSp)
  if (currentTab.value) {
    currentTab.value.selectedResponder = newSp.name
  }
  isQuickSalesPersonModalOpen.value = false
}

const handleSalesPersonChange = () => {
  if (currentTab.value && currentTab.value.selectedResponder === 'ADD_NEW') {
    isQuickSalesPersonModalOpen.value = true
    currentTab.value.selectedResponder = '' // 선택 초기화
  }
}

// Frappe API 호출 로직 (컴포넌트 로드 시 자동 실행)
const pollReservations = async () => {
  try {
    const [reqRes, reqDraftRes, seDraftRes, binRes] = await Promise.all([
      frappeApi.get('/api/resource/Material Request', {
        params: {
          fields: JSON.stringify(['name', 'modified']),
          filters: JSON.stringify([['docstatus', '=', 1], ['status', 'in', ['Pending', 'Draft', 'Partially Ordered', 'Partially Issued', 'Partially Received', 'Partial']]]),
          limit_page_length: 0
        }
      }).catch(() => ({ data: { data: [] } })),
      frappeApi.get('/api/resource/Material Request', {
        params: {
          fields: JSON.stringify(['name', 'modified']),
          filters: JSON.stringify([['docstatus', '=', 0], stageFilter(APPROVAL_STAGE.MANAGER_APPROVAL)]),
          limit_page_length: 0
        }
      }).catch(() => ({ data: { data: [] } })),
      frappeApi.get('/api/resource/Stock Entry', {
        params: {
          fields: JSON.stringify(['name', 'to_warehouse']),
          filters: JSON.stringify([['docstatus', '=', 0], ['purpose', '=', 'Material Transfer']]),
          limit_page_length: 0
        }
      }).catch(() => ({ data: { data: [] } })),
      frappeApi.get('/api/resource/Bin', {
        params: {
          fields: JSON.stringify(['item_code', 'actual_qty', 'warehouse']),
          limit_page_length: 0
        }
      }).catch(() => ({ data: { data: [] } }))
    ]);

    const reqList1 = (reqRes.data?.data || []).map(r => ({...r, _docstatus: 1}));
    const reqList2 = (reqDraftRes.data?.data || []).map(r => ({...r, _docstatus: 0}));
    const seList = seDraftRes.data?.data || [];
    const reqList = [...reqList1, ...reqList2];
    
    incompleteTransferStockEntryCount.value = seList.length;

    let currentBranchResCount = 0;
    if (authStore.user?.branch_name) {
       currentBranchResCount += seList.filter(se => se.to_warehouse === authStore.user.branch_name).length;
    }

    if (reqList.length > 0) {
      if (!window.mrDetailsCache) window.mrDetailsCache = {};
      const mrDetailsPromises = reqList.map(req => {
        if (window.mrDetailsCache[req.name] && window.mrDetailsCache[req.name].modified === req.modified) {
          return Promise.resolve({ data: { data: window.mrDetailsCache[req.name], _cached: true } })
        }
        return frappeApi.get(`/api/resource/Material Request/${req.name}`).catch(() => null)
      });
      const mrDetailsRes = (await Promise.all(mrDetailsPromises)).filter(Boolean);
      
      const reservedMap = {};
      let outboundResCount = 0;
      let transferResCount = 0;

      mrDetailsRes.forEach(res => {
         const doc = res.data.data;
         if (!res.data._cached) window.mrDetailsCache[doc.name] = doc;
         if (doc.material_request_type === 'Material Issue') outboundResCount++;
         else if (doc.material_request_type === 'Material Transfer') {
             transferResCount++;
             if (authStore.user?.branch_name && (doc.set_warehouse === authStore.user.branch_name || doc.custom_ordering_branch === authStore.user.branch_name)) {
                 currentBranchResCount++;
             }
         }

         let sourceWh = null;
         if (doc.material_request_type === 'Material Issue') {
           sourceWh = doc.set_warehouse;
         } else if (doc.material_request_type === 'Material Transfer') {
           sourceWh = doc.set_from_warehouse;
         }
           
         if (!sourceWh) return;

         if (!reservedMap[sourceWh]) reservedMap[sourceWh] = {};

         doc.items.forEach(item => {
            const fulfilledQty = Number(item.ordered_qty || item.received_qty || item.issued_qty || 0);
            const rem = item.qty - fulfilledQty;
            if (rem > 0) {
               let itemWh = sourceWh;
               if (doc.material_request_type === 'Material Issue') {
                 itemWh = item.warehouse || sourceWh;
               } else if (doc.material_request_type === 'Material Transfer') {
                 itemWh = item.s_warehouse || item.from_warehouse || sourceWh;
               }

               if (!reservedMap[itemWh]) reservedMap[itemWh] = {};
               reservedMap[itemWh][item.item_code] = (reservedMap[itemWh][item.item_code] || 0) + rem;
            }
         });
      });

      incompleteReservationCount.value = outboundResCount;
      incompleteTransferReservationCount.value = transferResCount;
      branchReservationCount.value = currentBranchResCount;
      pendingReservedMap.value = reservedMap;
    } else {
      incompleteReservationCount.value = 0;
      incompleteTransferReservationCount.value = 0;
      branchReservationCount.value = currentBranchResCount;
      pendingReservedMap.value = {};
    }

    // 🌟 10초마다 실제 가용재고(Bin)도 동기화하여 지점 화면 자동 갱신
    if (binRes && binRes.data && binRes.data.data) {
      binData.value = binRes.data.data || [];
    }

  } catch (error) {
    console.error('Badge polling error:', error);
  }
}

const fetchFrappeItems = async () => {
  try {
    // 본사 단가표 + 지점 전용 단가표 후보(창고 Full Name / 짧은 이름 모두)를 조회 대상으로 한다
    const posPriceListTargets = ['Standard Selling', ...branchPriceListCandidates(authStore.user?.branch_name)]
    // 1. 다중 API 병렬 호출 (창고, 품목, 재고, 고객, 영업사원, 공급업체, 판매단가)
    const [whRes, itemRes, binRes, custRes, spRes, supRes, priceRes] = await Promise.all([
      frappeApi.get('/api/resource/Warehouse', {
        params: { 
          fields: JSON.stringify(['name', 'warehouse_name', 'parent_warehouse']),
          filters: JSON.stringify([['disabled', '=', 0]])
        }
      }),
      frappeApi.get('/api/resource/Item', {
        params: {
          fields: JSON.stringify([
            'name', 'item_name', 'item_group', 
            'custom_color', 'custom_pack_qty',
            'custom_is_grid_item', 'custom_grid_group_id', 'custom_name_number',
            'valuation_rate',
            'custom_tier_1_barcode', 'custom_tier_1_qty',
            'custom_tier_2_barcode', 'custom_tier_2_qty',
            'custom_tier_3_barcode', 'custom_tier_3_qty',
            'custom_tier_4_barcode', 'custom_tier_4_qty'
          ]),
          limit_page_length: 0
        }
      }),
      frappeApi.get('/api/resource/Bin', {
        params: {
          fields: JSON.stringify(['item_code', 'actual_qty', 'warehouse']),
          limit_page_length: 0 // 전체 재고 로드
        }
      }).catch(() => ({ data: { data: [] } })),
      frappeApi.get('/api/resource/Customer', {
        params: {
          fields: JSON.stringify(['name', 'customer_name']),
          filters: JSON.stringify([['disabled', '=', 0]]),
          limit_page_length: 0
        }
      }).catch(() => ({ data: { data: [] } })),
      frappeApi.get('/api/resource/Sales Person', {
        params: {
          fields: JSON.stringify(['name', 'sales_person_name', 'enabled', 'custom_branch']),
          filters: JSON.stringify([['enabled', '=', 1]]),
          limit_page_length: 0
        }
      }).catch(() => ({ data: { data: [] } })),
      frappeApi.get('/api/resource/Supplier', {
        params: {
          fields: JSON.stringify(['name', 'supplier_name']),
          limit_page_length: 0
        }
      }).catch(() => ({ data: { data: [] } })),
      frappeApi.get('/api/resource/Item Price', {
        params: {
          fields: JSON.stringify([
            'item_code', 'price_list', 'price_list_rate',
            'custom_tier_2_price', 'custom_tier_3_price', 'custom_tier_4_price'
          ]),
          // 본사(Standard Selling) + 로그인 지점 전용 단가표(예: Standard Selling - K3)를 함께 조회
          filters: JSON.stringify([['price_list', 'in', posPriceListTargets]]),
          limit_page_length: 0
        }
      }).catch((e) => {
        // 여기서 조용히 삼키면 단가가 전부 0/원가로 보여도 원인을 알 수 없다.
        // 특히 fields 에 백엔드에 없는 컬럼이 섞이면 목록 전체가 417 로 거부된다.
        console.error('Item Price 조회 실패:', e?.response?.status, e?.response?.data?.exception || e)
        return { data: { data: [] } }
      })
    ]);

    warehouseList.value = whRes.data.data
    binData.value = binRes.data.data || []
    customerList.value = custRes.data.data || []
    salesPersonList.value = spRes.data.data || []
    supplierList.value = supRes.data.data || []

    const priceList = priceRes.data.data || []
    const branchPriceLists = branchPriceListCandidates(authStore.user?.branch_name)
    const priceMap = {}
    priceList.forEach(p => {
      if (!p.item_code) return
      const isBranchPrice = branchPriceLists.includes(p.price_list)
      // 지점 전용 단가표가 본사(Standard Selling)보다 항상 우선한다
      if (!priceMap[p.item_code] || isBranchPrice) {
        priceMap[p.item_code] = {
          price_list_rate: Number(p.price_list_rate || 0),
          custom_tier_2_price: Number(p.custom_tier_2_price || 0),
          custom_tier_3_price: Number(p.custom_tier_3_price || 0),
          custom_tier_4_price: Number(p.custom_tier_4_price || 0)
        }
      }
    })
    
    await pollReservations()
    

    // 3. 단일 품목(Single)과 묶음 품목(Grid) 자동 분류 로직
    const fetchedItems = itemRes.data.data;
    const groupedByName = {};
    
    fetchedItems.forEach(item => {
      // 1순위: 명시된 그룹 ID, 2순위: 품목명
      const groupId = item.custom_grid_group_id || item.item_name || t('pos.unclassified');
      
      if (!groupedByName[groupId]) {
        groupedByName[groupId] = {
          id: groupId,
          group_name: item.item_name || groupId,
          pack_qty: item.custom_pack_qty || 1, // 그룹 대표 패킹 수량
          is_explicit_grid: item.custom_is_grid_item === 1,
          variants: []
        };
      } else {
        // 이미 그룹이 존재하면 명시적 그리드 설정이 하나라도 1인지 체크
        if (item.custom_is_grid_item === 1) {
          groupedByName[groupId].is_explicit_grid = true;
        }
      }
      
      const itemPrice = priceMap[item.name]
      groupedByName[groupId].variants.push({
        ...item,
        price_list_rate: itemPrice ? itemPrice.price_list_rate : Number(item.valuation_rate || 0),
        custom_tier_2_price: itemPrice ? itemPrice.custom_tier_2_price : 0,
        custom_tier_3_price: itemPrice ? itemPrice.custom_tier_3_price : 0,
        custom_tier_4_price: itemPrice ? itemPrice.custom_tier_4_price : 0,
        input_box: 0,
        input_each: 0
      });
    });

    const newSingles = [];
    const newGrids = [];

    Object.values(groupedByName).forEach(group => {
      // 명시적으로 그리드라고 체크되어 있거나, 혹은 같은 품목명의 컬러 변형이 2개 이상이면 그리드로 자동 분류
      if (group.is_explicit_grid || group.variants.length > 1) {
        newGrids.push(group);
      } 
      // 🌟 단일 핫키 지정이나 바코드 스캔, 메인 검색에서 모든 개별 품목이 잡히도록 전부 넣어줍니다!
      group.variants.forEach(v => {
        newSingles.push(v);
      });
    });

    rawSingleItems.value = newSingles;
    gridHotkeys.value = newGrids;
    rebuildItemIndex(newSingles);
    rebuildGridIndex(newGrids);

    // 만약 로컬스토리지 슬롯이 전부 비어있다면, 초기값으로 상위 8개를 자동 배정해줍니다
    const hasAnySlot = quickPickSlotNames.value.some(name => name !== null)
    if (!hasAnySlot) {
      for (let i = 0; i < 8 && i < newSingles.length; i++) {
        quickPickSlotNames.value[i] = newSingles[i].name
      }
      localStorage.setItem(singleStorageKey, JSON.stringify(quickPickSlotNames.value))
    }
    
    // 그리드 슬롯도 동일하게 초기 자동 배정
    const hasAnyGridSlot = gridPickSlotNames.value.some(id => id !== null)
    if (!hasAnyGridSlot) {
      for (let i = 0; i < 8 && i < newGrids.length; i++) {
        gridPickSlotNames.value[i] = newGrids[i].id
      }
      localStorage.setItem(gridStorageKey, JSON.stringify(gridPickSlotNames.value))
    }
    
  } catch (error) {
    console.error('Frappe 마스터 데이터 로드 실패:', error)
    const status = error.response?.status
    // 401만 세션 만료. 403은 권한 문제 — 강제 로그아웃하면 관리자가 오인 튕김
    if (status === 401) {
      alert(t('pos.msg_err_session'))
      await authStore.logout()
      await router.replace('/login')
    } else if (status === 403) {
      alert(t('pos.msg_err_permission'))
    }
  }
}

let pollInterval = null

onMounted(() => {
  if (route.query.nav) {
    activeNav.value = route.query.nav
  }
  fetchFrappeItems()
  pollInterval = setInterval(pollReservations, 10000) // 10초마다 뱃지 갱신
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

const setTransactionMode = (mode) => {
  transactionMode.value = mode
}

const onBranchPinUnlock = () => {
  if (branchSession.unlockWithPin()) {
    // stay on current nav; manager menus appear
  }
}

watch(
  () => branchSession.mode,
  (mode) => {
    if (
      mode === 'clerk' &&
      !isAdmin.value &&
      activeNav.value !== 'branch-pos'
    ) {
      activeNav.value = 'branch-pos'
    }
  }
)

const setActiveNav = (nav, mode = null) => {
  if (
    !isAdmin.value &&
    branchSession.needsPinGate &&
    branchSession.isClerkMode &&
    nav !== 'branch-pos'
  ) {
    alert(t('pos.msg_err_clerk_mode'))
    branchSession.openPinModal()
    return
  }

  const cartTab = pcCartRef.value?.currentTab
  if (cartTab && (cartTab.activeReservationId || cartTab.amendingStockEntry)) {
    const isEntryView = activeNav.value === 'outbound' || activeNav.value === 'inbound' || activeNav.value === 'transfer' || activeNav.value === 'branch-transfer'
    if (isEntryView) {
      if (!confirm(t('pos.msg_cfm_cancel_edit'))) {
        return
      }
      cartTab.activeReservationId = null
      cartTab.amendingStockEntry = null
      cartTab.amendSourceNav = null
      cartTab.cartItems = []
      cartTab.selectedCustomer = ''
      cartTab.selectedResponder = ''
      cartTab.selectedRequester = authStore.user?.member_name || ''
      cartTab.selectedSource = ''
      cartTab.selectedTarget = ''
    }
  }
  
  activeNav.value = nav
  if (mode) {
    setTransactionMode(mode)
  }
}

// 지점 전용 예약 수정 연동 함수
const editingBranchDraftName = ref(null)

const handleBranchEditReservation = (reservationName) => {
  editingBranchDraftName.value = reservationName
  setActiveNav('branch-transfer')
  // Watcher in BranchTransferView will catch this and load the draft.
  // We reset it immediately so that clicking the same draft again triggers the watcher again.
  setTimeout(() => { editingBranchDraftName.value = null }, 500)
}

// 🌟 탭 리스트 및 활성 탭 (모드별 독립 캐시 지원)
const tabList = ref([
  { 
    id: 'outbound_1', 
    mode: 'outbound',
    title: t('pos.msg_tab_outbound') + ' 1',
    selectedSource: '',
    selectedTarget: '',
    selectedCustomer: '',
    selectedSupplier: '',
    selectedCreator: authStore.user?.member_name || authStore.user?.full_name || '',
    selectedBranch: authStore.user?.branch_name || '',
    selectedResponder: '',
    selectedRequester: authStore.user?.member_name || '',
    cartItems: []
  },
  { 
    id: 'inbound_1', 
    mode: 'inbound',
    title: t('pos.msg_tab_inbound') + ' 1',
    selectedSource: '',
    selectedTarget: '',
    selectedCustomer: '',
    selectedSupplier: '',
    selectedCreator: authStore.user?.member_name || authStore.user?.full_name || '',
    selectedBranch: authStore.user?.branch_name || '',
    selectedResponder: '',
    selectedRequester: authStore.user?.member_name || '',
    cartItems: []
  },
  { 
    id: 'transfer_1', 
    mode: 'transfer',
    title: t('pos.msg_tab_transfer') + ' 1',
    selectedSource: '',
    selectedTarget: '',
    selectedCustomer: '',
    selectedSupplier: '',
    selectedCreator: authStore.user?.member_name || authStore.user?.full_name || '',
    selectedBranch: authStore.user?.branch_name || '',
    selectedResponder: '',
    selectedRequester: authStore.user?.member_name || '',
    cartItems: []
  }
])

// 🌟 각 트랜잭션 모드별 현재 활성화된 탭 ID를 추적
const activeTabIds = ref({
  outbound: 'outbound_1',
  inbound: 'inbound_1',
  transfer: 'transfer_1'
})

// 🌟 현재 선택된 트랜잭션 모드에 맞는 활성 탭을 동적으로 계산
const currentTab = computed(() => {
  const currentMode = transactionMode.value;
  return tabList.value.find(t => t.id === activeTabIds.value[currentMode]);
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

// 🌟 헤더(마스터 정보)가 모두 입력되었는지 확인하는 Computed (Gate)
const isHeaderComplete = computed(() => {
  if (!currentTab.value) return false;
  if (transactionMode.value === 'transfer') {
    return !!currentTab.value.selectedSource && !!currentTab.value.selectedTarget && !!currentTab.value.selectedResponder;
  }
  if (transactionMode.value === 'outbound') {
    return !!currentTab.value.selectedSource && !!currentTab.value.selectedBranch && !!currentTab.value.selectedCustomer && !!currentTab.value.selectedResponder;
  }
  if (transactionMode.value === 'inbound') {
    return !!currentTab.value.selectedSupplier && !!currentTab.value.selectedBranch && !!currentTab.value.selectedTarget && !!currentTab.value.selectedResponder;
  }
  return true;
})

// 🌟 현재 선택된 트랜잭션 모드에 해당하는 탭들만 필터링
const modeTabs = computed(() => {
  return tabList.value.filter(t => t.mode === transactionMode.value);
})

const addNewTab = () => {
  const currentMode = transactionMode.value;
  const currentModeTabs = modeTabs.value;
  const nextNum = Math.max(...currentModeTabs.map(t => parseInt(t.id.split('_')[1]) || 1), 0) + 1;
  const newId = `${currentMode}_${nextNum}`;
  const modeTitle = currentMode === 'outbound' ? t('pos.msg_tab_outbound') : currentMode === 'inbound' ? t('pos.msg_tab_inbound') : t('pos.msg_tab_transfer');
  
  tabList.value.push({ 
    id: newId, 
    mode: currentMode,
    title: `${modeTitle} ${nextNum}`,
    selectedSource: currentTab.value?.selectedSource || '',
    selectedTarget: currentTab.value?.selectedTarget || '',
    selectedCustomer: currentTab.value?.selectedCustomer || '',
    selectedSupplier: currentTab.value?.selectedSupplier || '',
    selectedCreator: authStore.user?.member_name || authStore.user?.full_name || '',
    selectedBranch: authStore.user?.branch_name || '',
    selectedResponder: '',
    selectedRequester: authStore.user?.member_name || '',
    cartItems: []
  })
  activeTabIds.value[currentMode] = newId;
}

const closeTab = (tabId) => {
  const currentMode = transactionMode.value;
  const currentModeTabs = modeTabs.value;
  const index = currentModeTabs.findIndex(t => t.id === tabId);
  
  if (index === -1) return;
  
  if (activeTabIds.value[currentMode] === tabId) {
    if (index > 0) activeTabIds.value[currentMode] = currentModeTabs[index - 1].id;
    else if (currentModeTabs.length > 1) activeTabIds.value[currentMode] = currentModeTabs[index + 1].id;
  }
  
  tabList.value = tabList.value.filter(t => t.id !== tabId);
}

const openInlineEdit = (type, target) => {
  alert(t('pos.msg_info_shortcut'));
}

// 🌟 Frappe 백엔드로 실제 전표(Stock Entry) 전송 로직
const samdori = ref(null)
const branchTransferRef = ref(null)
const mobileLayoutRef = ref(null)
/** 관리자 재고조회: 창고 미지정/미인식 시 품목을 기억하고 창고명만 재질문 */
const pendingVoiceStockItem = ref(null)
const MAIN_WAREHOUSE = '[MAIN] ALARCON - K'
const validItemCodes = computed(() => rawSingleItems.value.map(item => item.name))

const voiceWarehouseLabel = (warehouseName) => {
  if (!warehouseName) return locale.value === 'es' ? 'almacén' : '창고'
  if (/ALARCON/i.test(warehouseName)) return locale.value === 'es' ? 'Alarcón' : '알라르꼰'
  return warehouseName
}

const resolveVoiceWarehouse = (hint) => {
  if (!hint) return null
  const q = String(hint).toLowerCase().trim()
    .replace(/[.,!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!q) return null

  // 본사/알라르꼰 별칭 (STT 오인식 포함)
  if (/알라르꼰|알라르콘|알라르권|알라르고|알라르|알라콘|알라꼰|alarcon|alarcón|본사|메인|main|본부/.test(q)) {
    const main = warehouseList.value.find((w) => /ALARCON/i.test(w.name)) || { name: MAIN_WAREHOUSE }
    return main.name
  }

  // 까르멘 등 흔한 STT 변형
  const aliasHints = [
    { re: /carmen|까르멘|카르멘|까르맨|카르맨|까르면|카르면|까멘/, key: 'CARMEN' },
    { re: /tienda|티엔다|띠엔다/, key: 'TIENDA' },
    { re: /polanco|폴랑코|폴란코/, key: 'POLANCO' },
    { re: /insurgentes|인수르|인сур르/, key: 'INSURGENTES' },
    { re: /satelite|satélite|사텔|싸텔/, key: 'SATEL' },
    { re: /queretaro|querétaro|께레|케레/, key: 'QUERETARO' }
  ]
  for (const { re, key } of aliasHints) {
    if (re.test(q)) {
      const hit = warehouseList.value.find(
        (w) => w.name?.toUpperCase().includes(key) || w.warehouse_name?.toUpperCase().includes(key)
      )
      if (hit) return hit.name
    }
  }

  // warehouseList 부분 일치 (이름/표시명, 공백·대괄호 제거 후 비교)
  const norm = (s) => String(s || '').toLowerCase().replace(/[\[\]()-]/g, ' ').replace(/\s+/g, ' ').trim()
  const qn = norm(q)
  const found = warehouseList.value.find((b) => {
    const n = norm(b.name)
    const wn = norm(b.warehouse_name)
    return n === qn || wn === qn || n.includes(qn) || wn.includes(qn) || qn.includes(n) || qn.includes(wn)
  })
  return found?.name || null
}

/**
 * 음성 품번 → 단일 상품.
 * 후보가 2건 이상이면 임의로 확정하지 않고 candidates만 돌려준다(역질문용).
 */
const findProductForVoice = (itemCode) => {
  if (!itemCode) return { product: null, candidates: [] }
  const key = String(itemCode).trim()
  const upper = key.toUpperCase()
  const exact =
    rawSingleItems.value.find((i) => i.name === key) ||
    rawSingleItems.value.find((i) => i.name?.toUpperCase() === upper)
  if (exact) return { product: exact, candidates: [exact] }

  // Gemini가 P-160처럼 짧게 주면 변형 코드 중 유일할 때만 확정
  const prefixHits = rawSingleItems.value.filter(
    (i) => i.name?.toUpperCase() === upper || i.name?.toUpperCase().startsWith(`${upper}-`)
  )
  if (prefixHits.length === 1) return { product: prefixHits[0], candidates: prefixHits }
  if (prefixHits.length > 1) return { product: null, candidates: prefixHits }

  // 품명(item_name) 부분 일치 — 유일할 때만
  const nameHits = rawSingleItems.value.filter((i) =>
    (i.item_name || '').toLowerCase().includes(key.toLowerCase())
  )
  if (nameHits.length === 1) return { product: nameHits[0], candidates: nameHits }
  return { product: null, candidates: nameHits }
}

/** 음성 품번을 확정하지 못했을 때: 후보가 여러 개면 역질문, 없으면 미발견 안내 */
const speakVoiceItemUnresolved = (itemCode, candidates = []) => {
  if (!samdori.value) return
  const es = locale.value === 'es'
  if (candidates.length > 1) {
    const list = candidates.slice(0, 5).map((c) => c.name).join(', ')
    samdori.value.speak(
      es
        ? `Hay ${candidates.length} productos para ${itemCode}: ${list}. ¿Cuál agrego?`
        : `${itemCode} 관련 상품이 ${candidates.length}가지 있습니다. 예: ${list}. 어떤 상품을 담을까요?`
    )
    return
  }
  samdori.value.speak(es ? `No se encontró ${itemCode}.` : `${itemCode} 품목을 찾을 수 없습니다.`)
}

const resolveMobileLayout = async () => {
  // 폭 판별보다 실제 마운트된 모바일 레이아웃을 우선 (웹 모바일/PWA 오판 방지)
  for (let i = 0; i < 5; i++) {
    const layout = mobileLayoutRef.value
    if (layout?.addFromVoice) return layout
    await nextTick()
  }
  return mobileLayoutRef.value
}

const handleSamdoriIntent = async (intentObj) => {
  const { intent, item, qty } = intentObj || {}

  // 재고조회 외 명령이면 관리자 창고 대기 상태 해제
  if (intent && intent !== 'search') {
    pendingVoiceStockItem.value = null
  }

  const layout = await resolveMobileLayout()
  const useMobileCart = !!(isMobile.value || layout?.addFromVoice)

  // 모바일 UI/레이아웃이 있으면 데스크톱 장바구니로 절대 폴백하지 않음
  if (useMobileCart) {
    if (intent === 'add_order') {
      const { product: prod, candidates } = findProductForVoice(item)
      if (!prod) {
        speakVoiceItemUnresolved(item, candidates)
        return
      }
      if (prod.disabled === 1 || prod.disabled === true) {
        const msg = locale.value === 'es'
          ? `🚫 "${item}" está descontinuado (disabled=1). No se puede agregar.`
          : `🚫 "${item}" 품목은 단종(disabled=1) 처리되어 장바구니에 담을 수 없습니다.`
        if (samdori.value) samdori.value.speak(msg)
        return
      }
      if (!layout?.addFromVoice) {
        const msg =
          locale.value === 'es'
            ? 'No se pudo conectar con el carrito móvil.'
            : '모바일 장바구니에 연결하지 못했습니다. 즉시출고 탭인지 확인해 주세요.'
        if (samdori.value) samdori.value.speak(msg)
        return
      }

      const inputQty = qty ? Number(qty) : 1
      const result = await layout.addFromVoice(prod, inputQty)
      if (result && result.ok === false) {
        if (samdori.value) samdori.value.speak(result.message || '장바구니에 담지 못했습니다.')
        return
      }

      // 실제로 카트에 들어갔는지 재확인 후 성공 멘트
      const cartAfter = layout.getCartItems ? ((await layout.getCartItems()) || []) : []
      const added = cartAfter.some((c) => c.item_code === prod.name || c.item_code === item)
      if (!added) {
        const msg =
          locale.value === 'es'
            ? 'No se pudo agregar al carrito. Intente de nuevo.'
            : '장바구니 반영에 실패했습니다. 즉시출고 화면에서 다시 시도해 주세요.'
        if (samdori.value) samdori.value.speak(msg)
        return
      }

      const msg = locale.value === 'es' ? `${item} añadido al carrito.` : `${item} 장바구니에 담았습니다.`
      if (samdori.value) samdori.value.speak(msg)
      return
    }

    if (intent === 'check') {
      if (!layout?.getCartItems) {
        const msg =
          locale.value === 'es'
            ? 'No se pudo conectar con el carrito móvil.'
            : '모바일 장바구니에 연결하지 못했습니다. 즉시출고 탭인지 확인해 주세요.'
        if (samdori.value) samdori.value.speak(msg)
        return
      }
      if (layout.focusCart) await layout.focusCart()
      const cartItems = (await layout.getCartItems()) || []
      const count = cartItems.length
      if (count === 0) {
        const msg = locale.value === 'es' ? `El carrito está vacío.` : `현재 장바구니가 비어있습니다.`
        if (samdori.value) samdori.value.speak(msg)
        return
      }
      let msg = locale.value === 'es'
        ? `Hay ${count} productos en el carrito. `
        : `현재 장바구니에 ${count}종류의 상품이 있습니다. `
      const details = cartItems.map((cartItem) => {
        const code = cartItem.item_code || cartItem.name || ''
        const boxes = cartItem.boxQty || cartItem.input_box || 0
        const eaches = cartItem.eachQty || cartItem.input_each || 0
        if (locale.value === 'es') return `${code} ${boxes} cajas, ${eaches} sueltos`
        let str = code
        if (boxes > 0) str += ` ${boxes}박스`
        if (eaches > 0) str += ` ${eaches}개`
        return str
      })
      msg += details.join(', ') + (locale.value === 'es' ? '.' : ' 입니다.')
      if (samdori.value) samdori.value.speak(msg)
      return
    }

    if (intent === 'submit') {
      if (!layout?.submitTransfer) {
        const msg =
          locale.value === 'es'
            ? 'No se pudo enviar el pedido móvil.'
            : '모바일 전송에 연결하지 못했습니다.'
        if (samdori.value) samdori.value.speak(msg)
        return
      }
      const cartItems = layout.getCartItems ? ((await layout.getCartItems()) || []) : []
      if (!cartItems.length) {
        const msg = locale.value === 'es' ? `El carrito está vacío.` : `장바구니가 비어 있어 전송할 수 없습니다.`
        if (samdori.value) samdori.value.speak(msg)
        return
      }

      const startMsg =
        locale.value === 'es'
          ? `Enviando ${cartItems.length} productos a Frappe...`
          : `장바구니 ${cartItems.length}종을 Frappe로 전송합니다.`
      if (samdori.value) samdori.value.speak(startMsg)

      let result
      try {
        result = await layout.submitTransfer()
      } catch (e) {
        console.error(e)
        const msg =
          locale.value === 'es'
            ? 'Error al enviar el pedido.'
            : 'Frappe 전송 중 오류가 발생했습니다.'
        if (samdori.value) samdori.value.speak(msg)
        return
      }

      if (result && result.ok === false) {
        if (samdori.value) {
          samdori.value.speak(result.message || (locale.value === 'es' ? 'No se pudo enviar.' : '전송에 실패했습니다.'))
        }
        return
      }

      const doneMsg = locale.value === 'es'
        ? (result?.docName ? `Pedido enviado. Documento ${result.docName}.` : 'Pedido enviado correctamente.')
        : (result?.docName ? `전송 완료. 문서번호 ${result.docName} 입니다.` : 'Frappe 전송이 완료되었습니다.')
      if (samdori.value) samdori.value.speak(doneMsg)
      return
    }

    if (intent === 'search') {
      // 재고 조회는 모바일에서도 동일 로직 사용 (아래 공통 분기로)
    } else {
      return
    }
  }

  if (intent === 'add_order') {
    if (activeNav.value === 'branch-transfer' && branchTransferRef.value) {
      const { product: prod, candidates } = findProductForVoice(item)
      if (prod) {
        const inputQty = qty ? Number(qty) : 1
        for (let i = 0; i < inputQty; i++) {
          branchTransferRef.value.addFromVoice(prod)
        }
        const msg = locale.value === 'es' ? `${item} añadido al carrito.` : `${item} 장바구니에 담았습니다.`
        if (samdori.value) samdori.value.speak(msg)
      } else {
        speakVoiceItemUnresolved(item, candidates)
      }
      return
    }

    const { product: prod, candidates } = findProductForVoice(item)
    if (prod) {
      if (prod.disabled === 1 || prod.disabled === true) {
        const msg = locale.value === 'es'
          ? `🚫 "${item}" está descontinuado (disabled=1). No se puede agregar.`
          : `🚫 "${item}" 품목은 단종(disabled=1) 처리되어 장바구니에 담을 수 없습니다.`
        if (samdori.value) samdori.value.speak(msg)
        return
      }
      if (!['outbound', 'inbound', 'transfer'].includes(activeNav.value)) {
        activeNav.value = transactionMode.value || 'outbound'
        await nextTick()
      }
      const inputQty = qty ? Number(qty) : 1
      const result = pcCartRef.value?.addFromVoice?.(prod, inputQty)
      if (result && result.ok === false) {
        if (samdori.value) samdori.value.speak(result.message || (locale.value === 'es' ? 'No se pudo agregar.' : '장바구니에 담지 못했습니다.'))
        return
      }
      const msg = locale.value === 'es' ? `${item} añadido al carrito.` : `${item} 장바구니에 담았습니다.`
      if (samdori.value) samdori.value.speak(msg)
    } else {
      speakVoiceItemUnresolved(item, candidates)
    }
  } else if (intent === 'search') {
    // 관리자 창고 재질문 후: item이 비면 pending 품목 사용
    const stockItem = item || pendingVoiceStockItem.value
    let prods = stockItem
      ? rawSingleItems.value.filter((i) => i.name === stockItem)
      : []
    if (stockItem && prods.length === 0) {
      prods = rawSingleItems.value.filter(
        (i) => i.name.startsWith(stockItem + '-') || i.name.includes(stockItem)
      )
    }

    if (prods.length > 0) {
      const isDisabled = prods.some((p) => p.disabled === 1 || p.disabled === true)
      const disabledTag = isDisabled
        ? (locale.value === 'es' ? '[Descontinuado] ' : '[단종 품목] ')
        : ''
      const packQty = prods[0].custom_pack_qty || 1
      const stockBriefAt = (warehouse) => {
        let total = 0
        prods.forEach((prod) => {
          total += getAvailableStock(prod.name, warehouse)
        })
        const b = Math.floor(total / (packQty || 1))
        const r = total % (packQty || 1)
        if (locale.value === 'es') {
          return `${b} cajas${r > 0 ? ` (+${r} pcs)` : ''}`
        }
        return `${b}박스${r > 0 ? ` (잔여 ${r}개)` : ''}`
      }
      const speakStock = (text) => {
        if (samdori.value) samdori.value.speak(text)
      }
      const askWarehouseAgain = () => {
        pendingVoiceStockItem.value = stockItem
        speakStock(
          locale.value === 'es'
            ? `¿Qué almacén consulta para ${stockItem}? Digame el nombre, por ejemplo Alarcón o Carmen.`
            : `${stockItem} 재고를 어느 창고에서 확인할까요? 알라르꼰, 까르멘처럼 창고 이름을 다시 말씀해 주세요.`
        )
      }

      const branchWh = authStore.user?.branch_name || ''

      // 다이어트 모드: Gemini가 warehouse 대신 raw에 창고명을 넣거나, 후속 보정 힌트를 씀
      let warehouseHint =
        intentObj._warehouseHint || intentObj.warehouse || ''
      if (!resolveVoiceWarehouse(warehouseHint)) {
        const altHints = [
          intentObj._warehouseHint,
          intentObj.warehouse,
          intentObj.raw_spoken_item,
          intentObj.item
        ]
        for (const alt of altHints) {
          if (alt && resolveVoiceWarehouse(alt)) {
            warehouseHint = alt
            break
          }
        }
      }
      const resolvedWh = resolveVoiceWarehouse(warehouseHint)

      // ----- 관리자: 미지정 시 알라르꼰 본사 + 전체 재고 합계 폴백 안내 -----
      if (authStore.isAdmin) {
        if (!resolvedWh) {
          pendingVoiceStockItem.value = null
          speakStock(
            locale.value === 'es'
              ? `${disabledTag}${stockItem}: Alarcón ${stockBriefAt(MAIN_WAREHOUSE)}, total general ${stockBriefAt(null)}.`
              : `${disabledTag}${stockItem}: 알라르꼰 본사 ${stockBriefAt(MAIN_WAREHOUSE)}, 전체 합계 ${stockBriefAt(null)} 입니다.`
          )
          return
        }
        pendingVoiceStockItem.value = null
        speakStock(
          locale.value === 'es'
            ? `${disabledTag}${stockItem}: ${voiceWarehouseLabel(resolvedWh)} ${stockBriefAt(resolvedWh)}.`
            : `${disabledTag}${stockItem}: ${voiceWarehouseLabel(resolvedWh)} ${stockBriefAt(resolvedWh)} 입니다.`
        )
        return
      }

      // ----- 지점장/점원: 본인 지점 + 알라르꼰만 (타 지점 요청은 부드럽게 폴백) -----
      pendingVoiceStockItem.value = null
      const allowed = new Set([MAIN_WAREHOUSE, branchWh].filter(Boolean))

      if (warehouseHint) {
        if (resolvedWh && allowed.has(resolvedWh)) {
          speakStock(
            locale.value === 'es'
              ? `${disabledTag}${stockItem}: ${voiceWarehouseLabel(resolvedWh)} ${stockBriefAt(resolvedWh)}.`
              : `${disabledTag}${stockItem}: ${voiceWarehouseLabel(resolvedWh)} ${stockBriefAt(resolvedWh)} 입니다.`
          )
          return
        }
        // 타 지점/미인식 → 권한 안내 후 지점+본사 요약
        if (resolvedWh && !allowed.has(resolvedWh)) {
          speakStock(
            locale.value === 'es'
              ? `Solo puede consultar su sucursal y Alarcón. ${disabledTag}${stockItem}: sucursal ${stockBriefAt(branchWh)}, Alarcón ${stockBriefAt(MAIN_WAREHOUSE)}.`
              : `지점 계정은 본인 지점과 알라르꼰만 조회할 수 있습니다. ${disabledTag}${stockItem}: 지점 ${stockBriefAt(branchWh)}, 알라르꼰 ${stockBriefAt(MAIN_WAREHOUSE)} 입니다.`
          )
          return
        }
        if (!resolvedWh) {
          speakStock(
            locale.value === 'es'
              ? `No entendí el almacén. ${disabledTag}${stockItem}: sucursal ${stockBriefAt(branchWh)}, Alarcón ${stockBriefAt(MAIN_WAREHOUSE)}.`
              : `창고명을 이해하지 못해 기본으로 안내합니다. ${disabledTag}${stockItem}: 지점 ${stockBriefAt(branchWh)}, 알라르꼰 ${stockBriefAt(MAIN_WAREHOUSE)} 입니다.`
          )
          return
        }
      }

      // 창고 미지정: 지점 + 알라르꼰 박스+잔여개수 동시 안내
      if (branchWh && branchWh !== MAIN_WAREHOUSE) {
        speakStock(
          locale.value === 'es'
            ? `${disabledTag}${stockItem}: sucursal ${stockBriefAt(branchWh)}, Alarcón ${stockBriefAt(MAIN_WAREHOUSE)}.`
            : `${disabledTag}${stockItem}: 지점 ${stockBriefAt(branchWh)}, 알라르꼰 ${stockBriefAt(MAIN_WAREHOUSE)} 입니다.`
        )
      } else {
        speakStock(
          locale.value === 'es'
            ? `${disabledTag}${stockItem}: Alarcón ${stockBriefAt(MAIN_WAREHOUSE)}.`
            : `${disabledTag}${stockItem}: 알라르꼰 ${stockBriefAt(MAIN_WAREHOUSE)} 입니다.`
        )
      }
    } else {
      pendingVoiceStockItem.value = null
      const msg = locale.value === 'es' ? `No se encontró ${stockItem || item}.` : `창고에 ${stockItem || item} 관련 제품이 없습니다.`
      if (samdori.value) samdori.value.speak(msg)
    }
  } else if (intent === 'check') {
    pendingVoiceStockItem.value = null
    let cartItems = []
    if (activeNav.value === 'branch-transfer' && branchTransferRef.value) {
      cartItems = branchTransferRef.value.getCartItems()
    } else if (pcCartRef.value?.getCartItems) {
      cartItems = pcCartRef.value.getCartItems() || []
    }
    
    const count = cartItems.length
    if (count === 0) {
      const msg = locale.value === 'es' ? `El carrito está vacío.` : `현재 장바구니가 비어있습니다.`
      if (samdori.value) samdori.value.speak(msg)
    } else {
      let msg = locale.value === 'es' 
        ? `Hay ${count} productos en el carrito. ` 
        : `현재 장바구니에 ${count}종류의 상품이 있습니다. `
      
      const details = cartItems.map(item => {
        const code = item.item_code || item.name || ''
        const boxes = item.boxQty || item.input_box || 0
        const eaches = item.eachQty || item.input_each || 0
        if (locale.value === 'es') {
          return `${code} ${boxes} cajas, ${eaches} sueltos`
        } else {
          let str = code
          if (boxes > 0) str += ` ${boxes}박스`
          if (eaches > 0) str += ` ${eaches}개`
          return str
        }
      })
      
      msg += details.join(', ') + (locale.value === 'es' ? '.' : ' 입니다.')
      if (samdori.value) samdori.value.speak(msg)
    }
  } else if (intent === 'submit') {
    if (activeNav.value === 'branch-transfer' && branchTransferRef.value) {
      const msg = locale.value === 'es' ? `Enviando pedido de sucursal...` : `지점 발주서를 전송합니다.`
      if (samdori.value) samdori.value.speak(msg)
      branchTransferRef.value.submitTransfer()
      return;
    }

    const msg = locale.value === 'es' ? `Enviando pedido...` : `주문을 전송합니다.`
    if (samdori.value) samdori.value.speak(msg)
    if (!pcCartRef.value) {
      if (samdori.value) samdori.value.speak(locale.value === 'es' ? 'Abra la pantalla de entrada.' : '입출고 화면을 먼저 열어 주세요.')
      return
    }
    if (transactionMode.value === 'outbound' || transactionMode.value === 'transfer') {
      pcCartRef.value.submitToFrappe()
    } else {
      pcCartRef.value.submitReservation()
    }
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
  height: 100vh;
  margin: 0 auto;
  overflow: hidden;
  font-family: sans-serif;
  background: #f4f6f9;
  box-sizing: border-box;
}

.workspace-left { flex: 1.2; display: flex; flex-direction: column; overflow-y: auto; padding-right: 10px; }
.workspace-right { flex: 1.8; display: flex; flex-direction: column; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 2px solid #3b82f6; overflow: hidden; }

.search-section { margin-bottom: 20px; }
.search-bar { width: 100%; padding: 12px 15px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 14px; box-sizing: border-box; }

.dual-search { display: flex; gap: 10px; }
.search-box-wrapper, .barcode-box-wrapper { position: relative; flex: 1; display: flex; align-items: center; }
.search-icon { position: absolute; left: 12px; font-size: 16px; color: #94a3b8; pointer-events: none; }
.search-box-wrapper .search-bar, .barcode-box-wrapper .search-bar { padding-left: 36px; }
.barcode-bar { border-color: #3b82f6; background-color: #f0f9ff; }
.barcode-bar:focus { outline: 2px solid #3b82f6; }

.search-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #cbd5e1; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-height: 250px; overflow-y: auto; z-index: 100; list-style: none; padding: 0; }
.search-dropdown li { padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; }
.address-list li:hover {
  background: #f1f5f9;
}

.partial-close-modal {
  text-align: center;
  max-width: 400px;
}
.partial-close-modal h3 {
  color: #1e293b;
  margin-bottom: 1rem;
}
.partial-close-modal p {
  color: #475569;
  margin-bottom: 2rem;
  line-height: 1.5;
}
.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}
.btn-danger {
  background-color: #ef4444;
  color: white;
}
.btn-danger:hover {
  background-color: #dc2626;
}

.search-dropdown li:hover { background: #f8fafc; }
.search-dropdown li .item-name { font-weight: bold; color: #1e293b; }
.search-dropdown li .item-color { color: #64748b; font-size: 12px; }
.search-dropdown li .item-pack-qty { color: #94a3b8; font-size: 12px; font-weight: bold; margin-left: 4px; }
.search-item-stock { color: #0f766e; font-size: 12px; font-weight: bold; background: #f0fdfa; padding: 2px 6px; border-radius: 4px; }

.master-input-row { display: flex; gap: 15px; }
.master-select, .master-input { padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; min-width: 150px; background: white; }
.master-lock-group { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.master-lock-group label { font-size: 12px; font-weight: bold; color: #475569; }

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
.nav-logout-btn:hover:not(:disabled) { background: #450a0a !important; color: white !important; }
.nav-logout-btn:disabled { color: #94a3b8 !important; cursor: progress; }
.nav-btn-inline { background: transparent; border: none; font-family: inherit; cursor: pointer; width: 100%; text-align: left; }

.main-content-zone { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; height: 100vh; }
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

/* 🌟 재고 이동 모드 (파란색 테마) */
.tabs-control-header.transfer-mode { background: #dbeafe; border-bottom-color: #93c5fd; }
.tab-wrapper-item.transfer-mode { background: #bfdbfe; border-color: #93c5fd; color: #1e3a8a; }
.tab-wrapper-item.transfer-mode.active { background: #eff6ff; color: #1d4ed8; border-color: #93c5fd; border-bottom-color: #eff6ff; }
.transfer-mode .transaction-mode-label { color: #1d4ed8; }
.transfer-mode .add-tab-action-btn { color: #1d4ed8; }
.workspace-right.transfer-mode { background: #eff6ff; border-color: #93c5fd; }

.tab-body-content { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 15px; }

.tab-internal-master-header { display: flex; flex-direction: column; gap: 10px; background: #f8fafc; padding: 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
.tab-internal-master-header.locked { background: #f1f5f9; }
.master-lock-group { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.master-lock-group label { font-size: 11px; font-weight: bold; color: #64748b; }
.master-lock-group select { padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 12.5px; outline: none; background: white; }
.master-lock-group select:disabled { background: #e2e8f0; color: #64748b; cursor: not-allowed; }

.pos-cart-table { width: 100%; border-collapse: collapse; }
.pos-cart-table th, .pos-cart-table td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12.5px; text-align: center; }
.pos-cart-table th { background: #f8fafc; font-weight: bold; }
.sub-th th { font-size: 11px; padding: 3px; background: #f1f5f9; }
.empty-cart-msg { text-align: center !important; padding: 30px !important; color: #94a3b8; font-style: italic; }

.delete-cell { text-align: center; }
.btn-delete-row { background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px 6px; border-radius: 4px; transition: background 0.2s; }
.btn-delete-row:hover { background: #fee2e2; }

.input-green { background-color: #00e676 !important; width: 80px; padding: 2px; height: 35px !important; }
.input-green input { width: 100%; height: 100%; background: transparent; border: none; text-align: center; font-size: 16px; font-weight: bold; outline: none; }
.input-green input[type="number"]::-webkit-inner-spin-button,
.input-green input[type="number"]::-webkit-outer-spin-button {
  width: 20px !important;
  height: 30px !important; 
  transform: scale(1.2);
  transform-origin: center right;
  opacity: 1 !important;
  cursor: pointer;
}
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
.stock-info-cell { font-weight: bold; color: #0f766e; font-size: 13px; background-color: #f0fdfa; }
.submit-btn { background: white; border: 1px solid #333; padding: 6px 20px; font-weight: bold; cursor: pointer; }
.close-text-btn { float: right; background: none; border: none; color: #888; cursor: pointer; margin-top: 10px; font-size: 12px; }

/* 🌟 고정 슬롯 및 모달 CSS 추가 */
.slot-edit-modal { max-width: 500px; padding: 24px; }
.slot-item-list { max-height: 350px; overflow-y: auto; margin-top: 15px; border: 1px solid #e2e8f0; border-radius: 6px; }
.slot-list-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; border-bottom: 1px solid #f1f5f9; cursor: pointer; }
.slot-list-item:hover { background: #f8fafc; }

/* 🌟 퀵 추가 드롭다운 버튼 스타일 */
.quick-add-btn-row {
  padding: 12px 15px;
  text-align: center;
  background-color: #f8fafc;
  border-top: 1px solid #e2e8f0;
  cursor: pointer;
  font-weight: bold;
  color: #3b82f6;
  transition: all 0.2s ease;
}
.quick-add-btn-row:hover {
  background-color: #eff6ff;
  color: #2563eb;
}
.search-meta-row {
  padding: 8px 15px;
  text-align: center;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  pointer-events: none;
}
.search-more-row {
  padding: 10px 15px;
  text-align: center;
  background-color: #fffbeb;
  border-top: 1px solid #fde68a;
  cursor: pointer;
  font-weight: bold;
  color: #b45309;
}
.search-more-row:hover {
  background-color: #fef3c7;
}
.search-more-text {
  display: block;
  font-size: 13px;
}
.quick-add-text {
  display: block;
  width: 100%;
}

.item-desc strong { color: #1e293b; font-size: 14px; }
.item-desc { color: #64748b; font-size: 13px; }
.item-stock { font-size: 13px; color: #00a896; font-weight: bold; background: #ecfdf5; padding: 4px 8px; border-radius: 4px; }
.btn-clear-slot { margin-top: 15px; width: 100%; padding: 12px; background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5; border-radius: 6px; font-weight: bold; cursor: pointer; }
.btn-clear-slot:hover { background: #fecaca; }
.line-3.stock-info { font-size: 10.5px; color: #0f766e; margin-top: 5px; font-weight: bold; background: #ccfbf1; padding: 2px 6px; border-radius: 4px; display: inline-block;}
.empty-slot { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; }
.empty-icon { font-size: 20px; display: block; margin-bottom: 4px; color: #94a3b8; }
.empty-slot .line-2 { color: #94a3b8; font-weight: bold; }
.empty-slot:hover { background: #f1f5f9; border-color: #94a3b8; }
/* 컬러 유틸 클래스 */
.bg-light-red {
  background-color: #ffe4e6 !important;
}
.bg-light-green {
  background-color: #dcfce7 !important;
}

/* 🌟 예약 뱃지 스타일 */
.res-badge {
  background: #ef4444; color: white; font-size: 11px; font-weight: bold;
  padding: 2px 6px; border-radius: 10px; margin-left: auto; white-space: nowrap;
}
.action-btn-triple-group { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 10px; }
</style>


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
        <span class="nav-user-meta">{{ authStore.user.branch_name ?? '본부' }} · {{ isAdmin ? 'Admin' : (authStore.user.access_level || '-') }}</span>
        <span
          v-if="!isAdmin && branchSession.needsPinGate"
          class="nav-user-meta"
          style="display:block; margin-top:4px; font-weight:800;"
          :style="{ color: branchSession.isManagerMode ? '#86efac' : '#38bdf8' }"
        >
          {{ branchSession.isManagerMode ? '🔓 지점장 모드' : `🧑‍💼 점원: ${branchSession.selectedClerkName || '-'}` }}
        </span>
        <button
          v-if="!isAdmin && branchSession.needsPinGate && branchSession.isClerkMode"
          type="button"
          style="margin-top:8px; width:100%; background:#f59e0b; color:#111; border:none; border-radius:6px; padding:8px; font-weight:800; cursor:pointer; font-size:12px;"
          @click="branchSession.openPinModal()"
        >🔐 지점장 PIN 잠금해제</button>
        <button
          v-else-if="!isAdmin && branchSession.needsPinGate && branchSession.isManagerMode"
          type="button"
          style="margin-top:8px; width:100%; background:#334155; color:#e2e8f0; border:none; border-radius:6px; padding:8px; font-weight:700; cursor:pointer; font-size:12px;"
          @click="branchSession.lockToClerk()"
        >↩️ 점원 모드로 잠금</button>
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
              점원 모드: 판매 보류만 가능합니다.<br/>이동/재고/설정은 지점장 PIN 후 사용.
            </div>
          </div>
        </div>

        <template v-if="isAdmin">
          <div style="border-top: 1px solid #334155; margin: 5px 0;"></div>
          <span style="padding: 5px 15px; font-size: 11px; color: #94a3b8; font-weight: bold; text-transform: uppercase;">메인 관리자 전용 (Admin)</span>
          <a href="#" class="nav-item" :class="{ active: activeNav === 'home' }" @click.prevent="setActiveNav('home')">🏠 {{ $t('nav.home') }}</a>
          <button class="nav-item nav-btn-inline" @click.prevent="isOutboundMenuOpen = !isOutboundMenuOpen">
          {{ $t('nav.outbound_group') }} <span style="float:right;">{{ isOutboundMenuOpen ? '▲' : '▼' }}</span>
        </button>
        <div v-show="isOutboundMenuOpen" class="nav-sub-menu" style="background: rgba(0,0,0,0.1); padding-left:10px;">
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'outbound' && !currentTab?.activeReservationId && !currentTab?.amendingStockEntry }" @click.prevent="setActiveNav('outbound', 'outbound')">{{ $t('nav.outbound_entry') }}</a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'outbound-reservation' }" @click.prevent="setActiveNav('outbound-reservation'); setTransactionMode('outbound')">{{ $t('nav.outbound_res') }} <span v-if="incompleteReservationCount > 0" class="res-badge">{{ incompleteReservationCount }}</span></a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'outbound-list' }" @click.prevent="setActiveNav('outbound-list'); setTransactionMode('outbound')">{{ $t('nav.outbound_list') }}</a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'outbound-history' }" @click.prevent="setActiveNav('outbound-history'); setTransactionMode('outbound')">{{ $t('nav.outbound_history') }}</a>
        </div>
        <button class="nav-item nav-btn-inline" @click.prevent="isInboundMenuOpen = !isInboundMenuOpen">
          {{ $t('nav.inbound_group') }} <span style="float:right;">{{ isInboundMenuOpen ? '▲' : '▼' }}</span>
        </button>
        <div v-show="isInboundMenuOpen" class="nav-sub-menu" style="background: rgba(0,0,0,0.1); padding-left:10px;">
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'inbound' && !currentTab?.activeReservationId && !currentTab?.amendingStockEntry }" @click.prevent="setActiveNav('inbound', 'inbound')">{{ $t('nav.inbound_entry') }}</a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'inbound-list' }" @click.prevent="setActiveNav('inbound-list'); setTransactionMode('inbound')">{{ $t('nav.inbound_list') }}</a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'inbound-history' }" @click.prevent="setActiveNav('inbound-history'); setTransactionMode('inbound')">{{ $t('nav.inbound_history') }}</a>
        </div>
        <button class="nav-item nav-btn-inline" @click.prevent="isTransferMenuOpen = !isTransferMenuOpen">
          {{ $t('nav.move_group') }} <span style="float:right;">{{ isTransferMenuOpen ? '▲' : '▼' }}</span>
        </button>
        <div v-show="isTransferMenuOpen" class="nav-sub-menu" style="background: rgba(0,0,0,0.1); padding-left:10px;">
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'transfer' && !currentTab?.activeReservationId && !currentTab?.amendingStockEntry }" @click.prevent="setActiveNav('transfer', 'transfer')">{{ $t('nav.move_entry') }}</a>
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
          <a href="#" class="nav-item" :class="{ active: activeNav === 'staff-management' }" @click.prevent="activeNav = 'staff-management'">👨‍👩‍👧 가족 관리</a>
        </template>
        <template v-else-if="branchSession.isManagerMode">
          <a href="#" class="nav-item" :class="{ active: activeNav === 'settings' }" @click.prevent="activeNav = 'settings'">⚙️ {{ $t('nav.settings') }}</a>
        </template>
        <button type="button" class="nav-item nav-logout-btn" @click="handleLogout">🚪 {{ $t('nav.logout') }}</button>
      </nav>
    </aside>

    <main class="main-content-zone">
      <!-- 🌟 신규 추가된 컴포넌트들 -->
      <ReservationListView v-if="activeNav === 'outbound-reservation'" :branch-list="branchList" :raw-items="rawSingleItems" reservation-type="Material Issue" @create-new="activeNav = 'outbound'" @edit-reservation="loadReservationToCart" @edit-draft="loadDraftToCart" @refresh-items="fetchFrappeItems" />
      <ReservationListView v-else-if="activeNav === 'transfer-reservation'" :branch-list="branchList" :raw-items="rawSingleItems" reservation-type="Material Transfer" @create-new="activeNav = 'transfer'" @edit-reservation="loadReservationToCart" @edit-draft="loadDraftToCart" @refresh-items="fetchFrappeItems" />
      <ProductListView v-else-if="activeNav === 'product-list'" @open-detail="openProductDetail" />
      <ProductDetailView v-else-if="activeNav === 'product-detail'" :item-id="activeProductId" @go-back="setActiveNav(previousNavForProductDetail)" />
      <BranchProductDetailView v-else-if="activeNav === 'branch-product-detail'" :item-id="activeProductId" :current-branch="authStore.user?.branch_name" @go-back="setActiveNav(previousNavForProductDetail)" />
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

      <div v-else class="workspace-body">
        
        <div class="workspace-left" style="position: relative;" :class="{ 'disabled-workspace': !isHeaderComplete }">
          <!-- Header Incomplete Overlay Gate -->
          <div v-if="!isHeaderComplete" class="header-gate-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255, 255, 255, 0.4); z-index: 9999; display: flex; flex-direction: column; justify-content: center; align-items: center; border-radius: 8px;">
            <div style="font-size: 55px; margin-bottom: 20px; text-shadow: 0 4px 6px rgba(0,0,0,0.1);">🛑</div>
            <h2 style="color: #ef4444; margin: 0 0 10px 0; text-align: center; font-size: 26px; font-weight: 900; background: rgba(255,255,255,0.9); padding: 10px 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">잠깐! 우측 상단 헤더를 모두 채워주세요!</h2>
            <p style="color: #1e293b; font-size: 16px; font-weight: 800; text-align: center; line-height: 1.6; background: rgba(255,255,255,0.9); padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">우측 상단의 전표 헤더(출발/도착 창고, 담당자 등)<br>필수 항목을 모두 선택해야 상품 검색 및 추가 작업이 활성화됩니다.</p>
          </div>
          <div class="search-section dual-search">
            <!-- 동적 검색 (자동완성) -->
            <div class="search-box-wrapper">
              <span class="search-icon">🔍</span>
              <input
                type="text"
                v-model="searchQuery"
                @focus="openSearchDropdown"
                @input="openSearchDropdown"
                @blur="closeSearchDropdown"
                :placeholder="$t('pos.ph_search')"
                class="search-bar"
                autocomplete="off"
              />
              <ul v-if="isSearchDropdownOpen && (filteredMainSearchItems.length > 0 || searchQuery.trim())" class="search-dropdown">
                <li v-for="item in filteredMainSearchItems" :key="item.name" 
                    :class="{ 
                      'bg-light-green': gridPickSlotNames.includes(item.custom_grid_group_id || item.item_name || t('pos.unclassified')),
                      'bg-light-red': quickPickSlotNames.includes(item.name) 
                    }"
                    @mousedown.prevent="selectSearchItem(item)">
                  <div style="display:flex; justify-content:space-between; width: 100%; align-items: center;">
                    <div>
                      <span class="item-name">{{ item.item_name }}</span> 
                      <span class="item-color">({{ item.custom_color || t('pos.default_color') }})</span>
                      <span class="item-pack-qty"> · {{ item.custom_pack_qty || 1 }}入</span>
                    </div>
                    <div class="search-item-stock">{{ getFormattedStockFor(item) }}</div>
                  </div>
                </li>
                <li
                  v-if="searchQuery.trim() && mainSearchHits.length > 0"
                  class="search-meta-row"
                >
                  <span>{{ $t('common.search_shown', { shown: filteredMainSearchItems.length, total: mainSearchHits.length }) }}</span>
                </li>
                <li
                  v-if="mainSearchHasMore"
                  class="search-more-row"
                  @mousedown.prevent="loadMoreMainSearch"
                >
                  <span class="search-more-text">{{ $t('common.show_more', { n: mainSearchRemaining }) }}</span>
                </li>
                <li class="quick-add-btn-row" @mousedown.prevent="isQuickItemModalOpen = true">
                  <span class="quick-add-text">{{ $t('pos.btn_quick_add_item') }}</span>
                </li>
              </ul>
            </div>
            
            <!-- 바코드 스캐너 입력 -->
            <div class="barcode-box-wrapper">
              <span class="search-icon">🏷️</span>
              <input type="text" v-model="barcodeQuery" @keyup.enter="handleBarcodeScan" :placeholder="$t('pos.ph_barcode')" class="search-bar barcode-bar" />
            </div>
          </div>

          <div class="hotkey-block">
            <div class="block-header"><h3>{{ $t('pos.qp_single') }}</h3></div>
            <div class="grid-3x4">
              <div v-for="(slot, idx) in 8" :key="'slot-'+idx" class="hotkey-card">
                <template v-if="quickPickSlots[idx]">
                  <button class="hotkey-btn-core" @click="addSingleHotkeyToCart(quickPickSlots[idx])">
                    <div class="line-1">{{ quickPickSlots[idx].item_name }}</div>
                    <div class="line-2">({{ quickPickSlots[idx].custom_color || $t('pos.qp_single_desc') }} · {{ quickPickSlots[idx].custom_pack_qty || 1 }}{{ $t('pos.pack_unit') }})</div>
                    <div class="line-3 stock-info">{{ getFormattedStockFor(quickPickSlots[idx]) }}</div>
                  </button>
                  <button class="hotkey-sub-edit-btn" @click="openSlotEdit(idx)">{{ $t('pos.btn_edit') }}</button>
                </template>
                <template v-else>
                  <button class="hotkey-btn-core empty-slot" @click="openSlotEdit(idx)">
                    <span class="empty-icon">➕</span>
                    <div class="line-2">{{ $t('pos.qp_assign_item') }}</div>
                  </button>
                  <button class="hotkey-sub-edit-btn" @click="openSlotEdit(idx)">{{ $t('pos.btn_edit') }}</button>
                </template>
              </div>
            </div>
          </div>

          <div class="hotkey-block">
            <div class="block-header"><h3>{{ $t('pos.qp_grid') }}</h3></div>
            <div class="grid-3x4">
              <div v-for="(slot, idx) in 8" :key="'g-slot-'+idx" class="hotkey-card">
                <template v-if="gridPickSlots[idx]">
                  <button class="hotkey-btn-core grid-style" @click="openGridModal(gridPickSlots[idx])">
                    <div class="line-1">{{ gridPickSlots[idx].group_name }}</div>
                    <div class="line-2 text-teal">({{ gridPickSlots[idx].variants.length }} {{ $t('pos.qp_colors') }})</div>
                  </button>
                  <button class="hotkey-sub-edit-btn" @click="openGridSlotEdit(idx)">{{ $t('pos.btn_edit') }}</button>
                </template>
                <template v-else>
                  <button class="hotkey-btn-core empty-slot" @click="openGridSlotEdit(idx)">
                    <span class="empty-icon">➕</span>
                    <div class="line-2">{{ $t('pos.qp_assign_item') }}</div>
                  </button>
                  <button class="hotkey-sub-edit-btn" @click="openGridSlotEdit(idx)">{{ $t('pos.btn_edit') }}</button>
                </template>
              </div>
            </div>
          </div>
          <div class="hotkey-block">
            <div class="block-header">
              <h3>👍 
                <span v-if="transactionMode === 'inbound'">주요 공급사 (Supplier Quick Pick)</span>
                <span v-else-if="transactionMode === 'transfer'">주요 목적지 (Target Quick Pick)</span>
                <span v-else>{{ $t('pos.qp_customer') }}</span>
              </h3>
            </div>
            <div class="grid-3x4">
              <div v-for="(slot, idx) in 8" :key="'c-slot-'+idx" class="hotkey-card">
                <template v-if="activePartnerPickSlots[idx]">
                  <button class="hotkey-btn-core" @click="selectPartner(activePartnerPickSlots[idx])" style="background-color: #f8fafc;">
                    <div class="line-1">{{ activePartnerPickSlots[idx].customer_name || activePartnerPickSlots[idx].supplier_name || activePartnerPickSlots[idx].warehouse_name || activePartnerPickSlots[idx].name }}</div>
                    <div class="line-2 text-teal">{{ activePartnerPickSlots[idx].name }}</div>
                  </button>
                  <button class="hotkey-sub-edit-btn" @click="openPartnerSlotEdit(idx)">{{ $t('pos.btn_edit') }}</button>
                </template>
                <template v-else>
                  <button class="hotkey-btn-core empty-slot" @click="openPartnerSlotEdit(idx)">
                    <span class="empty-icon">➕</span>
                    <div class="line-2">
                      <span v-if="transactionMode === 'inbound'">공급사 지정</span>
                      <span v-else-if="transactionMode === 'transfer'">도착지 지정</span>
                      <span v-else>{{ $t('pos.qp_assign_customer') }}</span>
                    </div>
                  </button>
                  <button class="hotkey-sub-edit-btn" @click="openPartnerSlotEdit(idx)">{{ $t('pos.btn_edit') }}</button>
                </template>
              </div>
            </div>
          </div>
        </div>

        <div class="workspace-right" :class="{ 'inbound-mode': transactionMode === 'inbound', 'transfer-mode': transactionMode === 'transfer' }">
          
          <div class="tabs-control-header" :class="{ 'inbound-mode': transactionMode === 'inbound', 'transfer-mode': transactionMode === 'transfer' }">
            <div class="tabs-list">
              <div 
                v-for="tab in modeTabs" 
                :key="tab.id" 
                class="tab-wrapper-item"
                :class="{ 'active': activeTabIds[transactionMode] === tab.id, 'inbound-mode': transactionMode === 'inbound', 'transfer-mode': transactionMode === 'transfer' }"
              >
                <span class="tab-title-text" @click="activeTabIds[transactionMode] = tab.id">{{ tab.title }}</span>
                <button v-if="modeTabs.length > 1" class="tab-close-x-btn" @click.stop="closeTab(tab.id)">×</button>
              </div>
            </div>
            <div class="tabs-header-actions">
              <span class="transaction-mode-label">{{ transactionMode === 'outbound' ? $t('pos.mode_outbound') : transactionMode === 'inbound' ? $t('pos.mode_inbound') : $t('pos.mode_transfer') }}</span>
              <button class="add-tab-action-btn" @click="addNewTab">{{ $t('pos.btn_add_tab') }}</button>
            </div>
          </div>

          <div class="tab-body-content" v-if="currentTab">
            <div class="tab-internal-master-header" :class="{ locked: !canEditMasterFields }">
              <div class="master-input-row">
                <!-- 출고 모드 (소스 선택) -->
                <div v-if="transactionMode === 'outbound'" class="master-lock-group">
                  <label>{{ $t('pos.lbl_src') }}</label>
                  <select v-model="currentTab.selectedSource" :disabled="!canEditMasterFields && (!!currentTab.activeReservationId && !!currentTab.reservationOriginalSource)" class="master-select">
                    <option value="">{{ $t('pos.sel_src') }}</option>
                    <option v-for="wh in warehouseList" :key="wh.name" :value="wh.name">{{ wh.warehouse_name }}</option>
                  </select>
                </div>
                <!-- 입고 모드 (공급자, 발주처, 도착창고) -->
                <template v-if="transactionMode === 'inbound'">
                  <div class="master-lock-group">
                    <label>{{ $t('pos.lbl_supplier') }}</label>
                    <select v-model="currentTab.selectedSupplier" :disabled="!canEditMasterFields" class="master-select">
                      <option value="">{{ $t('pos.sel_supplier') }}</option>
                      <option v-for="sup in supplierList" :key="sup.name" :value="sup.name">{{ sup.supplier_name || sup.name }}</option>
                    </select>
                  </div>
                  <div class="master-lock-group">
                    <label>{{ $t('pos.lbl_order_branch') }}</label>
                    <select v-model="currentTab.selectedBranch" :disabled="!canEditMasterFields" class="master-select">
                      <option value="">{{ $t('pos.sel_order_branch') }}</option>
                      <option v-for="branch in branchList" :key="branch.name" :value="branch.name">{{ branch.warehouse_name }}</option>
                    </select>
                  </div>
                  <div class="master-lock-group">
                    <label>{{ $t('pos.lbl_target') }}</label>
                    <select v-model="currentTab.selectedTarget" :disabled="!canEditMasterFields" class="master-select">
                      <option value="">{{ $t('pos.sel_target') }}</option>
                      <option v-for="wh in warehouseList" :key="wh.name" :value="wh.name">{{ wh.warehouse_name }}</option>
                    </select>
                  </div>
                </template>
                
                <!-- 재고이동 모드 (소스, 타겟) -->
                <template v-if="transactionMode === 'transfer'">
                  <div class="master-lock-group">
                    <label>{{ $t('pos.lbl_src_wh') }}</label>
                    <select v-model="currentTab.selectedSource" :disabled="!canEditMasterFields" class="master-select">
                      <option value="">{{ $t('pos.sel_src_wh') }}</option>
                      <option v-for="wh in warehouseList" :key="wh.name" :value="wh.name">{{ wh.warehouse_name }}</option>
                    </select>
                  </div>
                  <div class="master-lock-group">
                    <label>{{ $t('pos.lbl_tgt_wh') }}</label>
                    <select v-model="currentTab.selectedTarget" :disabled="!canEditMasterFields" class="master-select">
                      <option value="">{{ $t('pos.sel_target') }}</option>
                      <option v-for="wh in warehouseList" :key="wh.name" :value="wh.name">{{ wh.warehouse_name }}</option>
                    </select>
                  </div>
                </template>
                
                <!-- 출고 모드 (공통: 담당 지점) -->
                <div v-if="transactionMode === 'outbound'" class="master-lock-group">
                  <label>{{ $t('pos.lbl_branch') }}</label>
                  <select v-model="currentTab.selectedBranch" :disabled="!canEditMasterFields" class="master-select">
                    <option value="">{{ $t('pos.sel_branch') }}</option>
                    <option v-for="branch in branchList" :key="branch.name" :value="branch.name">{{ branch.warehouse_name }}</option>
                  </select>
                </div>
              </div>
              <div class="master-input-row" style="margin-top: 10px;">
                <!-- 출고 전용: 고객 및 응대자 -->
                <template v-if="transactionMode === 'outbound'">
                  <div class="master-lock-group" style="position: relative;">
                    <label>{{ $t('pos.lbl_customer') }}</label>
                    <input type="text" v-model="currentTab.selectedCustomer" @focus="isCustomerDropdownOpen = true" @blur="closeCustomerDropdown" :disabled="!canEditMasterFields" class="master-input" :placeholder="$t('pos.ph_customer')" autocomplete="off" />
                    <ul v-if="isCustomerDropdownOpen && filteredCustomerSearchItems.length > 0" class="search-dropdown" style="top: 100%; max-height: 200px;">
                      <li v-for="cust in filteredCustomerSearchItems" :key="cust.name" @mousedown.prevent="selectCustomerFromDropdown(cust.name)">
                        <span class="item-name">{{ cust.customer_name || cust.name }}</span> <span class="item-color">({{ cust.name }})</span>
                      </li>
                      <li class="quick-add-btn-row" @mousedown.prevent="isQuickCustomerModalOpen = true">
                        <span class="quick-add-text">{{ $t('pos.btn_quick_add_customer') }}</span>
                      </li>
                    </ul>
                  </div>
                  <div class="master-lock-group">
                    <label>{{ $t('pos.lbl_sp') }}</label>
                    <select v-model="currentTab.selectedResponder" :disabled="!canEditMasterFields" class="master-select" @change="handleSalesPersonChange">
                      <option value="">{{ $t('pos.sel_sp') }}</option>
                      <option value="ADD_NEW">{{ $t('pos.btn_add_sp') }}</option>
                      <option v-for="sp in filteredSalesPersonList" :key="sp.name" :value="sp.name">{{ sp.sales_person_name || sp.name }}</option>
                    </select>
                  </div>
                  <div class="master-lock-group">
                    <label>{{ $t('pos.lbl_creator') }}</label>
                    <input type="text" v-model="currentTab.selectedCreator" :disabled="!canEditMasterFields" class="master-input"/>
                  </div>
                </template>
                
                <!-- 재고이동 전용: 재고이동요청자 및 작성자 -->
                <template v-if="transactionMode === 'transfer'">
                  <div class="master-lock-group">
                    <label>{{ $t('pos.lbl_requester') }}</label>
                    <select v-model="currentTab.selectedResponder" :disabled="!canEditMasterFields" class="master-select" @change="handleSalesPersonChange">
                      <option value="">{{ $t('pos.sel_requester') }}</option>
                      <option value="ADD_NEW">{{ $t('pos.btn_add_requester') }}</option>
                      <option v-for="sp in filteredSalesPersonList" :key="sp.name" :value="sp.name">{{ sp.sales_person_name || sp.name }}</option>
                    </select>
                  </div>
                  <div class="master-lock-group">
                    <label>{{ $t('pos.lbl_creator_en') }}</label>
                    <input type="text" v-model="currentTab.selectedCreator" :disabled="!canEditMasterFields" class="master-input"/>
                  </div>
                </template>
                
                <!-- 입고 전용: 발주자 및 작성자 -->
                <template v-if="transactionMode === 'inbound'">
                  <div class="master-lock-group">
                    <label>{{ $t('pos.lbl_orderer') }}</label>
                    <select v-model="currentTab.selectedResponder" :disabled="!canEditMasterFields" class="master-select" @change="handleSalesPersonChange">
                      <option value="">{{ $t('pos.sel_orderer') }}</option>
                      <option value="ADD_NEW">{{ $t('pos.btn_add_orderer') }}</option>
                      <option v-for="sp in filteredSalesPersonList" :key="sp.name" :value="sp.name">{{ sp.sales_person_name || sp.name }}</option>
                    </select>
                  </div>
                  <div class="master-lock-group">
                    <label>{{ $t('pos.lbl_sys_user') }}</label>
                    <input type="text" v-model="currentTab.selectedCreator" :disabled="true" class="master-input" style="background-color: #f1f5f9; color: #475569;" />
                  </div>
                </template>
              </div>
            </div>

            <div style="position: relative;" :class="{ 'disabled-workspace': !isHeaderComplete }">
              <table class="pos-cart-table">
                <thead>
                <tr><th>{{ $t('pos.th_item_color') }}</th><th colspan="2">{{ $t('pos.th_qty_input') }}</th><th>{{ $t('pos.th_total_qty') }}</th><th style="width: 40px;"></th></tr>
                <tr class="sub-th"><th></th><th>{{ $t('pos.th_box') }}</th><th>{{ $t('pos.th_each') }}</th><th></th><th></th></tr>
              </thead>
              <tbody>
                <tr v-for="item in currentTab.cartItems" :key="item.name">
                  <td class="product-cell" style="border: 1px solid #e2e8f0; padding: 8px; font-size: 12.5px; text-align: left !important; vertical-align: middle; word-break: break-word;">
                    <div class="p-name" style="font-weight: bold; font-size: 13px; color: #0f172a; white-space: normal;">
                      {{ item.item_name }}
                      <span style="color: #ef4444; margin-left: 6px; font-size: 11px;">[가용: {{ Math.floor(getAvailableStock(item.name) / (item.custom_pack_qty || 1)) }} 박스]</span>
                    </div>
                    <div class="p-stock-info" style="font-size: 11px; color: #64748b; margin-top: 4px;">
                      {{ item.custom_color || t('pos.default_color') }} | 1박스 = {{ item.custom_pack_qty || 1 }}개
                    </div>
                  </td>
                  <td class="input-blue" style="border: 1px solid #e2e8f0; padding: 2px !important; background-color: #dbeafe !important;">
                    <input type="number" v-model.number="item.input_box" min="0" max="9999" style="width: 100%; background: transparent; border: none; text-align: center; font-size: 14px; font-weight: bold; outline: none; color: #2563eb;" />
                  </td>
                  <td class="input-blue pza-cell" style="border: 1px solid #e2e8f0; padding: 0 !important; background-color: #dbeafe !important;">
                    <div style="display: flex; width: 100%; height: 100%;">
                      <!-- 왼쪽 10단위 스피너 -->
                      <div class="custom-spinner-left" style="display: flex; flex-direction: column; width: 26px; flex-shrink: 0; background: #bfdbfe; border-right: 1px solid #93c5fd;">
                        <button type="button" @click="changeQtyBy10(item, 10)" class="left-spin-btn" style="flex: 1; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #1e40af; display: flex; align-items: center; justify-content: center; padding: 0; outline: none;">▲</button>
                        <button type="button" @click="changeQtyBy10(item, -10)" class="left-spin-btn" style="flex: 1; border: none; border-top: 1px solid #93c5fd; background: transparent; cursor: pointer; font-size: 12px; color: #1e40af; display: flex; align-items: center; justify-content: center; padding: 0; outline: none;">▼</button>
                      </div>
                      <!-- 기존 1단위 (오른쪽 native 스피너) -->
                      <input type="number" v-model.number="item.input_each" min="0" max="99999" style="flex: 1; width: 100%; background: transparent; border: none; text-align: center; font-size: 14px; font-weight: bold; outline: none; color: #2563eb; min-width: 0;" />
                    </div>
                  </td>
                  <td class="total-qty-cell"><strong>{{ (item.input_box * (item.custom_pack_qty || 1)) + item.input_each }}</strong> {{ $t('pos.unit_ea') }}</td>
                  <td class="delete-cell">
                    <button class="btn-delete-row" @click="removeFromCart(item.name)" :title="$t('pos.btn_del')">🗑️</button>
                  </td>
                </tr>
                <tr v-if="currentTab.cartItems.length === 0">
                  <td colspan="5" class="empty-cart-msg">{{ $t('pos.empty_cart') }}</td>
                </tr>
              </tbody>
            </table>
            <!-- Cart Table Overlay -->
            <div v-if="!isHeaderComplete" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999;"></div>
            </div>
          </div>

          <div class="right-footer-action-zone" v-if="currentTab">
            <div class="truck-counter-info-grid">
              <div class="summary-label-box">
                {{ $t('pos.total_box') }} <strong>{{ currentTabSummary.boxes }} {{ $t('pos.unit_box') }}</strong>
              </div>
              <div class="summary-label-box">
                {{ $t('pos.total_each') }} <strong>{{ currentTabSummary.eaches }} {{ $t('pos.unit_ea') }}</strong>
              </div>
            </div>
            
            <div :class="(transactionMode !== 'inbound' && currentTab?.activeReservationId && !currentTab?.amendingStockEntry) ? 'action-btn-triple-group' : 'action-btn-double-group'">
              <template v-if="transactionMode !== 'inbound' && currentTab?.activeReservationId && !currentTab?.amendingStockEntry">
                <button
                  class="btn-outbound-reserve"
                  style="background:#ef4444"
                  @click="cancelReservationCheckout()"
                >
                  {{ transactionMode === 'transfer' ? '❌ 예약이동 취소' : $t('pos.btn_cancel_res') }}
                </button>
                <button
                  class="btn-outbound-reserve"
                  style="background:#f59e0b"
                  @click="submitReservation()"
                >
                  {{ transactionMode === 'transfer' ? '📝 이동예약 수정' : '📝 출고예약 수정' }}
                </button>
                <button class="btn-final-submit" @click="submitToFrappe">
                  {{ transactionMode === 'transfer' ? '✅ 이동전표 발행' : '✅ 출고전표 발행' }}
                </button>
              </template>
              <template v-else>
                <!-- 수정 취소 버튼 -->
                <button
                  v-if="transactionMode !== 'inbound' && currentTab?.amendingStockEntry"
                  class="btn-outbound-reserve"
                  style="background:#ef4444"
                  @click="cancelAmend()"
                >
                  {{ $t('pos.btn_cancel_edit') }}
                </button>
                <!-- 일반 예약 등록 버튼 -->
                <button
                  v-else-if="transactionMode !== 'inbound'"
                  class="btn-outbound-reserve"
                  @click="submitReservation()"
                >
                  {{ $t('pos.btn_reg_res') }}
                </button>
                <!-- 입고 수정 취소 버튼 -->
                <button
                  v-else-if="currentTab?.amendingStockEntry"
                  class="btn-outbound-reserve"
                  style="background:#ef4444"
                  @click="cancelAmend()"
                >
                  {{ $t('pos.btn_cancel_edit') }}
                </button>
                <button class="btn-final-submit" @click="submitToFrappe">
                  {{ currentTab?.amendingStockEntry ? $t('pos.btn_submit_edit') : $t('pos.btn_submit_new') }}
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </main>

    <div class="modal-overlay" v-if="isGridModalOpen">
      <div class="modal-content">
        <div class="modal-header">
          <div class="product-title">{{ $t('pos.grid_item_name') }} <strong>{{ activeGroup.group_name }}</strong></div>
          <button class="submit-btn" @click="submitGridSelection">{{ $t('pos.btn_sel_done') }}</button>
        </div>
        <div style="max-height: 60vh; overflow-y: auto; margin-top: 15px;">
          <table class="grid-table" style="margin-top: 0;">
            <thead>
              <tr><th style="position: sticky; top: 0; background: #fff; z-index: 1;">{{ $t('pos.th_color_pack') }}</th><th style="position: sticky; top: 0; background: #fff; z-index: 1;" colspan="2">{{ $t('pos.th_qty_input') }}</th><th style="position: sticky; top: 0; background: #fff; z-index: 1;">{{ $t('pos.th_sel_total') }}</th><th style="position: sticky; top: 0; background: #fff; z-index: 1;">{{ $t('pos.th_cur_stock') }}</th></tr>
            </thead>
            <tbody>
              <tr v-for="(v, idx) in activeGroup.variants" :key="idx">
                <td class="color-name">{{ v.custom_color || t('pos.default_color') }} <span style="font-size: 0.85em; color: #666;">({{ v.custom_pack_qty || 1 }}{{ $t('pos.pack_unit') }})</span></td>
                <td class="input-green"><input type="number" min="0" v-model.number="v.input_box" placeholder="0" /></td>
                <td class="input-green"><input type="number" min="0" v-model.number="v.input_each" placeholder="0" /></td>
                <td class="calc-total-qty">{{ ((v.input_box || 0) * (v.custom_pack_qty || 1)) + (v.input_each || 0) }}{{ $t('pos.unit_ea') }}</td>
                <td class="stock-info-cell">{{ getFormattedStockFor(v) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <button class="close-text-btn" @click="isGridModalOpen = false">{{ $t('pos.btn_close') }}</button>
      </div>
    </div>
    <!-- 🌟 단일 버튼 상품 지정 모달 -->
    <div class="modal-overlay" v-if="isSlotEditModalOpen">
      <div class="modal-content slot-edit-modal">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">{{ $t('pos.slot_title_item') }} {{ editSlotIndex + 1 }})</h3>
          <button class="close-text-btn" @click="isSlotEditModalOpen = false" style="margin:0;">{{ $t('pos.btn_close') }}</button>
        </div>
        <div class="search-section" style="margin-top: 15px;">
          <input type="text" v-model="slotSearchQuery" :placeholder="$t('pos.ph_slot_search')" class="search-bar" />
        </div>
        <div class="slot-item-list">
          <div v-for="item in filteredSlotItems" :key="item.name" 
               class="slot-list-item" 
               :class="{ 
                 'bg-light-green': gridPickSlotNames.includes(item.custom_grid_group_id || item.item_name || t('pos.unclassified')),
                 'bg-light-red': quickPickSlotNames.includes(item.name) 
               }"
               @click="assignSlotItem(item)">
            <div class="item-desc"><strong>{{ item.item_name }}</strong> ({{ item.custom_color || t('pos.default_color') }})</div>
            <div class="item-stock">{{ getFormattedStockFor(item) }}</div>
          </div>
          <div v-if="filteredSlotItems.length === 0" class="empty-msg" style="padding: 20px; text-align: center; color: #888;">{{ $t('pos.empty_search') }}</div>
        </div>
        <button class="btn-clear-slot" @click="clearSlot">{{ $t('pos.btn_clear_slot') }}</button>
      </div>
    </div>

    <!-- 🌟 그리드 묶음 상품 지정 모달 -->
    <div class="modal-overlay" v-if="isGridSlotEditModalOpen">
      <div class="modal-content slot-edit-modal">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">{{ $t('pos.slot_title_grid') }} {{ editGridSlotIndex + 1 }})</h3>
          <button class="close-text-btn" @click="isGridSlotEditModalOpen = false" style="margin:0;">{{ $t('pos.btn_close') }}</button>
        </div>
        <div class="search-section" style="margin-top: 15px;">
          <input type="text" v-model="gridSlotSearchQuery" :placeholder="$t('pos.ph_grid_search')" class="search-bar" />
        </div>
        <div class="slot-item-list">
          <div v-for="group in filteredGridSlotItems" :key="group.id" 
               class="slot-list-item" 
               :class="{ 'bg-light-green': gridPickSlotNames.includes(group.id) }"
               @click="assignGridSlotItem(group)">
            <div class="item-desc"><strong>{{ group.group_name }}</strong> ({{ group.variants.length }} color)</div>
          </div>
          <div v-if="filteredGridSlotItems.length === 0" class="empty-msg" style="padding: 20px; text-align: center; color: #888;">{{ $t('pos.empty_search') }}</div>
        </div>
        <button class="btn-clear-slot" @click="clearGridSlot">{{ $t('pos.btn_clear_slot') }}</button>
      </div>
    </div>

    <!-- 🌟 파트너 (고객/공급사/창고) 편집 모달 -->
    <div class="modal-overlay" v-if="isPartnerSlotEditModalOpen">
      <div class="modal-content slot-edit-modal">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">
            <span v-if="transactionMode === 'inbound'">단축키 공급사 지정 (슬롯</span>
            <span v-else-if="transactionMode === 'transfer'">단축키 도착지 지정 (슬롯</span>
            <span v-else>{{ $t('pos.slot_title_customer') }}</span>
            {{ editPartnerSlotIndex + 1 }})
          </h3>
          <button class="close-text-btn" @click="isPartnerSlotEditModalOpen = false" style="margin:0;">{{ $t('pos.btn_close') }}</button>
        </div>
        <div class="search-section" style="margin-top: 15px;">
          <input type="text" v-model="partnerSlotSearchQuery" :placeholder="transactionMode === 'inbound' ? '공급사 검색' : (transactionMode === 'transfer' ? '도착지 검색' : $t('pos.ph_customer_search'))" class="search-bar" />
        </div>
        <div class="slot-item-list">
          <div v-for="ptn in filteredPartnerSlotItems" :key="ptn.name" class="slot-list-item" @click="assignPartnerToSlot(ptn)">
            <div class="item-desc"><strong>{{ ptn.customer_name || ptn.supplier_name || ptn.warehouse_name || ptn.name }}</strong> ({{ ptn.name }})</div>
          </div>
          <div v-if="filteredPartnerSlotItems.length === 0" class="empty-msg" style="padding: 20px; text-align: center; color: #888;">{{ $t('pos.empty_search') }}</div>
        </div>
        <button class="btn-clear-slot" @click="clearPartnerSlot">{{ $t('pos.btn_clear_slot') }}</button>
      </div>
    </div>

    <!-- 🌟 퀵 재고조정 모달 (Quick Stock Adjustment) -->
    <div class="modal-overlay" v-if="isQuickAdjustModalOpen">
      <div class="modal-content" style="max-width: 450px; padding: 24px; border-radius: 8px;">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; color:#ef4444;">{{ $t('pos.qa_title') }}</h3>
          <button class="close-text-btn" @click="isQuickAdjustModalOpen = false" style="margin:0;">{{ $t('pos.btn_close') }}</button>
        </div>
        
        <div class="modal-body" style="margin-top: 15px;">
          <p style="font-size: 14px; color: #334155; line-height: 1.5;">
            <strong>{{ quickAdjustItem?.item_name }} ({{ quickAdjustItem?.custom_color || t('pos.default_color') }})</strong> {{ $t('pos.qa_no_stock') }}<br/>
            {{ $t('pos.qa_desc') }}
          </p>

          <div style="display:flex; gap:10px; margin-top:20px;">
            <div style="flex:1;">
              <label style="font-size:12px; font-weight:bold; color:#64748b;">{{ $t('pos.qa_lbl_box') }} ({{ quickAdjustItem?.custom_pack_qty || 1 }}입)</label>
              <input type="number" v-model.number="quickAdjustForm.input_box" class="search-bar" placeholder="0" min="0" style="margin-top:5px; padding: 10px;"/>
            </div>
            <div style="flex:1;">
              <label style="font-size:12px; font-weight:bold; color:#64748b;">{{ $t('pos.qa_lbl_each') }}</label>
              <input type="number" v-model.number="quickAdjustForm.input_each" class="search-bar" placeholder="0" min="0" style="margin-top:5px; padding: 10px;"/>
            </div>
          </div>

          <div v-if="!quickAdjustItem?.valuation_rate" style="margin-top:15px; background: #fffbeb; padding: 12px; border-radius:6px; border: 1px solid #fde68a;">
            <label style="font-size:12px; font-weight:bold; color:#b45309;">{{ $t('pos.qa_req_val') }}</label>
            <p style="font-size: 11px; color:#b45309; margin:4px 0;">{{ $t('pos.qa_req_val_desc') }}</p>
            <input type="number" v-model.number="quickAdjustForm.valuation_rate" class="search-bar" :placeholder="$t('pos.qa_ph_val')" style="margin-top:5px; border-color:#fcd34d; padding: 10px;" />
          </div>
          <div v-else style="margin-top:15px; text-align:right;">
            <span style="font-size:12px; color:#64748b; font-weight:bold;">{{ $t('pos.qa_cur_val') }}: {{ quickAdjustItem.valuation_rate }}</span>
          </div>

        </div>
        
        <div class="modal-footer" style="margin-top: 25px; display:flex; justify-content:flex-end; gap:10px;">
          <button style="padding:10px 16px; background:#f1f5f9; color:#475569; border:none; border-radius:6px; font-weight:bold; cursor:pointer;" @click="isQuickAdjustModalOpen = false" :disabled="isAdjusting">{{ $t('pos.qa_btn_cancel') }}</button>
          <button style="padding:10px 20px; background:#00a896; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;" @click="submitQuickAdjust" :disabled="isAdjusting">
            {{ isAdjusting ? $t('pos.qa_btn_adjusting') : $t('pos.qa_btn_submit') }}
          </button>
        </div>
      </div>
    </div>

    <!-- 잔여 예약 종결 모달 -->
    <div class="modal-overlay" v-if="isPartialCloseModalOpen">
      <div class="modal-content partial-close-modal" style="text-align:center; padding:30px; border-radius:12px; max-width:400px;">
        <h3 style="margin-bottom:20px; font-size:1.4em; color:#333;">잔여 예약 처리</h3>
        <p style="font-size:1.1em; line-height:1.5; margin-bottom:30px;">
          <strong>{{ partialCloseReservationId }}</strong>번 예약<br>부분출고 했습니다.<br><br>잔여분을 예약으로 유지하시겠습니까?
        </p>
        <div class="modal-actions" style="display:flex; gap:15px; justify-content:center;">
          <button class="btn btn-secondary" style="flex:1; padding:12px; font-size:1.1em; background-color:#10b981; color:white; border:none; border-radius:6px; cursor:pointer;" @click="cancelPartialClose">유지 (계속 대기)</button>
          <button class="btn btn-danger" style="flex:1; padding:12px; font-size:1.1em; background-color:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer;" @click="confirmPartialClose">취소(삭제)</button>
        </div>
      </div>
    </div>

    <!-- 🌟 퀵 추가 모달 -->
    <QuickItemAddModal :is-open="isQuickItemModalOpen" @close="isQuickItemModalOpen = false" @success="handleItemSuccess" />
    <QuickCustomerAddModal :is-open="isQuickCustomerModalOpen" @close="isQuickCustomerModalOpen = false" @success="handleCustomerSuccess" />
    <QuickSalesPersonAddModal :is-open="isQuickSalesPersonModalOpen" :branch-list="warehouseList" :default-branch="currentTab?.selectedBranch" @close="isQuickSalesPersonModalOpen = false" @success="handleSalesPersonSuccess" />

    <!-- 🚚 배송지 선택 모달 -->
    <div class="modal-overlay" v-if="isShippingAddressModalOpen">
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <div class="product-title">DIRECCIÓN DE ENTREGA (배송지 선택)</div>
          <button class="close-btn" @click="cancelShippingAddress">✖</button>
        </div>
        <div class="modal-body" style="margin-top: 15px;">
          <p style="margin-bottom: 10px; color: #475569;">El cliente tiene varias direcciones. Seleccione una para el comprobante.</p>
          <ul style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;">
            <li v-for="(addr, idx) in shippingAddressList" :key="idx" 
                @click="selectShippingAddress(addr)"
                style="padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; transition: background 0.2s; background: white;"
                onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
              <strong>{{ addr.city }}</strong><br/>
              <span style="color: #64748b; font-size: 0.9em;">{{ addr.address_line1 }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
  <ReceiptPrint ref="receiptPrintRef" :receiptData="receiptPrintData" :items="receiptPrintItems" />
  <SamdoriVoiceAssistant
    ref="samdori"
    :valid-items="validItemCodes"
    :pending-stock-item="pendingVoiceStockItem"
    @intent-parsed="handleSamdoriIntent"
  />
  <!-- 지점장 PIN (사이드바에서도 열림 — 프론트 전용) -->
  <div
    v-if="branchSession.pinModalOpen"
    style="position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:99999; display:flex; align-items:center; justify-content:center;"
    @click.self="branchSession.closePinModal()"
  >
    <div style="background:white; border-radius:12px; width:min(380px,92vw); padding:20px; box-shadow:0 20px 50px rgba(0,0,0,0.25);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 style="margin:0; font-size:18px;">🔐 지점장 PIN 잠금해제</h3>
        <button type="button" style="border:none; background:transparent; font-size:18px; cursor:pointer;" @click="branchSession.closePinModal()">✕</button>
      </div>
      <p style="font-size:13px; color:#64748b; margin:0 0 12px 0;">점원 계정은 Frappe에 없습니다. PIN은 이 기기 localStorage에만 저장됩니다.</p>
      <input
        v-model="branchSession.pinInput"
        type="password"
        inputmode="numeric"
        maxlength="4"
        placeholder="4자리 PIN"
        style="width:100%; box-sizing:border-box; padding:12px; font-size:22px; letter-spacing:8px; text-align:center; border:1px solid #cbd5e1; border-radius:8px;"
        @keyup.enter="onBranchPinUnlock"
      />
      <p v-if="branchSession.pinError" style="color:#ef4444; font-weight:700; margin:10px 0 0;">{{ branchSession.pinError }}</p>
      <div style="display:flex; gap:10px; margin-top:16px;">
        <button type="button" style="flex:1; padding:12px; border-radius:8px; border:1px solid #cbd5e1; background:#f8fafc; font-weight:700; cursor:pointer;" @click="branchSession.closePinModal()">취소</button>
        <button type="button" style="flex:1; padding:12px; border-radius:8px; border:none; background:#0ea5e9; color:white; font-weight:800; cursor:pointer;" @click="onBranchPinUnlock">잠금해제</button>
      </div>
    </div>
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
import { useBranchSessionStore } from '../stores/branchSession.js'
import { useItemSearch, rankItemNameMatches } from '../composables/useItemSearch.js'
import { usePagedList } from '../composables/usePagedList.js'
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
import QuickItemAddModal from '../components/QuickItemAddModal.vue'
import QuickCustomerAddModal from '../components/QuickCustomerAddModal.vue'
import QuickSalesPersonAddModal from '../components/QuickSalesPersonAddModal.vue'
import ReservationListView from './ReservationListView.vue'
import OutboundListView from './OutboundListView.vue'
import OutboundHistoryListView from './OutboundHistoryListView.vue'
import InboundListView from './InboundListView.vue'
import InboundHistoryListView from './InboundHistoryListView.vue'
import ProductDetailView from './ProductDetailView.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { isMobile } = useMobile()
const isAdmin = computed(() => authStore.isAdmin)
const branchSession = useBranchSessionStore()
const { t, locale } = useI18n();

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

const handleLogout = async () => {
  await authStore.logout()
  await router.replace('/login')
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
    alert('잔여분이 성공적으로 취소(종결)되었습니다.');
  } catch (e) {
    console.warn('Stopped 메서드 호출 실패, set_value 로 백업 시도', e);
    try {
      await frappeApi.post('/api/method/frappe.client.set_value', {
        doctype: 'Material Request',
        name: partialCloseReservationId.value,
        fieldname: 'status',
        value: 'Stopped'
      })
      alert('잔여분이 성공적으로 취소(종결)되었습니다.');
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
      alert('✅ 영수증이 클립보드에 복사되었습니다!\n\n🚨 잊지 말고 꼭 [WhatsApp]에 붙여넣기(Ctrl+V) 해주세요!')
    } else {
      alert("영수증 클립보드 복사에 실패했습니다.")
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
      totalActual = Number(itemBins[warehouse]) || 0;
    } else {
      for (const wh in itemBins) {
        totalActual += Number(itemBins[wh]) || 0;
      }
    }
  }

  let totalReserved = 0;
  if (warehouse) {
    totalReserved = pendingReservedMap.value[warehouse]?.[itemCode] || 0;
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
          filters: JSON.stringify([['docstatus', '=', 0], ['custom_approval_stage', '=', '대기(지점장)']]),
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
          fields: JSON.stringify(['item_code', 'price_list_rate', 'price_list']),
          filters: JSON.stringify([['price_list', '=', 'Standard Selling']]),
          limit_page_length: 0
        }
      }).catch(() => ({ data: { data: [] } }))
    ]);

    warehouseList.value = whRes.data.data
    binData.value = binRes.data.data || []
    customerList.value = custRes.data.data || []
    salesPersonList.value = spRes.data.data || []
    supplierList.value = supRes.data.data || []

    const priceList = priceRes.data.data || []
    const priceMap = {}
    priceList.forEach(p => {
      if (p.item_code) {
        priceMap[p.item_code] = Number(p.price_list_rate || 0)
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
      
      groupedByName[groupId].variants.push({
        ...item,
        price_list_rate: priceMap[item.name] || Number(item.valuation_rate || 0),
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
      alert('보안 세션이 만료되었습니다. 다시 로그인해 주세요.')
      await authStore.logout()
      await router.replace('/login')
    } else if (status === 403) {
      alert('데이터 조회 권한이 없습니다. 계정 역할(Frappe)을 확인하세요. (세션은 유지됩니다)')
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
    alert('점원 모드에서는 판매 보류(지점 POS)만 사용할 수 있습니다.\n지점장 PIN으로 잠금해제 하세요.')
    branchSession.openPinModal()
    return
  }

  if (currentTab.value && (currentTab.value.activeReservationId || currentTab.value.amendingStockEntry)) {
    const isEntryView = activeNav.value === 'outbound' || activeNav.value === 'inbound' || activeNav.value === 'transfer' || activeNav.value === 'branch-transfer'
    if (isEntryView) {
      if (!confirm("진행 중인 예약/전표 수정을 취소하시겠습니까?\\n(확인 시 장바구니가 비워지고 수정이 취소됩니다.)")) {
        return
      }
      currentTab.value.activeReservationId = null
      currentTab.value.amendingStockEntry = null
      currentTab.value.amendSourceNav = null
      currentTab.value.cartItems = []
      currentTab.value.selectedCustomer = ''
      currentTab.value.selectedResponder = ''
      currentTab.value.selectedRequester = authStore.user?.member_name || ''
      currentTab.value.selectedSource = ''
      currentTab.value.selectedTarget = ''
    }
  }
  
  activeNav.value = nav
  if (mode) {
    setTransactionMode(mode)
  }
  
  if (currentTab.value && !currentTab.value.activeReservationId && !currentTab.value.amendingStockEntry) {
    currentTab.value.title = transactionMode.value === 'inbound' ? t('pos.msg_new_inbound')
      : transactionMode.value === 'transfer' ? t('pos.msg_new_transfer')
      : t('pos.msg_new_outbound')
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

const loadOutboundToCart = (entry) => {
  activeNav.value = 'outbound'
  setTransactionMode('outbound')

  if (currentTab.value) {
    currentTab.value.title = `출고 수정: ${entry.name}`
    currentTab.value.amendingStockEntry = entry.name
    currentTab.value.amendSourceNav = entry.sourceNav || 'outbound-list'
    
    currentTab.value.selectedSource = entry.from_warehouse || ''
    currentTab.value.selectedBranch = entry.custom_ordering_branch || ''
    currentTab.value.selectedResponder = entry.custom_orderer || ''
    currentTab.value.selectedCustomer = entry.custom_customer || ''
    
    const newCart = []
    entry.items.forEach(item => {
      const qty = Number(item.qty) || 0
      if (qty > 0) {
        const prod = rawSingleItems.value.find(p => p.name === item.item_code)
        let input_box = 0
        let input_each = qty
        
        if (prod && prod.custom_pack_qty) {
           input_box = Math.floor(qty / prod.custom_pack_qty)
           input_each = qty % prod.custom_pack_qty
        }
        
        newCart.push({
          name: item.item_code,
          item_name: item.item_name || item.item_code,
          custom_color: prod ? prod.custom_color : '',
          custom_pack_qty: prod ? (prod.custom_pack_qty || 1) : 1,
          input_box: input_box,
          input_each: input_each
        })
      }
    })
    currentTab.value.cartItems = newCart
  }
}

const loadInboundToCart = (entry) => {
  activeNav.value = 'inbound'
  setTransactionMode('inbound')

  if (currentTab.value) {
    currentTab.value.title = `입고 수정: ${entry.name}`
    currentTab.value.amendingStockEntry = entry.name
    currentTab.value.amendSourceNav = entry.sourceNav || 'inbound-list'
    
    currentTab.value.selectedBranch = entry.custom_ordering_branch || ''
    currentTab.value.selectedTarget = entry.to_warehouse || ''
    currentTab.value.selectedResponder = entry.custom_orderer || ''
    currentTab.value.selectedCustomer = entry.custom_customer || ''
    currentTab.value.selectedSupplier = entry.supplier || ''
    
    const newCart = []
    entry.items.forEach(item => {
      const qty = Number(item.qty) || 0
      if (qty > 0) {
        const prod = rawSingleItems.value.find(p => p.name === item.item_code)
        let input_box = 0
        let input_each = qty
        
        if (prod && prod.custom_pack_qty) {
           input_box = Math.floor(qty / prod.custom_pack_qty)
           input_each = qty % prod.custom_pack_qty
        }
        
        newCart.push({
          name: item.item_code,
          item_name: item.item_name || item.item_code,
          custom_color: prod ? prod.custom_color : '',
          custom_pack_qty: prod ? (prod.custom_pack_qty || 1) : 1,
          input_box: input_box,
          input_each: input_each
        })
      }
    })
    currentTab.value.cartItems = newCart
  }
}

const cancelAmend = () => {
  if (currentTab.value) {
    const returnNav = currentTab.value.amendSourceNav
    currentTab.value.amendingStockEntry = null
    currentTab.value.amendSourceNav = null
    currentTab.value.title = transactionMode.value === 'inbound' ? t('pos.msg_new_inbound')
      : transactionMode.value === 'transfer' ? t('pos.msg_new_transfer')
      : t('pos.msg_new_outbound')
    const defaultNav = transactionMode.value === 'inbound' ? 'inbound-list'
      : transactionMode.value === 'transfer' ? 'transfer-list'
      : 'outbound-list'
    activeNav.value = returnNav || defaultNav
    currentTab.value.cartItems = []
  }
}

// 🌟 예약출고 취소: 장바구니를 초기화하고 예약 리스트로 돌아가기 🌟
const cancelReservationCheckout = () => {
  if (!confirm(t('pos.msg_res_cancel_cfm'))) return
  if (currentTab.value) {
    currentTab.value.activeReservationId = null
    currentTab.value.cartItems = []
    currentTab.value.selectedCustomer = ''
    currentTab.value.selectedResponder = ''
    currentTab.value.selectedRequester = authStore.user?.member_name || ''
    currentTab.value.selectedSource = ''
    currentTab.value.selectedTarget = ''
    currentTab.value.title = transactionMode.value === 'transfer' ? t('pos.msg_new_transfer') : t('pos.msg_new_outbound')
  }
  activeNav.value = transactionMode.value === 'transfer' ? 'transfer-reservation' : 'outbound-reservation'
}

// Sales Person 드롭다운(지점 필터)에 보이도록 요청자 값을 해석·주입
const ensureSalesPersonOption = (spName, displayName = '', branchHint = '') => {
  if (!spName) return ''
  const branch = branchHint || currentTab.value?.selectedTarget || ''
  const existing = salesPersonList.value.find(sp => sp.name === spName)
  if (existing) {
    if (branch && !existing.custom_branch) existing.custom_branch = branch
    return existing.name
  }
  salesPersonList.value.push({
    name: spName,
    sales_person_name: displayName || spName,
    custom_branch: branch || undefined
  })
  return spName
}

const findSalesPersonByLabel = (label) => {
  if (!label) return null
  const q = String(label).trim().toLowerCase()
  return salesPersonList.value.find(sp =>
    sp.name?.toLowerCase() === q ||
    sp.sales_person_name?.toLowerCase() === q
  ) || null
}

/** Stock Entry / MR 문서에서 재고이동요청자(selectedResponder)로 쓸 Sales Person name 해석 */
const resolveTransferRequester = async (entry) => {
  const branch = entry.to_warehouse || entry.set_warehouse || currentTab.value?.selectedTarget || ''

  const tryResolve = async (raw) => {
    if (!raw) return ''
    const direct = findSalesPersonByLabel(raw)
    if (direct) return ensureSalesPersonOption(direct.name, direct.sales_person_name, branch)

    // User 이메일이면 full_name 으로 Sales Person 매칭
    try {
      const userRes = await frappeApi.get(`/api/resource/User/${encodeURIComponent(raw)}`)
      const fullName = userRes.data?.data?.full_name
      if (fullName) {
        const byFull = findSalesPersonByLabel(fullName)
        if (byFull) return ensureSalesPersonOption(byFull.name, byFull.sales_person_name, branch)
        return ensureSalesPersonOption(raw, fullName, branch)
      }
    } catch (e) { /* User 문서가 아니면 Sales Person ID로 간주 */ }

    return ensureSalesPersonOption(raw, raw, branch)
  }

  // 1) Stock Entry / 문서의 custom_orderer
  const fromOrderer = await tryResolve(entry.custom_orderer)
  if (fromOrderer) return fromOrderer

  // 2) 연결된 Material Request 의 custom_orderer (STE Draft에 요청자가 비어 있는 경우 복구)
  const mrLinks = [...new Set((entry.items || []).map(i => i.material_request).filter(Boolean))]
  for (const mrName of mrLinks) {
    try {
      const mrRes = await frappeApi.get(`/api/resource/Material Request/${encodeURIComponent(mrName)}`)
      const mrOrderer = mrRes.data?.data?.custom_orderer
      const fromMr = await tryResolve(mrOrderer)
      if (fromMr) return fromMr
    } catch (e) {
      console.warn('MR requester resolve failed:', e)
    }
  }

  // 3) owner 최후 수단 (이메일이면 드롭다운에 맞게 주입)
  return await tryResolve(entry.owner)
}

// 🌟 예약 내역을 장바구니로 로드 🌟
const loadReservationToCart = async (res) => {
  const isTransfer = res.material_request_type === 'Material Transfer'
  const targetMode = isTransfer ? 'transfer' : 'outbound'
  
  activeNav.value = targetMode
  setTransactionMode(targetMode)

  if (currentTab.value) {
    currentTab.value.title = `예약 작업: ${res.name}`
    currentTab.value.activeReservationId = res.name
    
    currentTab.value.selectedCustomer = res.custom_customer || res.customer || ''
    currentTab.value.selectedBranch = res.custom_ordering_branch || (!isTransfer && res.material_request_type !== 'Material Issue' ? res.set_warehouse : '') || ''
    currentTab.value.selectedSource = res.set_from_warehouse || (res.material_request_type === 'Material Issue' ? res.set_warehouse : '') || ''
    currentTab.value.reservationOriginalSource = currentTab.value.selectedSource
    currentTab.value.selectedTarget = isTransfer ? res.set_warehouse : ''

    const responder = await resolveTransferRequester({
      custom_orderer: res.custom_orderer,
      to_warehouse: currentTab.value.selectedTarget,
      set_warehouse: res.set_warehouse,
      owner: res.owner,
      items: res.items || []
    })
    currentTab.value.selectedResponder = responder
    currentTab.value.selectedRequester = res.custom_branch_requester || ''
    
    const newCart = []
    res.items.forEach(item => {
      const fulfilledQty = Number(item.ordered_qty || item.received_qty || item.issued_qty || 0)
      const remainingQty = Number(item.qty) - fulfilledQty
      if (remainingQty > 0) {
        const prod = rawSingleItems.value.find(p => p.name === item.item_code)
        let input_box = 0
        let input_each = remainingQty
        
        if (prod && prod.custom_pack_qty) {
           input_box = Math.floor(remainingQty / prod.custom_pack_qty)
           input_each = remainingQty % prod.custom_pack_qty
        }
        
        newCart.push({
          name: item.item_code,
          item_name: item.item_name || item.item_code,
          custom_color: prod ? prod.custom_color : '',
          custom_pack_qty: prod ? (prod.custom_pack_qty || 1) : 1,
          input_box: input_box,
          input_each: input_each,
          mr_item_id: item.name, // 부분 출고 연결고리
          mr_name: res.name || undefined,
          mr_qty: remainingQty // 예약 잔량 초과 출고 시 행 분리를 위한 잔량 저장
        })
      }
    })
    
    currentTab.value.cartItems = newCart
  }
}

// 🌟 재고이동 전표를 장바구니로 로드
const loadTransferToCart = async (entry) => {
  activeNav.value = 'transfer'
  setTransactionMode('transfer')
  if (currentTab.value) {
    currentTab.value.title = `이동 수정: ${entry.name}`
    currentTab.value.amendingStockEntry = entry.name
    currentTab.value.amendSourceNav = entry.sourceNav || 'transfer-list'
    currentTab.value.selectedSource = entry.from_warehouse || ''
    currentTab.value.selectedTarget = entry.to_warehouse || ''
    currentTab.value.selectedResponder = await resolveTransferRequester({
      custom_orderer: entry.custom_orderer,
      to_warehouse: entry.to_warehouse,
      owner: entry.owner,
      items: entry.items || []
    })
    const newCart = []
    entry.items.forEach(item => {
      const qty = Number(item.qty) || 0
      if (qty > 0) {
        const prod = rawSingleItems.value.find(p => p.name === item.item_code)
        let input_box = 0
        let input_each = qty
        if (prod && prod.custom_pack_qty) {
          input_box = Math.floor(qty / prod.custom_pack_qty)
          input_each = qty % prod.custom_pack_qty
        }
        newCart.push({
          name: item.item_code,
          item_name: item.item_name || item.item_code,
          custom_color: prod ? prod.custom_color : '',
          custom_pack_qty: prod ? (prod.custom_pack_qty || 1) : 1,
          input_box,
          input_each
        })
      }
    })
    currentTab.value.cartItems = newCart
  }
}

// 🌟 초안 대기열 문서를 장바구니로 로드
const loadDraftToCart = async (docName) => {
  try {
    const res = await frappeApi.get(`/api/resource/Stock Entry/${docName}`)
    const entry = res.data.data

    activeNav.value = 'transfer'
    setTransactionMode('transfer')

    if (currentTab.value) {
      currentTab.value.title = `초안 대기열: ${entry.name}`
      currentTab.value.amendingStockEntry = entry.name
      currentTab.value.amendSourceNav = 'transfer-reservation'
      currentTab.value.selectedSource = entry.from_warehouse || ''
      currentTab.value.selectedTarget = entry.to_warehouse || ''

      // 요청자: custom_orderer → (없으면) 연결 MR → Sales Person 드롭다운에 맞게 해석
      currentTab.value.selectedResponder = await resolveTransferRequester(entry)
      
      const newCart = []
      entry.items.forEach(item => {
        const qty = Number(item.qty) || 0
        if (qty > 0) {
          const prod = rawSingleItems.value.find(p => p.name === item.item_code)
          let input_box = 0
          let input_each = qty
          if (prod && prod.custom_pack_qty) {
            input_box = Math.floor(qty / prod.custom_pack_qty)
            input_each = qty % prod.custom_pack_qty
          }
          newCart.push({
            name: item.item_code,
            item_name: item.item_name || item.item_code,
            custom_color: prod ? prod.custom_color : '',
            custom_pack_qty: prod ? (prod.custom_pack_qty || 1) : 1,
            input_box,
            input_each,
            mr_item_id: item.material_request_item || undefined,
            mr_name: item.material_request || undefined,
            mr_qty: qty
          })
        }
      })
      currentTab.value.cartItems = newCart

      // Draft에 custom_orderer가 비어 있었고 MR에서 복구했다면, 문서에도 되돌려 저장(이후 재로드 안정화)
      if (currentTab.value.selectedResponder && !entry.custom_orderer) {
        try {
          await frappeApi.put(`/api/resource/Stock Entry/${entry.name}`, {
            custom_orderer: currentTab.value.selectedResponder
          })
        } catch (e) {
          console.warn('Draft custom_orderer backfill skipped:', e)
        }
      }
    }
  } catch(e) {
    console.error('Draft load error:', e)
    alert('대기열 문서를 불러오지 못했습니다.')
  }
}

const addSingleHotkeyToCart = (prod) => {
  if (!currentTab.value) return

  // 🌟 출고·재고이동 모드일 때 실시간 가용 재고를 체크하여 없으면 퀵 조정 모달 호출
  if (transactionMode.value === 'outbound' || transactionMode.value === 'transfer') {
    const warehouse = currentTab.value.selectedSource;
    if (warehouse) {
      const currentStock = getAvailableStock(prod.name, warehouse);
      if (currentStock <= 0) {
        quickAdjustItem.value = prod;
        quickAdjustForm.value = { input_box: 0, input_each: 0, valuation_rate: prod.valuation_rate || 0 };
        pendingCartAction.value = () => { addSingleToCartInternal(prod) };
        isQuickAdjustModalOpen.value = true;
        return;
      }
    }
  }

  addSingleToCartInternal(prod);
}

const addSingleToCartInternal = (prod) => {
  const existing = currentTab.value.cartItems.find(item => item.name === prod.name)
  if (existing) { 
    existing.input_box += 1 
  } else { 
    currentTab.value.cartItems.push({ ...prod, input_box: 1, input_each: 0 }) 
  }
}

const changeQtyBy10 = (cartItem, amount) => {
  const newQty = (cartItem.input_each || 0) + amount
  if (newQty < 0) {
    cartItem.input_each = 0
  } else {
    cartItem.input_each = newQty
  }
}

const removeFromCart = (itemName) => {
  if (!currentTab.value) return
  currentTab.value.cartItems = currentTab.value.cartItems.filter(item => item.name !== itemName)
}

// 🌟 퀵 재고조정 실행 함수
const submitQuickAdjust = async () => {
  const boxQty = Number(quickAdjustForm.value.input_box) || 0;
  const eachQty = Number(quickAdjustForm.value.input_each) || 0;
  const packQty = quickAdjustItem.value.custom_pack_qty || 1;
  const totalQty = (boxQty * packQty) + eachQty;
  const valRate = Number(quickAdjustForm.value.valuation_rate);

  if (totalQty <= 0) {
    alert(t('pos.msg_err_qty'));
    return;
  }
  
  if (!quickAdjustItem.value.valuation_rate && valRate <= 0) {
    alert(t('pos.msg_err_no_val'));
    return;
  }

  isAdjusting.value = true;
  try {
    // 퀵재고조정은 무조건 현재 지점(Source)에 물건을 채우는 것으로 가정합니다.
    const warehouse = currentTab.value?.selectedSource || currentTab.value?.selectedTarget;
    if (!warehouse) {
      alert(t('pos.msg_err_no_wh'));
      isAdjusting.value = false;
      return;
    }

    const stockEntryPayload = {
      stock_entry_type: 'Material Receipt',
      company: 'kecon',
      custom_creator: currentTab.value.selectedCreator || undefined,
      custom_branch: currentTab.value.selectedBranch || undefined,
      items: [{
        item_code: quickAdjustItem.value.name,
        t_warehouse: warehouse,
        qty: totalQty,
        basic_rate: valRate || quickAdjustItem.value.valuation_rate
      }]
    };

    const res = await frappeApi.post('/api/resource/Stock Entry', stockEntryPayload);
    const docName = res.data.data.name;
    
    await frappeApi.put(`/api/resource/Stock Entry/${docName}`, { docstatus: 1 });
    
    // 프론트엔드 로컬 재고(binData) 즉각 업데이트 (새로고침 없이 반영)
    const existingBin = binData.value.find(b => b.item_code === quickAdjustItem.value.name && b.warehouse === warehouse);
    if (existingBin) {
      existingBin.actual_qty = Number(existingBin.actual_qty) + totalQty;
    } else {
      binData.value.push({
        item_code: quickAdjustItem.value.name,
        warehouse: warehouse,
        actual_qty: totalQty
      });
    }

    isQuickAdjustModalOpen.value = false;

    // 잠시 중단했던 장바구니 담기 액션 마저 실행
    if (pendingCartAction.value) {
      pendingCartAction.value();
    }
  } catch (error) {
    console.error("Quick Adjust Error:", error);
    alert(t('pos.msg_err_adjust'));
  } finally {
    isAdjusting.value = false;
  }
}

const openGridModal = (group) => {
  activeGroup.value = group
  isGridModalOpen.value = true
}

const submitGridSelection = () => {
  if (!currentTab.value) return
  
  const selectedVariants = activeGroup.value.variants.filter(v => v.input_box > 0 || v.input_each > 0)
  if (selectedVariants.length === 0) {
    isGridModalOpen.value = false
    return
  }

  // 🌟 출고 모드일 경우 재고가 0 이하인 항목을 찾아 퀵 재고조정 연동
  if (transactionMode.value === 'outbound') {
    const warehouse = currentTab.value.selectedSource;
    let firstOutOfStock = null;
    
    for (const v of selectedVariants) {
      const currentStock = getAvailableStock(v.name, warehouse);
      
      if (currentStock <= 0) {
        firstOutOfStock = v;
        break; // 한 번에 하나씩 퀵 재고조정 모달을 띄웁니다.
      }
    }

    if (firstOutOfStock) {
      quickAdjustItem.value = firstOutOfStock;
      quickAdjustForm.value = {
        input_box: 0,
        input_each: 0,
        valuation_rate: firstOutOfStock.valuation_rate || 0
      };
      
      // 퀵 조정을 완료하면 다시 submitGridSelection을 호출하여 남은 항목 검사 및 장바구니 담기 진행 (재귀 방식)
      pendingCartAction.value = () => { 
        submitGridSelection() 
      };
      isQuickAdjustModalOpen.value = true;
      return; // 장바구니에 담기 전에 여기서 일시 정지
    }
  }

  // 재고가 모두 충족되었거나 출고 모드가 아니면 장바구니에 모두 담기
  selectedVariants.forEach(v => {
    const existing = currentTab.value.cartItems.find(item => item.name === v.name)
    if (existing) {
      existing.input_box += v.input_box || 0
      existing.input_each += v.input_each || 0
    } else {
      currentTab.value.cartItems.push({
        name: v.name,
        item_name: activeGroup.value.group_name,
        custom_color: v.custom_color,
        custom_pack_qty: v.custom_pack_qty || 1,
        input_box: v.input_box || 0,
        input_each: v.input_each || 0
      })
    }
    
    // 장바구니에 담은 후 입력창 초기화
    v.input_box = 0
    v.input_each = 0
  })
  
  isGridModalOpen.value = false
}

const openInlineEdit = (type, target) => {
  alert(t('pos.msg_info_shortcut'));
}

// 🌟 Frappe 백엔드로 실제 전표(Stock Entry) 전송 로직
const submitToFrappe = async () => {
  if (!currentTab.value || currentTab.value.cartItems.length === 0) {
    alert(t('pos.msg_err_empty_cart'));
    return;
  }

  try {
    // 🌟 수정 모드일 경우: 기존 전표 취소(Cancel) 처리 먼저 수행
    let validAmendedFrom = undefined;
    if (currentTab.value.amendingStockEntry) {
      try {
        await frappeApi.post('/api/method/frappe.client.cancel', {
          doctype: 'Stock Entry',
          name: currentTab.value.amendingStockEntry
        });
        console.log(`기존 전표 ${currentTab.value.amendingStockEntry} 취소 완료`);
        validAmendedFrom = currentTab.value.amendingStockEntry;
      } catch (cancelErr) {
        console.error('기존 전표 취소 실패 (Submit 안 된 Draft일 수 있음):', cancelErr);
        try {
          await frappeApi.delete(`/api/resource/Stock Entry/${currentTab.value.amendingStockEntry}`);
          console.log(`Draft 전표 삭제 완료`);
        } catch(delErr) {
          console.error('Draft 전표 삭제 실패:', delErr);
        }
      }
    }

    // 유연한 물동량 처리 로직 (회계 이슈 우회)
    let entryType = 'Material Issue';
    let fromWh = undefined;
    let toWh = undefined;

    if (transactionMode.value === 'inbound') {
      if (!currentTab.value.selectedTarget) {
        alert(t('pos.msg_err_no_target'));
        return;
      }
      entryType = 'Material Receipt';
      fromWh = undefined;
      toWh = currentTab.value.selectedTarget;
    } else if (transactionMode.value === 'transfer') {
      if (!currentTab.value.selectedSource || !currentTab.value.selectedTarget) {
        alert(t('pos.msg_err_no_src_tgt'));
        return;
      }
      entryType = 'Material Transfer';
      fromWh = currentTab.value.selectedSource;
      toWh = currentTab.value.selectedTarget;
    } else {
      // 출고 (Material Issue)
      entryType = 'Material Issue';
      fromWh = currentTab.value.selectedSource || undefined;
      toWh = undefined;
    }

    // Frappe Stock Entry 규격에 맞게 페이로드 조립
    const stockEntryPayload = {
      docstatus: 0, // 0: Draft, 1: Submit
      stock_entry_type: entryType,
      from_warehouse: fromWh,
      to_warehouse: toWh,
      amended_from: validAmendedFrom,
      
      
      custom_ordering_branch: transactionMode.value === 'outbound' ? (currentTab.value.selectedBranch || undefined) : undefined,
      custom_orderer: currentTab.value.selectedResponder || undefined,
      custom_customer: transactionMode.value === 'outbound' ? currentTab.value.selectedCustomer || undefined : undefined,
      supplier: transactionMode.value === 'inbound' ? currentTab.value.selectedSupplier || undefined : undefined,

      items: currentTab.value.cartItems.flatMap(item => {
        const totalQty = (Number(item.input_box) * (item.custom_pack_qty || 1)) + Number(item.input_each);
        
        // 예약 항목이고, 출고하려는 수량이 남은 예약 수량을 초과한다면 두 줄로 쪼갭니다.
        if (item.mr_item_id && item.mr_qty && totalQty > item.mr_qty) {
          const excessQty = totalQty - item.mr_qty;
          return [
            {
              item_code: item.name,
              qty: item.mr_qty,
              s_warehouse: fromWh,
              t_warehouse: toWh,
              allow_zero_valuation_rate: 1,
              material_request: item.mr_name || currentTab.value.activeReservationId || undefined,
              material_request_item: item.mr_item_id
            },
            {
              item_code: item.name,
              qty: excessQty,
              s_warehouse: fromWh,
              t_warehouse: toWh,
              allow_zero_valuation_rate: 1,
              material_request: undefined,
              material_request_item: undefined
            }
          ];
        }

        return [{
          item_code: item.name,
          qty: totalQty,
          s_warehouse: fromWh,
          t_warehouse: toWh,
          allow_zero_valuation_rate: 1,
          material_request: item.mr_item_id ? (item.mr_name || currentTab.value.activeReservationId || undefined) : undefined,
          material_request_item: item.mr_item_id || undefined
        }];
      })
    }

    const response = await frappeApi.post('/api/resource/Stock Entry', stockEntryPayload);

    if (response.status === 200) {
      const docName = response.data.data.name;
      
      try {
        await frappeApi.put(`/api/resource/Stock Entry/${docName}`, { docstatus: 1 });
        alert(t('pos.msg_success_submit', { title: currentTab.value.title }));
        
        // --- 전표 복사 및 인쇄 트리거 로직 ---
        if (transactionMode.value === 'outbound' && currentTab.value.selectedCustomer) {
          const customerName = currentTab.value.selectedCustomer;
          let phone = '';
          let addressList = [];
          
          try {
            const customerRes = await frappeApi.get(`/api/resource/Customer?filters=[["name","=","${encodeURIComponent(customerName)}"]]&fields=["custom_phone"]`);
            if (customerRes.data && customerRes.data.data && customerRes.data.data.length > 0) {
              phone = customerRes.data.data[0].custom_phone || '';
            }
          } catch(e) { console.error('Error fetching customer phone:', e) }
          
          try {
            const addressRes = await frappeApi.get(`/api/resource/Address?filters=[["Dynamic Link","link_name","=","${encodeURIComponent(customerName)}"],["Dynamic Link","link_doctype","=","Customer"]]&fields=["name","address_line1","city"]`);
            if (addressRes.data && addressRes.data.data) {
              addressList = addressRes.data.data;
            }
          } catch(e) { console.error('Error fetching customer addresses:', e) }

          if (addressList.length > 1) {
             pendingPrintData.value = { docName, mode: transactionMode.value, fromWh, toWh, branch: currentTab.value.selectedBranch, items: currentTab.value.cartItems };
             shippingAddressList.value = addressList;
             shippingPhone.value = phone;
             isShippingAddressModalOpen.value = true;
          } else {
             const selectedAddr = addressList.length === 1 ? addressList[0] : null;
             const shippingInfo = (selectedAddr || phone) ? { address: selectedAddr, phone } : null;
             triggerPrintAndCopy(docName, transactionMode.value, fromWh, toWh, currentTab.value.selectedBranch, currentTab.value.cartItems, shippingInfo);
          }
        } else {
          triggerPrintAndCopy(docName, transactionMode.value, fromWh, toWh, currentTab.value.selectedBranch, currentTab.value.cartItems, null);
        }
        
        // 🌟 수정을 성공적으로 마쳤으므로 amendingStockEntry 초기화
        if (currentTab.value.amendingStockEntry) {
          currentTab.value.amendingStockEntry = null;
          currentTab.value.amendSourceNav = null;
        }
      } catch (submitErr) {
        console.error('Submit 에러:', submitErr);
        let errorMsg = '알 수 없는 서버 에러';
        if (submitErr.response && submitErr.response.data) {
          const data = submitErr.response.data;
          if (data.exc_type) errorMsg = data.exc_type;
          if (data._server_messages) {
            try {
              const msgs = JSON.parse(data._server_messages).map(m => JSON.parse(m).message);
              errorMsg = msgs.join('\n');
            } catch(e){}
          }
        }
        alert(t('pos.msg_success_draft', { error: errorMsg }));
      }
      
      // 🌟 잔여분 취소 자동화 UI (앱 퀄리티 업그레이드)
      if (currentTab.value.activeReservationId) {
        try {
          // 약간의 지연을 주어 Frappe 백엔드가 상태를 업데이트할 시간을 줌
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // 방금 발행된 전표로 인해 예약이 완전히 종료(Completed)되었는지 상태 확인
          const mrStatusRes = await frappeApi.get(`/api/resource/Material Request/${currentTab.value.activeReservationId}?fields=["status", "per_ordered", "per_received", "material_request_type"]`);
          const mrData = mrStatusRes.data.data;
          const mrStatus = mrData.status;
          
          // 실제 수량 진행률로 완전히 완료되었는지 교차 검증 (안전 장치)
          let isFullyFulfilled = false;
          if (mrStatus === 'Completed' || mrStatus === 'Transferred' || mrStatus === 'Issued' || mrStatus === 'Received') {
            isFullyFulfilled = true;
          } else {
            // Frappe 상태 업데이트가 지연되었을 경우, 퍼센트로 판단
            if (mrData.material_request_type === 'Material Transfer' || mrData.material_request_type === 'Material Issue') {
               if (Number(mrData.per_ordered) >= 100) isFullyFulfilled = true;
            } else if (mrData.material_request_type === 'Material Receipt') {
               if (Number(mrData.per_received) >= 100) isFullyFulfilled = true;
            }
          }
          
          if (!isFullyFulfilled) {
             partialCloseReservationId.value = currentTab.value.activeReservationId;
             isPartialCloseModalOpen.value = true;
          }
        } catch (e) {
          console.error('잔여분 확인 에러', e)
        }
      }
      currentTab.value.cartItems = []; // 장바구니 비우기
      currentTab.value.activeReservationId = null; // 예약 상태 해제
      currentTab.value.reservationOriginalSource = null; // 예약 원본 소스 초기화
      fetchFrappeItems(); // 뱃지 수 갱신 등
    }
  } catch (error) {
    console.error('프라페 전송 에러:', error);
    let errorMsg = error.message || 'Unknown Server Error';
    if (error.response && error.response.data) {
      const data = error.response.data;
      if (data.exc_type) errorMsg = data.exc_type;
      if (data._server_messages) {
        try {
          const msgs = JSON.parse(data._server_messages).map(m => JSON.parse(m).message);
          errorMsg = msgs.join('\n');
        } catch(e){}
      }
    }
    alert(t('pos.msg_err_submit', { error: errorMsg }));
  }
}

// 🌟 예약 전표 (Material Request) 전송 로직
const submitReservation = async () => {
  if (!currentTab.value || currentTab.value.cartItems.length === 0) {
    alert(t('pos.msg_err_empty_cart'));
    return;
  }
  
  if (transactionMode.value !== 'inbound' && !currentTab.value.selectedSource) {
    alert(t('pos.msg_err_no_src_res'));
    return;
  }
  
  try {
    const scheduleDate = new Date();
    scheduleDate.setDate(scheduleDate.getDate() + 1); // 기본 예약일을 내일로 설정
    const dateStr = new Date(scheduleDate.getTime() - scheduleDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];

    let reqType = 'Material Issue'; // 기본 출고 예약
    let fromWh = currentTab.value.selectedSource || undefined;
    
    let payloadSetFromWh = undefined;
    let payloadSetWh = undefined;
    
    if (transactionMode.value === 'inbound') {
      reqType = 'Material Transfer'; // 입고 예약 (본사 -> 지점 요청)
      if (!currentTab.value.selectedSource) {
        reqType = 'Material Receipt';
        payloadSetWh = currentTab.value.selectedBranch || undefined;
      } else {
        payloadSetFromWh = fromWh || undefined;
        payloadSetWh = currentTab.value.selectedBranch || undefined;
      }
    } else if (transactionMode.value === 'transfer') {
      reqType = 'Material Transfer';
      if (!currentTab.value.selectedSource || !currentTab.value.selectedTarget) {
        alert(t('pos.msg_err_no_src_tgt'));
        return;
      }
      payloadSetFromWh = currentTab.value.selectedSource;
      payloadSetWh = currentTab.value.selectedTarget;
    } else {
      // 출고 모드 (Material Issue)
      // 출고의 경우, Frappe에서 set_warehouse가 출고(소스) 창고로 쓰입니다.
      payloadSetWh = fromWh || undefined;
    }

    const payload = {
      docstatus: 1, // 생성과 동시에 Submit 처리
      material_request_type: reqType,
      schedule_date: dateStr,
      set_from_warehouse: payloadSetFromWh,
      set_warehouse: payloadSetWh,
      customer: currentTab.value.selectedCustomer || undefined,
      custom_customer: currentTab.value.selectedCustomer || undefined,
      
      custom_ordering_branch: transactionMode.value === 'outbound' ? (currentTab.value.selectedBranch || undefined) : undefined,
      custom_orderer: currentTab.value.selectedResponder || undefined,
      
      items: currentTab.value.cartItems.map(item => {
        const totalQty = (Number(item.input_box) * (item.custom_pack_qty || 1)) + Number(item.input_each);
        return {
          item_code: item.name,
          qty: totalQty,
          schedule_date: dateStr,
          uom: 'Nos'
        }
      })
    }

    // 1. 만약 기존 예약을 불러와 수정한 것이라면 기존 문서를 취소 (Frappe는 제출된 문서의 아이템 수정 불가)
    if (currentTab.value.activeReservationId) {
      try {
        await frappeApi.post('/api/method/frappe.client.cancel', {
          doctype: 'Material Request',
          name: currentTab.value.activeReservationId
        })
      } catch (e) {
        console.warn('기존 예약 취소 중 오류 발생 (무시하고 새 예약 진행)', e)
      }
    }

    // 2. 임시저장(Draft) 생성
    const draftRes = await frappeApi.post('/api/resource/Material Request', payload);
    
    if (draftRes.data && draftRes.data.data) {
      const docName = draftRes.data.data.name;
      
      alert(t('pos.msg_success_res', { docName: docName }));
      currentTab.value.cartItems = []; // 장바구니 비우기
      currentTab.value.activeReservationId = null; // 예약 상태 해제
      fetchFrappeItems(); // 뱃지 수 갱신 등
    }
  } catch (error) {
    console.error('예약 전송 에러:', error);
    let errorMsg = error.message || 'Unknown Server Error';
    if (error.response && error.response.data) {
      const data = error.response.data;
      if (data.exc_type) errorMsg = data.exc_type;
      if (data._server_messages) {
        try {
          const msgs = JSON.parse(data._server_messages).map(m => JSON.parse(m).message);
          errorMsg = msgs.join('\n');
        } catch(e){}
      }
    }
    alert(t('pos.msg_err_res') + `\n\n[상세 사유]\n${errorMsg}`);
  }
}
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

const findProductForVoice = (itemCode) => {
  if (!itemCode) return null
  const key = String(itemCode).trim()
  const upper = key.toUpperCase()
  const exact =
    rawSingleItems.value.find((i) => i.name === key) ||
    rawSingleItems.value.find((i) => i.name?.toUpperCase() === upper)
  if (exact) return exact

  // Gemini가 P-160처럼 짧게 주면 변형 코드 중 유일/대표 1건 사용
  const prefixHits = rawSingleItems.value.filter(
    (i) => i.name?.toUpperCase() === upper || i.name?.toUpperCase().startsWith(`${upper}-`)
  )
  if (prefixHits.length === 1) return prefixHits[0]
  if (prefixHits.length > 1) {
    const negro = prefixHits.find((i) => /NEGRO/i.test(i.name))
    return negro || prefixHits[0]
  }

  // 품명(item_name) 부분 일치 — 유일할 때만
  const nameHits = rawSingleItems.value.filter((i) =>
    (i.item_name || '').toLowerCase().includes(key.toLowerCase())
  )
  if (nameHits.length === 1) return nameHits[0]
  return null
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
      const prod = findProductForVoice(item)
      if (!prod) {
        const msg = locale.value === 'es' ? `No se encontró ${item}.` : `${item} 품목을 찾을 수 없습니다.`
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

  if (!currentTab.value) return

  if (intent === 'add_order') {
    if (activeNav.value === 'branch-transfer' && branchTransferRef.value) {
      const prod = findProductForVoice(item)
      if (prod) {
        const inputQty = qty ? Number(qty) : 1
        for (let i = 0; i < inputQty; i++) {
          branchTransferRef.value.addFromVoice(prod)
        }
        const msg = locale.value === 'es' ? `${item} añadido al carrito.` : `${item} 장바구니에 담았습니다.`
        if (samdori.value) samdori.value.speak(msg)
      } else {
        const msg = locale.value === 'es' ? `No se encontró ${item}.` : `해당 품목 ${item} 을(를) 찾을 수 없습니다.`
        if (samdori.value) samdori.value.speak(msg)
      }
      return
    }

    const prod = findProductForVoice(item)
    if (prod) {
      addSingleToCartInternal(prod)
      const inputQty = qty ? Number(qty) : 1
      if (inputQty > 1) {
         const existing = currentTab.value.cartItems.find(i => i.name === prod.name)
         if (existing) {
           existing.input_box += (inputQty - 1)
         }
      }
      const msg = locale.value === 'es' ? `${item} añadido al carrito.` : `${item} 장바구니에 담았습니다.`
      if (samdori.value) samdori.value.speak(msg)
    } else {
      const msg = locale.value === 'es' ? `No se encontró ${item}.` : `창고에 ${item} 제품이 없습니다.`
      if (samdori.value) samdori.value.speak(msg)
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
      const packQty = prods[0].custom_pack_qty || 1
      const boxesAt = (warehouse) => {
        if (!warehouse) return 0
        let total = 0
        prods.forEach((prod) => {
          total += getAvailableStock(prod.name, warehouse)
        })
        return Math.floor(total / (packQty || 1))
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

      // ----- 관리자: 8개 창고 나열 안 함. 미지정/미인식이면 창고만 재질문 -----
      if (authStore.isAdmin) {
        if (!resolvedWh) {
          askWarehouseAgain()
          return
        }
        pendingVoiceStockItem.value = null
        const boxes = boxesAt(resolvedWh)
        speakStock(
          locale.value === 'es'
            ? `${stockItem}: ${voiceWarehouseLabel(resolvedWh)} ${boxes} cajas.`
            : `${stockItem}: ${voiceWarehouseLabel(resolvedWh)} ${boxes}박스 입니다.`
        )
        return
      }

      // ----- 지점장/점원: 본인 지점 + 알라르꼰만 (타 지점 요청은 부드럽게 폴백) -----
      pendingVoiceStockItem.value = null
      const allowed = new Set([MAIN_WAREHOUSE, branchWh].filter(Boolean))

      if (warehouseHint) {
        if (resolvedWh && allowed.has(resolvedWh)) {
          const boxes = boxesAt(resolvedWh)
          speakStock(
            locale.value === 'es'
              ? `${stockItem}: ${voiceWarehouseLabel(resolvedWh)} ${boxes} cajas.`
              : `${stockItem}: ${voiceWarehouseLabel(resolvedWh)} ${boxes}박스 입니다.`
          )
          return
        }
        // 타 지점/미인식 → 권한 안내 후 지점+본사 요약
        if (resolvedWh && !allowed.has(resolvedWh)) {
          const branchBoxes = boxesAt(branchWh)
          const mainBoxes = boxesAt(MAIN_WAREHOUSE)
          speakStock(
            locale.value === 'es'
              ? `Solo puede consultar su sucursal y Alarcón. ${stockItem}: sucursal ${branchBoxes} cajas, Alarcón ${mainBoxes} cajas.`
              : `지점 계정은 본인 지점과 알라르꼰만 조회할 수 있습니다. ${stockItem}: 지점 ${branchBoxes}박스, 알라르꼰 ${mainBoxes}박스 입니다.`
          )
          return
        }
        if (!resolvedWh) {
          // 지점장은 재질문보다 기본 요약이 더 매끄러움
          const branchBoxes = boxesAt(branchWh)
          const mainBoxes = boxesAt(MAIN_WAREHOUSE)
          speakStock(
            locale.value === 'es'
              ? `No entendí el almacén. ${stockItem}: sucursal ${branchBoxes} cajas, Alarcón ${mainBoxes} cajas.`
              : `창고명을 이해하지 못해 기본으로 안내합니다. ${stockItem}: 지점 ${branchBoxes}박스, 알라르꼰 ${mainBoxes}박스 입니다.`
          )
          return
        }
      }

      // 창고 미지정: 지점 + 알라르꼰 박스만
      const mainBoxes = boxesAt(MAIN_WAREHOUSE)
      if (branchWh && branchWh !== MAIN_WAREHOUSE) {
        const branchBoxes = boxesAt(branchWh)
        speakStock(
          locale.value === 'es'
            ? `${stockItem}: sucursal ${branchBoxes} cajas, Alarcón ${mainBoxes} cajas.`
            : `${stockItem}: 지점 ${branchBoxes}박스, 알라르꼰 ${mainBoxes}박스 입니다.`
        )
      } else {
        speakStock(
          locale.value === 'es'
            ? `${stockItem}: Alarcón ${mainBoxes} cajas.`
            : `${stockItem}: 알라르꼰 ${mainBoxes}박스 입니다.`
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
    } else if (currentTab.value) {
      cartItems = currentTab.value.cartItems
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
    if (transactionMode.value === 'outbound' || transactionMode.value === 'transfer') {
      submitToFrappe()
    } else {
      submitReservation()
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
.nav-logout-btn:hover { background: #450a0a !important; color: white !important; }
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


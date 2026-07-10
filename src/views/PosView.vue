<template>
  <div class="pos-app-layout">
    <aside class="sidebar-nav">
      <div class="nav-logo">🏆 WMS PRO</div>
      <div v-if="authStore.user" class="nav-user-info">
        <span class="nav-user-name">{{ authStore.user.member_name || authStore.user.full_name }}</span>
        <span class="nav-user-meta">{{ authStore.user.branch_name ?? '본부' }} · {{ authStore.user.access_level || '관리자' }}</span>
      </div>
      <div class="nav-lang-switcher" style="padding: 0 12px; margin-bottom: 12px;">
        <LanguageSwitcher style="width: 100%; box-sizing: border-box;" />
      </div>
      <nav class="nav-menu">
        <a href="#" class="nav-item" :class="{ active: activeNav === 'home' }" @click.prevent="activeNav = 'home'">🏠 {{ $t('nav.home') }}</a>
        <button class="nav-item nav-btn-inline" @click.prevent="isOutboundMenuOpen = !isOutboundMenuOpen">
          {{ $t('nav.outbound_group') }} <span style="float:right;">{{ isOutboundMenuOpen ? '▲' : '▼' }}</span>
        </button>
        <div v-show="isOutboundMenuOpen" class="nav-sub-menu" style="background: rgba(0,0,0,0.1); padding-left:10px;">
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'outbound' }" @click.prevent="setActiveNav('outbound'); setTransactionMode('outbound')">{{ $t('nav.outbound_entry') }}</a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'outbound-reservation' }" @click.prevent="setActiveNav('outbound-reservation'); setTransactionMode('outbound')">{{ $t('nav.outbound_res') }} <span v-if="incompleteReservationCount > 0" class="res-badge">{{ incompleteReservationCount }}</span></a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'outbound-list' }" @click.prevent="setActiveNav('outbound-list'); setTransactionMode('outbound')">{{ $t('nav.outbound_list') }}</a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'outbound-history' }" @click.prevent="setActiveNav('outbound-history'); setTransactionMode('outbound')">{{ $t('nav.outbound_history') }}</a>
        </div>
        <button class="nav-item nav-btn-inline" @click.prevent="isInboundMenuOpen = !isInboundMenuOpen">
          {{ $t('nav.inbound_group') }} <span style="float:right;">{{ isInboundMenuOpen ? '▲' : '▼' }}</span>
        </button>
        <div v-show="isInboundMenuOpen" class="nav-sub-menu" style="background: rgba(0,0,0,0.1); padding-left:10px;">
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'inbound' }" @click.prevent="setActiveNav('inbound'); setTransactionMode('inbound')">{{ $t('nav.inbound_entry') }}</a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'inbound-list' }" @click.prevent="setActiveNav('inbound-list'); setTransactionMode('inbound')">{{ $t('nav.inbound_list') }}</a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'inbound-history' }" @click.prevent="setActiveNav('inbound-history'); setTransactionMode('inbound')">{{ $t('nav.inbound_history') }}</a>
        </div>
        <button class="nav-item nav-btn-inline" @click.prevent="isTransferMenuOpen = !isTransferMenuOpen">
          {{ $t('nav.move_group') }} <span style="float:right;">{{ isTransferMenuOpen ? '▲' : '▼' }}</span>
        </button>
        <div v-show="isTransferMenuOpen" class="nav-sub-menu" style="background: rgba(0,0,0,0.1); padding-left:10px;">
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'transfer' }" @click.prevent="setActiveNav('transfer'); setTransactionMode('transfer')">{{ $t('nav.move_entry') }}</a>
          <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'transfer-reservation' }" @click.prevent="setActiveNav('transfer-reservation'); setTransactionMode('transfer')">{{ $t('nav.move_res') }} <span v-if="incompleteTransferReservationCount > 0" class="res-badge">{{ incompleteTransferReservationCount }}</span></a>
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
            <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'product-move' }" @click.prevent="setActiveNav('product-move')">🔄 {{ $t('nav.product_move') }}</a>
            <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'product-adj' }" @click.prevent="setActiveNav('product-adj')">⚖️ {{ $t('nav.product_adj') }}</a>
            <a href="#" class="nav-item sub-item" :class="{ active: activeNav === 'product-reg' }" @click.prevent="setActiveNav('product-reg')">➕ {{ $t('nav.product_reg') }}</a>
          </div>
        </div>

        <!-- 기존 상품등록 (보존용) -->
        <a href="#" class="nav-item" :class="{ active: activeNav === 'product' }" @click.prevent="setActiveNav('product')">📦 {{ $t('nav.product_old') }}</a>
        <a href="#" class="nav-item" :class="{ active: activeNav === 'node' }" @click.prevent="setActiveNav('node')">🏢 {{ $t('nav.node') }}</a>
        <a href="#" class="nav-item" :class="{ active: activeNav === 'report' }" @click.prevent="activeNav = 'report'">📊 {{ $t('nav.report') }}</a>
        <a href="#" class="nav-item" :class="{ active: activeNav === 'manager' }" @click.prevent="activeNav = 'manager'">👤 {{ $t('nav.manager') }}</a>
        <a href="#" class="nav-item" :class="{ active: activeNav === 'search-edit' }" @click.prevent="activeNav = 'search-edit'">🔍 {{ $t('nav.search_edit') }}</a>

        <a href="#" class="nav-item" :class="{ active: activeNav === 'settings' }" @click.prevent="activeNav = 'settings'">⚙️ {{ $t('nav.settings') }}</a>
        <button type="button" class="nav-item nav-logout-btn" @click="handleLogout">🚪 {{ $t('nav.logout') }}</button>
      </nav>
    </aside>

    <main class="main-content-zone">
      <!-- 🌟 신규 추가된 컴포넌트들 -->
      <ReservationListView v-if="activeNav === 'outbound-reservation'" :branch-list="branchList" reservation-type="Material Issue" @create-new="activeNav = 'outbound'" @edit-reservation="loadReservationToCart" @refresh-items="fetchFrappeItems" />
      <ReservationListView v-else-if="activeNav === 'transfer-reservation'" :branch-list="branchList" reservation-type="Material Transfer" @create-new="activeNav = 'transfer'" @edit-reservation="loadReservationToCart" @refresh-items="fetchFrappeItems" />
      <ProductListView v-else-if="activeNav === 'product-list'" />
      <StockReconciliationMain v-else-if="activeNav === 'product-adj'" />
      <OutboundListView v-else-if="activeNav === 'outbound-list'" :branch-list="branchList" :raw-items="rawSingleItems" @edit-outbound="loadOutboundToCart" list-type="Material Issue" />
      <OutboundListView v-else-if="activeNav === 'transfer-list'" :branch-list="branchList" :raw-items="rawSingleItems" @edit-outbound="loadTransferToCart" list-type="Material Transfer" />
      <OutboundHistoryListView v-else-if="activeNav === 'outbound-history'" :branch-list="branchList" @edit-history="loadOutboundToCart" list-type="Material Issue" />
      <OutboundHistoryListView v-else-if="activeNav === 'transfer-history'" :branch-list="branchList" @edit-history="loadTransferToCart" list-type="Material Transfer" />
      <InboundListView v-else-if="activeNav === 'inbound-list'" :branch-list="branchList" :raw-items="rawSingleItems" @edit-inbound="loadInboundToCart" />
      <InboundHistoryListView v-else-if="activeNav === 'inbound-history'" :branch-list="branchList" @edit-history="loadInboundToCart" />
      
      <!-- 보존된 기존 컴포넌트 -->
      <ProductRegistrationPanel v-else-if="activeNav === 'product'" />

      <NodeManagement v-else-if="activeNav === 'node'" />

      <div v-else class="workspace-body">
        
        <div class="workspace-left">
          <div class="search-section dual-search">
            <!-- 동적 검색 (자동완성) -->
            <div class="search-box-wrapper">
              <span class="search-icon">🔍</span>
              <input type="text" v-model="searchQuery" @focus="isSearchDropdownOpen = true" @blur="isSearchDropdownOpen = false" :placeholder="$t('pos.ph_search')" class="search-bar" />
              <ul v-if="isSearchDropdownOpen && filteredMainSearchItems.length > 0" class="search-dropdown">
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
            <div class="block-header"><h3>{{ $t('pos.qp_customer') }}</h3></div>
            <div class="grid-3x4">
              <div v-for="(slot, idx) in 8" :key="'c-slot-'+idx" class="hotkey-card">
                <template v-if="customerPickSlots[idx]">
                  <button class="hotkey-btn-core" @click="selectCustomer(customerPickSlots[idx])" style="background-color: #f8fafc;">
                    <div class="line-1">{{ customerPickSlots[idx].customer_name }}</div>
                    <div class="line-2 text-teal">{{ customerPickSlots[idx].name }}</div>
                  </button>
                  <button class="hotkey-sub-edit-btn" @click="openCustomerSlotEdit(idx)">{{ $t('pos.btn_edit') }}</button>
                </template>
                <template v-else>
                  <button class="hotkey-btn-core empty-slot" @click="openCustomerSlotEdit(idx)">
                    <span class="empty-icon">➕</span>
                    <div class="line-2">{{ $t('pos.qp_assign_customer') }}</div>
                  </button>
                  <button class="hotkey-sub-edit-btn" @click="openCustomerSlotEdit(idx)">{{ $t('pos.btn_edit') }}</button>
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

            <table class="pos-cart-table">
              <thead>
                <tr><th>{{ $t('pos.th_item_color') }}</th><th colspan="2">{{ $t('pos.th_qty_input') }}</th><th>{{ $t('pos.th_total_qty') }}</th><th style="width: 40px;"></th></tr>
                <tr class="sub-th"><th></th><th>{{ $t('pos.th_box') }}</th><th>{{ $t('pos.th_each') }}</th><th></th><th></th></tr>
              </thead>
              <tbody>
                <tr v-for="item in currentTab.cartItems" :key="item.name">
                  <td class="product-cell">
                    <div class="p-name">{{ item.item_name }} ({{ item.custom_color || t('pos.default_color') }})</div>
                    <div class="p-stock-info">{{ item.custom_pack_qty || 1 }}入</div>
                  </td>
                  <td class="input-green">
                    <input type="text" inputmode="numeric" pattern="[0-9]*" v-model.number="item.input_box" placeholder="0" />
                  </td>
                  <td class="input-green">
                    <input type="text" inputmode="numeric" pattern="[0-9]*" v-model.number="item.input_each" placeholder="0" />
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
            
            <div class="action-btn-double-group">
              <!-- 예약 출고 모드: 취소 버튼 -->
              <button
                v-if="transactionMode !== 'inbound' && currentTab?.activeReservationId && !currentTab?.amendingStockEntry"
                class="btn-outbound-reserve"
                style="background:#ef4444"
                @click="cancelReservationCheckout()"
              >
                {{ $t('pos.btn_cancel_res') }}
              </button>
              <!-- 수정 취소 버튼 -->
              <button
                v-else-if="transactionMode !== 'inbound' && currentTab?.amendingStockEntry"
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
        <table class="grid-table">
          <thead>
            <tr><th>{{ $t('pos.th_color_pack') }}</th><th colspan="2">{{ $t('pos.th_qty_input') }}</th><th>{{ $t('pos.th_sel_total') }}</th><th>{{ $t('pos.th_cur_stock') }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(v, idx) in activeGroup.variants" :key="idx">
              <td class="color-name">{{ v.custom_color || t('pos.default_color') }} <span style="font-size: 0.85em; color: #666;">({{ v.custom_pack_qty || 1 }}{{ $t('pos.pack_unit') }})</span></td>
              <td class="input-green"><input type="text" inputmode="numeric" pattern="[0-9]*" v-model.number="v.input_box" placeholder="0" /></td>
              <td class="input-green"><input type="text" inputmode="numeric" pattern="[0-9]*" v-model.number="v.input_each" placeholder="0" /></td>
              <td class="calc-total-qty">{{ ((v.input_box || 0) * (v.custom_pack_qty || 1)) + (v.input_each || 0) }}{{ $t('pos.unit_ea') }}</td>
              <td class="stock-info-cell">{{ getFormattedStockFor(v) }}</td>
            </tr>
          </tbody>
        </table>
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
    <!-- 🌟 고객 지정 모달 -->
    <div class="modal-overlay" v-if="isCustomerSlotEditModalOpen">
      <div class="modal-content slot-edit-modal">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">{{ $t('pos.slot_title_customer') }} {{ editCustomerSlotIndex + 1 }})</h3>
          <button class="close-text-btn" @click="isCustomerSlotEditModalOpen = false" style="margin:0;">{{ $t('pos.btn_close') }}</button>
        </div>
        <div class="search-section" style="margin-top: 15px;">
          <input type="text" v-model="customerSlotSearchQuery" :placeholder="$t('pos.ph_customer_search')" class="search-bar" />
        </div>
        <div class="slot-item-list">
          <div v-for="cust in filteredCustomerSlotItems" :key="cust.name" class="slot-list-item" @click="assignCustomerToSlot(cust)">
            <div class="item-desc"><strong>{{ cust.customer_name || cust.name }}</strong> ({{ cust.name }})</div>
          </div>
          <div v-if="filteredCustomerSlotItems.length === 0" class="empty-msg" style="padding: 20px; text-align: center; color: #888;">{{ $t('pos.empty_search') }}</div>
        </div>
        <button class="btn-clear-slot" @click="clearCustomerSlot">{{ $t('pos.btn_clear_slot') }}</button>
      </div>
    </div>

    <!-- 🌟 퀵 추가 모달 -->
    <QuickItemAddModal :is-open="isQuickItemModalOpen" @close="isQuickItemModalOpen = false" @success="handleItemSuccess" />
    <QuickCustomerAddModal :is-open="isQuickCustomerModalOpen" @close="isQuickCustomerModalOpen = false" @success="handleCustomerSuccess" />
    <QuickSalesPersonAddModal :is-open="isQuickSalesPersonModalOpen" :branch-list="branchList" :default-branch="currentTab?.selectedBranch" @close="isQuickSalesPersonModalOpen = false" @success="handleSalesPersonSuccess" />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'
import axios from 'axios'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import ProductRegistrationPanel from '../components/ProductRegistrationPanel.vue'
import NodeManagement from '../components/NodeManagement.vue'
import ProductListView from './ProductListView.vue'
import StockReconciliationMain from './StockReconciliationMain.vue'
import QuickItemAddModal from '../components/QuickItemAddModal.vue'
import QuickCustomerAddModal from '../components/QuickCustomerAddModal.vue'
import QuickSalesPersonAddModal from '../components/QuickSalesPersonAddModal.vue'
import ReservationListView from './ReservationListView.vue'
import OutboundListView from './OutboundListView.vue'
import OutboundHistoryListView from './OutboundHistoryListView.vue'
import InboundListView from './InboundListView.vue'
import InboundHistoryListView from './InboundHistoryListView.vue'

const router = useRouter()
const authStore = useAuthStore()
const { t } = useI18n();

const frappeApi = axios.create({
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  withCredentials: true
})

const canEditMasterFields = computed(() => true)

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

const searchQuery = ref('')
const isGridModalOpen = ref(false)
const activeGroup = ref(null)
const activeNav = ref('outbound')
const transactionMode = ref('outbound')
const isProductMenuOpen = ref(false)
const isInboundMenuOpen = ref(false)
const isOutboundMenuOpen = ref(true)
const isTransferMenuOpen = ref(false)

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

const isQuickItemModalOpen = ref(false)
const isQuickCustomerModalOpen = ref(false)
const isQuickSalesPersonModalOpen = ref(false)

const branchList = computed(() => {
  // 프라페 트리에 등록된 하위 지점 목록 (SCURUSAL - K 하위)
  return warehouseList.value.filter(wh => wh.parent_warehouse === 'SCURUSAL - K')
})

const filteredSalesPersonList = computed(() => {
  const targetBranch = transactionMode.value === 'transfer' 
    ? currentTab.value?.selectedTarget 
    : currentTab.value?.selectedBranch;
    
  if (!targetBranch) return salesPersonList.value;
  return salesPersonList.value.filter(sp => sp.custom_branch === targetBranch)
})

const isQuickAdjustModalOpen = ref(false)
const quickAdjustItem = ref(null)
const quickAdjustForm = ref({ input_box: 0, input_each: 0, valuation_rate: 0 })
const isAdjusting = ref(false)
const pendingCartAction = ref(null)

const userKey = authStore.user?.name || authStore.user?.email || 'default_user'
const singleStorageKey = `wms_quick_pick_slots_${userKey}`
const gridStorageKey = `wms_grid_quick_pick_slots_${userKey}`
const customerStorageKey = `wms_customer_quick_pick_slots_${userKey}`

const quickPickSlotNames = ref(JSON.parse(localStorage.getItem(singleStorageKey)) || new Array(8).fill(null))
const gridPickSlotNames = ref(JSON.parse(localStorage.getItem(gridStorageKey)) || new Array(8).fill(null))
const customerPickSlotNames = ref(JSON.parse(localStorage.getItem(customerStorageKey)) || new Array(8).fill(null))

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

const customerPickSlots = computed(() => {
  return customerPickSlotNames.value.map(name => {
    if (!name) return null;
    return customerList.value.find(c => c.name === name) || null;
  })
})

// 🌟 가용 재고 계산 로직 (실재고 - 예약 수량)
const getAvailableStock = (itemCode, targetWarehouse = null) => {
  const warehouse = targetWarehouse || (transactionMode.value === 'inbound' 
    ? currentTab.value?.selectedTarget 
    : currentTab.value?.selectedSource);

  let totalActual = 0;
  binData.value.forEach(bin => {
    if (bin.item_code === itemCode && (!warehouse || bin.warehouse === warehouse)) {
      totalActual += (Number(bin.actual_qty) || 0);
    }
  });

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

const filteredMainSearchItems = computed(() => {
  if (!searchQuery.value) return []
  const q = searchQuery.value.toLowerCase()
  return rawSingleItems.value.filter(item => 
    (item.item_name && item.item_name.toLowerCase().includes(q)) ||
    (item.custom_color && item.custom_color.toLowerCase().includes(q)) ||
    (item.name && item.name.toLowerCase().includes(q))
  ).slice(0, 50)
})

const selectSearchItem = (item) => {
  addSingleHotkeyToCart(item)
  searchQuery.value = ''
  isSearchDropdownOpen.value = false
}

const handleBarcodeScan = () => {
  const code = barcodeQuery.value.trim()
  if (!code) return
  const item = rawSingleItems.value.find(i => 
    i.name.toLowerCase() === code.toLowerCase() || 
    (i.custom_name_number && i.custom_name_number.toLowerCase() === code.toLowerCase())
  )
  if (item) {
    addSingleHotkeyToCart(item)
  } else {
    alert(t('pos.msg_err_barcode', { code: code }))
  }
  barcodeQuery.value = ''
}

const filteredSlotItems = computed(() => {
  const baseItems = rawSingleItems.value
  if (!slotSearchQuery.value) return baseItems
  const q = slotSearchQuery.value.toLowerCase()
  return baseItems.filter(item => 
    (item.item_name && item.item_name.toLowerCase().includes(q)) ||
    (item.custom_color && item.custom_color.toLowerCase().includes(q)) ||
    (item.name && item.name.toLowerCase().includes(q))
  )
})

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

const filteredGridSlotItems = computed(() => {
  const baseItems = gridHotkeys.value
  if (!gridSlotSearchQuery.value) return baseItems
  const q = gridSlotSearchQuery.value.toLowerCase()
  return baseItems.filter(group => 
    (group.group_name && group.group_name.toLowerCase().includes(q)) ||
    (group.id && group.id.toLowerCase().includes(q))
  )
})

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

// 고객 핫키 모달 관련
const isCustomerSlotEditModalOpen = ref(false)
const editCustomerSlotIndex = ref(-1)
const customerSlotSearchQuery = ref('')

const filteredCustomerSlotItems = computed(() => {
  const currentAssigned = new Set(customerPickSlotNames.value.filter(n => n !== null))
  const q = customerSlotSearchQuery.value.toLowerCase()
  return customerList.value.filter(cust => {
    if (currentAssigned.has(cust.name)) return false
    return (cust.name && cust.name.toLowerCase().includes(q)) ||
           (cust.customer_name && cust.customer_name.toLowerCase().includes(q))
  }).slice(0, 50)
})

const openCustomerSlotEdit = (idx) => {
  editCustomerSlotIndex.value = idx
  customerSlotSearchQuery.value = ''
  isCustomerSlotEditModalOpen.value = true
}

const assignCustomerToSlot = (cust) => {
  const newArr = [...customerPickSlotNames.value]
  newArr[editCustomerSlotIndex.value] = cust.name
  customerPickSlotNames.value = newArr
  localStorage.setItem(customerStorageKey, JSON.stringify(newArr))
  isCustomerSlotEditModalOpen.value = false
}

const clearCustomerSlot = () => {
  const newArr = [...customerPickSlotNames.value]
  newArr[editCustomerSlotIndex.value] = null
  customerPickSlotNames.value = newArr
  localStorage.setItem(customerStorageKey, JSON.stringify(newArr))
  isCustomerSlotEditModalOpen.value = false
}

const selectCustomer = (cust) => {
  if (currentTab.value) {
    currentTab.value.selectedCustomer = cust.name
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
  // rawSingleItems 맨 앞에 추가 (검색 및 핫키 지정에서 바로 보이게)
  rawSingleItems.value.unshift(newItem)
  
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
const fetchFrappeItems = async () => {
  try {
    // 1. 다중 API 병렬 호출 (창고, 품목, 재고, 고객, 영업사원, 예약 건수)
    const [whRes, itemRes, binRes, custRes, spRes, reqRes, supRes] = await Promise.all([
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
            'valuation_rate'
          ]),
          limit_page_length: 500 // 넉넉하게 로드
        }
      }),
      frappeApi.get('/api/resource/Bin', {
        params: {
          fields: JSON.stringify(['item_code', 'actual_qty', 'warehouse']),
          limit_page_length: 0 // 전체 재고 로드
        }
      }),
      frappeApi.get('/api/resource/Customer', {
        params: {
          fields: JSON.stringify(['name', 'customer_name']),
          filters: JSON.stringify([['disabled', '=', 0]]),
          limit_page_length: 500
        }
      }),
      frappeApi.get('/api/resource/Sales Person', {
        params: {
          fields: JSON.stringify(['name', 'sales_person_name', 'enabled', 'custom_branch']),
          filters: JSON.stringify([['enabled', '=', 1]]),
          limit_page_length: 500
        }
      }),
      frappeApi.get('/api/resource/Material Request', {
        params: {
          fields: JSON.stringify(['name']),
          filters: JSON.stringify([['docstatus', '=', 1], ['status', 'in', ['Pending', 'Partially Ordered', 'Partially Issued', 'Partially Received', 'Partial']]]),
          limit_page_length: 0
        }
      }),
      frappeApi.get('/api/resource/Supplier', {
        params: {
          fields: JSON.stringify(['name', 'supplier_name']),
          limit_page_length: 500
        }
      })
    ]);

    warehouseList.value = whRes.data.data
    binData.value = binRes.data.data || []
    customerList.value = custRes.data.data || []
    salesPersonList.value = spRes.data.data || []
    supplierList.value = supRes.data.data || []
    
    const reqList = reqRes.data.data || [];

    // 🌟 2. 예약 내역 상세 조회하여 예약 맵 구축 (가용재고 차감용)
    if (reqList.length > 0) {
      const mrDetailsPromises = reqList.map(req =>
        frappeApi.get(`/api/resource/Material Request/${req.name}`)
      );
      const mrDetailsRes = await Promise.all(mrDetailsPromises);
      
      const reservedMap = {};
      let outboundResCount = 0;
      let transferResCount = 0;

      mrDetailsRes.forEach(res => {
         const doc = res.data.data;

         // 뱃지 카운트 분리
         if (doc.material_request_type === 'Material Issue') outboundResCount++;
         else if (doc.material_request_type === 'Material Transfer') transferResCount++;

         // 출발 창고 결정
         // - Material Issue: set_warehouse (출고 소스)
         // - Material Transfer: set_from_warehouse (이동 출발지)
         // ⚠️ custom_ordering_branch는 지점 브랜치 링크필드이므로 창고 키로 사용 불가
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
               // 출고(Issue)는 item.warehouse가 소스이지만, 이동(Transfer)은 item.warehouse가 목적지임.
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
      pendingReservedMap.value = reservedMap;
    } else {
      incompleteReservationCount.value = 0;
      incompleteTransferReservationCount.value = 0;
      pendingReservedMap.value = {};
    }

    
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
  }
}

onMounted(() => {
  fetchFrappeItems()
})

const setTransactionMode = (mode) => {
  transactionMode.value = mode
}

const setActiveNav = (nav) => {
  activeNav.value = nav
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
    currentTab.value.selectedSource = ''
    currentTab.value.selectedTarget = ''
    currentTab.value.title = transactionMode.value === 'transfer' ? t('pos.msg_new_transfer') : t('pos.msg_new_outbound')
  }
  activeNav.value = transactionMode.value === 'transfer' ? 'transfer-reservation' : 'outbound-reservation'
}

// 🌟 예약 내역을 장바구니로 로드 🌟
const loadReservationToCart = (res) => {
  const isTransfer = res.material_request_type === 'Material Transfer'
  const targetMode = isTransfer ? 'transfer' : 'outbound'
  
  activeNav.value = targetMode
  setTransactionMode(targetMode)

  if (currentTab.value) {
    currentTab.value.title = `예약 작업: ${res.name}`
    currentTab.value.activeReservationId = res.name
    
    currentTab.value.selectedCustomer = res.custom_customer || res.customer || ''
    currentTab.value.selectedBranch = res.custom_ordering_branch || (!isTransfer && res.material_request_type !== 'Material Issue' ? res.set_warehouse : '') || ''
    currentTab.value.selectedResponder = res.custom_orderer || ''
    currentTab.value.selectedSource = res.set_from_warehouse || (res.material_request_type === 'Material Issue' ? res.set_warehouse : '') || ''
    currentTab.value.reservationOriginalSource = currentTab.value.selectedSource
    currentTab.value.selectedTarget = isTransfer ? res.set_warehouse : ''
    
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
          mr_qty: remainingQty // 예약 잔량 초과 출고 시 행 분리를 위한 잔량 저장
        })
      }
    })
    
    currentTab.value.cartItems = newCart
  }
}

// 🌟 재고이동 전표를 장바구니로 로드
const loadTransferToCart = (entry) => {
  activeNav.value = 'transfer'
  setTransactionMode('transfer')
  if (currentTab.value) {
    currentTab.value.title = `이동 수정: ${entry.name}`
    currentTab.value.amendingStockEntry = entry.name
    currentTab.value.amendSourceNav = entry.sourceNav || 'transfer-list'
    currentTab.value.selectedSource = entry.from_warehouse || ''
    currentTab.value.selectedTarget = entry.to_warehouse || ''
    currentTab.value.selectedResponder = entry.custom_orderer || ''
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
    if (currentTab.value.amendingStockEntry) {
      try {
        await frappeApi.post('/api/method/frappe.client.cancel', {
          doctype: 'Stock Entry',
          name: currentTab.value.amendingStockEntry
        });
        console.log(`기존 전표 ${currentTab.value.amendingStockEntry} 취소 완료`);
      } catch (cancelErr) {
        console.error('기존 전표 취소 실패:', cancelErr);
        // 만약 이미 취소된 상태이거나 권한 문제가 있으면 여기서 막혀야 할 수도 있지만, 
        // 일단 진행하거나 사용자에게 알릴 수 있습니다.
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
      amended_from: currentTab.value.amendingStockEntry || undefined,
      
      
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
              material_request: currentTab.value.activeReservationId,
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
          material_request: item.mr_item_id ? currentTab.value.activeReservationId : undefined,
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
          // 방금 발행된 전표로 인해 예약이 완전히 종료(Completed)되었는지 상태 확인
          const mrStatusRes = await frappeApi.get(`/api/resource/Material Request/${currentTab.value.activeReservationId}?fields=["status"]`);
          const mrStatus = mrStatusRes.data.data.status;
          
          if (mrStatus !== 'Completed' && mrStatus !== 'Transferred' && mrStatus !== 'Issued' && mrStatus !== 'Received') {
            if (confirm(t('pos.msg_res_close_cfm'))) {
              try {
                await frappeApi.post('/api/method/erpnext.stock.doctype.material_request.material_request.update_status', {
                  status: 'Stopped',
                  name: currentTab.value.activeReservationId
                })
                alert(t('pos.msg_success_stopped'));
              } catch (e) {
                console.warn('Stopped 메서드 호출 실패, set_value 로 백업 시도', e);
                try {
                  await frappeApi.post('/api/method/frappe.client.set_value', {
                    doctype: 'Material Request',
                    name: currentTab.value.activeReservationId,
                    fieldname: 'status',
                    value: 'Stopped'
                  })
                } catch (e2) {
                  console.error('잔여분 종결 실패', e2)
                }
              }
            }
          }
        } catch(e) {
           console.error("MR 상태 조회 실패", e);
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
    const dateStr = scheduleDate.toISOString().split('T')[0];

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
      // 3. 제출(Submit)하여 대기(Pending) 상태로 만듦
      await frappeApi.put(`/api/resource/Material Request/${docName}`, { docstatus: 1 });
      
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
  padding: 2px 6px; border-radius: 10px; margin-left: auto;
}
</style>
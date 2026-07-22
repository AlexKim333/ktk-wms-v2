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
            :placeholder="$t('branch.inventory.ph_search')"
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
            :placeholder="$t('branch.transfer.ph_search_barcode')"
            class="search-bar barcode-bar"
            style="width: 100%; padding: 12px 12px 12px 35px; border-radius: 6px; border: 1px solid #fcd34d; font-size: 14px; box-sizing: border-box; background: #fffbeb;"
            autocomplete="off"
          />
        </div>
        <button v-if="isSearching" class="btn-cancel-search" @click="cancelSearch" style="padding: 10px 15px; border: 1px solid #cbd5e1; background: white; border-radius: 6px; cursor: pointer; color: #475569; font-weight: bold;">{{ $t('branch.transfer.btn_cancel_search') }}</button>
      </div>

      <div class="quick-pick-zone" style="flex: 1; overflow: hidden; display: flex; flex-direction: column; position: relative;">
        <!-- 렌더링 반전: 검색 중일 때는 리스트 뷰, 아니면 퀵픽 버튼 -->
        <div v-if="isSearching" class="search-results-overlay" style="position: absolute; inset: 0; background: white; z-index: 10; overflow-y: auto; border-radius: 8px; border: 1px solid #e2e8f0;">
          <table class="inventory-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="background: #f1f5f9; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 13px; position: sticky; top: 0; z-index: 2;">{{ $t('branch.inventory.col_item_name') }}</th>
                <th style="background: #f1f5f9; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 13px; position: sticky; top: 0; z-index: 2;">{{ $t('branch.transfer.th_item_color') }}</th>
                <th style="background: #f1f5f9; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 13px; position: sticky; top: 0; z-index: 2;">Pack Qty</th>
                <th class="highlight-branch" style="background: #e0f2fe; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #0284c7; font-size: 13px; position: sticky; top: 0; z-index: 2;">{{ $t('branch.inventory.col_my_stock', { branch: authStore.user?.branch_name }) }}</th>
                <th class="highlight-main" style="background: #f1f5f9; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 13px; position: sticky; top: 0; z-index: 2;">{{ $t('branch.inventory.col_main_stock') }}</th>
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
                    {{ $t('common.show_more', { n: listRemaining }) }}
                  </button>
                </td>
              </tr>
              <tr v-if="displayedItems.length === 0">
                <td colspan="5" style="text-align: center; padding: 40px; color: #94a3b8;">{{ $t('branch.inventory.empty_msg') }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="quick-pick-buttons" style="overflow-y: auto; display: flex; flex-direction: column; gap: 20px;">
          
          <div class="hotkey-block">
            <div class="block-header">
              <h3>{{ $t('branch.transfer.qp_single') }}</h3>
            </div>
            <div class="grid-3x4">
              <div v-for="(slot, idx) in 8" :key="'slot-'+idx" class="hotkey-card">
                <template v-if="quickPickSlots[idx]">
                  <button class="hotkey-btn-core" @click="addSingleHotkeyToCart(quickPickSlots[idx])">
                    <div class="line-1">{{ quickPickSlots[idx].item_name }}</div>
                    <div class="line-2">({{ quickPickSlots[idx].custom_color || $t('common.default') || 'Default' }} · {{ quickPickSlots[idx].custom_pack_qty || 1 }}入)</div>
                    <div class="line-3 stock-info">{{ getFormattedStockFor(quickPickSlots[idx]) }}</div>
                  </button>
                  <button class="hotkey-sub-edit-btn" @click="openSlotEdit(idx)">⚙ edit</button>
                </template>
                <template v-else>
                  <button class="hotkey-btn-core empty-slot" @click="openSlotEdit(idx)">
                    <span class="empty-icon">➕</span>
                    <div class="line-2">{{ $t('branch.transfer.lbl_assign_item') }}</div>
                  </button>
                  <button class="hotkey-sub-edit-btn" @click="openSlotEdit(idx)">⚙ edit</button>
                </template>
              </div>
            </div>
          </div>

          <div class="hotkey-block">
            <div class="block-header">
              <h3 style="color: #00a896;">{{ $t('branch.transfer.qp_grid') }}</h3>
            </div>
            <div class="grid-3x4">
              <div v-for="(slot, idx) in 8" :key="'g-slot-'+idx" class="hotkey-card">
                <template v-if="gridPickSlots[idx]">
                  <button class="hotkey-btn-core grid-style" @click="openGridModal(gridPickSlots[idx])">
                    <div class="line-1">{{ gridPickSlots[idx].group_name }}</div>
                    <div class="line-2 text-teal">({{ gridPickSlots[idx].variants.length }} Colors)</div>
                  </button>
                  <button class="hotkey-sub-edit-btn" @click="openGridSlotEdit(idx)">⚙ edit</button>
                </template>
                <template v-else>
                  <button class="hotkey-btn-core empty-slot" @click="openGridSlotEdit(idx)">
                    <span class="empty-icon">➕</span>
                    <div class="line-2">{{ $t('branch.transfer.lbl_assign_item') }}</div>
                  </button>
                  <button class="hotkey-sub-edit-btn" @click="openGridSlotEdit(idx)">⚙ edit</button>
                </template>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- 단일 버튼 상품 지정 모달 -->
    <div class="modal-overlay" v-if="isSlotEditModalOpen">
      <div class="modal-content slot-edit-modal">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">{{ $t('branch.transfer.modal_assign_title', { slot: editSlotIndex + 1 }) }}</h3>
          <button class="close-text-btn" @click="isSlotEditModalOpen = false" style="margin:0; background:none; border:none; color:#64748b; cursor:pointer;">✕</button>
        </div>
        <div class="search-section" style="margin-top: 15px; padding: 0 15px;">
          <input type="text" v-model="slotSearchQuery" :placeholder="$t('branch.inventory.ph_search')" class="search-bar" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;" />
        </div>
        <div class="slot-item-list" style="padding: 15px; overflow-y: auto; max-height: 400px;">
          <div v-for="item in filteredSlotItems" :key="item.name" 
               class="slot-list-item" 
               @click="assignSlotItem(item)"
               style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #e2e8f0; cursor:pointer;">
            <div class="item-desc"><strong>{{ item.item_name }}</strong> ({{ item.custom_color || $t('common.default') || 'Default' }})</div>
            <div class="item-stock">{{ getFormattedStockFor(item) }}</div>
          </div>
          <div v-if="filteredSlotItems.length === 0" class="empty-msg" style="padding: 20px; text-align: center; color: #888;">{{ $t('branch.inventory.empty_msg') }}</div>
        </div>
        <div style="padding: 15px;">
          <button class="btn-clear-slot" @click="clearSlot" style="width:100%; padding:10px; background:#fef2f2; color:#ef4444; border:1px solid #fca5a5; border-radius:6px; font-weight:bold; cursor:pointer;">{{ $t('branch.transfer.btn_clear_slot') }}</button>
        </div>
      </div>
    </div>

    <!-- 그리드 묶음 상품 지정 모달 -->
    <div class="modal-overlay" v-if="isGridSlotEditModalOpen">
      <div class="modal-content slot-edit-modal">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">{{ $t('branch.transfer.modal_assign_title', { slot: editGridSlotIndex + 1 }) }}</h3>
          <button class="close-text-btn" @click="isGridSlotEditModalOpen = false" style="margin:0; background:none; border:none; color:#64748b; cursor:pointer;">✕</button>
        </div>
        <div class="search-section" style="margin-top: 15px; padding: 0 15px;">
          <input type="text" v-model="gridSlotSearchQuery" :placeholder="$t('branch.inventory.ph_search')" class="search-bar" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px;" />
        </div>
        <div class="slot-item-list" style="padding: 15px; overflow-y: auto; max-height: 400px;">
          <div v-for="group in filteredGridSlotItems" :key="group.id" 
               class="slot-list-item" 
               @click="assignGridSlotItem(group)"
               style="padding:10px; border-bottom:1px solid #e2e8f0; cursor:pointer;">
            <div class="item-desc"><strong>{{ group.group_name }}</strong> ({{ group.variants.length }} color)</div>
          </div>
          <div v-if="filteredGridSlotItems.length === 0" class="empty-msg" style="padding: 20px; text-align: center; color: #888;">{{ $t('branch.inventory.empty_msg') }}</div>
        </div>
        <div style="padding: 15px;">
          <button class="btn-clear-slot" @click="clearGridSlot" style="width:100%; padding:10px; background:#fef2f2; color:#ef4444; border:1px solid #fca5a5; border-radius:6px; font-weight:bold; cursor:pointer;">{{ $t('branch.transfer.btn_clear_slot') }}</button>
        </div>
      </div>
    </div>

    <QuickClerkAddModal 
      :is-open="isQuickClerkModalOpen" 
      @close="isQuickClerkModalOpen = false" 
      @success="handleClerkAdded" 
    />

    <!-- Right Pane: Cart & Header -->
    <div class="workspace-right" style="flex: 1.05; background: white; border-radius: 8px; border: 2px solid #3b82f6; box-shadow: 0 4px 6px rgba(0,0,0,0.05); display: flex; flex-direction: column; overflow: hidden;">

      <!-- 탭 컨트롤 헤더 (일관성 유지 - VENTA와 동일한 스타일) -->
      <div class="tabs-control-header" style="display: flex; justify-content: space-between; background: #e0f2fe; border-bottom: 2px solid #3b82f6; padding: 8px 10px 0 10px;">
        <div class="tabs-list" style="display: flex; gap: 4px; align-items: flex-end;">
          <div v-for="(tab, idx) in tabs" :key="tab.id" class="tab-wrapper-item" :class="{ active: currentTabIndex === idx }" @click="currentTabIndex = idx" style="display: flex; align-items: center; gap: 6px; background: #f1f5f9; border: 1px solid #cbd5e1; border-bottom: none; padding: 10px 15px; border-radius: 8px 8px 0 0; font-size: 13.5px; font-weight: bold; cursor: pointer; color: #475569; transition: 0.2s;">
            <span class="tab-title-text">{{ tab.docName ? (tab.title === 'Unknown Clerk' ? $t('common.unknown') : tab.title) : $t('branch.transfer.tab_title') + ' ' + tab.id }}</span>
            <button v-if="tabs.length > 1" class="tab-close-x-btn" @click.stop="removeTab(idx)" style="background: none; border: none; font-size: 16px; font-weight: bold; color: #94a3b8; cursor: pointer; padding: 0 2px; line-height: 1;">×</button>
          </div>
        </div>
        <div class="tabs-header-actions" style="display: flex; align-items: center; gap: 10px; padding-bottom: 8px;">
          <button v-if="!isClerk" class="add-tab-action-btn" @click="fetchPendingDrafts" style="background: none; border: none; color: #f59e0b; font-weight: bold; cursor: pointer; font-size: 13.5px; margin-right: 5px;">🔄 {{ $t('branch.transfer.btn_load_drafts') }}</button>
          <span v-if="!isClerk && pendingDraftCount > 0" style="font-size: 11.5px; color: #64748b; font-weight: bold;">(표시: {{ tabs.filter(t => t.docName).length }} / Total Drafts: {{ pendingDraftCount }})</span>
          <button class="add-tab-action-btn" @click="addNewTab" style="background: none; border: none; color: #2563eb; font-weight: bold; cursor: pointer; font-size: 13.5px;">＋ {{ $t('branch.transfer.btn_add_tab') }}</button>
        </div>
      </div>

      <!-- 우측 상단 정보 영역 (2x2 그리드) -->
      <div class="pos-cart-header" style="background: white; padding: 15px; border-bottom: 1px solid #e2e8f0;">
        <div class="header-fields" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="field-group">
            <label style="display: block; font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 4px;">📍 {{ $t('branch.transfer.lbl_source') }}:</label>
            <input type="text" value="[MAIN] ALARCON - K" disabled class="form-input" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 13px; background: #f8fafc; color: #94a3b8;" />
          </div>
          <div class="field-group">
            <label style="display: block; font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 4px;">🏢 {{ $t('branch.transfer.lbl_warehouse') }}:</label>
            <input type="text" :value="authStore.user?.branch_name" disabled class="form-input" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 13px; background: #f8fafc; color: #94a3b8;" />
          </div>
          <div class="field-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <label style="font-size: 11px; color: #64748b; font-weight: bold;">🙋‍♂️ {{ $t('branch.transfer.lbl_clerk') }}:</label>
              <button v-if="!isClerk" @click="isQuickClerkModalOpen = true" style="background: none; border: none; color: #3b82f6; font-size: 11px; font-weight: bold; cursor: pointer;">+ {{ $t('branch.transfer.btn_add_clerk') }}</button>
            </div>
            <select v-if="currentTab" v-model="currentTab.selectedRequester" class="form-select" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; background: white;">
              <option value="">-- Select Clerk --</option>
              <option v-for="user in branchUsers" :key="user.email" :value="user.name || user.email">{{ user.full_name }}</option>
            </select>
          </div>
          <div class="field-group">
            <label style="display: block; font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 4px;">✍️ {{ $t('branch.transfer.lbl_creator') }}:</label>
            <select v-if="currentTab" v-model="currentTab.selectedCreator" class="form-select" style="width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 13px; background: white;">
              <option value="">-- Select Manager --</option>
              <option v-for="user in branchUsers" :key="user.email" :value="user.name">{{ user.full_name }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Cart Table -->
      <div class="cart-table-wrapper" style="flex: 1; overflow-y: auto; padding: 15px; position: relative;">
        <div v-if="currentTab && currentTab.docName && !isClerk" style="margin-bottom: 10px; display: flex; justify-content: flex-end;">
          <button @click="rejectDraft(currentTab.docName)" style="background: white; border: 1px solid #ef4444; color: #ef4444; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">{{ $t('branch.transfer.btn_reject_all') }}</button>
        </div>
        <table class="pos-cart-table" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
          <thead>
            <tr>
              <th rowspan="2" style="width: 35%; background: #f8fafc; font-weight: bold; color: #334155; border: 1px solid #e2e8f0; padding: 8px; font-size: 12.5px; text-align: center;">{{ $t('branch.transfer.th_item_color') }}</th>
              <th colspan="2" class="sub-th" style="width: 40%; background: #f8fafc; font-weight: bold; color: #334155; border: 1px solid #e2e8f0; font-size: 11px; padding: 4px; text-align: center;">{{ $t('branch.transfer.th_qty_input') }}</th>
              <th rowspan="2" style="width: 15%; background: #f8fafc; font-weight: bold; color: #334155; border: 1px solid #e2e8f0; padding: 8px; font-size: 12.5px; text-align: center;">{{ $t('branch.transfer.th_total_qty') }}</th>
              <th rowspan="2" style="width: 10%; background: #f8fafc; font-weight: bold; color: #334155; border: 1px solid #e2e8f0; padding: 8px; font-size: 12.5px; text-align: center;">{{ $t('branch.transfer.th_delete') }}</th>
            </tr>
            <tr>
              <th class="sub-th" style="width: 35%; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 11px; padding: 4px; text-align: center;">{{ $t('branch.transfer.th_box') }}</th>
              <th class="sub-th" style="width: 65%; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 11px; padding: 4px; text-align: center;">{{ $t('branch.transfer.th_each') }}</th>
            </tr>
          </thead>
          <tbody v-if="currentTab">
            <tr v-for="(cartItem, idx) in currentTab.cartItems" :key="idx">
              <td class="product-cell" style="border: 1px solid #e2e8f0; padding: 8px; font-size: 12.5px; text-align: left !important; vertical-align: middle; word-break: break-word;">
                <div class="p-name" style="font-weight: bold; font-size: 13px; color: #0f172a; white-space: normal;">
                  {{ cartItem.item_name }}
                  <span style="color: #ef4444; margin-left: 6px; font-size: 11px;">{{ $t('branch.transfer.lbl_available', { box: Math.floor(getStock(cartItem.item_code, '[MAIN] ALARCON - K') / (cartItem.pack_qty || 1)) }) }}</span>
                </div>
                <div class="p-stock-info" style="font-size: 11px; color: #64748b; margin-top: 4px;">
                  {{ cartItem.custom_color || '-' }} | {{ $t('branch.transfer.lbl_pack_info', { qty: cartItem.pack_qty }) }}
                </div>
              </td>
              <td class="input-blue" style="border: 1px solid #e2e8f0; padding: 2px !important; background-color: #dbeafe !important;">
                <input type="number" v-model.number="cartItem.boxQty" @input="updateTotalQty(cartItem)" :disabled="isClerk && currentTab.docName" min="0" max="9999" style="width: 100%; background: transparent; border: none; text-align: center; font-size: 14px; font-weight: bold; outline: none; color: #2563eb;" />
              </td>
              <td class="input-blue pza-cell" style="border: 1px solid #e2e8f0; padding: 0 !important; background-color: #dbeafe !important;">
                <div style="display: flex; width: 100%; height: 100%;">
                  <!-- 왼쪽 10단위 스피너 -->
                  <div class="custom-spinner-left" style="display: flex; flex-direction: column; width: 26px; flex-shrink: 0; background: #bfdbfe; border-right: 1px solid #93c5fd;">
                    <button type="button" @click="changeQtyBy10(cartItem, 10)" :disabled="isClerk && currentTab.docName" class="left-spin-btn" style="flex: 1; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #1e40af; display: flex; align-items: center; justify-content: center; padding: 0; outline: none;">▲</button>
                    <button type="button" @click="changeQtyBy10(cartItem, -10)" :disabled="isClerk && currentTab.docName" class="left-spin-btn" style="flex: 1; border: none; border-top: 1px solid #93c5fd; background: transparent; cursor: pointer; font-size: 12px; color: #1e40af; display: flex; align-items: center; justify-content: center; padding: 0; outline: none;">▼</button>
                  </div>
                  <!-- 기존 1단위 (오른쪽 native 스피너) -->
                  <input type="number" v-model.number="cartItem.eachQty" @input="updateTotalQty(cartItem)" :disabled="isClerk && currentTab.docName" min="0" max="99999" style="flex: 1; width: 100%; background: transparent; border: none; text-align: center; font-size: 14px; font-weight: bold; outline: none; color: #2563eb; min-width: 0;" />
                </div>
              </td>
              <td class="total-qty-cell" style="border: 1px solid #e2e8f0; padding: 8px; font-size: 12.5px; text-align: center; vertical-align: middle;">
                <strong style="color: #3b82f6; font-size: 14px; word-break: break-all;">{{ cartItem.totalQty }}</strong>
              </td>
              <td class="action-cell" style="border: 1px solid #e2e8f0; padding: 4px !important; text-align: center; vertical-align: middle;">

                <button @click="removeItem(idx)" :disabled="isClerk && currentTab.docName" class="btn-more-options" style="background: none; border: none; font-size: 18px; font-weight: bold; color: #94a3b8; cursor: pointer; padding: 4px 8px; border-radius: 4px;">🗑️</button>
              </td>
            </tr>
            <tr v-if="currentTab.cartItems.length === 0">
              <td colspan="5" class="empty-cart-msg" style="border: 1px solid #e2e8f0; text-align: center !important; padding: 40px !important; color: #94a3b8; font-style: italic;">{{ $t('branch.transfer.empty_cart') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer Totals & Action -->
      <div class="right-footer-action-zone" style="border-top: 2px solid #e2e8f0; padding: 15px; background: #f8fafc; display: flex; flex-direction: column; gap: 12px;" v-if="currentTab">
        <div class="truck-counter-info-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="summary-label-box" style="background: white; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; font-size: 14px; font-weight: bold; color: #334155; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
            📦 {{ $t('branch.transfer.th_total_box', 'Total Boxes') }}: <strong style="font-size: 16px; color: #3b82f6; margin-left: 4px;">{{ totalBoxCount }} {{ $t('branch.transfer.th_box') }}</strong>
          </div>
          <div class="summary-label-box" style="background: white; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; font-size: 14px; font-weight: bold; color: #334155; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
            🔢 {{ $t('branch.transfer.th_total_pcs', 'Total Pcs') }}: <strong style="font-size: 16px; color: #3b82f6; margin-left: 4px;">{{ totalEachCount }} {{ $t('branch.transfer.lbl_unit_ea') }}</strong>
          </div>
        </div>
        
        <div class="action-btn-double-group" style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 10px;" v-if="!(isClerk && currentTab.docName)">
          <template v-if="currentTab.docName && !isClerk">
            <button class="btn-outbound-reserve" style="background: #ef4444; color: white; border: none; padding: 15px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 15px; transition: 0.2s;" @click="removeTab(currentTabIndex)" :disabled="isSubmitting">
              ❌ {{ $t('common.cancel', 'Cancel Edit') }}
            </button>
            <button class="btn-final-submit" style="background: #00a896; color: white; border: none; padding: 15px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 15px; transition: 0.2s;" @click="updateDraft(true)" :disabled="isSubmitting">
              {{ isSubmitting ? $t('common.loading') : 'Save Draft' }}
            </button>
          </template>
          <template v-else>
            <div style="grid-column: 1 / -1; display: flex; justify-content: center; gap: 20px; padding-bottom: 10px;">
              <label style="font-size: 15px; font-weight: bold; color: #334155; display: flex; align-items: center; gap: 5px;">
                <input type="radio" v-model="orderType" value="reservation" style="transform: scale(1.2);"> {{ $t('branch.transfer.req_reserve') }} {{ $t('branch.transfer.req_reserve_desc') }}
              </label>
              <label style="font-size: 15px; font-weight: bold; color: #334155; display: flex; align-items: center; gap: 5px;">
                <input type="radio" v-model="orderType" value="immediate" style="transform: scale(1.2);"> {{ $t('branch.transfer.req_urgent') }} {{ $t('branch.transfer.req_urgent_desc') }}
              </label>
            </div>
            <button class="btn-outbound-reserve" style="background: #475569; color: white; border: none; padding: 15px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 15px; transition: 0.2s;" @click="clearCart">
              {{ $t('branch.transfer.btn_empty_cart') }}
            </button>
            <button class="btn-final-submit" style="background: #00a896; color: white; border: none; padding: 15px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 15px; transition: 0.2s;" @click="submitTransfer" :disabled="currentTab.cartItems.length === 0 || isSubmitting">
              {{ $t('branch.transfer.btn_submit_final') }}
            </button>
          </template>
        </div>
        <div v-else style="text-align: center; padding: 15px; color: #64748b; font-weight: bold; background: #f1f5f9; border-radius: 6px;">
          🚫 {{ $t('branch.transfer.msg_readonly') }}
        </div>
      </div>
    </div>
  </div>
  <ReceiptPrint ref="receiptPrintRef" :receiptData="receiptPrintData" :items="receiptPrintItems" />

  <div class="modal-overlay" v-if="isGridModalOpen">
    <div class="modal-content">
      <div class="modal-header">
        <div class="product-title">Selected Grid Item: <strong>{{ activeGroup?.group_name }}</strong></div>
        <button class="submit-btn" @click="submitGridSelection">{{ $t('mobile.btn_done') || 'Done' }}</button>
      </div>
      <div style="max-height: 60vh; overflow-y: auto; margin-top: 15px;">
        <table class="grid-table" style="margin-top: 0;">
          <thead>
            <tr><th style="position: sticky; top: 0; background: #fff; z-index: 1;">{{ $t('branch.transfer.th_item_color') }}</th><th style="position: sticky; top: 0; background: #fff; z-index: 1;" colspan="2">{{ $t('branch.transfer.th_qty_input') }}</th><th style="position: sticky; top: 0; background: #fff; z-index: 1;">{{ $t('branch.transfer.th_total_qty') }}</th><th style="position: sticky; top: 0; background: #fff; z-index: 1;">Current Stock</th></tr>
          </thead>
          <tbody>
            <tr v-for="(v, idx) in activeGroup?.variants" :key="idx">
              <td class="color-name">{{ v.custom_color || $t('common.default') || 'Default' }} <span style="font-size: 0.85em; color: #666;">({{ v.custom_pack_qty || 1 }}입)</span></td>
              <td class="input-green"><input type="number" min="0" v-model.number="v.input_box" placeholder="0" /></td>
              <td class="input-green"><input type="number" min="0" v-model.number="v.input_each" placeholder="0" /></td>
              <td class="calc-total-qty">{{ ((v.input_box || 0) * (v.custom_pack_qty || 1)) + (v.input_each || 0) }} {{ $t('branch.transfer.lbl_unit_ea') }}</td>
              <td class="stock-info-cell">{{ getFormattedStockFor(v) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <button class="close-text-btn" @click="isGridModalOpen = false">{{ $t('mobile.btn_close') || 'Close' }}</button>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, watch, onMounted , nextTick} from 'vue'
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

import ReceiptPrint from '../ReceiptPrint.vue'

const receiptPrintRef = ref(null)
const receiptPrintData = ref({ summary: {} })
const receiptPrintItems = ref([])
import { useAuthStore } from '../../stores/auth.js'
import QuickClerkAddModal from '../QuickClerkAddModal.vue'
import { useItemSearch, rankItemNameMatches } from '../../composables/useItemSearch.js'
import { usePagedList } from '../../composables/usePagedList.js'
import axios from 'axios'
import frappeApi from '../../api/frappe.js'

// 임시: 권한 부여 전까지 token API 사용 (지점장 권한 설정 후 frappeApi로 복구 예정)
// baseURL은 Vite 프록시(`/api`)를 타도록 비움 — localhost:8000 직접 호출 금지
const adminApi = axios.create({
  baseURL: '',
  withCredentials: true,
  headers: {
    'Authorization': `token ${import.meta.env.VITE_API_KEY}:${import.meta.env.VITE_API_SECRET}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

const authStore = useAuthStore()
const userRole = computed(() => authStore.user?.access_level || 'Representative')
const isClerk = computed(() => userRole.value === 'Representative')
const isManager = computed(() => userRole.value === 'Manager')
const isAdmin = computed(() => ['Admin', 'Monitor'].includes(userRole.value))
const pendingDraftCount = ref(0)
const orderType = ref('immediate')
const props = defineProps({
  rawItems: { type: Array, default: () => [] },
  binData: { type: Object, default: () => ({}) },
  pendingReserved: { type: Object, default: () => ({}) },
  branchList: { type: Array, default: () => [] },
  injectedItem: { type: String, default: null },
  editingDraftName: { type: String, default: null }
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
  title: t('branch.transfer.tab_title') + ' 1',
  selectedRequester: authStore.user?.member_name || '',
  selectedCreator: authStore.user?.member_name || '',
  docName: null,
  cartItems: []
}])
const currentTabIndex = ref(0)
const nextTabId = ref(2)

const currentTab = computed(() => tabs.value[currentTabIndex.value])

const addNewTab = () => {
  tabs.value.push({
    id: nextTabId.value++,
    title: t('branch.transfer.tab_title') + ' ' + (tabs.value.length + 1),
    selectedRequester: authStore.user?.member_name || '',
    selectedCreator: authStore.user?.member_name || '',
    docName: null,
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
const isQuickClerkModalOpen = ref(false)
const handleClerkAdded = (newClerk) => {
  fetchBranchUsers().then(() => {
    if (currentTab.value) {
      currentTab.value.selectedRequester = newClerk.email || newClerk.name
    }
  })
}

// --- Quick Pick Logic ---
const userKey = authStore.user?.member_name || 'guest'
const singleStorageKey = `wms_quick_pick_slots_${userKey}`
const gridStorageKey = `wms_grid_quick_pick_slots_${userKey}`

const quickPickSlotNames = ref(JSON.parse(localStorage.getItem(singleStorageKey)) || new Array(8).fill(null))
const gridPickSlotNames = ref(JSON.parse(localStorage.getItem(gridStorageKey)) || new Array(8).fill(null))

const quickPickSlots = computed(() => {
  return quickPickSlotNames.value.map(name => {
    if (!name) return null;
    return props.rawItems.find(i => i.name === name) || null;
  })
})

const gridHotkeys = computed(() => {
  const groupedByName = {};
  props.rawItems.forEach(item => {
    const groupId = item.custom_grid_group_id || item.item_name || t('common.unclassified') || 'Unclassified';
    if (!groupedByName[groupId]) {
      groupedByName[groupId] = {
        id: groupId,
        group_name: item.item_name || t('common.unclassified') || 'Unclassified',
        variants: [],
        is_explicit_grid: false
      };
    }
    if (item.custom_is_grid_item === 1) {
      groupedByName[groupId].is_explicit_grid = true;
    }
    groupedByName[groupId].variants.push({ ...item, input_box: 0, input_each: 0 });
  });

  const newGrids = [];
  Object.values(groupedByName).forEach(group => {
    if (group.is_explicit_grid || group.variants.length > 1) {
      newGrids.push(group);
    }
  });
  return newGrids;
})

const gridPickSlots = computed(() => {
  return gridPickSlotNames.value.map(id => {
    if (!id) return null;
    return gridHotkeys.value.find(g => g.id === id) || null;
  })
})

// Single Pick Modal Logic
const isSlotEditModalOpen = ref(false)
const editSlotIndex = ref(-1)
const slotSearchQuery = ref('')

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

const addSingleHotkeyToCart = (item) => {
  if (!item) return;
  addToCart(item);
}

// Grid Pick Modal Logic
const isGridSlotEditModalOpen = ref(false)
const editGridSlotIndex = ref(-1)
const gridSlotSearchQuery = ref('')

const filteredGridSlotItems = computed(() => {
  if (!gridSlotSearchQuery.value.trim()) return gridHotkeys.value.slice(0, 50)
  const q = gridSlotSearchQuery.value.toLowerCase()
  return gridHotkeys.value.filter(g => g.group_name?.toLowerCase().includes(q) || g.id?.toLowerCase().includes(q))
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

const isGridModalOpen = ref(false)
const activeGroup = ref(null)

const openGridModal = (group) => {
  if (group) {
    // 깊은 복사하여 초기화 (박스/낱장 0으로 리셋)
    activeGroup.value = JSON.parse(JSON.stringify(group))
    activeGroup.value.variants.forEach(v => {
      v.input_box = null
      v.input_each = null
    })
    isGridModalOpen.value = true
  }
}

const submitGridSelection = () => {
  if (!currentTab.value || !activeGroup.value) return
  
  const selectedVariants = activeGroup.value.variants.filter(v => v.input_box > 0 || v.input_each > 0)
  if (selectedVariants.length === 0) {
    isGridModalOpen.value = false
    return
  }

  selectedVariants.forEach(v => {
    const boxQty = Number(v.input_box) || 0
    const eachQty = Number(v.input_each) || 0
    const packQty = v.custom_pack_qty || 1
    
    // 임시로 qty 속성을 만들어서 addToCart 재사용
    const tempItem = {
      ...v,
      name: v.name || v.item_code,
      item_name: v.item_name || v.name,
      _addQty: (boxQty * packQty) + eachQty
    }
    
    // 기존 장바구니에 아이템이 있으면 수량 추가 로직을 addToCart를 반복 호출하는 것으로 해결할 수도 있지만,
    // BranchTransferView의 addToCart는 무조건 +1이 아니라 박스 단위 처리 로직이 섞여 있을 수 있음.
    // BranchTransferView의 addToCart 로직을 모방하여 직접 카트에 넣기:
    
    const mainQty = getStock(tempItem.name, '[MAIN] ALARCON - K')
    const mainBoxQty = Math.floor(mainQty / packQty)
    
    const existing = currentTab.value.cartItems.find(c => c.item_code === tempItem.name)
    if (existing) {
      existing.boxQty += boxQty
      existing.eachQty += eachQty
      updateTotalQty(existing)
    } else {
      currentTab.value.cartItems.push({
        item_code: tempItem.name,
        item_name: tempItem.item_name,
        custom_color: tempItem.custom_color || '',
        pack_qty: packQty,
        uom: tempItem.stock_uom || 'Nos',
        boxQty: boxQty,
        eachQty: eachQty,
        totalQty: (boxQty * packQty) + eachQty
      })
    }
  })

  isGridModalOpen.value = false
}
// ------------------------

// Init Search Index
watch(() => props.rawItems, (newVal) => {
  if (newVal && newVal.length > 0) {
    rebuildItemIndex(newVal)
  }
}, { immediate: true })

const filteredItems = computed(() => {
  props.rawItems; // 강제 반응성 트리거
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
  const actual = props.binData?.[itemCode]?.[warehouse] || 0
  const reserved = props.pendingReserved?.[warehouse]?.[itemCode] || 0
  return actual - reserved
}

const getFormattedStockFor = (item) => {
  if (!item) return '';
  const availableQty = getStock(item.name, '[MAIN] ALARCON - K');
  const packQty = item.custom_pack_qty || 1;
  const boxes = Math.floor(availableQty / packQty);
  const eaches = availableQty % packQty;
  return `📦 ${boxes} Box / ${eaches} ${t('branch.transfer.lbl_unit_ea')}`;
}

const cancelSearch = () => {
  searchQuery.value = ''
  isSearching.value = false
  resetListPage()
}

// Fetch Branch Users
const fetchBranchUsers = async () => {
  try {
    const filters = [
      ['enabled', '=', 1],
      ['user_type', '=', 'System User']
    ];
    
    // 현재 로그인한 사용자의 지점과 동일한 사용자만 가져옵니다.
    if (authStore.user?.branch_name) {
      filters.push(['location', '=', authStore.user.branch_name]);
    }

    const res = await adminApi.get(`/api/resource/User`, {
      params: {
        filters: JSON.stringify(filters),
        fields: JSON.stringify(['name', 'email', 'full_name']),
        limit_page_length: 999
      }
    })
    
    if (res.data && res.data.data) {
      branchUsers.value = res.data.data
    }
  } catch (e) {
    console.error('Failed to fetch branch users', e)
  } finally {
    if (authStore.user && !branchUsers.value.find(u => u.name === authStore.user.member_name)) {
      branchUsers.value.push({
        name: authStore.user.member_name,
        email: authStore.user.member_name,
        full_name: authStore.user.full_name || authStore.user.member_name
      })
    }
  }
}

onMounted(async () => {
  await fetchBranchUsers()
  
  // Fetch 이후 실제 사용자 이름을 찾아 기본값(이메일)을 이름으로 덮어씌움
  const defaultUser = branchUsers.value.find(u => u.email === authStore.user?.member_name || u.name === authStore.user?.member_name)
  if (defaultUser && defaultUser.full_name) {
    tabs.value.forEach(tab => {
      if (tab.selectedRequester === authStore.user?.member_name) {
        tab.selectedRequester = defaultUser.full_name
      }
    })
  }
})

// Cart Logic
const addToCart = (item) => {
  if (!currentTab.value) return
  if (isClerk.value && currentTab.value.docName) {
    alert(t('branch.transfer.msg_readonly'))
    return
  }
  
  const mainQty = getStock(item.name, '[MAIN] ALARCON - K')
  const packQty = item.custom_pack_qty || 1
  const mainBoxQty = Math.floor(mainQty / packQty)
  
  const existing = currentTab.value.cartItems.find(c => c.item_code === item.name)
  if (existing) {
    if (existing.boxQty + 1 > mainBoxQty) {
      alert(`Cannot exceed main stock (${mainBoxQty} Boxes).`)
      return
    }
    existing.boxQty += 1
    updateTotalQty(existing)
  } else {
    if (mainBoxQty < 1) {
      alert(t('branch.inventory.msg_no_main_stock'))
      return
    }
    currentTab.value.cartItems.push({
      item_code: item.name,
      item_name: item.item_name,
      custom_color: item.custom_color,
      pack_qty: packQty,
      uom: item.stock_uom || 'Nos',
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
    alert(`Cannot exceed main stock (${mainBoxQty} Boxes).`)
    cartItem.boxQty = mainBoxQty
  }
  
  cartItem.totalQty = (cartItem.boxQty * cartItem.pack_qty) + cartItem.eachQty
}

const changeQtyBy10 = (cartItem, amount) => {
  const newQty = (cartItem.eachQty || 0) + amount
  if (newQty < 0) {
    cartItem.eachQty = 0
  } else {
    cartItem.eachQty = newQty
  }
  updateTotalQty(cartItem)
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
  if(confirm(t('branch.transfer.msg_confirm_reject'))) {
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

// ----------------------------------------------------
// Draft Management (Fetch, Update, Reject)
// ----------------------------------------------------
const fetchPendingDrafts = async () => {
  try {
    const res = await frappeApi.get('/api/resource/Material Request', {
      params: {
        filters: JSON.stringify([
          ['docstatus', '=', 0],
          ['custom_approval_stage', '=', 'Clerk Request'],
          ['custom_branch', '=', authStore.user?.branch_name || '']
        ]),
        fields: JSON.stringify(['name', 'custom_branch_requester', 'owner']),
        limit_page_length: 999
      }
    })
    
    if (res.data && res.data.data) {
      const drafts = res.data.data
      pendingDraftCount.value = drafts.length
      
      for (const draft of drafts) {
        if (!tabs.value.find(t => t.docName === draft.name)) {
          const detailRes = await frappeApi.get(`/api/resource/Material Request/${draft.name}`)
          const doc = detailRes.data.data
          
          tabs.value.push({
            id: nextTabId.value++,
            title: doc.custom_orderer || 'Unknown Clerk',
            docName: doc.name,
            selectedRequester: doc.custom_orderer || '',
            selectedCreator: doc.owner || '',
            cartItems: doc.items.map(i => {
              const rawItem = props.rawItems.find(r => r.name === i.item_code) || {}
              const packQty = rawItem.custom_pack_qty || 1
              return {
                item_code: i.item_code,
                item_name: rawItem.item_name || i.item_name,
                custom_color: rawItem.custom_color || '',
                pack_qty: packQty,
                uom: i.uom || rawItem.stock_uom || 'Nos',
                boxQty: Math.floor(i.qty / packQty),
                eachQty: i.qty % packQty,
                totalQty: i.qty
              }
            })
          })
        }
      }
    }
  } catch(e) {
    console.error('Error fetching drafts:', e)
    alert('Error loading drafts.')
  }
}

const rejectDraft = async (docName) => {
  if(!confirm(t('branch.transfer.msg_confirm_reject'))) return
  
  try {
    await frappeApi.delete(`/api/resource/Material Request/${docName}`)
    alert(t('branch.transfer.msg_reject_success'))
    const idx = tabs.value.findIndex(t => t.docName === docName)
    if(idx !== -1) removeTab(idx)
    emit('refresh-items')
    fetchPendingDrafts()
  } catch(e) {
    console.error(e)
    alert(t('branch.transfer.msg_reject_err'))
  }
}

watch(() => props.editingDraftName, async (newDraftName) => {
  if (newDraftName) {
    if (!tabs.value.find(t => t.docName === newDraftName)) {
      try {
        const isStockEntry = newDraftName.includes('STE') || newDraftName.startsWith('MAT-STE');
        const docTypeUrl = isStockEntry ? 'Stock Entry' : 'Material Request';
        const detailRes = await frappeApi.get(`/api/resource/${docTypeUrl}/${newDraftName}`)
        const doc = detailRes.data.data
        
        const newTab = {
          id: nextTabId.value++,
          title: doc.custom_orderer || 'Unknown Clerk',
          docName: doc.name,
          selectedRequester: doc.custom_orderer || '',
          selectedCreator: doc.owner || '',
          cartItems: doc.items.map(i => {
            const rawItem = props.rawItems.find(r => r.name === i.item_code) || {}
            const packQty = rawItem.custom_pack_qty || 1
            return {
              item_code: i.item_code,
              item_name: rawItem.item_name || i.item_name,
              custom_color: rawItem.custom_color || '',
              pack_qty: packQty,
              uom: i.uom || rawItem.stock_uom || 'Nos',
              boxQty: Math.floor(i.qty / packQty),
              eachQty: i.qty % packQty,
              totalQty: i.qty
            }
          })
        }
        tabs.value.push(newTab)
        currentTabIndex.value = tabs.value.length - 1
      } catch (e) {
        console.error('Error fetching specific draft:', e)
        alert('예약 정보를 불러오는 중 오류가 발생했습니다.')
      }
    } else {
      const idx = tabs.value.findIndex(t => t.docName === newDraftName)
      currentTabIndex.value = idx
    }
  }
}, { immediate: true })

const updateDraft = async (isFinalApproval) => {
  if (!currentTab.value || !currentTab.value.docName) return
  isSubmitting.value = true
  
  try {
    const isStockEntry = currentTab.value.docName.includes('STE') || currentTab.value.docName.startsWith('MAT-STE');
    const docTypeUrl = isStockEntry ? 'Stock Entry' : 'Material Request';
    
    let payload = {}
    if (isStockEntry) {
      payload = {
        items: currentTab.value.cartItems.map(item => ({
          item_code: item.item_code,
          qty: item.totalQty,
          s_warehouse: '[MAIN] ALARCON - K',
          t_warehouse: authStore.user?.branch_name,
          uom: item.uom || 'Nos',
          conversion_factor: 1
        }))
      }
    } else {
      payload = {
        set_from_warehouse: '[MAIN] ALARCON - K',
        set_warehouse: authStore.user?.branch_name,
        custom_approval_stage: isFinalApproval ? 'Manager Approval' : 'Clerk Request',
        items: currentTab.value.cartItems.map(item => ({
          item_code: item.item_code,
          qty: item.totalQty,
          s_warehouse: '[MAIN] ALARCON - K',
          t_warehouse: authStore.user?.branch_name,
          uom: item.uom || 'Nos',
          conversion_factor: 1
        }))
      }
    }
    
    await adminApi.put(`/api/resource/${docTypeUrl}/${currentTab.value.docName}`, payload)
    
    if (isFinalApproval) {
      alert(t('branch.transfer.msg_submit_success'))
      const idx = tabs.value.findIndex(t => t.id === currentTab.value.id)
      if(idx !== -1) removeTab(idx)
    } else {
      alert('Edit saved successfully.')
    }
    emit('refresh-items')
    if (isFinalApproval) fetchPendingDrafts()
  } catch(e) {
    console.error(e)
    alert(t('branch.transfer.msg_err_transfer'))
  } finally {
    isSubmitting.value = false
  }
}

// ----------------------------------------------------

const submitTransfer = async () => {
  if (!currentTab.value || currentTab.value.cartItems.length === 0) return
  if (!currentTab.value.selectedRequester) {
    alert('Please select a clerk.')
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

    let docName = ''

    if (orderType.value === 'immediate') {
      const payload = {
        doctype: 'Stock Entry',
        docstatus: 0, // Draft 상태로 생성
        stock_entry_type: 'Material Transfer',
        from_warehouse: '[MAIN] ALARCON - K',
        to_warehouse: authStore.user?.branch_name,
        custom_ordering_branch: authStore.user?.branch_name,
        custom_orderer: currentTab.value.selectedRequester,
        items: currentTab.value.cartItems.map(item => ({
          item_code: item.item_code,
          qty: item.totalQty,
          s_warehouse: '[MAIN] ALARCON - K',
          t_warehouse: authStore.user?.branch_name,
          uom: item.uom || 'Nos',
          conversion_factor: 1,
          allow_zero_valuation_rate: 1
        }))
      }
      const res = await adminApi.post('/api/resource/Stock Entry', payload)
      docName = res.data.data.name
      
      let totalQtyCount = 0
      currentTab.value.cartItems.forEach(item => totalQtyCount += Number(item.totalQty || 0))
      
      receiptPrintData.value = {
        title: 'Immediate (Stock Entry)',
        no: docName,
        date: dateStr,
        ubicacion: authStore.user?.branch_name || '[MAIN] ALARCON - K',
        vendedor: getClerkName(currentTab.value.selectedRequester) || authStore.user?.member_name,
          mode: 'Immediate Outbound',
          solicitante: getClerkName(currentTab.value.selectedRequester),
        creador: authStore.user?.email,
        shippingInfo: null,
        summary: { items: currentTab.value.cartItems.length, bulto: totalQtyCount, pzs: 0 }
      }
      
      receiptPrintItems.value = JSON.parse(JSON.stringify(currentTab.value.cartItems.map(item => ({
        name: item.item_code,
        item_name: item.item_name || item.item_code,
        input_box: item.totalQty,
        input_each: 0,
        price_list_rate: item.price_list_rate || 0
      }))))
      
      await nextTick()
      if (receiptPrintRef.value) {
        const success = await receiptPrintRef.value.copyToClipboard()
        if (success) {
          alert(t('branch.transfer.msg_submit_success'))
        } else {
          alert(t('branch.transfer.msg_draft_success'))
        }
      } else {
        alert(t('branch.transfer.msg_draft_success'))
      }
    } else {
      const payload = {
        doctype: 'Material Request',
        material_request_type: 'Material Transfer',
        set_from_warehouse: '[MAIN] ALARCON - K',
        set_warehouse: authStore.user?.branch_name,
        schedule_date: dateStr,
        docstatus: 1, // 제출(Submit) 상태로 생성하여 Pending으로 넘김
        owner: currentTab.value.selectedCreator || authStore.user?.email, // 작성자 강제 지정
        custom_branch: authStore.user?.branch_name,
        custom_orderer: currentTab.value.selectedRequester,
        custom_approval_stage: isClerk ? 'Clerk Request' : 'Manager Approval',
        items: currentTab.value.cartItems.map(item => ({
          item_code: item.item_code,
          qty: item.totalQty,
          s_warehouse: '[MAIN] ALARCON - K',
          t_warehouse: authStore.user?.branch_name,
          uom: item.uom || 'Nos',
          conversion_factor: 1
        }))
      }
      const res = await adminApi.post('/api/resource/Material Request', payload)
      docName = res.data.data.name
      alert(t('branch.transfer.msg_submit_success'))
    }
    
    if(!isClerk) currentTab.value.cartItems = [] // Manager's draft clears, clerk's draft stays read-only
    emit('refresh-items')
  } catch (error) {
    console.error('Submit error:', error)
    let errorMsg = t('branch.transfer.msg_err_transfer')
    if (error.response && error.response.data) {
      const data = error.response.data
      if (data.exc_type) errorMsg = data.exc_type
      if (data._server_messages) {
        try {
          const msgs = JSON.parse(data._server_messages).map(m => JSON.parse(m).message)
          errorMsg = msgs.join('\n')
        } catch(e){}
      }
    }
    alert(errorMsg)
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
  color: #1e40af !important;
  border: 2px solid #3b82f6 !important;
  border-bottom: 2px solid white !important;
  margin-bottom: -2px;
  z-index: 10;
  box-shadow: 0 -2px 5px rgba(0,0,0,0.02);
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

/* Enlarge number input spin buttons */
.input-blue {
  height: 48px !important; /* Increase row height slightly to give arrows more room */
}
.input-blue input[type="number"] {
  height: 100% !important;
  font-size: 18px !important; /* Make number bigger */
}
.input-blue input[type="number"]::-webkit-inner-spin-button,
.input-blue input[type="number"]::-webkit-outer-spin-button {
  width: 20px !important;
  height: 30px !important; /* Fixed height is required for pseudo-elements */
  transform: scale(1.5);
  transform-origin: center right;
  opacity: 1 !important;
  cursor: pointer;
}
.empty-slot { opacity: 0.5; }

/* Grid input CSS */
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

/* Modal CSS */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999; }
.modal-content { background: white; width: 85%; max-width: 850px; padding: 25px; border-radius: 6px; }
.grid-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
.grid-table th, .grid-table td { border: 1px solid #aaa; padding: 8px; text-align: center; }
.stock-info-cell { font-weight: bold; color: #0f766e; font-size: 13px; background-color: #f0fdfa; }
.submit-btn { background: white; border: 1px solid #333; padding: 6px 20px; font-weight: bold; cursor: pointer; }
.close-text-btn { float: right; background: none; border: none; color: #888; cursor: pointer; margin-top: 10px; font-size: 12px; }
</style>


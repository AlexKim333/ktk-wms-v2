<template>
  <div class="workspace-body branch-pos-view">
    <!-- 🌟 TOP BAR: 지점명, 고객 선택, 판매원 선택, POS 개시/마감 상태 -->
    <div class="pos-top-bar">
      <div class="pos-branch-badge">
        <span class="badge-icon">🏪</span>
        <span class="badge-title">{{ $t('branch.pos.lbl_branch', '지점 POS') }}</span>
        <span class="branch-name">{{ currentBranch }}</span>
      </div>
      <div class="pos-selectors">
        <!-- 고객 선택 (Customer) -->
        <div class="selector-item">
          <label>🧑‍🤝‍🧑 {{ $t('branch.pos.lbl_customer', '고객') }}</label>
          <select v-model="selectedCustomer" class="pos-select">
            <option value="Public">{{ $t('branch.pos.opt_public_customer', '일반 고객 (Public)') }}</option>
            <option v-for="cust in customerList" :key="cust.name" :value="cust.name">
              {{ cust.customer_name || cust.name }}
            </option>
          </select>
        </div>
        <!-- 판매원 선택 (Sales Person) -->
        <div class="selector-item">
          <label>🧑‍💼 {{ $t('branch.pos.lbl_sales_person', '판매원') }}</label>
          <select v-model="selectedSalesPerson" class="pos-select">
            <option value="">{{ $t('branch.pos.opt_select_sales_person', '판매원 선택') }}</option>
            <option v-for="sp in salesPersonList" :key="sp.name" :value="sp.name">
              {{ sp.sales_person_name || sp.name }}
            </option>
          </select>
        </div>
        <!-- 점원 모드: 보류 전용 / 관리자 모드: PIN 잠금해제 -->
        <div v-if="branchSession.needsPinGate" class="selector-item" style="background: rgba(14, 165, 233, 0.15); padding: 4px 10px; border-radius: 8px; border: 1px solid #0284c7;">
          <template v-if="branchSession.isClerkMode">
            <label style="color: #38bdf8; font-weight: 700;">{{ $t('branch.pos.mode_clerk_label') }}</label>
            <select
              :value="branchSession.selectedClerkName"
              class="pos-select"
              style="background: #0f172a; color: #38bdf8; font-weight: 700; border-color: #38bdf8;"
              @change="branchSession.setSelectedClerk($event.target.value)"
            >
              <option v-for="clerk in branchSession.activeClerks" :key="clerk.id" :value="clerk.name">
                {{ $t('branch.pos.opt_clerk_item', { name: clerk.name }) }}
              </option>
            </select>
            <button
              type="button"
              class="btn-manager-unlock"
              style="margin-top: 6px; width: 100%; background: #f59e0b; color: #111; border: none; border-radius: 6px; padding: 6px 8px; font-weight: 800; cursor: pointer; font-size: 12px;"
              @click="branchSession.openPinModal()"
            >
              {{ $t('branch.pos.btn_pin_unlock') }}
            </button>
          </template>
          <template v-else>
            <label style="color: #86efac; font-weight: 700;">{{ $t('branch.pos.mode_manager_label') }}</label>
            <button
              type="button"
              style="margin-top: 6px; width: 100%; background: #334155; color: #e2e8f0; border: none; border-radius: 6px; padding: 6px 8px; font-weight: 700; cursor: pointer; font-size: 12px;"
              @click="branchSession.lockToClerk()"
            >
              {{ $t('branch.pos.btn_lock_clerk') }}
            </button>
          </template>
        </div>
      </div>
      <!-- POS 개시/마감 뱃지 -->
      <div class="pos-shift-badge">
        <button 
          :class="['btn-shift', isShiftOpen ? 'shift-open' : 'shift-closed']"
          @click="toggleShift"
        >
          {{ isShiftOpen ? $t('branch.pos.shift_open') : $t('branch.pos.shift_closed') }}
        </button>
      </div>
    </div>
    <!-- 🌟 MAIN CONTENT: 좌측(상품 검색 & 고속 터치 그리드) + 우측(장바구니 & 대기열 & 결제) -->
    <div class="pos-main-body">
      <!-- 좌측 영역: 상품 검색 및 POS Awesome 스타일 그리드 -->
      <div class="pos-left-pane" style="position: relative; display: flex; flex-direction: column;">
        <!-- 듀얼 검색 바 (절대 가려지지 않는 상단 고정 영역) -->
        <div class="pos-search-bar" style="flex-shrink: 0; z-index: 30;">
          <div class="search-box-wrapper flex-2">
            <span class="search-icon">🔍</span>
            <input
              type="text"
              v-model="searchQuery"
              @focus="openSearchStockModal"
              @click="openSearchStockModal"
              :placeholder="$t('branch.inventory.ph_search', '품목명 / 코드 검색')"
              class="search-bar"
              autocomplete="off"
            />
          </div>
          <div class="search-box-wrapper flex-1">
            <span class="search-icon">🏷️</span>
            <input
              type="text"
              v-model="barcodeQuery"
              @keyup.enter="handleBarcodeScan"
              :placeholder="$t('branch.transfer.ph_search_barcode', '바코드 연속 스캔')"
              class="search-bar barcode-bar"
              autocomplete="off"
            />
          </div>
          <button v-if="isSearchingStockModal" class="btn-cancel-search-top" @click="closeSearchStockModal" style="background: white; border: 1px solid #cbd5e1; color: #475569; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-weight: bold;">
            ✕ {{ $t('common.close', '닫기') }}
          </button>
          <button class="btn-refresh-pos" @click="$emit('refresh-items')" :title="$t('common.refresh', '새로고침')">
            🔄
          </button>
        </div>
        <!-- 검색창 바로 하단 영역 (오버레이 및 탭/리스트가 표시되는 구역) -->
        <div class="pos-content-zone" style="flex: 1; overflow: hidden; display: flex; flex-direction: column; position: relative;">
          <!-- 1. 상품 재고 검색 테이블 (isSearchingStockModal 이 켜졌을 때 - 검색창 아래에만 펼쳐짐!) -->
          <div v-if="isSearchingStockModal" class="search-results-overlay" style="position: absolute; inset: 0; background: white; z-index: 20; overflow-y: auto; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            <table class="inventory-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="background: #f1f5f9; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 13px; position: sticky; top: 0; z-index: 2;">{{ $t('branch.inventory.col_item_name', '품명 (상품명)') }}</th>
                  <th style="background: #f1f5f9; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 13px; position: sticky; top: 0; z-index: 2;">{{ $t('branch.transfer.th_item_color', '품명(컬러)') }}</th>
                  <th style="background: #f1f5f9; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 13px; position: sticky; top: 0; z-index: 2;">Pack Qty</th>
                  <th class="highlight-branch" style="background: #e0f2fe; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #0284c7; font-size: 13px; position: sticky; top: 0; z-index: 2;">{{ $t('branch.inventory.col_my_stock', { branch: currentBranch }) }}</th>
                  <th class="highlight-main" style="background: #f1f5f9; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 13px; position: sticky; top: 0; z-index: 2;">{{ $t('branch.inventory.col_main_stock', '메인 재고 ([MAIN] ALARCON - K)') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in displayedSearchItems" :key="item.name" class="inventory-row clickable" @click="addToCart(item, 1)">
                  <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0;">
                    <strong>{{ item.item_name || item.name }}</strong><br/>
                    <span style="font-size: 11px; color: #94a3b8;">{{ item.name }}</span>
                  </td>
                  <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0;">{{ item.custom_color || '-' }}</td>
                  <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #64748b; font-weight: bold;">
                    {{ item.custom_pack_qty || 1 }}
                  </td>
                  <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0;">
                    <strong style="color: #0284c7;">{{ getStock(item.name, currentBranch) }}</strong>
                  </td>
                  <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0;">
                    <strong>{{ getStock(item.name, '[MAIN] ALARCON - K') }}</strong>
                  </td>
                </tr>
                <tr v-if="searchListHasMore">
                  <td colspan="5" style="text-align:center; padding: 16px; background:#fffbeb;">
                    <button type="button" @click.stop="loadMoreSearchItems" style="background:#fef3c7;border:1px solid #f59e0b;color:#b45309;font-weight:bold;padding:10px 20px;border-radius:6px;cursor:pointer;">
                      {{ $t('common.show_more', { n: searchListRemaining }) }}
                    </button>
                  </td>
                </tr>
                <tr v-if="displayedSearchItems.length === 0">
                  <td colspan="5" style="text-align: center; padding: 40px; color: #94a3b8;">{{ $t('branch.inventory.empty_msg', '조회된 품목이 없습니다.') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- 2. 모달 검색 중이 아닐 때만 카테고리 탭과 상품 리스트가 노출됨 -->
          <template v-else>
            <!-- 카테고리 필터 탭 -->
            <div class="pos-category-tabs">
              <button 
                :class="['cat-tab', { active: activeCategory === 'hotkey' }]"
                @click="activeCategory = 'hotkey'; closeSearchStockModal()"
              >
                ⚡ {{ $t('branch.pos.cat_hotkey', '핫키 (Quick Pick)') }}
              </button>
              <button 
                :class="['cat-tab', { active: activeCategory === 'all' }]"
                @click="activeCategory = 'all'; closeSearchStockModal()"
              >
                📦 {{ $t('branch.pos.cat_all', '전체 상품') }} ({{ filteredItems.length }})
              </button>
              <button 
                :class="['cat-tab', { active: activeCategory === 'grid' }]"
                @click="activeCategory = 'grid'; closeSearchStockModal()"
              >
                🎨 {{ $t('branch.pos.cat_grid', '묶음(Grid) 상품') }}
              </button>
              <button 
                :class="['cat-tab', { active: activeCategory === 'single' }]"
                @click="activeCategory = 'single'; closeSearchStockModal()"
              >
                🏷️ {{ $t('branch.pos.cat_single', '단일 품목') }}
              </button>
            </div>
            <!-- 핫키 (Quick Pick) 블록 (activeCategory === 'hotkey' 이고 모달 검색 중이 아닐 때) -->
            <div v-if="activeCategory === 'hotkey'" class="quick-pick-buttons" style="overflow-y: auto; display: flex; flex-direction: column; gap: 20px; padding-bottom: 20px;">
              <!-- Single Quick Pick Block -->
              <div class="hotkey-block">
                <div class="block-header">
                  <h3>{{ $t('branch.transfer.qp_single', '⚡ 단일 상품 (Quick Pick)') }}</h3>
                </div>
                <div class="grid-3x4">
                  <div v-for="(slot, idx) in 8" :key="'slot-'+idx" class="hotkey-card">
                    <template v-if="quickPickSlots[idx]">
                      <button class="hotkey-btn-core" @click="addSingleHotkeyToCart(quickPickSlots[idx])">
                        <div class="line-1">{{ quickPickSlots[idx].item_name }}</div>
                        <div class="line-2">({{ quickPickSlots[idx].custom_color || $t('common.default', 'Default') }} · {{ quickPickSlots[idx].custom_pack_qty || 1 }}入)</div>
                        <div class="line-3 stock-info">{{ getFormattedStockFor(quickPickSlots[idx]) }}</div>
                      </button>
                      <button class="hotkey-sub-edit-btn" @click="openSlotEdit(idx)">⚙ edit</button>
                    </template>
                    <template v-else>
                      <button class="hotkey-btn-core empty-slot" @click="openSlotEdit(idx)">
                        <span class="empty-icon">➕</span>
                        <div class="line-2">{{ $t('branch.transfer.lbl_assign_item', '상품 지정') }}</div>
                      </button>
                      <button class="hotkey-sub-edit-btn" @click="openSlotEdit(idx)">⚙ edit</button>
                    </template>
                  </div>
                </div>
              </div>
              <!-- Grid Quick Pick Block -->
              <div class="hotkey-block">
                <div class="block-header">
                  <h3 style="color: #00a896;">{{ $t('branch.transfer.qp_grid', '🌐 묶음 상품 (Grid Quick Pick)') }}</h3>
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
                        <div class="line-2">{{ $t('branch.transfer.lbl_assign_item', '상품 지정') }}</div>
                      </button>
                      <button class="hotkey-sub-edit-btn" @click="openGridSlotEdit(idx)">⚙ edit</button>
                    </template>
                  </div>
                </div>
              </div>
            </div>
            <!-- 일반 상품 카드 리스트 -->
            <div v-else class="pos-product-grid">
              <div 
                v-for="item in paginatedItems" 
                :key="item.name" 
                class="pos-product-card"
                @click="addToCart(item, 1)"
              >
                <div class="card-header">
                  <span class="item-code">{{ item.name }}</span>
                  <span class="pack-badge" v-if="item.custom_pack_qty > 1">{{ item.custom_pack_qty }}入</span>
                </div>
                <div class="item-name">{{ item.item_name || item.name }}</div>
                
                <div class="card-footer">
                  <div class="stock-info">
                    📦 {{ getStockBox(item) }}{{ $t('branch.transfer.th_box', '박스') }} /
                    {{ getStockEach(item) }}{{ $t('branch.transfer.lbl_unit_ea', '개') }}
                  </div>
                  <div class="price-badge">
                    $ {{ formatPrice(item.price_list_rate || 0) }}
                  </div>
                </div>
              </div>
              <div v-if="filteredItems.length === 0" class="empty-products">
                📭 {{ $t('branch.pos.no_products_found', '검색된 품목이 없습니다.') }}
              </div>
            </div>
            <!-- 페이지네이션 컨트롤 -->
            <div class="pos-pagination" v-if="activeCategory !== 'hotkey' && totalPages > 1">
              <button :disabled="currentPage === 1" @click="currentPage--">◀</button>
              <span>{{ currentPage }} / {{ totalPages }}</span>
              <button :disabled="currentPage === totalPages" @click="currentPage++">▶</button>
            </div>
          </template>
        </div>
      </div>
      <!-- 우측 영역: 장바구니 / 보류 목록 / 결제 합계 -->
      <div class="pos-right-pane">
        <!-- 탭 헤더: 현재 장바구니 vs 보류된 주문 목록 -->
        <div class="cart-tabs">
          <button 
            :class="['cart-tab-btn', { active: rightTab === 'cart' }]"
            @click="rightTab = 'cart'"
          >
            🛒 {{ $t('branch.pos.tab_cart', '현재 장바구니') }} ({{ cartItems.length }})
          </button>
          <button 
            :class="['cart-tab-btn', { active: rightTab === 'held' }]"
            @click="rightTab = 'held'"
          >
            ⏸️ {{ $t('branch.pos.tab_held', '보류된 주문') }} ({{ heldOrders.length }})
          </button>
        </div>
        <!-- 1. CART VIEW -->
        <div v-if="rightTab === 'cart'" class="cart-view-container">
          <!-- 장바구니 품목 테이블 -->
          <div class="cart-items-wrapper">
            <table class="cart-table">
              <thead>
                <tr>
                  <th>{{ $t('branch.pos.th_item', '상품') }}</th>
                  <th style="width: 110px;">{{ $t('branch.pos.th_qty', '수량') }}</th>
                  <th style="width: 80px;">{{ $t('branch.pos.th_price', '단가') }}</th>
                  <th style="width: 90px;">{{ $t('branch.pos.th_total', '합계') }}</th>
                  <th style="width: 40px;"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(cItem, idx) in cartItems" :key="cItem.item_code">
                  <td class="cell-item">
                    <div class="c-item-code">{{ cItem.item_code }}</div>
                    <div class="c-item-stock">{{ getStock(cItem.item_code, currentBranch) }}</div>
                  </td>
                  <td class="cell-qty">
                    <div class="qty-control">
                      <button @click.stop="decreaseQty(idx)">-</button>
                      <input type="number" v-model.number="cItem.qty" min="1" class="qty-input" @change="applyTierPricingToCartItem(cItem)" />
                      <button @click.stop="increaseQty(idx)">+</button>
                    </div>
                  </td>
                  <td class="cell-price">
                    <div class="cart-price-edit-box">
                      <span class="curr">$</span>
                      <input 
                        type="number" 
                        v-model.number="cItem.price_list_rate" 
                        min="0" 
                        step="0.01" 
                        class="inline-price-input"
                        @change="handleCartPriceChange(cItem)"
                        :title="$t('branch.pos.title_price_learn')"
                      />
                    </div>
                    <div v-if="isDiscountTier(cItem)" class="tier-applied-badge">
                      ⚡ {{ tierBadgeText(cItem) }}{{ cItem.is_smart_box ? ' (BOX)' : '' }}{{ cItem.is_grid_bundled ? $t('branch.pos.tier_grid_sum', { qty: cItem.grid_group_qty }) : '' }}
                    </div>
                  </td>
                  <td class="cell-total">
                    $ {{ formatPrice(cItem.qty * cItem.price_list_rate) }}
                  </td>
                  <td class="cell-action">
                    <button class="btn-remove-item" @click.stop="removeItem(idx)">✕</button>
                  </td>
                </tr>
                <tr v-if="cartItems.length === 0">
                  <td colspan="5" class="empty-cart-cell">
                    🛒 {{ $t('branch.pos.cart_empty_msg', '상품을 선택하거나 바코드를 스캔하세요.') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- 보류 / 비우기 버튼 -->
          <div class="cart-mid-actions">
            <button class="btn-hold" :disabled="cartItems.length === 0" @click="holdCurrentOrder">
              ⏸️ {{ $t('branch.pos.btn_hold', '주문 보류') }}
            </button>
            <button class="btn-clear" :disabled="cartItems.length === 0" @click="clearCart">
              🗑️ {{ $t('branch.pos.btn_clear', '장바구니 비우기') }}
            </button>
          </div>
          <!-- 요약 및 할인 합계 영역 -->
          <div class="cart-summary-box">
            <div class="summary-row">
              <span>{{ $t('branch.pos.lbl_subtotal', '소계') }}:</span>
              <span>$ {{ formatPrice(subTotal) }} MXN</span>
            </div>
            <div class="summary-row discount-row">
              <span>{{ $t('branch.pos.lbl_discount', '할인(%)') }}:</span>
              <div class="discount-input-wrap">
                <input type="number" v-model.number="discountPercentage" min="0" max="100" class="discount-input" />
                <span>% (-$ {{ formatPrice(discountAmount) }})</span>
              </div>
            </div>
            <div class="summary-row grand-total-row">
              <span>{{ $t('branch.pos.lbl_grand_total', '최종 결제금액') }}:</span>
              <span class="grand-total-val">$ {{ formatPrice(grandTotal) }} MXN</span>
            </div>
            <!-- 최종 결제: 지점장만 / 점원은 보류만 -->
            <button 
              v-if="branchSession.isManagerMode"
              class="btn-checkout" 
              :disabled="cartItems.length === 0 || !isShiftOpen"
              @click="openPaymentModal"
            >
              💳 {{ $t('branch.pos.btn_checkout', '결제 및 POS 영수증 발행') }}
            </button>
            <button 
              v-else
              class="btn-checkout" 
              style="background: #0284c7; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.35); font-size: 15px;"
              :disabled="cartItems.length === 0 || !isShiftOpen || !branchSession.selectedClerkName"
              @click="holdCurrentOrder"
            >
              {{ $t('branch.pos.btn_hold_to_counter', { name: branchSession.selectedClerkName || $t('branch.pos.clerk_unselected') }) }}
            </button>
          </div>
        </div>
        <!-- 2. HELD ORDERS VIEW (보류 목록) -->
        <div v-else class="held-orders-container">
          <div v-if="heldOrders.length === 0" class="empty-held-list">
            📭 {{ $t('branch.pos.no_held_orders', '보류된 주문이 없습니다.') }}
          </div>
          <div v-else class="held-orders-list">
            <div v-for="(hOrder, idx) in heldOrders" :key="idx" class="held-order-card">
              <div class="h-header">
                <span class="h-time">🕒 {{ hOrder.timeStr }}</span>
                <span class="h-customer">
                  <span v-if="hOrder.clerkName" style="background: #e0f2fe; color: #0284c7; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 800; margin-right: 6px; display: inline-block;">
                    🧑‍💼 {{ hOrder.clerkName }}
                  </span>
                  🧑‍🤝‍🧑 {{ hOrder.customer || 'Public' }}
                </span>
              </div>
              <div class="h-summary">
                <span>{{ $t('branch.pos.held_summary', { count: hOrder.items.length, qty: hOrder.totalQty }) }}</span>
                <span class="h-total">$ {{ formatPrice(hOrder.grandTotal) }} MXN</span>
              </div>
              <div class="h-actions">
                <button
                  v-if="branchSession.isManagerMode"
                  class="btn-recall"
                  @click="recallOrder(idx)"
                >📂 {{ $t('branch.pos.btn_recall', '불러오기') }}</button>
                <button
                  v-if="branchSession.isManagerMode"
                  class="btn-delete-held"
                  @click="deleteHeldOrder(idx)"
                >🗑️</button>
                <span v-else style="font-size: 12px; color: #64748b; font-weight: 600;">{{ $t('branch.pos.held_locked_msg') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- 🌟 PAYMENT MODAL (복합 결제 및 Change 정산 모달) -->
    <BranchPaymentModal
      :is-open="showPaymentModal"
      v-model:cash-amount="cashAmount"
      v-model:card-amount="cardAmount"
      v-model:transfer-amount="transferAmount"
      :grand-total="grandTotal"
      :total-paid="totalPaid"
      :change-amount="changeAmount"
      :is-submitting="isSubmitting"
      @close="showPaymentModal = false"
      @submit="submitPosInvoice"
    />
  </div>
    <!-- 1. 단일 버튼 상품 지정 독립 모달 -->
    <BranchQuickPickSlotModal
      :current-branch="currentBranch"
      :is-open="isSlotEditModalOpen"
      :slot-index="editSlotIndex"
      :is-grid-mode="false"
      :items="rawItems"
      :bin-data="binData"
      :pending-reserved="pendingReserved"
      @close="isSlotEditModalOpen = false"
      @assign="assignSlotItem"
      @clear="clearSlot"
    />
    <!-- 2. 그리드 묶음 상품 지정 독립 모달 -->
    <BranchQuickPickSlotModal
      :current-branch="currentBranch"
      :is-open="isGridSlotEditModalOpen"
      :slot-index="editGridSlotIndex"
      :is-grid-mode="true"
      :items="gridHotkeys"
      :bin-data="binData"
      :pending-reserved="pendingReserved"
      @close="isGridSlotEditModalOpen = false"
      @assign="assignGridSlotItem"
      @clear="clearGridSlot"
    />
    <!-- 3. 그리드 묶음 상품 수량 선택 독립 모달 -->
    <BranchGridSelectionModal
      :current-branch="currentBranch"
      :is-open="isGridModalOpen"
      :active-group="activeGroup"
      :bin-data="binData"
      :pending-reserved="pendingReserved"
      @close="isGridModalOpen = false"
      @submit="handleGridSelectionSubmit"
    />
    <!-- 미완성 단가 일괄 등록 모달 (결제 후 0.0001초 인메모리 감지) -->
    <BranchIncompletePriceModal
      :is-open="showIncompletePriceModal"
      :items="incompleteSoldItems"
      :branch-name="currentBranch"
      :raw-items="rawItems"
      @close="showIncompletePriceModal = false"
      @completed="showIncompletePriceModal = false"
    />
    <!-- PIN 잠금해제 모달 (프론트 전용, Frappe 무관) -->
    <PinUnlockModal variant="branch" @unlock="branchSession.unlockWithPin()" />
</template>
<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../../stores/auth.js'
import { useBranchSessionStore } from '../../stores/branchSession.js'
import frappeApi from '../../api/frappe.js'
import { useItemSearch, rankItemNameMatches } from '../../composables/useItemSearch'
import { resolveItemTiers, calculateTierPrice, getBarcodeScanQty, recalculateCartTierPrices, getIncompletePriceItems, learnTierPriceFromCart, getTierCode } from '../../composables/usePriceTierEngine.js'
import { usePagedList } from '../../composables/usePagedList.js'
import BranchIncompletePriceModal from './BranchIncompletePriceModal.vue'
import BranchQuickPickSlotModal from './BranchQuickPickSlotModal.vue'
import BranchGridSelectionModal from './BranchGridSelectionModal.vue'
import BranchPaymentModal from './BranchPaymentModal.vue'
import PinUnlockModal from '../PinUnlockModal.vue'
import { formatPrice } from '../../utils/formatPrice.js'
const { t } = useI18n()
const authStore = useAuthStore()
const branchSession = useBranchSessionStore()
const { rebuildItemIndex, searchItemsOrAll } = useItemSearch()
const props = defineProps({
  rawItems: { type: Array, default: () => [] },
  binData: { type: Object, default: () => ({}) },
  pendingReserved: { type: Object, default: () => ({}) },
  branchList: { type: Array, default: () => [] },
  customerList: { type: Array, default: () => [] },
  salesPersonList: { type: Array, default: () => [] }
})
const emit = defineEmits(['refresh-items'])
watch(() => props.rawItems, (newVal) => {
  if (newVal && newVal.length > 0) {
    rebuildItemIndex(newVal)
  }
}, { immediate: true })
// ----------------------------------------------------
// STATE
// ----------------------------------------------------
const currentBranch = computed(() => authStore.user?.branch_name || '[MAIN] ALARCON - K')
const selectedCustomer = ref('Public')
const selectedSalesPerson = ref('')
const isShiftOpen = ref(true)
const searchQuery = ref('')
const barcodeQuery = ref('')
const activeCategory = ref('hotkey') // 'hotkey' | 'all' | 'grid' | 'single'
const currentPage = ref(1)
const itemsPerPage = 20
const rightTab = ref('cart') // 'cart' | 'held'
const cartItems = ref([])
const heldOrders = ref([])
const discountPercentage = ref(0)
const showPaymentModal = ref(false)
const isSubmitting = ref(false)
const showIncompletePriceModal = ref(false)
const incompleteSoldItems = ref([])
// 결제 모달 금액
const cashAmount = ref(0)
const cardAmount = ref(0)
const transferAmount = ref(0)
// 점원/지점장 모드는 branchSession store (localStorage PIN·명단)
// ----------------------------------------------------
// STORAGE KEYS FOR HELD ORDERS
// ----------------------------------------------------
const HELD_ORDERS_KEY = computed(() => `ktk_wms_branch_pos_held_${currentBranch.value || 'DEFAULT'}`)
onMounted(() => {
  if (branchSession.needsPinGate && !branchSession.selectedClerkName) {
    branchSession.initForUser()
  }
  // 기본 영업사원 자동 매핑
  if (authStore.user?.full_name || authStore.user?.member_name) {
    const spMatch = props.salesPersonList.find(
      s => s.sales_person_name === authStore.user.full_name || s.name === authStore.user.member_name
    )
    if (spMatch) {
      selectedSalesPerson.value = spMatch.name
    } else if (props.salesPersonList.length > 0) {
      selectedSalesPerson.value = props.salesPersonList[0].name
    }
  }
  // 보류 목록 로컬 스토리지 불러오기
  try {
    const savedHeld = localStorage.getItem(HELD_ORDERS_KEY.value)
    if (savedHeld) {
      heldOrders.value = JSON.parse(savedHeld)
    }
  } catch (e) {
    console.warn('Failed to load held orders', e)
  }
})
// ----------------------------------------------------
// ITEM FILTERING & PAGINATION
// ----------------------------------------------------
const filteredItems = computed(() => {
  if (!props.rawItems || props.rawItems.length === 0) return []
  // 1. FlexSearch 기반 아이템 명(item_name) 최우선 검색 및 일치도 정렬
  props.rawItems; // 강제 반응성 트리거
  const q = (searchQuery.value || '').trim()
  let list = []
  if (!q) {
    list = searchItemsOrAll('', { limit: null, allLimit: 99999 })
  } else {
    const hits = searchItemsOrAll(q, { limit: null, allLimit: 99999 })
    list = rankItemNameMatches(hits, q)
  }
  // 2. 카테고리 필터
  return list.filter(item => {
    if (activeCategory.value === 'grid' && !item.custom_is_grid_item && !item.custom_grid_group_id) {
      return false
    }
    if (activeCategory.value === 'single' && (item.custom_is_grid_item || item.custom_grid_group_id)) {
      return false
    }
    return true
  })
})
const totalPages = computed(() => Math.max(1, Math.ceil(filteredItems.value.length / itemsPerPage)))
const paginatedItems = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return filteredItems.value.slice(start, start + itemsPerPage)
})
watch([searchQuery, activeCategory], () => {
  currentPage.value = 1
})
// ----------------------------------------------------
// STOCK & PRICE UTILS
// ----------------------------------------------------
const getStockBox = (item) => {
  const total = Number(props.binData?.[item.name]?.[currentBranch.value] || 0)
  const pack = Number(item.custom_pack_qty || 1)
  return Math.floor(total / pack)
}
const getStockEach = (item) => {
  const total = Number(props.binData?.[item.name]?.[currentBranch.value] || 0)
  const pack = Number(item.custom_pack_qty || 1)
  return (total % pack)
}
// ----------------------------------------------------
// QUICK PICK & SEARCH STOCK MODAL LOGIC
// ----------------------------------------------------
const getStock = (itemCode, warehouse) => {
  if (!warehouse) return 0
  const actual = Number(props.binData?.[itemCode]?.[warehouse] || 0)
  const reserved = Number(props.pendingReserved?.[warehouse]?.[itemCode] || 0)
  return actual - reserved
}
const getFormattedStockFor = (item) => {
  if (!item) return ''
  const availableQty = getStock(item.name, currentBranch.value)
  const packQty = Number(item.custom_pack_qty || 1)
  const boxes = Math.floor(availableQty / packQty)
  const eaches = availableQty % packQty
  return `📦 ${boxes} Box / ${eaches} ${t('branch.transfer.lbl_unit_ea', 'EA')}`
}
const userKey = authStore.user?.member_name || 'guest'
const singleStorageKey = `wms_quick_pick_slots_${userKey}`
const gridStorageKey = `wms_grid_quick_pick_slots_${userKey}`
const quickPickSlotNames = ref(JSON.parse(localStorage.getItem(singleStorageKey)) || new Array(8).fill(null))
const gridPickSlotNames = ref(JSON.parse(localStorage.getItem(gridStorageKey)) || new Array(8).fill(null))
const quickPickSlots = computed(() => {
  return quickPickSlotNames.value.map(name => {
    if (!name) return null
    return props.rawItems.find(i => i.name === name) || null
  })
})
const gridHotkeys = computed(() => {
  const groupedByName = {}
  props.rawItems.forEach(item => {
    const groupId = item.custom_grid_group_id || item.item_name || t('common.unclassified', 'Unclassified') || 'Unclassified'
    if (!groupedByName[groupId]) {
      groupedByName[groupId] = {
        id: groupId,
        group_name: item.item_name || t('common.unclassified', 'Unclassified') || 'Unclassified',
        variants: [],
        is_explicit_grid: false
      }
    }
    if (item.custom_is_grid_item === 1) {
      groupedByName[groupId].is_explicit_grid = true
    }
    groupedByName[groupId].variants.push({ ...item, input_box: 0, input_each: 0 })
  })
  const newGrids = []
  Object.values(groupedByName).forEach(group => {
    if (group.is_explicit_grid || group.variants.length > 1) {
      newGrids.push(group)
    }
  })
  return newGrids
})
const gridPickSlots = computed(() => {
  return gridPickSlotNames.value.map(id => {
    if (!id) return null
    return gridHotkeys.value.find(g => g.id === id) || null
  })
})
// Single Pick Modal Logic
const isSlotEditModalOpen = ref(false)
const editSlotIndex = ref(-1)
const openSlotEdit = (idx) => {
  editSlotIndex.value = idx
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
  if (!item) return
  addToCart(item, 1)
}
// Grid Pick Modal Logic
const isGridSlotEditModalOpen = ref(false)
const editGridSlotIndex = ref(-1)
const openGridSlotEdit = (idx) => {
  editGridSlotIndex.value = idx
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
    activeGroup.value = JSON.parse(JSON.stringify(group))
    activeGroup.value.variants.forEach(v => {
      v.input_box = null
      v.input_each = null
    })
    isGridModalOpen.value = true
  }
}
const handleGridSelectionSubmit = (selectedVariants) => {
  if (!selectedVariants || !selectedVariants.length) {
    isGridModalOpen.value = false
    return
  }
  selectedVariants.forEach(v => {
    const boxQty = Number(v.input_box) || 0
    const eachQty = Number(v.input_each) || 0
    const packQty = Number(v.custom_pack_qty || 1)
    const totalQtyToAdd = (boxQty * packQty) + eachQty
    addToCart(v, totalQtyToAdd)
  })
  isGridModalOpen.value = false
}
// Search Stock Modal Logic
const isSearchingStockModal = ref(false)
const openSearchStockModal = () => {
  isSearchingStockModal.value = true
}
const closeSearchStockModal = () => {
  isSearchingStockModal.value = false
  searchQuery.value = ''
  resetSearchPage()
}
const {
  visible: displayedSearchItems,
  hasMore: searchListHasMore,
  remaining: searchListRemaining,
  loadMore: loadMoreSearchItems,
  reset: resetSearchPage
} = usePagedList(filteredItems, 50)
watch(searchQuery, () => {
  resetSearchPage()
})
// ----------------------------------------------------
// BARCODE SCANNING & CART OPERATIONS
// ----------------------------------------------------
const handleBarcodeScan = () => {
  const code = (barcodeQuery.value || '').trim()
  if (!code) return
  const matched = props.rawItems.find(i => 
    i.name?.toLowerCase() === code.toLowerCase() ||
    i.custom_tier_1_barcode?.toLowerCase() === code.toLowerCase() ||
    i.custom_tier_2_barcode?.toLowerCase() === code.toLowerCase() ||
    i.custom_tier_3_barcode?.toLowerCase() === code.toLowerCase() ||
    i.custom_tier_4_barcode?.toLowerCase() === code.toLowerCase()
  )
  if (matched) {
    const resolved = resolveItemTiers(authStore.user?.branch_name, matched)
    const qtyToAdd = getBarcodeScanQty(code, matched, resolved)
    addToCart(matched, qtyToAdd)
    barcodeQuery.value = ''
  } else {
    alert(t('branch.pos.msg_err_barcode', { code }))
    barcodeQuery.value = ''
  }
}
const applyTierPricingToCartItem = () => {
  recalculateCartTierPrices(cartItems.value, authStore.user?.branch_name)
}
// 수량구간 뱃지: 판별은 코드값(tier_code/tier_index)으로만 한다.
// 이 변경 전에 localStorage 에 저장된 보류 주문은 코드값이 없어 라벨로 추정하고, 문구는 원본을 그대로 보여준다.
const tierBadgeCode = (cItem) => {
  if (cItem?.tier_code) return cItem.tier_code
  if (Number(cItem?.tier_index) > 0) return getTierCode(cItem.tier_index)
  const legacyLabel = String(cItem?.tier_label || '')
  if (!legacyLabel) return 'base'
  return (legacyLabel.includes('1구간') || legacyLabel.includes('단품')) ? 'base' : 'legacy'
}
const isDiscountTier = (cItem) => tierBadgeCode(cItem) !== 'base'
// 지점 설정에서 직접 붙인 라벨(예: '도매가')이 있으면 그 문구를 그대로 존중하고,
// 시스템 기본 라벨일 때만 구간 코드값으로 4개국어 문구를 출력한다.
const tierBadgeText = (cItem) => {
  const code = tierBadgeCode(cItem)
  const label = String(cItem?.tier_label || '')
  if (code === 'legacy') return label
  if (cItem?.tier_label_is_custom && label) return label
  return t(`branch.pos.tier_badge_${code}`)
}
const handleCartPriceChange = (cItem) => {
  learnTierPriceFromCart(cItem, authStore.user?.branch_name)
}
const addToCart = (item, qtyToAdd = 1) => {
  if (!isShiftOpen.value) {
    alert(t('branch.pos.msg_err_shift_closed'))
    return
  }
  const existing = cartItems.value.find(c => c.item_code === item.name)
  if (existing) {
    existing.qty += qtyToAdd
    applyTierPricingToCartItem(existing)
  } else {
    const newItem = {
      item_code: item.name,
      item_name: item.item_name || item.name,
      custom_pack_qty: item.custom_pack_qty || 1,
      price_list_rate: Number(item.price_list_rate || 0),
      qty: qtyToAdd,
      uom: item.stock_uom || 'Nos',
      raw_item: item
    }
    applyTierPricingToCartItem(newItem)
    cartItems.value.push(newItem)
  }
}
const increaseQty = (idx) => {
  cartItems.value[idx].qty++
  applyTierPricingToCartItem(cartItems.value[idx])
}
const decreaseQty = (idx) => {
  if (cartItems.value[idx].qty > 1) {
    cartItems.value[idx].qty--
    applyTierPricingToCartItem(cartItems.value[idx])
  } else {
    removeItem(idx)
  }
}
const removeItem = (idx) => {
  cartItems.value.splice(idx, 1)
  applyTierPricingToCartItem()
}
const clearCart = () => {
  if (cartItems.value.length === 0) return
  if (confirm(t('branch.pos.msg_cfm_clear_cart'))) {
    cartItems.value = []
    discountPercentage.value = 0
  }
}
// ----------------------------------------------------
// SUMMARY CALCULATIONS
// ----------------------------------------------------
const subTotal = computed(() => {
  return cartItems.value.reduce((acc, c) => acc + (c.qty * c.price_list_rate), 0)
})
const discountAmount = computed(() => {
  const pct = Math.min(100, Math.max(0, Number(discountPercentage.value || 0)))
  return (subTotal.value * pct) / 100
})
const grandTotal = computed(() => {
  return Math.max(0, subTotal.value - discountAmount.value)
})
// ----------------------------------------------------
// HOLD / RECALL ORDERS (주문 보류 및 복원)
// ----------------------------------------------------
const holdCurrentOrder = () => {
  if (cartItems.value.length === 0) return
  if (branchSession.isClerkMode && !branchSession.selectedClerkName) {
    alert(t('branch.pos.msg_err_no_clerk'))
    return
  }
  const newHold = {
    timeStr: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    customer: selectedCustomer.value,
    salesPerson: selectedSalesPerson.value,
    clerkName: branchSession.isClerkMode
      ? branchSession.selectedClerkName
      : (branchSession.selectedClerkName || ''),
    items: JSON.parse(JSON.stringify(cartItems.value)),
    totalQty: cartItems.value.reduce((a, b) => a + b.qty, 0),
    grandTotal: grandTotal.value
  }
  heldOrders.value.unshift(newHold)
  saveHeldOrdersToStorage()
  cartItems.value = []
  discountPercentage.value = 0
  if (branchSession.isClerkMode && branchSession.selectedClerkName) {
    alert(t('branch.pos.msg_held_saved', { name: branchSession.selectedClerkName }))
  } else {
    alert(t('branch.pos.msg_held_moved'))
  }
}
const recallOrder = (idx) => {
  if (!branchSession.isManagerMode) {
    alert(t('branch.pos.msg_err_recall_locked'))
    return
  }
  const target = heldOrders.value[idx]
  if (!target) return
  if (cartItems.value.length > 0) {
    if (!confirm(t('branch.pos.msg_cfm_recall'))) return
  }
  selectedCustomer.value = target.customer || 'Public'
  selectedSalesPerson.value = target.salesPerson || ''
  cartItems.value = target.items
  discountPercentage.value = 0
  heldOrders.value.splice(idx, 1)
  saveHeldOrdersToStorage()
  rightTab.value = 'cart'
}
const deleteHeldOrder = (idx) => {
  if (!branchSession.isManagerMode) return
  if (confirm(t('branch.pos.msg_cfm_delete_held'))) {
    heldOrders.value.splice(idx, 1)
    saveHeldOrdersToStorage()
  }
}
const saveHeldOrdersToStorage = () => {
  try {
    localStorage.setItem(HELD_ORDERS_KEY.value, JSON.stringify(heldOrders.value))
  } catch (e) {
    console.warn('Failed saving held orders', e)
  }
}
// ----------------------------------------------------
// PAYMENT MODAL & INVOICE SUBMISSION
// ----------------------------------------------------
const openPaymentModal = () => {
  if (!branchSession.isManagerMode) {
    alert(t('branch.pos.msg_err_pay_locked'))
    return
  }
  cashAmount.value = grandTotal.value
  cardAmount.value = 0
  transferAmount.value = 0
  showPaymentModal.value = true
}
const totalPaid = computed(() => {
  return Number(cashAmount.value || 0) + Number(cardAmount.value || 0) + Number(transferAmount.value || 0)
})
const changeAmount = computed(() => {
  return totalPaid.value - grandTotal.value
})
const submitPosInvoice = async () => {
  if (!branchSession.isManagerMode) {
    alert(t('branch.pos.msg_err_submit_manager_only'))
    return
  }
  if (totalPaid.value < grandTotal.value) {
    alert(t('branch.pos.msg_err_underpaid'))
    return
  }
  if (isSubmitting.value) return
  isSubmitting.value = true
  try {
    const payload = {
      doctype: 'Sales Invoice',
      docstatus: 1, // 즉시 서브밑 완료
      company: 'kecon',
      is_pos: 1,
      update_stock: 1,
      customer: selectedCustomer.value || 'Public',
      set_warehouse: currentBranch.value,
      sales_partner: selectedSalesPerson.value || '',
      discount_amount: discountAmount.value,
      items: cartItems.value.map(item => ({
        item_code: item.item_code,
        qty: item.qty,
        rate: item.price_list_rate,
        warehouse: currentBranch.value,
        uom: item.uom || 'Nos'
      })),
      payments: [
        { mode_of_payment: 'Cash', amount: cashAmount.value },
        { mode_of_payment: 'Credit Card', amount: cardAmount.value },
        { mode_of_payment: 'Wire Transfer', amount: transferAmount.value }
      ].filter(p => Number(p.amount) > 0)
    }
    const res = await frappeApi.post('/api/resource/Sales Invoice', payload)
    const newInvoiceName = res.data?.data?.name || 'POS-INV-LOCAL'
    alert(t('branch.pos.msg_pay_success', { name: newInvoiceName, change: formatPrice(changeAmount.value) }))
    
    // 미완성 단가 품목 감지 (0.0001초 인메모리 필터링)
    const incomplete = getIncompletePriceItems(cartItems.value)
    
    // 장바구니 및 모달 초기화
    cartItems.value = []
    discountPercentage.value = 0
    showPaymentModal.value = false
    emit('refresh-items')
    if (incomplete.length > 0) {
      setTimeout(() => {
        const confirmComplete = confirm(t('branch.pos.msg_cfm_incomplete_price', { count: incomplete.length }))
        if (confirmComplete) {
          incompleteSoldItems.value = incomplete
          showIncompletePriceModal.value = true
        }
      }, 300)
    }
  } catch (err) {
    console.error('POS Invoice submission error:', err)
    const serverMsg = err.response?.data?.exception || err.response?.data?.message || err.message
    alert(t('branch.pos.msg_err_submit', { error: serverMsg }))
  } finally {
    isSubmitting.value = false
  }
}
const toggleShift = () => {
  if (isShiftOpen.value) {
    if (confirm(t('branch.pos.msg_cfm_close_shift'))) {
      isShiftOpen.value = false
    }
  } else {
    if (confirm(t('branch.pos.msg_cfm_open_shift'))) {
      isShiftOpen.value = true
    }
  }
}
</script>
<style scoped>
.branch-pos-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f1f5f9;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  color: #1e293b;
  overflow: hidden;
}
/* 🌟 TOP BAR */
.pos-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #1e293b;
  color: white;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}
.pos-branch-badge {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pos-branch-badge .badge-icon {
  font-size: 24px;
}
.pos-branch-badge .badge-title {
  font-size: 14px;
  color: #94a3b8;
  font-weight: 600;
}
.pos-branch-badge .branch-name {
  font-size: 17px;
  font-weight: 800;
  color: #38bdf8;
  background: #0f172a;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid #334155;
}
.pos-selectors {
  display: flex;
  gap: 20px;
  align-items: center;
}
.selector-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.selector-item label {
  font-size: 13px;
  color: #cbd5e1;
  font-weight: 600;
}
.pos-select {
  padding: 7px 12px;
  border-radius: 6px;
  border: 1px solid #475569;
  background: #334155;
  color: white;
  font-size: 13px;
  outline: none;
  cursor: pointer;
}
.btn-shift {
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: 0.2s;
}
.shift-open {
  background: #10b981;
  color: white;
}
.shift-closed {
  background: #ef4444;
  color: white;
}
/* 🌟 MAIN CONTENT BODY */
.pos-main-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  gap: 16px;
  padding: 16px;
}
/* 🌟 LEFT PANE */
.pos-left-pane {
  flex: 1.4;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  overflow: hidden;
  padding: 16px;
  gap: 14px;
}
.pos-search-bar {
  display: flex;
  gap: 10px;
  align-items: center;
}
.search-box-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}
.flex-2 { flex: 2; }
.flex-1 { flex: 1; }
.search-icon {
  position: absolute;
  left: 12px;
  font-size: 14px;
  color: #94a3b8;
}
.search-bar {
  width: 100%;
  padding: 10px 10px 10px 36px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}
.search-bar:focus {
  border-color: #0284c7;
}
.barcode-bar {
  background: #f0fdf4;
  border-color: #86efac;
}
.btn-refresh-pos {
  padding: 9px 14px;
  border-radius: 8px;
  background: #e2e8f0;
  border: none;
  cursor: pointer;
  font-size: 15px;
}
.pos-category-tabs {
  display: flex;
  gap: 8px;
}
.cat-tab {
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s;
}
.cat-tab.active {
  background: #0284c7;
  color: white;
  border-color: #0284c7;
}
.pos-product-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  overflow-y: auto;
  align-content: flex-start;
  padding-right: 4px;
}
.pos-product-card {
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.pos-product-card:hover {
  transform: translateY(-2px);
  border-color: #0ea5e9;
  box-shadow: 0 4px 10px rgba(14, 165, 233, 0.15);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.item-code {
  font-size: 12px;
  font-weight: 700;
  color: #0284c7;
}
.pack-badge {
  font-size: 11px;
  background: #f1f5f9;
  color: #475569;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
}
.item-name {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  height: 34px;
}
.card-footer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-top: 1px dashed #f1f5f9;
  padding-top: 8px;
}
.stock-info {
  font-size: 11px;
  color: #64748b;
}
.price-badge {
  font-size: 15px;
  font-weight: 800;
  color: #059669;
}
.empty-products {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 0;
  color: #94a3b8;
  font-size: 15px;
}
.pos-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
}
.pos-pagination button {
  padding: 6px 12px;
  border: 1px solid #cbd5e1;
  background: white;
  border-radius: 6px;
  cursor: pointer;
}
/* 🌟 RIGHT PANE */
.pos-right-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  overflow: hidden;
}
.cart-tabs {
  display: flex;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}
.cart-tab-btn {
  flex: 1;
  padding: 12px;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.cart-tab-btn.active {
  color: #0284c7;
  border-bottom-color: #0284c7;
  background: white;
}
.cart-view-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}
.cart-items-wrapper {
  flex: 1;
  overflow-y: auto;
}
.cart-table {
  width: 100%;
  border-collapse: collapse;
}
.cart-table th {
  background: #f8fafc;
  padding: 10px;
  font-size: 12px;
  color: #64748b;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
}
.cart-table td {
  padding: 10px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 13px;
  vertical-align: middle;
}
.cell-item .c-item-code {
  font-size: 12px;
  color: #0284c7;
  font-weight: 700;
}
.cell-item .c-item-stock {
  font-size: 15px;
  font-weight: 800;
  color: #dc2626;
  margin-top: 3px;
}
.qty-control {
  display: flex;
  align-items: center;
  gap: 4px;
}
.qty-control button {
  width: 26px;
  height: 26px;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  font-weight: bold;
  cursor: pointer;
}
.qty-input {
  width: 44px;
  text-align: center;
  padding: 4px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-weight: bold;
}
.cell-price {
  color: #64748b;
}
.cell-total {
  font-weight: 800;
  color: #0f172a;
}
.btn-remove-item {
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-weight: bold;
  font-size: 14px;
}
.empty-cart-cell {
  text-align: center;
  padding: 60px 0;
  color: #94a3b8;
}
.cart-mid-actions {
  display: flex;
  gap: 10px;
  padding: 10px 16px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}
.btn-hold, .btn-clear {
  flex: 1;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  color: #475569;
}
.btn-hold:hover:not(:disabled) { background: #e0f2fe; color: #0284c7; }
.btn-clear:hover:not(:disabled) { background: #fee2e2; color: #dc2626; }
.btn-hold:disabled, .btn-clear:disabled { opacity: 0.5; cursor: not-allowed; }
.cart-summary-box {
  padding: 16px;
  background: #0f172a;
  color: white;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: #cbd5e1;
}
.discount-row {
  align-items: center;
}
.discount-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}
.discount-input {
  width: 55px;
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid #475569;
  background: #334155;
  color: white;
  text-align: right;
}
.grand-total-row {
  border-top: 1px solid #334155;
  padding-top: 10px;
  font-size: 16px;
  font-weight: 800;
  color: #38bdf8;
}
.grand-total-val {
  font-size: 20px;
  color: #38bdf8;
}
.btn-checkout {
  margin-top: 10px;
  padding: 14px;
  background: #059669;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 800;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-checkout:hover:not(:disabled) {
  background: #10b981;
}
.btn-checkout:disabled {
  background: #475569;
  cursor: not-allowed;
}
/* 🌟 HELD ORDERS VIEW */
.held-orders-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}
.empty-held-list {
  text-align: center;
  padding: 60px 0;
  color: #94a3b8;
}
.held-orders-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.held-order-card {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.h-header {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 700;
}
.h-summary {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #64748b;
}
.h-total {
  font-weight: 800;
  color: #059669;
}
.h-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.btn-recall {
  padding: 6px 12px;
  border-radius: 6px;
  background: #0284c7;
  color: white;
  border: none;
  font-weight: 700;
  cursor: pointer;
}
.btn-delete-held {
  padding: 6px 10px;
  border-radius: 6px;
  background: #fee2e2;
  color: #dc2626;
  border: none;
  cursor: pointer;
}
/* 결제 / PIN 모달 스타일은 BranchPaymentModal.vue, PinUnlockModal.vue 로 이동 */
.tier-applied-badge {
  display: inline-block;
  margin-top: 4px;
  background-color: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.4);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 800;
}
.cart-price-edit-box {
  display: flex;
  align-items: center;
  gap: 3px;
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 2px 6px;
  width: 92px;
}
.cart-price-edit-box .curr {
  color: #94a3b8;
  font-size: 0.8rem;
  font-weight: 700;
}
.inline-price-input {
  background: transparent;
  border: none;
  color: #f8fafc;
  font-size: 0.95rem;
  font-weight: 700;
  width: 100%;
  outline: none;
}
.inline-price-input:focus {
  color: #38bdf8;
}
/* Quick Pick & Inventory Search Table Styles */
.pos-left-pane {
  position: relative;
}
.inventory-row.clickable:hover { background: #3b82f6; color: white; cursor: pointer; }
.inventory-row.clickable:hover td, .inventory-row.clickable:hover span, .inventory-row.clickable:hover strong { color: white !important; }
.hotkey-block { display: flex; flex-direction: column; gap: 8px; }
.block-header { border-bottom: 2px solid #00a896; padding-bottom: 4px; }
.block-header h3 { margin: 0; font-size: 14px; color: #f59e0b; }
.grid-3x4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.hotkey-card { display: flex; flex-direction: column; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.hotkey-btn-core { background: none; border: none; padding: 12px 4px; cursor: pointer; flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 55px; }
.hotkey-btn-core:hover:not(:disabled) { background: #f8fafc; }
.line-1 { font-size: 12.5px; font-weight: bold; color: #1e293b; }
.line-2 { font-size: 9.5px; color: #64748b; margin-top: 2px; }
.line-3 { font-size: 10px; color: #0284c7; margin-top: 2px; font-weight: 600; }
.text-teal { color: #00a896 !important; }
.hotkey-sub-edit-btn { background: #f1f5f9; border: none; border-top: 1px solid #e2e8f0; padding: 4px 0; font-size: 10.5px; color: #64748b; cursor: pointer; text-align: center; }
.hotkey-sub-edit-btn:hover:not(:disabled) { background: #e2e8f0; color: black; }
.empty-slot { opacity: 0.5; }
.input-green { background-color: #00e676 !important; width: 80px; padding: 2px; height: 35px !important; }
.input-green input { width: 100%; height: 100%; background: transparent; border: none; text-align: center; font-size: 16px; font-weight: bold; outline: none; }
.slot-edit-modal { max-width: 500px !important; width: 90% !important; }
</style>

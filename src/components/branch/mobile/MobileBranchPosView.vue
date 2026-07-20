<template>
  <div class="workspace-body branch-pos-view">
    <!-- 좌측: 상품 검색 및 퀵 픽 (기존 PosView와 동일한 레이아웃) -->
    <div class="workspace-left">
      <div class="search-section dual-search">
        <div class="search-box-wrapper">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            :placeholder="$t('branch.transfer.ph_search_name')"
            class="search-bar"
            autocomplete="off"
          />
        </div>
        <div class="search-box-wrapper" style="flex: 0.6; margin-left: 10px;">
          <span class="search-icon">🏷️</span>
          <input
            type="text"
            :placeholder="$t('branch.transfer.ph_search_barcode')"
            class="search-bar barcode-bar"
            autocomplete="off"
          />
        </div>
      </div>

      <!-- Quick Pick (단일 베스트) -->
      <div class="hotkey-block">
        <div class="block-header">
          <h3>{{ $t('branch.transfer.qp_single') }}</h3>
        </div>
        <div class="grid-3x4">
          <!-- 더미 데이터로 레이아웃 채우기 -->
          <div class="hotkey-card" v-for="i in 8" :key="'q'+i">
            <button class="hotkey-btn-core grid-style">
              <span class="line-1">AD2015</span>
              <span class="line-2">(SURTIDO - 100入)</span>
              <span class="p-stock-info">📦 7 상자 / 10 개</span>
            </button>
            <button class="hotkey-sub-edit-btn">{{ $t('branch.transfer.btn_edit') }}</button>
          </div>
        </div>
      </div>

      <!-- Grid Quick Pick (묶음 품목) -->
      <div class="hotkey-block" style="margin-top:15px;">
        <div class="block-header" style="border-bottom-color: #0ea5e9;">
          <h3 style="color:#0369a1;">{{ $t('branch.transfer.qp_grid') }}</h3>
        </div>
        <div class="grid-3x4">
          <div class="hotkey-card" v-for="i in 4" :key="'g'+i">
            <button class="hotkey-btn-core" style="border-left: 4px solid #0ea5e9;">
              <span class="line-1">P-160</span>
              <span class="line-2">(26 가지 컬러)</span>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Customer Quick Pick -->
      <div class="hotkey-block" style="margin-top:15px;">
        <div class="block-header" style="border-bottom-color: #eab308;">
          <h3 style="color:#ca8a04;">{{ $t('pos.qp_customer') }}</h3>
        </div>
        <div class="grid-3x4">
          <div class="hotkey-card" v-for="i in 4" :key="'c'+i">
            <button class="hotkey-btn-core" style="border-left: 4px solid #eab308;">
              <span class="line-1">YIMAI</span>
              <span class="line-2">YIMAI</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 우측: 장바구니 및 VENTA 로직 -->
    <div class="workspace-right outbound-mode">
      <!-- 탭 컨트롤 (현재는 단일 탭으로 고정) -->
      <div class="tabs-control-header outbound-mode">
        <div class="tabs-list">
          <div class="tab-wrapper-item active outbound-mode">
            <span class="tab-title-text">출고 1</span>
            <button class="tab-close-x-btn">×</button>
          </div>
        </div>
        <div class="tabs-header-actions">
          <span class="transaction-mode-label">{{ $t('pos.mode_outbound') }}</span>
          <button class="add-tab-action-btn">{{ $t('pos.btn_add_tab') }}<</button>
        </div>
      </div>

      <div class="tab-body-content">
        <!-- VENTA 전용 4가지 마스터 헤더 (지점, 고객, 책임자, 응대자) -->
        <div class="tab-internal-master-header">
          <div class="master-input-row">
            <div class="master-lock-group">
              <label>{{ $t('pos.lbl_branch') }}</label>
              <!-- 지점은 로그인된 유저의 정보로 고정 -->
              <input type="text" class="master-input" :value="authStore.user?.branch_name" disabled />
            </div>
            <!-- 일괄 취소 버튼 영역 (우측 정렬) -->
            <div class="master-lock-group" style="justify-content: flex-end; align-items: flex-end;">
              <button class="clear-cart-btn">{{ $t('pos.btn_cancel_edit') }}</button>
            </div>
          </div>
          
          <div class="master-input-row" style="margin-top: 10px;">
            <div class="master-lock-group">
              <label>{{ $t('pos.lbl_customer') }}</label>
              <input type="text" class="master-input" :placeholder="$t('pos.ph_customer')" autocomplete="off" />
            </div>
            <div class="master-lock-group">
              <label>{{ $t('branch.transfer.lbl_manager') }}</label>
              <select class="master-select">
                <option value="">{{ $t('branch.transfer.sel_manager') }}</option>
              </select>
            </div>
            <div class="master-lock-group">
              <label>{{ $t('branch.transfer.lbl_clerk') }}</label>
              <select class="master-select">
                <option value="">{{ $t('branch.transfer.sel_clerk') }}</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- 장바구니 테이블 -->
        <div class="cart-items-wrapper">
          <table class="pos-cart-table">
            <thead>
              <tr>
                <th rowspan="2">{{ $t('pos.th_item_color') }}</th>
                <th colspan="2" class="sub-th" style="background:#f1f5f9;">{{ $t('pos.th_qty_input') }}</th>
                <th rowspan="2">{{ $t('pos.th_total_qty') }}</th>
                <th rowspan="2">{{ $t('stock_adj.col_unit_cost') }}</th>
                <th rowspan="2">금액</th>
                <th rowspan="2" style="width: 40px;"></th>
              </tr>
              <tr class="sub-th" style="background:#f1f5f9;">
                <th>{{ $t('pos.th_box') }}</th>
                <th>{{ $t('pos.th_each') }}</th>
              </tr>
            </thead>
            <tbody>
              <!-- 장바구니 예시 아이템 (UI 확인용) -->
              <tr>
                <td class="product-cell">
                  <div class="p-name">AD2015</div>
                  <div class="p-stock-info">지점: 7 / 메인: 10</div>
                </td>
                <td class="input-green">
                  <input type="number" value="1" />
                </td>
                <td class="input-green">
                  <input type="number" value="0" />
                </td>
                <td class="total-qty-cell"><strong>100</strong></td>
                <td class="price-cell">$340.00</td>
                <td class="subtotal-cell">$34,000.00</td>
                <td class="action-cell">
                  <button class="btn-more-options">⋮</button>
                </td>
              </tr>
              <!-- 더미 빈 장바구니 -->
              <tr>
                <td colspan="7" class="empty-cart-msg">{{ $t('pos.empty_cart') }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 하단 액션 존 -->
        <div class="right-footer-action-zone">
          <div class="truck-counter-info-grid">
            <div class="summary-label-box">📦 박스 총 개수: <strong>0 상자</strong></div>
            <div class="summary-label-box" style="color:#0284c7;">👕 낱장 총 개수: <strong style="color:#0284c7;">0 개</strong></div>
          </div>
          <div class="action-btn-double-group">
            <button class="btn-outbound-reserve" style="background:#475569;">{{ $t('branch.transfer.btn_save_draft') }}</button>
            <button class="btn-final-submit" style="background:#00a896;">{{ $t('branch.transfer.btn_submit_final') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { ref } from 'vue'
import { useAuthStore } from '../../../stores/auth.js'

const authStore = useAuthStore();
const { t } = useI18n();

// Props for sharing data from PosView without re-fetching
const props = defineProps({
  rawItems: {
    type: Array,
    default: () => []
  },
  binData: {
    type: Object,
    default: () => ({})
  },
  pendingReserved: {
    type: Object,
    default: () => ({})
  },
  branchList: {
    type: Array,
    default: () => []
  }
})

// 스크립트 로직은 디자인 피드백 후 진행.
</script>

<style scoped>
/* 기존 PosView.vue 의 스타일을 그대로 차용하여 레이아웃 유지 */
.workspace-body { display: flex; flex: 1; overflow: hidden; padding: 15px; gap: 15px; font-family: var(--sans, sans-serif); height: 100vh; box-sizing: border-box; background: #f8fafc; }
/* 장바구니 폭을 확보하기 위해 1:1 또는 0.95:1.05 비율로 조정 */
.workspace-left { flex: 0.95; display: flex; flex-direction: column; gap: 15px; overflow-y: auto; }
.workspace-right { flex: 1.05; background: white; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }

/* 검색바 영역 */
.search-section { display: flex; width: 100%; }
.search-box-wrapper { position: relative; flex: 1; display: flex; align-items: center; }
.search-icon { position: absolute; left: 12px; font-size: 14px; }
.search-bar { width: 100%; padding: 12px 12px 12px 35px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 14px; box-sizing: border-box; }
.barcode-bar { border-color: #fcd34d; background: #fffbeb; }
.barcode-bar:focus { outline: none; border-color: #f59e0b; box-shadow: 0 0 0 2px rgba(245,158,11,0.2); }

/* Quick Picks 핫키 블럭 */
.hotkey-block { display: flex; flex-direction: column; gap: 8px; }
.block-header { border-bottom: 2px solid #00a896; padding-bottom: 4px; }
.block-header h3 { margin: 0; font-size: 14px; color: #00a896; }
.grid-3x4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.hotkey-card { display: flex; flex-direction: column; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
.hotkey-btn-core { background: none; border: none; padding: 12px 4px; cursor: pointer; flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 55px; }
.grid-style { border-left: 4px solid #00a896; }
.line-1 { font-size: 12.5px; font-weight: bold; color: #0f172a; }
.line-2 { font-size: 9.5px; color: #64748b; margin-top: 2px; }
.p-stock-info { font-size: 10.5px; font-weight: bold; color: #059669; margin-top: 4px; }
.hotkey-sub-edit-btn { background: #f1f5f9; border: none; border-top: 1px solid #e2e8f0; padding: 4px 0; font-size: 10.5px; color: #64748b; cursor: pointer; text-align: center; }
.hotkey-sub-edit-btn:hover { background: #e2e8f0; color: black; }

/* 우측 탭 컨트롤 (출고 모드 색상) */
.tabs-control-header { display: flex; justify-content: space-between; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; padding: 6px 10px 0 10px; }
.tabs-control-header.outbound-mode { background: #f0fdf4; border-bottom-color: #86efac; }
.tabs-list { display: flex; gap: 4px; }
.tab-wrapper-item { display: flex; align-items: center; gap: 6px; background: #e2e8f0; border: 1px solid #cbd5e1; border-bottom: none; padding: 8px 12px; border-radius: 6px 6px 0 0; font-size: 12.5px; font-weight: bold; cursor: pointer; color: #64748b; position: relative; }
.tab-wrapper-item.outbound-mode { background: #dcfce7; border-color: #86efac; }
.tab-wrapper-item.active { background: white; color: #00a896; border-color: #cbd5e1; border-bottom-color: white; margin-bottom: -1px; }
.tab-wrapper-item.outbound-mode.active { background: white; color: #059669; border-color: #86efac; border-bottom-color: white; }
.tab-title-text { cursor: pointer; }
.tab-close-x-btn { background: none; border: none; font-size: 14px; font-weight: bold; color: #94a3b8; cursor: pointer; padding: 0 2px; line-height: 1; border-radius: 50%; }
.tab-close-x-btn:hover { background: #ef4444; color: white; }
.tabs-header-actions { display: flex; align-items: center; gap: 10px; padding-bottom: 6px; }
.transaction-mode-label { font-size: 13px; font-weight: bold; color: #059669; white-space: nowrap; }
.add-tab-action-btn { background: none; border: none; color: #059669; font-weight: bold; cursor: pointer; font-size: 13px; }
.clear-cart-btn { background: white; border: 1px solid #ef4444; color: #ef4444; border-radius: 6px; padding: 10px 15px; font-weight: bold; cursor: pointer; font-size: 13px; transition: all 0.2s; height: 100%; box-sizing: border-box; }
.clear-cart-btn:hover { background: #ef4444; color: white; }
.workspace-right.outbound-mode { border-color: #86efac; }

/* 마스터 헤더 (4가지 폼) */
.tab-body-content { flex: 1; overflow-y: auto; display: flex; flex-direction: column; padding: 0; }
.tab-internal-master-header { display: flex; flex-direction: column; background: #f8fafc; padding: 15px; border-bottom: 1px solid #e2e8f0; }
.master-input-row { display: flex; gap: 10px; width: 100%; }
.master-lock-group { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.master-lock-group label { font-size: 12px; font-weight: bold; color: #475569; }
.master-input, .master-select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; outline: none; background: white; width: 100%; box-sizing: border-box; }
.master-input:disabled { background: #f1f5f9; color: #1e293b; font-weight: bold; cursor: not-allowed; border-color: #cbd5e1; }

/* 장바구니 테이블 */
.cart-items-wrapper { flex: 1; overflow-y: auto; padding: 15px; }
.pos-cart-table { width: 100%; border-collapse: collapse; }
.pos-cart-table th, .pos-cart-table td { border: 1px solid #e2e8f0; padding: 8px; font-size: 12.5px; text-align: center; vertical-align: middle; }
.pos-cart-table th { background: #f8fafc; font-weight: bold; color: #334155; }
.sub-th th { font-size: 11px; padding: 4px; color: #475569; }
.empty-cart-msg { text-align: center !important; padding: 40px !important; color: #94a3b8; font-style: italic; }

/* 추가된 테이블 셀 스타일 */
.product-cell { text-align: left !important; }
.p-name { font-weight: bold; font-size: 13px; color: #0f172a; }
.p-stock-info { font-size: 11px; color: #64748b; margin-top: 4px; }
.input-green { background-color: #dcfce7 !important; width: 60px; padding: 2px !important; }
.input-green input { width: 100%; background: transparent; border: none; text-align: center; font-size: 14px; font-weight: bold; outline: none; color: #059669; }
.total-qty-cell strong { color: #00a896; font-size: 14px; }
.price-cell { color: #475569; font-size: 13px; }
.subtotal-cell { color: #0f172a; font-weight: bold; font-size: 14px; }
.action-cell { padding: 4px !important; }
.btn-more-options { background: none; border: none; font-size: 18px; font-weight: bold; color: #94a3b8; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
.btn-more-options:hover { background: #f1f5f9; color: #334155; }
/* 팝업 메뉴 관련 스타일 (나중에 스크립트 시 적용) */
.price-edit-popup { position: absolute; background: white; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 10; padding: 5px 0; }
.popup-item { padding: 10px 20px; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 10px; color: #475569; }
.popup-item:hover { background: #f8fafc; color: #0f172a; }

/* 우측 하단 결제 뷰 */
.right-footer-action-zone { border-top: 2px solid #e2e8f0; padding: 15px; background: #f8fafc; display: flex; flex-direction: column; gap: 12px; }
.truck-counter-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.summary-label-box { background: white; border: 1px solid #cbd5e1; padding: 12px; border-radius: 6px; font-size: 14px; font-weight: bold; color: #334155; box-shadow: 0 1px 2px rgba(0,0,0,0.02); }
.summary-label-box strong { font-size: 16px; color: #00a896; margin-left: 4px; }
.action-btn-double-group { display: grid; grid-template-columns: 1fr 1.5fr; gap: 10px; }
.btn-outbound-reserve { color: white; border: none; padding: 15px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 15px; transition: 0.2s; }
.btn-outbound-reserve:hover { filter: brightness(1.1); }
.btn-final-submit { color: white; border: none; padding: 15px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 15px; transition: 0.2s; }
.btn-final-submit:hover { filter: brightness(1.1); }
</style>

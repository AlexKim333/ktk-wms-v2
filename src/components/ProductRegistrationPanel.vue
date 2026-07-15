<template>
  <div class="product-registration-zone">
    <header class="product-reg-header">
      <h2>{{ $t('product_reg.title') }}</h2>
      <p class="product-reg-subtitle">{{ $t('product_reg.subtitle') }}</p>
    </header>

    <form class="product-reg-form" @submit.prevent="saveProduct">
      <div class="form-grid">
        <label class="form-field">
          <span>{{ $t('product_reg.item_name') }}</span>
          <input v-model="form.item_name" type="text" required :placeholder="$t('product_reg.item_name_ph')" autofocus />
        </label>
        
        <label class="form-field">
          <span>{{ $t('product_reg.color') }}</span>
          <input v-model="form.color" type="text" required :placeholder="$t('product_reg.color_ph')" />
        </label>
        
        <label class="form-field brand-field">
          <span>{{ $t('product_reg.brand') }}</span>
          <div class="brand-input-group">
            <select v-model="form.brand_id" required :disabled="brandsLoading">
              <option value="" disabled>{{ $t('product_reg.brand_select') }}</option>
              <option v-for="b in brands" :key="b.name" :value="b.name">{{ b.name }}</option>
            </select>
            <button type="button" class="btn-new-brand" @click="openBrandDialog">{{ $t('product_reg.btn_new') }}</button>
          </div>
        </label>

        <label class="form-field barcode-field">
          <span>{{ $t('product_reg.barcode') }}</span>
          <input ref="barcodeInputRef" v-model="form.barcode" type="text" :placeholder="$t('product_reg.barcode_ph')" @keydown.enter.prevent="saveProduct" />
        </label>
        
        <!-- 🌟 물류/회계 통합 입력 영역 -->
        <label class="form-field">
          <span>{{ $t('product_reg.warehouse') }}</span>
          <select v-model="form.opening_warehouse" required>
            <option value="" disabled>{{ $t('product_reg.warehouse_select') }}</option>
            <option v-for="wh in warehouseList" :key="wh.name" :value="wh.name">{{ wh.warehouse_name || wh.name }}</option>
          </select>
        </label>

        <label class="form-field">
          <span>{{ $t('product_reg.opening_qty_units') }}</span>
          <input v-model.number="form.opening_qty" type="number" min="0" required placeholder="0" />
        </label>

        <label class="form-field">
          <span>{{ $t('product_reg.valuation_rate') }}</span>
          <input v-model.number="form.valuation_rate" type="number" step="0.01" min="0" required :placeholder="$t('product_reg.ph_valuation')" />
        </label>

        <label class="form-field">
          <span>{{ $t('product_reg.selling_price') }}</span>
          <input v-model.number="form.selling_price" type="number" step="0.01" min="0" required :placeholder="$t('product_reg.ph_selling')" />
        </label>

        <label class="form-field">
          <span>{{ $t('product_reg.pack_qty') }}</span>
          <input v-model.number="form.box_packaging_qty" type="number" min="1" required :placeholder="$t('product_reg.ph_pack')" />
        </label>
        
        <label class="form-field checkbox-field">
          <span>{{ $t('product_reg.grid_item') }}</span>
          <div class="checkbox-wrapper">
            <input type="checkbox" v-model="form.is_grid" id="grid-checkbox" />
            <label for="grid-checkbox">{{ $t('product_reg.grid_desc') }}</label>
          </div>
        </label>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="isSaving">
          {{ isSaving ? $t('product_reg.saving_3step') : $t('product_reg.btn_save') }}
        </button>
        <button type="button" class="btn-reset" @click="resetForm">{{ $t('product_reg.btn_reset') }}</button>
      </div>
    </form>

    <section class="product-list-section">
      <div class="list-header">
        <h3>{{ $t('product_reg.monitor_title') }}</h3>
        <button type="button" class="btn-refresh" @click="loadData" :disabled="itemsLoading">🔄 {{ $t('product_reg.btn_refresh') }}</button>
      </div>

      <div v-if="itemsLoading" class="list-empty">{{ $t('product_reg.loading_list') }}</div>
      <div v-else-if="registeredItems.length === 0" class="list-empty">{{ $t('product_reg.empty_list') }}</div>

      <table v-else class="product-monitor-table">
        <thead>
          <tr>
            <th>{{ $t('product_reg.col_item_code') }}</th>
            <th>{{ $t('product_reg.col_item_name') }}</th>
            <th>{{ $t('product_reg.col_color') }}</th>
            <th>{{ $t('product_reg.col_pack_qty') }}</th>
            <th>{{ $t('product_reg.col_grid') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in registeredItems" :key="item.name">
            <td class="mono">{{ item.item_code ?? '—' }}</td>
            <td>{{ item.item_name }}</td>
            <td>{{ item.custom_color ?? '—' }}</td>
            <td>{{ item.custom_pack_qty ?? '—' }}</td>
            <td class="grid-icon-cell">
              <span class="grid-badge" :class="item.custom_is_grid_item ? 'grid-yes' : 'grid-no'">
                {{ item.custom_is_grid_item ? '🌐 Grid' : '📦 Single' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- 🌟 순수 CSS 알림창 (Toast) -->
    <div v-if="snackbar.show" class="toast-notification" :class="snackbar.color">
      {{ snackbar.message }}
    </div>

    <!-- 🌟 브랜드 추가 팝업 (Modal) -->
    <div v-if="brandDialog" class="modal-overlay" @click.self="closeBrandDialog">
      <div class="modal-content">
        <h3 class="modal-title">+ Create New Brand</h3>
        <input 
          ref="brandNameInputRef" 
          v-model="newBrandName" 
          type="text" 
          class="modal-input"
          placeholder="Enter Brand Name" 
          @keydown.enter.prevent="saveNewBrand" 
        />
        <div class="modal-actions">
          <button type="button" class="btn-modal-cancel" :disabled="isBrandSaving" @click="closeBrandDialog">Cancel</button>
          <button type="button" class="btn-modal-save" :disabled="isBrandSaving" @click="saveNewBrand">
            {{ isBrandSaving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import frappeApi from '@/api/frappe.js'

// --- States ---
const form = ref({
  item_name: '', color: '', brand_id: '', barcode: '', box_packaging_qty: null,
  opening_warehouse: '', opening_qty: 0, valuation_rate: 0, selling_price: 0,
  is_grid: false
})

const brands = ref([])
const warehouseList = ref([])
const registeredItems = ref([])

const brandsLoading = ref(false)
const itemsLoading = ref(false)
const isSaving = ref(false)

const barcodeInputRef = ref(null)
const brandDialog = ref(false)
const newBrandName = ref('')
const isBrandSaving = ref(false)
const brandNameInputRef = ref(null)

const snackbar = ref({ show: false, message: '', color: 'error' })
let snackbarTimer = null

// --- Helpers ---
const showSnackbar = (message, color = 'error') => { 
  snackbar.value = { show: true, message, color }
  if (snackbarTimer) clearTimeout(snackbarTimer)
  snackbarTimer = setTimeout(() => { snackbar.value.show = false }, 3500)
}

const focusBarcode = () => { nextTick(() => barcodeInputRef.value?.focus()) }

const resetForm = () => {
  form.value = {
    item_name: '', color: '', brand_id: form.value.brand_id, barcode: '', box_packaging_qty: null,
    opening_warehouse: form.value.opening_warehouse, opening_qty: 0, valuation_rate: 0, selling_price: 0,
    is_grid: false
  }
  focusBarcode()
}

// --- Hotkeys ---
const handleGlobalKeydown = (e) => {
  if (brandDialog.value) return 
  if (e.key === 'F8') { e.preventDefault(); saveProduct() }
  else if (e.key === 'F4') { 
    e.preventDefault(); 
    form.value.is_grid = !form.value.is_grid; 
    showSnackbar(form.value.is_grid ? '🌐 Set as Grid Item.' : '📦 Set as Single Item.', 'info') 
  }
  else if (e.key === 'F9') { e.preventDefault(); resetForm(); showSnackbar('Form reset.', 'info') }
}

// --- Data Fetching (Brand, Warehouse, Items) ---
const loadData = async (selectBrandName = null) => {
  brandsLoading.value = true
  itemsLoading.value = true
  try {
    const [bRes, wRes, iRes] = await Promise.all([
      frappeApi.get('/api/resource/Brand?fields=["name","brand"]&limit_page_length=0'),
      frappeApi.get('/api/resource/Warehouse?filters=[["is_group","=",0],["company","=","kecon"],["disabled","=",0]]&fields=["name","warehouse_name"]&limit_page_length=0'),
      frappeApi.get('/api/resource/Item?fields=["name","item_code","item_name","custom_color","custom_pack_qty","custom_is_grid_item"]&order_by=creation desc&limit_page_length=50')
    ])
    brands.value = bRes.data?.data ?? []
    warehouseList.value = wRes.data?.data ?? []
    registeredItems.value = iRes.data?.data ?? []
    
    if (selectBrandName) form.value.brand_id = selectBrandName
  } catch (err) { 
    console.error('Data Load Error:', err)
    showSnackbar('Failed to load initial data.') 
  } finally { 
    brandsLoading.value = false
    itemsLoading.value = false
  }
}

// --- Brand Modal Logic ---
const openBrandDialog = () => { newBrandName.value = ''; brandDialog.value = true; nextTick(() => brandNameInputRef.value?.focus()) }
const closeBrandDialog = () => { brandDialog.value = false; newBrandName.value = '' }

const saveNewBrand = async () => {
  if (!newBrandName.value.trim()) return
  isBrandSaving.value = true
  try {
    const { data } = await frappeApi.post('/api/resource/Brand', { brand: newBrandName.value.trim() })
    closeBrandDialog()
    await loadData(data.data.name)
    showSnackbar(`Brand successfully registered.`, 'success')
  } catch (err) { showSnackbar(`Failed to save Brand.`) } 
  finally { isBrandSaving.value = false }
}

// --- Validation ---
const checkCompositeDuplicate = async (itemName, color, boxPackagingQty) => {
  try {
    const { data } = await frappeApi.get('/api/resource/Item', {
      params: { filters: JSON.stringify([['item_name', '=', itemName], ['custom_color', '=', color], ['custom_pack_qty', '=', boxPackagingQty]]), limit_page_length: 1 }
    })
    return data.data && data.data.length > 0
  } catch (err) { return false }
}

// 🚀 --- The 3-Step Orchestration Logic ---
const saveProduct = async () => {
  isSaving.value = true

  try {
    const itemName = form.value.item_name.trim()
    const color = form.value.color.trim()
    const brand = form.value.brand_id
    const boxPackagingQty = Number(form.value.box_packaging_qty)

    if (!itemName || !brand) {
      throw new Error('상품 코드(Item Code)와 브랜드(Brand)는 필수 입력입니다.')
    }
    if (!color) {
      throw new Error('색상(Color)은 필수 입력입니다.')
    }
    if (!Number.isFinite(boxPackagingQty) || boxPackagingQty < 1) {
      throw new Error('팩 수량(Box Qty)은 1 이상이어야 합니다.')
    }

    const isDuplicate = await checkCompositeDuplicate(itemName, color, boxPackagingQty)
    if (isDuplicate) {
      throw new Error('동일한 상품 조합이 이미 등록되어 있습니다.')
    }

    let finalItemCode = itemName
    if (color) finalItemCode += `-${color}`
    if (boxPackagingQty > 1) finalItemCode += `-${boxPackagingQty}`

    const extractedNumber = parseInt(itemName.replace(/[^0-9]/g, ''), 10) || 0

    // 🌟 추가 로직: 동일한 item_name을 가진 기존 형제 상품(Sibling) 찾기
    const siblingRes = await frappeApi.get('/api/resource/Item', {
      params: { 
        filters: JSON.stringify([['item_name', '=', itemName]]), 
        fields: JSON.stringify(['name', 'custom_is_grid_item']),
        limit_page_length: 999 
      }
    });
    
    const siblings = siblingRes.data.data || [];
    
    // 만약 기존 형제가 하나라도 있다면(즉, 이번이 2번째 이상 컬러 등록이라면),
    // 현재 상품은 무조건 Grid(1)가 되며, 기존 형제들도 모두 Grid(1)로 업데이트해야 함
    let isGridFinal = form.value.is_grid ? 1 : 0;
    
    if (siblings.length > 0) {
      isGridFinal = 1; // 형제가 있으므로 강제로 그리드 취급
      
      // 기존 형제들 중 is_grid가 0(No)인 것들을 백엔드에서 1(Yes)로 업데이트 (소급 적용)
      for (const sibling of siblings) {
        if (sibling.custom_is_grid_item === 0) {
          try {
            await frappeApi.put(`/api/resource/Item/${sibling.name}`, {
              custom_is_grid_item: 1
            });
          } catch (e) {
            console.error(`Failed to update sibling ${sibling.name} to grid:`, e);
          }
        }
      }
    }

    // Step 1: 상품 마스터(Item) 생성
    await frappeApi.post('/api/resource/Item', {
      item_code: finalItemCode,
      item_name: itemName,
      item_group: 'Products',
      brand,
      stock_uom: 'Nos',
      is_stock_item: 1,
      has_variants: 0,
      custom_color: color,
      barcode: form.value.barcode.trim() || null,
      custom_pack_qty: boxPackagingQty,
      custom_is_grid_item: isGridFinal,
      custom_grid_group_id: itemName,
      custom_name_number: extractedNumber
    })

    // Step 2: 판매 가격표(Item Price) 등록
    if (Number(form.value.selling_price) > 0) {
      await frappeApi.post('/api/resource/Item Price', {
        item_code: finalItemCode,
        price_list: 'Standard Selling',
        price_list_rate: Number(form.value.selling_price)
      })
    }

    // Step 3: 기초재고 등록 (Material Receipt)
    if (Number(form.value.opening_qty) > 0) {
      if (!form.value.opening_warehouse) {
        throw new Error('재고 수량을 입력하려면 창고(Warehouse)를 반드시 선택해야 합니다.')
      }
      if (Number(form.value.valuation_rate) <= 0) {
        throw new Error('재고 수량이 있는 경우 원가(Valuation Rate)는 0보다 커야 합니다.')
      }

      const stockEntryPayload = {
        stock_entry_type: 'Material Receipt',
        company: 'kecon',
        items: [{
          item_code: finalItemCode,
          t_warehouse: form.value.opening_warehouse,
          qty: Number(form.value.opening_qty),
          basic_rate: Number(form.value.valuation_rate)
        }]
      }

      const stockEntryRes = await frappeApi.post('/api/resource/Stock Entry', stockEntryPayload)
      const stockEntryName = stockEntryRes.data.data.name

      await frappeApi.put(`/api/resource/Stock Entry/${stockEntryName}`, {
        docstatus: 1
      })
    }

    showSnackbar(`성공! [${finalItemCode}] 등록 완료`, 'success')
    resetForm()
    await loadData()
  } catch (error) {
    console.error('Registration Error:', error)
    const serverError = error.response?.data?.exception || error.message
    showSnackbar(`등록 실패: ${serverError}`)
  } finally {
    isSaving.value = false
    focusBarcode()
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown)
  await loadData()
  focusBarcode()
})

onUnmounted(() => { window.removeEventListener('keydown', handleGlobalKeydown) })
</script>

<style scoped>
.product-registration-zone { flex: 1; overflow-y: auto; padding: 20px 24px 32px; background: #f4f6f9; }
.product-reg-header h2 { margin: 0 0 4px; font-size: 20px; color: #1e293b; }
.product-reg-subtitle { margin: 0 0 20px; font-size: 13px; color: #64748b; }
.product-reg-form { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px; }

/* 🌟 입력창을 예쁘게 4열로 정렬합니다 */
.form-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }

.form-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: bold; color: #64748b; }
.form-field input, .form-field select { padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; outline: none; background: white; }
.form-field input:focus, .form-field select:focus { border-color: #00a896; box-shadow: 0 0 0 2px rgba(0, 168, 150, 0.15); }
.brand-input-group { display: flex; gap: 8px; }
.brand-input-group select { flex: 1; }
.btn-new-brand { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0 12px; font-weight: bold; color: #00a896; cursor: pointer; white-space: nowrap; }
.btn-new-brand:hover { background: #e2e8f0; }
.barcode-field input { background: #ecfdf5; border-color: #00a896; font-family: monospace; font-weight: bold; }
.checkbox-field { justify-content: center; }
.checkbox-wrapper { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: normal; color: #334155; margin-top: 8px;}
.checkbox-wrapper input { width: 16px; height: 16px; cursor: pointer; }
.form-actions { display: flex; gap: 10px; margin-top: 20px; }
.btn-save { background: #00a896; color: white; border: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px; }
.btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-reset { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 12px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; }
.product-list-section { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px 20px; }
.list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.list-header h3 { margin: 0; font-size: 15px; color: #334155; }
.btn-refresh { background: none; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; color: #64748b; font-weight: bold;}
.list-empty { padding: 32px; text-align: center; color: #94a3b8; font-style: italic; }
.product-monitor-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.product-monitor-table th, .product-monitor-table td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: center; }
.product-monitor-table th { background: #f8fafc; font-weight: bold; color: #475569; }
.product-monitor-table td.mono { font-family: monospace; font-size: 12px; }
.grid-icon-cell { white-space: nowrap; }
.grid-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: bold; }
.grid-badge.grid-yes { background: #ccfbf1; color: #0f766e; }
.grid-badge.grid-no { background: #f1f5f9; color: #64748b; }

/* 토스트 알림창 CSS */
.toast-notification { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); padding: 12px 24px; border-radius: 8px; color: white; font-weight: bold; font-size: 14px; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: slideDown 0.3s ease; }
.toast-notification.success { background-color: #10b981; }
.toast-notification.error { background-color: #ef4444; }
.toast-notification.info { background-color: #3b82f6; }
@keyframes slideDown { from { top: -50px; opacity: 0; } to { top: 20px; opacity: 1; } }

/* 모달 팝업창 CSS */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.modal-content { background: white; padding: 24px; border-radius: 12px; width: 100%; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
.modal-title { margin: 0 0 16px; font-size: 18px; color: #1e293b; }
.modal-input { width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; outline: none; margin-bottom: 20px; box-sizing: border-box; }
.modal-input:focus { border-color: #00a896; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
.btn-modal-cancel { padding: 8px 16px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; color: #64748b; font-weight: bold; }
.btn-modal-save { padding: 8px 20px; background: #00a896; border: none; border-radius: 6px; cursor: pointer; color: white; font-weight: bold; }
.btn-modal-save:disabled { opacity: 0.6; }

@media (max-width: 1200px) { .form-grid { grid-template-columns: repeat(2, 1fr); } }
</style>

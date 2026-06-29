<template>
  <div class="product-registration-zone">
    <header class="product-reg-header">
      <h2>📦 Product Registration</h2>
      <p class="product-reg-subtitle">Composite Key Validation · Auto Extract No. · Hotkeys (F8: Save / F4: Toggle Grid / F9: Reset)</p>
    </header>

    <form class="product-reg-form" @submit.prevent="saveProduct">
      <div class="form-grid">
        <label class="form-field">
          <span>Item Name *</span>
          <input v-model="form.item_name" type="text" required placeholder="e.g., P-160" autofocus />
        </label>
        
        <label class="form-field">
          <span>Color *</span>
          <input v-model="form.color" type="text" required placeholder="e.g., BLACK" />
        </label>
        
        <label class="form-field brand-field">
          <span>Brand *</span>
          <div class="brand-input-group">
            <select v-model="form.brand_id" required :disabled="brandsLoading">
              <option value="" disabled>Select Brand</option>
              <option v-for="b in brands" :key="b.name" :value="b.name">{{ b.name }}</option>
            </select>
            <button type="button" class="btn-new-brand" @click="openBrandDialog">+ New</button>
          </div>
        </label>
        
        <label class="form-field barcode-field">
          <span>Barcode / QR</span>
          <input ref="barcodeInputRef" v-model="form.barcode" type="text" placeholder="Scanner Input (Enter to Save)" @keydown.enter.prevent="saveProduct" />
        </label>
        
        <label class="form-field">
          <span>Pack Qty *</span>
          <input v-model.number="form.box_packaging_qty" type="number" min="1" required placeholder="50" />
        </label>
        
        <label class="form-field">
          <span>Initial Stock (Boxes)</span>
          <input v-model.number="form.initial_stock_boxes" type="number" min="0" placeholder="0" />
        </label>
        
        <label class="form-field">
          <span>Initial Stock (Units)</span>
          <input v-model.number="form.initial_stock_units" type="number" min="0" placeholder="0" />
        </label>
        
        <label class="form-field checkbox-field">
          <span>Grid Item (F4)</span>
          <div class="checkbox-wrapper">
            <input type="checkbox" v-model="form.is_grid" id="grid-checkbox" />
            <label for="grid-checkbox">This is a grid item with various options</label>
          </div>
        </label>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="isSaving">
          {{ isSaving ? 'Saving...' : 'Save Product (F8)' }}
        </button>
        <button type="button" class="btn-reset" @click="resetForm">Reset Form (F9)</button>
      </div>
    </form>

    <section class="product-list-section">
      <div class="list-header">
        <h3>Registered Products Monitor</h3>
        <button type="button" class="btn-refresh" @click="loadItems" :disabled="itemsLoading">Refresh</button>
      </div>

      <div v-if="itemsLoading" class="list-empty">Loading list...</div>
      <div v-else-if="registeredItems.length === 0" class="list-empty">No products registered.</div>

      <table v-else class="product-monitor-table">
        <thead>
          <tr>
            <th>Item Code</th>
            <th>Item Name</th>
            <th>Extracted No.</th>
            <th>Color</th>
            <th>Pack Qty</th>
            <th>Box Stock</th>
            <th>Unit Stock</th>
            <th>Grid</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in registeredItems" :key="item.name">
            <td class="mono">{{ item.item_code ?? '—' }}</td>
            <td>{{ item.item_name }}</td>
            <td class="mono text-blue">{{ item.custom_name_number ?? 0 }}</td>
            <td>{{ item.custom_color ?? '—' }}</td>
            <td>{{ item.custom_pack_qty ?? '—' }}</td>
            <td>{{ item.custom_initial_stock_boxes ?? 0 }}</td>
            <td>{{ item.custom_initial_stock_units ?? 0 }}</td>
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

    <!-- 🌟 순수 CSS 팝업창 (Modal) -->
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
import axios from 'axios'

const frappeApi = axios.create({
  headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
  withCredentials: true 
})

const DUPLICATE_MSG = 'Duplicate composite key [Item Name - Color - Pack Qty].'

const form = ref({
  item_name: '', color: '', brand_id: '', barcode: '', box_packaging_qty: null,
  initial_stock_boxes: 0, initial_stock_units: 0, is_grid: false
})

const brands = ref([])
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

const showSnackbar = (message, color = 'error') => { 
  snackbar.value = { show: true, message, color }
  if (snackbarTimer) clearTimeout(snackbarTimer)
  snackbarTimer = setTimeout(() => { snackbar.value.show = false }, 3500)
}

const focusBarcode = () => { nextTick(() => barcodeInputRef.value?.focus()) }

const resetForm = () => {
  form.value = {
    item_name: '', color: '', brand_id: form.value.brand_id, barcode: '', box_packaging_qty: null,
    initial_stock_boxes: 0, initial_stock_units: 0, is_grid: false
  }
  focusBarcode()
}

const handleGlobalKeydown = (e) => {
  if (brandDialog.value) return // 팝업 열려있을 땐 단축키 무시
  if (e.key === 'F8') { e.preventDefault(); saveProduct() }
  else if (e.key === 'F4') { 
    e.preventDefault(); 
    form.value.is_grid = !form.value.is_grid; 
    showSnackbar(form.value.is_grid ? '🌐 Set as Grid Item.' : '📦 Set as Single Item.', 'info') 
  }
  else if (e.key === 'F9') { e.preventDefault(); resetForm(); showSnackbar('Form reset.', 'info') }
}

const loadBrands = async (selectBrandName = null) => {
  brandsLoading.value = true
  try {
    const { data } = await frappeApi.get('/api/resource/Brand', { params: { fields: JSON.stringify(['name', 'brand']), limit_page_length: 0 } })
    brands.value = data.data ?? []
    if (selectBrandName) form.value.brand_id = selectBrandName
  } catch (err) { console.error('Brand Load Error:', err) } finally { brandsLoading.value = false }
}

const openBrandDialog = () => { newBrandName.value = ''; brandDialog.value = true; nextTick(() => brandNameInputRef.value?.focus()) }
const closeBrandDialog = () => { brandDialog.value = false; newBrandName.value = '' }

const saveNewBrand = async () => {
  if (!newBrandName.value.trim()) return
  isBrandSaving.value = true
  try {
    const { data } = await frappeApi.post('/api/resource/Brand', { brand: newBrandName.value.trim() })
    closeBrandDialog()
    await loadBrands(data.data.name)
    showSnackbar(`Brand successfully registered.`, 'success')
  } catch (err) { showSnackbar(`Failed to save Brand.`) } finally { isBrandSaving.value = false }
}

const loadItems = async () => {
  itemsLoading.value = true
  try {
    const { data } = await frappeApi.get('/api/resource/Item', {
      params: {
        fields: JSON.stringify([
          'name', 'item_code', 'item_name', 'custom_name_number', 'custom_color', 
          'custom_pack_qty', 'custom_initial_stock_boxes', 
          'custom_initial_stock_units', 'custom_is_grid_item'
        ]),
        order_by: 'creation desc',
        limit_page_length: 50
      }
    })
    registeredItems.value = data.data ?? []
  } catch (err) { showSnackbar(`Failed to load list.`) } finally { itemsLoading.value = false }
}

const checkCompositeDuplicate = async (itemName, color, boxPackagingQty) => {
  try {
    const { data } = await frappeApi.get('/api/resource/Item', {
      params: { filters: JSON.stringify([['item_name', '=', itemName], ['custom_color', '=', color], ['custom_pack_qty', '=', boxPackagingQty]]), limit_page_length: 1 }
    })
    return data.data && data.data.length > 0
  } catch (err) { return false }
}

const saveProduct = async () => {
  const itemName = form.value.item_name.trim()
  const color = form.value.color.trim()
  const boxPackagingQty = Number(form.value.box_packaging_qty)

  if (!itemName || !color || !form.value.brand_id || !Number.isFinite(boxPackagingQty) || boxPackagingQty < 1) {
    showSnackbar('Item Name, Color, Brand, and Pack Qty (min 1) are required.')
    return
  }

  isSaving.value = true
  try {
    const isDuplicate = await checkCompositeDuplicate(itemName, color, boxPackagingQty)
    if (isDuplicate) { showSnackbar(DUPLICATE_MSG); isSaving.value = false; return }

    const extractedNumber = parseInt(itemName.replace(/[^0-9]/g, ''), 10) || 0
    const gridGroupId = itemName

    const itemPayload = {
      item_code: `${itemName}-${color}-${boxPackagingQty}`,
      item_name: itemName,
      item_group: 'Products',
      custom_color: color,
      brand: form.value.brand_id,
      barcode: form.value.barcode.trim() || null,
      custom_pack_qty: boxPackagingQty,
      custom_initial_stock_boxes: Number(form.value.initial_stock_boxes) || 0,
      custom_initial_stock_units: Number(form.value.initial_stock_units) || 0,
      custom_is_grid_item: form.value.is_grid ? 1 : 0, 
      custom_grid_group_id: gridGroupId, 
      custom_name_number: extractedNumber, 
      is_stock_item: 1,
      stock_uom: 'Nos'
    }

    await frappeApi.post('/api/resource/Item', itemPayload)

    showSnackbar(`Saved successfully! (Extracted No: ${extractedNumber})`, 'success')
    resetForm()
    await loadItems()
  } catch (err) {
    showSnackbar(`Save failed: Check server response`)
    console.error(err)
  } finally {
    isSaving.value = false
    focusBarcode()
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown)
  await Promise.all([loadBrands(), loadItems()])
  focusBarcode()
})

onUnmounted(() => { window.removeEventListener('keydown', handleGlobalKeydown) })
</script>

<style scoped>
.product-registration-zone { flex: 1; overflow-y: auto; padding: 20px 24px 32px; background: #f4f6f9; }
.product-reg-header h2 { margin: 0 0 4px; font-size: 20px; color: #1e293b; }
.product-reg-subtitle { margin: 0 0 20px; font-size: 13px; color: #64748b; }
.product-reg-form { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
.form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
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
.btn-refresh { background: none; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; color: #64748b; }
.list-empty { padding: 32px; text-align: center; color: #94a3b8; font-style: italic; }
.product-monitor-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.product-monitor-table th, .product-monitor-table td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: center; }
.product-monitor-table th { background: #f8fafc; font-weight: bold; color: #475569; }
.product-monitor-table td.mono { font-family: monospace; font-size: 12px; }
.text-blue { color: #2563eb; font-weight: bold; }
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
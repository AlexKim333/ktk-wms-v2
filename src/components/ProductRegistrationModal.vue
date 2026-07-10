<template>
  <div class="modal-overlay">
    <div class="modal-content">
      <header class="modal-header">
        <h2>{{ $t('product_reg.title') }}</h2>
        <p class="modal-subtitle">{{ $t('product_reg.subtitle') }}</p>
        <button class="close-btn" @click="handleClose">✕</button>
      </header>

      <div class="modal-body">
        <form class="product-reg-form" @submit.prevent="submitProduct">
          <div class="form-grid">
            <label class="form-field">
              <span>{{ $t('product_reg.item_name') }}</span>
              <input v-model="form.item_name" type="text" required :placeholder="$t('product_reg.item_name_ph')" ref="firstInput" />
            </label>
            
            <label class="form-field">
              <span>{{ $t('product_reg.color') }}</span>
              <input v-model="form.color" type="text" required :placeholder="$t('product_reg.color_ph')" />
            </label>
            
            <label class="form-field brand-field">
              <span>{{ $t('product_reg.brand') }}</span>
              <div class="brand-input-group">
                <select v-model="form.brand" required :disabled="isLoadingBrands">
                  <option value="" disabled>{{ $t('product_reg.brand_select') }}</option>
                  <option v-for="b in brands" :key="b.name" :value="b.name">{{ b.name }}</option>
                </select>
                <button type="button" class="btn-new-brand" @click="openBrandDialog">{{ $t('product_reg.btn_new') }}</button>
              </div>
            </label>

            <label class="form-field barcode-field">
              <span>{{ $t('product_reg.barcode') }}</span>
              <input ref="barcodeInputRef" v-model="form.barcode" type="text" :placeholder="$t('product_reg.barcode_ph')" @keydown.enter.prevent="submitProduct" />
            </label>
            
            <!-- 🌟 물류/회계 통합 입력 영역 -->
            <label class="form-field">
              <span>{{ $t('product_reg.warehouse') }}</span>
              <select v-model="form.warehouse" required>
                <option value="" disabled>{{ $t('product_reg.warehouse_select') }}</option>
                <option v-for="wh in warehouses" :key="wh.name" :value="wh.name">{{ wh.warehouse_name || wh.name }}</option>
              </select>
            </label>

            <!-- 🌟 듀얼 입력 기반 기초 재고 -->
            <label class="form-field dual-qty-field">
              <span>{{ $t('product_reg.opening_qty_dual') }}</span>
              <div class="dual-inputs">
                <input type="number" v-model.number="form.input_box" min="0" :placeholder="$t('product_reg.ph_box')" />
                <span class="plus-icon">+</span>
                <input type="number" v-model.number="form.input_each" min="0" :placeholder="$t('product_reg.ph_pza')" />
              </div>
              <div class="realtime-feedback" v-if="totalQty > 0">= Total {{ totalQty }} Units</div>
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
              <input v-model.number="form.pack_qty" type="number" min="1" required :placeholder="$t('product_reg.ph_pack')" />
            </label>
            
            <label class="form-field">
              <span>{{ $t('product_reg.safety_stock') }}</span>
              <input v-model.number="form.safety_stock" type="number" min="0" :placeholder="$t('product_reg.ph_safety')" />
            </label>

            <label class="form-field checkbox-field">
              <span>{{ $t('product_reg.grid_item') }}</span>
              <div class="checkbox-wrapper">
                <input type="checkbox" v-model="form.is_grid" id="grid-checkbox" />
                <label for="grid-checkbox">{{ $t('product_reg.grid_desc') }}</label>
              </div>
            </label>
          </div>
        </form>
      </div>

      <footer class="modal-footer">
        <button type="button" class="btn-cancel" @click="handleClose" :disabled="isSaving">{{ $t('product_reg.btn_cancel') }}</button>
        <button type="button" class="btn-save" @click="submitProduct" :disabled="isSaving">
          {{ isSaving ? $t('product_reg.saving') : $t('product_reg.btn_save') }}
        </button>
      </footer>
    </div>
    
    <!-- 🌟 브랜드 추가 팝업 (Modal in Modal) -->
    <div v-if="brandDialog" class="modal-overlay sub-modal">
      <div class="modal-content sub-modal-content">
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
          <button type="button" class="btn-cancel" :disabled="isBrandSaving" @click="closeBrandDialog">Cancel</button>
          <button type="button" class="btn-save" :disabled="isBrandSaving" @click="saveNewBrand">
            {{ isBrandSaving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, onUnmounted } from 'vue'
import axios from 'axios'

const emit = defineEmits(['close', 'saved'])

const frappeApi = axios.create({
  headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
  withCredentials: true
})

const form = ref({
  item_name: '', color: '', brand: '', barcode: '', pack_qty: null,
  input_box: 0, input_each: 0, warehouse: '', valuation_rate: 0, selling_price: 0, safety_stock: 0, is_grid: false
})

const brands = ref([])
const warehouses = ref([])
const isLoadingBrands = ref(true)
const isSaving = ref(false)

const firstInput = ref(null)
const barcodeInputRef = ref(null)
const brandNameInputRef = ref(null)

const brandDialog = ref(false)
const newBrandName = ref('')
const isBrandSaving = ref(false)

// 🌟 듀얼 입력 연산
const totalQty = computed(() => {
  const pack = Number(form.value.pack_qty) || 1
  const boxes = Number(form.value.input_box) || 0
  const eaches = Number(form.value.input_each) || 0
  return (boxes * pack) + eaches
})

const loadDependencies = async (selectBrandName = null) => {
  try {
    const [bRes, wRes] = await Promise.all([
      frappeApi.get('/api/resource/Brand?fields=["name","brand"]&limit_page_length=0'),
      frappeApi.get('/api/resource/Warehouse?filters=[["is_group","=",0],["company","=","kecon"],["disabled","=",0]]&fields=["name","warehouse_name"]&limit_page_length=0')
    ])
    brands.value = bRes.data.data || []
    warehouses.value = wRes.data.data || []
    
    if (selectBrandName) form.value.brand = selectBrandName
  } catch (err) {
    console.error('Failed to load dependencies', err)
  } finally {
    isLoadingBrands.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  loadDependencies()
  nextTick(() => { firstInput.value?.focus() })
})

onUnmounted(() => { window.removeEventListener('keydown', handleGlobalKeydown) })

const handleGlobalKeydown = (e) => {
  if (brandDialog.value) return 
  if (e.key === 'F8') { e.preventDefault(); submitProduct() }
  else if (e.key === 'F4') { 
    e.preventDefault(); 
    form.value.is_grid = !form.value.is_grid; 
  }
  else if (e.key === 'F9') { e.preventDefault(); resetForm() }
}

const resetForm = () => {
  form.value = {
    item_name: '', color: '', brand: form.value.brand, barcode: '', pack_qty: null,
    input_box: 0, input_each: 0, warehouse: form.value.warehouse, valuation_rate: 0, selling_price: 0, safety_stock: 0, is_grid: false
  }
  nextTick(() => { barcodeInputRef.value?.focus() })
}

const openBrandDialog = () => { newBrandName.value = ''; brandDialog.value = true; nextTick(() => brandNameInputRef.value?.focus()) }
const closeBrandDialog = () => { brandDialog.value = false; newBrandName.value = '' }

const saveNewBrand = async () => {
  if (!newBrandName.value.trim()) return
  isBrandSaving.value = true
  try {
    const { data } = await frappeApi.post('/api/resource/Brand', { brand: newBrandName.value.trim() })
    closeBrandDialog()
    await loadDependencies(data.data.name)
  } catch (err) { alert(`Failed to save Brand.`) } 
  finally { isBrandSaving.value = false }
}

const checkCompositeDuplicate = async (itemName, color, packQty) => {
  try {
    const { data } = await frappeApi.get('/api/resource/Item', {
      params: { filters: JSON.stringify([['item_name', '=', itemName], ['custom_color', '=', color], ['custom_pack_qty', '=', packQty]]), limit_page_length: 1 }
    })
    return data.data && data.data.length > 0
  } catch (err) { return false }
}

const submitProduct = async () => {
  isSaving.value = true
  try {
    const itemName = form.value.item_name.trim()
    const color = form.value.color.trim()
    const brand = form.value.brand
    const packQty = Number(form.value.pack_qty)

    if (!itemName || !color || !brand || !packQty) {
      alert("Please fill in all required fields.")
      isSaving.value = false
      return
    }

    const isDuplicate = await checkCompositeDuplicate(itemName, color, packQty)
    if (isDuplicate) throw new Error('An identical item already exists.')

    let finalItemCode = `${itemName}-${color}`
    if (packQty > 1) finalItemCode += `-${packQty}`
    
    const extractedNumber = parseInt(itemName.replace(/[^0-9]/g, ''), 10) || 0

    // 1. Item Master
    await frappeApi.post('/api/resource/Item', {
      item_code: finalItemCode,
      item_name: itemName,
      item_group: 'Products',
      brand: brand,
      stock_uom: 'Nos',
      is_stock_item: 1,
      has_variants: 0,
      custom_color: color,
      barcode: form.value.barcode.trim() || null,
      custom_pack_qty: packQty,
      safety_stock: Number(form.value.safety_stock) || 0,
      custom_is_grid_item: form.value.is_grid ? 1 : 0,
      custom_grid_group_id: itemName,
      custom_name_number: extractedNumber
    })

    // 2. Price
    if (Number(form.value.selling_price) > 0) {
      await frappeApi.post('/api/resource/Item Price', {
        item_code: finalItemCode,
        price_list: 'Standard Selling',
        price_list_rate: Number(form.value.selling_price)
      })
    }

    // 3. Stock Entry
    if (totalQty.value > 0) {
      if (!form.value.warehouse) throw new Error("Please select a warehouse.")
      if (Number(form.value.valuation_rate) <= 0) throw new Error("Valuation Rate must be greater than 0.")
      
      const stockEntryPayload = {
        stock_entry_type: 'Material Receipt',
        company: 'kecon',
        items: [{
          item_code: finalItemCode,
          t_warehouse: form.value.warehouse,
          qty: totalQty.value,
          basic_rate: Number(form.value.valuation_rate)
        }]
      }
      const stockRes = await frappeApi.post('/api/resource/Stock Entry', stockEntryPayload)
      const stockEntryName = stockRes.data.data.name
      await frappeApi.put(`/api/resource/Stock Entry/${stockEntryName}`, { docstatus: 1 })
    }

    alert(`Successfully registered [${finalItemCode}]!`)
    emit('saved')
    emit('close')
  } catch (err) {
    console.error("Registration Error:", err)
    alert(`Registration Failed: ${err.response?.data?.exception || err.message}`)
  } finally {
    isSaving.value = false
  }
}

const handleClose = () => {
  if (!isSaving.value) emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; z-index: 9999;
}
.sub-modal { z-index: 10000; background: rgba(0,0,0,0.5); backdrop-filter: none;}

.modal-content {
  background: white; width: 100%; max-width: 900px; /* Widened for 4-column grid */
  border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  display: flex; flex-direction: column; max-height: 90vh;
}
.sub-modal-content { max-width: 400px; padding: 24px; display: block; }

.modal-header { padding: 20px 24px; border-bottom: 1px solid #e2e8f0; position: relative; }
.modal-header h2 { margin: 0 0 4px; font-size: 20px; color: #1e293b; }
.modal-subtitle { margin: 0; font-size: 13px; color: #64748b; }
.close-btn { position: absolute; right: 20px; top: 20px; background: none; border: none; font-size: 20px; color: #94a3b8; cursor: pointer; padding: 4px; }
.close-btn:hover { color: #ef4444; }

.modal-body { padding: 24px; overflow-y: auto; background: #f4f6f9; }

.form-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }

.form-field { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: bold; color: #64748b; }
.form-field input[type="text"], .form-field input[type="number"], .form-field select { padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; outline: none; background: white; }
.form-field input:focus, .form-field select:focus { border-color: #00a896; box-shadow: 0 0 0 2px rgba(0, 168, 150, 0.15); }
.brand-input-group { display: flex; gap: 8px; }
.brand-input-group select { flex: 1; width: 0; }
.btn-new-brand { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0 12px; font-weight: bold; color: #00a896; cursor: pointer; white-space: nowrap; }
.btn-new-brand:hover { background: #e2e8f0; }
.barcode-field input { background: #ecfdf5; border-color: #00a896; font-family: monospace; font-weight: bold; }
.checkbox-field { justify-content: center; }
.checkbox-wrapper { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: normal; color: #334155; margin-top: 8px;}
.checkbox-wrapper input { width: 16px; height: 16px; cursor: pointer; }

.dual-qty-field { position: relative; }
.dual-inputs { display: flex; align-items: center; gap: 6px; }
.dual-inputs input { width: 50%; padding-left: 6px; padding-right: 6px; text-align: center; }
.plus-icon { font-size: 16px; color: #94a3b8; font-weight: bold; }
.realtime-feedback { position: absolute; top: -20px; right: 0; font-size: 12px; color: #059669; font-weight: bold; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; }

.modal-footer {
  padding: 16px 24px; border-top: 1px solid #e2e8f0;
  display: flex; justify-content: flex-end; gap: 12px; background: white;
  border-radius: 0 0 12px 12px;
}

.btn-cancel { padding: 10px 20px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: bold; color: #64748b; cursor: pointer; }
.btn-save { padding: 10px 24px; background: #00a896; border: none; border-radius: 6px; font-weight: bold; color: white; cursor: pointer; }
.btn-save:hover:not(:disabled) { background: #028d7e; }
.btn-save:disabled, .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }

.modal-title { margin: 0 0 16px; font-size: 18px; color: #1e293b; }
.modal-input { width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; outline: none; margin-bottom: 20px; box-sizing: border-box; }
.modal-input:focus { border-color: #00a896; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; }

@media (max-width: 1200px) { .form-grid { grid-template-columns: repeat(2, 1fr); } }
</style>

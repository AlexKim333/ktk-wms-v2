<template>
  <div class="node-management-zone">
    <header class="node-header">
      <h2>{{ $t('node.title') }}</h2>
      <p>{{ $t('node.desc') }}</p>
      
      <div class="tab-controller">
        <button :class="['tab-btn', { active: currentView === 'register' }]" @click="currentView = 'register'">{{ $t('node.tab_register') }}</button>
        <button :class="['tab-btn', { active: currentView === 'list' }]" @click="switchToListView">{{ $t('node.tab_manage') }}</button>
      </div>
    </header>

    <!-- 📝 Register Form View -->
    <form v-if="currentView === 'register'" class="node-form" @submit.prevent="saveNode">
      <div class="form-grid">
        <label class="form-field">
          <span>{{ $t('node.node_type') }}</span>
          <select v-model="form.node_type" required>
            <option value="Warehouse">{{ $t('node.type_warehouse') }}</option>
            <option value="Customer">{{ $t('node.type_customer') }}</option>
            <option value="Supplier">{{ $t('node.type_supplier') }}</option>
          </select>
        </label>

        <label class="form-field">
          <span>{{ $t('node.node_name') }}</span>
          <div class="name-input-group">
            <select v-if="form.node_type === 'Warehouse'" v-model="form.prefix" class="prefix-select">
              <option value="[MAIN] ">[MAIN]</option>
              <option value="[SUB] ">[SUB]</option>
              <option value="[CONT] ">[CONT]</option>
              <option value="[MAIN] ">[MAIN]</option>
              <option value="[SUB] ">[SUB]</option>
              <option value="[CONT] ">[CONT]</option>
              <option value="">{{ $t('node.none') }}</option>
            </select>
            
            <input 
              :value="form.name"
              @input="form.name = $event.target.value"
              type="text" 
              required 
              :placeholder="$t('node.search_placeholder')" 
              autocomplete="off"
            />
          </div>

          <!-- ✨ Real-time Matrix System -->
          <div v-if="form.name.trim().length > 0" class="matrix-container">
            <table class="matrix-table">
              <thead>
                <tr>
                  <th>{{ $t('node.col_name') }}</th>
                  <th>{{ $t('node.col_customer') }}</th>
                  <th>{{ $t('node.col_supplier') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="match in matrixMatches" :key="match.id">
                  <td class="fw-bold">{{ match.name }}</td>
                  <td class="text-center">
                    <input type="checkbox" :checked="match.types.includes('Customer')" :disabled="match.types.includes('Customer')" @change="handleCrossRegister(match, 'Customer')">
                  </td>
                  <td class="text-center">
                    <input type="checkbox" :checked="match.types.includes('Supplier')" :disabled="match.types.includes('Supplier')" @change="handleCrossRegister(match, 'Supplier')">
                  </td>
                </tr>
                <tr v-if="matrixMatches.length === 0">
                  <td colspan="3" class="empty-msg">
                    <button type="button" class="btn-new-node" @click="registerNewNode">{{ $t('node.btn_register_new', { name: form.name }) }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </label>

        <!-- ✨ Phone Number Input -->
        <label class="form-field">
          <span>{{ $t('node.phone') }} <span class="optional-text">{{ $t('node.optional') }}</span></span>
          <input v-model="form.phone" type="text" :placeholder="$t('node.phone_placeholder')" />
        </label>

        <!-- ✨ Multi-Address Input Area -->
        <div class="form-field">
         <span>{{ $t('node.addresses') }} <span class="optional-text">{{ $t('node.optional') }}</span></span>
          <div v-for="(addr, index) in form.addresses" :key="addr.id" class="dynamic-row address-group">
            <input v-model="addr.city" type="text" :placeholder="$t('node.city_placeholder')" class="city-input" />
            <input v-model="addr.val" type="text" :placeholder="$t('node.addr_placeholder')" class="addr-input" />
            <button v-if="form.addresses.length > 1" type="button" class="btn-remove-row" @click="removeRegisterAddress(index)">🗑️</button>
          </div>
          <button type="button" class="btn-add-row" @click="addRegisterAddress">
            <span class="plus-icon">➕</span> {{ $t('node.btn_add_address') }}
          </button>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="isSaving">{{ $t('node.btn_register') }}</button>
      </div>
    </form>

    <!-- 📋 Management List View -->
    <div v-else-if="currentView === 'list'" class="node-list-view">
      <div class="list-filter-bar">
        <select v-model="listFilterType" class="filter-select">
          <option value="All">{{ $t('node.filter_all_types') }}</option>
          <option value="Warehouse">{{ $t('node.type_warehouse') }}</option>
          <option value="Customer">{{ $t('node.type_customer') }}</option>
          <option value="Supplier">{{ $t('node.type_supplier') }}</option>
        </select>
        
        <input 
          :value="searchQuery"
          @input="searchQuery = $event.target.value"
          type="text" 
          :placeholder="$t('node.search_edit_placeholder')" 
          class="filter-input" 
        />
        <button class="btn-refresh" @click="fetchNodeList">🔄 {{ $t('common.refresh') }}</button>
        <button class="btn-save-status" @click="saveNodeStatus" :disabled="isSaving">{{ $t('node.btn_update_status') }}</button>
        <button class="btn-new-node-action" @click="currentView = 'register'">{{ $t('node.btn_new_node') }}</button>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th class="text-center" style="width: 60px;">{{ $t('node.col_active') }}</th>
              <th>{{ $t('node.col_type') }}</th>
              <th>{{ $t('node.col_name') }}</th>
              <th class="text-center">{{ $t('node.col_actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="node in filteredNodes" :key="node.id" :class="{'disabled-row': node.disabled === 1}">
              <td class="text-center">
                <input type="checkbox" class="status-checkbox" :checked="node.disabled === 0" @change="node.disabled = $event.target.checked ? 0 : 1" />
              </td>
              <td>
                <span :class="['type-badge', node.type.toLowerCase()]">{{ node.type }}</span>
              </td>
              <td class="fw-bold">{{ node.name }}</td>
              <td class="text-center">
                <button class="btn-edit" @click="openEditModal(node)">{{ $t('node.btn_edit') }}</button>
                <button class="btn-delete" @click="deleteNode(node)">🗑️</button>
              </td>
            </tr>
            <tr v-if="filteredNodes.length === 0">
              <td colspan="3" class="text-center empty-msg">{{ $t('node.empty_list') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ✏️ EDIT MODAL (Fully Upgraded with City) -->
    <div v-if="isEditModalOpen" class="modal-overlay" @click.self="closeEditModal">
      <div class="modal-content">
        <h3>{{ $t('node.modal_edit_title', { type: editForm.type }) }}</h3>
        
        <div class="form-grid">
          <label class="form-field">
            <span>{{ $t('node.node_name') }}</span>
            <input v-model="editForm.name" type="text" required />
          </label>

          <label class="form-field">
            <span>{{ $t('node.phone') }}</span>
            <input v-model="editForm.phone" type="text" :placeholder="$t('node.update_phone_placeholder')" />
          </label>

          <!-- Edit Addresses Area -->
          <div class="form-field">
            <span>{{ $t('node.manage_addresses') }}</span>
            <div v-for="(addr, index) in editForm.addresses" :key="addr.id" class="dynamic-row address-group">
              <input v-model="addr.city" type="text" :class="{'deleted-input': addr.isDeleted}" :disabled="addr.isDeleted" :placeholder="$t('node.city_placeholder')" class="city-input" />
              <input v-model="addr.val" type="text" :class="{'deleted-input': addr.isDeleted}" :disabled="addr.isDeleted" :placeholder="$t('node.addr_placeholder')" class="addr-input" />
              
              <!-- Toggle Restore/Delete -->
              <button v-if="!addr.isDeleted" type="button" class="btn-remove-row" @click="addr.isDeleted = true">🗑️</button>
              <button v-else type="button" class="btn-restore-row" @click="addr.isDeleted = false">↩️</button>
            </div>
            <button type="button" class="btn-add-row" @click="addEditAddress">
              <span class="plus-icon">➕</span> {{ $t('node.btn_add_new_address') }}
            </button>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-cancel" @click="closeEditModal">{{ $t('node.btn_cancel') }}</button>
          <button type="button" class="btn-save" @click="updateNode" :disabled="isSaving">{{ $t('node.btn_apply_changes') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const frappeApi = axios.create({ 
  headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, 
  withCredentials: true 
})

// 📦 Global States
const currentView = ref('register')
const isSaving = ref(false)
const form = ref({ 
  node_type: 'Warehouse', prefix: '[SUB] ', name: '', phone: '', 
  addresses: [{ id: Date.now(), val: '', city: '' }]
})
const nodeList = ref([])
const searchQuery = ref('')
const listFilterType = ref('All')

// 📦 Modal States
const isEditModalOpen = ref(false)
const editForm = ref({ id: '', type: '', name: '', phone: '', addresses: [] })

// 🌟 Hangul Engine (Ultra-light)
const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"]
const JUNG = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"]
const JONG = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"]

const disassembleHangul = (str) => {
  let result = ''
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const offset = code - 0xAC00
      const choIndex = Math.floor(offset / 588)
      const jungIndex = Math.floor((offset - (choIndex * 588)) / 28)
      const jongIndex = offset % 28
      result += CHO[choIndex] + JUNG[jungIndex] + (jongIndex > 0 ? JONG[jongIndex] : '')
    } else {
      result += str[i]
    }
  }
  return result
}

// 🚀 Dynamic Rows Logic (중복 선언 제거 완벽 해결!)
const addRegisterAddress = () => form.value.addresses.push({ id: Date.now(), val: '', city: '' })
const removeRegisterAddress = (index) => form.value.addresses.splice(index, 1)
const addEditAddress = () => editForm.value.addresses.push({ id: Date.now(), val: '', city: '', isNew: true, isDeleted: false })

// 🚀 API Load
const fetchNodeList = async () => {
  try {
    const [warehouseRes, customerRes, supplierRes] = await Promise.all([
      frappeApi.get('/api/resource/Warehouse?fields=["name","warehouse_name","disabled"]&limit_page_length=0'),
      frappeApi.get('/api/resource/Customer?fields=["name","customer_name","disabled"]&limit_page_length=0'),
      frappeApi.get('/api/resource/Supplier?fields=["name","supplier_name","disabled"]&limit_page_length=0')
    ])

    const combinedList = []
    if (warehouseRes.data?.data) warehouseRes.data.data.forEach(item => combinedList.push({ id: item.name, type: 'Warehouse', name: item.warehouse_name || item.name, disabled: item.disabled || 0, originalDisabled: item.disabled || 0 }))
    if (customerRes.data?.data) customerRes.data.data.forEach(item => combinedList.push({ id: item.name, type: 'Customer', name: item.customer_name || item.name, disabled: item.disabled || 0, originalDisabled: item.disabled || 0 }))
    if (supplierRes.data?.data) supplierRes.data.data.forEach(item => combinedList.push({ id: item.name, type: 'Supplier', name: item.supplier_name || item.name, disabled: item.disabled || 0, originalDisabled: item.disabled || 0 }))
    
    nodeList.value = combinedList
  } catch (error) {
    console.error('API Fetch Error:', error)
  }
}

onMounted(() => fetchNodeList())

const matrixMatches = computed(() => {
  const rawQ = form.value.name.trim().toLowerCase()
  if (!rawQ) return []
  const disassembledQ = disassembleHangul(rawQ)
  const grouped = {}
  
  nodeList.value.filter(n => n.disabled !== 1).forEach(n => {
    const cleanName = n.name.replace(/^\[.*?\]\s*/, '').trim()
    if (disassembleHangul(cleanName.toLowerCase()).includes(disassembledQ)) {
      if (!grouped[cleanName]) grouped[cleanName] = { id: n.id, name: cleanName, types: [] }
      grouped[cleanName].types.push(n.type)
    }
  })
  return Object.values(grouped)
})

const filteredNodes = computed(() => {
  let result = nodeList.value
  if (listFilterType.value !== 'All') result = result.filter(n => n.type === listFilterType.value)
  
  const rawQ = searchQuery.value.trim().toLowerCase()
  if (rawQ) {
    const disassembledQ = disassembleHangul(rawQ)
    result = result.filter(n => disassembleHangul(n.name.toLowerCase()).includes(disassembledQ))
  }
  return result
})

// 🚀 Save Node Status (Active/Inactive)
const saveNodeStatus = async () => {
  const changedNodes = nodeList.value.filter(n => n.disabled !== n.originalDisabled);
  if (changedNodes.length === 0) {
    alert('No status changes detected.');
    return;
  }
  
  isSaving.value = true;
  try {
    const updatePromises = changedNodes.map(node => {
      return frappeApi.put(`/api/resource/${node.type}/${node.id}`, { disabled: node.disabled });
    });
    
    await Promise.all(updatePromises);
    alert(`✅ Successfully updated ${changedNodes.length} node statuses!`);
    await fetchNodeList();
  } catch (error) {
    console.error('Failed to update node statuses:', error);
    alert('❌ Failed to update statuses. Please try again.');
  } finally {
    isSaving.value = false;
  }
}

// 🚀 Save New Node
const saveNode = async () => {
  isSaving.value = true
  try {
    let apiEndpoint = ''
    let payload = {}

    const finalNodeName = form.value.node_type === 'Warehouse' && form.value.prefix
      ? `${form.value.prefix}${form.value.name}` : form.value.name;

    // 🚨 [핵심 기능] 강력한 중복 등록 방지 시스템!
    // 현재 불러와져 있는 nodeList에서 이름과 타입이 똑같은 녀석이 있는지 검사합니다.
    const isDuplicate = nodeList.value.some(
      node => node.name.toLowerCase() === finalNodeName.toLowerCase() && node.type === form.value.node_type
    );

    if (isDuplicate) {
      // 중복일 경우 강력한 영어 경고창을 날리고 함수를 강제 종료합니다.
      alert(`⚠️ STOP! DUPLICATE NODE DETECTED!\n\nThe node "${finalNodeName}" already exists as a ${form.value.node_type}.\n\nIf you want to add an address or update information, please switch to the [📋 Manage] tab and use the [✏️ Edit] button.\n\nYou cannot re-register an existing node here.`);
      isSaving.value = false;
      return; // 서버로 데이터가 넘어가지 못하게 여기서 컷!
    }

    // Attach generic phone field
    if (form.value.node_type === 'Warehouse') {
      apiEndpoint = '/api/resource/Warehouse'
      payload = { warehouse_name: finalNodeName, company: 'kecon', is_group: 0, phone_no: form.value.phone } 
    } else if (form.value.node_type === 'Customer') {
      apiEndpoint = '/api/resource/Customer'
      payload = { customer_name: finalNodeName, customer_group: 'Commercial', territory: 'All Territories', custom_phone: form.value.phone }
    } else if (form.value.node_type === 'Supplier') {
      apiEndpoint = '/api/resource/Supplier'
      payload = { supplier_name: finalNodeName, supplier_group: 'Local', custom_phone: form.value.phone }
    }

    const response = await frappeApi.post(apiEndpoint, payload)
    const createdName = response.data.data.name 

    // Loop & Save Multiple Addresses
    for (const addr of form.value.addresses) {
      if (addr.val.trim() !== '') {
        await frappeApi.post('/api/resource/Address', {
          address_title: finalNodeName,
          address_type: form.value.node_type === 'Warehouse' ? 'Warehouse' : 'Billing',
          address_line1: addr.val.trim(),
          city: addr.city ? addr.city.trim() : 'Unknown City', 
          links: [{ link_doctype: form.value.node_type, link_name: createdName }]
        })
      }
    }

    alert(`✅ Success: ${finalNodeName} registered!`)
    form.value = { node_type: 'Warehouse', prefix: '[SUB] ', name: '', phone: '', addresses: [{ id: Date.now(), val: '', city: '' }] }
    await fetchNodeList()
    currentView.value = 'list'
    
  } catch (error) {
    let detailMsg = 'Unknown Error.'
    if (error.response?.data?._server_messages) detailMsg = JSON.parse(error.response.data._server_messages).map(m => JSON.parse(m).message).join('\n')
    alert(`❌ Failed!\n\n${detailMsg}`)
  } finally {
    isSaving.value = false
  }
}
const handleCrossRegister = async (match, targetType) => {
  if (!confirm(`Cross-register "${match.name}" as ${targetType}?`)) return;
  try {
    isSaving.value = true
    const endpoint = targetType === 'Customer' ? '/api/resource/Customer' : '/api/resource/Supplier'
    const payload = targetType === 'Customer' 
      ? { customer_name: match.name, customer_group: 'Commercial', territory: 'All Territories' }
      : { supplier_name: match.name, supplier_group: 'Local' }
    await frappeApi.post(endpoint, payload)
    alert(`✅ Success!`)
    await fetchNodeList()
  } catch (error) { alert('Failed network connection.') } 
  finally { isSaving.value = false }
}

// ✏️ Open Edit Modal & Fetch REAL Data
const openEditModal = async (node) => {
  editForm.value = { id: node.id, type: node.type, name: node.name, phone: '', addresses: [] }
  isEditModalOpen.value = true

  try {
    // ✨ City 필드를 포함하여 진짜 DB 호출
    const res = await frappeApi.get(`/api/resource/Address?filters=[["Dynamic Link","link_name","=","${node.id}"]]&fields=["name","address_line1","city"]`)
    if (res.data && res.data.data) {
      editForm.value.addresses = res.data.data.map(a => ({
        id: a.name,
        val: a.address_line1,
        city: a.city || '', 
        isNew: false,
        isDeleted: false
      }))
    }
  } catch (e) { 
    console.error('실제 주소를 불러오는데 실패했습니다:', e) 
  }
}

const closeEditModal = () => isEditModalOpen.value = false

// 🚀 Apply Changes (Update)
const updateNode = async () => {
  isSaving.value = true
  try {
    const docType = editForm.value.type
    const docName = editForm.value.id
    
    // 1. Update Main Node Details (PUT)
    let payload = {}
    if (docType === 'Warehouse') payload = { warehouse_name: editForm.value.name, phone_no: editForm.value.phone }
    else if (docType === 'Customer') payload = { customer_name: editForm.value.name, custom_phone: editForm.value.phone }
    else if (docType === 'Supplier') payload = { supplier_name: editForm.value.name, custom_phone: editForm.value.phone }
    await frappeApi.put(`/api/resource/${docType}/${docName}`, payload)

    // 2. Loop & Update Addresses
    for (const addr of editForm.value.addresses) {
      if (addr.isDeleted && !addr.isNew) {
        await frappeApi.delete(`/api/resource/Address/${addr.id}`)
      } else if (addr.isNew && !addr.isDeleted && addr.val.trim() !== '') {
        await frappeApi.post('/api/resource/Address', {
          address_title: editForm.value.name,
          address_type: docType === 'Warehouse' ? 'Warehouse' : 'Billing',
          address_line1: addr.val.trim(),
          city: addr.city ? addr.city.trim() : 'Unknown City', // ✨ City 데이터 전송
          links: [{ link_doctype: docType, link_name: docName }]
        })
      } else if (!addr.isNew && !addr.isDeleted) {
        await frappeApi.put(`/api/resource/Address/${addr.id}`, { 
          address_line1: addr.val.trim(),
          city: addr.city ? addr.city.trim() : 'Unknown City' // ✨ City 데이터 전송
        })
      }
    }
    
    alert(`✅ Successfully updated!`)
    isEditModalOpen.value = false
    await fetchNodeList()
  } catch (error) {
    console.error('Update Error:', error);
    let detailMsg = 'Update failed. Check Frappe permissions/fields.';
    if (error.response?.data?._server_messages) {
      try {
        const msgs = JSON.parse(error.response.data._server_messages);
        detailMsg = msgs.map(m => JSON.parse(m).message).join('\n');
      } catch (e) {
        detailMsg = 'Error parsing server response.';
      }
    } else if (error.response?.data?.exception) {
      detailMsg = error.response.data.exception;
    }
    alert(`❌ Update failed!\n\n[Reason]\n${detailMsg}`);
  } finally {
    isSaving.value = false
  }
}

const switchToListView = () => currentView.value = 'list'
const registerNewNode = () => {}
const deleteNode = (node) => alert(`Delete action triggered for ${node.name}`)
</script>

<style scoped>
.node-management-zone { padding: 20px; background: #f4f6f9; height: 100%; font-family: -apple-system, sans-serif; display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; }
.node-header { flex-shrink: 0; }
.node-header h2 { margin: 0 0 5px 0; color: #1e293b; }
.node-header p { margin: 0 0 20px 0; color: #64748b; font-size: 14px; }
.tab-controller { display: flex; gap: 10px; margin-bottom: 20px; }
.tab-btn { background: white; border: 1px solid #cbd5e1; padding: 10px 20px; cursor: pointer; border-radius: 6px; font-weight: bold; color: #475569;}
.tab-btn.active { background: #00a896; color: white; border-color: #00a896; }

.node-form { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow-y: auto; flex: 1; min-height: 0; }
.form-grid { display: grid; gap: 15px; }
.form-field { display: flex; flex-direction: column; gap: 5px; font-weight: bold; font-size: 13px; color: #334155;}
.form-field input, .form-field select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; }
.form-field input:focus, .form-field select:focus { border-color: #00a896; box-shadow: 0 0 0 2px rgba(0,168,150,0.1); }
.optional-text { color: #94a3b8; font-weight: normal; font-size: 11px; }

.name-input-group, .dynamic-row { display: flex; gap: 5px; margin-bottom: 5px;}
.prefix-select { width: 90px; }
.name-input-group input, .dynamic-row input { flex: 1; }

/* 🌟 주소 입력칸 가로 분할 및 예쁜 디자인 적용 */
.address-group { display: flex; gap: 8px; margin-bottom: 10px; width: 100%; }
.city-input { width: 35%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; }
.addr-input { width: 65%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; }
.city-input:focus, .addr-input:focus { border-color: #00a896; box-shadow: 0 0 0 2px rgba(0, 168, 150, 0.1); }

/* 🌟 버튼 디자인 (핑크 휴지통 & 점선 추가 버튼) */
.btn-add-row { background: #f8fafc; border: 1px dashed #94a3b8; padding: 12px; border-radius: 6px; cursor: pointer; color: #475569; font-weight: 600; font-size: 13px; transition: background 0.2s; display: flex; justify-content: center; align-items: center; gap: 8px;}
.btn-add-row:hover { background: #f1f5f9; border-color: #64748b; }
.plus-icon { color: #6b21a8; font-size: 14px; }
.btn-remove-row { background: #fce8e8; border: 1px solid #f8d7d7; padding: 0 12px; border-radius: 6px; cursor: pointer; font-size: 14px; transition: all 0.2s; display: flex; justify-content: center; align-items: center; }
.btn-remove-row:hover { background: #fca5a5; }
.btn-restore-row { background: #e0f2fe; border: 1px solid #bae6fd; padding: 0 12px; border-radius: 6px; cursor: pointer; display: flex; justify-content: center; align-items: center; }
.deleted-input { text-decoration: line-through; opacity: 0.5; background: #f1f5f9; }

.form-actions { margin-top: 20px; text-align: right; }
.btn-save { background: #00a896; color: white; padding: 12px 24px; border: none; cursor: pointer; border-radius: 6px; font-weight: bold; transition: background 0.2s;}
.btn-save:hover:not(:disabled) { background: #008f7f; }

.matrix-container { margin-top: 10px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; }
.matrix-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.matrix-table th { background: #f8fafc; padding: 10px; border-bottom: 1px solid #cbd5e1; color: #475569; }
.matrix-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; color: #334155; }
.text-center { text-align: center; }
.fw-bold { font-weight: 600; }
.btn-new-node { width: 100%; background: #0f766e; color: white; border: none; padding: 12px; cursor: pointer; font-weight: bold; }

.list-filter-bar { display: flex; gap: 10px; margin-bottom: 15px; }
.filter-select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; font-weight: bold;}
.filter-input { flex: 1; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; }
.btn-refresh { background: #334155; color: white; padding: 0 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;}
.btn-save-status { background: #f59e0b; color: white; padding: 0 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; margin-left: auto; transition: background 0.2s; }
.btn-save-status:hover:not(:disabled) { background: #d97706; }
.btn-save-status:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-new-node-action { background: #00a896; color: white; padding: 0 20px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; margin-left: 5px; transition: background 0.2s; }
.btn-new-node-action:hover { background: #008f7f; }
.node-list-view { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.table-container { overflow: auto; flex: 1; min-height: 0; }
.data-table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; border: 1px solid #e2e8f0; }
.data-table th { background: #f8fafc; padding: 12px; border-bottom: 2px solid #e2e8f0; text-align: left; position: sticky; top: 0; z-index: 10; }
.data-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
.disabled-row { background-color: #f1f5f9; opacity: 0.6; }
.disabled-row td.fw-bold { text-decoration: line-through; color: #94a3b8; }
.status-checkbox { width: 18px; height: 18px; cursor: pointer; }
.type-badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase; text-decoration: none !important;}
.type-badge.warehouse { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
.type-badge.customer { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;}
.type-badge.supplier { background: #fef08a; color: #a16207; border: 1px solid #fde047;}
.btn-edit { background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-right: 5px; font-weight: 600; font-size: 12px;}
.btn-delete { background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px;}

/* 🌟 Edit Modal */
.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.6); display: flex; justify-content: center; align-items: center; z-index: 999; }
.modal-content { background: white; padding: 25px; border-radius: 10px; width: 450px; max-width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.2); max-height: 90vh; overflow-y: auto;}
.modal-content h3 { margin-top: 0; margin-bottom: 20px; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;}
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 25px; }
.btn-cancel { background: #cbd5e1; color: #334155; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; }
</style>

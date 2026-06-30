<template>
  <div class="node-management-zone">
    <header class="node-header">
      <h2>🏢 Logistics Node & Partner Management</h2>
      <p>Real-time node detection & multi-category registration.</p>
      
      <div class="tab-controller">
        <button :class="['tab-btn', { active: currentView === 'register' }]" @click="currentView = 'register'">📝 Register</button>
        <button :class="['tab-btn', { active: currentView === 'list' }]" @click="switchToListView">📋 Manage</button>
      </div>
    </header>

    <!-- 📝 Register Form View -->
    <form v-if="currentView === 'register'" class="node-form" @submit.prevent="saveNode">
      <div class="form-grid">
        <label class="form-field">
          <span>Node Type *</span>
          <select v-model="form.node_type" required>
            <option value="Warehouse">📦 Warehouse</option>
            <option value="Customer">🏪 Customer</option>
            <option value="Supplier">🏭 Supplier</option>
          </select>
        </label>

        <label class="form-field">
          <span>Node Name *</span>
          <div class="name-input-group">
            <select v-if="form.node_type === 'Warehouse'" v-model="form.prefix" class="prefix-select">
              <option value="[MAIN] ">[MAIN]</option>
              <option value="[SUB] ">[SUB]</option>
              <option value="[CONT] ">[CONT]</option>
              <option value="">None</option>
            </select>
            
            <input 
              :value="form.name"
              @input="form.name = $event.target.value"
              type="text" 
              required 
              placeholder="Start typing to search or register (e.g., ㅎ, 홍ㄱ...)" 
              autocomplete="off"
            />
          </div>

          <!-- ✨ Real-time Matrix System -->
          <div v-if="form.name.trim().length > 0" class="matrix-container">
            <table class="matrix-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Customer</th>
                  <th>Supplier</th>
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
                    <button type="button" class="btn-new-node" @click="registerNewNode">✨ Register "{{ form.name }}" as New Node</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </label>

        <!-- ✨ Phone Number Input -->
        <label class="form-field">
          <span>Phone Number <span class="optional-text">(Optional)</span></span>
          <input v-model="form.phone" type="text" placeholder="e.g., +52 55 1234 5678" />
        </label>

        <!-- ✨ Multi-Address Input Area -->
        <div class="form-field">
          <span>Addresses <span class="optional-text">(Optional)</span></span>
          <div v-for="(addr, index) in form.addresses" :key="addr.id" class="dynamic-row">
            <input v-model="addr.val" type="text" placeholder="Detailed address..." />
            <button v-if="form.addresses.length > 1" type="button" class="btn-remove-row" @click="removeRegisterAddress(index)">❌</button>
          </div>
          <button type="button" class="btn-add-row" @click="addRegisterAddress">➕ Add Another Address</button>
        </div>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-save" :disabled="isSaving">Register</button>
      </div>
    </form>

    <!-- 📋 Management List View -->
    <div v-else-if="currentView === 'list'" class="node-list-view">
      <div class="list-filter-bar">
        <select v-model="listFilterType" class="filter-select">
          <option value="All">🌐 All Types</option>
          <option value="Warehouse">📦 Warehouse</option>
          <option value="Customer">🏪 Customer</option>
          <option value="Supplier">🏭 Supplier</option>
        </select>
        
        <input 
          :value="searchQuery"
          @input="searchQuery = $event.target.value"
          type="text" 
          placeholder="Search to edit... (e.g., ㅎ, 홍ㄱ...)" 
          class="filter-input" 
        />
        <button class="btn-refresh" @click="fetchNodeList">🔄 Refresh</button>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Name</th>
              <th class="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="node in filteredNodes" :key="node.id">
              <td>
                <span :class="['type-badge', node.type.toLowerCase()]">{{ node.type }}</span>
              </td>
              <td class="fw-bold">{{ node.name }}</td>
              <td class="text-center">
                <button class="btn-edit" @click="openEditModal(node)">✏️ Edit</button>
                <button class="btn-delete" @click="deleteNode(node)">🗑️</button>
              </td>
            </tr>
            <tr v-if="filteredNodes.length === 0">
              <td colspan="3" class="text-center empty-msg">No nodes found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ✏️ EDIT MODAL (Fully Upgraded) -->
    <div v-if="isEditModalOpen" class="modal-overlay" @click.self="closeEditModal">
      <div class="modal-content">
        <h3>✏️ Edit {{ editForm.type }}</h3>
        
        <div class="form-grid">
          <label class="form-field">
            <span>Node Name *</span>
            <input v-model="editForm.name" type="text" required />
          </label>

          <label class="form-field">
            <span>Phone Number</span>
            <input v-model="editForm.phone" type="text" placeholder="Update phone number..." />
          </label>

          <!-- Edit Addresses Area -->
          <div class="form-field">
            <span>Manage Addresses</span>
            <div v-for="(addr, index) in editForm.addresses" :key="addr.id" class="dynamic-row">
              <input v-model="addr.val" type="text" :class="{'deleted-input': addr.isDeleted}" :disabled="addr.isDeleted" />
              
              <!-- Toggle Restore/Delete -->
              <button v-if="!addr.isDeleted" type="button" class="btn-remove-row" @click="addr.isDeleted = true">🗑️</button>
              <button v-else type="button" class="btn-restore-row" @click="addr.isDeleted = false">↩️</button>
            </div>
            <button type="button" class="btn-add-row" @click="addEditAddress">➕ Add New Address</button>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-cancel" @click="closeEditModal">Cancel</button>
          <button type="button" class="btn-save" @click="updateNode" :disabled="isSaving">💾 Apply Changes</button>
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

// Global States
const currentView = ref('register')
const isSaving = ref(false)
const form = ref({ 
  node_type: 'Warehouse', prefix: '[SUB] ', name: '', phone: '', 
  addresses: [{ id: Date.now(), val: '' }] 
})
const nodeList = ref([])
const searchQuery = ref('')
const listFilterType = ref('All')

// Modal States
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

// 🚀 Dynamic Rows Logic (Register)
const addRegisterAddress = () => form.value.addresses.push({ id: Date.now(), val: '' })
const removeRegisterAddress = (index) => form.value.addresses.splice(index, 1)

// 🚀 Dynamic Rows Logic (Edit)
const addEditAddress = () => editForm.value.addresses.push({ id: Date.now(), val: '', isNew: true, isDeleted: false })

// 🚀 API Load
const fetchNodeList = async () => {
  try {
    const [warehouseRes, customerRes, supplierRes] = await Promise.all([
      frappeApi.get('/api/resource/Warehouse?fields=["name","warehouse_name"]&limit_page_length=0'),
      frappeApi.get('/api/resource/Customer?fields=["name","customer_name"]&limit_page_length=0'),
      frappeApi.get('/api/resource/Supplier?fields=["name","supplier_name"]&limit_page_length=0')
    ])

    const combinedList = []
    if (warehouseRes.data?.data) warehouseRes.data.data.forEach(item => combinedList.push({ id: item.name, type: 'Warehouse', name: item.warehouse_name || item.name }))
    if (customerRes.data?.data) customerRes.data.data.forEach(item => combinedList.push({ id: item.name, type: 'Customer', name: item.customer_name || item.name }))
    if (supplierRes.data?.data) supplierRes.data.data.forEach(item => combinedList.push({ id: item.name, type: 'Supplier', name: item.supplier_name || item.name }))
    
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
  
  nodeList.value.forEach(n => {
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

// 🚀 Save New Node
const saveNode = async () => {
  isSaving.value = true
  try {
    let apiEndpoint = ''
    let payload = {}

    const finalNodeName = form.value.node_type === 'Warehouse' && form.value.prefix
      ? `${form.value.prefix}${form.value.name}` : form.value.name;

    // Attach generic phone field (Map this to your actual Frappe field if different)
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
          links: [{ link_doctype: form.value.node_type, link_name: createdName }]
        })
      }
    }

    alert(`✅ Success: ${finalNodeName} registered!`)
    form.value = { node_type: 'Warehouse', prefix: '[SUB] ', name: '', phone: '', addresses: [{ id: Date.now(), val: '' }] }
    await fetchNodeList()
    
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

// ✏️ Open Edit Modal & Fetch Data
const openEditModal = async (node) => {
  editForm.value = { id: node.id, type: node.type, name: node.name, phone: '', addresses: [] }
  isEditModalOpen.value = true

  // Let's pretend to load addresses linked to this node. 
  // (In real Frappe, you might need a specific REST query. Simulated here for UI layout).
  try {
    // Example fetch (Adjust fieldnames to your Frappe DB)
    // const res = await frappeApi.get(`/api/resource/Address?filters=[["Dynamic Link","link_name","=","${node.id}"]]&fields=["name","address_line1"]`)
    
    // Simulating fetched data for the modal UI functionality:
    const simulatedResponse = [
      { name: 'ADDR-001', address_line1: 'Existing Address 1' }
    ]
    
    editForm.value.addresses = simulatedResponse.map(a => ({
      id: a.name, val: a.address_line1, isNew: false, isDeleted: false
    }))
  } catch (e) { console.error(e) }
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
        // DELETE Old Address
        await frappeApi.delete(`/api/resource/Address/${addr.id}`)
      } else if (addr.isNew && !addr.isDeleted && addr.val.trim() !== '') {
        // POST New Address
        await frappeApi.post('/api/resource/Address', {
          address_title: editForm.value.name,
          address_type: docType === 'Warehouse' ? 'Warehouse' : 'Billing',
          address_line1: addr.val.trim(),
          links: [{ link_doctype: docType, link_name: docName }]
        })
      } else if (!addr.isNew && !addr.isDeleted) {
        // PUT Edited Address
        await frappeApi.put(`/api/resource/Address/${addr.id}`, { address_line1: addr.val.trim() })
      }
    }
    
    alert(`✅ Successfully updated!`)
    isEditModalOpen.value = false
    await fetchNodeList()
  } catch (error) {
    alert('Update failed. Check Frappe permissions/fields.')
  } finally {
    isSaving.value = false
  }
}

const switchToListView = () => currentView.value = 'list'
const registerNewNode = () => {}
const deleteNode = (node) => alert(`Delete action triggered for ${node.name}`)
</script>

<style scoped>
.node-management-zone { padding: 20px; background: #f4f6f9; height: 100%; font-family: -apple-system, sans-serif; }
.node-header h2 { margin: 0 0 5px 0; color: #1e293b; }
.node-header p { margin: 0 0 20px 0; color: #64748b; font-size: 14px; }
.tab-controller { display: flex; gap: 10px; margin-bottom: 20px; }
.tab-btn { background: white; border: 1px solid #cbd5e1; padding: 10px 20px; cursor: pointer; border-radius: 6px; font-weight: bold; color: #475569;}
.tab-btn.active { background: #00a896; color: white; border-color: #00a896; }

.node-form { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);}
.form-grid { display: grid; gap: 15px; }
.form-field { display: flex; flex-direction: column; gap: 5px; font-weight: bold; font-size: 13px; color: #334155;}
.form-field input, .form-field select { padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; outline: none; }
.form-field input:focus { border-color: #00a896; box-shadow: 0 0 0 2px rgba(0,168,150,0.1); }
.optional-text { color: #94a3b8; font-weight: normal; font-size: 11px; }

.name-input-group, .dynamic-row { display: flex; gap: 5px; margin-bottom: 5px;}
.prefix-select { width: 90px; }
.name-input-group input, .dynamic-row input { flex: 1; }
.btn-add-row { background: #f8fafc; border: 1px dashed #cbd5e1; padding: 8px; border-radius: 6px; cursor: pointer; color: #475569; font-weight: bold; transition: 0.2s;}
.btn-add-row:hover { background: #f1f5f9; border-color: #94a3b8; }
.btn-remove-row { background: #fee2e2; border: none; padding: 0 12px; border-radius: 6px; cursor: pointer; }
.btn-restore-row { background: #e0f2fe; border: none; padding: 0 12px; border-radius: 6px; cursor: pointer; }
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
.table-container { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; border: 1px solid #e2e8f0; }
.data-table th { background: #f8fafc; padding: 12px; border-bottom: 2px solid #e2e8f0; text-align: left; }
.data-table td { padding: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
.type-badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase;}
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
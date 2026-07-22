<template>
  <div class="staff-management-container">
    <div class="header-actions">
      <h2>{{ $t('staff.title') }}</h2>
      <button class="add-btn" @click="openModal">{{ $t('staff.btn_add') }}</button>
    </div>

    <!-- 리스트 테이블 -->
    <div class="table-container">
      <table class="staff-table">
        <thead>
          <tr>
            <th>{{ $t('staff.col_name') }}</th>
            <th>{{ $t('staff.col_email') }}</th>
            <th>{{ $t('staff.col_role') }}</th>
            <th>{{ $t('staff.col_branch') }}</th>
            <th>{{ $t('staff.col_manage') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in staffList" :key="user.email">
            <td>{{ user.full_name }}</td>
            <td>{{ user.email }}</td>
            <td>
              <span class="badge" :class="getRoleBadgeClass(user.role)">{{ user.role || $t('staff.no_role') }}</span>
            </td>
            <td>{{ user.branch || '-' }}</td>
            <td>
              <button class="edit-btn" @click="editUser(user)">{{ $t('staff.btn_edit') }}</button>
            </td>
          </tr>
          <tr v-if="staffList.length === 0">
            <td colspan="5" style="text-align: center; padding: 20px; color: #94a3b8;">
              가족 데이터가 없습니다.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 등록/수정 모달 -->
    <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h3>{{ isEditing ? $t('staff.modal_title_edit') : $t('staff.modal_title_add') }}</h3>
        <form @submit.prevent="saveUser">
          <div class="form-group">
            <label>{{ $t('staff.lbl_name') }}</label>
            <input type="text" v-model="form.full_name" required :placeholder="$t('staff.ph_name')" :disabled="isEditing" />
          </div>
          <div class="form-group">
            <label>{{ $t('staff.col_email') }}</label>
            <input type="email" v-model="form.email" required :placeholder="$t('staff.ph_email')" :disabled="isEditing" />
          </div>
          <div class="form-group" v-if="!isEditing">
            <label>{{ $t('staff.lbl_pw') }}</label>
            <div style="position: relative; display: flex; align-items: center;">
              <input :type="showPassword ? 'text' : 'password'" v-model="form.password" required style="width: 100%; padding-right: 40px;" />
              <button type="button" @click="showPassword = !showPassword" style="position: absolute; right: 10px; background: none; border: none; font-size: 16px; cursor: pointer; color: #64748b; padding: 0;">
                {{ showPassword ? '🙈' : '👁️' }}
              </button>
            </div>
          </div>
          <div class="form-group">
            <label>{{ $t('staff.lbl_role') }}</label>
            <select v-model="form.role" required>
              <option value="">{{ $t('staff.sel_role') }}</option>
              <option value="System Manager">{{ $t('staff.role_sys') }}</option>
              <option value="Branch Manager">{{ $t('staff.role_branch') }}</option>
              <option value="Branch Clerk">{{ $t('staff.role_clerk') }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ $t('staff.lbl_warehouse') }}</label>
            <select v-model="form.branch" :required="form.role !== 'System Manager'">
              <option value="">{{ $t('staff.sel_branch') }}</option>
              <option value="ALL" v-if="form.role === 'System Manager'">{{ $t('staff.opt_all_branch') }}</option>
              <option v-for="wh in warehouseList" :key="wh.name" :value="wh.name">
                {{ wh.warehouse_name || wh.name }}
              </option>
            </select>
          </div>
          
          <div class="modal-actions">
            <button type="button" class="cancel-btn" @click="closeModal">{{ $t('staff.btn_cancel') }}</button>
            <button type="submit" class="save-btn" :disabled="isSaving">
              {{ isSaving ? $t('common.loading') : $t('staff.btn_save') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

import frappeApi from '../api/frappe.js'

const staffList = ref([])
const warehouseList = ref([])

const isModalOpen = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const showPassword = ref(false)

const form = ref({
  full_name: '',
  email: '',
  password: '',
  role: '',
  branch: ''
})

const fetchWarehouses = async () => {
  try {
    const res = await frappeApi.get('/api/resource/Warehouse', {
      params: { 
        fields: JSON.stringify(['name', 'warehouse_name']),
        limit_page_length: 999
      }
    })
    if (res.data?.data) warehouseList.value = res.data.data
  } catch (e) {
    console.error('Failed to load warehouses', e)
  }
}

const fetchStaff = async () => {
  try {
    const res = await frappeApi.get('/api/resource/User', {
      params: {
        fields: JSON.stringify(['name', 'email', 'full_name']),
        filters: JSON.stringify([['enabled', '=', 1]]),
        limit_page_length: 999
      }
    })
    
    if (res.data?.data) {
      const users = res.data.data
      

      
      let roleMap = {}
      let branchMap = {}
      try {
        const userDetailPromises = users.map(u => frappeApi.get(`/api/resource/User/${u.name}`));
        const userDetailsRes = await Promise.all(userDetailPromises);
        
        userDetailsRes.forEach(res => {
          if (res.data?.data) {
            const ud = res.data.data;
            roleMap[ud.name] = ud.roles ? ud.roles.map(r => r.role) : [];
            branchMap[ud.name] = ud.location || '';
          }
        });
      } catch (err) {
        console.warn('Failed to fetch individual User Roles and Location', err)
      }
      
      staffList.value = users.map(u => {
        let bestRole = ''
        const roles = roleMap[u.name] || []
        if (roles.includes('System Manager')) bestRole = 'System Manager'
        else if (roles.includes('Branch Manager')) bestRole = 'Branch Manager'
        else if (roles.includes('Branch Clerk')) bestRole = 'Branch Clerk'
        else if (u.name === 'Administrator') bestRole = 'System Manager'
        
        return {
          ...u,
          branch: branchMap[u.name] || '',
          role: bestRole
        }
      })
    }
  } catch (e) {
    console.error('Failed to load staff', e)
  }
}

const openModal = () => {
  isEditing.value = false
  form.value = { full_name: '', email: '', password: '', role: '', branch: '' }
  isModalOpen.value = true
}

const closeModal = () => {
  isModalOpen.value = false
}

const editUser = (user) => {
  isEditing.value = true
  form.value = {
    full_name: user.full_name,
    email: user.email,
    password: '',
    role: user.role,
    branch: user.branch
  }
  isModalOpen.value = true
}

const saveUser = async () => {
  if (isSaving.value) return;
  isSaving.value = true;
  
  try {
    const userEmail = form.value.email;
    
    // 1. Fetch existing roles so we don't overwrite unrelated roles (like Employee, etc.)
    let existingRoles = [];
    if (isEditing.value) {
      try {
        const currentUserRes = await frappeApi.get(`/api/resource/User/${userEmail}`);
        if (currentUserRes.data?.data?.roles) {
           existingRoles = currentUserRes.data.data.roles.map(r => r.role);
        }
      } catch (e) {
        console.warn('Could not fetch existing roles', e);
      }
    }
    
    // 2. Filter out the roles managed by this POS
    const managedRoles = ['System Manager', 'Branch Manager', 'Branch Clerk', 'Stock Manager', 'Sales Manager'];
    let finalRoles = existingRoles.filter(r => !managedRoles.includes(r));
    
    // 3. Add the newly selected role
    finalRoles.push(form.value.role);
    
    // 4. Automatically append necessary backend roles for Branch staff
    if (form.value.role === 'Branch Manager' || form.value.role === 'Branch Clerk') {
      finalRoles.push('Stock Manager', 'Sales Manager');
    }
    
    // Remove duplicates
    finalRoles = [...new Set(finalRoles)];
    
    const userPayload = {
      first_name: form.value.full_name,
      middle_name: '',
      last_name: '',
      location: form.value.branch || '',
      roles: finalRoles.map(r => ({ role: r }))
    };
    
    if (isEditing.value) {
      // Update existing user
      await frappeApi.put(`/api/resource/User/${userEmail}`, userPayload);
    } else {
      // Create new user
      userPayload.email = userEmail;
        userPayload.send_welcome_email = 0;
        userPayload.new_password = form.value.password;
        await frappeApi.post('/api/resource/User', userPayload);

        // Create corresponding Sales Person
        try {
          const spRes = await frappeApi.post('/api/resource/Sales Person', {
            sales_person_name: form.value.full_name,
            enabled: 1,
            custom_branch: form.value.branch || ''
          });
          if (spRes.data?.data?.name) {
            try {
              await frappeApi.put(/api/resource/Sales Person/, { docstatus: 1 });
            } catch(e) {}
          }
        } catch(e) {
          console.warn('Sales Person creation failed:', e);
        }
    }
    
    alert(isEditing.value ? t('staff.msg_save_success_edit') : t('staff.msg_save_success_add'));
    closeModal();
    fetchStaff();
  } catch (error) {
    console.error('Save error', error);
    alert(t('staff.msg_save_err'));
  } finally {
    isSaving.value = false;
  }
}

const getRoleBadgeClass = (role) => {
  if (role === 'System Manager') return 'badge-admin'
  if (role === 'Branch Manager') return 'badge-manager'
  if (role === 'Branch Clerk') return 'badge-clerk'
  return 'badge-none'
}

onMounted(() => {
  fetchWarehouses()
  fetchStaff()
})
</script>

<style scoped>
.staff-management-container {
  padding: 20px;
  background: white;
  border-radius: 8px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-actions h2 {
  margin: 0;
  color: #1e293b;
  font-size: 20px;
}

.add-btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
}

.add-btn:hover { background: #2563eb; }

.table-container {
  flex: 1;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.staff-table {
  width: 100%;
  border-collapse: collapse;
}

.staff-table th, .staff-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.staff-table th {
  background: #f8fafc;
  font-weight: bold;
  color: #475569;
  position: sticky;
  top: 0;
}

.edit-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  color: #475569;
}

.edit-btn:hover { background: #e2e8f0; }

.badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
}
.badge-admin { background: #fef2f2; color: #ef4444; border: 1px solid #fca5a5; }
.badge-manager { background: #f0fdf4; color: #22c55e; border: 1px solid #86efac; }
.badge-clerk { background: #f0f9ff; color: #3b82f6; border: 1px solid #93c5fd; }
.badge-none { background: #f1f5f9; color: #94a3b8; }

.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 24px;
  border-radius: 8px;
  width: 400px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
}

.modal-content h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #1e293b;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: bold;
  color: #475569;
  margin-bottom: 5px;
}

.form-group input, .form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  box-sizing: border-box;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}

.cancel-btn {
  padding: 8px 16px;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  cursor: pointer;
}

.save-btn {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
.save-btn:disabled { background: #94a3b8; cursor: not-allowed; }
</style>



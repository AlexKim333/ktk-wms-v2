<template>
  <div class="adj-list-container">
    <div class="header-actions">
      <h2>{{ $t('stock_adj.title') }}</h2>
      <button class="btn-primary" @click="$emit('new-adjustment')">
        {{ $t('stock_adj.btn_new') }}
      </button>
    </div>

    <div class="filters-bar">
      <div class="search-input-wrapper">
        <span class="icon">🔍</span>
        <input 
          type="text" 
          v-model="searchQuery" 
          :placeholder="$t('stock_adj.search_placeholder')" 
        />
      </div>
      <div class="filter-tabs">
        <button :class="{ active: filterStatus === 'All' }" @click="filterStatus = 'All'">{{ $t('stock_adj.filter_all') }}</button>
        <button :class="{ active: filterStatus === 'Draft' }" @click="filterStatus = 'Draft'">{{ $t('stock_adj.filter_draft') }}</button>
        <button :class="{ active: filterStatus === 'Submitted' }" @click="filterStatus = 'Submitted'">{{ $t('stock_adj.filter_submitted') }}</button>
      </div>
    </div>

    <div class="table-container">
      <table class="adj-table">
        <thead>
          <tr>
            <th>{{ $t('stock_adj.col_adj_no') }}</th>
            <th>{{ $t('stock_adj.col_date') }}</th>
            <th>{{ $t('stock_adj.col_location') }}</th>
            <th>{{ $t('stock_adj.col_type') }}</th>
            <th>{{ $t('stock_adj.col_status') }}</th>
            <th>{{ $t('stock_adj.col_reason') }}</th>
            <th>{{ $t('stock_adj.col_created_by') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="adj in filteredAdjustments" 
            :key="adj.name"
            @click="$emit('edit-adjustment', adj.name)"
            class="clickable-row"
          >
            <td class="text-blue font-bold">{{ adj.name }}</td>
            <td>{{ formatDate(adj.posting_date) }}</td>
            <td>{{ adj.set_warehouse || $t('stock_adj.multiple') }}</td>
            <td><span class="badge type-badge">{{ $t('stock_adj.type_stock_count') }}</span></td>
            <td>
              <span class="badge status-badge" :class="adj.docstatus === 0 ? 'draft' : 'submitted'">
                {{ adj.docstatus === 0 ? $t('stock_adj.status_draft') : $t('stock_adj.status_submitted') }}
              </span>
            </td>
            <td>{{ adj.purpose === 'Correction' ? $t('stock_adj.reason_correction') : (adj.purpose === 'Damage' ? $t('stock_adj.reason_damage') : (adj.purpose === 'Theft' ? $t('stock_adj.reason_theft') : adj.purpose)) || $t('stock_adj.reason_correction') }}</td>
            <td>{{ adj.owner }}</td>
          </tr>
          <tr v-if="filteredAdjustments.length === 0">
            <td colspan="7" class="empty-state">{{ $t('stock_adj.empty_list') }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const emit = defineEmits(['new-adjustment', 'edit-adjustment'])

const frappeApi = axios.create({
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  withCredentials: true
})

const adjustments = ref([])
const searchQuery = ref('')
const filterStatus = ref('All')

const fetchAdjustments = async () => {
  try {
    // Frappe Stock Reconciliation 리스트 호출
    const res = await frappeApi.get('/api/resource/Stock Reconciliation', {
      params: {
        fields: JSON.stringify(['name', 'posting_date', 'purpose', 'docstatus', 'owner']),
        order_by: 'modified desc',
        limit_page_length: 100
      }
    })
    adjustments.value = res.data.data || []
  } catch (error) {
    console.error('Failed to fetch stock adjustments:', error)
  }
}

onMounted(() => {
  fetchAdjustments()
})

const filteredAdjustments = computed(() => {
  let list = adjustments.value

  if (filterStatus.value === 'Draft') {
    list = list.filter(a => a.docstatus === 0)
  } else if (filterStatus.value === 'Submitted') {
    list = list.filter(a => a.docstatus === 1)
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(a => 
      a.name.toLowerCase().includes(q) || 
      (a.purpose && a.purpose.toLowerCase().includes(q))
    )
  }

  return list
})

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  })
}
</script>

<style scoped>
.adj-list-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  background: #f8fafc;
  height: 100%;
  overflow: hidden;
}

.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.header-actions h2 {
  margin: 0;
  color: #1e293b;
  font-size: 24px;
}

.btn-primary {
  background: #0ea5e9;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}
.btn-primary:hover {
  background: #0284c7;
}

.filters-bar {
  display: flex;
  gap: 15px;
  align-items: center;
  background: white;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 6px 12px;
  flex: 1;
  max-width: 400px;
}

.search-input-wrapper input {
  border: none;
  background: transparent;
  width: 100%;
  padding-left: 8px;
  outline: none;
  font-size: 14px;
}

.filter-tabs {
  display: flex;
  background: #f1f5f9;
  border-radius: 6px;
  padding: 4px;
}

.filter-tabs button {
  border: none;
  background: transparent;
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 13px;
  color: #64748b;
  cursor: pointer;
  font-weight: 500;
}

.filter-tabs button.active {
  background: white;
  color: #0f172a;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.table-container {
  flex: 1;
  background: white;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  overflow-y: auto;
}

/* 스크롤바 커스텀 */
.table-container::-webkit-scrollbar { width: 8px; }
.table-container::-webkit-scrollbar-track { background: #f1f5f9; }
.table-container::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

.adj-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.adj-table th, .adj-table td {
  padding: 14px 20px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 14px;
  color: #334155;
}

.adj-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #64748b;
  position: sticky;
  top: 0;
  z-index: 2;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.clickable-row {
  cursor: pointer;
  transition: background 0.2s;
}

.clickable-row:hover {
  background: #f1f5f9;
}

.text-blue {
  color: #0ea5e9;
}
.font-bold {
  font-weight: bold;
}

.badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.type-badge {
  background: #dcfce7;
  color: #166534;
}

.status-badge.draft {
  background: #fef9c3;
  color: #854d0e;
}

.status-badge.submitted {
  background: #e0e7ff;
  color: #3730a3;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #94a3b8;
}
</style>

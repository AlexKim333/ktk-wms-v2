<template>
  <div class="shift-history-container">
    <div class="header-actions">
      <h2>{{ $t('branch.shift_history.title') }}</h2>
      <button class="btn-refresh" @click="fetchClosings">{{ $t('branch.shift_history.btn_refresh') }}</button>
    </div>

    <div class="table-wrapper">
      <table class="history-table">
        <thead>
          <tr>
            <th>{{ $t('branch.shift_history.col_no') }}</th>
            <th>{{ $t('branch.shift_history.col_user') }}</th>
            <th>{{ $t('branch.shift_history.col_period_start') }}</th>
            <th>{{ $t('branch.shift_history.col_period_end') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in closings" :key="c.name" class="clickable-row" @click="openDetail(c)">
            <td class="row-id">{{ c.name }}</td>
            <td>{{ c.user }}</td>
            <td>{{ c.period_start_date }}</td>
            <td>{{ c.period_end_date }}</td>
          </tr>
          <tr v-if="!isLoading && closings.length === 0">
            <td colspan="4" style="text-align:center; padding:30px; color:#94a3b8;">{{ $t('branch.shift_history.empty_msg') }}</td>
          </tr>
          <tr v-if="isLoading">
            <td colspan="4" style="text-align:center; padding:30px; color:#94a3b8;">{{ $t('common.loading') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="selectedClosing" class="modal-overlay" @click.self="selectedClosing = null">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ $t('branch.shift_history.modal_title', { name: selectedClosing.name }) }}</h3>
          <button class="close-btn" @click="selectedClosing = null">&times;</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-card">
              <label>{{ $t('branch.shift_history.col_user') }}</label>
              <div class="val">{{ selectedClosing.user }}</div>
            </div>
            <div class="detail-card">
              <label>{{ $t('branch.shift_history.col_period_start') }}</label>
              <div class="val">{{ selectedClosing.period_start_date }}</div>
            </div>
            <div class="detail-card">
              <label>{{ $t('branch.shift_history.col_period_end') }}</label>
              <div class="val">{{ selectedClosing.period_end_date }}</div>
            </div>
          </div>

          <table class="detail-items-table">
            <thead>
              <tr>
                <th>{{ $t('branch.shift_history.modal_col_mode') }}</th>
                <th style="text-align:right;">{{ $t('branch.shift_history.modal_col_opening') }}</th>
                <th style="text-align:right;">{{ $t('branch.shift_history.modal_col_expected') }}</th>
                <th style="text-align:right;">{{ $t('branch.shift_history.modal_col_closing') }}</th>
                <th style="text-align:right;">{{ $t('branch.shift_history.modal_col_diff') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in selectedClosing.payment_reconciliation || []" :key="row.name">
                <td>{{ row.mode_of_payment }}</td>
                <td style="text-align:right;">{{ formatPrice(row.opening_amount) }}</td>
                <td style="text-align:right;">{{ formatPrice(row.expected_amount) }}</td>
                <td style="text-align:right;">{{ formatPrice(row.closing_amount) }}</td>
                <td style="text-align:right;" :class="Number(row.difference) !== 0 ? (Number(row.difference) > 0 ? 'diff-over' : 'diff-short') : ''">
                  {{ formatPrice(row.difference) }}
                </td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top:20px; display:flex; justify-content:flex-end;">
            <button class="btn-secondary" @click="selectedClosing = null">{{ $t('branch.refund.btn_close') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth.js'
import frappeApi from '../../api/frappe.js'
import { formatPrice } from '../../utils/formatPrice.js'
import { posProfileName } from '../../utils/branchPosProfile.js'

const authStore = useAuthStore()

const closings = ref([])
const isLoading = ref(false)
const selectedClosing = ref(null)

const fetchClosings = async () => {
  isLoading.value = true
  try {
    const filters = [['company', '=', 'kecon'], ['docstatus', '=', 1]]
    if (!authStore.isAdmin) {
      const profileName = posProfileName(authStore.user?.branch_name)
      if (profileName) filters.push(['pos_profile', '=', profileName])
    }
    const res = await frappeApi.get('/api/resource/POS Closing Entry', {
      params: {
        fields: JSON.stringify(['name', 'user', 'period_start_date', 'period_end_date']),
        filters: JSON.stringify(filters),
        limit_page_length: 200,
        order_by: 'period_end_date desc'
      }
    })
    closings.value = res.data?.data || []
  } catch (err) {
    console.error('Fetch shift closings error:', err)
  } finally {
    isLoading.value = false
  }
}

const openDetail = async (c) => {
  try {
    const res = await frappeApi.get(`/api/resource/POS Closing Entry/${c.name}`)
    selectedClosing.value = res.data?.data
  } catch (err) {
    console.error('Fetch shift closing detail error:', err)
  }
}

onMounted(() => {
  fetchClosings()
})
</script>

<style scoped>
.shift-history-container { display: flex; flex-direction: column; height: 100%; font-family: var(--sans, sans-serif); background: #f8fafc; padding: 15px; overflow-y: auto; }
.header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
.header-actions h2 { margin: 0; font-size: 20px; color: #0f172a; }
.btn-refresh { padding: 10px 15px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; cursor: pointer; font-weight: bold; color: #475569; }

.table-wrapper { background: white; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.history-table { width: 100%; border-collapse: collapse; text-align: left; }
.history-table th, .history-table td { padding: 12px 15px; border-bottom: 1px solid #e2e8f0; font-size: 13.5px; }
.history-table th { background: #f1f5f9; font-weight: bold; color: #475569; }
.clickable-row { cursor: pointer; transition: background-color 0.2s; }
.clickable-row:hover { background-color: #f8fafc; }
.row-id { color: #3b82f6; font-weight: bold; text-decoration: underline; }

.modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 20px; backdrop-filter: blur(2px); }
.modal-content { background: white; width: 100%; max-width: 640px; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); display: flex; flex-direction: column; max-height: 90vh; }
.modal-header { padding: 15px 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { margin: 0; font-size: 17px; color: #0f172a; }
.close-btn { background: none; border: none; font-size: 24px; color: #94a3b8; cursor: pointer; padding: 0; line-height: 1; }
.modal-body { padding: 20px; overflow-y: auto; }
.detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 20px; }
.detail-card { background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
.detail-card label { display: block; font-size: 11px; color: #64748b; font-weight: bold; margin-bottom: 4px; }
.val { font-size: 14px; font-weight: bold; color: #334155; }
.detail-items-table { width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #e2e8f0; }
.detail-items-table th, .detail-items-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13px; }
.detail-items-table th { background: #f1f5f9; color: #475569; font-weight: bold; }
.diff-over { color: #059669; font-weight: bold; }
.diff-short { color: #ef4444; font-weight: bold; }
.btn-secondary { background: white; border: 1px solid #cbd5e1; color: #475569; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; }
</style>

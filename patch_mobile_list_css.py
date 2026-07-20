import sys

css_block = """
<style scoped>
/* 예약 내역 모바일 최적화 (카드형 레이아웃) */
.history-table, .history-table tbody, .history-table tr {
  display: block;
  width: 100%;
}
.history-table thead {
  display: none;
}
.history-table tr {
  margin-bottom: 15px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 15px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}
.history-table td {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: none;
  padding: 8px 0;
  border-bottom: 1px dashed #e2e8f0;
}
.history-table td:last-child {
  border-bottom: none;
  justify-content: center;
  margin-top: 10px;
}
.history-table td::before {
  content: attr(data-label);
  font-weight: bold;
  color: #64748b;
  font-size: 0.85rem;
  width: 35%;
  text-align: left;
}
.history-table td.action-cell::before { display: none; }
.filters {
  flex-direction: column !important;
  align-items: stretch !important;
}
.filter-item {
  width: 100%;
  margin-bottom: 10px;
}
.modal-content {
  width: 95% !important;
  padding: 15px !important;
  max-height: 90vh;
  overflow-y: auto;
}
</style>
"""

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # check if already added
    if "<style scoped>" not in content:
        content += css_block

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

patch_file('src/components/branch/mobile/MobileBranchTransferReservationList.vue')

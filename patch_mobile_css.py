import sys
import re

css_block = """
<style scoped>
/* 모바일 최적화 레이아웃 오버라이드 */
.workspace-body {
  flex-direction: column !important;
  height: auto !important;
  overflow: visible !important;
}
.workspace-left, .workspace-right {
  width: 100% !important;
  height: auto !important;
  max-height: none !important;
  border-right: none !important;
}
.workspace-left {
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 20px;
}
/* Quick Pick 그리드를 2열로 조정 */
.grid-3x4 {
  grid-template-columns: repeat(2, 1fr) !important;
  grid-template-rows: auto !important;
}
/* 카드형 장바구니 테이블 변환 */
.pos-cart-table, .pos-cart-table tbody, .pos-cart-table tr {
  display: block;
  width: 100%;
}
.pos-cart-table thead {
  display: none;
}
.pos-cart-table tr {
  margin-bottom: 15px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 10px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}
.pos-cart-table td {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: none;
  padding: 8px 0;
  border-bottom: 1px dashed #e2e8f0;
}
.pos-cart-table td:last-child {
  border-bottom: none;
}
.pos-cart-table td::before {
  content: attr(data-label);
  font-weight: bold;
  color: #64748b;
  font-size: 0.85rem;
  width: 30%;
  text-align: left;
}
.pos-cart-table td.product-cell {
  flex-direction: column;
  align-items: flex-start;
  background: #f8fafc;
  padding: 10px;
  border-radius: 6px;
  margin-bottom: 5px;
  border-bottom: none;
}
.pos-cart-table td.product-cell::before { display: none; }
.pos-cart-table td.delete-cell {
  justify-content: flex-end;
}
.pos-cart-table td.delete-cell::before { display: none; }
.input-green input {
  width: 120px !important;
  text-align: right;
  padding: 8px !important;
  font-size: 1rem !important;
}
</style>
"""

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add data-label to table cells
    content = content.replace('<td class="input-green">\n                    <input type="text" inputmode="numeric" pattern="[0-9]*" v-model.number="item.input_box"', '<td class="input-green" data-label="박스">\n                    <input type="text" inputmode="numeric" pattern="[0-9]*" v-model.number="item.input_box"')
    content = content.replace('<td class="input-green">\n                    <input type="text" inputmode="numeric" pattern="[0-9]*" v-model.number="item.input_each"', '<td class="input-green" data-label="낱개">\n                    <input type="text" inputmode="numeric" pattern="[0-9]*" v-model.number="item.input_each"')
    
    # Check if style scoped is already there
    if "<style scoped>" not in content:
        content += css_block

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

patch_file('src/components/branch/mobile/MobileBranchPosView.vue')
patch_file('src/components/branch/mobile/MobileBranchTransferView.vue')

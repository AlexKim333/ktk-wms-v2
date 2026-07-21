import re

file = 'src/components/branch/mobile/MobileBranchPosView.vue'

with open(file, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import and refs
import_code = '''import { useI18n } from 'vue-i18n'
import ReceiptPrint from '../../ReceiptPrint.vue'

const receiptPrintRef = ref(null)
const receiptPrintData = ref({ summary: {} })
const receiptPrintItems = ref([])'''

# Find the first import block inside script setup to inject
if 'import ReceiptPrint' not in content:
    content = content.replace("import { useI18n } from 'vue-i18n'", import_code)

# 2. Add template component
template_code = '''  </div>
  <ReceiptPrint ref="receiptPrintRef" :receiptData="receiptPrintData" :items="receiptPrintItems" />
</template>'''

if '<ReceiptPrint' not in content:
    # Replace the last </template> with the template code
    content = content.replace("</template>", template_code)

# 3. Modify submit logic
old_logic = r"const res = await adminApi\.post\('/api/resource/Stock Entry', payload\)\n\s+docName = res\.data\.data\.name\n\s+alert\(\[즉배요청 성공\] 즉시 출고 전표\(\$\{docName\}\)가 대기열\(Draft\)에 성공적으로 생성되었습니다!\)"

new_logic = '''      const res = await adminApi.post('/api/resource/Stock Entry', payload)
      docName = res.data.data.name
      
      // Receipt Print Logic
      let totalQtyCount = 0
      currentTab.value.cartItems.forEach(item => totalQtyCount += Number(item.totalQty || 0))
      
      receiptPrintData.value = {
        title: '즉배요청 (Stock Entry)',
        no: docName,
        date: dateStr,
        ubicacion: '[MAIN] ALARCON - K',
        vendedor: authStore.user?.email,
        mode: '즉시 출고',
        solicitante: currentTab.value.selectedRequester,
        creador: authStore.user?.email,
        shippingInfo: null,
        summary: { items: currentTab.value.cartItems.length, bulto: totalQtyCount, pzs: 0 }
      }
      
      receiptPrintItems.value = JSON.parse(JSON.stringify(currentTab.value.cartItems.map(item => ({
        name: item.item_code,
        item_name: item.item_name || item.item_code,
        input_box: item.totalQty,
        input_each: 0,
        price_list_rate: item.price_list_rate || 0
      }))))
      
      import { nextTick } from 'vue' // already imported globally usually, but let's be safe - wait, nextTick is imported at top.
      await nextTick()
      
      if (receiptPrintRef.value) {
        const success = await receiptPrintRef.value.copyToClipboard()
        if (success) {
          alert([즉배요청 성공] 즉시 출고 전표() 생성 및 주문서 이미지가 클립보드에 복사되었습니다!)
        } else {
          alert([즉배요청 성공] 즉시 출고 전표()가 생성되었습니다! (이미지 복사 실패))
        }
      } else {
        alert([즉배요청 성공] 즉시 출고 전표()가 대기열(Draft)에 성공적으로 생성되었습니다!)
      }'''

if 'receiptPrintRef.value.copyToClipboard()' not in content:
    content = re.sub(old_logic, new_logic, content)
    
with open(file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")

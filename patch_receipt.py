import re

files = [
    'src/components/branch/BranchTransferView.vue',
    'src/components/branch/mobile/MobileBranchPosView.vue',
    'src/components/branch/mobile/MobileBranchTransferView.vue'
]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add nextTick to vue import
    if 'nextTick' not in content:
        content = re.sub(r"import \{([^}]+)\} from 'vue'", r"import {\1, nextTick} from 'vue'", content)

    # 1. Add import and refs
    if 'import ReceiptPrint' not in content:
        if 'mobile' in file:
            import_code = "import ReceiptPrint from '../../ReceiptPrint.vue'\n\nconst receiptPrintRef = ref(null)\nconst receiptPrintData = ref({ summary: {} })\nconst receiptPrintItems = ref([])\n"
        else:
            import_code = "import ReceiptPrint from '../ReceiptPrint.vue'\n\nconst receiptPrintRef = ref(null)\nconst receiptPrintData = ref({ summary: {} })\nconst receiptPrintItems = ref([])\n"
        
        content = re.sub(r"(import \{.*?\} from 'vue'.*?\n)", r"\1" + import_code, content, count=1)

    # 2. Add template component
    if '<ReceiptPrint' not in content:
        # Find the last </template>
        last_template_idx = content.rfind('</template>')
        if last_template_idx != -1:
            content = content[:last_template_idx] + '  <ReceiptPrint ref="receiptPrintRef" :receiptData="receiptPrintData" :items="receiptPrintItems" />\n</template>' + content[last_template_idx + 11:]

    # 3. Modify submit logic
    old_logic = r"const res = await adminApi\.post\('/api/resource/Stock Entry', payload\)\n\s+docName = res\.data\.data\.name\n\s+alert\(\[즉배요청 성공\].*?생성되었습니다!\)"

    new_logic = '''      const res = await adminApi.post('/api/resource/Stock Entry', payload)
      docName = res.data.data.name
      
      let totalQtyCount = 0
      currentTab.value.cartItems.forEach(item => totalQtyCount += Number(item.totalQty || 0))
      
      receiptPrintData.value = {
        title: '즉배요청 (Stock Entry)',
        no: docName,
        date: dateStr,
        ubicacion: authStore.user?.branch_name,
        vendedor: currentTab.value.selectedRequester || authStore.user?.email,
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
      
      await nextTick()
      if (receiptPrintRef.value) {
        const success = await receiptPrintRef.value.copyToClipboard()
        if (success) {
          alert([즉배요청 성공] 즉시 출고 전표() 생성 및 주문서 이미지가 클립보드에 복사되었습니다!)
        } else {
          alert([즉배요청 성공] 즉시 출고 전표()가 대기열(Draft)에 성공적으로 생성되었습니다! (이미지 복사 실패))
        }
      } else {
        alert([즉배요청 성공] 즉시 출고 전표()가 대기열(Draft)에 성공적으로 생성되었습니다!)
      }'''

    if 'receiptPrintRef.value.copyToClipboard()' not in content:
        content = re.sub(old_logic, new_logic, content)
        
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

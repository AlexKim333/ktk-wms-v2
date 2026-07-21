import re

files = [
    'src/components/branch/BranchTransferView.vue',
    'src/components/branch/mobile/MobileBranchTransferView.vue'
]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the block inside if (orderType.value === 'immediate') { up to } else {
    pattern = r"(if \(orderType\.value === 'immediate'\) \{[\s\S]*?const res = await adminApi\.post\('/api/resource/Stock Entry', payload\)\n\s+docName = res\.data\.data\.name\n\s+alert\(\[즉배요청 성공\] 즉시 출고 전표\(\$\{docName\}\)가 대기열\(Draft\)에 성공적으로 생성되었습니다!\)\n\s+)(?=\} else \{)"
    
    match = re.search(pattern, content)
    if match:
        old_block = match.group(0)
        
        # Replace the const res... alert(...) part
        replace_target = r"const res = await adminApi\.post\('/api/resource/Stock Entry', payload\)\n\s+docName = res\.data\.data\.name\n\s+alert\(\[즉배요청 성공\] 즉시 출고 전표\(\$\{docName\}\)가 대기열\(Draft\)에 성공적으로 생성되었습니다!\)\n\s+"
        
        new_logic = '''const res = await adminApi.post('/api/resource/Stock Entry', payload)
      docName = res.data.data.name
      
      let totalQtyCount = 0
      currentTab.value.cartItems.forEach(item => totalQtyCount += Number(item.totalQty || 0))
      
      receiptPrintData.value = {
        title: '즉배요청 (Stock Entry)',
        no: docName,
        date: dateStr,
        ubicacion: authStore.user?.branch_name || '[MAIN] ALARCON - K',
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
          alert([즉배요청 성공] 즉시 출고 전표() 생성 및 주문서 이미지가 기기에 저장되었습니다! (클립보드 또는 갤러리))
        } else {
          alert([즉배요청 성공] 즉시 출고 전표()가 대기열(Draft)에 성공적으로 생성되었습니다! (이미지 복사 실패))
        }
      } else {
        alert([즉배요청 성공] 즉시 출고 전표()가 대기열(Draft)에 성공적으로 생성되었습니다!)
      }
    '''
        
        new_block = re.sub(replace_target, new_logic, old_block)
        content = content.replace(old_block, new_block)
        
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
            print(f"Patched {file}")
    else:
        print(f"Pattern not found in {file}")


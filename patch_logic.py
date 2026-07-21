import re

files = [
    'src/components/branch/mobile/MobileBranchPosView.vue',
    'src/components/branch/mobile/MobileBranchTransferView.vue'
]

old_logic = '''    const payload = {
      doctype: 'Material Request',
      material_request_type: 'Material Transfer',
      set_from_warehouse: '[MAIN] ALARCON - K',
      set_warehouse: authStore.user?.branch_name,
      schedule_date: dateStr,
      docstatus: 1, // 제출(Submit) 상태로 생성
      owner: currentTab.value.selectedCreator || authStore.user?.email, // 작성자 강제 지정
      custom_branch: authStore.user?.branch_name,
      custom_orderer: currentTab.value.selectedRequester,
      custom_approval_stage: isClerk ? '점원 요청' : '지점장 승인',
      items: currentTab.value.cartItems.map(item => ({
        item_code: item.item_code,
        qty: item.totalQty,
        s_warehouse: '[MAIN] ALARCON - K',
        t_warehouse: authStore.user?.branch_name,
        uom: item.uom || 'Nos',
        conversion_factor: 1
      }))
    }

    const res = await adminApi.post('/api/resource/Material Request', payload)
    const docName = res.data.data.name
    
    alert([성공 제출] 지점간 이동 요청()이 성공적으로 대기(Pending) 상태로 전송되었습니다!)'''

# I need a flexible regex because of emojis and Korean characters that might have encoding quirks
regex = r"const payload = \{.*?\n\s+doctype: 'Material Request',.*?\n\s+items:.*?\}\)\)\n\s+\}\n\n\s+const res = await adminApi\.post\('/api/resource/Material Request', payload\)\n\s+const docName = res\.data\.data\.name\n\s+alert\(\[.*?\] .*?\(\)"

new_logic = '''    let docName = ''

    if (orderType.value === 'immediate') {
      const payload = {
        doctype: 'Stock Entry',
        docstatus: 0, // Draft 상태로 생성
        stock_entry_type: 'Material Transfer',
        from_warehouse: '[MAIN] ALARCON - K',
        to_warehouse: authStore.user?.branch_name,
        custom_ordering_branch: authStore.user?.branch_name,
        custom_orderer: currentTab.value.selectedRequester,
        items: currentTab.value.cartItems.map(item => ({
          item_code: item.item_code,
          qty: item.totalQty,
          s_warehouse: '[MAIN] ALARCON - K',
          t_warehouse: authStore.user?.branch_name,
          uom: item.uom || 'Nos',
          conversion_factor: 1,
          allow_zero_valuation_rate: 1
        }))
      }
      const res = await adminApi.post('/api/resource/Stock Entry', payload)
      docName = res.data.data.name
      alert([즉배요청 성공] 즉시 출고 전표()가 대기열(Draft)에 성공적으로 생성되었습니다!)
    } else {
      const payload = {
        doctype: 'Material Request',
        material_request_type: 'Material Transfer',
        set_from_warehouse: '[MAIN] ALARCON - K',
        set_warehouse: authStore.user?.branch_name,
        schedule_date: dateStr,
        docstatus: 1, // 제출(Submit) 상태로 생성하여 Pending으로 넘김
        owner: currentTab.value.selectedCreator || authStore.user?.email, // 작성자 강제 지정
        custom_branch: authStore.user?.branch_name,
        custom_orderer: currentTab.value.selectedRequester,
        custom_approval_stage: isClerk ? '점원 요청' : '지점장 승인',
        items: currentTab.value.cartItems.map(item => ({
          item_code: item.item_code,
          qty: item.totalQty,
          s_warehouse: '[MAIN] ALARCON - K',
          t_warehouse: authStore.user?.branch_name,
          uom: item.uom || 'Nos',
          conversion_factor: 1
        }))
      }
      const res = await adminApi.post('/api/resource/Material Request', payload)
      docName = res.data.data.name
      alert([예약 성공] 예약 요청()이 보류(Pending) 상태로 성공적으로 전송되었습니다!)
    }'''

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Fallback exact string replace if possible
    # We will just replace everything between 'const payload = {' and 'alert(...'
    match = re.search(r"const payload = \{[\s\S]*?const docName = res\.data\.data\.name\n\s+alert\([\s\S]*?\)", content)
    if match:
        content = content.replace(match.group(0), new_logic)
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Patched {file}")
    else:
        print(f"Failed to match in {file}")


import re

file = 'src/components/branch/BranchTransferView.vue'

try:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add UI Radio buttons
    old_action_block = '''<template v-else>
            <button class="btn-outbound-reserve" style="background: #475569; color: white; border: none; padding: 15px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 15px; transition: 0.2s;" @click="clearCart">
              장바구니 비우기
            </button>
            <button class="btn-final-submit" style="background: #00a896; color: white; border: none; padding: 15px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 15px; transition: 0.2s;" @click="submitTransfer" :disabled="currentTab.cartItems.length === 0 || isSubmitting">
              {{ isSubmitting ? '전송 중...' : (isClerk ? '점원 요청 (1차)' : 'DRAFT 즉시 발행 (지점장)') }}
            </button>
          </template>'''
          
    new_action_block = '''<template v-else>
            <div style="grid-column: 1 / -1; display: flex; justify-content: center; gap: 20px; padding-bottom: 10px;">
              <label style="font-size: 15px; font-weight: bold; color: #334155; display: flex; align-items: center; gap: 5px;">
                <input type="radio" v-model="orderType" value="reservation" style="transform: scale(1.2);"> 예약 (단일품목 대량)
              </label>
              <label style="font-size: 15px; font-weight: bold; color: #334155; display: flex; align-items: center; gap: 5px;">
                <input type="radio" v-model="orderType" value="immediate" style="transform: scale(1.2);"> 즉배요청 (즉시 출고)
              </label>
            </div>
            <button class="btn-outbound-reserve" style="background: #475569; color: white; border: none; padding: 15px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 15px; transition: 0.2s;" @click="clearCart">
              비우기
            </button>
            <button class="btn-final-submit" style="background: #00a896; color: white; border: none; padding: 15px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 15px; transition: 0.2s;" @click="submitTransfer" :disabled="currentTab.cartItems.length === 0 || isSubmitting">
              주문요청
            </button>
          </template>'''
    
    # We might need to match with some unicode weirdness, so we use a flexible regex for the template part if exact match fails
    if "btn-outbound-reserve" in content and "btn-final-submit" in content and "DRAFT" in content:
        # fallback string replace using regex since the encoding might have scrambled some korean characters
        match = re.search(r"<template v-else>\s*<button class=\"btn-outbound-reserve\".*?</template>", content, re.DOTALL)
        if match:
            content = content.replace(match.group(0), new_action_block)
            
    # Add orderType ref
    if "const orderType = ref('immediate')" not in content:
        content = content.replace("const pendingDraftCount = ref(0)", "const pendingDraftCount = ref(0)\nconst orderType = ref('immediate')")

    # 2. Patch logic
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
        owner: currentTab.value.selectedCreator || authStore.user?.email,
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

    match = re.search(r"const payload = \{[\s\S]*?const docName = res\.data\.data\.name\n\s+alert\([\s\S]*?\)", content)
    if match:
        content = content.replace(match.group(0), new_logic)
        
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Patched {file}")
except Exception as e:
    print(f"Failed to patch: {e}")

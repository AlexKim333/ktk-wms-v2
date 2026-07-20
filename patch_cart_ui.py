import re

files = [
    'src/components/branch/mobile/MobileBranchPosView.vue',
    'src/components/branch/mobile/MobileBranchTransferView.vue'
]

for filepath in files:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # 1. Remove tabs-control-header
        content = re.sub(r'<!-- 탭 컨트롤 헤더.*?</div>\s*</div>\s*</div>', '', content, flags=re.DOTALL)
        
        # 2. Remove pos-cart-header
        content = re.sub(r'<!-- 우측 상단 정보 영역 \(2x2 그리드\).*?</div>\s*</div>\s*</div>', '', content, flags=re.DOTALL)

        # 3. Clean up summary labels
        content = content.replace(
            '📦 박스 총 갯수: <strong style="font-size: 16px; color: #3b82f6; margin-left: 4px;">{{ totalBoxCount }} 상자</strong>',
            '📦 <strong style="font-size: 16px; color: #3b82f6; margin-left: 4px;">{{ totalBoxCount }}</strong>'
        )
        content = content.replace(
            '🔢 낱장 총 갯수: <strong style="font-size: 16px; color: #3b82f6; margin-left: 4px;">{{ totalEachCount }} 개</strong>',
            '🔢 <strong style="font-size: 16px; color: #3b82f6; margin-left: 4px;">{{ totalEachCount }}</strong>'
        )
        
        # 4. Rename '장바구니 비우기' -> '비우기'
        content = content.replace('장바구니 비우기', '비우기')
        
        # 5. Add orderType radio buttons and change submit button text
        # Find the action-btn-double-group template block for non-drafts
        old_action_block = '''<template v-else>
            <button class="btn-outbound-reserve" style="background: #475569; color: white; border: none; padding: 15px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 15px; transition: 0.2s;" @click="clearCart">
              비우기
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
          
        if old_action_block in content:
            content = content.replace(old_action_block, new_action_block)
            
        # Add orderType ref to script setup
        if "const orderType = ref('immediate')" not in content:
            content = content.replace(
                "const pendingDraftCount = ref(0)",
                "const pendingDraftCount = ref(0)\nconst orderType = ref('immediate')"
            )

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
            
        print(f'Patched {filepath}')
    except Exception as e:
        print(f'Failed {filepath}: {e}')

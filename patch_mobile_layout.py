import re

files = [
    'src/components/branch/mobile/MobileBranchPosView.vue',
    'src/components/branch/mobile/MobileBranchTransferView.vue'
]

for filepath in files:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # 1. Add mobileMode ref
        if "const mobileMode = ref('search')" not in content:
            content = content.replace(
                "const currentTabIndex = ref(0)",
                "const currentTabIndex = ref(0)\nconst mobileMode = ref('search')"
            )

        # 2. Update workspace-body flex-direction
        content = content.replace(
            '<div class="workspace-body branch-pos" style="padding: 15px; gap: 15px; background: #f8fafc;">',
            '<div class="workspace-body branch-pos" style="padding: 15px; gap: 15px; background: #f8fafc; flex-direction: column;">'
        )

        # 3. Insert mobile-tabs and hide/show panes
        # First, check if tabs already inserted
        if 'class="mobile-tabs"' not in content:
            tabs_html = '''
    <!-- 모바일 모드 탭 -->
    <div class="mobile-tabs" style="display: flex; gap: 10px;">
      <button :class="['m-tab-btn', { active: mobileMode === 'search' }]" @click="mobileMode = 'search'" style="flex:1; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; background: white; font-weight: bold; color: #475569;">
        🔍 상품 검색
      </button>
      <button :class="['m-tab-btn', { active: mobileMode === 'cart' }]" @click="mobileMode = 'cart'" style="flex:1; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; background: white; font-weight: bold; color: #475569;">
        🛒 장바구니 ({{ currentTab?.cartItems?.length || 0 }})
      </button>
    </div>
'''
            # insert tabs after workspace-body
            content = content.replace(
                '<div class="workspace-body branch-pos" style="padding: 15px; gap: 15px; background: #f8fafc; flex-direction: column;">',
                '<div class="workspace-body branch-pos" style="padding: 15px; gap: 15px; background: #f8fafc; flex-direction: column;">' + tabs_html
            )
            
            # wrap workspace-left
            content = content.replace(
                '<div class="workspace-left" style="flex: 0.95;',
                '<div v-show="mobileMode === \'search\'" class="workspace-left" style="flex: 1; width: 100%;'
            )
            
            # wrap workspace-right
            content = content.replace(
                '<div class="workspace-right" style="flex: 1.05;',
                '<div v-show="mobileMode === \'cart\'" class="workspace-right" style="flex: 1; width: 100%;'
            )

        # 4. Add m-tab-btn active CSS if not exists
        if '.m-tab-btn.active' not in content:
            content = content.replace(
                '</style>',
                '.m-tab-btn.active { background: #3b82f6 !important; color: white !important; border-color: #2563eb !important; }\n</style>'
            )

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
            
        print(f'Patched {filepath}')
    except Exception as e:
        print(f'Failed {filepath}: {e}')

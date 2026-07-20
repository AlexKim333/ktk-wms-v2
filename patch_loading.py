import glob

files = [
    'src/components/branch/mobile/MobileBranchPosView.vue',
    'src/components/branch/mobile/MobileBranchTransferView.vue',
    'src/components/branch/BranchPosView.vue',
    'src/components/branch/BranchTransferView.vue'
]

for filepath in files:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 1. Fix loading message
        old_msg = '검색 결과가 없습니다.'
        new_msg = '<span v-if=\"!rawItems || rawItems.length === 0\">데이터를 불러오는 중입니다...</span><span v-else>검색 결과가 없습니다.</span>'
        if old_msg in content and '<span v-if' not in content:
            content = content.replace(old_msg, new_msg)
            
        # 2. Fix reactivity issue
        old_comp = 'const filteredItems = computed(() => {\n  const q = searchQuery.value.trim()'
        new_comp = 'const filteredItems = computed(() => {\n  props.rawItems; // 강제 반응성 트리거\n  const q = searchQuery.value.trim()'
        if old_comp in content:
            content = content.replace(old_comp, new_comp)
            
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
            
        print(f'Patched {filepath}')
    except Exception as e:
        print(f'Failed {filepath}: {e}')

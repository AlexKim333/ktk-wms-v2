import glob

files = [
    'src/components/branch/BranchInventoryList.vue',
    'src/views/PosView.vue',
    'src/views/ProductListView.vue',
    'src/views/StockAdjustmentDetailView.vue'
]

for filepath in files:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
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

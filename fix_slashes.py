files = [
    'src/components/branch/BranchTransferView.vue',
    'src/components/branch/mobile/MobileBranchPosView.vue',
    'src/components/branch/mobile/MobileBranchTransferView.vue'
]
for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    content = content.replace('ref=\\"receiptPrintRef\\" :receiptData=\\"receiptPrintData\\" :items=\\"receiptPrintItems\\"', 'ref="receiptPrintRef" :receiptData="receiptPrintData" :items="receiptPrintItems"')
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)

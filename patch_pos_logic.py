import sys

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Change purpose
    content = content.replace("purpose: 'Material Transfer',", "purpose: 'Material Issue',")
    
    # Remove to_warehouse mapping for payload
    content = content.replace("to_warehouse: targetWarehouse.value,", "// to_warehouse omitted for Material Issue")
    
    # Text replacements
    content = content.replace("재고 이동 전표 발행", "출고 전표 발행")
    content = content.replace("재고이동 예약 등록", "출고 예약 등록")
    content = content.replace("도착지(창고)", "출고 대상(고객/지점)")
    content = content.replace("재고이동요청자", "담당자")
    content = content.replace("재고이동", "출고(판매)")
    
    # Custom fields mapping
    content = content.replace("custom_orderer: clerkName.value", "custom_orderer: clerkName.value,\n      custom_customer: targetWarehouse.value")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

patch_file('src/components/branch/mobile/MobileBranchPosView.vue')

import re

files = [
    'src/components/branch/BranchTransferView.vue',
    'src/components/branch/mobile/MobileBranchPosView.vue',
    'src/components/branch/mobile/MobileBranchTransferView.vue'
]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the broken alerts and replace them
    content = re.sub(r'alert\(\[즉배요청 성공\].*?생성되었습니다!\)가 대기열\(Draft\)에 성공적으로 생성되었습니다!\)', 'alert([즉배요청 성공] 즉시 출고 전표()가 대기열(Draft)에 성공적으로 생성되었습니다!)', content)
    content = re.sub(r'alert\(\[예약 성공\].*?전송되었습니다!\)가 보류\(Pending\) 상태로 성공적으로 전송되었습니다!\)', 'alert([예약 성공] 예약 요청()이 보류(Pending) 상태로 성공적으로 전송되었습니다!)', content)

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

import re

files = [
    'src/components/branch/BranchTransferView.vue',
    'src/components/branch/mobile/MobileBranchPosView.vue',
    'src/components/branch/mobile/MobileBranchTransferView.vue'
]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    for i in range(len(lines)):
        if 'alert(' in lines[i] and '대기열(Draft)' in lines[i]:
            lines[i] = '      alert([즉배요청 성공] 즉시 출고 전표()가 대기열(Draft)에 성공적으로 생성되었습니다!)'
        elif 'alert(' in lines[i] and '보류(Pending)' in lines[i]:
            lines[i] = '      alert([예약 성공] 예약 요청()이 보류(Pending) 상태로 성공적으로 전송되었습니다!)'

    with open(file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

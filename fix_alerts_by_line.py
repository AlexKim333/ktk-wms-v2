import re

files = [
    'src/components/branch/BranchTransferView.vue',
    'src/components/branch/mobile/MobileBranchPosView.vue',
    'src/components/branch/mobile/MobileBranchTransferView.vue'
]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the line that has 'alert(' and '대기열(Draft)' and replace the entire line
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'alert(' in line and '대기열(Draft)' in line:
            lines[i] = '      alert([즉배요청 성공] 즉시 출고 전표()가 대기열(Draft)에 성공적으로 생성되었습니다!)'
        elif 'alert(' in line and '보류(Pending)' in line:
            lines[i] = '      alert([예약 성공] 예약 요청()이 보류(Pending) 상태로 성공적으로 전송되었습니다!)'

    with open(file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

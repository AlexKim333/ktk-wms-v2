import sys
path = r'src\views\PosView.vue'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

import re
content = re.sub(r'confirm\(\".*?\"\)', 'confirm(\"진행 중인 예약/전표 수정을 취소하시겠습니까?\\n(확인 시 장바구니가 비워지고 수정이 취소됩니다.)\")', content, count=1, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
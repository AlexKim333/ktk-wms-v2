import sys
path = r'src\views\PosView.vue'
with open(path, 'rb') as f:
    raw = f.read()

# The file is currently saved as UTF-8, but it contains Mojibake.
# This means the original UTF-8 bytes were interpreted as Windows-1252 (or latin-1), 
# and then encoded back to UTF-8.
# Let's decode it as UTF-8, encode as latin-1 to get the original bytes, and decode as UTF-8 again.

try:
    text = raw.decode('utf-8')
    original_bytes = text.encode('windows-1252')
    fixed_text = original_bytes.decode('utf-8')
    with open('PosView_fixed.vue', 'w', encoding='utf-8') as f:
        f.write(fixed_text)
    print('SUCCESS')
except Exception as e:
    print('ERROR:', e)
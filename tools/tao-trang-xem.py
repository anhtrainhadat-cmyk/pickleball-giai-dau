#!/usr/bin/env python3
"""Sinh trang xem.html (dành cho khán giả, KHÔNG có form bình chọn) từ index.html.
Chạy lại mỗi khi sửa index.html:   python3 tools/tao-trang-xem.py
"""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
s = (root / 'index.html').read_text(encoding='utf-8')

def rep(old, new, count=1):
    global s
    assert old in s, 'Không tìm thấy: ' + old[:60]
    s = s.replace(old, new, count)

# 1. Bỏ khung form bình chọn, chỉ giữ thống kê + danh sách dự đoán
s, n = re.subn(r'\n        <div class="card">\n          <h3>Chọn đội Vô địch, Nhì, Ba</h3>.*?</form>\n        </div>', '', s, flags=re.S)
assert n == 1, 'Không tìm thấy form bình chọn'
rep('<div class="predict-wrap">', '<div class="predict-wrap one">')
rep('<div class="eyebrow">Minigame dành cho khán giả</div><h2 class="display grad-text">Dự đoán trúng thưởng</h2>',
    '<div class="eyebrow">Kết quả bình chọn của khán giả</div><h2 class="display grad-text">Khán giả dự đoán</h2>')
# 2. Nút ở đầu trang & thông tin chia sẻ
rep('🎯 Dự đoán trúng thưởng</a>', '🎯 Xem khán giả dự đoán</a>')
rep('· Dự đoán đội vô địch để nhận quà!', '· Kết quả trực tiếp, bảng xếp hạng, dự đoán vô địch')
rep('<body>', '<body data-mode="xem">')
rep('<a href="https://anhtrainhadat-cmyk.github.io/pickleball-giai-dau/" hidden></a>', '') if 'hidden></a>' in s else None
s = s.replace('<!-- TRANG CHÍNH -->', '')
header = '<!-- File này được sinh tự động từ index.html bằng tools/tao-trang-xem.py — đừng sửa trực tiếp. -->\n'
(root / 'xem.html').write_text(s.replace('<!doctype html>', '<!doctype html>\n' + header, 1), encoding='utf-8')
print('Đã tạo xem.html')

#!/bin/sh
# Đặt lại tham số ?v= cho mọi file js/css trong các trang để trình duyệt tải bản mới
V=$(date -u +%Y%m%d%H%M)
cd "$(dirname "$0")/.." && sed -i -E "s/((js|css)\/[a-z0-9-]+\.(js|css))\?v=[0-9]+/\1?v=$V/g" index.html btc.html noi-bo.html && python3 tools/tao-trang-xem.py && echo "v=$V"

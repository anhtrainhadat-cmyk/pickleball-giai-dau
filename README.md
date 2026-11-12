# ĐÀO97 OPEN — Website giải Pickleball mừng sinh nhật 2 tuổi CLB Đào 97

Giải đồng đội · 21/11/2026 · **Sân Ba Dứa, Hà Nội** · Gala tại Nhà hàng Trống Đồng Linh Đàm.
Trưởng BTC: Dương CT.

🌐 Website: https://anhtrainhadat-cmyk.github.io/pickleball-giai-dau/
🔐 Trang BTC: https://anhtrainhadat-cmyk.github.io/pickleball-giai-dau/btc.html

## Tính năng
**Trang chủ (khán giả)**
- Đầu trang: **dự đoán đội vô địch** tự cập nhật theo kết quả đã nhập và thể lệ giải (mô phỏng các nội dung còn lại). Chưa có kết quả → dự đoán Team 2.
- Bảng xếp hạng trực tiếp (Điều 9), lịch & kết quả 7 vòng, danh sách đội/VĐV.
- **Dự đoán trúng thưởng**: khán giả nhập tên, chọn đội Vô địch – Nhì – Ba, gửi; xem tỉ lệ & dự đoán mới nhất; cuối giải tự đánh dấu người đoán trúng.
- Timeline, thể lệ/điều lệ, giải thưởng, ủng hộ (QR MB Bank), hình ảnh, nhà tài trợ.

**Trang BTC (`btc.html`, cần đăng nhập)**
- Nhập kết quả từng nội dung (lưu tự động, khán giả thấy ngay).
- Đội & VĐV: tên đội, đội trưởng, 8 VĐV (6 nam, 2 nữ), **chấm trình 1-2-3 — chỉ BTC thấy**.
- Quản lý dự đoán: khoá/mở cổng, xoá spam, tải CSV, xem người đoán trúng.

## Kích hoạt hệ thống BTC
Xem [HUONG-DAN-FIREBASE.md](HUONG-DAN-FIREBASE.md) (Firebase miễn phí, ~10 phút).
Khi chưa kích hoạt, web vẫn chạy với dữ liệu tĩnh `data/giai-dau.json`.

## Cấu trúc
| File | Nội dung |
|---|---|
| `index.html`, `js/home.js` | Trang giải cho khán giả |
| `btc.html`, `js/btc.js` | Khu vực BTC |
| `js/core.js` | Lịch vòng tròn, tính điểm, xếp hạng theo Điều 9, dự đoán vô địch |
| `js/store.js` | Kết nối Firebase / dữ liệu tĩnh |
| `js/config.js` | Thông tin giải, sân, giờ, cấu hình Firebase |
| `firestore.rules` | Luật bảo mật (trình VĐV chỉ BTC đọc, khán giả chỉ gửi dự đoán) |
| `img/` | Logo, cúp, backdrop, QR ủng hộ, logo nhà tài trợ |

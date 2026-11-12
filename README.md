# ĐÀO97 OPEN — Website giải Pickleball CLB Đào 97 Hà Nội

Giải đồng đội mừng sinh nhật 2 tuổi CLB Pickleball Đào 97 · 21/11/2026 · Sân Pick Ba Dứa – Nguyễn Xiển.

Website tĩnh (HTML/CSS/JS thuần), chạy **miễn phí** trên GitHub Pages — không cần hosting, không cần domain, không cần database.

## Tính năng
- **Trang chủ**: logo, đếm ngược, timeline chương trình, bảng xếp hạng trực tiếp, điều lệ, giải thưởng, hình ảnh, nhà tài trợ.
- **Trang chi tiết giải**: thông tin, danh sách đội, bảng xếp hạng vòng bảng, nhánh loại trực tiếp, lịch & kết quả. Tự cập nhật mỗi 60 giây khi giải đang diễn ra.
- **Trang ban tổ chức** (`quan-ly.html`):
  - Tạo giải: **đồng đội vòng tròn** (mỗi vòng 4 nội dung, chạm 15, xếp hạng theo Điều 9 điều lệ), vòng tròn, loại trực tiếp, vòng bảng + loại trực tiếp
  - Nhập đội hàng loạt (dán từ Google Sheets), xếp hạt giống, bốc thăm ngẫu nhiên
  - Tự chia bảng, xếp lịch vòng tròn, dựng nhánh đấu (có miễn đấu, tránh đội cùng bảng gặp sớm)
  - Nhập tỉ số → bảng xếp hạng & nhánh đấu tự cập nhật; in lịch thi đấu
  - Xuất file `giai-dau.json` để đăng lên website

## Đưa website lên mạng (GitHub Pages — miễn phí)
1. Vào repo trên GitHub → **Settings** → **Pages**.
2. Mục *Build and deployment*: Source = **Deploy from a branch**, Branch = **main**, thư mục **/ (root)** → **Save**.
3. Sau 1–2 phút, website có địa chỉ: `https://<tên-tài-khoản>.github.io/<tên-repo>/`

## Sửa thông tin CLB / liên hệ
Mở file `js/config.js` trên GitHub (bấm biểu tượng ✏️), sửa tên, giờ đếm ngược, số điện thoại, Zalo, Facebook, email → **Commit changes**.
Mục Liên hệ trên trang chủ chỉ hiện khi có ít nhất 1 trong: điện thoại, Zalo, Facebook, email.

## Hình ảnh
Ảnh nằm trong thư mục `img/` (logo, backdrop, giải thưởng, điều lệ, timeline, nhà tài trợ). Muốn thay ảnh: upload file mới **cùng tên** vào `img/`.

## Nhập tên đội & tỉ số ngày thi đấu
1. Vào `quan-ly.html` → **⤓ Lấy từ web** → chọn giải ĐÀO97 OPEN.
2. Bước **2. Đội / VĐV**: sửa tên "Đội 1…8", đội trưởng, danh sách VĐV (đổi tên không làm mất lịch).
3. Bước **3. Thi đấu & tỉ số**: nhập tỉ số từng nội dung (VD `15-12`; xử thua `0-15`), tên cặp VĐV, sân, giờ.
4. Bước **4. Đăng lên web** → tải `giai-dau.json` → upload đè vào thư mục `data` trên GitHub.

## Quy trình cập nhật giải đấu
1. Mở `https://<tên-tài-khoản>.github.io/<tên-repo>/quan-ly.html`
2. Bấm **⤓ Lấy từ web** để lấy dữ liệu hiện có.
3. Tạo/sửa giải, nhập đội, tạo lịch, nhập tỉ số. Dữ liệu được lưu trong trình duyệt máy đó.
4. Bước **4. Đăng lên web** → **Tải file giai-dau.json**.
5. Trên GitHub: vào thư mục `data` → **Add file › Upload files** → kéo file vào → **Commit changes**. Khoảng 1 phút sau website cập nhật.

## Đăng ký thi đấu (miễn phí)
Tạo một Google Form (Tên đội, VĐV 1, VĐV 2, SĐT, CLB…), dán link vào ô **Link đăng ký** của giải.
Kết quả form nằm trong Google Sheets — copy các cột *Tên đội | Thành viên | CLB* rồi dán vào ô **Thêm nhanh nhiều đội**.

## Ghi chú
- Trang `quan-ly.html` không có mật khẩu, nhưng chỉ người có quyền vào repo GitHub mới thay đổi được dữ liệu trên website.
- Nên bấm **Sao lưu toàn bộ** định kỳ, vì dữ liệu nháp nằm trong trình duyệt.

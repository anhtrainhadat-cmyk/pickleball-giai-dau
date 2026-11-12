# Website tổ chức giải Pickleball

Website tĩnh (HTML/CSS/JS thuần), chạy **miễn phí** trên GitHub Pages — không cần hosting, không cần domain, không cần database.

## Tính năng
- **Trang chủ**: danh sách giải (lọc theo trạng thái), dịch vụ, quy trình, luật cơ bản, liên hệ.
- **Trang chi tiết giải**: thông tin, danh sách đội, bảng xếp hạng vòng bảng, nhánh loại trực tiếp, lịch & kết quả. Tự cập nhật mỗi 60 giây khi giải đang diễn ra.
- **Trang ban tổ chức** (`quan-ly.html`):
  - Tạo giải: vòng tròn / loại trực tiếp / vòng bảng + loại trực tiếp
  - Nhập đội hàng loạt (dán từ Google Sheets), xếp hạt giống, bốc thăm ngẫu nhiên
  - Tự chia bảng, xếp lịch vòng tròn, dựng nhánh đấu (có miễn đấu, tránh đội cùng bảng gặp sớm)
  - Nhập tỉ số → bảng xếp hạng & nhánh đấu tự cập nhật; in lịch thi đấu
  - Xuất file `giai-dau.json` để đăng lên website

## Đưa website lên mạng (GitHub Pages — miễn phí)
1. Vào repo trên GitHub → **Settings** → **Pages**.
2. Mục *Build and deployment*: Source = **Deploy from a branch**, Branch = **main**, thư mục **/ (root)** → **Save**.
3. Sau 1–2 phút, website có địa chỉ: `https://<tên-tài-khoản>.github.io/<tên-repo>/`

## Sửa thông tin liên hệ
Mở file `js/config.js` trên GitHub (bấm biểu tượng ✏️), sửa tên, số điện thoại, Zalo, Facebook, email → **Commit changes**.

## Quy trình cập nhật giải đấu
1. Mở `https://<tên-tài-khoản>.github.io/<tên-repo>/quan-ly.html`
2. Bấm **⤓ Lấy từ web** để lấy dữ liệu hiện có (lần đầu sẽ có 3 giải mẫu — xoá đi nếu không cần).
3. Tạo/sửa giải, nhập đội, tạo lịch, nhập tỉ số. Dữ liệu được lưu trong trình duyệt máy đó.
4. Bước **4. Đăng lên web** → **Tải file giai-dau.json**.
5. Trên GitHub: vào thư mục `data` → **Add file › Upload files** → kéo file vào → **Commit changes**. Khoảng 1 phút sau website cập nhật.

## Đăng ký thi đấu (miễn phí)
Tạo một Google Form (Tên đội, VĐV 1, VĐV 2, SĐT, CLB…), dán link vào ô **Link đăng ký** của giải.
Kết quả form nằm trong Google Sheets — copy các cột *Tên đội | Thành viên | CLB* rồi dán vào ô **Thêm nhanh nhiều đội**.

## Ghi chú
- Trang `quan-ly.html` không có mật khẩu, nhưng chỉ người có quyền vào repo GitHub mới thay đổi được dữ liệu trên website.
- Nên bấm **Sao lưu toàn bộ** định kỳ, vì dữ liệu nháp nằm trong trình duyệt.

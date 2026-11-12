# Kích hoạt hệ thống BTC (Firebase — miễn phí)

Firebase lưu: kết quả trận đấu (cập nhật trực tiếp cho khán giả), danh sách đội & VĐV, **trình VĐV 1-2-3 (chỉ BTC xem)**, dự đoán của khán giả và tài khoản đăng nhập BTC.
Dùng gói **Spark (miễn phí)**, không cần thẻ ngân hàng. Làm 1 lần, khoảng 10 phút.

## 1. Tạo dự án
1. Vào https://console.firebase.google.com bằng Gmail → **Create a project** (Tạo dự án).
2. Đặt tên `dao97-open` → tắt Google Analytics → **Create project**.

## 2. Bật đăng nhập bằng email
1. Menu trái **Build › Authentication** → **Get started**.
2. Tab **Sign-in method** → **Email/Password** → bật **Enable** → **Save**.
3. Tab **Settings › User actions** → **bỏ tích** “Enable create (sign-up)” → **Save** (không cho người lạ tự tạo tài khoản).
4. Tab **Users** → **Add user** → nhập email + mật khẩu cho từng thành viên BTC (VD trưởng BTC Dương CT).

## 3. Tạo cơ sở dữ liệu
1. **Build › Firestore Database** → **Create database**.
2. Vị trí: **asia-southeast1 (Singapore)** → chọn **Start in production mode** → **Create**.
3. Tab **Rules** → xoá hết → dán toàn bộ nội dung file [`firestore.rules`](firestore.rules) → **Publish**.

## 4. Cấp quyền BTC
Trong Firestore tab **Data**:
1. **Start collection** → Collection ID: `admins` → **Next**.
2. **Document ID**: email của BTC, **viết thường** (VD `duongct@gmail.com`).
3. Thêm 1 trường: Field `role`, Type `string`, Value `btc` → **Save**.
4. Thêm người khác: trong collection `admins` bấm **Add document**, làm tương tự.

> Chỉ email có trong `admins` mới nhập được kết quả và xem/chấm trình VĐV. Người khác đăng nhập cũng bị chặn.

## 5. Lấy cấu hình web
1. Bấm ⚙️ cạnh **Project Overview** → **Project settings**.
2. Mục **Your apps** → bấm biểu tượng **`</>`** (Web) → đặt tên `dao97-web` → **Register app** (không cần Hosting).
3. Copy đoạn `firebaseConfig = { apiKey: ..., authDomain: ..., projectId: ..., ... }`.
4. Gửi đoạn này cho Claude, **hoặc** tự dán vào `js/config.js` (mục `firebase:`) trên GitHub → **Commit changes**.

> `apiKey` của Firebase web **không phải mật khẩu**, được phép công khai. Dữ liệu được bảo vệ bằng luật ở bước 3.

## 6. Khởi tạo dữ liệu giải
1. Mở `https://anhtrainhadat-cmyk.github.io/pickleball-giai-dau/btc.html` → đăng nhập.
2. Bấm **Khởi tạo dữ liệu** (tạo 8 đội, 7 vòng, 28 lượt đấu).
3. Tab **Đội & chấm trình**: nhập tên đội, đội trưởng, tên 8 VĐV, chấm trình 1-2-3.
4. Ngày thi đấu: tab **Nhập kết quả** → nhập tỉ số từng nội dung → khán giả thấy ngay.
5. Tab **Dự đoán**: khoá cổng dự đoán khi vòng 1 bắt đầu; cuối giải xem ai đoán trúng.

## Hạn mức miễn phí
Gói Spark: 50.000 lượt đọc/ngày, 20.000 lượt ghi/ngày — đủ cho giải khoảng vài trăm người xem.
Website đã bật bộ nhớ đệm và chỉ tải dự đoán khi người xem cuộn tới, để tiết kiệm lượt đọc.

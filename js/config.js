/*
 * CẤU HÌNH WEBSITE ĐÀO97 OPEN
 */
window.SITE_CONFIG = {
  name: 'ĐÀO97 OPEN',
  club: 'CLB Pickleball Đào 97 Hà Nội',
  since: '2024',
  head: 'Dương CT',                       // Trưởng BTC

  venue: 'Sân Ba Dứa, Hà Nội',
  venueMap: 'https://maps.app.goo.gl/XCYy1kF9SgPDs5iv8?g_st=ac',
  gala: 'Nhà hàng Trống Đồng Linh Đàm',
  galaMap: 'https://www.google.com/maps/search/?api=1&query=Nh%C3%A0%20h%C3%A0ng%20Tr%E1%BB%91ng%20%C4%90%E1%BB%93ng%20Linh%20%C4%90%C3%A0m',

  // Giờ khai mạc / kết thúc (giờ Việt Nam) — dùng cho đếm ngược
  eventStart: '2026-11-21T12:30:00+07:00',
  eventEnd: '2026-11-21T22:00:00+07:00',

  // Đội được dự đoán vô địch khi chưa có kết quả trận nào
  defaultFavorite: 'doi2',

  /*
   * FIREBASE — nơi lưu kết quả, trình VĐV, dự đoán và tài khoản BTC (miễn phí).
   * Dán cấu hình lấy từ Firebase Console › Project settings › Your apps › Web app.
   * Để trống thì web chỉ đọc dữ liệu tĩnh trong data/giai-dau.json.
   */
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  }
};

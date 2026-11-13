/*
 * Lớp dữ liệu: dùng Firebase (Firestore + Auth) nếu đã cấu hình trong config.js,
 * nếu chưa thì đọc dữ liệu tĩnh data/giai-dau.json (chỉ xem, không dự đoán/nhập liệu).
 *
 * Firestore:
 *   event/main        { teams[], status, predictionsOpen, subEvents }      — công khai đọc, BTC ghi
 *   matches/{id}      { round, order, a, b, court, time, subs{s0..s3} }    — công khai đọc, BTC ghi
 *   private/ratings   { levels: { playerId: 1|2|3 } }                       — CHỈ BTC đọc/ghi
 *   predictions/{id}  { name, champion, second, third, createdAt }         — ai cũng gửi, BTC xoá
 *   admins/{email}    (tạo trong Firebase Console)                         — danh sách tài khoản BTC
 */
(function () {
  const C = window.SITE_CONFIG || {};
  const FB = C.firebase || {};
  const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const Store = { enabled: !!(FB.apiKey && FB.projectId) };
  let db, auth, readyP;

  const loadScript = (src) => new Promise((ok, err) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => err(new Error('Không tải được thư viện Firebase'));
    document.head.appendChild(s);
  });

  Store.init = function () {
    if (readyP) return readyP;
    readyP = (async () => {
      if (!Store.enabled) return;
      if (!window.firebase) {
        await loadScript(SDK + 'firebase-app-compat.js');
        await Promise.all([loadScript(SDK + 'firebase-auth-compat.js'), loadScript(SDK + 'firebase-firestore-compat.js')]);
      }
      firebase.initializeApp(FB);
      db = firebase.firestore();
      auth = firebase.auth();
      if (FB.emulator) { db.useEmulator('127.0.0.1', 8081); auth.useEmulator('http://127.0.0.1:9099'); }
      // Bộ nhớ đệm trên máy người xem: mở lại trang chỉ tải phần thay đổi (tiết kiệm hạn mức miễn phí)
      try { await db.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* trình duyệt không hỗ trợ — bỏ qua */ }
    })();
    return readyP;
  };

  /* ---------- Chuyển đổi dữ liệu ---------- */
  const subKey = (i) => 's' + i;
  function build(ev, matchDocs) {
    const teams = ev.teams || [];
    return {
      id: 'dao97-open-2026', name: C.name, format: 'team-rr',
      status: ev.status || 'sap-dien-ra',
      predictionsOpen: ev.predictionsOpen !== false,
      reserves: ev.reserves || '',
      subEvents: ev.subEvents || PB.DEFAULT_SUBS,
      teams,
      groups: [{ name: 'A', teamIds: teams.map((x) => x.id) }],
      matches: matchDocs.map(([id, m]) => ({
        id, stage: 'group', group: 'A', round: m.round, order: m.order || 0, a: m.a, b: m.b,
        court: m.court || '', time: m.time || '',
        subs: Object.keys(m.subs || {}).sort().map((k) => ({
          key: k, label: m.subs[k].label, games: PB.parseGames(m.subs[k].sc) || [], pa: m.subs[k].pa || '', pb: m.subs[k].pb || ''
        }))
      })).sort((x, y) => x.round - y.round || x.order - y.order)
    };
  }
  function normalizeStatic(t) {
    t.matches.forEach((m) => m.subs.forEach((s, i) => (s.key = s.key || subKey(i))));
    t.predictionsOpen = false;
    return t;
  }

  async function loadStatic() {
    const r = await fetch('data/giai-dau.json?v=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('Không tải được dữ liệu (' + r.status + ')');
    const j = await r.json();
    return normalizeStatic(Array.isArray(j) ? j[0] : j);
  }
  Store.loadStatic = loadStatic;

  /* ---------- Theo dõi dữ liệu giải (realtime) ---------- */
  Store.watch = async function (cb, onErr) {
    await Store.init();
    if (!Store.enabled) {
      const run = () => loadStatic().then(cb).catch(onErr || console.error);
      run(); setInterval(run, 60000);
      return;
    }
    let ev = null, docs = null, fallback = null;
    const emit = async () => {
      if (ev === null || docs === null) return;
      if (!ev.exists) {
        fallback = fallback || await loadStatic().catch(() => null);
        if (fallback) cb({ ...fallback, _seedNeeded: true, predictionsOpen: true });
        return;
      }
      cb(build(ev.data(), docs));
    };
    db.doc('event/main').onSnapshot((s) => { ev = s; emit(); }, onErr);
    db.collection('matches').onSnapshot((q) => { docs = q.docs.map((d) => [d.id, d.data()]); emit(); }, onErr);
  };

  /* ---------- Dự đoán của khán giả ---------- */
  Store.watchPredictions = async function (cb, onErr) {
    await Store.init();
    if (!Store.enabled) return cb(null);
    db.collection('predictions').orderBy('createdAt', 'desc').limit(300).onSnapshot((q) => {
      cb(q.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt ? d.data().createdAt.toDate() : new Date() })));
    }, onErr);
  };
  Store.submitPrediction = async function (p) {
    await Store.init();
    if (!Store.enabled) throw new Error('Chức năng dự đoán chưa được kích hoạt.');
    return db.collection('predictions').add({
      name: String(p.name).trim().slice(0, 40), champion: p.champion, second: p.second, third: p.third,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  };

  /* ---------- BTC ---------- */
  Store.onAuth = async function (cb) {
    await Store.init();
    if (!Store.enabled) return cb(null, false);
    auth.onAuthStateChanged(async (u) => {
      if (!u) return cb(null, false);
      let ok = false;
      try { ok = (await db.doc('admins/' + u.email.toLowerCase()).get()).exists; } catch (e) { ok = false; }
      cb(u, ok);
    });
  };
  // Đăng nhập bằng số điện thoại: 0912 345 678 / +84912345678 → 0912345678@dao97open.vn
  Store.PHONE_DOMAIN = 'dao97open.vn';
  Store.phoneToLogin = function (v) {
    v = String(v || '').trim();
    if (v.includes('@')) return v.toLowerCase();
    let d = v.replace(/\D/g, '');
    if (d.startsWith('84') && d.length >= 11) d = '0' + d.slice(2);
    return d + '@' + Store.PHONE_DOMAIN;
  };
  Store.loginToPhone = (email) => String(email || '').replace('@' + Store.PHONE_DOMAIN, '');
  Store.signIn = (phone, pw) => auth.signInWithEmailAndPassword(Store.phoneToLogin(phone), pw);
  Store.signOut = () => auth.signOut();
  // Đổi mật khẩu: xác nhận lại mật khẩu cũ rồi đặt mật khẩu mới
  Store.changePassword = async (oldPw, newPw) => {
    const u = auth.currentUser;
    if (!u) throw new Error('Chưa đăng nhập');
    await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email, oldPw));
    await u.updatePassword(newPw);
  };
  Store.resetPassword = (email) => auth.sendPasswordResetEmail(email.trim());

  Store.seed = async function (t) {
    const batch = db.batch();
    batch.set(db.doc('event/main'), {
      teams: t.teams, reserves: t.reserves || '', status: t.status || 'sap-dien-ra', predictionsOpen: true, subEvents: t.subEvents || PB.DEFAULT_SUBS
    });
    t.matches.forEach((m, i) => {
      const subs = {};
      m.subs.forEach((s, k) => (subs[subKey(k)] = { label: s.label, sc: PB.formatGames(s.games), pa: s.pa || '', pb: s.pb || '' }));
      batch.set(db.doc('matches/' + m.id), { round: m.round, order: i, a: m.a, b: m.b, court: m.court || '', time: m.time || '', subs });
    });
    return batch.commit();
  };
  Store.saveEvent = (patch) => db.doc('event/main').update(patch);
  Store.saveSub = (mid, key, field, value) => db.doc('matches/' + mid).update(`subs.${key}.${field}`, value);
  Store.saveMatch = (mid, field, value) => db.doc('matches/' + mid).update(field, value);
  Store.watchRatings = (cb, onErr) => db.doc('private/ratings').onSnapshot((s) => cb((s.exists && s.data().levels) || {}), onErr);
  // Lưu trình vào vùng BTC (private/ratings) và chép bản công khai (event/ratings) để trang VĐV hiển thị
  Store.saveRating = (pid, level) => {
    const v = { levels: { [pid]: level || firebase.firestore.FieldValue.delete() } };
    const b = db.batch();
    b.set(db.doc('private/ratings'), v, { merge: true });
    b.set(db.doc('event/ratings'), v, { merge: true });
    return b.commit();
  };
  // Đồng bộ toàn bộ trình sang bản công khai (dùng 1 lần cho trình đã chấm trước đây)
  Store.syncPublicRatings = (levels) => db.doc('event/ratings').set({ levels });
  // Nhập toàn bộ trình (thay thế) cho cả vùng BTC và bản công khai
  Store.setAllRatings = (levels) => {
    const b = db.batch();
    b.set(db.doc('private/ratings'), { levels });
    b.set(db.doc('event/ratings'), { levels });
    return b.commit();
  };
  Store.watchPublicRatings = async (cb, onErr) => {
    await Store.init();
    if (!Store.enabled) return cb({});
    db.doc('event/ratings').onSnapshot((s) => cb((s.exists && s.data().levels) || {}), onErr);
  };
  Store.deletePrediction = (id) => db.doc('predictions/' + id).delete();

  window.Store = Store;
})();

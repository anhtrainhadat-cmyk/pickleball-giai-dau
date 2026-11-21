/*
 * Khu vực đội trưởng trên trang nội bộ (tài khoản "Cap" – Team 2 và "BAU" – Team 3):
 *   📝 Kỹ năng VĐV — chấm Tốt / TB / Yếu cho 7 kỹ năng của từng VĐV mọi đội (Cap và BAU dùng chung)
 *   ♟️ Đấu pháp     — riêng từng tài khoản: đặc điểm đối thủ, kịch bản đưa quân, đội hình tối ưu (sửa tay được)
 * Dữ liệu: Firestore cap/skills    { s: { pid: { drive: 'T'|'B'|'K', ... } } }   (K = Yếu)
 *                    cap/plan      (Cap) · cap/plan-bau (BAU)
 *                                  { r: { oppId: { them: {s0:[pid,pid],..}, us: {...}, lock: {s0:true}, scen: 'A'|'B' } } }
 * BAU phải đổi mật khẩu ở lần đăng nhập đầu tiên (acct/{email}.pwChanged).
 */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = PB.esc;
  const SK = [['drive', 'Đoa/Drive'], ['luoi', 'Đánh lưới'], ['drop', 'Drop'], ['lop', 'Lốp'], ['nong', 'Kiểm soát nhịp'], ['bao', 'Bao bóng'], ['ben', 'Bền bóng']];
  const SKN = Object.fromEntries(SK);
  const LVLS = [['T', 'Tốt'], ['B', 'TB'], ['K', 'Yếu']];
  const LVN = Object.fromEntries(LVLS);
  const VAL = { T: 1, B: 0, K: -1 };
  const W = { drive: 0.5, luoi: 0.6, drop: 0.5, lop: 0.3, nong: 0.4, bao: 0.35, ben: 0.5 };
  // Cặp "điểm mạnh của bên này ↔ điểm yếu của bên kia"
  const EDGES = [['drive', 'luoi'], ['lop', 'bao'], ['ben', 'nong'], ['drop', 'drive']];
  const GOOD = { drive: 'drive tốt', luoi: 'đánh lưới tốt', drop: 'drop tốt', lop: 'lốp tốt', nong: 'kiểm soát nhịp tốt', bao: 'bao bóng tốt', ben: 'bền bóng' };
  const BAD = { drive: 'drive yếu', luoi: 'đánh lưới yếu', drop: 'drop yếu', lop: 'lốp yếu', nong: 'kiểm soát nhịp yếu (hay vội)', bao: 'bao bóng yếu', ben: 'bền bóng yếu' };
  const SCEN = { A: 'Đội bạn: xếp mạnh trước', B: 'Đội bạn: dàn đều' };

  // Tài khoản được vào khu vực này: đội của mình (để lên đấu pháp) và nơi lưu đấu pháp riêng
  const ACC = {
    [Store.CAP_EMAIL]: { label: 'Cap', team: 'doi2', plan: 'plan' },
    [Store.BAU_EMAIL]: { label: 'BAU', team: 'doi3', plan: 'plan-bau', forcePw: true }
  };
  let user = null, T = null, LV = {}, ME = 'doi2', SKL = {}, PLAN = {}, unsub = [], skTeam = null, dpOpp = null, tab = null, err = '';
  let mustPw = false, pwOpen = false, pop = null, NOTES = {}, sheet = null;

  /* ---------- Dữ liệu từ trang nội bộ ---------- */
  document.addEventListener('nb:data', (e) => { ({ T, LV } = e.detail); render(); });
  document.addEventListener('nb:tab', (e) => { tab = e.detail; closePop(); closeSheet(); render(); });
  Store.onUser(async (u) => {
    user = u; err = ''; mustPw = false; pwOpen = false; SKL = {}; PLAN = {}; NOTES = {};
    unsub.forEach((f) => f()); unsub = [];
    const A = acct();
    if (A) {
      ME = A.team; skTeam = null; dpOpp = null;
      if (A.forcePw) { try { mustPw = !(await Store.getAcct(u.email)).pwChanged; } catch (er) { mustPw = true; } }
      const fail = (er) => { err = /permission/i.test(er.message) ? 'Firebase chưa cho phép tài khoản này đọc dữ liệu: cần dán lại luật bảo mật mới (firestore.rules).' : er.message; render(); };
      unsub.push(Store.watchCap('skills', (d) => { SKL = d.s || {}; render(); }, fail));
      unsub.push(Store.watchCap(A.plan, (d) => { PLAN = d.r || {}; NOTES = d.n || {}; render(); if (sheet) drawSheet(); }, fail));
    }
    render();
  });
  const acct = () => (user && ACC[user.email]) || null;
  const isCap = () => !!acct();

  /* ---------- Tiện ích ---------- */
  const players = (id) => ((PB.team(T, id) || {}).players || []).filter((p) => p && p.name);
  const tn = (id) => PB.teamName(T, id);
  const pName = (pid) => { for (const t of T.teams) for (const p of t.players || []) if (p.id === pid) return p.name; return '?'; };
  const lvOf = (pid) => LV[pid] || 0;
  const lvTag = (pid) => (LV[pid] ? `<span class="lv lv${LV[pid]}">T${LV[pid]}</span>` : '<span class="lv lv0">–</span>');
  const isMaleSlot = (p) => p.gender !== 'nu' || /vị trí nam/i.test(p.note || '');
  const byLevel = (a, b) => (lvOf(a.id) || 9) - (lvOf(b.id) || 9) || (a.gender === 'nu') - (b.gender === 'nu');
  const sk = (pid, k) => (SKL[pid] || {})[k];
  const skCount = (id) => players(id).reduce((n, p) => n + SK.filter(([k]) => sk(p.id, k)).length, 0);
  const str = (pid) => (lvOf(pid) ? 7 - lvOf(pid) : 3.5) + SK.reduce((s, [k]) => s + W[k] * (VAL[sk(pid, k)] || 0), 0);
  const subs = () => (T.subEvents || PB.DEFAULT_SUBS).map((label, i) => ({ key: 's' + i, label, mixed: /nữ/i.test(label) }));
  const myTies = () => T.matches.filter((m) => m.a === ME || m.b === ME).sort((x, y) => x.round - y.round);
  const oppOf = (m) => (m.a === ME ? m.b : m.a);

  /* ---------- Mô hình thắng/thua 1 nội dung ---------- */
  function edgeCount(att, def) {
    let n = 0;
    for (const a of att) for (const d of def) for (const [ka, kd] of EDGES) if (sk(a, ka) === 'T' && sk(d, kd) === 'K') n++;
    return n;
  }
  function winP(us, them) {
    if (!us[0] || !us[1] || !them[0] || !them[1]) return 0.5;
    const d = str(us[0]) + str(us[1]) - str(them[0]) - str(them[1]) + 0.3 * (edgeCount(us, them) - edgeCount(them, us));
    return 1 / (1 + Math.exp(-d / 3));
  }
  // Liệt kê mọi cách xếp đội: mỗi nội dung 2 VĐV, mỗi VĐV tối đa 1 nội dung; giữ nguyên các nội dung đã khoá
  function lineups(id, fixed = {}) {
    const ps = players(id), S = subs();
    const usedFixed = new Set(Object.values(fixed).flat());
    const men = ps.filter((p) => isMaleSlot(p) && !usedFixed.has(p.id)).map((p) => p.id);
    const wom = ps.filter((p) => !isMaleSlot(p) && !usedFixed.has(p.id)).map((p) => p.id);
    const out = [];
    const rec = (i, cur, m, w) => {
      if (i === S.length) { out.push({ ...cur }); return; }
      const s = S[i];
      if (fixed[s.key]) { cur[s.key] = fixed[s.key]; rec(i + 1, cur, m, w); return; }
      if (s.mixed) {
        for (const a of m) for (const b of w) { cur[s.key] = [a, b]; rec(i + 1, cur, m.filter((x) => x !== a), w.filter((x) => x !== b)); }
      } else {
        for (let x = 0; x < m.length; x++) for (let y = x + 1; y < m.length; y++) {
          cur[s.key] = [m[x], m[y]]; rec(i + 1, cur, m.filter((z) => z !== m[x] && z !== m[y]), w);
        }
      }
    };
    rec(0, {}, men, wom);
    return out;
  }
  const exp = (us, them) => subs().reduce((s, x) => s + winP(us[x.key] || [], them[x.key] || []), 0);
  function bestResponse(them, fixed) {
    let best = null, bv = -1;
    for (const L of lineups(ME, fixed)) { const v = exp(L, them); if (v > bv + 1e-9) { bv = v; best = L; } }
    return best || {};
  }
  function predictThem(id, scen) {
    const ps = players(id);
    const men = ps.filter(isMaleSlot).map((p) => p.id).sort((a, b) => str(b) - str(a));
    const wom = ps.filter((p) => !isMaleSlot(p)).map((p) => p.id).sort((a, b) => str(b) - str(a));
    const S = subs();
    if (scen !== 'B') {
      // Xếp mạnh trước: cặp nam mạnh nhất vào Đôi nam 1, nam mạnh kế + nữ mạnh nhất vào Nam nữ 1, …
      const L = {}; let mi = 0, wi = 0;
      for (const s of S) L[s.key] = s.mixed ? [men[mi++], wom[wi++]] : [men[mi++], men[mi++]];
      return L;
    }
    // Dàn đều: chênh lệch sức giữa các cặp nhỏ nhất; cặp nhỉnh hơn vào nội dung số 1
    let best = null, bv = Infinity;
    for (const L of lineups(id)) {
      const v = S.map((s) => str(L[s.key][0]) + str(L[s.key][1]));
      const sp = Math.max(...v) - Math.min(...v) - 0.01 * (v[0] + v[1] - v[2] - v[3]);
      if (sp < bv) { bv = sp; best = L; }
    }
    return best;
  }
  const valid = (id, L) => {
    const ids = new Set(players(id).map((p) => p.id));
    return L && subs().every((s) => Array.isArray(L[s.key]) && L[s.key].length === 2 && L[s.key].every((x) => ids.has(x)));
  };
  function planFor(opp) {
    const P = PLAN[opp] || {};
    const scen = P.scen || 'A';
    const them = valid(opp, P.them) ? P.them : predictThem(opp, scen);
    const lock = P.lock || {};
    const us = valid(ME, P.us) ? P.us : bestResponse(them, {});
    return { scen, them, us, lock, editedThem: valid(opp, P.them), editedUs: valid(ME, P.us) };
  }
  const savePlan = (opp, patch) => Store.setCap('plan', { r: { [opp]: patch } }).catch((e) => toast('Chưa lưu được: ' + e.message));

  /* ---------- Lời khuyên theo kỹ năng ---------- */
  const EXPLOIT = {
    drive: (n) => `<b>${n}</b> drive yếu → chủ động drive/đẩy nhanh vào ${n}`,
    luoi: (n) => `<b>${n}</b> đánh lưới yếu → dink/drop vào ${n}, chờ bóng nổi`,
    drop: (n) => `<b>${n}</b> drop yếu → ép ${n} đánh quả thứ 3 từ cuối sân`,
    lop: (n) => `<b>${n}</b> lốp yếu → có thể dâng sát lưới ép ${n}`,
    nong: (n) => `<b>${n}</b> kiểm soát nhịp yếu, hay vội → kéo dài rally, đánh chắc chờ ${n} tự lỗi`,
    bao: (n) => `<b>${n}</b> bao bóng yếu → đánh vào giữa và khoảng trống phía ${n}`,
    ben: (n) => `<b>${n}</b> bền bóng yếu → giữ bóng qua lưới thêm vài quả, ${n} sẽ tự lỗi`
  };
  const CAUTION = {
    drive: (n) => `<b>${n}</b> drive mạnh → block chắc, vợt trước ngực, không đôi công`,
    luoi: (n) => `<b>${n}</b> lưới chắc → tránh đẩy bóng cao ở lưới, ưu tiên reset`,
    drop: (n) => `<b>${n}</b> drop hay → chuẩn bị chân sớm, xử lý bóng thấp`,
    lop: (n) => `<b>${n}</b> hay lốp → người đứng lưới đừng dâng quá sát`,
    nong: (n) => `<b>${n}</b> kiểm soát nhịp tốt → đừng trông chờ tự lỗi, phải chủ động tạo thế`,
    bao: (n) => `<b>${n}</b> bao sân rộng → đánh dọc biên phía ${n} bỏ trống`,
    ben: (n) => `<b>${n}</b> bền bóng → chuẩn bị rally dài, kiên nhẫn`
  };
  const USE = { drive: 'drive tốt', luoi: 'lưới chắc', drop: 'drop tốt', lop: 'lốp tốt', nong: 'kiểm soát nhịp tốt', bao: 'bao sân tốt', ben: 'bền bóng' };
  function subTips(us, them) {
    const t = [];
    if (them[0] && them[1]) {
      const [x, y] = str(them[0]) <= str(them[1]) ? them : [them[1], them[0]];
      if (Math.abs(str(x) - str(y)) >= 0.5) t.push(`🎯 Bóng chính vào <b>${esc(pName(x))}</b> (yếu hơn trong cặp)`);
    }
    const ex = [], ca = [];
    for (const pid of them) for (const [k] of SK) {
      if (sk(pid, k) === 'K') ex.push('✅ ' + EXPLOIT[k](esc(pName(pid))));
      if (sk(pid, k) === 'T' && ['drive', 'lop', 'luoi', 'bao'].includes(k)) ca.push('⚠️ ' + CAUTION[k](esc(pName(pid))));
    }
    t.splice(t.length, 0, ...ex.slice(0, 3), ...ca.slice(0, 1));
    for (const a of us) for (const d of them) for (const [ka, kd] of EDGES) {
      if (sk(a, ka) === 'T' && sk(d, kd) === 'K') { t.push(`💪 Phát huy: <b>${esc(pName(a))}</b> ${USE[ka]} ↔ ${esc(pName(d))} ${BAD[kd]}`); break; }
    }
    if (!them.some((p) => SK.some(([k]) => sk(p, k))))
      t.push('ℹ️ Chưa có kỹ năng của cặp này: quan sát 2–3 điểm đầu để tìm người đỡ bóng yếu (Cẩm nang mục 2).');
    return t;
  }
  function teamNotes(id) {
    const ps = players(id), notes = [];
    const ranked = ps.slice().sort((a, b) => str(b.id) - str(a.id));
    const goods = (p) => SK.filter(([k]) => sk(p.id, k) === 'T').map(([k]) => GOOD[k]);
    notes.push(`⭐ Mạnh nhất: ${ranked.slice(0, 2).map((p) => `<b>${esc(p.name)}</b> (T${lvOf(p.id) || '?'}${goods(p).length ? ': ' + esc(goods(p).slice(0, 3).join(', ')) : ''})`).join(' · ')}`);
    const weak = ranked.slice(-2).reverse();
    notes.push(`🎯 Dễ khai thác nhất: ${weak.map((p) => `<b>${esc(p.name)}</b> (T${lvOf(p.id) || '?'})`).join(' · ')}`);
    const HINT = { drive: 'Không đôi công, block chắc, reset.', lop: 'Đứng lưới đừng dâng quá sát.', luoi: 'Hạn chế bóng cao ở lưới.', ben: 'Sẵn sàng rally dài.', bao: 'Đánh dọc biên, tránh bóng giữa sân.', drop: 'Chuẩn bị xử lý bóng thấp.', nong: 'Không trông chờ họ tự lỗi.' };
    const TIP = { drive: 'Chủ động drive vào họ.', luoi: 'Dink/drop vào họ, chờ bóng nổi.', drop: 'Ép họ đánh quả thứ 3 từ cuối sân.', lop: 'Có thể dâng lưới ép.', nong: 'Kéo dài rally, chờ tự lỗi.', bao: 'Đánh vào giữa hai người.', ben: 'Giữ bóng qua lưới thêm vài quả.' };
    const sk7 = [];
    for (const [k] of SK) {
      const g = ps.filter((p) => sk(p.id, k) === 'T'), b = ps.filter((p) => sk(p.id, k) === 'K');
      if (g.length >= 3) sk7.push([g.length, `⚠️ ${g.length} VĐV <b>${GOOD[k]}</b>: ${esc(g.map((p) => p.name).join(', '))}. ${HINT[k]}`]);
      if (b.length >= 2) sk7.push([b.length + 0.5, `✅ ${b.length} VĐV <b>${BAD[k]}</b>: ${esc(b.map((p) => p.name).join(', '))}. ${TIP[k]}`]);
    }
    notes.push(...sk7.sort((x, y) => y[0] - x[0]).slice(0, 6).map((x) => x[1]));
    const fem = ps.filter((p) => !isMaleSlot(p));
    if (fem.length) notes.push(`♀ Nữ: ${fem.map((p) => `<b>${esc(p.name)}</b> T${lvOf(p.id) || '?'}`).join(' · ')}`);
    const odd = ps.filter((p) => p.gender === 'nu' && isMaleSlot(p));
    if (odd.length) notes.push(`ℹ️ ${esc(odd.map((p) => p.name).join(', '))}: VĐV nữ thi đấu vị trí nam (có thể vào cặp Đôi nam).`);
    return notes;
  }

  /* ---------- Giao diện ---------- */
  function gate() {
    if (!Store.enabled) return '<div class="card cap-gate"><p>Chức năng này cần kết nối Firebase.</p></div>';
    if (user && !isCap()) return `<div class="card cap-gate"><div class="lock-ic">⛔</div><h2>Tài khoản không có quyền</h2>
      <p class="muted">Đang đăng nhập: <b>${esc(Store.loginToPhone(user.email))}</b>. Khu vực này chỉ dành cho tài khoản <b>Cap</b> và <b>BAU</b>.</p>
      <button class="btn ghost" data-cap="out">Đăng xuất</button></div>`;
    return `<div class="card cap-gate"><div class="lock-ic">🔒</div><h2>Khu vực đội trưởng</h2>
      <p class="muted">Chỉ tài khoản <b>Cap</b> hoặc <b>BAU</b> đăng nhập mới xem được kỹ năng VĐV và đấu pháp.</p>
      <form class="cap-login"><input name="u" placeholder="Tài khoản (Cap hoặc BAU)" autocomplete="username" aria-label="Tài khoản">
        <input name="p" type="password" placeholder="Mật khẩu" autocomplete="current-password" aria-label="Mật khẩu">
        <button class="btn primary" type="submit">Đăng nhập</button><p class="cap-msg muted"></p></form></div>`;
  }
  const bar = (title, eyebrow) => `<div class="section-head"><div><div class="eyebrow">${eyebrow}</div><h2 class="display">${title}</h2></div>
    <span class="cap-who">🔓 ${esc(acct().label)} · <button class="linkbtn" data-cap="pw">🔑 Đổi mật khẩu</button> · <button class="linkbtn" data-cap="out">Đăng xuất</button></span></div>
    ${err ? `<p class="notice">⚠️ ${esc(err)}</p>` : ''}`;

  function teamOrder() {
    return [ME, ...myTies().map(oppOf)].filter((x, i, a) => x && a.indexOf(x) === i);
  }
  function renderSkills() {
    const ids = teamOrder();
    if (!skTeam || !ids.includes(skTeam)) skTeam = ids[0];
    const roundOf = (id) => (myTies().find((m) => oppOf(m) === id) || {}).round;
    const ps = players(skTeam).slice().sort(byLevel);
    const total = ps.length * SK.length;
    return `${bar('Kỹ năng VĐV', 'Đội trưởng nhập · bấm là tự lưu')}
      <p class="muted cap-legend">Bấm vào ô của từng VĐV để chọn <span class="sk-v" data-v="T">Tốt</span> <span class="sk-v" data-v="B">TB</span> <span class="sk-v" data-v="K">Yếu</span>.
        <b>Kiểm soát nhịp:</b> Tốt = giữ nhịp tốt, bình tĩnh; Yếu = hay vội. VĐV xếp theo trình T1 (cao nhất) → T6. Cap và BAU dùng chung bảng này.</p>
      <div class="chips cap-teams">${ids.map((id) => `<button class="chip ${id === skTeam ? 'active' : ''}" data-skt="${esc(id)}">${id === ME ? '⭐ ' : 'V' + roundOf(id) + ' · '}${esc(tn(id))} <small>${skCount(id)}/${players(id).length * SK.length}</small></button>`).join('')}</div>
      <div class="card sk-card"><div class="sk-head"><h3>${esc(tn(skTeam))}</h3><span class="muted">Đã nhập ${skCount(skTeam)}/${total} ô</span></div>
      <p class="muted sk-swipe">← Vuốt ngang bảng để xem đủ 7 kỹ năng →</p>
      <div class="table-wrap"><table class="sk-table">
        <thead><tr><th class="l">VĐV</th><th>Trình</th>${SK.map(([, n]) => `<th>${n}</th>`).join('')}</tr></thead>
        <tbody>${ps.map((p) => `<tr><td class="l"><button class="pname ${p.gender === 'nu' ? 'f' : ''}" data-pnote="${esc(p.id)}">${p.gender === 'nu' ? '♀' : '♂'} ${esc(p.name)}${NOTES[p.id] ? ' 📝' : ''}</button></td><td>${lvTag(p.id)}</td>
          ${SK.map(([k]) => { const v = sk(p.id, k); return `<td><button class="sk-cell" data-v="${v || ''}" data-pid="${esc(p.id)}" data-k="${k}" aria-haspopup="menu" aria-label="${esc(SKN[k])} – ${esc(p.name)}: ${v ? LVN[v] : 'chưa chọn'}">${v ? LVN[v] : '＋'}</button></td>`; }).join('')}</tr>`).join('')}
        </tbody></table></div></div>`;
  }

  function sel(id, sub, side, idx, cur, L) {
    const ps = players(id).filter((p) => (sub.mixed && idx === 1 ? !isMaleSlot(p) : isMaleSlot(p))).sort(byLevel);
    const used = new Set(Object.entries(L).filter(([k]) => k !== sub.key).flatMap(([, v]) => v));
    return `<select data-side="${side}" data-sub="${sub.key}" data-i="${idx}" aria-label="${esc(sub.label)} VĐV ${idx + 1}">
      ${ps.map((p) => `<option value="${esc(p.id)}" ${p.id === cur ? 'selected' : ''}>T${lvOf(p.id) || '?'} · ${esc(p.name)}${used.has(p.id) ? ' (đã xếp)' : ''}</option>`).join('')}</select>`;
  }
  const pct = (x) => Math.round(x * 100) + '%';
  function dist(us, them) {
    // xác suất số nội dung thắng 0..4
    let d = [1];
    for (const s of subs()) {
      const p = winP(us[s.key] || [], them[s.key] || []);
      const n = new Array(d.length + 1).fill(0);
      d.forEach((v, i) => { n[i] += v * (1 - p); n[i + 1] += v * p; });
      d = n;
    }
    return d;
  }
  function dups(L) {
    const seen = {}, out = new Set();
    Object.values(L).flat().forEach((x) => { if (seen[x]) out.add(x); seen[x] = 1; });
    return [...out];
  }
  // Nút VĐV: bấm mở cửa sổ ghi chú + đổi người
  const chip = (pid, side, key, i) => {
    const has = NOTES[pid] && NOTES[pid].trim();
    return `<button class="pchip ${side}" data-ps="${side}" data-sub="${key}" data-i="${i}" data-pid="${esc(pid || '')}">
      ${pid ? `${lvTag(pid)}<span class="pn">${esc(pName(pid))}</span>${has ? '<span class="pnote" title="Có ghi chú">📝</span>' : ''}` : '<span class="pn muted">＋ Chọn VĐV</span>'}</button>`;
  };
  function liveSub(m, s) {
    const sub = (m.subs || []).find((x) => x.key === s.key); if (!sub) return '';
    const mine = m.a === ME, r = PB.gameResult(sub.games);
    const ours = mine ? sub.pa : sub.pb, theirs = mine ? sub.pb : sub.pa;
    if (!r && !ours && !theirs) return '';
    const sc = r ? (mine ? `${r.pa}–${r.pb}` : `${r.pb}–${r.pa}`) : '';
    const won = r && r.winner === (mine ? 'a' : 'b');
    return `<div class="dp-live ${r ? (won ? 'win' : 'lose') : ''}"><span class="lv-tag">${r ? (won ? '✅ Thực tế: Thắng' : '❌ Thực tế: Thua') : '🔴 Đang đấu'}</span>
      <span>${esc(ours || '?')}</span><b>${sc || 'vs'}</b><span>${esc(theirs || '?')}</span></div>`;
  }
  function renderPlan() {
    const ties = myTies();
    if (!dpOpp || !ties.some((m) => oppOf(m) === dpOpp)) { const n = ties.find((m) => !PB.tieScore(m).complete); dpOpp = oppOf(n || ties[0]); }
    const m = ties.find((x) => oppOf(x) === dpOpp);
    const P = planFor(dpOpp);
    const d = dist(P.us, P.them), e = exp(P.us, P.them);
    const dupU = dups(P.us), dupT = dups(P.them);
    const sumTeam = (id) => players(id).reduce((s, p) => s + str(p.id), 0);
    const diff = sumTeam(ME) - sumTeam(dpOpp);
    const miss = [ME, dpOpp].filter((id) => skCount(id) < players(id).length * SK.length);
    const ts = PB.tieScore(m), mine = m.a === ME;
    const tieLive = ts.done ? `<div class="dp-tie ${ts.complete ? (ts.winner === (mine ? 'a' : 'b') ? 'win' : 'lose') : ''}">
        <span>${ts.complete ? '🏁 Kết quả lượt' : '🔴 Trực tiếp'} · ${ts.done}/4 nội dung</span>
        <b>${esc(tn(ME))} ${mine ? ts.wa : ts.wb} – ${mine ? ts.wb : ts.wa} ${esc(tn(dpOpp))}</b></div>` : '';
    return `${bar('Đấu pháp', 'Chỉ đội trưởng xem · bấm tên VĐV để ghi chú / đổi người')}
      <div class="chips cap-teams">${ties.map((x) => {
        const Q = planFor(oppOf(x)), t2 = PB.tieScore(x), mi = x.a === ME;
        return `<button class="chip ${oppOf(x) === dpOpp ? 'active' : ''}" data-dpo="${esc(oppOf(x))}">V${x.round} · ${esc(tn(oppOf(x)))} <small>${t2.done ? `${t2.complete ? '🏁' : '🔴'} ${mi ? t2.wa : t2.wb}–${mi ? t2.wb : t2.wa}` : `≈ ${exp(Q.us, Q.them).toFixed(1)}/4`}</small></button>`;
      }).join('')}</div>
      ${tieLive}
      <div class="card dp-lineup">
        <div class="dp-tools">
          <h3 class="card-h">⚔️ V${m.round} · ${esc(tn(ME))} vs ${esc(tn(dpOpp))}</h3>
          <label class="dp-scen"><select data-scen aria-label="Kịch bản đội bạn">${Object.entries(SCEN).map(([k, n]) => `<option value="${k}" ${P.scen === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        </div>
        <div class="dp-tools2">
          <span class="tag-ed ${P.editedUs ? '' : 'auto'}">${esc(tn(ME))}: ${P.editedUs ? 'tay' : 'tự động'}</span>
          <span class="tag-ed ${P.editedThem ? '' : 'auto'}">${esc(tn(dpOpp))}: ${P.editedThem ? 'tay' : 'dự đoán'}</span>
          <button class="btn xs ghost" data-dp="reset-them">↺ Đội bạn</button>
          <button class="btn xs primary" data-dp="opt">⚡ Tối ưu</button>
        </div>
        ${dupT.length || dupU.length ? `<p class="notice danger">⚠️ ${[...dupT, ...dupU].map((x) => esc(pName(x))).join(', ')} đang được xếp 2 nội dung (điều lệ: mỗi VĐV tối đa 1 nội dung/vòng).</p>` : ''}
        <div class="dp-head"><span>${esc(tn(ME))}</span><span></span><span>${esc(tn(dpOpp))}</span></div>
        <div class="dp-subs">${subs().map((s, i) => {
          const p = winP(P.us[s.key] || [], P.them[s.key] || []);
          const tips = subTips(P.us[s.key] || [], P.them[s.key] || []);
          return `<div class="dp-sub">
            <div class="dp-sh"><b>${esc(s.label)}</b>
              <button class="lockbtn ${P.lock[s.key] ? 'on' : ''}" data-lockbtn="${s.key}" title="Chốt cặp (đã báo) – giữ nguyên khi tối ưu">${P.lock[s.key] ? '🔒 Chốt' : '🔓'}</button></div>
            <div class="dp-vs2">
              <div class="dp-col us">${[0, 1].map((k) => chip((P.us[s.key] || [])[k], 'us', s.key, k)).join('')}</div>
              <div class="vs"><b class="dp-p ${p >= 0.55 ? 'up' : p <= 0.45 ? 'down' : ''}">${pct(p)}</b><i class="dp-bar"><i style="height:${p * 100}%"></i></i></div>
              <div class="dp-col them">${[0, 1].map((k) => chip((P.them[s.key] || [])[k], 'them', s.key, k)).join('')}</div>
            </div>
            ${liveSub(m, s)}
            ${tips.length ? `<details class="dp-tipbox"><summary>💡 Lưu ý (${tips.length})</summary><ul class="dp-tips">${tips.map((x) => `<li>${x}</li>`).join('')}</ul></details>` : ''}
          </div>`;
        }).join('')}</div>
      </div>

      <div class="dp-grid">
        <div class="card dp-sum"><h3 class="card-h">📈 Dự kiến lượt này</h3>
          <div class="nb-stats"><div><b>${e.toFixed(1)}</b><small>nội dung thắng /4</small></div><div><b>${pct(d[3] + d[4])}</b><small>thắng 3–1 / 4–0</small></div>
            <div><b>${pct(d[2])}</b><small>2–2 (xét điểm)</small></div><div><b>${pct(d[0] + d[1])}</b><small>thua 1–3 / 0–4</small></div></div></div>
        <div class="card"><h3 class="card-h">🔎 Đặc điểm ${esc(tn(dpOpp))}</h3>
          <ul class="dp-notes">${teamNotes(dpOpp).map((x) => `<li>${x}</li>`).join('')}</ul>
          <p class="dp-cmp">Tương quan sức cả đội: <b class="${diff >= 0 ? 'up' : 'down'}">${tn(ME)} ${diff >= 0.5 ? 'nhỉnh hơn' : diff <= -0.5 ? 'yếu hơn' : 'ngang'}</b> (${diff >= 0 ? '+' : ''}${diff.toFixed(1)})</p></div>
      </div>
      ${miss.length ? `<p class="notice">📝 Chưa nhập đủ kỹ năng của ${miss.map((id) => `<button class="linkbtn" data-goskill="${esc(id)}">${esc(tn(id))}</button>`).join(', ')}: đấu pháp đang dựa nhiều vào trình.</p>` : ''}
      <div class="callout rule-c">📜 <b>Báo cặp zic-zac:</b> nội dung mình <b>báo sau</b>: bấm VĐV đội bạn để chọn đúng cặp họ vừa báo, bấm <b>🔓 Chốt cặp</b> ở các nội dung đã báo, rồi <b>⚡ Tối ưu</b>. Nội dung mình <b>báo trước</b>: giữ cặp chắc chắn, ít điểm yếu.</div>`;
  }

  /* ---------- Cửa sổ VĐV: ghi chú + kỹ năng + đổi người ---------- */
  function openSheet(ctx) { sheet = ctx; drawSheet(); }
  function closeSheet() { sheet = null; const el = $('.cap-sheet'); if (el) el.remove(); document.body.style.overflow = ''; }
  function findPlayer(pid) { for (const t of T.teams) for (const p of t.players || []) if (p.id === pid) return { p, team: t.id }; return null; }
  function drawSheet() {
    let el = $('.cap-sheet');
    const keepNote = el && $('textarea', el) ? $('textarea', el).value : null;
    if (!el) { el = document.createElement('div'); el.className = 'mdl-bg cap-sheet'; document.body.appendChild(el); document.body.style.overflow = 'hidden'; }
    const { pid, side, key, i } = sheet;
    const info = pid ? findPlayer(pid) : null;
    let swap = '';
    if (side) {
      const P = planFor(dpOpp), L = side === 'us' ? P.us : P.them, team = side === 'us' ? ME : dpOpp;
      const s = subs().find((x) => x.key === key);
      const where = {}; Object.entries(L).forEach(([k, v]) => (v || []).forEach((x, j) => (where[x] = [k, j])));
      const ok = players(team).filter((p) => (s.mixed && i === 1 ? !isMaleSlot(p) : isMaleSlot(p))).sort(byLevel);
      swap = `<div class="pp-h">Đổi VĐV ${esc(tn(team))} cho ${esc(s.label)}</div><div class="pp-list">${ok.map((p) => {
        const w = where[p.id], cur = p.id === pid, lab = w ? subs().find((x) => x.key === w[0]).label : '';
        return `<button class="pp ${cur ? 'on' : ''}" data-swap="${esc(p.id)}" ${cur ? 'disabled' : ''}><span>${lvTag(p.id)} ${esc(p.name)}${NOTES[p.id] ? ' 📝' : ''}</span><small>${cur ? 'đang chọn' : w ? `đang ở ${esc(lab)} → đổi chỗ` : 'chưa xếp'}</small></button>`;
      }).join('')}</div>`;
    }
    const p = info && info.p;
    el.innerHTML = `<div class="mdl" role="dialog" aria-modal="true">
      <div class="mdl-h"><div><small>${info ? esc(tn(info.team)) : ''}${side ? ' · ' + esc(subs().find((x) => x.key === key).label) : ''}</small>
        <h3>${p ? `${p.gender === 'nu' ? '♀' : '♂'} ${esc(p.name)} ${lvTag(p.id)}` : 'Chọn VĐV'}</h3></div><button class="mdl-x" data-shx aria-label="Đóng">✕</button></div>
      ${p ? `<div class="sk-mini">${SK.map(([k, n]) => `<span class="sk-v" data-v="${sk(p.id, k) || ''}">${esc(n)}: ${sk(p.id, k) ? LVN[sk(p.id, k)] : '–'}</span>`).join('')}</div>
        <div class="pp-h">📝 Ghi chú về ${esc(p.name)}</div>
        <textarea class="note-in" rows="4" placeholder="VD: thuận tay trái, hay lốp khi bị ép, drive mạnh tay thuận…">${esc(keepNote != null ? keepNote : NOTES[p.id] || '')}</textarea>
        <div class="mdl-act"><button class="btn primary" data-note="${esc(p.id)}">💾 Lưu ghi chú</button></div>` : ''}
      ${swap}
      <div class="mdl-act"><button class="btn ghost" data-shx>Đóng</button></div></div>`;
  }
  function applySwap(np) {
    const { side, key, i } = sheet;
    const P = planFor(dpOpp);
    const L = JSON.parse(JSON.stringify(side === 'us' ? P.us : P.them));
    const old = (L[key] || [])[i];
    for (const [k, v] of Object.entries(L)) (v || []).forEach((x, j) => { if (x === np && !(k === key && j === i)) L[k][j] = old; });
    L[key] = L[key] || []; L[key][i] = np;
    const patch = side === 'us' ? { us: L } : { them: L };
    PLAN = { ...PLAN, [dpOpp]: { ...(PLAN[dpOpp] || {}), ...patch } };
    closeSheet(); render(); savePlan(dpOpp, patch);
    toast('Đã đổi: ' + pName(np));
  }

  function pwForm(forced) {
    return `<div class="card cap-gate"><div class="lock-ic">🔑</div><h2>${forced ? 'Đổi mật khẩu lần đầu' : 'Đổi mật khẩu'}</h2>
      <p class="muted">${forced ? `Tài khoản <b>${esc(acct().label)}</b> đăng nhập lần đầu: hãy <b>đặt mật khẩu riêng</b> ngay để giữ quyền riêng tư. Sau khi đổi, chỉ bạn biết mật khẩu này.` : 'Nhập mật khẩu hiện tại và mật khẩu mới.'}</p>
      <form class="cap-pw"><input name="o" type="password" placeholder="Mật khẩu hiện tại" autocomplete="current-password" aria-label="Mật khẩu hiện tại">
        <input name="n" type="password" placeholder="Mật khẩu mới (ít nhất 6 ký tự)" autocomplete="new-password" aria-label="Mật khẩu mới">
        <input name="n2" type="password" placeholder="Nhập lại mật khẩu mới" autocomplete="new-password" aria-label="Nhập lại mật khẩu mới">
        <button class="btn primary" type="submit">Đổi mật khẩu</button>
        ${forced ? '' : '<button class="btn ghost" type="button" data-cap="pw-cancel">Huỷ</button>'}
        <p class="cap-msg muted"></p></form>
      ${forced ? '<button class="linkbtn" data-cap="out">Đăng xuất</button>' : ''}</div>`;
  }
  function render() {
    const kn = $('#pane-ky-nang'), dp = $('#pane-dau-phap');
    if (!kn || !dp) return;
    const pane = tab === 'ky-nang' ? kn : tab === 'dau-phap' ? dp : null;
    if (!pane) return;
    const a = document.activeElement;
    if (a && pane.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'SELECT')) return; // đang thao tác, chờ xong
    if (!(tab === 'dau-phap' || tab === 'ky-nang')) closeSheet();
    const html = !isCap() ? `<section class="block"><div class="container">${gate()}</div></section>`
      : mustPw || pwOpen ? `<section class="block"><div class="container">${pwForm(mustPw)}</div></section>`
      : !T ? '<section class="block"><div class="container"><p class="muted">Đang tải dữ liệu giải…</p></div></section>'
      : `<section class="block"><div class="container">${tab === 'ky-nang' ? renderSkills() : renderPlan()}</div></section>`;
    pane.innerHTML = html;
  }

  /* ---------- Menu chọn mức kỹ năng ---------- */
  function openPop(cell) {
    closePop();
    const { pid, k } = cell.dataset, cur = sk(pid, k);
    const el = document.createElement('div');
    el.className = 'sk-pop'; el.setAttribute('role', 'menu');
    el.innerHTML = `<div class="sk-pop-h">${esc(pName(pid))} · ${esc(SKN[k])}</div>
      ${LVLS.map(([v, n]) => `<button role="menuitem" data-pick="${v}" data-v="${v}" class="${cur === v ? 'cur' : ''}">${n}${cur === v ? ' ✓' : ''}</button>`).join('')}
      ${cur ? '<button role="menuitem" data-pick="" class="clr">Bỏ chọn</button>' : ''}`;
    document.body.appendChild(el);
    const r = cell.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    let left = r.left + r.width / 2 - w / 2 + scrollX, top = r.bottom + 6 + scrollY;
    left = Math.max(8 + scrollX, Math.min(left, scrollX + document.documentElement.clientWidth - w - 8));
    if (r.bottom + h + 12 > innerHeight) top = r.top - h - 6 + scrollY;
    el.style.left = left + 'px'; el.style.top = top + 'px';
    cell.classList.add('open');
    pop = { el, pid, k, cell };
    el.querySelector('button').focus({ preventScroll: true });
  }
  function closePop() {
    if (!pop) return;
    pop.el.remove(); if (pop.cell) pop.cell.classList.remove('open');
    pop = null;
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePop(); closeSheet(); } });
  window.addEventListener('resize', closePop);

  /* ---------- Thao tác ---------- */
  document.addEventListener('submit', async (e) => {
    const pf = e.target.closest('.cap-pw');
    if (pf) {
      e.preventDefault();
      const msg = $('.cap-msg', pf), o = pf.o.value, n = pf.n.value;
      if (n.length < 6) { msg.textContent = 'Mật khẩu mới phải có ít nhất 6 ký tự.'; return; }
      if (n !== pf.n2.value) { msg.textContent = 'Hai lần nhập mật khẩu mới không khớp.'; return; }
      if (n === o) { msg.textContent = 'Mật khẩu mới phải khác mật khẩu hiện tại.'; return; }
      msg.textContent = 'Đang đổi…';
      try {
        await Store.changePassword(o, n);
        await Store.setAcct(user.email, { pwChanged: true }).catch(() => {});
        mustPw = false; pwOpen = false; toast('✅ Đã đổi mật khẩu'); render();
      } catch (er) {
        msg.textContent = /wrong-password|invalid/i.test(er.code || er.message) ? 'Mật khẩu hiện tại không đúng.' : /weak/i.test(er.code || '') ? 'Mật khẩu mới quá yếu.' : 'Chưa đổi được: ' + (er.code || er.message);
      }
      return;
    }
    const f = e.target.closest('.cap-login'); if (!f) return;
    e.preventDefault();
    const msg = $('.cap-msg', f);
    msg.textContent = 'Đang đăng nhập…';
    try { await Store.signIn(f.u.value, f.p.value); } catch (er) {
      msg.textContent = /wrong-password|invalid|user-not-found/i.test(er.code || er.message) ? 'Sai tài khoản hoặc mật khẩu.' : 'Không đăng nhập được: ' + (er.code || er.message);
    }
  });
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (t.closest('[data-cap="out"]')) { Store.signOut(); return; }
    const st = t.closest('[data-skt]'); if (st) { skTeam = st.dataset.skt; render(); return; }
    const gs = t.closest('[data-goskill]'); if (gs) { skTeam = gs.dataset.goskill; $('.nb-tabs [data-tab="ky-nang"]').click(); return; }
    if (sheet || $('.cap-sheet')) {
      if (t.closest('[data-shx]') || t.classList.contains('cap-sheet')) { closeSheet(); return; }
      const sw = t.closest('[data-swap]'); if (sw && !sw.disabled) { applySwap(sw.dataset.swap); return; }
      const nb = t.closest('[data-note]');
      if (nb) {
        const v = $('.cap-sheet textarea').value.trim(), pid = nb.dataset.note;
        NOTES = { ...NOTES, [pid]: v };
        Store.setCap(acct().plan, { n: { [pid]: v || Store.del() } }).then(() => toast('Đã lưu ghi chú')).catch((er) => toast('Chưa lưu được: ' + er.message));
        render(); return;
      }
      if (t.closest('.cap-sheet')) return;
    }
    const pc = t.closest('[data-ps]'); if (pc) { openSheet({ pid: pc.dataset.pid || null, side: pc.dataset.ps, key: pc.dataset.sub, i: +pc.dataset.i }); return; }
    const pn = t.closest('[data-pnote]'); if (pn) { openSheet({ pid: pn.dataset.pnote }); return; }
    const lb = t.closest('[data-lockbtn]');
    if (lb) {
      const P = planFor(dpOpp), k = lb.dataset.lockbtn;
      const lock = { ...P.lock, [k]: !P.lock[k] };
      PLAN = { ...PLAN, [dpOpp]: { ...(PLAN[dpOpp] || {}), lock, us: P.us } };
      render(); savePlan(dpOpp, { lock, us: P.us });
      return;
    }
    if (t.closest('[data-cap="pw"]')) { pwOpen = true; render(); scrollTo({ top: 0 }); return; }
    if (t.closest('[data-cap="pw-cancel"]')) { pwOpen = false; render(); return; }
    const pick = t.closest('.sk-pop [data-pick]');
    if (pick && pop) {
      const { pid, k } = pop, v = pick.dataset.pick || null;
      closePop();
      SKL = { ...SKL, [pid]: { ...(SKL[pid] || {}), [k]: v || undefined } };
      render();
      Store.setCap('skills', { s: { [pid]: { [k]: v || Store.del() } } }).catch((er) => toast('Chưa lưu được: ' + er.message));
      return;
    }
    const cell = t.closest('.sk-cell');
    if (cell) { openPop(cell); return; }
    if (pop && !t.closest('.sk-pop')) closePop();
    const o = t.closest('[data-dpo]'); if (o) { dpOpp = o.dataset.dpo; render(); return; }
    const a = t.closest('[data-dp]');
    if (a) {
      const P = planFor(dpOpp);
      if (a.dataset.dp === 'reset-them') {
        PLAN = { ...PLAN, [dpOpp]: { ...(PLAN[dpOpp] || {}), them: null } };
        savePlan(dpOpp, { them: Store.del() }); render();
        toast('Đã về kịch bản dự đoán');
      } else {
        // Không khoá nội dung nào → về chế độ tự động (luôn tối ưu theo đội hình đối thủ); có khoá → tối ưu phần còn lại
        const fixed = Object.fromEntries(Object.keys(P.lock).filter((k) => P.lock[k] && P.us[k]).map((k) => [k, P.us[k]]));
        const us = Object.keys(fixed).length ? bestResponse(P.them, fixed) : null;
        PLAN = { ...PLAN, [dpOpp]: { ...(PLAN[dpOpp] || {}), us } };
        savePlan(dpOpp, { us: us || Store.del() }); render();
        toast('Đã tối ưu đội hình ' + tn(ME));
      }
    }
  });
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-scen]')) {
      PLAN = { ...PLAN, [dpOpp]: { ...(PLAN[dpOpp] || {}), scen: t.value, them: null, us: null } };
      t.blur(); render();
      savePlan(dpOpp, { scen: t.value, them: Store.del(), us: Store.del() });
      return;
    }
    if (t.matches('[data-lock]')) {
      const P = planFor(dpOpp);
      const lock = { ...P.lock, [t.dataset.lock]: t.checked };
      // Khoá thì cố định đội hình hiện tại của mình (thôi tự động)
      PLAN = { ...PLAN, [dpOpp]: { ...(PLAN[dpOpp] || {}), lock, us: P.us } };
      savePlan(dpOpp, { lock, us: P.us });
      return;
    }
    if (t.matches('.dp-sub select')) {
      const P = planFor(dpOpp);
      const side = t.dataset.side, L = JSON.parse(JSON.stringify(side === 'us' ? P.us : P.them));
      L[t.dataset.sub][+t.dataset.i] = t.value;
      const patch = side === 'us' ? { us: L } : { them: L };
      PLAN = { ...PLAN, [dpOpp]: { ...(PLAN[dpOpp] || {}), ...patch } };
      t.blur(); render();
      savePlan(dpOpp, patch);
    }
  });
})();

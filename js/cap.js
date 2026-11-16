/*
 * Khu vực đội trưởng trên trang nội bộ (chỉ tài khoản "Cap"):
 *   📝 Kỹ năng VĐV — chấm Tốt / TB / Kém cho 7 kỹ năng của từng VĐV mọi đội
 *   ♟️ Đấu pháp     — đặc điểm từng đối thủ, kịch bản đưa quân của họ, đội hình tối ưu của mình (sửa tay được)
 * Dữ liệu: Firestore cap/skills { s: { pid: { drive: 'T'|'B'|'K', ... } } }
 *                    cap/plan   { r: { oppId: { them: {s0:[pid,pid],..}, us: {...}, lock: {s0:true}, scen: 'A'|'B' } } }
 */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = PB.esc;
  const SK = [['drive', 'Đoa/Drive'], ['luoi', 'Đánh lưới'], ['drop', 'Drop'], ['lop', 'Lốp'], ['nong', 'Nóng vội'], ['bao', 'Bao bóng'], ['ben', 'Bền bóng']];
  const SKN = Object.fromEntries(SK);
  const LVLS = [['T', 'Tốt'], ['B', 'TB'], ['K', 'Kém']];
  const VAL = { T: 1, B: 0, K: -1 };
  const W = { drive: 0.5, luoi: 0.6, drop: 0.5, lop: 0.3, nong: 0.4, bao: 0.35, ben: 0.5 };
  // Cặp "điểm mạnh của bên này ↔ điểm yếu của bên kia"
  const EDGES = [['drive', 'luoi'], ['lop', 'bao'], ['ben', 'nong'], ['drop', 'drive']];
  const GOOD = { drive: 'drive tốt', luoi: 'đánh lưới tốt', drop: 'drop tốt', lop: 'lốp tốt', nong: 'bình tĩnh', bao: 'bao bóng tốt', ben: 'bền bóng' };
  const BAD = { drive: 'drive kém', luoi: 'đánh lưới kém', drop: 'drop kém', lop: 'lốp kém', nong: 'hay nóng vội', bao: 'bao bóng kém', ben: 'bền bóng kém' };
  const SCEN = { A: 'Xếp mạnh trước (khả năng cao nhất)', B: 'Dàn đều sức các cặp' };

  let user = null, T = null, LV = {}, ME = 'doi2', SKL = {}, PLAN = {}, unsub = [], skTeam = null, dpOpp = null, tab = null, err = '';

  /* ---------- Dữ liệu từ trang nội bộ ---------- */
  document.addEventListener('nb:data', (e) => { ({ T, LV, me: ME } = e.detail); render(); });
  document.addEventListener('nb:tab', (e) => { tab = e.detail; render(); });
  Store.onUser((u) => {
    user = u; err = '';
    unsub.forEach((f) => f()); unsub = [];
    if (isCap()) {
      const fail = (er) => { err = /permission/i.test(er.message) ? 'Firebase chưa cho phép tài khoản Cap đọc dữ liệu: cần dán lại luật bảo mật mới (firestore.rules).' : er.message; render(); };
      unsub.push(Store.watchCap('skills', (d) => { SKL = d.s || {}; render(); }, fail));
      unsub.push(Store.watchCap('plan', (d) => { PLAN = d.r || {}; render(); }, fail));
    }
    render();
  });
  const isCap = () => user && user.email === Store.CAP_EMAIL;

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
    drop: (n) => `<b>${n}</b> drop kém → ép ${n} đánh quả thứ 3 từ cuối sân`,
    lop: (n) => `<b>${n}</b> lốp kém → có thể dâng sát lưới ép ${n}`,
    nong: (n) => `<b>${n}</b> hay nóng vội → kéo dài rally, đánh chắc chờ ${n} tự lỗi`,
    bao: (n) => `<b>${n}</b> bao bóng kém → đánh vào giữa và khoảng trống phía ${n}`,
    ben: (n) => `<b>${n}</b> bền bóng kém → giữ bóng qua lưới thêm vài quả, ${n} sẽ tự lỗi`
  };
  const CAUTION = {
    drive: (n) => `<b>${n}</b> drive mạnh → block chắc, vợt trước ngực, không đôi công`,
    luoi: (n) => `<b>${n}</b> lưới chắc → tránh đẩy bóng cao ở lưới, ưu tiên reset`,
    drop: (n) => `<b>${n}</b> drop hay → chuẩn bị chân sớm, xử lý bóng thấp`,
    lop: (n) => `<b>${n}</b> hay lốp → người đứng lưới đừng dâng quá sát`,
    nong: (n) => `<b>${n}</b> rất bình tĩnh → đừng trông chờ tự lỗi, phải chủ động tạo thế`,
    bao: (n) => `<b>${n}</b> bao sân rộng → đánh dọc biên phía ${n} bỏ trống`,
    ben: (n) => `<b>${n}</b> bền bóng → chuẩn bị rally dài, kiên nhẫn`
  };
  const USE = { drive: 'drive tốt', luoi: 'lưới chắc', drop: 'drop tốt', lop: 'lốp tốt', nong: 'bình tĩnh', bao: 'bao sân tốt', ben: 'bền bóng' };
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
      <p class="muted">Đang đăng nhập: <b>${esc(Store.loginToPhone(user.email))}</b>. Khu vực này chỉ dành cho tài khoản <b>Cap</b>.</p>
      <button class="btn ghost" data-cap="out">Đăng xuất</button></div>`;
    return `<div class="card cap-gate"><div class="lock-ic">🔒</div><h2>Khu vực đội trưởng</h2>
      <p class="muted">Chỉ tài khoản <b>Cap</b> đăng nhập mới xem được kỹ năng VĐV và đấu pháp.</p>
      <form class="cap-login"><input name="u" placeholder="Tài khoản" value="Cap" autocomplete="username" aria-label="Tài khoản">
        <input name="p" type="password" placeholder="Mật khẩu" autocomplete="current-password" aria-label="Mật khẩu">
        <button class="btn primary" type="submit">Đăng nhập</button><p class="cap-msg muted"></p></form></div>`;
  }
  const bar = (title, eyebrow) => `<div class="section-head"><div><div class="eyebrow">${eyebrow}</div><h2 class="display">${title}</h2></div>
    <span class="cap-who">🔓 ${esc(Store.loginToPhone(user.email))} · <button class="linkbtn" data-cap="out">Đăng xuất</button></span></div>
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
      <p class="muted cap-legend"><span class="sk-b on" data-v="T">Tốt</span> <span class="sk-b on" data-v="B">TB</span> <span class="sk-b on" data-v="K">Kém</span>
        Bấm lại mức đang chọn để bỏ. <b>Nóng vội:</b> Tốt = bình tĩnh, Kém = hay nóng vội. VĐV xếp theo trình T1 (cao nhất) → T6.</p>
      <div class="chips cap-teams">${ids.map((id) => `<button class="chip ${id === skTeam ? 'active' : ''}" data-skt="${esc(id)}">${id === ME ? '⭐ ' : 'V' + roundOf(id) + ' · '}${esc(tn(id))} <small>${skCount(id)}/${players(id).length * SK.length}</small></button>`).join('')}</div>
      <div class="card sk-card"><div class="sk-head"><h3>${esc(tn(skTeam))}</h3><span class="muted">Đã nhập ${skCount(skTeam)}/${total} ô</span></div>
      <p class="muted sk-swipe">← Vuốt ngang bảng để xem đủ 7 kỹ năng →</p>
      <div class="table-wrap"><table class="sk-table">
        <thead><tr><th class="l">VĐV</th><th>Trình</th>${SK.map(([, n]) => `<th>${n}</th>`).join('')}</tr></thead>
        <tbody>${ps.map((p) => `<tr><td class="l"><span class="${p.gender === 'nu' ? 'f' : ''}">${p.gender === 'nu' ? '♀' : '♂'} ${esc(p.name)}</span></td><td>${lvTag(p.id)}</td>
          ${SK.map(([k]) => `<td><span class="sk-seg" role="group" aria-label="${esc(SKN[k])} – ${esc(p.name)}">${LVLS.map(([v, n]) => `<button class="sk-b ${sk(p.id, k) === v ? 'on' : ''}" data-v="${v}" data-pid="${esc(p.id)}" data-k="${k}" title="${esc(SKN[k])}: ${n}">${n}</button>`).join('')}</span></td>`).join('')}</tr>`).join('')}
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
    return `${bar('Đấu pháp', 'Chỉ đội trưởng xem · tính theo trình + kỹ năng')}
      <div class="chips cap-teams">${ties.map((x) => {
        const Q = planFor(oppOf(x));
        return `<button class="chip ${oppOf(x) === dpOpp ? 'active' : ''}" data-dpo="${esc(oppOf(x))}">V${x.round} · ${esc(tn(oppOf(x)))} <small>≈ ${exp(Q.us, Q.them).toFixed(1)}/4</small></button>`;
      }).join('')}</div>
      ${miss.length ? `<p class="notice">📝 Chưa nhập đủ kỹ năng của ${miss.map((id) => `<button class="linkbtn" data-goskill="${esc(id)}">${esc(tn(id))}</button>`).join(', ')}: đấu pháp đang dựa nhiều vào trình. Nhập thêm ở tab <b>Kỹ năng VĐV</b> để chính xác hơn.</p>` : ''}
      <div class="dp-grid">
        <div class="card"><h3 class="card-h">🔎 Đặc điểm ${esc(tn(dpOpp))} <small class="muted">· Vòng ${m.round}</small></h3>
          <ul class="dp-notes">${teamNotes(dpOpp).map((x) => `<li>${x}</li>`).join('')}</ul>
          <p class="dp-cmp">Tương quan sức cả đội: <b class="${diff >= 0 ? 'up' : 'down'}">${tn(ME)} ${diff >= 0.5 ? 'nhỉnh hơn' : diff <= -0.5 ? 'yếu hơn' : 'ngang'}</b> (${diff >= 0 ? '+' : ''}${diff.toFixed(1)})</p></div>
        <div class="card dp-sum"><h3 class="card-h">📈 Dự kiến lượt này</h3>
          <div class="nb-stats"><div><b>${e.toFixed(1)}</b><small>nội dung thắng /4</small></div><div><b>${pct(d[3] + d[4])}</b><small>thắng lượt (≥3)</small></div>
            <div><b>${pct(d[2])}</b><small>hoà 2–2</small></div><div><b>${pct(d[0] + d[1])}</b><small>thua lượt</small></div></div>
          <p class="muted">Xếp hạng theo hiệu số nội dung, nên đội hình được tối ưu để thắng nhiều nội dung nhất (đôi khi chấp nhận 1 nội dung khó).</p></div>
      </div>

      <div class="card dp-lineup">
        <div class="dp-tools">
          <h3 class="card-h">⚔️ Kịch bản đưa quân</h3>
          <label class="dp-scen">Đối thủ: <select data-scen>${Object.entries(SCEN).map(([k, n]) => `<option value="${k}" ${P.scen === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          ${P.editedThem ? '<span class="tag-ed">đối thủ: đã chỉnh tay</span>' : ''}
          <span class="tag-ed ${P.editedUs ? '' : 'auto'}">${esc(tn(ME))}: ${P.editedUs ? 'đã chỉnh tay / cố định' : 'tự động tối ưu'}</span>
          <button class="btn sm ghost" data-dp="reset-them">↺ Về kịch bản dự đoán</button>
          <button class="btn sm primary" data-dp="opt">⚡ Tối ưu ${esc(tn(ME))}</button>
        </div>
        ${dupT.length || dupU.length ? `<p class="notice danger">⚠️ ${[...dupT, ...dupU].map((x) => esc(pName(x))).join(', ')} đang được xếp 2 nội dung (điều lệ: mỗi VĐV tối đa 1 nội dung/vòng).</p>` : ''}
        <div class="dp-subs">${subs().map((s, i) => {
          const p = winP(P.us[s.key] || [], P.them[s.key] || []);
          return `<div class="dp-sub">
            <div class="dp-sh"><b>${i + 1} · ${esc(s.label)}</b><span class="dp-p ${p >= 0.55 ? 'up' : p <= 0.45 ? 'down' : ''}">Thắng ${pct(p)}</span></div>
            <div class="dp-bar"><i style="width:${p * 100}%"></i></div>
            <div class="dp-vs">
              <div class="dp-side them"><small>${esc(tn(dpOpp))}</small>${[0, 1].map((k) => sel(dpOpp, s, 'them', k, (P.them[s.key] || [])[k], P.them)).join('')}</div>
              <div class="dp-side us"><small>${esc(tn(ME))} <label class="dp-lock" title="Đã báo cặp / giữ cố định khi tối ưu"><input type="checkbox" data-lock="${s.key}" ${P.lock[s.key] ? 'checked' : ''}> giữ</label></small>${[0, 1].map((k) => sel(ME, s, 'us', k, (P.us[s.key] || [])[k], P.us)).join('')}</div>
            </div>
            <ul class="dp-tips">${subTips(P.us[s.key] || [], P.them[s.key] || []).map((x) => `<li>${x}</li>`).join('')}</ul>
          </div>`;
        }).join('')}</div>
        <div class="callout rule-c">📜 <b>Báo cặp zic-zac:</b> ở nội dung mình được <b>báo sau</b>, chọn đúng cặp đối phương vừa báo trong ô bên trái, tích <b>“giữ”</b> các nội dung đã báo, rồi bấm <b>⚡ Tối ưu</b> để có cặp đối phó tốt nhất. Ở nội dung mình <b>báo trước</b>, nên giữ cặp chắc chắn, ít điểm yếu.</div>
      </div>`;
  }

  function render() {
    const kn = $('#pane-ky-nang'), dp = $('#pane-dau-phap');
    if (!kn || !dp) return;
    const pane = tab === 'ky-nang' ? kn : tab === 'dau-phap' ? dp : null;
    if (!pane) return;
    const a = document.activeElement;
    if (a && pane.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'SELECT')) return; // đang thao tác, chờ xong
    const html = !isCap() ? `<section class="block"><div class="container">${gate()}</div></section>`
      : !T ? '<section class="block"><div class="container"><p class="muted">Đang tải dữ liệu giải…</p></div></section>'
      : `<section class="block"><div class="container">${tab === 'ky-nang' ? renderSkills() : renderPlan()}</div></section>`;
    pane.innerHTML = html;
  }

  /* ---------- Thao tác ---------- */
  document.addEventListener('submit', async (e) => {
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
    const b = t.closest('.sk-b[data-pid]');
    if (b) {
      const { pid, k, v } = b.dataset;
      const next = sk(pid, k) === v ? null : v;
      SKL = { ...SKL, [pid]: { ...(SKL[pid] || {}), [k]: next || undefined } };
      render();
      Store.setCap('skills', { s: { [pid]: { [k]: next || Store.del() } } }).catch((er) => toast('Chưa lưu được: ' + er.message));
      return;
    }
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

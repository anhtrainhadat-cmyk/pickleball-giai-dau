/* Khu vực Ban tổ chức: đăng nhập, nhập kết quả, đội & chấm trình (ẩn với khán giả), dự đoán */
(function () {
  const esc = PB.esc;
  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');
  let T = null, ratings = {}, preds = [], tab = 'ket-qua', round = null, watching = false, pending = false;
  // Danh sách đội chuẩn do BTC công bố (data/doi-hinh.json) — dùng để cập nhật 1 lần bấm
  let ROSTER = null;
  fetch('data/doi-hinh.json?v=' + Date.now(), { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then((j) => { ROSTER = j; if (T) schedule(); }).catch(() => {});
  const sameRoster = () => !ROSTER || ROSTER.teams.every((rt) => {
    const t = (T.teams || []).find((x) => x.id === rt.id);
    return t && t.captain === rt.captain && (T.reserves || '') === (ROSTER.reserves || '') &&
      rt.players.every((p, i) => t.players && t.players[i] && t.players[i].name === p.name && t.players[i].gender === p.gender && (t.players[i].note || '') === (p.note || ''));
  });

  /* ---------- Chưa cấu hình Firebase ---------- */
  if (!Store.enabled) {
    app.innerHTML = `<div class="card login" style="max-width:640px">
      <h2>Chưa kích hoạt hệ thống BTC</h2>
      <p class="muted">Website chưa được kết nối Firebase (miễn phí) nên chưa có tài khoản đăng nhập, nhập kết quả trực tiếp, chấm trình và dự đoán của khán giả.</p>
      <p>Làm theo hướng dẫn trong file <code>HUONG-DAN-FIREBASE.md</code> của kho GitHub, sau đó dán cấu hình vào <code>js/config.js</code>.</p>
      <a class="btn" href="index.html">← Về trang giải</a></div>`;
    return;
  }

  /* ---------- Đăng nhập ---------- */
  function loginView(err) {
    $('#who').innerHTML = '';
    app.innerHTML = `<form class="card login" id="login">
      <h2>Đăng nhập BTC</h2>
      <p class="muted" style="margin-top:0">Dành cho thành viên Ban tổ chức nhập kết quả và chấm trình VĐV.</p>
      <div class="form-grid" style="grid-template-columns:1fr">
        <label class="f">Số điện thoại<input type="tel" name="phone" required autocomplete="username" inputmode="tel" placeholder="VD: 0912345678"></label>
        <label class="f">Mật khẩu<input type="password" name="pw" required autocomplete="current-password"></label>
      </div>
      <p class="hint" id="login-msg" style="color:var(--danger)">${esc(err || '')}</p>
      <div class="toolbar" style="margin-top:12px"><button class="btn primary" type="submit">Đăng nhập</button></div>
      <p class="hint">Quên mật khẩu? Liên hệ Trưởng BTC <b>${esc((window.SITE_CONFIG || {}).head || '')}</b> để cấp lại.</p>
    </form>`;
    $('#login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      $('#login-msg').textContent = 'Đang đăng nhập…';
      try { await Store.signIn(fd.get('phone'), fd.get('pw')); }
      catch (er) { $('#login-msg').textContent = 'Sai số điện thoại hoặc mật khẩu.'; }
    });
  }

  Store.onAuth((user, ok) => {
    if (!user) return loginView();
    $('#who').innerHTML = `<span class="pill-status ${ok ? 'ok' : 'off'}">📱 ${esc(Store.loginToPhone(user.email))}</span><button class="btn sm ghost" id="logout">Đăng xuất</button>`;
    $('#logout').addEventListener('click', () => Store.signOut());
    if (!ok) {
      app.innerHTML = `<div class="card login"><h2>Chưa có quyền BTC</h2><p class="muted">Tài khoản <b>${esc(Store.loginToPhone(user.email))}</b> đã đăng nhập nhưng chưa được thêm vào danh sách BTC. Trưởng BTC thêm <code>${esc(user.email)}</code> vào Firebase Console › Firestore › <code>admins</code>.</p></div>`;
      return;
    }
    if (!watching) {
      watching = true;
      Store.watch((t) => { T = t; schedule(); }, (e) => toast('Lỗi tải dữ liệu: ' + e.message));
      Store.watchRatings((r) => { ratings = r; schedule(); }, () => {});
      Store.watchPredictions((l) => { preds = l || []; schedule(); }, () => {});
    }
    schedule();
  });

  /* Không vẽ lại khi đang gõ dở — đợi rời ô nhập */
  function schedule() {
    const a = document.activeElement;
    if (a && app.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) { pending = true; return; }
    render();
  }
  app.addEventListener('focusout', () => setTimeout(() => {
    if (!pending) return;
    const a = document.activeElement;
    if (a && app.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
    pending = false; render();
  }, 0));

  /* ---------- Giao diện BTC ---------- */
  const TABS = [['ket-qua', '🏓 Nhập kết quả'], ['doi', '👥 Đội & chấm trình'], ['du-doan', '🎯 Dự đoán'], ['cai-dat', '⚙️ Cài đặt']];
  function render() {
    if (!T) { app.innerHTML = '<p class="empty">Đang tải dữ liệu giải…</p>'; return; }
    if (T._seedNeeded) {
      app.innerHTML = `<div class="card login" style="max-width:620px"><h2>Khởi tạo dữ liệu giải</h2>
        <p>Hệ thống chưa có dữ liệu. Bấm nút dưới để tạo 8 đội và lịch 7 vòng (28 lượt đấu) từ file <code>data/giai-dau.json</code>.</p>
        <button class="btn primary" id="seed">Khởi tạo dữ liệu</button></div>`;
      $('#seed').addEventListener('click', async (e) => {
        e.target.disabled = true;
        try { await Store.seed(T); toast('Đã khởi tạo dữ liệu'); } catch (er) { toast('Lỗi: ' + er.message); e.target.disabled = false; }
      });
      return;
    }
    const y = scrollY;
    const views = { 'ket-qua': resultsView, doi: teamsView, 'du-doan': predsView, 'cai-dat': settingsView };
    app.innerHTML = rosterBanner() + `<nav class="tabs" style="margin-top:0">${TABS.map(([k, v]) => `<button data-tab="${k}" class="${k === tab ? 'active' : ''}">${v}</button>`).join('')}</nav>
      <div id="pane">${views[tab]()}</div>`;
    if (tab === 'ket-qua') attachDatalists();
    scrollTo(0, y);
  }

  function rosterBanner() {
    return sameRoster() ? '' : `<div class="notice warn" style="margin-bottom:16px">
        <b>📋 Có danh sách 8 đội chính thức (${ROSTER.teams.reduce((n, t) => n + t.players.length, 0)} VĐV, cập nhật ${esc(ROSTER.version)})</b> khác với dữ liệu hiện tại.
        <p style="margin:6px 0 10px">Bấm để điền đội trưởng, tên VĐV, giới tính và VĐV dự bị cho cả 8 đội. Tên đội bạn đã tự đổi, trình VĐV đã chấm và dự đoán của khán giả <b>được giữ nguyên</b>.</p>
        <button class="btn primary" data-act="apply-roster">⤓ BẤM VÀO ĐÂY ĐỂ CẬP NHẬT DANH SÁCH 8 ĐỘI</button></div>`;
  }

  /* --- Nhập kết quả --- */
  function resultsView() {
    const rounds = [...new Set(T.matches.map((m) => m.round))].sort((a, b) => a - b);
    if (!rounds.length) return '<p class="empty">Đang tải lịch thi đấu…</p>';
    if (round === null || !rounds.includes(round)) {
      const pend = T.matches.filter((m) => !PB.result(m));
      round = pend.length ? Math.min(...pend.map((m) => m.round)) : rounds[rounds.length - 1];
    }
    const done = T.matches.filter((m) => PB.result(m)).length;
    return `<div class="card" style="margin-bottom:16px">
        <div class="toolbar" style="justify-content:space-between"><b>${done}/${T.matches.length} lượt đấu đã xong</b><span class="saving">Lưu tự động · khán giả thấy ngay</span></div>
        <p class="hint">Nhập tỉ số mỗi nội dung theo thứ tự <b>đội trái – đội phải</b>, VD <code>15-12</code>. Xử thua do vi phạm: <code>0-15</code> hoặc <code>15-0</code>. Ô hai bên để ghi cặp VĐV (gợi ý theo danh sách đội). Xoá trắng ô tỉ số để huỷ kết quả.</p>
      </div>
      <div class="chips" style="margin-bottom:14px">${rounds.map((r) => {
        const ok = T.matches.filter((m) => m.round === r).every((m) => PB.result(m));
        return `<button class="chip ${r === round ? 'active' : ''}" data-round="${r}">Vòng ${r}${ok ? ' ✓' : ''}</button>`;
      }).join('')}</div>
      <div class="match-list ties">${T.matches.filter((m) => m.round === round).map((m) => PB.renderMatch(T, m, { editable: true })).join('')}</div>
      <h2 class="stage-title">Bảng xếp hạng</h2><div class="card">${PB.renderStandings(T, 'A')}</div>
      ${T.teams.map((x) => `<datalist id="dl-${esc(x.id)}">${(x.players || []).filter((p) => p.name).map((p) => `<option value="${esc(p.name)}">`).join('')}</datalist>`).join('')}`;
  }
  function attachDatalists() {
    app.querySelectorAll('.sub-edit input[data-f="pa"], .sub-edit input[data-f="pb"]').forEach((inp) => {
      const m = T.matches.find((x) => x.id === inp.dataset.mid);
      if (m) inp.setAttribute('list', 'dl-' + (inp.dataset.f === 'pa' ? m.a : m.b));
    });
  }

  /* --- Đội & chấm trình --- */
  function teamsView() {
    const lv = (pid) => ratings[pid] || 0;
    return `<p class="notice" style="margin-bottom:16px">🔒 <b>Trình VĐV (1 – 2 – 3) chỉ BTC nhìn thấy.</b> Khán giả chỉ thấy tên đội, đội trưởng và tên VĐV. Bấm lại vào mức đang chọn để bỏ chấm.</p>
      <div class="team-admin">${T.teams.map((x, ti) => {
        const ps = Array.isArray(x.players) ? x.players : [];
        const rated = ps.filter((p) => lv(p.id));
        const sum = rated.reduce((s, p) => s + lv(p.id), 0);
        return `<div class="card">
          <div class="form-grid" style="grid-template-columns:1fr 1fr;margin-bottom:8px">
            <label class="f">Tên đội<input data-ti="${ti}" data-tf="name" value="${esc(x.name)}"></label>
            <label class="f">Đội trưởng<input data-ti="${ti}" data-tf="captain" value="${esc(x.captain || '')}"></label>
          </div>
          ${ps.map((p, pi) => `<div class="player-row">
            <span class="no">${pi + 1}</span>
            <input data-ti="${ti}" data-pi="${pi}" data-pf="name" value="${esc(p.name)}" placeholder="Tên VĐV" aria-label="Tên VĐV ${pi + 1}">
            <select data-ti="${ti}" data-pi="${pi}" data-pf="gender" aria-label="Giới tính"><option value="nam" ${p.gender !== 'nu' ? 'selected' : ''}>Nam</option><option value="nu" ${p.gender === 'nu' ? 'selected' : ''}>Nữ</option></select>
            <span class="lvl" role="group" aria-label="Trình">${[1, 2, 3].map((l) => `<button type="button" data-pid="${esc(p.id)}" data-l="${l}" class="${lv(p.id) === l ? 'on' : ''}" title="Trình ${l}">${l}</button>`).join('')}</span>
          </div>`).join('')}
          <p class="sum-lvl">Đã chấm ${rated.length}/${ps.length} VĐV · tổng trình <b>${sum}</b>${rated.length ? ` · trung bình <b>${(sum / rated.length).toFixed(2)}</b>` : ''}</p>
        </div>`;
      }).join('')}</div>`;
  }

  /* --- Dự đoán --- */
  function predsView() {
    const pod = PB.podium(T);
    const hit = (p) => pod.length === 3 && p.champion === pod[0] && p.second === pod[1] && p.third === pod[2];
    const name = (id) => PB.teamName(T, id);
    const winners = preds.filter(hit);
    return `<div class="card" style="margin-bottom:16px"><div class="toolbar" style="justify-content:space-between">
        <div><b>${preds.length}</b> lượt dự đoán · Cổng dự đoán: <b style="color:${T.predictionsOpen ? '#4ade80' : 'var(--danger)'}">${T.predictionsOpen ? 'ĐANG MỞ' : 'ĐÃ KHOÁ'}</b></div>
        <div class="toolbar"><button class="btn sm ${T.predictionsOpen ? 'danger' : 'primary'}" data-act="toggle-pred">${T.predictionsOpen ? '🔒 Khoá dự đoán' : '🔓 Mở dự đoán'}</button><button class="btn sm" data-act="csv">⤓ Tải danh sách (CSV)</button></div></div>
        <p class="hint">Nên khoá dự đoán khi vòng 1 bắt đầu. Sau khi có kết quả chung cuộc, người đoán đúng cả Nhất – Nhì – Ba được đánh dấu 🎯.</p></div>
      ${pod.length === 3 ? `<div class="card" style="margin-bottom:16px"><h3>🎯 Đoán trúng cả 3 vị trí: ${winners.length}</h3>${winners.map((p) => `<div>${esc(p.name)} — ${p.createdAt.toLocaleString('vi-VN')}</div>`).join('') || '<p class="muted">Không có ai.</p>'}</div>` : ''}
      <div class="table-wrap card"><table class="standings"><thead><tr><th>#</th><th class="l">Tên</th><th class="l">🥇</th><th class="l">🥈</th><th class="l">🥉</th><th>Thời gian</th><th></th></tr></thead><tbody>
      ${preds.map((p, i) => `<tr class="${hit(p) ? 'adv' : ''}"><td>${preds.length - i}</td><td class="l">${esc(p.name)}</td><td class="l">${esc(name(p.champion))}</td><td class="l">${esc(name(p.second))}</td><td class="l">${esc(name(p.third))}</td><td>${p.createdAt.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</td><td><button class="icon-btn" data-del="${esc(p.id)}" title="Xoá">✕</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Chưa có dự đoán.</td></tr>'}
      </tbody></table></div>`;
  }

  /* --- Cài đặt --- */
  function settingsView() {
    return `<div class="card"><h3>Trạng thái giải</h3>
      <label class="f" style="max-width:320px">Trạng thái<select data-ev="status">${['sap-dien-ra', 'dang-dien-ra', 'da-ket-thuc'].map((k) => `<option value="${k}" ${T.status === k ? 'selected' : ''}>${PB.STATUS[k]}</option>`).join('')}</select></label>
      <h3 style="margin-top:22px">Sao lưu</h3>
      <p class="muted">Tải toàn bộ dữ liệu (đội, kết quả, trình VĐV, dự đoán) về máy để lưu trữ.</p>
      <button class="btn" data-act="backup">⤓ Tải bản sao lưu</button>
      <h3 style="margin-top:22px">Thêm thành viên BTC</h3>
      <ol class="guide muted"><li>Firebase Console › Security › Authentication › Users › <b>Add user</b>: Email = <code>SỐĐIỆNTHOẠI@dao97open.vn</code> (VD <code>0912345678@dao97open.vn</code>), mật khẩu ≥ 6 ký tự.</li>
      <li>Firestore › collection <code>admins</code> › <b>Add document</b>: Document ID = đúng chuỗi trên, thêm trường <code>role</code> = <code>btc</code>.</li>
      <li>Người đó đăng nhập trang BTC bằng <b>số điện thoại + mật khẩu</b>.</li></ol></div>`;
  }

  /* ---------- Sự kiện ---------- */
  app.addEventListener('click', async (e) => {
    const tb = e.target.closest('[data-tab]');
    if (tb) { tab = tb.dataset.tab; render(); return; }
    const rb = e.target.closest('[data-round]');
    if (rb) { round = +rb.dataset.round; render(); return; }
    const lb = e.target.closest('.lvl button');
    if (lb) {
      const pid = lb.dataset.pid, l = +lb.dataset.l;
      const next = ratings[pid] === l ? null : l;
      try { await Store.saveRating(pid, next); } catch (er) { toast('Không lưu được trình: ' + er.message); }
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      if (!confirm('Xoá dự đoán này?')) return;
      try { await Store.deletePrediction(del.dataset.del); toast('Đã xoá'); } catch (er) { toast('Lỗi: ' + er.message); }
      return;
    }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'apply-roster') {
      if (!ROSTER || !confirm('Cập nhật đội trưởng và danh sách VĐV của 8 đội theo danh sách chính thức?')) return;
      // Giữ nguyên id đội/VĐV (để không ảnh hưởng dự đoán và trình đã chấm) và tên đội nếu BTC đã tự đặt
      const teams = T.teams.map((t) => {
        const rt = ROSTER.teams.find((x) => x.id === t.id);
        if (!rt) return t;
        return { ...t, name: /^Team \d+$/.test(t.name || '') || !t.name ? rt.name : t.name, captain: rt.captain,
          players: rt.players.map((p, i) => ({ ...(t.players && t.players[i] ? t.players[i] : {}), ...p, id: (t.players && t.players[i] && t.players[i].id) || p.id })) };
      });
      try { a.disabled = true; await Store.saveEvent({ teams, reserves: ROSTER.reserves || '' }); toast('Đã cập nhật danh sách 8 đội'); }
      catch (er) { a.disabled = false; toast('Lỗi: ' + er.message); }
      return;
    }
    if (a.dataset.act === 'toggle-pred') {
      try { await Store.saveEvent({ predictionsOpen: !T.predictionsOpen }); } catch (er) { toast('Lỗi: ' + er.message); }
    } else if (a.dataset.act === 'csv') {
      const name = (id) => PB.teamName(T, id);
      const rows = [['Ten', 'Vo dich', 'Nhi', 'Ba', 'Thoi gian']].concat(preds.map((p) => [p.name, name(p.champion), name(p.second), name(p.third), p.createdAt.toLocaleString('vi-VN')]));
      download('du-doan-dao97.csv', '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
    } else if (a.dataset.act === 'backup') {
      download('sao-luu-dao97-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify({ tournament: T, ratings, predictions: preds }, null, 2), 'application/json');
    }
  });

  let teamTimer;
  app.addEventListener('change', async (e) => {
    const el = e.target;
    try {
      if (el.dataset.mid) {
        const m = T.matches.find((x) => x.id === el.dataset.mid); if (!m) return;
        const f = el.dataset.f;
        if (el.dataset.sub !== undefined) {
          const sub = m.subs[+el.dataset.sub];
          if (f === 'games') {
            const g = PB.parseGames(el.value);
            if (g === null || (g.length && !PB.gameResult(g))) { el.classList.add('invalid'); toast('Tỉ số chưa đúng, VD: 15-12'); return; }
            el.classList.remove('invalid');
            await Store.saveSub(m.id, sub.key, 'sc', PB.formatGames(g));
          } else await Store.saveSub(m.id, sub.key, f, el.value.trim());
        } else await Store.saveMatch(m.id, f, el.value.trim());
        return;
      }
      if (el.dataset.ev) { await Store.saveEvent({ [el.dataset.ev]: el.value }); toast('Đã lưu'); return; }
      if (el.dataset.ti !== undefined) {
        const teams = JSON.parse(JSON.stringify(T.teams));
        const tm = teams[+el.dataset.ti];
        if (el.dataset.tf) tm[el.dataset.tf] = el.value.trim();
        else tm.players[+el.dataset.pi][el.dataset.pf] = el.value.trim();
        T.teams = teams;
        clearTimeout(teamTimer);
        teamTimer = setTimeout(() => Store.saveEvent({ teams: T.teams }).then(() => toast('Đã lưu')).catch((er) => toast('Lỗi: ' + er.message)), 150);
      }
    } catch (er) { toast('Không lưu được: ' + er.message); }
  });

  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
})();

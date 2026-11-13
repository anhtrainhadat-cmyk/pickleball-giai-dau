(function () {
  const C = window.SITE_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const esc = PB.esc;
  let T = null, preds = null, round = null, predCache = { sig: null, val: null };

  /* ---------- Đếm ngược ---------- */
  const start = new Date(C.eventStart).getTime(), end = new Date(C.eventEnd).getTime();
  function tick() {
    const now = Date.now();
    if (now < start) {
      let s = Math.floor((start - now) / 1000);
      const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
      s %= 60;
      $('#cd-title').textContent = 'Khai mạc sau';
      $('#cd-text').textContent = `${d} ngày ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    } else if (now < end) { $('#cd-title').textContent = 'Trạng thái'; $('#cd-text').textContent = '🔴 Đang diễn ra'; }
    else { $('#cd-title').textContent = 'Trạng thái'; $('#cd-text').textContent = '🏆 Đã kết thúc'; }
  }
  tick(); setInterval(tick, 1000);

  const teamName = (id) => PB.teamName(T, id);
  const pct = (x) => (x * 100 >= 99.5 ? '99%+' : x * 100 < 0.5 && x > 0 ? '<1%' : Math.round(x * 100) + '%');

  /* ---------- Dự đoán vô địch (đầu trang) ---------- */
  function forecast() {
    const sig = JSON.stringify(T.matches.map((m) => m.subs.map((s) => s.games)));
    if (predCache.sig !== sig) predCache = { sig, val: PB.predict(T, 2000) };
    return predCache.val;
  }
  function renderForecast() {
    const f = forecast();
    const el = $('#forecast');
    if (f.complete) {
      const pod = PB.podium(T);
      el.innerHTML = `<div class="lbl">Kết quả chung cuộc</div>
        <div class="fav"><div class="cup">🏆</div><div><b class="grad-text">${esc(teamName(pod[0]))}</b><small>Nhà vô địch ĐÀO97 OPEN</small></div></div>
        <div class="bars">${pod.map((id, i) => `<div class="bar"><span>${['🥇 Nhất', '🥈 Nhì', '🥉 Ba'][i]}</span><span class="nm">${esc(teamName(id))}</span><span></span></div>`).join('')}</div>`;
      return;
    }
    if (!f.doneSubs) {
      const fav = C.defaultFavorite && PB.team(T, C.defaultFavorite) ? C.defaultFavorite : T.teams[1] && T.teams[1].id;
      el.innerHTML = `<div class="lbl">Dự đoán đội vô địch</div>
        <div class="fav"><div class="cup">🏆</div><div><b class="grad-text">${esc(teamName(fav))}</b><small>Dự đoán ban đầu · chưa có kết quả thi đấu</small></div></div>
        <p class="why">Ngay khi có kết quả nội dung đầu tiên, hệ thống sẽ tự tính lại xác suất vô địch của từng đội theo thể lệ giải (Điều 8–9).</p>
        <a class="btn primary sm" href="#du-doan">Bạn nghĩ đội nào vô địch? →</a>`;
      return;
    }
    const top = f.rows[0];
    el.innerHTML = `<div class="lbl">Dự đoán đội vô địch · cập nhật trực tiếp</div>
      <div class="fav"><div class="cup">🏆</div><div><b class="grad-text">${esc(teamName(top.id))}</b><small>Khả năng vô địch <b style="display:inline;font-size:1rem;color:var(--gold)">${pct(top.p1)}</b> · top 3: ${pct(top.top3)}</small></div></div>
      <p class="why">Dựa trên ${f.doneSubs}/${f.totalSubs} nội dung đã có kết quả. Mô phỏng 2.000 lần các nội dung còn lại theo phong độ hiện tại và thể lệ xếp hạng.</p>
      <div class="bars">${f.rows.slice(0, 5).map((r) => `<div class="bar"><span class="nm">${esc(teamName(r.id))}</span><span class="tk"><i style="width:${Math.max(2, r.p1 * 100)}%"></i></span><span class="pc">${pct(r.p1)}</span></div>`).join('')}</div>`;
  }

  /* ---------- Bảng xếp hạng + vòng hiện tại ---------- */
  function currentRound() {
    const pend = T.matches.filter((m) => !PB.result(m));
    return pend.length ? Math.min(...pend.map((m) => m.round)) : Math.max(...T.matches.map((m) => m.round));
  }
  function renderStandings() {
    const cr = currentRound();
    const live = T.matches.filter((m) => m.round === cr);
    const started = live.some((m) => PB.tieScore(m).done);
    $('#bxh-body').innerHTML = `<div class="card">${PB.renderStandings(T, 'A')}</div>
      ${T.matches.every((m) => PB.result(m)) ? '' : `<div class="round-title">Vòng ${cr} · ${started ? 'đang thi đấu' : 'sắp diễn ra'}</div>
      <div class="match-list ties">${live.map((m) => PB.renderMatch(T, m)).join('')}</div>`}`;
  }

  /* ---------- Lịch theo vòng ---------- */
  function renderRounds() {
    const rounds = [...new Set(T.matches.map((m) => m.round))].sort((a, b) => a - b);
    if (round === null || !rounds.includes(round)) round = currentRound();
    $('#round-tabs').innerHTML = rounds.map((r) => {
      const ms = T.matches.filter((m) => m.round === r);
      const done = ms.every((m) => PB.result(m));
      return `<button class="chip ${r === round ? 'active' : ''}" data-r="${r}">Vòng ${r}${done ? ' ✓' : ''}</button>`;
    }).join('');
    $('#round-body').innerHTML = `<div class="match-list ties">${T.matches.filter((m) => m.round === round).map((m) => PB.renderMatch(T, m)).join('')}</div>`;
  }
  $('#round-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    round = +b.dataset.r; renderRounds();
  });

  /* ---------- Các đội ---------- */
  // Trình VĐV: chỉ hiện trên trang VĐV (trang chính), không hiện trên trang khán giả xem.html
  const SHOW_LV = document.body.dataset.mode !== 'xem';
  let LV = {};
  function teamLevel(ps) {
    const r = ps.filter((p) => LV[p.id]);
    if (!r.length) return '';
    const sum = r.reduce((s, p) => s + LV[p.id], 0);
    return `<div class="lv-sum">Trình TB <b>${(sum / r.length).toFixed(2)}</b> · tổng <b>${sum}</b>${r.length < ps.length ? ` <small>(${r.length}/${ps.length} VĐV)</small>` : ''}</div>`;
  }
  function renderTeams() {
    $('#teams').innerHTML = T.teams.map((x) => {
      const ps = (Array.isArray(x.players) ? x.players : []).filter((p) => p.name);
      return `<div class="team-item team-card"><div style="min-width:0">
        <span class="tn">${esc(x.name)}</span>
        ${x.captain ? `<span class="cap">👑 Đội trưởng: ${esc(x.captain)}</span>` : ''}
        ${ps.length ? `<ul class="roster">${ps.map((p) => `<li class="${p.gender === 'nu' ? 'f' : ''}">${p.gender === 'nu' ? '♀' : '♂'} ${esc(p.name)}${p.note ? ` <small class="note">· ${esc(p.note)}</small>` : ''}${SHOW_LV && LV[p.id] ? ` <span class="lv lv${LV[p.id]}" title="Trình ${LV[p.id]}">T${LV[p.id]}</span>` : ''}</li>`).join('')}</ul>` : '<span class="tp">Danh sách VĐV sẽ được cập nhật</span>'}
        ${SHOW_LV ? teamLevel(ps) : ''}
      </div></div>`;
    }).join('') + (T.reserves ? `<div class="team-item team-card reserve" style="grid-column:1/-1"><div><span class="tn">VĐV dự bị</span><span class="tp">${esc(T.reserves)}</span></div></div>` : '');
  }

  /* ---------- Dự đoán của khán giả ---------- */
  const form = $('#pred-form');
  const DONE_KEY = 'dao97_du_doan';
  const lsGet = () => { try { return localStorage.getItem(DONE_KEY); } catch (e) { return null; } };
  const lsSet = (v) => { try { localStorage.setItem(DONE_KEY, v); } catch (e) { /* bỏ qua */ } };

  function fillSelects() {
    if (!form) return;
    const opts = '<option value="">— Chọn đội —</option>' + T.teams.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
    form.querySelectorAll('select').forEach((s) => { const v = s.value; s.innerHTML = opts; s.value = v; });
  }
  function formState() {
    if (!form) return;
    const msg = $('#pred-msg');
    const btn = form.querySelector('button');
    let reason = '';
    if (!Store.enabled) reason = 'Chức năng dự đoán sẽ mở khi BTC kích hoạt hệ thống.';
    else if (!T.predictionsOpen) reason = '⏱ BTC đã khoá cổng dự đoán.';
    else if (lsGet()) reason = '✅ Bạn đã gửi dự đoán từ thiết bị này. Cảm ơn bạn!';
    btn.disabled = !!reason;
    if (reason) msg.textContent = reason;
  }
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const p = { name: (fd.get('name') || '').trim(), champion: fd.get('champion'), second: fd.get('second'), third: fd.get('third') };
    const msg = $('#pred-msg');
    if (p.name.length < 2) { msg.textContent = 'Vui lòng nhập tên (ít nhất 2 ký tự).'; return; }
    if (!p.champion || !p.second || !p.third) { msg.textContent = 'Vui lòng chọn đủ 3 đội.'; return; }
    if (new Set([p.champion, p.second, p.third]).size < 3) { msg.textContent = 'Ba vị trí phải là 3 đội khác nhau.'; return; }
    const btn = form.querySelector('button');
    btn.disabled = true; msg.textContent = 'Đang gửi…';
    try {
      await Store.submitPrediction(p);
      lsSet(String(Date.now()));
      form.reset(); msg.textContent = '🎉 Đã ghi nhận dự đoán của bạn. Chúc may mắn!';
      toast('Đã gửi dự đoán');
    } catch (err) {
      msg.textContent = /permission/i.test(err.message) ? 'Cổng dự đoán đã đóng hoặc dữ liệu không hợp lệ.' : 'Gửi chưa được, vui lòng thử lại.';
      btn.disabled = false;
    }
  });

  function renderPredictions() {
    if (!T) return;
    if (preds === null) {
      $('#vote-stats').innerHTML = '';
      $('#feed').innerHTML = '<p class="muted">Dự đoán của khán giả sẽ hiện ở đây khi hệ thống được kích hoạt.</p>';
      return;
    }
    const valid = preds.filter((p) => PB.team(T, p.champion));
    const n = valid.length;
    const votes = Object.fromEntries(T.teams.map((x) => [x.id, 0]));
    valid.forEach((p) => votes[p.champion]++);
    const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1]).filter(([, v]) => v > 0);
    $('#vote-stats').innerHTML = n
      ? `<p class="muted" style="margin:0 0 4px">${n >= 300 ? '300 dự đoán mới nhất' : n + ' lượt dự đoán'} · tỉ lệ chọn đội vô địch:</p>` +
        ranked.slice(0, 5).map(([id, v]) => `<div class="bar"><span class="nm">${esc(teamName(id))}</span><span class="tk"><i style="width:${(v / n) * 100}%"></i></span><span class="pc">${Math.round((v / n) * 100)}%</span></div>`).join('')
      : '<p class="muted">Chưa có ai dự đoán — hãy là người đầu tiên!</p>';
    const pod = PB.podium(T);
    const hit = (p) => pod.length === 3 && p.champion === pod[0] && p.second === pod[1] && p.third === pod[2];
    const winners = valid.filter(hit);
    const fmt = (d) => d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
    const item = (p) => `<div class="feed-item ${hit(p) ? 'hit' : ''}"><b>${hit(p) ? '🎯 ' : ''}${esc(p.name)}</b><time>${fmt(p.createdAt)}</time>
      <div class="picks">🥇 <span>${esc(teamName(p.champion))}</span> · 🥈 <span>${esc(teamName(p.second))}</span> · 🥉 <span>${esc(teamName(p.third))}</span></div></div>`;
    $('#feed').innerHTML =
      (pod.length === 3 ? `<p style="margin:0 0 6px"><b>${winners.length ? `🎉 ${winners.length} người đoán trúng cả 3 vị trí!` : 'Chưa có ai đoán trúng cả 3 vị trí.'}</b></p>${winners.map(item).join('')}` : '') +
      (valid.length ? valid.slice(0, 30).map(item).join('') : '<p class="muted">Chưa có dự đoán nào.</p>');
  }

  /* ---------- Tải dữ liệu ---------- */
  function renderAll() {
    renderForecast(); renderStandings(); renderRounds(); renderTeams(); fillSelects(); formState(); renderPredictions();
    const st = $('#live-status');
    st.className = 'pill-status ' + (Store.enabled ? 'ok' : 'off');
    st.textContent = Store.enabled ? 'Trực tiếp' : 'Dữ liệu tĩnh';
  }
  if (SHOW_LV) Store.watchPublicRatings((l) => { LV = l || {}; if (T) renderTeams(); }, () => {});
  Store.watch((t) => { T = t; renderAll(); }, (e) => {
    console.error(e);
    $('#bxh-body').innerHTML = '<p class="empty">Không tải được dữ liệu. Vui lòng tải lại trang.</p>';
  });
  // Chỉ tải dự đoán khi người xem cuộn gần tới mục Dự đoán (tiết kiệm lượt đọc)
  let predStarted = false;
  const startPreds = () => { if (predStarted) return; predStarted = true; Store.watchPredictions((list) => { preds = list; renderPredictions(); }, console.error); };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); startPreds(); } }, { rootMargin: '600px' });
    io.observe($('#du-doan'));
  } else startPreds();
})();

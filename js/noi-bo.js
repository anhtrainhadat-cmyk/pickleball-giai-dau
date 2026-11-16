/*
 * Trang nội bộ của một đội (noi-bo.html).
 * Nội dung chiến thuật được mã hoá AES-GCM trong data/noi-bo.json; khoá nằm ở phần #k=... của link
 * (không gửi lên máy chủ, không có trên GitHub). Thông tin giải (lịch, kết quả, trình) lấy trực tiếp như trang chính.
 */
(function () {
  const C = window.SITE_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const esc = PB.esc;
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const KEY_LS = 'dao97_noi_bo_k';
  const ls = {
    get: () => { try { return localStorage.getItem(KEY_LS); } catch (e) { return null; } },
    set: (v) => { try { localStorage.setItem(KEY_LS, v); } catch (e) { /* bỏ qua */ } },
    del: () => { try { localStorage.removeItem(KEY_LS); } catch (e) { /* bỏ qua */ } }
  };

  /* ---------- Giải mã ---------- */
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const b64u = (s) => b64(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const keyFrom = (v) => { const m = String(v || '').match(/(?:#|^)k=([A-Za-z0-9_-]{20,})/) || String(v || '').trim().match(/^([A-Za-z0-9_-]{22})$/); return m ? m[1] : null; };
  let encP = null;
  async function decrypt(k) {
    encP = encP || fetch('data/noi-bo.json?v=' + Date.now(), { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error('fetch'); return r.json(); });
    const e = await encP;
    const key = await crypto.subtle.importKey('raw', b64u(k), 'AES-GCM', false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(e.iv) }, key, b64(e.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  function showLock(msg) {
    $('#app').hidden = true; $('#lock').hidden = false;
    if (msg) $('#lock-msg').innerHTML = msg;
  }
  async function unlock(k, fromInput) {
    if (!k) return showLock();
    if (!window.crypto || !crypto.subtle) return showLock('Trình duyệt này không hỗ trợ mở trang nội bộ. Vui lòng mở bằng Chrome hoặc Safari bản mới.');
    try {
      const D = await decrypt(k);
      ls.set(k);
      if (fromInput) history.replaceState(null, '', '#k=' + k);
      start(D);
    } catch (err) {
      if (!fromInput && k === ls.get()) ls.del();
      showLock(err.message === 'fetch' ? 'Không tải được nội dung, vui lòng kiểm tra mạng rồi tải lại trang.' : '⚠ Link hoặc mã truy cập <b>không đúng</b> (có thể đã được đổi). Hãy xin lại link mới từ đội trưởng.');
    }
  }
  $('#lock-form').addEventListener('submit', (e) => { e.preventDefault(); unlock(keyFrom($('#lock-in').value), true); });
  window.addEventListener('hashchange', () => { const k = keyFrom(location.hash); if (k) unlock(k); });
  unlock(keyFrom(location.hash) || ls.get());

  /* ---------- Minh hoạ ---------- */
  const VIZ = {
    power: () => `<div class="viz power" aria-label="Lực đánh khuyến nghị khoảng 70%">
      <div class="pw-bar"><i style="width:70%"></i><span class="pw-mark" style="left:70%">70%</span></div>
      <div class="pw-lbl"><span>Mềm · kiểm soát</span><span>Vừa đủ ✓</span><span>100% · rủi ro</span></div>
      <p>Kiểm soát &gt; sức mạnh: <b>hướng bóng · điểm rơi · độ ổn định</b>.</p></div>`,
    drop: () => `<div class="viz drop"><svg viewBox="0 0 360 140" role="img" aria-label="Ba quỹ đạo drop: rúc lưới, hơi dài nhưng thấp, quá cao">
      <line x1="10" y1="122" x2="350" y2="122" class="ground"/>
      <rect x="178" y="84" width="4" height="38" class="net"/><line x1="180" y1="84" x2="180" y2="122" class="net-l"/>
      <line x1="236" y1="122" x2="236" y2="114" class="kit"/><text x="186" y="136" class="t-s">LƯỚI</text><text x="240" y="136" class="t-s">vạch bếp (NVZ)</text>
      <path d="M30 100 Q100 50 178 104" class="tr bad"/>
      <path d="M30 100 Q140 30 256 120" class="tr ok"/>
      <path d="M30 100 Q150 -80 320 112" class="tr hi"/>
      <circle cx="30" cy="100" r="6" class="ball"/><text x="14" y="136" class="t-s">MÌNH</text></svg>
      <div class="drop-lg"><span class="ok"><i></i>✓ Hơi dài nhưng thấp: an toàn</span><span class="bad"><i></i>✗ Rúc lưới</span><span class="hi"><i></i>✗ Quá cao → bị đập</span></div></div>`
  };

  /* ---------- Nội dung chiến thuật ---------- */
  let D = null;
  function start(data) {
    D = data;
    $('#lock').hidden = true;
    const app = $('#app'); app.hidden = false;
    document.querySelectorAll('.nav-links, .menu-btn').forEach((el) => (el.hidden = false));
    app.innerHTML = `<nav class="nb-tabs" role="tablist"><div class="container">
        <button role="tab" data-tab="cam-nang">📘 Cẩm nang</button>
        <button role="tab" data-tab="ky-nang">📝 Kỹ năng VĐV <small>🔒</small></button>
        <button role="tab" data-tab="dau-phap">♟️ Đấu pháp <small>🔒</small></button>
      </div></nav>
      <div class="nb-pane" id="pane-cam-nang">${renderPage()}</div>
      <div class="nb-pane" id="pane-ky-nang" hidden></div>
      <div class="nb-pane" id="pane-dau-phap" hidden></div>`;
    // Link có &tab=dau-phap (link riêng của Cap) thì mở thẳng tab đó
    const ht = (location.hash.match(/[#&]tab=([a-z-]+)/) || [])[1];
    showTab(ht || (() => { try { return localStorage.getItem('dao97_nb_tab'); } catch (e) { return null; } })() || 'cam-nang');
    document.title = D.title + ' · ĐÀO97 OPEN';
    bind();
    startLive();
  }

  const sectionHtml = (s, i) => `
    <details class="tac" id="ct-${i + 1}">
      <summary>
        <span class="tac-n">${i + 1}</span>
        <span class="tac-h"><span class="tac-t">${esc(s.icon || '')} ${esc(s.title)}</span><span class="tac-s">${esc(s.sub || '')}</span>
          <span class="tac-r">💡 ${esc(s.remember || '')}</span></span>
        <span class="tac-chev" aria-hidden="true">⌄</span>
      </summary>
      <div class="tac-body">
        ${s.viz && VIZ[s.viz] ? VIZ[s.viz]() : ''}
        ${s.points ? `<ul class="ticks">${s.points.map((p) => `<li>${md(p)}</li>`).join('')}</ul>` : ''}
        ${s.cols ? `<div class="cols">${s.cols.map((c) => `<div class="col"><h4>${esc(c.title)}</h4><ul class="ticks">${c.points.map((p) => `<li>${md(p)}</li>`).join('')}</ul></div>`).join('')}</div>` : ''}
        ${s.calls ? `<div class="calls"><span>Gọi nhau ngắn gọn:</span>${s.calls.map((c) => `<b>“${esc(c)}”</b>`).join('')}</div>` : ''}
        ${s.diag ? `<h4 class="mini-h">Đánh hỏng? Tự hỏi nhanh:</h4><div class="diag">${s.diag.map(([a, b]) => `<div class="dg"><b>${esc(a)}</b><span>${md(b)}</span></div>`).join('')}</div>` : ''}
        ${s.fix ? `<h4 class="mini-h">Điều chỉnh ngay:</h4><div class="diag fix">${s.fix.map(([a, b]) => `<div class="dg"><b>${esc(a)}</b><span>→ ${md(b)}</span></div>`).join('')}</div>` : ''}
        ${s.rule ? `<div class="callout rule-c">📜 ${md(s.rule)}</div>` : ''}
        ${s.tip ? `<div class="callout tip-c">🔎 ${md(s.tip)} <a href="#doi-thu">Xem ngay ↓</a></div>` : ''}
        ${s.remember ? `<div class="nho"><span>NHỚ</span><p>${md(s.remember)}</p></div>` : ''}
      </div>
    </details>`;

  function renderPage() {
    const sp = D.spirit || {};
    return `
    <section class="hero nb-hero" id="top">
      <div class="hero-bg" aria-hidden="true"></div>
      <div class="container hero-grid">
        <div>
          <div class="nb-kicker"><span id="team-name">Team</span> · Tài liệu nội bộ</div>
          <h1 class="display grad-text nb-title">${esc(D.title)}</h1>
          <p class="hero-sub neon-text">Đánh chắc hơn · Tự lỗi ít hơn · Phối hợp tốt hơn · Kiên nhẫn hơn đối thủ</p>
          <div class="actions">
            <button class="btn primary" data-fl="open">🔥 10 điều trước khi vào sân</button>
            <a class="btn ghost" href="#lich-doi">📋 Lịch đấu của đội</a>
          </div>
        </div>
        <div class="forecast nb-live" id="nb-live" aria-live="polite"><div class="lbl">Đội mình trên bảng</div><p class="muted">Đang tải dữ liệu giải…</p></div>
      </div>
    </section>

    <section class="block alt">
      <div class="container">
        <div class="section-head"><div><div class="eyebrow">Tinh thần ĐÀO97 OPEN</div><h2 class="display">4 chữ “hơn” của cả đội</h2></div></div>
        <div class="pillars">${(D.pillars || []).map(([a, b], i) => `<div class="pillar"><span class="pi-n">0${i + 1}</span><b>${esc(a)}</b><small>${esc(b)}</small></div>`).join('')}</div>
      </div>
    </section>

    <section class="block" id="chien-thuat">
      <div class="container">
        <div class="section-head">
          <div><div class="eyebrow">Đọc kỹ trước giải · bấm từng mục để mở</div><h2 class="display">${(D.sections || []).length} nhóm chiến thuật</h2></div>
          <button class="btn sm ghost" id="toggle-all">Mở tất cả</button>
        </div>
        <nav class="tac-index chips">${(D.sections || []).map((s, i) => `<a class="chip" href="#ct-${i + 1}" data-open="${i + 1}">${i + 1}. ${esc(s.title)}</a>`).join('')}</nav>
        <div class="tac-list">${(D.sections || []).map(sectionHtml).join('')}</div>
      </div>
    </section>

    <section class="block alt" id="10-dieu">
      <div class="container">
        <div class="section-head">
          <div><div class="eyebrow">Xem lại ngay trước khi vào sân</div><h2 class="display">🔥 ${(D.rules || []).length} điều phải nhớ</h2></div>
          <button class="btn sm primary" data-fl="open">▶ Xem nhanh từng điều</button>
        </div>
        <ol class="rules10">${(D.rules || []).map((r, i) => `<li data-fl-i="${i}"><span class="r-n">${i + 1}</span><b>${esc(r)}</b></li>`).join('')}</ol>
      </div>
    </section>

    <section class="block spirit">
      <div class="container">
        <div class="spirit-card">
          <div class="eyebrow">🏆 Tinh thần ĐÀO97 OPEN</div>
          <p class="sp-lead">${esc(sp.lead || '')}</p>
          <ul class="sp-nots">${(sp.nots || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          <p class="sp-need">${esc(sp.need || '')}</p>
          <p class="sp-close grad-text">${esc(sp.close || '')}</p>
        </div>
      </div>
    </section>

    <section class="block alt" id="lich-doi">
      <div class="container">
        <div class="section-head"><div><div class="eyebrow">Cập nhật trực tiếp từ BTC</div><h2 class="display">Đội mình tại giải</h2></div><span class="pill-status" id="live-status">Đang tải…</span></div>
        <div class="nb-grid">
          <div class="card"><h3 class="card-h">👥 Đội hình</h3><div id="my-roster"><p class="muted">Đang tải…</p></div></div>
          <div class="card"><h3 class="card-h">📊 Bảng xếp hạng</h3><div id="nb-bxh"><p class="muted">Đang tải…</p></div></div>
        </div>
        <h3 class="sub-h">🗓 7 lượt đấu của đội</h3>
        <div class="chips" id="my-rounds"></div>
        <div id="my-round-body" class="nb-round"></div>
      </div>
    </section>

    <section class="block" id="doi-thu">
      <div class="container">
        <div class="section-head"><div><div class="eyebrow">Áp dụng mục 2 · Chọn hướng đánh</div><h2 class="display">Soi đối thủ</h2></div></div>
        <p class="muted nb-note">Trình do BTC chấm: <b>T1 là trình cao nhất</b>, T6 thấp nhất. Đây chỉ là tham khảo: <b>vẫn phải quan sát thực tế trên sân</b> để biết ai đỡ bóng yếu hơn.</p>
        <div class="chips" id="opp-tabs"></div>
        <div id="opp-body" class="opp-body"></div>
      </div>
    </section>`;
  }

  function showTab(id) {
    if (!$('#pane-' + id)) id = 'cam-nang';
    document.querySelectorAll('.nb-pane').forEach((p) => (p.hidden = p.id !== 'pane-' + id));
    document.querySelectorAll('.nb-tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === id));
    document.querySelectorAll('.nav-links a[href^="#"]').forEach((a) => (a.hidden = id !== 'cam-nang'));
    try { localStorage.setItem('dao97_nb_tab', id); } catch (e) { /* bỏ qua */ }
    document.dispatchEvent(new CustomEvent('nb:tab', { detail: id }));
  }
  function bind() {
    $('.nb-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) { showTab(b.dataset.tab); scrollTo({ top: 0 }); } });
    document.querySelectorAll('.nav-links a[href^="#"]').forEach((a) => a.addEventListener('click', () => showTab('cam-nang')));
    const all = () => [...document.querySelectorAll('details.tac')];
    $('#toggle-all').addEventListener('click', (e) => {
      const open = !all().every((d) => d.open);
      all().forEach((d) => (d.open = open));
      e.target.textContent = open ? 'Thu gọn tất cả' : 'Mở tất cả';
    });
    document.querySelector('.tac-index').addEventListener('click', (e) => {
      const a = e.target.closest('[data-open]'); if (a) $('#ct-' + a.dataset.open).open = true;
    });
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fl]');
      if (b) { const a = b.dataset.fl; if (a === 'open') flash(0); else if (a === 'close') flashClose(); else flashGo(a === 'next' ? 1 : -1); return; }
      const li = e.target.closest('[data-fl-i]'); if (li) flash(+li.dataset.flI);
    });
    // mở đúng mục khi vào link #ct-3
    const h = location.hash.match(/^#ct-(\d+)/); if (h && $('#ct-' + h[1])) $('#ct-' + h[1]).open = true;
  }

  /* ---------- Xem nhanh 10 điều ---------- */
  let fi = 0;
  const cards = () => [...(D.rules || []).map((r, i) => ({ n: i + 1, t: r })), { end: true }];
  function flashRender() {
    const list = cards(), c = list[fi];
    $('#flash-body').innerHTML = '<div class="fl-top">🔥 Trước khi vào sân</div>' + (c.end
      ? `<div class="fl-card end"><div class="fl-n">🏆</div><p class="fl-t">${esc((D.spirit || {}).need || '')}</p><p class="fl-s grad-text">${esc((D.spirit || {}).close || '')}</p></div>`
      : `<div class="fl-card"><div class="fl-n">${c.n}<small>/${list.length - 1}</small></div><p class="fl-t">${esc(c.t)}</p></div>`);
    $('#flash-dots').innerHTML = list.map((_, i) => `<i class="${i === fi ? 'on' : ''}"></i>`).join('');
    $('#flash [data-fl="prev"]').disabled = fi === 0;
    $('#flash [data-fl="next"]').textContent = fi === list.length - 1 ? '✓' : '→';
  }
  function flash(i) { fi = i; $('#flash').hidden = false; document.body.style.overflow = 'hidden'; flashRender(); $('#flash [data-fl="next"]').focus(); }
  function flashClose() { $('#flash').hidden = true; document.body.style.overflow = ''; }
  function flashGo(d) { const n = cards().length; if (fi + d >= n) return flashClose(); fi = Math.max(0, fi + d); flashRender(); }
  document.addEventListener('keydown', (e) => {
    if ($('#flash').hidden) return;
    if (e.key === 'Escape') flashClose(); else if (e.key === 'ArrowRight') flashGo(1); else if (e.key === 'ArrowLeft') flashGo(-1);
  });
  let tx = null;
  $('#flash').addEventListener('touchstart', (e) => (tx = e.touches[0].clientX), { passive: true });
  $('#flash').addEventListener('touchend', (e) => { if (tx === null) return; const dx = e.changedTouches[0].clientX - tx; tx = null; if (Math.abs(dx) > 50) flashGo(dx < 0 ? 1 : -1); });

  /* ---------- Dữ liệu giải trực tiếp ---------- */
  let T = null, LV = {}, myRound = null, opp = null, predCache = { sig: null, val: null };
  const ME = () => (D && D.team) || C.defaultFavorite || 'doi2';
  const tn = (id) => PB.teamName(T, id);
  const sign = (n) => (n > 0 ? '+' + n : String(n));
  const pct = (x) => (x * 100 >= 99.5 ? '99%+' : x > 0 && x * 100 < 0.5 ? '<1%' : Math.round(x * 100) + '%');
  const badge = (pid) => (LV[pid] ? `<span class="lv lv${LV[pid]}" title="Trình ${LV[pid]}">T${LV[pid]}</span>` : '<span class="lv lv0" title="Chưa chấm">–</span>');
  const myTies = () => T.matches.filter((m) => m.a === ME() || m.b === ME()).sort((x, y) => x.round - y.round);
  const oppOf = (m) => (m.a === ME() ? m.b : m.a);

  function avg(ps) { const r = ps.filter((p) => LV[p.id]); return r.length ? r.reduce((s, p) => s + LV[p.id], 0) / r.length : null; }
  const players = (id) => ((PB.team(T, id) || {}).players || []).filter((p) => p && p.name);

  function renderLive() {
    const rows = PB.standings(T, 'A');
    const ri = rows.findIndex((r) => r.id === ME());
    const r = rows[ri] || { nw: 0, nl: 0, pf: 0, pa: 0, w: 0, d: 0, l: 0 };
    const ties = myTies();
    const next = ties.find((m) => !PB.tieScore(m).complete);
    const sig = JSON.stringify(T.matches.map((m) => m.subs.map((s) => s.games)));
    if (predCache.sig !== sig) predCache = { sig, val: PB.predict(T, 2000) };
    const f = predCache.val, fr = f.rows.find((x) => x.id === ME());
    const started = f.doneSubs > 0;
    $('#nb-live').innerHTML = `<div class="lbl">${esc(tn(ME()))} trên bảng · trực tiếp</div>
      <div class="nb-stats">
        <div><b>${started ? '#' + (ri + 1) : '—'}</b><small>Hạng</small></div>
        <div><b>${sign(r.nw - r.nl)}</b><small>HS nội dung</small></div>
        <div><b>${sign(r.pf - r.pa)}</b><small>HS điểm</small></div>
        <div><b>${started && fr ? pct(fr.p1) : '—'}</b><small>Tỉ lệ vô địch</small></div>
      </div>
      ${next ? `<div class="nb-next"><span>Lượt tới · Vòng ${next.round}</span>
        <b>gặp ${esc(tn(oppOf(next)))}</b><button class="btn sm ghost" data-opp="${esc(oppOf(next))}">🔎 Soi đối thủ</button></div>`
        : `<div class="nb-next"><b>Đã đấu xong 7 lượt</b></div>`}
      <p class="why">${started ? `Dựa trên ${f.doneSubs}/${f.totalSubs} nội dung đã có kết quả toàn giải.` : 'Chưa có kết quả. Các con số sẽ tự cập nhật khi BTC nhập tỉ số.'}</p>`;
  }

  function renderMine() {
    const ps = players(ME()).slice().sort((x, y) => (x.gender === 'nu') - (y.gender === 'nu') || (LV[x.id] || 9) - (LV[y.id] || 9));
    const a = avg(ps);
    $('#team-name').textContent = tn(ME());
    $('#nb-tag').textContent = tn(ME()).toUpperCase() + ' · NỘI BỘ';
    const tm = PB.team(T, ME()) || {};
    $('#my-roster').innerHTML = ps.length ? `${tm.captain ? `<p class="cap">👑 Đội trưởng: ${esc(tm.captain)}</p>` : ''}
      <ul class="roster nb-roster">${ps.map((p) => `<li class="${p.gender === 'nu' ? 'f' : ''}">${p.gender === 'nu' ? '♀' : '♂'} ${esc(p.name)}${p.note ? ` <small class="note">· ${esc(p.note)}</small>` : ''} ${badge(p.id)}</li>`).join('')}</ul>
      ${a ? `<div class="lv-sum">Trình TB <b>${a.toFixed(2)}</b> <small>(T1 cao nhất)</small></div>` : ''}` : '<p class="muted">Danh sách VĐV sẽ được cập nhật.</p>';
    $('#nb-bxh').innerHTML = PB.renderStandings(T, 'A');
    $('#nb-bxh').querySelectorAll('tbody tr').forEach((tr) => { if ((tr.querySelector('.tn') || {}).textContent === tn(ME())) tr.classList.add('me'); });

    const ties = myTies();
    if (myRound === null || !ties.some((m) => m.round === myRound)) { const n = ties.find((m) => !PB.tieScore(m).complete); myRound = (n || ties[ties.length - 1] || {}).round; }
    $('#my-rounds').innerHTML = ties.map((m) => {
      const s = PB.tieScore(m), mine = m.a === ME();
      const res = s.complete ? (s.winner === (mine ? 'a' : 'b') ? 'W' : s.winner ? 'L' : 'D') : '';
      return `<button class="chip ${m.round === myRound ? 'active' : ''} ${res ? 'r-' + res : ''}" data-mr="${m.round}">V${m.round} · ${esc(tn(oppOf(m)))}${s.done ? ` <b>${mine ? s.wa : s.wb}–${mine ? s.wb : s.wa}</b>` : ''}</button>`;
    }).join('');
    const m = ties.find((x) => x.round === myRound);
    $('#my-round-body').innerHTML = m ? `<div class="match-list ties one">${PB.renderMatch(T, m)}</div>
      <button class="btn sm ghost" data-opp="${esc(oppOf(m))}">🔎 Soi đội hình ${esc(tn(oppOf(m)))}</button>` : '';
  }

  function renderOpp() {
    const ties = myTies();
    const ids = ties.map(oppOf);
    if (!opp || !ids.includes(opp)) { const n = ties.find((m) => !PB.tieScore(m).complete); opp = n ? oppOf(n) : ids[0]; }
    $('#opp-tabs').innerHTML = ties.map((m) => `<button class="chip ${oppOf(m) === opp ? 'active' : ''}" data-opp="${esc(oppOf(m))}">V${m.round} · ${esc(tn(oppOf(m)))}</button>`).join('');
    if (!opp) { $('#opp-body').innerHTML = ''; return; }
    const ps = players(opp), mine = players(ME());
    const rated = ps.filter((p) => LV[p.id]);
    const lowLv = rated.length ? Math.max(...rated.map((p) => LV[p.id])) : null; // T1 cao nhất → số lớn nhất là trình thấp nhất
    const grp = (g) => ps.filter((p) => (g === 'nu' ? p.gender === 'nu' : p.gender !== 'nu')).sort((x, y) => (LV[x.id] || 9) - (LV[y.id] || 9));
    const li = (p) => `<li class="${p.gender === 'nu' ? 'f' : ''} ${lowLv && LV[p.id] === lowLv ? 'low' : ''}">${badge(p.id)} ${esc(p.name)}${p.note ? ` <small class="note">· ${esc(p.note)}</small>` : ''}${lowLv && LV[p.id] === lowLv ? ' <small class="tgt">trình thấp nhất đội</small>' : ''}</li>`;
    const m = ties.find((x) => oppOf(x) === opp);
    const s = m ? PB.tieScore(m) : null;
    const A = avg(ps), B = avg(mine);
    const nam = grp('nam'), nu = grp('nu');
    $('#opp-body').innerHTML = `<div class="card opp-card">
      <div class="opp-head"><div><h3>${esc(tn(opp))}</h3><span class="muted">Vòng ${m ? m.round : '—'}${s && s.done ? ` · Tỉ số ${s[m.a === ME() ? 'wa' : 'wb']}–${s[m.a === ME() ? 'wb' : 'wa']}` : ''}</span></div>
        ${A && B ? `<div class="opp-cmp"><span>Trình TB <small>(số nhỏ = mạnh hơn)</small></span><b>${esc(tn(ME()))} ${B.toFixed(2)}</b><i>vs</i><b>${A.toFixed(2)} ${esc(tn(opp))}</b></div>` : ''}</div>
      ${ps.length ? `<div class="cols">
        <div class="col"><h4>♂ Nam (${nam.length}) · trình cao → thấp</h4><ul class="roster opp-roster">${nam.map(li).join('')}</ul></div>
        <div class="col"><h4>♀ Nữ (${nu.length})</h4><ul class="roster opp-roster">${nu.map(li).join('')}</ul></div>
      </div>` : '<p class="muted">Đội này chưa có danh sách VĐV.</p>'}
      ${T.reserves ? `<p class="muted nb-note">VĐV dự bị toàn giải: ${esc(T.reserves)}</p>` : ''}
    </div>`;
  }

  function renderAll() {
    if (!T || !D) return;
    renderLive(); renderMine(); renderOpp();
    document.dispatchEvent(new CustomEvent('nb:data', { detail: { T, LV, me: ME() } }));
    const st = $('#live-status');
    st.className = 'pill-status ' + (Store.enabled ? 'ok' : 'off');
    st.textContent = Store.enabled ? 'Trực tiếp' : 'Dữ liệu tĩnh';
  }

  let liveStarted = false;
  function startLive() {
    if (liveStarted) return renderAll();
    liveStarted = true;
    document.addEventListener('click', (e) => {
      const r = e.target.closest('[data-mr]'); if (r) { myRound = +r.dataset.mr; renderMine(); return; }
      const o = e.target.closest('[data-opp]');
      if (o) { opp = o.dataset.opp; renderOpp(); if (!o.closest('#opp-tabs')) $('#doi-thu').scrollIntoView({ behavior: 'smooth' }); }
    });
    Store.watchPublicRatings((l) => { LV = l || {}; renderAll(); }, () => {});
    Store.watch((t) => { T = t; renderAll(); }, (e) => {
      console.error(e);
      const el = $('#nb-live'); if (el) el.innerHTML = '<p class="muted">Không tải được dữ liệu giải. Vui lòng tải lại trang.</p>';
    });
  }
})();

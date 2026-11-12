(async function () {
  const C = window.SITE_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const esc = PB.esc;

  /* Đếm ngược */
  const start = new Date(C.eventStart || 0).getTime();
  const end = new Date(C.eventEnd || C.eventStart || 0).getTime();
  const pad = (n) => String(n).padStart(2, '0');
  function tick() {
    const now = Date.now();
    if (!start) return;
    if (now < start) {
      let s = Math.floor((start - now) / 1000);
      const d = Math.floor(s / 86400); s -= d * 86400;
      const h = Math.floor(s / 3600); s -= h * 3600;
      const m = Math.floor(s / 60); s -= m * 60;
      $('#cd-d').textContent = d; $('#cd-h').textContent = pad(h); $('#cd-m').textContent = pad(m); $('#cd-s').textContent = pad(s);
      return;
    }
    clearInterval(timer);
    $('#cd-title').textContent = now < end ? 'Giải đang diễn ra' : 'Giải đã kết thúc';
    $('#countdown').outerHTML = now < end
      ? '<div class="live-now">ĐANG THI ĐẤU</div>'
      : '<div class="live-now" style="color:var(--gold)">🏆 Cảm ơn tất cả VĐV!</div>';
  }
  const timer = setInterval(tick, 1000); tick();

  /* Liên hệ */
  const contacts = [];
  if (C.phone) contacts.push(['📞', 'Hotline', C.phone, 'tel:' + C.phone.replace(/\s/g, '')]);
  if (C.zalo) contacts.push(['💬', 'Zalo', C.zalo, 'https://zalo.me/' + C.zalo.replace(/\s/g, '')]);
  if (C.facebook) contacts.push(['👍', 'Facebook', 'Fanpage CLB', C.facebook]);
  if (C.email) contacts.push(['✉️', 'Email', C.email, 'mailto:' + C.email]);
  if (contacts.length) {
    if (C.address) contacts.push(['📍', 'Khu vực', C.address, '']);
    $('#lien-he').hidden = false;
    $('#contact').innerHTML = contacts.map(([i, k, v, href]) =>
      `<${href ? `a href="${esc(href)}" target="_blank" rel="noopener"` : 'div'} class="card"><small>${i} ${esc(k)}</small><b>${esc(v)}</b></${href ? 'a' : 'div'}>`).join('');
  }

  let data = [];
  try { data = (await PB.loadPublic()).filter((t) => t.public !== false); }
  catch (e) {
    const msg = `<p class="empty">Không tải được dữ liệu. ${location.protocol === 'file:' ? 'Hãy mở website qua GitHub Pages thay vì mở file trực tiếp.' : 'Vui lòng tải lại trang.'}</p>`;
    $('#bxh-body').innerHTML = msg; $('#list').innerHTML = msg;
    return;
  }

  /* Giải chính */
  const main = data.find((t) => t.id === C.mainTournament) || data[0];
  if (main) {
    const url = 'giai-dau.html?id=' + encodeURIComponent(main.id);
    document.querySelectorAll('a[href^="giai-dau.html?id=dao97-open-2026"]').forEach((a) => (a.href = url + (a.hash || '')));
    const ties = main.matches || [];
    $('#s-doi').textContent = (main.teams || []).length;
    $('#s-tran').textContent = `${ties.filter((m) => PB.result(m)).length}/${ties.length}`;
    $('#s-nd').textContent = ties.reduce((n, m) => n + (m.subs ? PB.tieScore(m).done : PB.result(m) ? 1 : 0), 0);
    renderMain(main, url);
  } else $('#bxh-body').innerHTML = '<p class="empty">Chưa có dữ liệu giải.</p>';

  function renderMain(t, url) {
    if (!(t.groups || []).length) {
      $('#bxh-body').innerHTML = (t.teams || []).length
        ? `<div class="team-list">${t.teams.map((x) => `<div class="team-item"><div>${PB.teamCell(t, x.id, null, true)}${x.captain ? `<span class="tp">Đội trưởng: ${esc(x.captain)}</span>` : ''}</div></div>`).join('')}</div><p class="hint">Lịch thi đấu sẽ được công bố sau khi bốc thăm.</p>`
        : '<p class="empty">Danh sách đội sẽ được công bố sớm.</p>';
      return;
    }
    const g = t.groups[0].name;
    const ms = PB.groupMatches(t, g);
    const pending = ms.filter((m) => !PB.result(m));
    const curRound = pending.length ? Math.min(...pending.map((m) => m.round)) : null;
    const podium = PB.podium(t);
    $('#bxh-body').innerHTML = `
      ${podium.length ? `<div class="card" style="margin-bottom:18px"><h3>🏆 Kết quả chung cuộc</h3><div class="podium">${podium.map((id, i) => `<div class="row"><span style="font-size:1.5rem">${['🥇', '🥈', '🥉'][i]}</span><div><small class="muted">${['Giải Nhất', 'Giải Nhì', 'Giải Ba'][i]}</small>${PB.teamCell(t, id, null, true)}</div></div>`).join('')}</div></div>` : ''}
      <div class="card">${PB.renderStandings(t, g)}</div>
      ${curRound ? `<div class="round-title">Vòng ${curRound} ${ms.some((m) => m.round === curRound && PB.tieScore(m).done) ? '· đang thi đấu' : '· tiếp theo'}</div>
        <div class="match-list ties">${ms.filter((m) => m.round === curRound).map((m) => PB.renderMatch(t, m)).join('')}</div>` : ''}
      <p style="margin-top:18px"><a class="btn ghost sm" href="${url}#lich">Xem toàn bộ 7 vòng đấu →</a></p>`;
  }

  /* Danh sách giải */
  const order = { 'dang-dien-ra': 0, 'mo-dang-ky': 1, 'sap-dien-ra': 2, 'da-ket-thuc': 3 };
  data.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || String(a.date).localeCompare(b.date));
  const filters = [['all', 'Tất cả'], ...Object.entries(PB.STATUS)];
  let current = 'all';
  $('#filters').innerHTML = data.length > 1 ? filters.map(([k, v]) => `<button class="chip ${k === 'all' ? 'active' : ''}" data-k="${k}" role="tab">${v}</button>`).join('') : '';
  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    current = b.dataset.k;
    document.querySelectorAll('#filters .chip').forEach((x) => x.classList.toggle('active', x === b));
    render();
  });

  function card(t) {
    const n = (t.teams || []).length;
    const reg = t.registerUrl || C.registerUrl;
    const champ = PB.champion(t);
    const url = 'giai-dau.html?id=' + encodeURIComponent(t.id);
    return `<article class="card t-card">
      ${PB.statusBadge(t.status)}
      <h3><a href="${url}">${esc(t.name)}</a></h3>
      <div class="t-meta">
        <span>📅 <b>${esc(PB.fmtDateRange(t))}</b>${t.time ? ' · ' + esc(t.time) : ''}</span>
        ${t.location ? `<span>📍 ${esc(t.location)}</span>` : ''}
        <span>🎾 ${esc([t.category, t.level].filter(Boolean).join(' · '))}</span>
        <span>🧩 ${esc(PB.FORMATS[t.format] || '')}${n ? ` · ${n} đội` : ''}</span>
        ${t.prize ? `<span>🏆 ${esc(t.prize)}</span>` : ''}
        ${champ ? `<span>🥇 Vô địch: <b>${esc(PB.teamName(t, champ))}</b></span>` : ''}
      </div>
      <div class="foot">
        <a class="btn sm primary" href="${url}">${t.status === 'dang-dien-ra' ? 'Xem trực tiếp' : t.status === 'da-ket-thuc' ? 'Xem kết quả' : 'Chi tiết'}</a>
        ${t.status === 'mo-dang-ky' && reg ? `<a class="btn sm gold" href="${esc(reg)}" target="_blank" rel="noopener">Đăng ký</a>` : ''}
      </div>
    </article>`;
  }
  function render() {
    const list = data.filter((t) => current === 'all' || t.status === current);
    $('#list').innerHTML = list.length ? list.map(card).join('') : '<p class="empty">Chưa có giải nào trong mục này.</p>';
  }
  render();
})();

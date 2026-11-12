(async function () {
  const C = window.SITE_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const esc = PB.esc;
  $('#slogan').textContent = C.slogan || '';

  // Liên hệ
  const contacts = [];
  if (C.phone) contacts.push(['📞', 'Hotline', C.phone, 'tel:' + C.phone.replace(/\s/g, '')]);
  if (C.zalo) contacts.push(['💬', 'Zalo', C.zalo, 'https://zalo.me/' + C.zalo.replace(/\s/g, '')]);
  if (C.facebook) contacts.push(['👍', 'Facebook', 'Fanpage', C.facebook]);
  if (C.email) contacts.push(['✉️', 'Email', C.email, 'mailto:' + C.email]);
  if (C.address) contacts.push(['📍', 'Khu vực', C.address, '']);
  $('#contact').innerHTML = contacts.map(([i, k, v, href]) =>
    `<${href ? `a href="${esc(href)}" target="_blank" rel="noopener"` : 'div'} class="card"><small>${i} ${esc(k)}</small><b>${esc(v)}</b></${href ? 'a' : 'div'}>`).join('');

  let data = [];
  try { data = await PB.loadPublic(); }
  catch (e) {
    $('#list').innerHTML = `<p class="empty">Không tải được danh sách giải. ${location.protocol === 'file:' ? 'Hãy mở website qua máy chủ web (GitHub Pages) thay vì mở file trực tiếp.' : ''}</p>`;
    return;
  }
  data = data.filter((t) => t.public !== false);

  const played = data.reduce((n, t) => n + (t.matches || []).filter((m) => PB.result(m)).length, 0);
  const teams = data.reduce((n, t) => n + (t.teams || []).length, 0);
  $('#s-giai').textContent = data.length;
  $('#s-doi').textContent = teams;
  $('#s-tran').textContent = played;

  const order = { 'dang-dien-ra': 0, 'mo-dang-ky': 1, 'sap-dien-ra': 2, 'da-ket-thuc': 3 };
  data.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) ||
    (a.status === 'da-ket-thuc' ? String(b.date).localeCompare(a.date) : String(a.date).localeCompare(b.date)));

  const filters = [['all', 'Tất cả'], ...Object.entries(PB.STATUS)];
  let current = 'all';
  $('#filters').innerHTML = filters.map(([k, v]) => `<button class="chip ${k === 'all' ? 'active' : ''}" data-k="${k}" role="tab">${v}</button>`).join('');
  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    current = b.dataset.k;
    document.querySelectorAll('#filters .chip').forEach((x) => x.classList.toggle('active', x === b));
    render();
  });

  function card(t) {
    const n = (t.teams || []).length;
    const max = +t.maxTeams || 0;
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
        <span>🧩 ${esc(PB.FORMATS[t.format] || '')}</span>
        ${t.fee ? `<span>💵 Lệ phí: <b>${esc(t.fee)}</b></span>` : ''}
        ${t.prize ? `<span>🏆 ${esc(t.prize)}</span>` : ''}
        ${champ ? `<span>🥇 Vô địch: <b>${esc(PB.teamName(t, champ))}</b></span>` : ''}
      </div>
      ${max ? `<div><div class="hint" style="margin:0 0 4px">${n}/${max} suất đã đăng ký</div><div class="progress"><i style="width:${Math.min(100, (n / max) * 100)}%"></i></div></div>` : (n ? `<div class="hint" style="margin:0">${n} đội/VĐV</div>` : '')}
      <div class="foot">
        <a class="btn sm primary" href="${url}">${t.status === 'dang-dien-ra' ? 'Xem trực tiếp' : t.status === 'da-ket-thuc' ? 'Xem kết quả' : 'Chi tiết'}</a>
        ${t.status === 'mo-dang-ky' && reg ? `<a class="btn sm ball" href="${esc(reg)}" target="_blank" rel="noopener">Đăng ký ngay</a>` : ''}
      </div>
    </article>`;
  }

  function render() {
    const list = data.filter((t) => current === 'all' || t.status === current);
    $('#list').innerHTML = list.length ? list.map(card).join('') : '<p class="empty">Chưa có giải nào trong mục này.</p>';
  }
  render();
})();

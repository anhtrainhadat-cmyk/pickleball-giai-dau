(function () {
  const C = window.SITE_CONFIG || {};
  const esc = PB.esc;
  const app = document.getElementById('app');
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const isLocal = params.get('nguon') === 'local';
  let tab = location.hash.slice(1) || 'tong-quan';

  async function load() {
    if (isLocal) return PB.loadLocal().find((t) => t.id === id);
    const list = await PB.loadPublic();
    return list.find((t) => t.id === id && t.public !== false);
  }

  function tabsFor(t) {
    const tabs = [['tong-quan', 'Tổng quan'], ['doi', `${PB.isTeam(t) ? 'Các đội' : 'Danh sách'} (${(t.teams || []).length})`]];
    if ((t.groups || []).length) tabs.push(['bang', PB.singleTable(t) ? 'Bảng xếp hạng' : 'Vòng bảng']);
    if (t.koRounds) tabs.push(['nhanh', 'Nhánh đấu']);
    if ((t.matches || []).length) tabs.push(['lich', 'Lịch & kết quả']);
    return tabs;
  }

  function overview(t) {
    const reg = t.registerUrl || C.registerUrl;
    const champ = PB.champion(t);
    const played = (t.matches || []).filter((m) => PB.result(m)).length;
    const total = (t.matches || []).length;
    const podium = PB.podium(t);
    const unit = PB.isTeam(t) ? 'lượt đấu' : 'trận';
    return `<div class="info-grid">
      <div class="card"><h3>Thông tin giải</h3><dl class="kv">
        <dt>Thời gian</dt><dd>${esc(PB.fmtDateRange(t))}${t.time ? ' · ' + esc(t.time) : ''}</dd>
        ${t.location ? `<dt>Địa điểm</dt><dd>${esc(t.location)}</dd>` : ''}
        <dt>Nội dung</dt><dd>${esc(t.category || '')}</dd>
        ${t.level ? `<dt>Trình độ</dt><dd>${esc(t.level)}</dd>` : ''}
        <dt>Thể thức</dt><dd>${esc(PB.FORMATS[t.format] || '')}${t.format === 'groups-knockout' ? ` (${(t.groups || []).length || t.groupCount} bảng, top ${t.advance || 2} đi tiếp)` : ''}${PB.isTeam(t) ? ` · mỗi vòng ${(t.subEvents || PB.DEFAULT_SUBS).length} nội dung: ${esc((t.subEvents || PB.DEFAULT_SUBS).join(', '))}` : ''}</dd>
        ${t.scoring ? `<dt>Tính điểm</dt><dd>${esc(t.scoring)}</dd>` : ''}
        ${t.fee ? `<dt>Lệ phí</dt><dd>${esc(t.fee)}</dd>` : ''}
        ${t.prize ? `<dt>Giải thưởng</dt><dd>${esc(t.prize)}</dd>` : ''}
        ${t.contact ? `<dt>Liên hệ</dt><dd>${esc(t.contact)}</dd>` : ''}
      </dl></div>
      <div class="card">
        ${podium.length ? `<div class="podium" style="margin-bottom:16px">${podium.map((id, i) => `<div class="row"><span style="font-size:1.5rem">${['🥇', '🥈', '🥉'][i]}</span><div><small class="muted">${['Giải Nhất', 'Giải Nhì', 'Giải Ba'][i]}</small>${PB.teamCell(t, id, null, true)}</div></div>`).join('')}</div>`
          : champ ? `<div class="champ-card" style="margin-bottom:16px"><div class="trophy">🏆</div><small>Nhà vô địch</small>${PB.teamCell(t, champ)}</div>` : ''}
        ${total ? `<h3>Tiến độ</h3><p class="muted" style="margin:0 0 6px">${played}/${total} ${unit} đã có kết quả</p><div class="progress"><i style="width:${(played / total) * 100}%"></i></div>` : ''}
        ${t.description ? `<h3 style="margin-top:16px">Giới thiệu</h3><div class="prose">${esc(t.description)}</div>` : ''}
        ${t.status === 'mo-dang-ky' && reg ? `<p style="margin-top:16px"><a class="btn gold" href="${esc(reg)}" target="_blank" rel="noopener">Đăng ký tham gia</a></p>` : ''}
      </div>
    </div>`;
  }

  function teamsView(t) {
    if (!(t.teams || []).length) return '<p class="empty">Chưa có đội/VĐV nào. Danh sách sẽ được cập nhật khi ban tổ chức duyệt đăng ký.</p>';
    return `<div class="team-list">${t.teams.map((x) => `<div class="team-item"><div>
      <span class="tn">${esc(x.name)}</span>
      ${x.captain ? `<span class="tp">👑 Đội trưởng: ${esc(x.captain)}</span>` : ''}
      ${x.club ? `<span class="tp">🏠 ${esc(x.club)}</span>` : ''}
      ${x.players ? `<div class="roster">${esc(x.players)}</div>` : ''}</div></div>`).join('')}</div>`;
  }

  function groupsView(t) {
    return `<div class="groups">${t.groups.map((g) => `<div class="card">${PB.renderStandings(t, g.name)}</div>`).join('')}</div>`;
  }

  function scheduleView(t) {
    const koInfo = PB.resolveKO(t);
    let html = '';
    const gm = (t.matches || []).filter((m) => m.stage === 'group');
    if (gm.length) {
      html += `<h2 class="stage-title">${PB.isTeam(t) ? 'Vòng tròn đồng đội' : t.format === 'round-robin' ? 'Các trận đấu' : 'Vòng bảng'}</h2>`;
      const rounds = [...new Set(gm.map((m) => m.round))].sort((a, b) => a - b);
      rounds.forEach((r) => {
        html += `<div class="round-title">${PB.isTeam(t) ? 'Vòng' : 'Lượt'} ${r}</div><div class="match-list ${PB.isTeam(t) ? 'ties' : ''}">${gm.filter((m) => m.round === r).map((m) => PB.renderMatch(t, m)).join('')}</div>`;
      });
    }
    if (t.koRounds) {
      html += '<h2 class="stage-title">Vòng loại trực tiếp</h2>';
      for (let r = 0; r < t.koRounds; r++) {
        const ms = PB.koMatches(t).filter((m) => m.round === r && !koInfo[m.id].isBye).sort((a, b) => a.pos - b.pos);
        if (!ms.length) continue;
        html += `<div class="round-title">${PB.roundName(r, t.koRounds)}</div><div class="match-list">${ms.map((m) => PB.renderMatch(t, m, { koInfo })).join('')}</div>`;
      }
    }
    return html;
  }

  function render(t) {
    if (!t) {
      app.innerHTML = `<div class="container" style="padding:48px 16px"><p class="empty">Không tìm thấy giải đấu. <a href="index.html">Quay lại danh sách</a></p></div>`;
      return;
    }
    document.title = t.name + ' — ' + (C.name || 'Pickleball');
    const tabs = tabsFor(t);
    if (!tabs.some(([k]) => k === tab)) tab = 'tong-quan';
    const reg = t.registerUrl || C.registerUrl;
    const views = { 'tong-quan': overview, doi: teamsView, bang: groupsView, nhanh: (x) => PB.renderBracket(x), lich: scheduleView };
    app.innerHTML = `
      ${isLocal ? '<div class="draft-note">Bản xem trước từ máy của ban tổ chức — chưa phải dữ liệu công khai</div>' : ''}
      <section class="t-hero"><div class="container">
        ${PB.statusBadge(t.status)}
        <h1 style="margin-top:10px">${esc(t.name)}</h1>
        <div class="t-meta">
          <span>📅 <b>${esc(PB.fmtDateRange(t))}</b>${t.time ? ' · ' + esc(t.time) : ''}</span>
          ${t.location ? `<span>📍 ${esc(t.location)}</span>` : ''}
          <span>🎾 ${esc([t.category, t.level].filter(Boolean).join(' · '))}</span>
          ${t.prize ? `<span>🏆 ${esc(t.prize)}</span>` : ''}
        </div>
        <div class="actions">
          ${t.status === 'mo-dang-ky' && reg ? `<a class="btn gold" href="${esc(reg)}" target="_blank" rel="noopener">Đăng ký tham gia</a>` : ''}
          <button class="btn sm ghost" id="share">Chia sẻ</button>
        </div>
      </div></section>
      <div class="container">
        <nav class="tabs" role="tablist">${tabs.map(([k, v]) => `<button role="tab" data-tab="${k}" class="${k === tab ? 'active' : ''}">${v}</button>`).join('')}</nav>
        <div id="view">${views[tab](t)}</div>
        ${t.status === 'dang-dien-ra' && !isLocal ? '<p class="hint" style="margin-top:20px">Trang tự cập nhật kết quả mỗi 60 giây.</p>' : ''}
      </div>`;
    app.querySelector('.tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      tab = b.dataset.tab;
      history.replaceState(null, '', '#' + tab);
      render(t);
    });
    document.getElementById('share').addEventListener('click', async () => {
      const url = location.href.split('#')[0];
      if (navigator.share) { try { await navigator.share({ title: t.name, url }); } catch (e) { /* bỏ qua */ } }
      else { try { await navigator.clipboard.writeText(url); toast('Đã sao chép đường link'); } catch (e) { prompt('Sao chép link:', url); } }
    });
  }

  async function run() {
    try { const t = await load(); render(t); return t; }
    catch (e) { app.innerHTML = `<div class="container" style="padding:48px 16px"><p class="empty">Không tải được dữ liệu: ${esc(e.message)}</p></div>`; }
  }
  run().then((t) => {
    if (t && t.status === 'dang-dien-ra' && !isLocal) {
      setInterval(async () => { try { const n = await load(); if (n) { const y = scrollY; render(n); scrollTo(0, y); } } catch (e) { /* thử lại lần sau */ } }, 60000);
    }
  });
})();

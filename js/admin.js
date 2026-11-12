(function () {
  const esc = PB.esc;
  const $ = (s, r = document) => r.querySelector(s);
  let list = PB.loadLocal();
  let curId = (list[0] || {}).id || null;
  let tab = 'thong-tin';

  const cur = () => list.find((t) => t.id === curId);
  let saveTimer;
  function save(now) {
    const t = cur(); if (t) t.updatedAt = Date.now();
    clearTimeout(saveTimer);
    const doSave = () => { if (!PB.saveLocal(list)) toast('Không lưu được — bộ nhớ trình duyệt bị chặn'); };
    if (now) doSave(); else saveTimer = setTimeout(doSave, 300);
  }

  function newTournament() {
    const today = new Date().toISOString().slice(0, 10);
    return {
      id: 'giai-' + PB.uid(), name: 'Giải pickleball mới', status: 'mo-dang-ky', public: true,
      date: today, endDate: '', time: '07:30', location: '', category: 'Đôi nam', level: '',
      format: 'groups-knockout', groupCount: 2, advance: 2,
      scoring: 'Vòng bảng: 1 game 11 điểm (thắng cách 2). Bán kết, chung kết: 2/3 game 11 điểm.',
      maxTeams: 16, fee: '', prize: '', registerUrl: '', contact: '', description: '',
      teams: [], groups: [], matches: [], koRounds: 0, createdAt: Date.now(), updatedAt: Date.now()
    };
  }

  /* ---------- Danh sách bên trái ---------- */
  function renderList() {
    const ul = $('#tlist');
    if (!list.length) { ul.innerHTML = '<li class="hint">Chưa có giải nào.</li>'; return; }
    ul.innerHTML = list.map((t) => `<li><button data-id="${esc(t.id)}" class="${t.id === curId ? 'active' : ''}">
      <b>${esc(t.name)}</b><small>${esc(PB.fmtDate(t.date))} · ${esc(PB.STATUS[t.status] || '')}${t.public === false ? ' · ẩn' : ''}</small></button></li>`).join('');
  }
  $('#tlist').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]'); if (!b) return;
    curId = b.dataset.id; renderAll();
  });
  $('#new').addEventListener('click', () => {
    const t = newTournament(); list.unshift(t); curId = t.id; tab = 'thong-tin'; save(true); renderAll();
    const f = $('[data-k="name"]'); if (f) { f.focus(); f.select(); }
  });
  $('#pull').addEventListener('click', pullFromWeb);

  async function pullFromWeb() {
    let web;
    try { web = await PB.loadPublic(); } catch (e) { toast('Không tải được dữ liệu từ website'); return; }
    let added = 0, updated = 0;
    web.forEach((w) => {
      const i = list.findIndex((t) => t.id === w.id);
      if (i < 0) { list.push(w); added++; }
      else if ((w.updatedAt || 0) > (list[i].updatedAt || 0)) { list[i] = w; updated++; }
    });
    if (!curId && list[0]) curId = list[0].id;
    save(true); renderAll();
    toast(`Đã lấy ${web.length} giải từ web: thêm ${added}, cập nhật ${updated}`);
  }

  /* ---------- Trình soạn ---------- */
  const TABS = [['thong-tin', '1. Thông tin'], ['doi', '2. Đội / VĐV'], ['thi-dau', '3. Thi đấu & tỉ số'], ['xuat-ban', '4. Đăng lên web']];

  function renderEditor() {
    const ed = $('#editor');
    const t = cur();
    if (!t) {
      ed.innerHTML = `<div class="card"><h2>Chào ban tổ chức 👋</h2>
        <p>Trang này giúp anh/chị tạo giải, nhập danh sách đội, tự động chia bảng – xếp lịch, nhập tỉ số và đăng kết quả lên website.</p>
        <p class="muted">Bắt đầu bằng nút <b>+ Tạo giải mới</b>, hoặc <b>⤓ Lấy từ web</b> để chỉnh sửa các giải đang có trên website.</p></div>`;
      return;
    }
    const views = { 'thong-tin': infoView, doi: teamsView, 'thi-dau': matchesView, 'xuat-ban': publishView };
    ed.innerHTML = `<div class="toolbar" style="justify-content:space-between">
        <h2 style="margin:0;font-size:1.4rem">${esc(t.name)}</h2>
        <div class="toolbar">
          <a class="btn sm" href="giai-dau.html?id=${encodeURIComponent(t.id)}&nguon=local" target="_blank">👁 Xem trước</a>
          <button class="btn sm" data-act="dup">Nhân bản</button>
          <button class="btn sm danger" data-act="del">Xoá</button>
        </div></div>
      <nav class="tabs">${TABS.map(([k, v]) => `<button data-tab="${k}" class="${k === tab ? 'active' : ''}">${v}</button>`).join('')}</nav>
      <div id="pane">${views[tab](t)}</div>`;
  }

  function renderAll() { renderList(); renderEditor(); }

  /* Tab 1: Thông tin */
  function infoView(t) {
    const opt = (obj, v) => Object.entries(obj).map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${l}</option>`).join('');
    const inp = (k, label, type = 'text', extra = '') => `<label class="f">${label}<input type="${type}" data-k="${k}" value="${esc(t[k] ?? '')}" ${extra}></label>`;
    const cats = PB.CATEGORIES.includes(t.category) ? PB.CATEGORIES : [t.category, ...PB.CATEGORIES];
    return `<div class="card"><div class="form-grid">
      <label class="f full">Tên giải<input data-k="name" value="${esc(t.name)}" required></label>
      <label class="f">Trạng thái<select data-k="status">${opt(PB.STATUS, t.status)}</select></label>
      ${inp('date', 'Ngày bắt đầu', 'date')}
      ${inp('endDate', 'Ngày kết thúc <small>(nếu nhiều ngày)</small>', 'date')}
      ${inp('time', 'Giờ khai mạc', 'text', 'placeholder="07:30"')}
      <label class="f full">Địa điểm<input data-k="location" value="${esc(t.location)}" placeholder="Tên sân, địa chỉ"></label>
      <label class="f">Nội dung<select data-k="category">${cats.map((c) => `<option ${c === t.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      ${inp('level', 'Trình độ', 'text', 'placeholder="VD: Dưới 3.0, Mở rộng"')}
      ${inp('maxTeams', 'Số suất tối đa', 'number', 'min="2"')}
      <label class="f">Thể thức<select data-k="format">${opt(PB.FORMATS, t.format)}</select></label>
      ${t.format === 'groups-knockout' ? `${inp('groupCount', 'Số bảng', 'number', 'min="1" max="16"')}
      <label class="f">Số đội đi tiếp mỗi bảng<select data-k="advance">${[1, 2, 3, 4].map((n) => `<option ${+t.advance === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
      <label class="f full">Cách tính điểm<input data-k="scoring" value="${esc(t.scoring)}"></label>
      ${inp('fee', 'Lệ phí', 'text', 'placeholder="VD: 300.000đ/đội"')}
      ${inp('prize', 'Giải thưởng', 'text', 'placeholder="VD: Tổng giải 10 triệu + cúp"')}
      <label class="f full">Link đăng ký <small>(dán link Google Form — miễn phí)</small><input type="url" data-k="registerUrl" value="${esc(t.registerUrl)}" placeholder="https://forms.gle/..."></label>
      ${inp('contact', 'Liên hệ BTC', 'text', 'placeholder="Anh A – 0900 000 000"')}
      <label class="f full">Giới thiệu / Điều lệ<textarea data-k="description" rows="5">${esc(t.description)}</textarea></label>
      <label class="check full"><input type="checkbox" data-k="public" ${t.public !== false ? 'checked' : ''}> Hiển thị giải này trên website</label>
    </div>
    ${t.matches && t.matches.length ? '<p class="notice warn" style="margin-top:16px">Lưu ý: đổi thể thức / số bảng chỉ có hiệu lực sau khi bấm <b>Tạo lại lịch</b> ở bước 3 (sẽ xoá tỉ số đã nhập).</p>' : ''}
    </div>`;
  }

  /* Tab 2: Đội */
  function teamsView(t) {
    const rows = t.teams.map((x, i) => `<tr>
      <td class="n">${i + 1}</td>
      <td class="c1"><input data-tid="${x.id}" data-tk="name" value="${esc(x.name)}" placeholder="Tên đội / VĐV" aria-label="Tên đội"></td>
      <td class="c2"><input data-tid="${x.id}" data-tk="players" value="${esc(x.players || '')}" placeholder="Thành viên" aria-label="Thành viên"></td>
      <td class="c2"><input data-tid="${x.id}" data-tk="club" value="${esc(x.club || '')}" placeholder="CLB" aria-label="CLB"></td>
      <td class="act"><button class="icon-btn" data-tmove="-1" data-tid="${x.id}" title="Lên">↑</button><button class="icon-btn" data-tmove="1" data-tid="${x.id}" title="Xuống">↓</button><button class="icon-btn" data-tdel="${x.id}" title="Xoá">✕</button></td>
    </tr>`).join('');
    return `<div class="card">
      <div class="toolbar" style="justify-content:space-between"><h3 style="margin:0">Danh sách (${t.teams.length}${t.maxTeams ? '/' + t.maxTeams : ''})</h3>
        <div class="toolbar"><button class="btn sm" data-act="shuffle">🎲 Bốc thăm ngẫu nhiên</button>${t.teams.length ? '<button class="btn sm danger" data-act="clear-teams">Xoá hết</button>' : ''}</div></div>
      <p class="hint">Thứ tự trong danh sách = thứ tự hạt giống (đội số 1, 2… sẽ được xếp tránh nhau). Dùng ↑ ↓ để xếp hạt giống, hoặc bốc thăm ngẫu nhiên.</p>
      ${t.teams.length ? `<table class="team-table"><thead><tr><th>#</th><th>Tên đội / VĐV</th><th>Thành viên</th><th>CLB</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="empty">Chưa có đội nào.</p>'}
      </div>
      <div class="card" style="margin-top:16px">
        <h3>Thêm nhanh nhiều đội</h3>
        <p class="hint">Mỗi dòng một đội theo dạng: <code>Tên đội | Thành viên | CLB</code>. Có thể chỉ ghi tên. Có thể dán trực tiếp từ Google Sheets (kết quả Google Form).</p>
        <textarea id="bulk" rows="6" placeholder="Đội Sấm Sét | Nguyễn Văn A - Trần Văn B | CLB Quận 7&#10;Đội Gió Lốc | Lê Văn C - Phạm Văn D"></textarea>
        <div class="toolbar" style="margin-top:10px"><button class="btn primary" data-act="bulk-add">Thêm vào danh sách</button></div>
      </div>
      ${t.matches && t.matches.length ? '<p class="notice warn" style="margin-top:16px">Đã có lịch thi đấu. Nếu thêm/bớt đội, hãy vào bước 3 bấm <b>Tạo lại lịch</b>. Sửa tên đội thì không cần.</p>' : ''}`;
  }

  /* Tab 3: Thi đấu */
  function matchesView(t) {
    if (!t.matches || !t.matches.length) {
      return `<div class="card"><h3>Tạo lịch thi đấu</h3>
        <p>Thể thức: <b>${esc(PB.FORMATS[t.format])}</b>${t.format === 'groups-knockout' ? ` — ${t.groupCount} bảng, top ${t.advance} đi tiếp` : ''}. Số đội: <b>${t.teams.length}</b>.</p>
        <p class="hint">Hệ thống sẽ tự chia bảng theo hạt giống, xếp cặp vòng tròn và dựng nhánh loại trực tiếp (có miễn đấu nếu số đội lẻ).</p>
        <button class="btn primary" data-act="generate" ${t.teams.length < 2 ? 'disabled' : ''}>⚙️ Tạo lịch thi đấu</button>
        ${t.teams.length < 2 ? '<p class="hint">Cần ít nhất 2 đội — thêm ở bước 2.</p>' : ''}</div>`;
    }
    const played = t.matches.filter((m) => PB.result(m)).length;
    let html = `<div class="card no-print"><div class="toolbar" style="justify-content:space-between">
      <div><b>${played}/${t.matches.length}</b> trận có kết quả</div>
      <div class="toolbar"><button class="btn sm" onclick="print()">🖨 In lịch</button><button class="btn sm danger" data-act="generate">↻ Tạo lại lịch</button></div></div>
      <p class="hint">Nhập tỉ số từng game, cách nhau bằng dấu phẩy, theo thứ tự <b>đội trên – đội dưới</b>. VD: <code>11-7</code> hoặc <code>11-9, 8-11, 11-6</code>. Tỉ số lưu tự động.</p></div>`;
    const gm = t.matches.filter((m) => m.stage === 'group');
    t.groups.forEach((g) => {
      const ms = gm.filter((m) => m.group === g.name);
      html += `<h2 class="stage-title">${t.format === 'round-robin' ? 'Vòng tròn' : 'Bảng ' + esc(g.name)}</h2>
        <div class="card" style="margin-bottom:14px">${PB.renderStandings(t, g.name)}</div>
        <div class="match-list">${ms.map((m) => PB.renderMatch(t, m, { editable: true })).join('')}</div>`;
    });
    if (t.koRounds) html += `<h2 class="stage-title">Vòng loại trực tiếp</h2>${PB.renderBracket(t, { editable: true })}`;
    return html;
  }

  /* Tab 4: Xuất bản */
  function publishView() {
    const pub = list.filter((t) => t.public !== false);
    return `<div class="card">
      <h3>Đăng dữ liệu lên website</h3>
      <p>Website đọc dữ liệu từ file <code>data/giai-dau.json</code> trong kho GitHub. Mỗi khi muốn cập nhật web (thêm giải, danh sách đội, tỉ số…):</p>
      <ol class="guide">
        <li>Bấm <b>Tải file giai-dau.json</b> bên dưới (gồm ${pub.length} giải đang bật hiển thị).</li>
        <li>Mở kho GitHub của website → vào thư mục <code>data</code> → <b>Add file › Upload files</b> → kéo file vừa tải vào → <b>Commit changes</b>.</li>
        <li>Đợi khoảng 1 phút, website sẽ hiển thị dữ liệu mới.</li>
      </ol>
      <p class="notice">💡 Nếu dùng nhiều máy: trước khi sửa, bấm <b>⤓ Lấy từ web</b> để có dữ liệu mới nhất, tránh ghi đè mất giải của người khác.</p>
      <div class="toolbar" style="margin-top:14px">
        <button class="btn primary" data-act="export">⤓ Tải file giai-dau.json</button>
        <button class="btn" data-act="backup">Sao lưu toàn bộ</button>
        <label class="btn">Nhập từ file…<input type="file" accept=".json,application/json" id="importFile" hidden></label>
      </div></div>`;
  }

  /* ---------- Sự kiện ---------- */
  const ed = $('#editor');

  ed.addEventListener('click', (e) => {
    const t = cur();
    const tb = e.target.closest('[data-tab]');
    if (tb) { tab = tb.dataset.tab; renderEditor(); return; }
    const a = e.target.closest('[data-act]');
    if (a) return action(a.dataset.act, t);
    const mv = e.target.closest('[data-tmove]');
    if (mv) {
      const i = t.teams.findIndex((x) => x.id === mv.dataset.tid), j = i + +mv.dataset.tmove;
      if (j < 0 || j >= t.teams.length) return;
      [t.teams[i], t.teams[j]] = [t.teams[j], t.teams[i]];
      save(); renderEditor(); return;
    }
    const del = e.target.closest('[data-tdel]');
    if (del) {
      const tm = PB.team(t, del.dataset.tdel);
      if (!confirm(`Xoá "${tm.name}" khỏi danh sách?`)) return;
      t.teams = t.teams.filter((x) => x.id !== del.dataset.tdel);
      save(); renderEditor();
    }
  });

  ed.addEventListener('input', (e) => {
    const t = cur(); const el = e.target;
    if (el.dataset.k) {
      const k = el.dataset.k;
      t[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : +el.value) : el.value;
      save(); renderList();
      if (k === 'name') $('#editor h2').textContent = t.name;
      if (k === 'format') renderEditor();
    } else if (el.dataset.tid && el.dataset.tk) {
      const tm = PB.team(t, el.dataset.tid); if (tm) { tm[el.dataset.tk] = el.value; save(); }
    }
  });

  ed.addEventListener('change', (e) => {
    const t = cur(); const el = e.target;
    if (el.id === 'importFile') return importFile(el.files[0]);
    if (!el.dataset.mid) return;
    const m = t.matches.find((x) => x.id === el.dataset.mid); if (!m) return;
    const f = el.dataset.f;
    if (f === 'games') {
      const g = PB.parseGames(el.value);
      if (g === null) { el.classList.add('invalid'); toast('Tỉ số chưa đúng dạng, VD: 11-7, 11-9'); return; }
      if (g.length && !PB.result({ games: g })) { el.classList.add('invalid'); toast('Hai đội đang hoà số game — kiểm tra lại'); return; }
      el.classList.remove('invalid');
      m.games = g;
    } else m[f] = el.value.trim();
    save(true);
    // Vẽ lại nhưng giữ vị trí con trỏ
    setTimeout(() => {
      const a = document.activeElement;
      const key = a && a.dataset && a.dataset.mid ? [a.dataset.mid, a.dataset.f] : null;
      const y = scrollY;
      $('#pane').innerHTML = matchesView(t);
      scrollTo(0, y);
      if (key) { const n = $(`[data-mid="${key[0]}"][data-f="${key[1]}"]`); if (n) n.focus(); }
    }, 0);
  });

  function action(act, t) {
    switch (act) {
      case 'del':
        if (!confirm(`Xoá giải "${t.name}" khỏi máy này? (Không ảnh hưởng website cho đến khi anh tải file lên lại)`)) return;
        list = list.filter((x) => x.id !== t.id); curId = (list[0] || {}).id || null; save(true); renderAll(); break;
      case 'dup': {
        const c = JSON.parse(JSON.stringify(t));
        c.id = 'giai-' + PB.uid(); c.name = t.name + ' (bản sao)'; c.matches = []; c.groups = []; c.koRounds = 0; c.status = 'mo-dang-ky';
        list.unshift(c); curId = c.id; save(true); renderAll(); toast('Đã nhân bản (không kèm lịch thi đấu)'); break;
      }
      case 'shuffle':
        if (!t.teams.length) return;
        if (!confirm('Xáo trộn ngẫu nhiên thứ tự các đội (bốc thăm)?')) return;
        for (let i = t.teams.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t.teams[i], t.teams[j]] = [t.teams[j], t.teams[i]]; }
        save(); renderEditor(); toast('Đã bốc thăm'); break;
      case 'clear-teams':
        if (!confirm('Xoá toàn bộ danh sách đội?')) return;
        t.teams = []; save(); renderEditor(); break;
      case 'bulk-add': {
        const lines = $('#bulk').value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        lines.forEach((line) => {
          const p = line.split(/\s*[|\t]\s*/);
          t.teams.push({ id: 't' + PB.uid(), name: p[0], players: p[1] || '', club: p[2] || '' });
        });
        save(); renderEditor(); toast(`Đã thêm ${lines.length} đội`); break;
      }
      case 'generate':
        if (t.matches.length && !confirm('Tạo lại lịch sẽ XOÁ toàn bộ tỉ số đã nhập. Tiếp tục?')) return;
        try { PB.generate(t); save(true); renderEditor(); toast(`Đã tạo ${t.matches.length} trận`); }
        catch (err) { toast(err.message); }
        break;
      case 'export': {
        const pub = list.filter((x) => x.public !== false);
        download('giai-dau.json', pub); break;
      }
      case 'backup': download('sao-luu-giai-dau-' + new Date().toISOString().slice(0, 10) + '.json', list); break;
    }
  }

  function download(name, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function importFile(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result);
        const arr = Array.isArray(j) ? j : j.tournaments || [];
        let n = 0;
        arr.forEach((w) => { if (!w || !w.id) return; const i = list.findIndex((t) => t.id === w.id); if (i < 0) list.push(w); else list[i] = w; n++; });
        if (!curId && list[0]) curId = list[0].id;
        save(true); renderAll(); toast(`Đã nhập ${n} giải`);
      } catch (e) { toast('File không hợp lệ'); }
    };
    r.readAsText(file);
  }

  renderAll();
})();

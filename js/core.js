/* Lõi xử lý giải đấu: lịch thi đấu, bảng xếp hạng, nhánh loại trực tiếp, hiển thị */
(function (root) {
  'use strict';
  const PB = {};

  PB.STORE_KEY = 'pb_giai_dau_v1';

  PB.FORMATS = {
    'round-robin': 'Vòng tròn tính điểm',
    'knockout': 'Loại trực tiếp',
    'groups-knockout': 'Vòng bảng + Loại trực tiếp',
    'team-rr': 'Đồng đội vòng tròn'
  };
  PB.DEFAULT_SUBS = ['Đôi nam 1', 'Đôi nam nữ 1', 'Đôi nam 2', 'Đôi nam nữ 2'];
  PB.isTeam = (t) => t && t.format === 'team-rr';
  PB.singleTable = (t) => t && (t.format === 'round-robin' || t.format === 'team-rr');
  PB.STATUS = {
    'mo-dang-ky': 'Đang mở đăng ký',
    'sap-dien-ra': 'Sắp diễn ra',
    'dang-dien-ra': 'Đang diễn ra',
    'da-ket-thuc': 'Đã kết thúc'
  };
  PB.CATEGORIES = ['Đôi nam', 'Đôi nữ', 'Đôi nam nữ', 'Đơn nam', 'Đơn nữ', 'Đồng đội', 'Mở rộng'];

  PB.uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  PB.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  PB.fmtDate = (d) => {
    if (!d) return '';
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
  };
  PB.fmtDateRange = (t) => {
    const a = PB.fmtDate(t.date), b = PB.fmtDate(t.endDate);
    return b && b !== a ? `${a} – ${b}` : a;
  };

  /* ---------- Tỉ số ---------- */
  // "11-7, 9-11, 11-5" -> [[11,7],[9,11],[11,5]] ; chuỗi rỗng -> [] ; sai định dạng -> null
  PB.parseGames = function (str) {
    if (!str || !String(str).trim()) return [];
    const parts = String(str).split(/[,;/]+/).map((s) => s.trim()).filter(Boolean);
    const games = [];
    for (const p of parts) {
      const m = p.match(/^(\d{1,2})\s*[-:–]\s*(\d{1,2})$/);
      if (!m) return null;
      if (+m[1] === +m[2]) return null;
      games.push([+m[1], +m[2]]);
    }
    return games;
  };
  PB.formatGames = (g) => (g || []).map((x) => `${x[0]}-${x[1]}`).join(', ');

  // Kết quả 1 trận đấu (gồm 1 hoặc nhiều game)
  PB.gameResult = function (games) {
    if (!games || !games.length) return null;
    let wa = 0, wb = 0, pa = 0, pb = 0;
    for (const [x, y] of games) {
      pa += x; pb += y;
      if (x > y) wa++; else if (y > x) wb++;
    }
    if (wa === wb) return null;
    return { wa, wb, pa, pb, winner: wa > wb ? 'a' : 'b' };
  };

  // Tỉ số một lượt đấu đồng đội (nhiều nội dung) — tính cả khi chưa đấu xong
  PB.tieScore = function (m) {
    let wa = 0, wb = 0, pa = 0, pb = 0, done = 0;
    for (const s of m.subs || []) {
      const r = PB.gameResult(s.games);
      if (!r) continue;
      done++; pa += r.pa; pb += r.pb;
      if (r.winner === 'a') wa++; else wb++;
    }
    const total = (m.subs || []).length;
    return { wa, wb, pa, pb, done, total, complete: total > 0 && done === total, winner: wa > wb ? 'a' : wb > wa ? 'b' : 'draw' };
  };

  // Kết quả trận (thường) hoặc lượt đấu đồng đội (khi đã đấu đủ nội dung)
  PB.result = function (m) {
    if (!m) return null;
    if (m.subs) { const s = PB.tieScore(m); return s.complete ? s : null; }
    return PB.gameResult(m.games);
  };

  /* ---------- Lịch thi đấu ---------- */
  // Thuật toán xoay vòng (circle method)
  PB.roundRobin = function (ids) {
    const list = ids.slice();
    if (list.length % 2) list.push(null);
    const n = list.length, rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const a = list[i], b = list[n - 1 - i];
        if (a !== null && b !== null) pairs.push(r % 2 ? [b, a] : [a, b]);
      }
      rounds.push(pairs);
      list.splice(1, 0, list.pop());
    }
    return rounds;
  };

  PB.nextPow2 = (n) => { let p = 1; while (p < n) p *= 2; return p; };
  // Thứ tự hạt giống chuẩn: n=8 -> [1,8,4,5,2,7,3,6]
  PB.bracketOrder = function (n) {
    let order = [1];
    while (order.length < n) {
      const m = order.length * 2;
      order = order.flatMap((s) => [s, m + 1 - s]);
    }
    return order;
  };
  PB.groupLetter = (i) => String.fromCharCode(65 + i);

  function buildKO(t, seeds) {
    const N = PB.nextPow2(seeds.length);
    const order = PB.bracketOrder(N);
    const R = Math.log2(N);
    for (let r = 0; r < R; r++) {
      const count = N >> (r + 1);
      for (let p = 0; p < count; p++) {
        const m = { id: PB.uid(), stage: 'ko', round: r, pos: p, games: [] };
        if (r === 0) {
          m.slotA = seeds[order[2 * p] - 1] || null;
          m.slotB = seeds[order[2 * p + 1] - 1] || null;
        }
        t.matches.push(m);
      }
    }
    t.koRounds = R;
  }

  PB.generate = function (t) {
    const ids = (t.teams || []).map((x) => x.id);
    if (ids.length < 2) throw new Error('Cần ít nhất 2 đội/VĐV để tạo lịch thi đấu.');
    t.groups = [];
    t.matches = [];
    t.koRounds = 0;
    const fmt = t.format || 'groups-knockout';

    if (fmt === 'round-robin' || fmt === 'groups-knockout') {
      const G = fmt === 'round-robin' ? 1 : Math.max(1, Math.min(+t.groupCount || 2, Math.floor(ids.length / 2)));
      const groups = Array.from({ length: G }, (_, i) => ({ name: PB.groupLetter(i), teamIds: [] }));
      // Chia bảng kiểu "rắn" để hạt giống trải đều các bảng
      ids.forEach((id, i) => {
        const row = Math.floor(i / G);
        const col = row % 2 === 0 ? i % G : G - 1 - (i % G);
        groups[col].teamIds.push(id);
      });
      t.groups = groups;
      groups.forEach((g) => {
        PB.roundRobin(g.teamIds).forEach((pairs, r) =>
          pairs.forEach(([a, b]) => t.matches.push({ id: PB.uid(), stage: 'group', group: g.name, round: r + 1, a, b, games: [] }))
        );
      });
    }

    if (fmt === 'team-rr') {
      const subs = (t.subEvents && t.subEvents.length ? t.subEvents : PB.DEFAULT_SUBS);
      t.groups = [{ name: 'A', teamIds: ids.slice() }];
      PB.roundRobin(ids).forEach((pairs, r) =>
        pairs.forEach(([a, b]) => t.matches.push({
          id: PB.uid(), stage: 'group', group: 'A', round: r + 1, a, b,
          subs: subs.map((label) => ({ label, games: [], pa: '', pb: '' }))
        }))
      );
    }

    if (fmt === 'knockout') buildKO(t, ids.map((id) => ({ team: id })));

    if (fmt === 'groups-knockout') {
      const minSize = Math.min(...t.groups.map((g) => g.teamIds.length));
      const adv = Math.max(1, Math.min(+t.advance || 2, minSize));
      const G = t.groups.length;
      const seeds = [];
      for (let r = 1; r <= adv; r++) {
        const names = t.groups.map((g) => g.name);
        if (r % 2 === 0 && G % 2 === 1) names.reverse(); // tránh 2 đội cùng bảng gặp nhau sớm
        names.forEach((name) => seeds.push({ group: name, rank: r }));
      }
      if (seeds.length >= 2) buildKO(t, seeds);
    }
    t.generatedAt = Date.now();
    return t;
  };

  /* ---------- Bảng xếp hạng ---------- */
  PB.groupMatches = (t, name) => (t.matches || []).filter((m) => m.stage === 'group' && m.group === name);
  PB.groupComplete = (t, name) => {
    const ms = PB.groupMatches(t, name);
    return ms.length > 0 && ms.every((m) => PB.result(m));
  };

  // Xếp hạng đồng đội theo Điều 9 điều lệ:
  // 1) Hiệu số nội dung thắng/thua toàn giải
  // 2) 2 đội bằng nhau: kết quả đối đầu → (nếu hoà 2-2) hiệu số điểm trận đối đầu → hiệu số điểm toàn giải
  // 3) Từ 3 đội: bảng phụ giữa các đội (hiệu số nội dung → hiệu số điểm) → hiệu số điểm toàn giải
  PB.teamStandings = function (t, name) {
    const g = (t.groups || []).find((x) => x.name === name);
    if (!g) return [];
    const ms = PB.groupMatches(t, name);
    const tally = (ids, matches) => {
      const rows = new Map(ids.map((id) => [id, { id, played: 0, w: 0, d: 0, l: 0, nw: 0, nl: 0, pf: 0, pa: 0 }]));
      for (const m of matches) {
        const A = rows.get(m.a), B = rows.get(m.b);
        if (!A || !B) continue;
        const s = PB.tieScore(m);
        if (!s.done) continue;
        A.nw += s.wa; A.nl += s.wb; B.nw += s.wb; B.nl += s.wa;
        A.pf += s.pa; A.pa += s.pb; B.pf += s.pb; B.pa += s.pa;
        if (s.complete) {
          A.played++; B.played++;
          if (s.winner === 'a') { A.w++; B.l++; } else if (s.winner === 'b') { B.w++; A.l++; } else { A.d++; B.d++; }
        }
      }
      return rows;
    };
    const diff = (r) => r.nw - r.nl, pd = (r) => r.pf - r.pa;
    const breakTie = (cl) => {
      if (cl.length === 1) return cl;
      if (cl.length === 2) {
        const [x, y] = cl;
        const m = ms.find((k) => (k.a === x.id && k.b === y.id) || (k.a === y.id && k.b === x.id));
        let c = 0;
        const s = m ? PB.tieScore(m) : null;
        if (s && s.complete) {
          const xa = m.a === x.id;
          c = (xa ? s.wb : s.wa) - (xa ? s.wa : s.wb);
          if (!c) c = -(xa ? s.pa - s.pb : s.pb - s.pa);
        }
        if (!c) c = pd(y) - pd(x);
        return c > 0 ? [y, x] : [x, y];
      }
      const ids = cl.map((r) => r.id);
      const mini = tally(ids, ms.filter((k) => ids.includes(k.a) && ids.includes(k.b)));
      return cl.slice().sort((x, y) => {
        const X = mini.get(x.id), Y = mini.get(y.id);
        return diff(Y) - diff(X) || pd(Y) - pd(X) || pd(y) - pd(x);
      });
    };
    const rows = [...tally(g.teamIds, ms).values()].sort((x, y) => diff(y) - diff(x));
    const out = [];
    for (let i = 0; i < rows.length;) {
      let j = i;
      while (j < rows.length && diff(rows[j]) === diff(rows[i])) j++;
      out.push(...breakTie(rows.slice(i, j)));
      i = j;
    }
    return out;
  };

  PB.standings = function (t, name) {
    if (PB.isTeam(t)) return PB.teamStandings(t, name);
    const g = (t.groups || []).find((x) => x.name === name);
    if (!g) return [];
    const rows = new Map(g.teamIds.map((id) => [id, { id, played: 0, w: 0, l: 0, gw: 0, gl: 0, pf: 0, pa: 0 }]));
    for (const m of PB.groupMatches(t, name)) {
      const res = PB.result(m);
      const A = rows.get(m.a), B = rows.get(m.b);
      if (!res || !A || !B) continue;
      A.played++; B.played++;
      A.gw += res.wa; A.gl += res.wb; B.gw += res.wb; B.gl += res.wa;
      A.pf += res.pa; A.pa += res.pb; B.pf += res.pb; B.pa += res.pa;
      if (res.winner === 'a') { A.w++; B.l++; } else { B.w++; A.l++; }
    }
    const h2h = (x, y) => {
      const m = PB.groupMatches(t, name).find((k) => (k.a === x && k.b === y) || (k.a === y && k.b === x));
      const r = PB.result(m);
      if (!r) return 0;
      const winId = r.winner === 'a' ? m.a : m.b;
      return winId === x ? -1 : 1;
    };
    return [...rows.values()].sort((x, y) =>
      y.w - x.w ||
      (y.gw - y.gl) - (x.gw - x.gl) ||
      (y.pf - y.pa) - (x.pf - x.pa) ||
      h2h(x.id, y.id) ||
      y.pf - x.pf
    );
  };

  /* ---------- Nhánh loại trực tiếp ---------- */
  PB.roundName = function (r, R) {
    const left = R - r;
    if (left === 1) return 'Chung kết';
    if (left === 2) return 'Bán kết';
    if (left === 3) return 'Tứ kết';
    return 'Vòng 1/' + 2 ** (left - 1);
  };

  PB.koMatches = (t) => (t.matches || []).filter((m) => m.stage === 'ko');

  // Trả về map id trận -> { A, B, winner } với A/B = { id, label, bye }
  PB.resolveKO = function (t) {
    const ko = PB.koMatches(t);
    const R = t.koRounds || 0;
    const byKey = {};
    ko.forEach((m) => (byKey[m.round + ':' + m.pos] = m));
    const info = {};
    const rankLabel = (r) => (r === 1 ? 'Nhất' : r === 2 ? 'Nhì' : r === 3 ? 'Ba' : 'Hạng ' + r);
    const slotResolve = (slot) => {
      if (!slot) return { id: null, bye: true, label: 'Miễn đấu' };
      if (slot.team) return { id: slot.team };
      if (slot.group) {
        const label = `${rankLabel(slot.rank)} bảng ${slot.group}`;
        if (PB.groupComplete(t, slot.group)) {
          const row = PB.standings(t, slot.group)[slot.rank - 1];
          return row ? { id: row.id, label } : { id: null, bye: true, label: 'Miễn đấu' };
        }
        return { id: null, label };
      }
      return { id: null, label: '?' };
    };
    for (let r = 0; r < R; r++) {
      const count = 2 ** (R - r - 1);
      for (let p = 0; p < count; p++) {
        const m = byKey[r + ':' + p];
        if (!m) continue;
        let A, B;
        if (r === 0) { A = slotResolve(m.slotA); B = slotResolve(m.slotB); }
        else {
          A = info[byKey[(r - 1) + ':' + 2 * p].id].next;
          B = info[byKey[(r - 1) + ':' + (2 * p + 1)].id].next;
        }
        let winner = null, next;
        const pending = { id: null, label: `Thắng ${PB.roundName(r, R)} ${p + 1}` };
        if (A.bye && B.bye) next = { id: null, bye: true, label: 'Miễn đấu' };
        else if (A.bye) next = B;
        else if (B.bye) next = A;
        else {
          const res = A.id && B.id ? PB.result(m) : null;
          if (res) { winner = res.winner === 'a' ? A.id : B.id; next = { id: winner }; }
          else next = pending;
        }
        if ((A.bye || B.bye) && next.id) winner = next.id;
        info[m.id] = { A, B, winner, next, isBye: !!(A.bye || B.bye) };
      }
    }
    return info;
  };

  PB.champion = function (t) {
    const R = t.koRounds || 0;
    if (R) {
      const fin = PB.koMatches(t).find((m) => m.round === R - 1);
      const inf = fin && PB.resolveKO(t)[fin.id];
      return inf && inf.winner ? inf.winner : null;
    }
    if (PB.singleTable(t) && t.groups && t.groups[0] && PB.groupComplete(t, t.groups[0].name)) {
      return PB.standings(t, t.groups[0].name)[0].id;
    }
    return null;
  };

  /* ---------- Lưu trữ ---------- */
  PB.loadLocal = function () {
    try { return JSON.parse(localStorage.getItem(PB.STORE_KEY)) || []; } catch (e) { return []; }
  };
  PB.saveLocal = function (list) {
    try { localStorage.setItem(PB.STORE_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  };
  PB.loadPublic = async function () {
    const r = await fetch('data/giai-dau.json?v=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('Không tải được dữ liệu (' + r.status + ')');
    const j = await r.json();
    return Array.isArray(j) ? j : j.tournaments || [];
  };

  /* ---------- Hiển thị ---------- */
  PB.team = (t, id) => (t.teams || []).find((x) => x.id === id);
  PB.teamName = (t, id) => (PB.team(t, id) || {}).name || '—';

  PB.statusBadge = (s) => `<span class="badge st-${PB.esc(s)}">${PB.esc(PB.STATUS[s] || s || '')}</span>`;

  PB.teamCell = function (t, id, label, compact) {
    if (!id) return `<span class="tbd">${PB.esc(label || 'Chưa xác định')}</span>`;
    const tm = PB.team(t, id) || {};
    return `<span class="tn">${PB.esc(tm.name || '—')}</span>` +
      (tm.players && !compact && !PB.isTeam(t) ? `<span class="tp">${PB.esc(tm.players)}</span>` : '');
  };

  PB.podium = function (t) {
    if (!PB.singleTable(t) || !t.groups || !t.groups[0] || !PB.groupComplete(t, t.groups[0].name)) return [];
    return PB.standings(t, t.groups[0].name).slice(0, 3).map((r) => r.id);
  };

  PB.renderStandings = function (t, name, opts = {}) {
    if (PB.isTeam(t)) return renderTeamStandings(t, name);
    const rows = PB.standings(t, name);
    const adv = t.format === 'groups-knockout' ? +t.advance || 2 : (t.format === 'round-robin' ? 1 : 0);
    const done = PB.groupComplete(t, name);
    const sign = (n) => (n > 0 ? '+' + n : String(n));
    return `<div class="table-wrap"><table class="standings">
      <thead><tr><th>#</th><th class="l">${PB.singleTable(t) ? 'Đội' : 'Bảng ' + PB.esc(name)}</th>
      <th title="Số trận">Tr</th><th title="Thắng">T</th><th title="Thua">B</th><th title="Hiệu số game">HS game</th><th title="Hiệu số điểm">HS điểm</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr class="${i < adv ? 'adv' : ''}">
        <td>${i + 1}</td><td class="l">${PB.teamCell(t, r.id)}</td>
        <td>${r.played}</td><td><b>${r.w}</b></td><td>${r.l}</td><td>${sign(r.gw - r.gl)}</td><td>${sign(r.pf - r.pa)}</td></tr>`).join('')}
      </tbody></table></div>
      ${opts.legend !== false && adv ? `<p class="hint">${done ? '✔ Bảng đã hoàn tất.' : 'Bảng đang thi đấu.'} ${t.format === 'groups-knockout' ? `Top ${adv} vào vòng loại trực tiếp (tô màu).` : ''}</p>` : ''}`;
  };

  function renderTeamStandings(t, name) {
    const rows = PB.standings(t, name);
    const done = PB.groupComplete(t, name);
    const sign = (n) => (n > 0 ? '+' + n : String(n));
    const medal = ['🥇', '🥈', '🥉'];
    return `<div class="table-wrap"><table class="standings">
      <thead><tr><th>#</th><th class="l">Đội</th><th title="Số lượt đã đấu">Tr</th><th title="Thắng">T</th><th title="Hoà">H</th><th title="Thua">B</th>
      <th title="Nội dung thắng – thua">ND</th><th title="Hiệu số nội dung">HS ND</th><th title="Hiệu số điểm">HS điểm</th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr class="${done && i < 3 ? 'adv' : ''}">
        <td>${done && i < 3 ? medal[i] : i + 1}</td><td class="l">${PB.teamCell(t, r.id, null, true)}</td>
        <td>${r.played}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.nw}–${r.nl}</td><td><b>${sign(r.nw - r.nl)}</b></td><td>${sign(r.pf - r.pa)}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="hint">${done ? '✔ Đã hoàn tất vòng tròn.' : 'Cập nhật theo từng nội dung đã có kết quả.'} Xếp hạng: hiệu số nội dung → đối đầu → hiệu số điểm (Điều 9).</p>`;
  }

  function renderTie(t, m, opts) {
    const s = PB.tieScore(m);
    const meta = [m.time, m.court ? 'Sân ' + m.court : ''].filter(Boolean).join(' · ');
    const cls = (side) => (s.complete && s.winner === side ? 'win' : '');
    const subs = m.subs.map((sub, i) => {
      const r = PB.gameResult(sub.games);
      const sc = r ? PB.formatGames(sub.games) : '–';
      return `<div class="sub ${r ? 'done' : ''}">
        <span class="sl">${PB.esc(sub.label)}</span>
        <span class="sp a ${r && r.winner === 'a' ? 'w' : ''}">${PB.esc(sub.pa || '')}</span>
        <span class="ss">${PB.esc(sc)}</span>
        <span class="sp b ${r && r.winner === 'b' ? 'w' : ''}">${PB.esc(sub.pb || '')}</span>
        ${opts.editable ? `<div class="sub-edit">
          <input data-mid="${m.id}" data-sub="${i}" data-f="pa" value="${PB.esc(sub.pa || '')}" placeholder="VĐV đội trái" aria-label="VĐV đội trái">
          <input class="in-score" data-mid="${m.id}" data-sub="${i}" data-f="games" value="${PB.esc(PB.formatGames(sub.games))}" placeholder="15-12" aria-label="Tỉ số ${PB.esc(sub.label)}">
          <input data-mid="${m.id}" data-sub="${i}" data-f="pb" value="${PB.esc(sub.pb || '')}" placeholder="VĐV đội phải" aria-label="VĐV đội phải">
        </div>` : ''}
      </div>`;
    }).join('');
    return `<div class="match tie ${s.complete ? 'done' : ''}" data-mid="${m.id}">
      <div class="m-head"><span>Vòng ${m.round}</span><span>${PB.esc(meta)}</span></div>
      <div class="tie-top">
        <div class="tt a ${cls('a')}">${PB.teamCell(t, m.a)}</div>
        <div class="tie-score">${s.done ? `${s.wa}<i>–</i>${s.wb}` : 'vs'}</div>
        <div class="tt b ${cls('b')}">${PB.teamCell(t, m.b)}</div>
      </div>
      <div class="subs">${subs}</div>
      ${opts.editable ? `<div class="m-edit"><input class="in-sm" data-mid="${m.id}" data-f="court" value="${PB.esc(m.court || '')}" placeholder="Sân" aria-label="Sân"><input class="in-sm" data-mid="${m.id}" data-f="time" value="${PB.esc(m.time || '')}" placeholder="Giờ" aria-label="Giờ"></div>` : ''}
    </div>`;
  }

  function scoreCells(m, res, side) {
    if (!m.games || !m.games.length) return '';
    return m.games.map((g) => {
      const mine = side === 'a' ? g[0] : g[1], other = side === 'a' ? g[1] : g[0];
      return `<span class="g ${mine > other ? 'gw' : ''}">${mine}</span>`;
    }).join('');
  }

  PB.renderMatch = function (t, m, opts = {}) {
    if (m.subs) return renderTie(t, m, opts);
    let A, B, isBye = false, title = '';
    if (m.stage === 'ko') {
      const inf = (opts.koInfo || PB.resolveKO(t))[m.id] || {};
      A = inf.A || {}; B = inf.B || {}; isBye = inf.isBye;
      title = `${PB.roundName(m.round, t.koRounds)} ${t.koRounds - m.round > 1 ? m.pos + 1 : ''}`;
    } else {
      A = { id: m.a }; B = { id: m.b };
      title = (t.format === 'round-robin' ? '' : `Bảng ${m.group} · `) + `Lượt ${m.round}`;
    }
    const res = A.id && B.id ? PB.result(m) : null;
    const ready = A.id && B.id && !isBye;
    const meta = [m.time, m.court ? 'Sân ' + m.court : ''].filter(Boolean).join(' · ');
    const editable = opts.editable && ready;
    return `<div class="match ${res ? 'done' : ''} ${isBye ? 'bye' : ''}" data-mid="${m.id}">
      <div class="m-head"><span>${PB.esc(title)}</span><span>${PB.esc(meta)}</span></div>
      <div class="m-team ${res && res.winner === 'a' ? 'win' : ''}"><div class="m-name">${PB.teamCell(t, A.id, A.label)}</div><div class="m-sc">${res ? scoreCells(m, res, 'a') : ''}</div></div>
      <div class="m-team ${res && res.winner === 'b' ? 'win' : ''}"><div class="m-name">${PB.teamCell(t, B.id, B.label)}</div><div class="m-sc">${res ? scoreCells(m, res, 'b') : ''}</div></div>
      ${editable ? `<div class="m-edit">
        <input class="in-score" data-mid="${m.id}" data-f="games" value="${PB.esc(PB.formatGames(m.games))}" placeholder="Tỉ số: 11-7, 11-9" aria-label="Tỉ số">
        <input class="in-sm" data-mid="${m.id}" data-f="court" value="${PB.esc(m.court || '')}" placeholder="Sân" aria-label="Sân">
        <input class="in-sm" data-mid="${m.id}" data-f="time" value="${PB.esc(m.time || '')}" placeholder="Giờ" aria-label="Giờ">
      </div>` : ''}
    </div>`;
  };

  PB.renderBracket = function (t, opts = {}) {
    const R = t.koRounds || 0;
    if (!R) return '<p class="empty">Giải này không có vòng loại trực tiếp.</p>';
    const koInfo = PB.resolveKO(t);
    const ko = PB.koMatches(t);
    const champ = PB.champion(t);
    let html = '<div class="bracket-scroll"><div class="bracket">';
    for (let r = 0; r < R; r++) {
      const ms = ko.filter((m) => m.round === r).sort((a, b) => a.pos - b.pos);
      html += `<div class="b-round"><h4>${PB.roundName(r, R)}</h4><div class="b-matches">${ms.map((m) => PB.renderMatch(t, m, { ...opts, koInfo })).join('')}</div></div>`;
    }
    html += `<div class="b-round b-champ"><h4>Vô địch</h4><div class="b-matches"><div class="champ-card">${champ ? `<div class="trophy" aria-hidden="true">🏆</div>${PB.teamCell(t, champ)}` : '<span class="tbd">Chưa xác định</span>'}</div></div></div>`;
    html += '</div></div>';
    return html;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PB;
  else root.PB = PB;
})(typeof window !== 'undefined' ? window : globalThis);

/* Phần dùng chung: menu, thông tin CLB, xem ảnh phóng to, thông báo */
(function () {
  const C = window.SITE_CONFIG || {};
  const fill = (sel, v) => document.querySelectorAll(sel).forEach((el) => (el.textContent = v || ''));
  fill('[data-site-name]', C.name || 'Pickleball');
  fill('[data-club]', C.club);
  fill('[data-since]', C.since);
  fill('[data-head]', C.head);
  fill('[data-venue]', C.venue);
  fill('[data-gala]', C.gala);
  const vl = document.getElementById('venue-link'); if (vl) vl.href = C.venueMap || '#';
  const gl = document.getElementById('gala-link'); if (gl) gl.href = C.galaMap || '#';
  fill('[data-year]', new Date().getFullYear());

  const btn = document.querySelector('.menu-btn');
  const links = document.querySelector('.nav-links');
  if (btn && links) {
    btn.addEventListener('click', () => links.classList.toggle('open'));
    links.addEventListener('click', (e) => { if (e.target.tagName === 'A') links.classList.remove('open'); });
  }

  // Bấm ảnh để phóng to
  const lb = document.getElementById('lightbox');
  if (lb) {
    document.addEventListener('click', (e) => {
      const img = e.target.closest('img.zoomable');
      if (img) { lb.querySelector('img').src = img.currentSrc || img.src; lb.querySelector('img').alt = img.alt; lb.classList.add('open'); }
    });
    lb.addEventListener('click', () => lb.classList.remove('open'));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lb.classList.remove('open'); });
  }

  window.toast = function (msg) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2200);
  };
})();

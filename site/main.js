{
  // Header border once the page scrolls
  const top = document.querySelector('.top');
  const onScroll = () => top.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu
  const btn = document.querySelector('.menu-btn');
  const menu = document.getElementById('mobile-menu');
  btn.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Hero: a fresh password types itself every few seconds, digits and symbols coloured like the app.
  const gen = document.getElementById('gen-text');
  const SETS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';
  const rand = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
  const fresh = () => Array.from({ length: 20 }, () => SETS[rand(SETS.length)]).join('');
  const paint = (s) => {
    gen.textContent = '';
    for (const c of s) {
      const span = document.createElement('span');
      if (/\d/.test(c)) span.className = 'd';
      else if (/[^A-Za-z0-9]/.test(c)) span.className = 's';
      span.textContent = c;
      gen.appendChild(span);
    }
  };
  paint(gen.textContent);
  if (!still) {
    setInterval(() => {
      const target = fresh();
      let i = 0;
      const t = setInterval(() => {
        i++;
        paint(target.slice(0, i) + Array.from({ length: 20 - i }, () => SETS[rand(SETS.length)]).join(''));
        if (i >= 20) clearInterval(t);
      }, 35);
    }, 4000);
  }

  // Hero: a pretend two-factor code with a real 30-second countdown ring.
  const code = document.getElementById('otp-code');
  const ring = document.querySelector('.otp-left');
  const C = 100.5;
  const tick = () => {
    const s = Math.floor(Date.now() / 1000);
    const left = 30 - (s % 30);
    ring.style.strokeDashoffset = String(C * (1 - left / 30));
    ring.style.stroke = left <= 5 ? '#ffb547' : '';
    if (left === 30 || !code.dataset.set) {
      const n = String(100000 + rand(900000));
      code.textContent = n.slice(0, 3) + ' ' + n.slice(3);
      code.dataset.set = '1';
    }
  };
  tick();
  setInterval(tick, 1000);
}

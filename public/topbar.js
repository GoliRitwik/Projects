// Topbar helper: mobile menu toggle and active link handling
const THEME_KEY = 'sms_theme';

document.addEventListener('DOMContentLoaded', () => {
  const topbars = document.querySelectorAll('.topbar');

  topbars.forEach(tb => {
    let hb = tb.querySelector('.hamburger');
    if (!hb) {
      hb = document.createElement('button');
      hb.className = 'hamburger';
      hb.setAttribute('aria-expanded', 'false');
      hb.setAttribute('aria-label', 'Toggle navigation');
      hb.innerHTML = '<span class="hamb-icon">☰</span>';
      tb.insertBefore(hb, tb.querySelector('.main-nav'));
    }

    hb.addEventListener('click', () => toggleMenu(tb, hb));
      hb.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
        toggleMenu(tb, hb);
      }
    });

    highlightActiveLink(tb);
  });

  initThemeToggle();
  updateLogo();
});

function toggleMenu(topbar, button) {
  const nav = topbar.querySelector('.main-nav');
  const expanded = button.getAttribute('aria-expanded') === 'true';
  button.setAttribute('aria-expanded', String(!expanded));
  nav.classList.toggle('open', !expanded);
  if (!expanded) {
    const firstLink = nav.querySelector('.nav-link');
    if (firstLink) firstLink.focus();
  }
}

function highlightActiveLink(topbar) {
  const path = window.location.pathname.replace(/\\/g, '/');
  topbar.querySelectorAll('.main-nav .nav-link').forEach(link => {
    try {
      const hrefPath = new URL(link.href).pathname;
      if (hrefPath === path || (hrefPath === '/' && path === '/')) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    } catch {
      /* ignore bad URLs */
    }
  });
}

  function initThemeToggle() {
    const btn = document.getElementById('darkModeToggle');
    if (!btn) return;

  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(savedTheme, btn);

  btn.addEventListener('click', () => {
    const nextTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
    applyTheme(nextTheme, btn);
  });
}

function applyTheme(theme, button) {
  document.body.classList.toggle('dark-mode', theme === 'dark');
  localStorage.setItem(THEME_KEY, theme);
  if (button) {
    button.textContent = theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
      }
      updateLogo();
}

function updateLogo() {
  const isDark = document.body.classList.contains('dark-mode');
  document.querySelectorAll('.brand .logo img').forEach(img => {
    if (!img.dataset.light) {
      img.dataset.light = img.getAttribute('data-light') || 'img/logo-light.svg';
    }
    if (!img.dataset.dark) {
      img.dataset.dark = img.getAttribute('data-dark') || 'img/logo.svg';
    }
    img.src = isDark ? img.dataset.dark : img.dataset.light;
  });
}

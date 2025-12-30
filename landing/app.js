/* CRSWRD Landing
   Tiny script: theme toggle + persistence. */

(function () {
  const STORAGE_KEY = 'crswrd_theme';
  const html = document.documentElement;
  const btn = document.getElementById('themeToggle');

  if (!btn) return;

  function preferredTheme() {
    // If user prefers light, start light. Otherwise default to dark.
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }

  function getTheme() {
    return localStorage.getItem(STORAGE_KEY) || preferredTheme();
  }

  function setTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);

    // Update button text
    btn.textContent = theme === 'light' ? 'Theme: Light' : 'Theme: Dark';
    btn.setAttribute(
      'aria-label',
      theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'
    );

    // Swap logo
    const logo = document.getElementById('landingLogo');
    if (logo) {
      logo.src =
        theme === 'light'
          ? './CRSWRD_Logo_Light_02.png'
          : './CRSWRD_Logo_Dark_02.png';
    }

    // Swap hero screenshot
    const shot = document.getElementById('heroShot');
    if (shot) {
      shot.src =
        theme === 'light'
          ? './images/crswrd-hero-light.png'
          : './images/crswrd-hero-dark.png';
    }
  }

  function toggleTheme() {
    const current = html.getAttribute('data-theme') || 'dark';
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  // Init
  setTheme(getTheme());
  btn.addEventListener('click', toggleTheme);
})();

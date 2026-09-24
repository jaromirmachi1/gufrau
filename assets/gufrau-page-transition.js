/**
 * Smooth same-origin page transitions for GUFRAU.
 * Native cross-document View Transitions when available;
 * otherwise fades/slides the main surface.
 */
(function () {
  const MOTION_OK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const OUT_MS = 280;
  const HAS_NATIVE_MPA_VT = 'onpageswap' in window;

  function getSurface() {
    return document.getElementById('MainContent') || document.body;
  }

  function markReady() {
    const root = document.documentElement;
    root.classList.remove('gufrau-page-pending');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        root.classList.add('gufrau-page-ready');
      });
    });
  }

  if (MOTION_OK) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', markReady, { once: true });
    } else {
      markReady();
    }
  }

  // Chromium MPA view transitions already cover leave/enter.
  if (!MOTION_OK || HAS_NATIVE_MPA_VT) return;

  document.addEventListener(
    'click',
    function (event) {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = event.target.closest('a[href]');
      if (!link) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;
      if (link.getAttribute('href')?.startsWith('#')) return;

      let url;
      try {
        url = new URL(link.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        if (url.hash) return;
      }

      event.preventDefault();

      const root = document.documentElement;
      if (root.classList.contains('gufrau-page-leaving')) return;
      root.classList.add('gufrau-page-leaving');

      const surface = getSurface();
      surface.style.transition = 'opacity ' + OUT_MS + 'ms ' + EASE + ', transform ' + OUT_MS + 'ms ' + EASE;
      surface.style.opacity = '0';
      surface.style.transform = 'translateY(-8px)';

      window.setTimeout(function () {
        window.location.href = url.href;
      }, OUT_MS);
    },
    true
  );

  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    document.documentElement.classList.remove('gufrau-page-leaving');
    const surface = getSurface();
    surface.style.opacity = '';
    surface.style.transform = '';
    surface.style.transition = '';
    markReady();
  });
})();

(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (reduce.matches || !fine.matches) return;

  const root = document.querySelector('[data-gufrau-cursor]');
  if (!root) return;

  const ring = root.querySelector('[data-gufrau-cursor-ring]');
  const mid = root.querySelector('[data-gufrau-cursor-mid]');
  const ghost = root.querySelector('[data-gufrau-cursor-ghost]');
  if (!ring || !mid || !ghost) return;

  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const ringPos = { x: mouse.x, y: mouse.y };
  const midPos = { x: mouse.x, y: mouse.y };
  const ghostPos = { x: mouse.x, y: mouse.y };

  let visible = false;
  let hovering = false;
  let raf = 0;

  const setTransform = (el, x, y, scale) => {
    el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`;
  };

  const onMove = (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    if (!visible) {
      visible = true;
      root.classList.add('is-visible');
      ringPos.x = midPos.x = ghostPos.x = mouse.x;
      ringPos.y = midPos.y = ghostPos.y = mouse.y;
    }
  };

  const onOver = (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    hovering = Boolean(target.closest('a, button, [role="button"], input, textarea, select, summary, label'));
    root.classList.toggle('is-hover', hovering);
  };

  const onLeave = () => {
    visible = false;
    root.classList.remove('is-visible', 'is-hover');
  };

  const tick = () => {
    // Tight chase → mid lag → ghost lag (the “something chasing you” feel)
    ringPos.x += (mouse.x - ringPos.x) * 0.28;
    ringPos.y += (mouse.y - ringPos.y) * 0.28;
    midPos.x += (mouse.x - midPos.x) * 0.14;
    midPos.y += (mouse.y - midPos.y) * 0.14;
    ghostPos.x += (mouse.x - ghostPos.x) * 0.07;
    ghostPos.y += (mouse.y - ghostPos.y) * 0.07;

    const scale = hovering ? 1.55 : 1;
    setTransform(ring, ringPos.x, ringPos.y, scale);
    setTransform(mid, midPos.x, midPos.y, hovering ? 0.55 : 1);
    setTransform(ghost, ghostPos.x, ghostPos.y, hovering ? 1.8 : 1);

    raf = window.requestAnimationFrame(tick);
  };

  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('mouseover', onOver, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  raf = window.requestAnimationFrame(tick);

  const stop = () => {
    window.cancelAnimationFrame(raf);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseover', onOver);
    document.documentElement.removeEventListener('mouseleave', onLeave);
    root.classList.remove('is-visible', 'is-hover');
  };

  reduce.addEventListener?.('change', (event) => {
    if (event.matches) stop();
  });
})();

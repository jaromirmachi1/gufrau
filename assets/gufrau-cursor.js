(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (reduce.matches || !fine.matches) return;

  const root = document.querySelector('[data-gufrau-cursor]');
  const ring = root && root.querySelector('[data-gufrau-cursor-ring]');
  if (!root || !ring) return;

  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const pos = { x: mouse.x, y: mouse.y };

  let visible = false;
  let hovering = false;
  let raf = 0;

  const onMove = (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    if (!visible) {
      visible = true;
      root.classList.add('is-visible');
      pos.x = mouse.x;
      pos.y = mouse.y;
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
    pos.x += (mouse.x - pos.x) * 0.18;
    pos.y += (mouse.y - pos.y) * 0.18;
    const scale = hovering ? 1.6 : 1;
    ring.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) scale(${scale})`;
    raf = window.requestAnimationFrame(tick);
  };

  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('mouseover', onOver, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  raf = window.requestAnimationFrame(tick);

  reduce.addEventListener?.('change', (event) => {
    if (!event.matches) return;
    window.cancelAnimationFrame(raf);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseover', onOver);
    document.documentElement.removeEventListener('mouseleave', onLeave);
    root.classList.remove('is-visible', 'is-hover');
  });
})();

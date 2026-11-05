(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (reduce.matches || !fine.matches) return;

  const root = document.querySelector('[data-gufrau-cursor]');
  const canvas = root && root.querySelector('[data-gufrau-cursor-canvas]');
  if (!root || !canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  // Tuned toward reactbits Glow Cursor: pouring light that cools as it fades
  const TRAIL = 36;
  const COLOR = { r: 0, g: 70, b: 255 };
  const SECONDARY = { r: 120, g: 160, b: 255 };
  const FOLLOW = 0.22;
  const CHAIN = 0.34;
  const IDLE_MS = 700;
  const FADE_MS = 900;

  const points = Array.from({ length: TRAIL }, () => ({ x: 0, y: 0 }));
  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let head = { x: mouse.x, y: mouse.y };
  let visible = false;
  let fade = 0;
  let lastMove = performance.now();
  let lastTs = performance.now();
  let raf = 0;
  let dpr = 1;

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const onMove = (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    lastMove = performance.now();
    if (!visible) {
      visible = true;
      root.classList.add('is-visible');
      head.x = mouse.x;
      head.y = mouse.y;
      for (let i = 0; i < TRAIL; i += 1) {
        points[i].x = mouse.x;
        points[i].y = mouse.y;
      }
    }
  };

  const onLeave = () => {
    lastMove = 0;
  };

  const draw = (now) => {
    const dt = clamp((now - lastTs) / 16.67, 0.5, 2.5);
    lastTs = now;

    const idle = now - lastMove;
    const targetFade = idle > IDLE_MS ? 0 : 1;
    const fadeStep = (16.67 * dt) / FADE_MS;
    fade += (targetFade - fade) * clamp(fadeStep * 2.2, 0.02, 0.2);

    if (fade < 0.01 && targetFade === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      root.classList.remove('is-visible');
      visible = false;
      raf = window.requestAnimationFrame(draw);
      return;
    }

    const headEase = 1 - Math.pow(1 - FOLLOW, dt);
    const chainEase = 1 - Math.pow(1 - CHAIN, dt);

    head.x += (mouse.x - head.x) * headEase;
    head.y += (mouse.y - head.y) * headEase;
    points[0].x = head.x;
    points[0].y = head.y;

    for (let i = 1; i < TRAIL; i += 1) {
      points[i].x += (points[i - 1].x - points[i].x) * chainEase;
      points[i].y += (points[i - 1].y - points[i].y) * chainEase;
    }

    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = TRAIL - 1; i >= 1; i -= 1) {
      const a = points[i];
      const b = points[i - 1];
      const progress = i / (TRAIL - 1);
      const life = Math.pow(1 - progress, 0.85) * fade;
      if (life < 0.02) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const radius = (10 + (1 - progress) * 22) * (0.65 + life * 0.55);

      const t = 1 - progress;
      const r = Math.round(SECONDARY.r + (COLOR.r - SECONDARY.r) * t);
      const g = Math.round(SECONDARY.g + (COLOR.g - SECONDARY.g) * t);
      const bl = Math.round(SECONDARY.b + (COLOR.b - SECONDARY.b) * t);

      const glow = ctx.createRadialGradient(mx, my, 0, mx, my, radius);
      glow.addColorStop(0, `rgba(${r}, ${g}, ${bl}, ${0.55 * life})`);
      glow.addColorStop(0.35, `rgba(${r}, ${g}, ${bl}, ${0.22 * life})`);
      glow.addColorStop(1, `rgba(${r}, ${g}, ${bl}, 0)`);

      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(mx, my, radius, 0, Math.PI * 2);
      ctx.fill();

      // Core beam along the segment
      ctx.strokeStyle = `rgba(${r}, ${g}, ${bl}, ${0.42 * life})`;
      ctx.lineWidth = Math.max(1.2, (1 - progress) * 5.5);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      void dist;
    }

    // Hotspot at the head
    const hot = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 18);
    hot.addColorStop(0, `rgba(255, 255, 255, ${0.55 * fade})`);
    hot.addColorStop(0.35, `rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, ${0.45 * fade})`);
    hot.addColorStop(1, `rgba(${COLOR.r}, ${COLOR.g}, ${COLOR.b}, 0)`);
    ctx.fillStyle = hot;
    ctx.beginPath();
    ctx.arc(head.x, head.y, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
    raf = window.requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('mousemove', onMove, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  raf = window.requestAnimationFrame(draw);

  reduce.addEventListener?.('change', (event) => {
    if (!event.matches) return;
    window.cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('mousemove', onMove);
    document.documentElement.removeEventListener('mouseleave', onLeave);
    root.classList.remove('is-visible');
  });
})();

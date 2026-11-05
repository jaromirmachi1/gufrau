(() => {
  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fineMq = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (reduceMq.matches || !fineMq.matches) return;

  const root = document.querySelector('[data-gufrau-cursor]');
  const canvas = root && root.querySelector('[data-gufrau-cursor-canvas]');
  if (!root || !canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  // reactbits Glow Cursor — Comet preset
  const SETTINGS = {
    color: { r: 95, g: 139, b: 255 }, // #5f8bff
    cooling: { r: 95, g: 139, b: 255 }, // #5f8bff
    intensity: 1.3,
    trailWidth: 3,
    linger: 1.4,
    glow: 1.2,
    hotspot: 0.8,
    followSpeed: 0.6,
    grain: 0,
    quality: 'high',
    clickBurst: true,
  };

  const TRAIL = SETTINGS.quality === 'high' ? 48 : 32;
  const IDLE_MS = SETTINGS.linger * 1200 + 900;
  const FADE_MS = 900;
  const FOLLOW = SETTINGS.followSpeed;
  const CHAIN = clamp(0.28 + SETTINGS.followSpeed * 0.35, 0.08, 0.92);

  const points = Array.from({ length: TRAIL }, () => ({ x: 0, y: 0 }));
  const bursts = [];
  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let head = { x: mouse.x, y: mouse.y };
  let visible = false;
  let fade = 0;
  let lastMove = performance.now();
  let lastTs = performance.now();
  let raf = 0;
  let dpr = 1;

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  const mix = (a, b, t) => Math.round(a + (b - a) * t);

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, SETTINGS.quality === 'high' ? 2 : 1.5);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const wake = (x, y) => {
    mouse.x = x;
    mouse.y = y;
    lastMove = performance.now();
    if (!visible) {
      visible = true;
      root.classList.add('is-visible');
      head.x = x;
      head.y = y;
      for (let i = 0; i < TRAIL; i += 1) {
        points[i].x = x;
        points[i].y = y;
      }
    }
  };

  const onMove = (event) => {
    wake(event.clientX, event.clientY);
  };

  const onLeave = () => {
    lastMove = 0;
  };

  const onClick = (event) => {
    if (!SETTINGS.clickBurst) return;
    wake(event.clientX, event.clientY);
    bursts.push({
      x: event.clientX,
      y: event.clientY,
      born: performance.now(),
      life: 420,
    });
  };

  const drawBurst = (burst, now) => {
    const t = (now - burst.born) / burst.life;
    if (t >= 1) return false;
    const life = 1 - t;
    const radius = 12 + t * 46 * SETTINGS.glow;
    const { r, g, b } = SETTINGS.color;
    const grad = ctx.createRadialGradient(burst.x, burst.y, 0, burst.x, burst.y, radius);
    grad.addColorStop(0, `rgba(255, 255, 255, ${0.55 * life * SETTINGS.hotspot})`);
    grad.addColorStop(0.25, `rgba(${r}, ${g}, ${b}, ${0.5 * life * SETTINGS.intensity})`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
    ctx.fill();
    return true;
  };

  const draw = (now) => {
    const dt = clamp((now - lastTs) / 16.67, 0.5, 2.5);
    lastTs = now;

    const idle = now - lastMove;
    const targetFade = idle > IDLE_MS ? 0 : 1;
    const fadeStep = (16.67 * dt) / FADE_MS;
    fade += (targetFade - fade) * clamp(fadeStep * 2.2, 0.02, 0.2);

    if (fade < 0.01 && targetFade === 0 && bursts.length === 0) {
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

    const widthBase = SETTINGS.trailWidth;
    const glowMul = SETTINGS.glow;
    const intensity = SETTINGS.intensity;

    for (let i = TRAIL - 1; i >= 1; i -= 1) {
      const a = points[i];
      const b = points[i - 1];
      const progress = i / (TRAIL - 1);
      // linger keeps the tail alive longer
      const life = Math.pow(1 - progress, 0.75 / SETTINGS.linger) * fade;
      if (life < 0.015) continue;

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const radius = (widthBase * 2.2 + (1 - progress) * widthBase * 7 * glowMul) * (0.7 + life * 0.5);

      const t = 1 - progress;
      const r = mix(SETTINGS.cooling.r, SETTINGS.color.r, t);
      const g = mix(SETTINGS.cooling.g, SETTINGS.color.g, t);
      const bl = mix(SETTINGS.cooling.b, SETTINGS.color.b, t);
      const alpha = life * intensity * 0.42;

      const glow = ctx.createRadialGradient(mx, my, 0, mx, my, radius);
      glow.addColorStop(0, `rgba(${r}, ${g}, ${bl}, ${alpha})`);
      glow.addColorStop(0.4, `rgba(${r}, ${g}, ${bl}, ${alpha * 0.35})`);
      glow.addColorStop(1, `rgba(${r}, ${g}, ${bl}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(mx, my, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(${r}, ${g}, ${bl}, ${life * intensity * 0.38})`;
      ctx.lineWidth = Math.max(widthBase * 0.45, (1 - progress) * widthBase * 1.8);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Hotspot
    const hotR = 10 + SETTINGS.hotspot * 14;
    const hot = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, hotR);
    hot.addColorStop(0, `rgba(255, 255, 255, ${0.65 * fade * SETTINGS.hotspot})`);
    hot.addColorStop(
      0.3,
      `rgba(${SETTINGS.color.r}, ${SETTINGS.color.g}, ${SETTINGS.color.b}, ${0.5 * fade * intensity})`
    );
    hot.addColorStop(1, `rgba(${SETTINGS.color.r}, ${SETTINGS.color.g}, ${SETTINGS.color.b}, 0)`);
    ctx.fillStyle = hot;
    ctx.beginPath();
    ctx.arc(head.x, head.y, hotR, 0, Math.PI * 2);
    ctx.fill();

    // Click bursts
    for (let i = bursts.length - 1; i >= 0; i -= 1) {
      if (!drawBurst(bursts[i], now)) bursts.splice(i, 1);
    }

    // Grain optional (Comet = 0)
    if (SETTINGS.grain > 0 && fade > 0.05) {
      ctx.globalAlpha = SETTINGS.grain * fade * 0.15;
      ctx.fillStyle = '#fff';
      for (let n = 0; n < 40; n += 1) {
        ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
      }
      ctx.globalAlpha = 1;
    }

    ctx.globalCompositeOperation = 'source-over';
    raf = window.requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('mousedown', onClick, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  raf = window.requestAnimationFrame(draw);

  reduceMq.addEventListener?.('change', (event) => {
    if (!event.matches) return;
    window.cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mousedown', onClick);
    document.documentElement.removeEventListener('mouseleave', onLeave);
    root.classList.remove('is-visible');
  });
})();

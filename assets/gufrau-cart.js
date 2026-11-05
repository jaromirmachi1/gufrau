(() => {
  const COUNT_SEL = '[data-gufrau-cart-count]';
  const LINK_SEL = '[data-gufrau-cart-link]';
  const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const setCount = (count) => {
    const n = Math.max(0, Number(count) || 0);
    document.querySelectorAll(COUNT_SEL).forEach((el) => {
      el.textContent = String(n);
      el.classList.toggle('is-empty', n === 0);
    });
    document.querySelectorAll(LINK_SEL).forEach((el) => {
      el.classList.toggle('has-items', n > 0);
      el.setAttribute('aria-label', n > 0 ? `Cart, ${n} items` : 'Cart');
    });
  };

  const pulseCart = () => {
    document.querySelectorAll(LINK_SEL).forEach((el) => {
      el.classList.remove('is-added');
      // Force reflow so the animation can replay
      void el.offsetWidth;
      el.classList.add('is-added');
      window.setTimeout(() => el.classList.remove('is-added'), 480);
    });
  };

  const flyToCart = (fromEl) => {
    if (reduceMotion() || !fromEl) {
      pulseCart();
      return Promise.resolve();
    }

    const cartLink = document.querySelector(LINK_SEL);
    if (!cartLink) {
      pulseCart();
      return Promise.resolve();
    }

    const from = fromEl.getBoundingClientRect();
    const to = cartLink.getBoundingClientRect();
    const startX = from.left + from.width / 2;
    const startY = from.top + from.height / 2;
    const endX = to.left + to.width / 2;
    const endY = to.top + to.height / 2;
    const midX = startX + (endX - startX) * 0.55;
    const midY = Math.min(startY, endY) - Math.max(60, Math.abs(startY - endY) * 0.35);

    const dot = document.createElement('span');
    dot.className = 'gufrau-cart-fly';
    dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);

    const animation = dot.animate(
      [
        {
          transform: `translate3d(${startX}px, ${startY}px, 0) translate(-50%, -50%) scale(0.92)`,
          opacity: 0.9,
        },
        {
          transform: `translate3d(${midX}px, ${midY}px, 0) translate(-50%, -50%) scale(1)`,
          opacity: 1,
          offset: 0.42,
        },
        {
          transform: `translate3d(${endX}px, ${endY}px, 0) translate(-50%, -50%) scale(0.4)`,
          opacity: 0.75,
        },
      ],
      {
        duration: 620,
        easing: EASE,
        fill: 'forwards',
      }
    );

    return animation.finished
      .catch(() => {})
      .then(() => {
        dot.remove();
        pulseCart();
      });
  };

  const refreshCount = async () => {
    try {
      const res = await fetch('/cart.js', { credentials: 'same-origin' });
      if (!res.ok) return;
      const cart = await res.json();
      setCount(cart.item_count);
    } catch (_) {
      /* ignore */
    }
  };

  const postJson = async (url, body) => {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Cart request failed');
    return res.json();
  };

  document.addEventListener('DOMContentLoaded', () => {
    refreshCount();

    document.querySelectorAll('.gufrau-shop__form, .gufrau-product__form').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const idInput = form.querySelector('[name="id"]');
        const qtyInput = form.querySelector('[name="quantity"]');
        const id = idInput && idInput.value;
        if (!id) return;

        const button = form.querySelector('[type="submit"]');
        if (button) {
          button.disabled = true;
          button.classList.add('is-adding');
        }

        try {
          await postJson('/cart/add.js', {
            items: [{ id: Number(id), quantity: Number((qtyInput && qtyInput.value) || 1) }],
          });

          const original = button ? button.textContent : '';
          if (button) button.textContent = 'added';

          await Promise.all([refreshCount(), flyToCart(button)]);

          window.setTimeout(() => {
            if (!button) return;
            button.textContent = original;
            button.classList.remove('is-adding');
            button.disabled = false;
          }, 700);
        } catch (_) {
          if (button) {
            button.classList.remove('is-adding');
            button.disabled = false;
          }
          form.submit();
        }
      });
    });

    const cartRoot = document.querySelector('[data-gufrau-cart-page]');
    if (!cartRoot) return;

    const money = (cents) => {
      try {
        return new Intl.NumberFormat(document.documentElement.lang || 'cs-CZ', {
          style: 'currency',
          currency: cartRoot.dataset.currency || 'CZK',
        }).format(cents / 100);
      } catch (_) {
        return `${(cents / 100).toFixed(2)} Kč`;
      }
    };

    const renderCart = (cart) => {
      setCount(cart.item_count);
      const totalEl = cartRoot.querySelector('[data-gufrau-cart-total]');
      if (totalEl) totalEl.textContent = money(cart.total_price);

      if (cart.item_count === 0) {
        window.location.reload();
        return;
      }

      cart.items.forEach((item) => {
        const row = cartRoot.querySelector(`[data-key="${item.key.replace(/"/g, '\\"')}"]`);
        if (!row) return;
        const qty = row.querySelector('[data-gufrau-qty-value]');
        const line = row.querySelector('[data-gufrau-line-total]');
        if (qty) qty.textContent = String(item.quantity);
        if (line) line.textContent = money(item.final_line_price);
      });
    };

    cartRoot.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-gufrau-qty], [data-gufrau-remove]');
      if (!btn) return;
      event.preventDefault();

      const row = btn.closest('[data-key]');
      if (!row) return;
      const key = row.getAttribute('data-key');
      let quantity = Number(row.querySelector('[data-gufrau-qty-value]')?.textContent || 1);

      if (btn.hasAttribute('data-gufrau-remove')) {
        quantity = 0;
      } else if (btn.getAttribute('data-gufrau-qty') === 'minus') {
        quantity = Math.max(0, quantity - 1);
      } else if (btn.getAttribute('data-gufrau-qty') === 'plus') {
        quantity += 1;
      }

      btn.disabled = true;
      try {
        const cart = await postJson('/cart/change.js', { id: key, quantity });
        if (quantity === 0) {
          row.remove();
          if (cart.item_count === 0) {
            window.location.reload();
            return;
          }
        }
        renderCart(cart);
      } catch (_) {
        window.location.reload();
      } finally {
        btn.disabled = false;
      }
    });
  });
})();

(() => {
  const COUNT_SEL = '[data-gufrau-cart-count]';
  const LINK_SEL = '[data-gufrau-cart-link]';

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

    // Shop / product forms: add via AJAX, stay on page, bump count
    document.querySelectorAll('.gufrau-shop__form, .gufrau-product__form').forEach((form) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const idInput = form.querySelector('[name="id"]');
        const qtyInput = form.querySelector('[name="quantity"]');
        const id = idInput && idInput.value;
        if (!id) return;

        const button = form.querySelector('[type="submit"]');
        if (button) button.disabled = true;

        try {
          const cart = await postJson('/cart/add.js', {
            items: [{ id: Number(id), quantity: Number((qtyInput && qtyInput.value) || 1) }],
          });
          // /cart/add.js returns the line item(s); fetch full cart for accurate count
          await refreshCount();
          if (button) {
            const original = button.textContent;
            button.textContent = 'added';
            window.setTimeout(() => {
              button.textContent = original;
              button.disabled = false;
            }, 900);
          }
          void cart;
        } catch (_) {
          form.submit();
        }
      });
    });

    // Cart page quantity / remove
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

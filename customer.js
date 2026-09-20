(function () {
  const params = new URLSearchParams(window.location.search);
  const tableId = params.get('table');

  const noTableScreen = document.getElementById('noTableScreen');
  const menuScreen = document.getElementById('menuScreen');
  const statusScreen = document.getElementById('statusScreen');

  if (!tableId) {
    noTableScreen.hidden = false;
    return;
  }

  document.getElementById('tableLabel').textContent = `Table ${tableId}`;

  const socket = io();
  const money = (n) => `$${Number(n).toFixed(2)}`;

  let menu = [];
  /** cart: { [menuItemId]: { qty, notes } } */
  let cart = {};
  let activeOrderId = null;

  // ---------- Fetch + render menu ----------
  async function loadMenu() {
    const res = await fetch('/api/menu');
    menu = await res.json();
    renderCategoryNav();
    renderMenuSections();
  }

  function categoriesInOrder() {
    const seen = [];
    for (const item of menu) {
      if (!seen.includes(item.category)) seen.push(item.category);
    }
    return seen;
  }

  function renderCategoryNav() {
    const nav = document.getElementById('categoryNav');
    nav.innerHTML = '';
    categoriesInOrder().forEach((cat, i) => {
      const pill = document.createElement('a');
      pill.href = `#cat-${slug(cat)}`;
      pill.className = 'category-nav__pill' + (i === 0 ? ' is-active' : '');
      pill.textContent = cat;
      pill.dataset.cat = cat;
      pill.addEventListener('click', () => {
        document.querySelectorAll('.category-nav__pill').forEach((p) => p.classList.remove('is-active'));
        pill.classList.add('is-active');
      });
      nav.appendChild(pill);
    });
  }

  function slug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  function renderMenuSections() {
    const container = document.getElementById('menuSections');
    container.innerHTML = '';
    categoriesInOrder().forEach((cat) => {
      const section = document.createElement('section');
      section.className = 'menu-section';
      section.id = `cat-${slug(cat)}`;

      const title = document.createElement('h2');
      title.className = 'menu-section__title';
      title.textContent = cat;
      section.appendChild(title);

      menu
        .filter((item) => item.category === cat)
        .forEach((item) => section.appendChild(renderDish(item)));

      container.appendChild(section);
    });
  }

  function renderDish(item) {
    const row = document.createElement('div');
    row.className = 'dish';

    const info = document.createElement('div');
    info.className = 'dish__info';
    info.innerHTML = `
      <p class="dish__name">${escapeHtml(item.name)}</p>
      <p class="dish__desc">${escapeHtml(item.description || '')}</p>
      ${
        item.available
          ? `<p class="dish__price">${money(item.price)}</p>`
          : `<p class="dish__unavailable">Currently unavailable</p>`
      }
    `;
    row.appendChild(info);

    if (item.available) {
      row.appendChild(renderStepper(item));
    }
    return row;
  }

  function renderStepper(item) {
    const wrap = document.createElement('div');
    wrap.className = 'stepper';
    wrap.dataset.itemId = item.id;

    function draw() {
      const qty = cart[item.id]?.qty || 0;
      wrap.innerHTML = '';
      if (qty === 0) {
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'stepper__add';
        addBtn.textContent = 'Add';
        addBtn.addEventListener('click', () => {
          setQty(item, 1);
          draw();
        });
        wrap.appendChild(addBtn);
      } else {
        const minus = document.createElement('button');
        minus.type = 'button';
        minus.className = 'stepper__btn';
        minus.textContent = '−';
        minus.addEventListener('click', () => {
          setQty(item, qty - 1);
          draw();
        });

        const qtyEl = document.createElement('span');
        qtyEl.className = 'stepper__qty';
        qtyEl.textContent = qty;

        const plus = document.createElement('button');
        plus.type = 'button';
        plus.className = 'stepper__btn';
        plus.textContent = '+';
        plus.addEventListener('click', () => {
          setQty(item, qty + 1);
          draw();
        });

        wrap.append(minus, qtyEl, plus);
      }
    }

    draw();
    return wrap;
  }

  function setQty(item, qty) {
    if (qty <= 0) {
      delete cart[item.id];
    } else {
      cart[item.id] = cart[item.id] || { notes: '' };
      cart[item.id].qty = qty;
    }
    updateCartBar();
  }

  function cartLines() {
    return Object.entries(cart).map(([id, entry]) => {
      const item = menu.find((m) => m.id === id);
      return { item, ...entry };
    });
  }

  function cartTotal() {
    return cartLines().reduce((sum, l) => sum + (l.item ? l.item.price * l.qty : 0), 0);
  }

  function updateCartBar() {
    const lines = cartLines();
    const count = lines.reduce((s, l) => s + l.qty, 0);
    const bar = document.getElementById('cartBar');
    bar.classList.toggle('is-visible', count > 0);
    document.getElementById('cartCount').textContent = `${count} item${count === 1 ? '' : 's'}`;
    document.getElementById('cartTotal').textContent = money(cartTotal());
    document.getElementById('submitOrderBtn').disabled = count === 0;
  }

  function renderDrawerItems() {
    const wrap = document.getElementById('drawerItems');
    const lines = cartLines();
    if (lines.length === 0) {
      wrap.innerHTML = `<p style="color:rgba(31,36,24,0.6);font-size:14px;">Your order is empty.</p>`;
    } else {
      wrap.innerHTML = '';
      lines.forEach((l) => {
        const row = document.createElement('div');
        row.className = 'cart-line';
        row.innerHTML = `
          <div>
            <div class="cart-line__name">${l.qty} × ${escapeHtml(l.item.name)}</div>
            <div class="cart-line__meta">${money(l.item.price)} each</div>
          </div>
          <div class="cart-line__meta">${money(l.item.price * l.qty)}</div>
        `;
        wrap.appendChild(row);
      });
    }
    document.getElementById('drawerTotal').textContent = money(cartTotal());
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Drawer open/close ----------
  const drawer = document.getElementById('cartDrawer');
  const backdrop = document.getElementById('drawerBackdrop');

  function openDrawer() {
    renderDrawerItems();
    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
  }
  function closeDrawer() {
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
  }

  document.getElementById('openCartBtn').addEventListener('click', openDrawer);
  document.getElementById('closeDrawerBtn').addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);

  // ---------- Submit order ----------
  document.getElementById('submitOrderBtn').addEventListener('click', async () => {
    const lines = cartLines();
    if (lines.length === 0) return;

    const btn = document.getElementById('submitOrderBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          note: document.getElementById('orderNote').value,
          items: lines.map((l) => ({ menuItemId: l.item.id, qty: l.qty, notes: l.notes || '' }))
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Could not place order');
      }

      const order = await res.json();
      activeOrderId = order.id;
      cart = {};
      updateCartBar();
      closeDrawer();
      showStatusScreen(order);
    } catch (e) {
      alert(e.message || 'Something went wrong placing your order. Please try again.');
      btn.disabled = false;
      btn.textContent = 'Send order to kitchen';
    }
  });

  // ---------- Status screen ----------
  function showStatusScreen(order) {
    menuScreen.hidden = true;
    statusScreen.hidden = false;
    document.getElementById('statusOrderId').textContent = `#${order.shortId}`;
    setStatusPill(order.status);
  }

  function setStatusPill(status) {
    const pill = document.getElementById('statusPill');
    pill.className = `status-pill status-pill--${status}`;
    const labels = {
      received: 'Received by kitchen',
      preparing: 'Being prepared',
      ready: 'Ready to serve',
      served: 'Served — enjoy!',
      cancelled: 'Cancelled'
    };
    pill.textContent = labels[status] || status;
  }

  socket.on('order:updated', (order) => {
    if (order.id === activeOrderId) setStatusPill(order.status);
  });

  document.getElementById('orderMoreBtn').addEventListener('click', () => {
    statusScreen.hidden = true;
    menuScreen.hidden = false;
  });

  document.getElementById('requestBillBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Bill requested ✓';
    try {
      await fetch(`/api/tables/${encodeURIComponent(tableId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'bill_requested' })
      });
    } catch (e2) {
      btn.disabled = false;
      btn.textContent = 'Request the bill';
    }
  });

  // ---------- Init ----------
  menuScreen.hidden = false;
  loadMenu();
})();

(function () {
  const socket = io();
  let menu = [];
  let tables = [];

  const money = (n) => `$${Number(n).toFixed(2)}`;

  // ---------- Tabs ----------
  document.querySelectorAll('.admin-nav__item').forEach((navItem) => {
    navItem.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.admin-nav__item').forEach((n) => n.classList.remove('is-active'));
      navItem.classList.add('is-active');
      document.querySelectorAll('.tab-panel').forEach((p) => (p.hidden = true));
      document.getElementById(`tab-${navItem.dataset.tab}`).hidden = false;
    });
  });

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('is-visible'), 2200);
  }

  // ---------- Menu ----------
  async function loadMenu() {
    const res = await fetch('/api/menu');
    menu = await res.json();
    renderMenuTable();
  }

  function renderMenuTable() {
    const body = document.getElementById('menuTableBody');
    body.innerHTML = '';
    menu.forEach((item) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(item.category)}</td>
        <td>
          <strong>${escapeHtml(item.name)}</strong><br/>
          <span style="color:var(--ink-dim);font-size:12px;">${escapeHtml(item.description || '')}</span>
        </td>
        <td>${money(item.price)}</td>
        <td><span class="pill pill--${item.available ? 'available' : 'unavailable'}">${item.available ? 'Available' : 'Hidden'}</span></td>
        <td class="inline-actions">
          <button class="btn btn-sage" data-action="toggle" data-id="${item.id}">${item.available ? 'Hide' : 'Show'}</button>
          <button class="btn btn-danger" data-action="delete" data-id="${item.id}">Delete</button>
        </td>
      `;
      body.appendChild(tr);
    });
  }

  document.getElementById('addMenuItemBtn').addEventListener('click', async () => {
    const category = document.getElementById('miCategory').value.trim();
    const name = document.getElementById('miName').value.trim();
    const description = document.getElementById('miDesc').value.trim();
    const price = document.getElementById('miPrice').value;

    if (!category || !name || price === '') {
      toast('Category, name and price are required');
      return;
    }

    const res = await fetch('/api/menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, name, description, price })
    });

    if (res.ok) {
      ['miCategory', 'miName', 'miDesc', 'miPrice'].forEach((id) => (document.getElementById(id).value = ''));
      toast('Menu item added');
    } else {
      toast('Could not add item');
    }
  });

  document.getElementById('menuTableBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const item = menu.find((m) => m.id === id);

    if (btn.dataset.action === 'toggle') {
      await fetch(`/api/menu/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: !item.available })
      });
    } else if (btn.dataset.action === 'delete') {
      if (!confirm(`Delete "${item.name}"?`)) return;
      await fetch(`/api/menu/${id}`, { method: 'DELETE' });
      toast('Item deleted');
    }
  });

  // ---------- Tables ----------
  async function loadTables() {
    const res = await fetch('/api/tables');
    tables = await res.json();
    renderTablesTable();
    renderQrGrid();
  }

  function renderTablesTable() {
    const body = document.getElementById('tablesTableBody');
    body.innerHTML = '';
    tables.forEach((t) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(t.label)}</strong></td>
        <td><span class="pill pill--${t.status}">${t.status.replace('_', ' ')}</span></td>
        <td class="inline-actions">
          <button class="btn btn-outline" data-action="clear" data-id="${t.id}">Mark free</button>
        </td>
      `;
      body.appendChild(tr);
    });
  }

  document.getElementById('addTableBtn').addEventListener('click', async () => {
    const id = document.getElementById('tblId').value.trim();
    const label = document.getElementById('tblLabel').value.trim();
    if (!id) {
      toast('Enter a table number or id');
      return;
    }
    const res = await fetch('/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, label })
    });
    if (res.ok) {
      document.getElementById('tblId').value = '';
      document.getElementById('tblLabel').value = '';
      toast('Table added');
    } else {
      const err = await res.json().catch(() => ({}));
      toast(err.error || 'Could not add table');
    }
  });

  document.getElementById('tablesTableBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'clear') {
      await fetch(`/api/tables/${btn.dataset.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'free' })
      });
    }
  });

  // ---------- QR codes ----------
  function renderQrGrid() {
    const grid = document.getElementById('qrGrid');
    grid.innerHTML = '';
    tables.forEach((t) => {
      const card = document.createElement('div');
      card.className = 'qr-card';
      card.innerHTML = `
        <img id="qrimg-${t.id}" alt="QR code for ${escapeHtml(t.label)}" />
        <div class="qr-card__label">${escapeHtml(t.label)}</div>
        <button class="btn btn-outline" data-action="gen" data-id="${t.id}" style="width:100%;">Generate</button>
      `;
      grid.appendChild(card);
    });
  }

  document.getElementById('genAllQrBtn').addEventListener('click', async () => {
    for (const t of tables) {
      await generateQr(t.id);
    }
    toast('QR codes generated');
  });

  document.getElementById('qrGrid').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action="gen"]');
    if (!btn) return;
    await generateQr(btn.dataset.id);
  });

  async function generateQr(tableId) {
    const img = document.getElementById(`qrimg-${tableId}`);
    // The base URL field is informational for printing; the server always
    // encodes the URL it was actually reached on, which is right for local
    // testing. Deploying to a real domain, regenerate with that domain live.
    const bust = Date.now();
    img.src = `/api/tables/${tableId}/qr?t=${bust}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Live sync ----------
  socket.on('menu:updated', (m) => {
    menu = m;
    renderMenuTable();
  });
  socket.on('tables:updated', (t) => {
    tables = t;
    renderTablesTable();
    renderQrGrid();
  });

  // ---------- Init ----------
  document.getElementById('baseUrl').value = window.location.origin;
  loadMenu();
  loadTables();
})();

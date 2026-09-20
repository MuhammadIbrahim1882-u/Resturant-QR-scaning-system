(function () {
  const socket = io();
  let orders = [];
  let tables = [];

  const NEXT_STATUS = { received: 'preparing', preparing: 'ready', ready: 'served' };
  const NEXT_LABEL = { received: 'Start preparing', preparing: 'Mark ready', ready: 'Mark served' };
  const LATE_AFTER_MS = { received: 3 * 60 * 1000, preparing: 12 * 60 * 1000, ready: 5 * 60 * 1000 };

  // ---------- Clock ----------
  function tickClock() {
    document.getElementById('clock').textContent = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
  setInterval(tickClock, 1000);
  tickClock();

  // ---------- Connection indicator ----------
  socket.on('connect', () => {
    document.getElementById('connDot').classList.remove('is-offline');
    document.getElementById('connLabel').textContent = 'Live';
  });
  socket.on('disconnect', () => {
    document.getElementById('connDot').classList.add('is-offline');
    document.getElementById('connLabel').textContent = 'Reconnecting...';
  });

  // ---------- Data loading ----------
  async function loadOrders() {
    const res = await fetch('/api/orders');
    orders = await res.json();
    render();
  }

  async function loadTables() {
    const res = await fetch('/api/tables');
    tables = await res.json();
    renderBillBanner();
  }

  // ---------- Rendering ----------
  function tableLabel(tableId) {
    const t = tables.find((tt) => tt.id === tableId);
    return t ? t.label : `Table ${tableId}`;
  }

  function elapsedLabel(createdAt) {
    const ms = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  function renderTicket(order) {
    const el = document.createElement('article');
    el.className = 'ticket';

    const ms = Date.now() - new Date(order.createdAt).getTime();
    const isLate = ms > (LATE_AFTER_MS[order.status] || Infinity);

    const itemsHtml = order.items
      .map(
        (li) => `
        <div class="ticket__item">
          <span class="ticket__item-qty">${li.qty}×</span>
          <span>
            ${escapeHtml(li.name)}
            ${li.notes ? `<span class="ticket__item-notes">${escapeHtml(li.notes)}</span>` : ''}
          </span>
        </div>`
      )
      .join('');

    const nextStatus = NEXT_STATUS[order.status];

    el.innerHTML = `
      <div class="ticket__head">
        <span class="ticket__table">${escapeHtml(tableLabel(order.tableId))}</span>
        <span class="ticket__id">#${order.shortId}</span>
      </div>
      <div class="ticket__timer ${isLate ? 'is-late' : ''}" data-created="${order.createdAt}">
        ⏱ ${elapsedLabel(order.createdAt)} ago
      </div>
      <div class="ticket__items">${itemsHtml}</div>
      ${order.note ? `<div class="ticket__note">📝 ${escapeHtml(order.note)}</div>` : ''}
      <div class="ticket__actions">
        ${
          nextStatus
            ? `<button class="ticket__btn ticket__btn--advance ${order.status}" data-action="advance" data-id="${order.id}" data-next="${nextStatus}">${NEXT_LABEL[order.status]}</button>`
            : ''
        }
        <button class="ticket__btn ticket__btn--ghost" data-action="cancel" data-id="${order.id}">Cancel</button>
      </div>
    `;
    return el;
  }

  function render() {
    const cols = {
      received: document.getElementById('colReceived'),
      preparing: document.getElementById('colPreparing'),
      ready: document.getElementById('colReady')
    };
    Object.values(cols).forEach((c) => (c.innerHTML = ''));

    const active = orders.filter((o) => ['received', 'preparing', 'ready'].includes(o.status));

    // oldest first, so the ticket that's waited longest is at the top
    active.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    ['received', 'preparing', 'ready'].forEach((status) => {
      const group = active.filter((o) => o.status === status);
      document.getElementById(
        `count${status[0].toUpperCase()}${status.slice(1)}`
      ).textContent = group.length;

      if (group.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'kds-empty';
        empty.textContent = 'No orders here right now.';
        cols[status].appendChild(empty);
      } else {
        group.forEach((o) => cols[status].appendChild(renderTicket(o)));
      }
    });
  }

  function renderBillBanner() {
    const requesting = tables.filter((t) => t.status === 'bill_requested');
    const banner = document.getElementById('billBanner');
    if (requesting.length === 0) {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    banner.textContent = `💳 Bill requested: ${requesting.map((t) => t.label).join(', ')}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Actions ----------
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const status = action === 'cancel' ? 'cancelled' : btn.dataset.next;

    btn.disabled = true;
    try {
      await fetch(`/api/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- Live updates ----------
  socket.on('order:new', (order) => {
    orders.push(order);
    render();
    // simple audible/visual nudge could go here
  });

  socket.on('order:updated', (updated) => {
    const idx = orders.findIndex((o) => o.id === updated.id);
    if (idx === -1) orders.push(updated);
    else orders[idx] = updated;
    render();
  });

  socket.on('tables:updated', (updatedTables) => {
    tables = updatedTables;
    renderBillBanner();
  });

  // Re-render every 5s just to refresh the elapsed timers even with no events
  setInterval(render, 5000);

  loadTables();
  loadOrders();
})();

const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('../utils/storage');

const VALID_STATUSES = ['received', 'preparing', 'ready', 'served', 'cancelled'];

function getOrders(req, res) {
  const { table, status } = req.query;
  let orders = readJSON('orders');
  if (table) orders = orders.filter((o) => o.tableId === table);
  if (status) orders = orders.filter((o) => o.status === status);
  // newest first
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(orders);
}

async function createOrder(req, res) {
  const { tableId, items, note } = req.body;

  if (!tableId) return res.status(400).json({ error: 'tableId is required' });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items must be a non-empty array' });
  }

  const menu = readJSON('menu');
  const lineItems = [];
  for (const line of items) {
    const menuItem = menu.find((m) => m.id === line.menuItemId);
    if (!menuItem) {
      return res.status(400).json({ error: `Unknown menu item: ${line.menuItemId}` });
    }
    if (!menuItem.available) {
      return res.status(400).json({ error: `${menuItem.name} is currently unavailable` });
    }
    const qty = Math.max(1, Number(line.qty) || 1);
    lineItems.push({
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      qty,
      notes: (line.notes || '').slice(0, 200)
    });
  }

  const total = lineItems.reduce((sum, li) => sum + li.price * li.qty, 0);

  const order = {
    id: uuidv4(),
    shortId: Math.random().toString(36).slice(2, 6).toUpperCase(),
    tableId: String(tableId),
    items: lineItems,
    note: (note || '').slice(0, 300),
    total: Math.round(total * 100) / 100,
    status: 'received',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const orders = readJSON('orders');
  orders.push(order);
  await writeJSON('orders', orders);

  // Mark the table as occupied so staff can see it at a glance.
  const tables = readJSON('tables');
  const tIdx = tables.findIndex((t) => t.id === order.tableId);
  if (tIdx !== -1 && tables[tIdx].status === 'free') {
    tables[tIdx].status = 'occupied';
    await writeJSON('tables', tables);
    req.app.get('io').emit('tables:updated', tables);
  }

  req.app.get('io').emit('order:new', order);
  res.status(201).json(order);
}

async function updateOrderStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const orders = readJSON('orders');
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });

  orders[idx].status = status;
  orders[idx].updatedAt = new Date().toISOString();
  await writeJSON('orders', orders);

  req.app.get('io').emit('order:updated', orders[idx]);
  res.json(orders[idx]);
}

module.exports = { getOrders, createOrder, updateOrderStatus };

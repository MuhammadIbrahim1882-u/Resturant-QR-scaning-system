const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('../utils/storage');

function getMenu(req, res) {
  const menu = readJSON('menu');
  res.json(menu);
}

async function addItem(req, res) {
  const { category, name, description, price } = req.body;
  if (!category || !name || price === undefined) {
    return res.status(400).json({ error: 'category, name and price are required' });
  }
  const menu = readJSON('menu');
  const item = {
    id: uuidv4(),
    category,
    name,
    description: description || '',
    price: Number(price),
    available: true
  };
  menu.push(item);
  await writeJSON('menu', menu);
  req.app.get('io').emit('menu:updated', menu);
  res.status(201).json(item);
}

async function updateItem(req, res) {
  const { id } = req.params;
  const menu = readJSON('menu');
  const idx = menu.findIndex((m) => m.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Item not found' });

  const { category, name, description, price, available } = req.body;
  menu[idx] = {
    ...menu[idx],
    ...(category !== undefined && { category }),
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(price !== undefined && { price: Number(price) }),
    ...(available !== undefined && { available: Boolean(available) })
  };
  await writeJSON('menu', menu);
  req.app.get('io').emit('menu:updated', menu);
  res.json(menu[idx]);
}

async function deleteItem(req, res) {
  const { id } = req.params;
  let menu = readJSON('menu');
  const exists = menu.some((m) => m.id === id);
  if (!exists) return res.status(404).json({ error: 'Item not found' });

  menu = menu.filter((m) => m.id !== id);
  await writeJSON('menu', menu);
  req.app.get('io').emit('menu:updated', menu);
  res.status(204).end();
}

module.exports = { getMenu, addItem, updateItem, deleteItem };

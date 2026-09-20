const { readJSON, writeJSON } = require('../utils/storage');
const { generateTableQR } = require('../utils/qrGenerator');

function getTables(req, res) {
  res.json(readJSON('tables'));
}

async function addTable(req, res) {
  const { id, label } = req.body;
  if (!id) return res.status(400).json({ error: 'id is required, e.g. "13"' });

  const tables = readJSON('tables');
  if (tables.some((t) => t.id === String(id))) {
    return res.status(409).json({ error: 'A table with that id already exists' });
  }
  const table = { id: String(id), label: label || `Table ${id}`, status: 'free' };
  tables.push(table);
  await writeJSON('tables', tables);
  req.app.get('io').emit('tables:updated', tables);
  res.status(201).json(table);
}

async function updateTableStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body; // free | occupied | bill_requested
  const tables = readJSON('tables');
  const idx = tables.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Table not found' });

  tables[idx].status = status;
  await writeJSON('tables', tables);
  req.app.get('io').emit('tables:updated', tables);
  res.json(tables[idx]);
}

async function getTableQR(req, res) {
  const { id } = req.params;
  const tables = readJSON('tables');
  const table = tables.find((t) => t.id === id);
  if (!table) return res.status(404).json({ error: 'Table not found' });

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const result = await generateTableQR(baseUrl, table);
  res.sendFile(result.file);
}

module.exports = { getTables, addTable, updateTableStatus, getTableQR };

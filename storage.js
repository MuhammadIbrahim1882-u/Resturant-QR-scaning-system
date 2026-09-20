const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

// Tiny in-process write queue so two quick writes to the same file
// can't interleave and corrupt the JSON.
const writeQueues = {};

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readJSON(name) {
  const file = filePath(name);
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf-8').trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

function writeJSON(name, data) {
  const file = filePath(name);
  const queueKey = name;
  const prev = writeQueues[queueKey] || Promise.resolve();

  const next = prev
    .catch(() => {}) // don't let a previous failure block future writes
    .then(
      () =>
        new Promise((resolve, reject) => {
          const tmpFile = `${file}.tmp`;
          fs.writeFile(tmpFile, JSON.stringify(data, null, 2), (err) => {
            if (err) return reject(err);
            fs.rename(tmpFile, file, (renameErr) => {
              if (renameErr) return reject(renameErr);
              resolve();
            });
          });
        })
    );

  writeQueues[queueKey] = next;
  return next;
}

module.exports = { readJSON, writeJSON };

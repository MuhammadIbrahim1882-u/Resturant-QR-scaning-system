const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const QR_DIR = path.join(__dirname, '..', '..', 'qr-codes');

/**
 * Generates a PNG QR code that links straight to the customer ordering
 * page for one specific table, e.g. http://<host>/customer.html?table=4
 */
async function generateTableQR(baseUrl, table) {
  if (!fs.existsSync(QR_DIR)) fs.mkdirSync(QR_DIR, { recursive: true });

  const targetUrl = `${baseUrl.replace(/\/$/, '')}/customer.html?table=${encodeURIComponent(
    table.id
  )}`;
  const outFile = path.join(QR_DIR, `table-${table.id}.png`);

  await QRCode.toFile(outFile, targetUrl, {
    width: 500,
    margin: 2,
    color: { dark: '#1c1f1a', light: '#ffffff' }
  });

  return { table: table.id, url: targetUrl, file: outFile };
}

module.exports = { generateTableQR };

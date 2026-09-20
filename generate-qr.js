/**
 * Generates one QR-code PNG per table into /qr-codes.
 * Each QR code links straight to that table's ordering page.
 *
 * Usage:
 *   node generate-qr.js
 *   node generate-qr.js https://my-restaurant-domain.com
 *
 * If no URL is given it defaults to http://localhost:3000, which is fine
 * for testing on one Wi-Fi network but should be replaced with your
 * real deployed URL (or your machine's LAN IP) before printing QR codes
 * for real tables.
 */
const fs = require('fs');
const path = require('path');
const { generateTableQR } = require('./src/utils/qrGenerator');

async function main() {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  const tables = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'tables.json'), 'utf-8'));

  console.log(`Generating QR codes pointing to ${baseUrl} ...\n`);

  for (const table of tables) {
    const result = await generateTableQR(baseUrl, table);
    console.log(`  ${table.label.padEnd(10)} -> ${result.file}`);
  }

  console.log(`\nDone. Find the PNGs in the qr-codes/ folder - print one per table.`);
}

main().catch((err) => {
  console.error('Failed to generate QR codes:', err);
  process.exit(1);
});

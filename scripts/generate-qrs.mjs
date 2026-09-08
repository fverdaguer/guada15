// Lee output/tokens.csv y genera un PNG de QR por invitade en output/qrs/
// Codifica la URL única de cada une. ECC nivel H (30%), mínimo 500x500px.

import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TOKENS_CSV = path.join(ROOT, 'output', 'tokens.csv');
const QRS_DIR = path.join(ROOT, 'output', 'qrs');

function slugify(str) {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const [headerLine, ...rows] = lines;
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());
  return rows.map((line) => {
    // parser simple que respeta campos entre comillas
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cols.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    const obj = {};
    headers.forEach((h, i) => (obj[h] = cols[i] ?? ''));
    return obj;
  });
}

async function main() {
  if (!existsSync(TOKENS_CSV)) {
    console.error(`No encontré ${TOKENS_CSV}. Corré primero: pnpm run tokens`);
    process.exit(1);
  }

  const content = await readFile(TOKENS_CSV, 'utf-8');
  const rows = parseCsv(content);

  await mkdir(QRS_DIR, { recursive: true });

  for (const row of rows) {
    if (!row.nombre || !row.token || !row.url) continue;
    const filename = `${slugify(row.nombre)}-${row.token}.png`;
    const filepath = path.join(QRS_DIR, filename);

    await QRCode.toFile(filepath, row.url, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    console.log(`✔ ${filename}`);
  }

  console.log(`\n${rows.length} QRs generados en ${QRS_DIR}`);
}

main();

// Lee input/guests.csv (nombre,telefono) y genera:
//   output/tokens.csv  -> nombre,telefono,token,url,wa_me_link
//   output/tokens.json -> { [token]: { nombre, telefono } }

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const INPUT_CSV = path.join(ROOT, 'input', 'guests.csv');
const OUTPUT_DIR = path.join(ROOT, 'output');
const OUTPUT_CSV = path.join(OUTPUT_DIR, 'tokens.csv');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'tokens.json');

// charset sin caracteres ambiguos: sin 0, O, 1, l, I
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

// palabras a evitar si aparecen como substring del token (case-insensitive)
const BLOCKLIST = ['puto', 'puta', 'sexo', 'anal', 'caca', 'culo', 'pito', 'trolo', 'fuck', 'shit'];

function randomToken(length = 4) {
  let token = '';
  for (let i = 0; i < length; i++) {
    token += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return token;
}

function isBadToken(token) {
  const lower = token.toLowerCase();
  if (BLOCKLIST.some((bad) => lower.includes(bad))) return true;
  // evita 4 caracteres repetidos o secuencias obvias tipo abcd/1234 (ya sin 0/1 pero por las dudas)
  if (/^(.)\1{3}$/.test(token)) return true;
  return false;
}

function generateUniqueToken(used) {
  let token;
  let attempts = 0;
  do {
    token = randomToken();
    attempts++;
    if (attempts > 1000) throw new Error('no se pudo generar un token único, revisá el charset/blocklist');
  } while (used.has(token) || isBadToken(token));
  used.add(token);
  return token;
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const [headerLine, ...rows] = lines;
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());
  return rows.map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    const obj = {};
    headers.forEach((h, i) => (obj[h] = cols[i] ?? ''));
    return obj;
  });
}

function csvEscape(value) {
  const v = String(value ?? '');
  if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

function buildWaMessage(nombre, url) {
  return `hola ${nombre}!! 🎉 guada cumple 15 y te invita a su cumple

📅 sábado 21 de noviembre
📍 quinta la mala, hurlingham
⏰ 11 a 19hs

confirmá si venís acá 👉 ${url}

(el link es solo para vos, no lo compartas)`;
}

async function main() {
  if (!existsSync(INPUT_CSV)) {
    console.error(`No encontré ${INPUT_CSV}. Creá el archivo con columnas nombre,telefono.`);
    process.exit(1);
  }

  const envPath = path.join(__dirname, '.env');
  let siteUrl = 'http://localhost:8788';
  if (existsSync(envPath)) {
    const content = await readFile(envPath, 'utf-8');
    const match = content.match(/^SITE_URL=(.*)$/m);
    if (match) siteUrl = match[1].trim().replace(/\/$/, '');
  }

  const content = await readFile(INPUT_CSV, 'utf-8');
  const guests = parseCsv(content);

  if (guests.length === 0) {
    console.error('input/guests.csv no tiene invitades.');
    process.exit(1);
  }

  const used = new Set();
  const tokensJson = {};
  const csvRows = ['nombre,telefono,token,url,wa_me_link'];

  for (const guest of guests) {
    const nombre = guest.nombre?.trim();
    const telefono = guest.telefono?.trim() || '';
    if (!nombre) continue;

    const token = generateUniqueToken(used);
    const url = `${siteUrl}/i/${token}`;
    const mensaje = buildWaMessage(nombre, url);
    const waMeLink = telefono
      ? `https://wa.me/${telefono.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`
      : '';

    csvRows.push([csvEscape(nombre), csvEscape(telefono), csvEscape(token), csvEscape(url), csvEscape(waMeLink)].join(','));
    tokensJson[token] = { nombre, ...(telefono ? { telefono } : {}) };
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_CSV, csvRows.join('\n') + '\n', 'utf-8');
  await writeFile(OUTPUT_JSON, JSON.stringify(tokensJson, null, 2), 'utf-8');

  console.log(`✔ ${guests.length} invitades procesades`);
  console.log(`✔ ${OUTPUT_CSV}`);
  console.log(`✔ ${OUTPUT_JSON}`);
}

main();

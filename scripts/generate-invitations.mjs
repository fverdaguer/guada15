// Arma output/invitations.pdf: una página A6 (configurable) por invitade,
// con el template PNG de fondo + el QR + nombre + token en texto (fallback).
//
// Requiere:
//   - assets/invitation-template.png  (lo diseña el usuario en Canva)
//   - invitation-config.json          (coordenadas, en la raíz del proyecto)
//   - output/tokens.csv + output/qrs/*.png (correr antes: pnpm run tokens && pnpm run qrs)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TOKENS_CSV = path.join(ROOT, 'output', 'tokens.csv');
const QRS_DIR = path.join(ROOT, 'output', 'qrs');
const TEMPLATE_PNG = path.join(ROOT, 'assets', 'invitation-template.png');
const CONFIG_JSON = path.join(ROOT, 'invitation-config.json');
const OUTPUT_PDF = path.join(ROOT, 'output', 'invitations.pdf');

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
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') { cols.push(cur); cur = ''; }
      else cur += ch;
    }
    cols.push(cur);
    const obj = {};
    headers.forEach((h, i) => (obj[h] = cols[i] ?? ''));
    return obj;
  });
}

function hexToRgb01(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

async function main() {
  for (const [label, file] of [
    ['tokens.csv', TOKENS_CSV],
    ['invitation-template.png', TEMPLATE_PNG],
    ['invitation-config.json', CONFIG_JSON],
  ]) {
    if (!existsSync(file)) {
      console.error(`Falta ${label} en ${file}`);
      process.exit(1);
    }
  }

  const config = JSON.parse(await readFile(CONFIG_JSON, 'utf-8'));
  const rows = parseCsv(await readFile(TOKENS_CSV, 'utf-8'));
  const templateBytes = await readFile(TEMPLATE_PNG);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const templateImage = await pdfDoc.embedPng(templateBytes);

  const pageSize = PageSizes[config.pageSize] ?? PageSizes.A6;
  const [pageWidth, pageHeight] = pageSize;

  let count = 0;

  for (const row of rows) {
    if (!row.nombre || !row.token) continue;

    const qrFilename = `${slugify(row.nombre)}-${row.token}.png`;
    const qrPath = path.join(QRS_DIR, qrFilename);
    if (!existsSync(qrPath)) {
      console.warn(`⚠ no encontré el QR de ${row.nombre} (${qrPath}), corré: pnpm run qrs`);
      continue;
    }

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // fondo: template estirado a toda la página
    page.drawImage(templateImage, { x: 0, y: 0, width: pageWidth, height: pageHeight });

    // QR
    const qrBytes = await readFile(qrPath);
    const qrImage = await pdfDoc.embedPng(qrBytes);
    page.drawImage(qrImage, {
      x: config.qr.x,
      y: config.qr.y,
      width: config.qr.width,
      height: config.qr.height,
    });

    // nombre
    page.drawText(row.nombre, {
      x: config.nombre.x,
      y: config.nombre.y,
      size: config.nombre.fontSize,
      font,
      color: hexToRgb01(config.nombre.color ?? '#0F0F0F'),
    });

    // token en texto (fallback si el QR no escanea)
    page.drawText(row.token, {
      x: config.token.x,
      y: config.token.y,
      size: config.token.fontSize,
      font,
      color: hexToRgb01(config.token.color ?? '#0F0F0F'),
    });

    count++;
  }

  await mkdir(path.dirname(OUTPUT_PDF), { recursive: true });
  const pdfBytes = await pdfDoc.save();
  await writeFile(OUTPUT_PDF, pdfBytes);

  console.log(`✔ ${count} invitaciones generadas en ${OUTPUT_PDF}`);
}

main();

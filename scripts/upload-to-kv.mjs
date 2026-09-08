// Lee output/tokens.json y sube cada invitade a Cloudflare KV con:
//   wrangler kv bulk put
//
// Uso:
//   pnpm run upload-kv            → sube al namespace de PRODUCCIÓN (wrangler.toml)
//   pnpm run upload-kv -- --local → sube a la KV local emulada por `wrangler pages dev`

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TOKENS_JSON = path.join(ROOT, 'output', 'tokens.json');
const BULK_JSON = path.join(ROOT, 'output', 'kv-bulk-upload.json');

const isLocal = process.argv.includes('--local');

async function main() {
  if (!existsSync(TOKENS_JSON)) {
    console.error(`No encontré ${TOKENS_JSON}. Corré primero: pnpm run tokens`);
    process.exit(1);
  }

  const tokens = JSON.parse(await readFile(TOKENS_JSON, 'utf-8'));

  const bulkEntries = Object.entries(tokens).map(([token, data]) => ({
    key: `invitee:${token}`,
    value: JSON.stringify({
      nombre: data.nombre,
      ...(data.telefono ? { telefono: data.telefono } : {}),
      status: 'pending',
      respuesta: null,
    }),
  }));

  await mkdir(path.dirname(BULK_JSON), { recursive: true });
  await writeFile(BULK_JSON, JSON.stringify(bulkEntries, null, 2), 'utf-8');
  console.log(`✔ ${BULK_JSON} generado (${bulkEntries.length} invitades)`);

  // con shell:true (necesario en Windows) los args se unen en un solo
  // string de shell, así que las rutas con espacios necesitan comillas.
  const args = [
    'wrangler',
    'kv',
    'bulk',
    'put',
    `"${BULK_JSON}"`,
    '--binding',
    'RSVP_KV',
    ...(isLocal ? ['--local'] : ['--remote']),
  ];

  console.log(`\n> npx ${args.join(' ')}\n`);

  try {
    // shell: true es necesario en Windows, donde `npx` es en realidad `npx.cmd`
    // y execFileSync no lo resuelve sin pasar por una shell.
    execFileSync('npx', args, { stdio: 'inherit', cwd: ROOT, shell: true });
    console.log(`\n✔ ${bulkEntries.length} invitades subides a la KV ${isLocal ? 'local' : 'de producción'}`);
  } catch (err) {
    console.error(`\n✗ falló wrangler kv bulk put: ${err.message}`);
    console.error('Revisá que wrangler.toml tenga el namespace ID correcto.');
    process.exit(1);
  }
}

main();

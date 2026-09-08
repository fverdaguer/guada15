# guada15 🎉

Web de RSVP para el cumple de 15 de Guada — sábado 21 de noviembre de 2026, Quinta "La Mala", Hurlingham.

Sin login, sin registro: cada invitade recibe un link único (`/i/{token}`) y confirma una sola vez. Todo corre en **Cloudflare Pages + Pages Functions + KV**, gratis.

## Stack

- **Frontend:** HTML + CSS + JS vanilla, sin build step (`public/`).
- **Backend:** Cloudflare Pages Functions, TypeScript (`functions/api/`).
- **Storage:** Cloudflare KV (namespace `RSVP_KV`), un key por invitade.
- **Scripts locales:** Node 20+, ESM (`scripts/`), gestionados con `pnpm`.

---

## 1. Setup local

Necesitás Node 20+ y `pnpm` (`npm i -g pnpm` si no lo tenés).

```bash
pnpm install
```

Esto instala las dependencias de `scripts/` (`qrcode`, `pdf-lib`) y `wrangler` en la raíz.

### Correr el sitio local con `wrangler dev`

Copiá el archivo de variables locales (define el `ADMIN_KEY` de desarrollo):

```bash
cp .dev.vars.example .dev.vars
```

Y levantá el servidor:

```bash
pnpm run dev
```

Levanta Pages + Functions en `http://localhost:8788` con una KV local emulada en disco (no hace falta cuenta de Cloudflare ni internet). Los datos persisten en `.wrangler/state` entre reinicios.

Para probar el flujo:

1. Generá tokens de prueba (ver sección 2) — ya viene un `input/guests.csv` de ejemplo.
2. Subí `output/tokens.json` a la KV local:
   ```bash
   pnpm run upload-kv -- --local
   ```
3. Abrí `http://localhost:8788/i/{token}` con un token de `output/tokens.csv`.
4. Confirmá asistencia, refrescá la página y verificá que ya no te deja volver a responder.
5. Probá `http://localhost:8788/api/admin?key=dev` (la key local es la que pusiste en `.dev.vars`, `dev` por defecto).

---

## 2. Cómo agregar invitades

1. Editá `input/guests.csv` con columnas `nombre,telefono` (una fila por invitade; `telefono` es opcional pero necesario para el link de WhatsApp). Ejemplo:

   ```csv
   nombre,telefono
   Sofía Martínez,5491122334455
   Tomás Ibarra,
   ```

   El teléfono va en formato internacional sin `+` ni espacios (`54` + código de área sin `0` + número sin `15`).

2. Corré todo el pipeline de una:

   ```bash
   pnpm run generate
   ```

   Esto ejecuta en orden:
   - `generate-tokens.mjs` → `output/tokens.csv`, `output/tokens.json`
   - `generate-qrs.mjs` → `output/qrs/{nombre-slug}-{token}.png`
   - `generate-invitations.mjs` → `output/invitations.pdf`

   O corré cada paso suelto: `pnpm run tokens`, `pnpm run qrs`, `pnpm run invitations`.

3. Verificá `output/tokens.csv` — tiene `nombre,telefono,token,url,wa_me_link`. Los `url` van a `https://TU-DOMINIO/i/{token}` (por defecto usa un placeholder, ver más abajo cómo configurarlo).

4. Para las invitaciones impresas necesitás antes:
   - `assets/invitation-template.png` — el diseño que hizo Guada en Canva (vos lo colocás ahí, no lo genera el script).
   - `invitation-config.json` en la raíz — coordenadas de dónde pegar el QR, el nombre y el token. Ya viene un archivo de ejemplo, ajustalo en píxeles/puntos según tu template.

### Configurar el dominio para los links

Antes de generar los tokens "de verdad" (no los de prueba), seteá la URL base en `scripts/.env` (copiá `scripts/.env.example`):

```
SITE_URL=https://guada15.pages.dev
```

Si no lo seteás, usa `http://localhost:8788` como placeholder.

---

## 3. Cómo deployar

### 3.1 Crear el namespace de KV

```bash
npx wrangler kv namespace create RSVP_KV
```

Copiá el `id` que te devuelve y pegalo en `wrangler.toml`, reemplazando `REPLACE_WITH_KV_NAMESPACE_ID`:

```toml
[[kv_namespaces]]
binding = "RSVP_KV"
id = "el-id-que-te-dio-el-comando"
```

### 3.2 Deploy

Opción A — dashboard: conectá el repo de GitHub en Cloudflare Pages, seteá:
- Build command: (vacío, no hay build)
- Build output directory: `public`

Cloudflare detecta `functions/` automáticamente y lo linkea al mismo dominio.

Opción B — CLI (esto también crea el proyecto "guada15" en Cloudflare si no existe):

```bash
npx wrangler pages deploy public --project-name guada15
```

Con cualquiera de las dos, `/api/*` queda servido por las Pages Functions en el mismo dominio que el sitio — no hace falta configurar rutas de Worker aparte.

### 3.3 Setear el secret del admin

Con el proyecto ya creado (después del primer deploy):

```bash
npx wrangler pages secret put ADMIN_KEY --project-name guada15
```

Te va a pedir el valor — usá un string random largo (por ejemplo `openssl rand -hex 24`). Guardalo, es la key para descargar el CSV de confirmados. No hace falta re-deployar para que tome efecto.

### 3.4 Cargar los tokens reales a la KV de producción

Una vez que corriste `pnpm run generate` con el CSV real de invitades:

```bash
pnpm run upload-kv
```

Esto lee `output/tokens.json` y hace un `wrangler kv bulk put` contra la KV de producción declarada en `wrangler.toml`. Confirmá que el namespace ID en `wrangler.toml` sea el de producción, no el local, antes de correrlo.

### 3.5 Playlist de Spotify

Reemplazá el `src` del iframe con id `spotify-embed` en `public/index.html` (buscá el comentario `SPOTIFY_PLAYLIST_URL`) por el link real de embed de la playlist de Guada. Spotify te da ese link desde "Compartir → Insertar" en la playlist.

---

## 4. Cómo descargar la lista de confirmados

```
https://tu-dominio.pages.dev/api/admin?key=TU_ADMIN_KEY
```

Descarga un CSV con: `nombre, token, estado, timestamp, restricciones, mensaje`.

---

## 5. Troubleshooting

**Un QR no escanea:** los QR se generan con corrección de errores nivel H (30%) a 500x500px mínimo, deberían andar bien impresos incluso arrugados. Si aun así falla, el token en texto plano queda como fallback debajo del QR en la invitación — se puede tipear a mano en `/i/{token}`.

**Alguien perdió su link:** buscá su nombre en `output/tokens.csv`, mandale de nuevo el `wa_me_link` de esa fila (o armá el link a mano: `https://tu-dominio.pages.dev/i/{token}`).

**Alguien confirmó mal y quiere cambiar la respuesta:** el sistema es de una sola respuesta por diseño (evita que alguien "pierda" su token si otra persona lo usa antes). Para reabrirlo, borrá manualmente el status desde el dashboard de KV (Storage & Databases → KV → `RSVP_KV` → buscá `invitee:{token}` → editá el JSON y poné `"status": "pending", "respuesta": null`).

**Quiero invalidar un token filtrado:** borrá la key `invitee:{token}` de la KV, o cambiale el `status` a algo distinto de `pending` a mano.

**El endpoint admin da 401:** revisá que la key en la URL matchee exactamente el secret `ADMIN_KEY` (sensible a mayúsculas/espacios).

**`wrangler dev` no encuentra la KV / los tokens que subiste no aparecen:** `wrangler pages dev` toma el binding `RSVP_KV` directamente de `wrangler.toml` (no hace falta pasarle `--kv` a mano — de hecho, pasarlo genera una KV local *distinta* de la que usa `upload-to-kv.mjs`, así que los tokens subidos no se van a encontrar). Si mezclaste ambas formas alguna vez, borrá el estado local (`rm -rf .wrangler/state`) y volvé a correr `pnpm run upload-kv -- --local`.

---

## Estructura del proyecto

```
guada15/
├── README.md
├── wrangler.toml            # config de Pages: KV binding
├── invitation-config.json   # coordenadas para armar el PDF de invitaciones
├── public/                  # sirve Cloudflare Pages
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   └── assets/
├── functions/
│   ├── i/[token].ts         # sirve la SPA en /i/:token (el token se lee client-side)
│   └── api/
│       ├── rsvp/[token].ts  # GET/POST /api/rsvp/:token
│       └── admin.ts         # GET /api/admin
├── scripts/
│   ├── generate-tokens.mjs
│   ├── generate-qrs.mjs
│   ├── generate-invitations.mjs
│   ├── upload-to-kv.mjs
│   └── package.json
├── input/
│   └── guests.csv
└── output/                  # generado, no se commitea
    ├── tokens.csv
    ├── tokens.json
    ├── qrs/
    └── invitations.pdf
```

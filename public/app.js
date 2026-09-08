// guada15 — app.js (vanilla, sin build step)

const DIRECCION = 'Juan Díaz de Solís 2765, B1686 Hurlingham, Provincia de Buenos Aires';

const root = document.getElementById('rsvp-root');
const mapsLink = document.getElementById('maps-link');
mapsLink.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(DIRECCION);

function getTokenFromUrl() {
  const match = window.location.pathname.match(/\/i\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const token = getTokenFromUrl();

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

const RESTRICCIONES_LABELS = {
  vegetariane: 'soy vegetarianx',
  vegane: 'soy veganx',
  celiaque: 'soy celiacx',
  otra: 'otra',
};

function restriccionesTexto(arr) {
  if (!arr || arr.length === 0) return 'ninguna';
  return arr.map((r) => RESTRICCIONES_LABELS[r] || r).join(', ');
}

// ===== estados =====

function renderNoToken() {
  root.innerHTML = `
    <div class="invalid-box">
      <h3>necesitás tu link personal ✉️</h3>
      <p>este link es de invitación general. buscá el que te mandamos por whatsapp — tiene tu token único al final (algo como <code>/i/ab3d</code>).</p>
    </div>
  `;
}

function renderLoading() {
  root.innerHTML = `<p class="muted">cargando tu invitación...</p>`;
}

function renderInvalid() {
  root.innerHTML = `
    <div class="invalid-box">
      <h3>che, este link no es válido 😵</h3>
      <p>revisá que copiaste el link completo, o escribinos por whatsapp para que te lo reenviemos.</p>
    </div>
  `;
}

function renderAlreadyResponded(data) {
  const r = data.respuesta;
  const vino = data.status === 'confirmed';
  root.innerHTML = `
    <div class="already-box">
      <h3>${vino ? 'ya confirmaste 🎉' : 'ya nos avisaste que no podés 😢'}</h3>
      <p>${vino ? `nos vemos el 21/11, ${escapeHtml(data.nombre)}!` : 'te vamos a extrañar, ojalá puedas la próxima'}</p>
      ${
        r
          ? `<div class="respuesta-detalle">
              ${vino ? `<p><strong>restricciones:</strong> ${escapeHtml(restriccionesTexto(r.restricciones))}${r.restriccionDetalle ? ' — ' + escapeHtml(r.restriccionDetalle) : ''}</p>` : ''}
              ${r.mensaje ? `<p><strong>tu mensaje:</strong> "${escapeHtml(r.mensaje)}"</p>` : ''}
            </div>`
          : ''
      }
    </div>
  `;
  if (vino) showEgg('egg-thanks'); else showEgg('egg-sad');
}

function renderForm(data) {
  root.innerHTML = `
    <p class="muted">hola ${escapeHtml(data.nombre)}! completá esto:</p>
    <form id="rsvp-form" novalidate>
      <div class="field-block">
        <span class="field-label">¿venís?</span>
        <div class="rsvp-yesno">
          <button type="button" class="btn btn-si" id="btn-asiste-si" aria-pressed="false">confirmo!!! 🎉</button>
          <button type="button" class="btn btn-no" id="btn-asiste-no" aria-pressed="false">no puedo :(</button>
        </div>
      </div>

      <div id="wrap-restricciones" style="display:none">
        <fieldset>
          <legend>comés de todo? (marcá lo que aplique)</legend>
          <label class="check-row"><input type="checkbox" name="restriccion" value="vegetariane"> soy vegetarianx</label>
          <label class="check-row"><input type="checkbox" name="restriccion" value="vegane"> soy veganx</label>
          <label class="check-row"><input type="checkbox" name="restriccion" value="celiaque"> soy celiacx</label>
          <label class="check-row"><input type="checkbox" name="restriccion" value="otra" id="chk-otra"> otra</label>
          <textarea id="restriccion-detalle" placeholder="contanos" rows="2" style="display:none" maxlength="200"></textarea>
        </fieldset>
      </div>

      <div class="field-block">
        <label class="field-label" for="mensaje">dejale algo lindo a guada (opcional)</label>
        <textarea id="mensaje" rows="3" maxlength="500" placeholder="escribí acá..."></textarea>
        <div class="char-counter"><span id="mensaje-count">0</span>/500</div>
      </div>

      <button type="submit" class="btn btn-submit" id="btn-submit" disabled>elegí una opción arriba</button>
      <p class="error-msg" id="form-error" style="display:none"></p>
    </form>
  `;

  const btnSi = document.getElementById('btn-asiste-si');
  const btnNo = document.getElementById('btn-asiste-no');
  const wrapRestricciones = document.getElementById('wrap-restricciones');
  const chkOtra = document.getElementById('chk-otra');
  const detalle = document.getElementById('restriccion-detalle');
  const mensaje = document.getElementById('mensaje');
  const mensajeCount = document.getElementById('mensaje-count');
  const btnSubmit = document.getElementById('btn-submit');
  const form = document.getElementById('rsvp-form');
  const errorMsg = document.getElementById('form-error');

  let asiste = null;

  function updateAsiste(value) {
    asiste = value;
    btnSi.setAttribute('aria-pressed', String(value === true));
    btnNo.setAttribute('aria-pressed', String(value === false));
    wrapRestricciones.style.display = value === true ? 'block' : 'none';
    btnSubmit.disabled = false;
    btnSubmit.textContent = value === true ? 'confirmo!!!' : 'avisar que no puedo';
  }

  btnSi.addEventListener('click', () => updateAsiste(true));
  btnNo.addEventListener('click', () => updateAsiste(false));

  chkOtra.addEventListener('change', () => {
    detalle.style.display = chkOtra.checked ? 'block' : 'none';
    if (chkOtra.checked) detalle.focus();
  });

  mensaje.addEventListener('input', () => {
    mensajeCount.textContent = String(mensaje.value.length);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.style.display = 'none';

    if (asiste === null) return;

    if (chkOtra.checked && !detalle.value.trim()) {
      errorMsg.textContent = 'contanos un toque más sobre tu restricción';
      errorMsg.style.display = 'block';
      detalle.focus();
      return;
    }

    const restricciones = asiste
      ? Array.from(form.querySelectorAll('input[name="restriccion"]:checked')).map((c) => c.value)
      : [];

    const body = {
      asiste,
      restricciones,
      restriccionDetalle: chkOtra.checked ? detalle.value.trim() : undefined,
      mensaje: mensaje.value.trim() || undefined,
    };

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner"></span> enviando...';

    try {
      const res = await fetch(`/api/rsvp/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 200) {
        renderSuccess(asiste, data.nombre);
        if (asiste) {
          fireConfetti();
          showEgg('egg-thanks');
        } else {
          showEgg('egg-sad');
        }
      } else if (res.status === 409) {
        renderInvalid();
      } else {
        const err = await res.json().catch(() => ({}));
        errorMsg.textContent = err.error === 'token_not_found' ? 'este link ya no es válido' : 'algo salió mal, probá de nuevo';
        errorMsg.style.display = 'block';
        btnSubmit.disabled = false;
        btnSubmit.textContent = asiste ? 'confirmo!!!' : 'avisar que no puedo';
      }
    } catch (err) {
      errorMsg.textContent = 'no pudimos conectar, revisá tu internet y probá de nuevo';
      errorMsg.style.display = 'block';
      btnSubmit.disabled = false;
      btnSubmit.textContent = asiste ? 'confirmo!!!' : 'avisar que no puedo';
    }
  });
}

function renderSuccess(asiste, nombre) {
  root.innerHTML = `
    <div class="success-box">
      <h3>${asiste ? 'quedaste anotade! 🎉' : 'listo, gracias por avisar'}</h3>
      <p>${asiste ? `nos vemos el 21/11, ${escapeHtml(nombre)}!` : 'te vamos a extrañar'}</p>
    </div>
  `;
}

function showEgg(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('show');
  // forzar reflow para poder re-disparar la animación
  void el.offsetWidth;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

// ===== confetti collage (canvas-free, DOM + rAF) =====

function fireConfetti() {
  const layer = document.getElementById('confetti-layer');
  const shapes = ['⭐', '✨', '💗', '🎀', '🩰', '🧡'];
  const colors = ['#FF6B4A', '#E93B7A', '#4AC5D4', '#1E3AC4', '#0F0F0F'];
  const count = 40;
  const pieces = [];

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    const useEmoji = Math.random() > 0.4;
    if (useEmoji) {
      el.textContent = shapes[Math.floor(Math.random() * shapes.length)];
      el.style.fontSize = 14 + Math.random() * 18 + 'px';
    } else {
      el.style.width = 8 + Math.random() * 10 + 'px';
      el.style.height = el.style.width;
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    }
    el.style.left = cx + 'px';
    el.style.top = cy + 'px';
    layer.appendChild(el);

    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    pieces.push({
      el,
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      rot: Math.random() * 360,
      vrot: (Math.random() - 0.5) * 20,
      life: 0,
      maxLife: 70 + Math.random() * 40,
    });
  }

  const gravity = 0.28;

  function tick() {
    let alive = false;
    for (const p of pieces) {
      if (p.life >= p.maxLife) {
        if (p.el.parentNode) p.el.remove();
        continue;
      }
      alive = true;
      p.vy += gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      p.life++;
      const opacity = p.life > p.maxLife - 20 ? Math.max(0, (p.maxLife - p.life) / 20) : 1;
      p.el.style.transform = `translate(${p.x - cx}px, ${p.y - cy}px) rotate(${p.rot}deg)`;
      p.el.style.opacity = String(opacity);
    }
    if (alive) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ===== bootstrap =====

async function init() {
  if (!token) {
    renderNoToken();
    return;
  }

  renderLoading();

  try {
    const res = await fetch(`/api/rsvp/${encodeURIComponent(token)}`);
    if (res.status === 404) {
      renderInvalid();
      return;
    }
    if (!res.ok) {
      renderInvalid();
      return;
    }
    const data = await res.json();
    if (data.status === 'pending') {
      renderForm(data);
    } else {
      renderAlreadyResponded(data);
    }
  } catch (err) {
    root.innerHTML = `
      <div class="invalid-box">
        <h3>no pudimos cargar tu invitación 😵</h3>
        <p>revisá tu conexión y refrescá la página.</p>
      </div>
    `;
  }
}

init();

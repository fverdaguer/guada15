// guada15 — enviar.js (vanilla, sin build step)

const STORAGE_KEY = 'guada15_admin_key';
const SENT_STORAGE_KEY = 'guada15_sent_tokens';

const STATUS_LABEL = {
  confirmed: 'confirmado',
  declined: 'no viene',
  pending: 'pendiente',
};

const gate = document.getElementById('gate');
const gateForm = document.getElementById('gate-form');
const gateInput = document.getElementById('gate-input');
const gateError = document.getElementById('gate-error');

const dashboard = document.getElementById('dashboard');
const btnRefresh = document.getElementById('btn-refresh');
const btnLogout = document.getElementById('btn-logout');

const filtersEl = document.getElementById('filters');
const searchEl = document.getElementById('search');
const hideSentEl = document.getElementById('hide-sent');
const tableBody = document.getElementById('table-body');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');

let invitees = [];
let currentFilter = 'all';
let currentSearch = '';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function getKey() {
  return localStorage.getItem(STORAGE_KEY);
}
function setKey(key) {
  localStorage.setItem(STORAGE_KEY, key);
}
function clearKey() {
  localStorage.removeItem(STORAGE_KEY);
}

function getSentSet() {
  try {
    const raw = localStorage.getItem(SENT_STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}
function saveSentSet(set) {
  localStorage.setItem(SENT_STORAGE_KEY, JSON.stringify([...set]));
}
function markSent(token, sent) {
  const set = getSentSet();
  if (sent) set.add(token);
  else set.delete(token);
  saveSentSet(set);
}

function showGate(errorMsg) {
  gate.hidden = false;
  dashboard.hidden = true;
  if (errorMsg) {
    gateError.textContent = errorMsg;
    gateError.hidden = false;
  } else {
    gateError.hidden = true;
  }
  gateInput.focus();
}

function showDashboard() {
  gate.hidden = true;
  dashboard.hidden = false;
}

async function fetchData() {
  const key = getKey();
  if (!key) {
    showGate();
    return;
  }

  loadingState.hidden = false;
  loadingState.textContent = 'cargando...';

  try {
    const res = await fetch(`/api/admin.json?key=${encodeURIComponent(key)}`);

    if (res.status === 401) {
      clearKey();
      showGate('esa key no es correcta.');
      return;
    }
    if (!res.ok) throw new Error('bad status ' + res.status);

    const data = await res.json();
    invitees = data.invitees || [];
    showDashboard();
    render();
  } catch (err) {
    loadingState.hidden = false;
    loadingState.textContent = 'no pude cargar los datos. probá "refrescar".';
  }
}

// los emojis van como escapes \u{...} (no pegados literalmente) para que el
// mensaje no dependa de que este archivo se guarde/transporte en UTF-8 limpio
// en todos los pasos (git en Windows, editores, etc. pueden corromperlos).
const EMOJI_PARTY = '\u{1F389}'; // 🎉
const EMOJI_CALENDAR = '\u{1F4C5}'; // 📅
const EMOJI_PIN = '\u{1F4CD}'; // 📍
const EMOJI_CLOCK = '\u{23F0}'; // ⏰
const EMOJI_POINT_RIGHT = '\u{1F449}'; // 👉

function buildWaMessage(nombre, url) {
  return `hola ${nombre}!! ${EMOJI_PARTY} guada cumple 15 y te invita a su cumple

${EMOJI_CALENDAR} sábado 21 de noviembre
${EMOJI_PIN} quinta la mala, hurlingham
${EMOJI_CLOCK} 11 a 19hs

confirmá si venís acá ${EMOJI_POINT_RIGHT} ${url}

(el link es solo para vos, no lo compartas)`;
}

function buildInviteUrl(token) {
  return `${location.origin}/i/${token}`;
}

function buildWaLink(inv) {
  const url = buildInviteUrl(inv.token);
  const mensaje = buildWaMessage(inv.nombre, url);
  const phoneDigits = (inv.telefono || '').replace(/\D/g, '');
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(mensaje)}`;
}

function render() {
  const search = currentSearch.trim().toLowerCase();
  const sentSet = getSentSet();
  const hideSent = hideSentEl.checked;

  const filtered = invitees.filter((inv) => {
    if (currentFilter !== 'all' && inv.status !== currentFilter) return false;
    if (search && !inv.nombre.toLowerCase().includes(search)) return false;
    if (hideSent && sentSet.has(inv.token)) return false;
    return true;
  });

  loadingState.hidden = true;

  if (filtered.length === 0) {
    tableBody.innerHTML = '';
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  tableBody.innerHTML = filtered
    .map((inv) => {
      const isSent = sentSet.has(inv.token);
      const url = buildInviteUrl(inv.token);

      let accionHtml;
      if (inv.telefono) {
        accionHtml = `<a class="btn btn-whatsapp" href="${buildWaLink(inv)}" target="_blank" rel="noopener" data-token="${escapeHtml(inv.token)}" data-action="wa">enviar WhatsApp</a>`;
      } else {
        accionHtml = `
          <span class="no-phone">sin teléfono</span>
          <button type="button" class="btn btn-copy" data-url="${escapeHtml(url)}" data-action="copy">copiar link</button>
        `;
      }

      return `
        <tr class="${isSent ? 'row-sent' : ''}">
          <td class="cell-nombre" data-label="nombre">${escapeHtml(inv.nombre)}</td>
          <td data-label="estado"><span class="badge badge-${inv.status}">${STATUS_LABEL[inv.status]}</span></td>
          <td class="cell-telefono" data-label="teléfono">${inv.telefono ? escapeHtml(inv.telefono) : '<span class="muted">—</span>'}</td>
          <td data-label="enviar">${accionHtml}</td>
          <td data-label="enviado">
            <label class="sent-checkbox-wrap">
              <input type="checkbox" data-token="${escapeHtml(inv.token)}" data-action="mark-sent" ${isSent ? 'checked' : ''}>
              marcar
            </label>
          </td>
        </tr>
      `;
    })
    .join('');
}

// ===== eventos =====

gateForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const key = gateInput.value.trim();
  if (!key) return;
  setKey(key);
  fetchData();
});

btnRefresh.addEventListener('click', fetchData);

btnLogout.addEventListener('click', () => {
  clearKey();
  invitees = [];
  gateInput.value = '';
  showGate();
});

filtersEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  currentFilter = btn.dataset.filter;
  filtersEl.querySelectorAll('.filter-btn').forEach((b) => b.classList.toggle('active', b === btn));
  render();
});

searchEl.addEventListener('input', () => {
  currentSearch = searchEl.value;
  render();
});

hideSentEl.addEventListener('change', render);

tableBody.addEventListener('click', async (e) => {
  const waBtn = e.target.closest('[data-action="wa"]');
  if (waBtn) {
    markSent(waBtn.dataset.token, true);
    // re-render en el próximo tick para no interferir con la apertura del link
    setTimeout(render, 150);
    return;
  }

  const copyBtn = e.target.closest('[data-action="copy"]');
  if (copyBtn) {
    try {
      await navigator.clipboard.writeText(copyBtn.dataset.url);
      copyBtn.textContent = 'copiado!';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = 'copiar link';
        copyBtn.classList.remove('copied');
      }, 1500);
    } catch {
      copyBtn.textContent = 'no se pudo copiar';
    }
    return;
  }
});

tableBody.addEventListener('change', (e) => {
  const checkbox = e.target.closest('[data-action="mark-sent"]');
  if (!checkbox) return;
  markSent(checkbox.dataset.token, checkbox.checked);
  render();
});

// ===== bootstrap =====

if (getKey()) {
  fetchData();
} else {
  showGate();
}

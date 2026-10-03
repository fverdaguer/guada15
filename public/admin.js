// guada15 — admin.js (vanilla, sin build step)

const STORAGE_KEY = 'guada15_admin_key';
const REFRESH_MS = 30000;

const RESTRICCIONES_LABELS = {
  vegetariane: 'vegetarianx',
  vegane: 'veganx',
  celiaque: 'celiaque',
  otra: 'otra',
};

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
const updatedAtEl = document.getElementById('updated-at');
const btnRefresh = document.getElementById('btn-refresh');
const btnExport = document.getElementById('btn-export');
const btnLogout = document.getElementById('btn-logout');

const filtersEl = document.getElementById('filters');
const searchEl = document.getElementById('search');
const tableBody = document.getElementById('table-body');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');

let invitees = [];
let currentFilter = 'all';
let currentSearch = '';
let refreshTimer = null;

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

function showGate(errorMsg) {
  gate.hidden = false;
  dashboard.hidden = true;
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
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

async function fetchData(silent) {
  const key = getKey();
  if (!key) {
    showGate();
    return;
  }

  if (!silent) {
    loadingState.hidden = false;
    loadingState.textContent = 'cargando...';
  }

  try {
    const res = await fetch(`/api/admin.json?key=${encodeURIComponent(key)}`);

    if (res.status === 401) {
      clearKey();
      showGate('esa key no es correcta.');
      return;
    }

    if (!res.ok) {
      throw new Error('bad status ' + res.status);
    }

    const data = await res.json();
    invitees = data.invitees || [];
    showDashboard();
    render();
    updatedAtEl.textContent = 'actualizado ' + new Date().toLocaleTimeString('es-AR');
    btnExport.href = `/api/admin?key=${encodeURIComponent(key)}`;
  } catch (err) {
    if (!silent) {
      loadingState.hidden = false;
      loadingState.textContent = 'no pude cargar los datos. probá "refrescar".';
    }
  }
}

function computeStats() {
  const stats = { confirmed: 0, declined: 0, pending: 0 };
  for (const inv of invitees) {
    stats[inv.status] = (stats[inv.status] || 0) + 1;
  }
  return stats;
}

function restriccionesTexto(inv) {
  if (!inv.restricciones || inv.restricciones.length === 0) return [];
  return inv.restricciones.map((r) => {
    if (r === 'otra' && inv.restriccionDetalle) {
      return `otra: ${inv.restriccionDetalle}`;
    }
    return RESTRICCIONES_LABELS[r] || r;
  });
}

function formatTimestamp(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
}

function render() {
  const stats = computeStats();
  document.getElementById('stat-confirmed').textContent = stats.confirmed || 0;
  document.getElementById('stat-declined').textContent = stats.declined || 0;
  document.getElementById('stat-pending').textContent = stats.pending || 0;
  document.getElementById('stat-total').textContent = invitees.length;

  const search = currentSearch.trim().toLowerCase();
  const filtered = invitees.filter((inv) => {
    if (currentFilter !== 'all' && inv.status !== currentFilter) return false;
    if (search && !inv.nombre.toLowerCase().includes(search)) return false;
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
      const chips = restriccionesTexto(inv);
      const chipsHtml = chips.length
        ? chips.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join('')
        : '<span class="muted">ninguna</span>';
      const mensaje = inv.mensaje ? escapeHtml(inv.mensaje) : '<span class="muted">—</span>';
      const mensajeTitle = inv.mensaje ? ` title="${escapeHtml(inv.mensaje)}"` : '';

      return `
        <tr>
          <td class="cell-nombre" data-label="nombre">${escapeHtml(inv.nombre)}</td>
          <td data-label="estado"><span class="badge badge-${inv.status}">${STATUS_LABEL[inv.status]}</span></td>
          <td data-label="respondió">${inv.timestamp ? escapeHtml(formatTimestamp(inv.timestamp)) : '<span class="muted">—</span>'}</td>
          <td data-label="restricciones"><div class="chips">${chipsHtml}</div></td>
          <td class="cell-mensaje" data-label="mensaje"${mensajeTitle}>${mensaje}</td>
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
  fetchData().then(() => {
    if (!dashboard.hidden) startAutoRefresh();
  });
});

btnRefresh.addEventListener('click', () => {
  fetchData();
  startAutoRefresh();
});

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

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (!document.hidden) fetchData(true);
  }, REFRESH_MS);
}

// ===== bootstrap =====

if (getKey()) {
  fetchData().then(() => {
    if (!dashboard.hidden) startAutoRefresh();
  });
} else {
  showGate();
}

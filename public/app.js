/* LIENZO — multi-agent canvas client */
'use strict';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const NAMES = ['Marshall', 'Chase', 'Ada', 'Grace', 'Linus', 'Margaret', 'Alan', 'Dennis', 'Barbara', 'Ken'];
const agents = new Map(); // id -> agent record
let agentSeq = 0;
let nameSeq = 0;
let zTop = 10;
let spawnCascade = 0;

const view = { x: 0, y: 0, scale: 1 };

const viewport = document.getElementById('viewport');
const canvas = document.getElementById('canvas');
const emptyHint = document.getElementById('empty-hint');
const siriGlow = document.getElementById('siri-glow');

// Transparent terminal background lets the glass card show through
const TERM_THEMES = {
  midnight: { background: '#00000000', foreground: '#f2f4f8', cursor: '#0a84ff', selectionBackground: '#0a84ff44' },
  carbon: { background: '#00000000', foreground: '#ececec', cursor: '#ff9f0a', selectionBackground: '#ff9f0a33' },
  paper: { background: '#00000000', foreground: '#1d1d1f', cursor: '#007aff', selectionBackground: '#007aff2e' },
  synthwave: { background: '#00000000', foreground: '#f4ecff', cursor: '#ff375f', selectionBackground: '#ff375f3d' },
};

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

let ws;
let wsReady = false;
const pendingSends = [];

function wsSend(msg) {
  if (wsReady) ws.send(JSON.stringify(msg));
  else pendingSends.push(msg);
}

function connect() {
  const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${wsProto}://${location.host}/ws`);
  ws.onopen = () => {
    wsReady = true;
    while (pendingSends.length) ws.send(JSON.stringify(pendingSends.shift()));
  };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    const agent = agents.get(msg.id);
    if (!agent) return;
    if (msg.type === 'data') {
      agent.term.write(msg.data);
      markWorking(agent);
    } else if (msg.type === 'spawned') {
      agent.cwdEl.textContent = shortenPath(msg.cwd);
      agent.cwdEl.title = msg.cwd;
    } else if (msg.type === 'exit') {
      agent.term.write(`\r\n\x1b[31m✖ proceso terminado (código ${msg.code})\x1b[0m\r\n`);
      setStatus(agent, 'dead');
    } else if (msg.type === 'error') {
      agent.term.write(`\r\n\x1b[31m${msg.message}\x1b[0m\r\n`);
      setStatus(agent, 'dead');
      toast(msg.message);
    }
  };
  ws.onclose = () => {
    wsReady = false;
    for (const agent of agents.values()) {
      if (agent.status !== 'dead') {
        agent.term.write('\r\n\x1b[31m✖ conexión perdida con el servidor\x1b[0m\r\n');
        setStatus(agent, 'dead');
      }
    }
    setTimeout(connect, 1500);
  };
}
connect();

// ---------------------------------------------------------------------------
// Canvas pan & zoom
// ---------------------------------------------------------------------------

function applyView() {
  canvas.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  document.getElementById('zoom-reset').textContent = `${Math.round(view.scale * 100)}%`;
}
applyView();

// Smooth, animated view change (for buttons / reset)
let glideTimer = null;
function glideView(x, y, scale) {
  canvas.classList.add('gliding');
  view.x = x; view.y = y; view.scale = scale;
  applyView();
  clearTimeout(glideTimer);
  glideTimer = setTimeout(() => canvas.classList.remove('gliding'), 480);
}

viewport.addEventListener('pointerdown', (e) => {
  if (e.target !== viewport && e.target !== canvas) return;
  viewport.classList.add('panning');
  const start = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
  const move = (ev) => {
    view.x = start.vx + (ev.clientX - start.x);
    view.y = start.vy + (ev.clientY - start.y);
    applyView();
  };
  const up = () => {
    viewport.classList.remove('panning');
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
});

viewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  canvas.classList.remove('gliding');
  if (e.ctrlKey || e.metaKey) {
    const rect = viewport.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.01));
  } else {
    view.x -= e.deltaX;
    view.y -= e.deltaY;
    applyView();
  }
}, { passive: false });

function zoomAt(px, py, factor, glide = false) {
  const newScale = Math.min(2.5, Math.max(0.25, view.scale * factor));
  const k = newScale / view.scale;
  const nx = px - k * (px - view.x);
  const ny = py - k * (py - view.y);
  if (glide) {
    glideView(nx, ny, newScale);
  } else {
    view.x = nx; view.y = ny; view.scale = newScale;
    applyView();
  }
}

document.getElementById('zoom-in').onclick = () =>
  zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1.25, true);
document.getElementById('zoom-out').onclick = () =>
  zoomAt(viewport.clientWidth / 2, viewport.clientHeight / 2, 1 / 1.25, true);
document.getElementById('zoom-reset').onclick = () => glideView(0, 0, 1);

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

let agentDefs = [];
let agentHome = ''; // ruta del home del servidor, para acortar cwd a «~»

// Acorta la ruta del directorio de trabajo mostrando «~» por el home, en
// cualquier sistema (macOS, Windows con «\», Linux).
function shortenPath(p) {
  if (!p) return '';
  if (agentHome && (p === agentHome || p.startsWith(agentHome + '/') || p.startsWith(agentHome + '\\'))) {
    return '~' + p.slice(agentHome.length);
  }
  return p;
}

async function loadAgentDefs() {
  let data;
  try {
    const res = await fetch('/api/agents');
    data = await res.json();
  } catch {
    // Servidor arrancando o reiniciándose: sin reintento la barra quedaría vacía.
    setTimeout(loadAgentDefs, 1500);
    return;
  }
  agentDefs = data.agents;
  if (data.home) agentHome = data.home;
  updateCwdLabel(); // ahora que hay home, refrescar el «~» de la carpeta
  const bar = document.getElementById('spawn-buttons');
  bar.innerHTML = '';
  for (const def of agentDefs) {
    const btn = document.createElement('button');
    btn.className = 'spawn-btn';
    btn.disabled = !def.available;
    if (def.available) {
      btn.title = def.local
        ? `Invocar modelo local ${def.label} (elige qué modelo ejecutar)`
        : `Invocar agente ${def.label}`;
    } else {
      btn.title = def.local
        ? `${def.label} no está instalado. Instálalo desde ollama.com y descarga un modelo.`
        : `${def.label} no está instalado en esta máquina`;
    }
    const localMark = def.local ? '<span class="local-chip">local</span>' : '';
    btn.dataset.type = def.type;
    btn.innerHTML = `<span class="dot" style="background:${def.color};color:${def.color}"></span>${def.label}${localMark}`;
    btn.onclick = () => spawnAgent(def.type);
    bar.appendChild(btn);
  }
}
loadAgentDefs();

// ---------------------------------------------------------------------------
// Carpeta de trabajo de los agentes (dónde se abren, qué carpeta «confían»)
// ---------------------------------------------------------------------------
const cwdBtn = document.getElementById('cwd-btn');
const cwdLabel = document.getElementById('cwd-label');
let workDir = storageGet('lienzo-workdir') || ''; // '' = carpeta de inicio (~) del servidor
let cwdPop = null;

function updateCwdLabel() {
  const shown = workDir ? shortenPath(workDir) : '~';
  cwdLabel.textContent = shown.length > 26 ? '…' + shown.slice(-25) : shown;
  cwdBtn.title = workDir
    ? `Carpeta de trabajo de los agentes: ${workDir}`
    : 'Carpeta de trabajo: la de inicio (~). Haz clic para elegir otra.';
}

// Valida (y expande «~») una ruta contra el servidor y la fija como carpeta de
// trabajo. dir vacío = volver a la carpeta de inicio. Devuelve si tuvo éxito.
async function setWorkDir(dir) {
  if (!dir) {
    workDir = '';
    storageSet('lienzo-workdir', '');
    updateCwdLabel();
    return true;
  }
  try {
    const res = await fetch(`/api/validate-dir?path=${encodeURIComponent(dir)}`);
    const data = await res.json();
    if (data.ok) {
      workDir = data.path;
      storageSet('lienzo-workdir', workDir);
      updateCwdLabel();
      return true;
    }
  } catch { /* red: tratar como inválida */ }
  toast('Esa carpeta no existe o no es válida');
  return false;
}

// Revalidar la carpeta guardada al cargar (pudo borrarse o moverse).
if (workDir) {
  fetch(`/api/validate-dir?path=${encodeURIComponent(workDir)}`)
    .then((r) => r.json())
    .then((d) => { if (!d.ok) { workDir = ''; storageSet('lienzo-workdir', ''); } updateCwdLabel(); })
    .catch(() => {});
}
updateCwdLabel();

function closeCwdPop() {
  if (cwdPop) { cwdPop.remove(); cwdPop = null; }
  document.removeEventListener('pointerdown', onCwdOutside, true);
}
function onCwdOutside(e) {
  if (cwdPop && !cwdPop.contains(e.target) && !cwdBtn.contains(e.target)) closeCwdPop();
}

function openCwdPop() {
  const pop = document.createElement('div');
  pop.className = 'cwd-pop';
  pop.innerHTML = `
    <div class="cwd-head">Carpeta de trabajo</div>
    <p class="cwd-note">Los agentes nuevos se abrirán aquí; será la carpeta que te pidan «confiar».</p>
    <button type="button" class="cwd-browse">📂 Elegir carpeta…</button>
    <form class="cwd-form">
      <input type="text" placeholder="~/proyectos/mi-app" autocomplete="off" spellcheck="false" />
      <button type="submit" title="Usar esta ruta">Usar</button>
    </form>
    <button type="button" class="cwd-reset">↺ Carpeta de inicio (~)</button>`;
  document.body.appendChild(pop);
  cwdPop = pop;

  const r = cwdBtn.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 324))}px`;
  pop.style.top = `${r.bottom + 8}px`;

  const input = pop.querySelector('.cwd-form input');
  input.value = workDir || '';
  const browse = pop.querySelector('.cwd-browse');

  pop.querySelector('.cwd-form').onsubmit = async (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (await setWorkDir(v)) { closeCwdPop(); toast(v ? 'Carpeta de trabajo actualizada' : 'Carpeta de inicio (~)'); }
  };
  browse.onclick = async () => {
    browse.textContent = 'Abriendo el explorador…';
    browse.disabled = true;
    try {
      const res = await fetch(`/api/pick-folder?start=${encodeURIComponent(workDir || '')}`);
      const data = await res.json();
      if (data.path) { await setWorkDir(data.path); closeCwdPop(); toast('Carpeta de trabajo actualizada'); return; }
      // Cancelado o sin diálogo nativo: dejar que escriba la ruta.
      browse.textContent = '📂 Elegir carpeta…';
      browse.disabled = false;
      input.focus();
    } catch {
      browse.textContent = '📂 Elegir carpeta…';
      browse.disabled = false;
      toast('No se pudo abrir el explorador; escribe la ruta.');
    }
  };
  pop.querySelector('.cwd-reset').onclick = async () => {
    await setWorkDir('');
    closeCwdPop();
    toast('Carpeta de inicio (~)');
  };

  // Registrar el cierre-al-clic-fuera en el próximo tick: así el propio clic que
  // abre el popover no lo cierra de inmediato.
  setTimeout(() => {
    if (cwdPop === pop) document.addEventListener('pointerdown', onCwdOutside, true);
    input.focus();
  }, 0);
}

cwdBtn.onclick = () => (cwdPop ? closeCwdPop() : openCwdPop());

// Modelos locales instalados para un tipo de agente. Se consulta cada vez que se
// abre el selector (el servidor cachea 3 s) para que un modelo recién descargado
// con `ollama pull` aparezca sin recargar la página.
async function fetchModels(type) {
  try {
    const res = await fetch(`/api/models?type=${encodeURIComponent(type)}`);
    const data = await res.json();
    return Array.isArray(data.models) ? data.models : [];
  } catch {
    return [];
  }
}

function nextName() {
  if (nameSeq < NAMES.length) return NAMES[nameSeq++];
  return `Agente ${++nameSeq - NAMES.length}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// --- Selector de modelo local (Ollama) -------------------------------------
let openPicker = null;
function closeModelPicker() {
  if (openPicker) { openPicker.remove(); openPicker = null; }
  document.removeEventListener('pointerdown', onPickerOutside, true);
}
function onPickerOutside(e) {
  // Cerrar ante cualquier clic fuera del picker (incluidos otros botones de
  // spawn). Reabrir el mismo botón vuelve a mostrarlo vía openModelPicker.
  if (openPicker && !openPicker.contains(e.target)) {
    closeModelPicker();
  }
}

async function openModelPicker(def) {
  closeModelPicker();
  const anchor = document.querySelector(`.spawn-btn[data-type="${def.type}"]`);
  const pop = document.createElement('div');
  pop.className = 'model-picker';
  pop.innerHTML = `<div class="mp-head">Elige un modelo de ${def.label}</div>
    <div class="mp-list"><div class="mp-loading">Cargando modelos…</div></div>
    <form class="mp-custom">
      <input type="text" placeholder="…u otro modelo (p. ej. llama3)" autocomplete="off" />
      <button type="submit" title="Ejecutar este modelo">Ejecutar</button>
    </form>`;
  document.body.appendChild(pop);
  openPicker = pop;

  // Posicionar bajo el botón
  const r = anchor ? anchor.getBoundingClientRect() : { left: 80, bottom: 56 };
  pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 268))}px`;
  pop.style.top = `${r.bottom + 8}px`;

  const list = pop.querySelector('.mp-list');
  const input = pop.querySelector('.mp-custom input');
  pop.querySelector('.mp-custom').onsubmit = (e) => {
    e.preventDefault();
    const m = input.value.trim();
    if (!m) return;
    closeModelPicker();
    spawnAgent(def.type, { model: m });
  };

  document.addEventListener('pointerdown', onPickerOutside, true);
  setTimeout(() => input.focus(), 30);

  const models = await fetchModels(def.type);
  if (!openPicker) return; // se cerró mientras cargaba
  if (models.length === 0) {
    list.innerHTML = `<div class="mp-empty">No hay modelos descargados.<br>
      Ejecuta <code>ollama pull llama3</code> en una terminal y vuelve a intentarlo,
      o escribe un nombre abajo.</div>`;
    return;
  }
  list.innerHTML = '';
  for (const m of models) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'mp-item';
    row.innerHTML = `<span class="mp-dot" style="background:${def.color}"></span>${escapeHtml(m)}`;
    row.onclick = () => { closeModelPicker(); spawnAgent(def.type, { model: m }); };
    list.appendChild(row);
  }
}

function spawnAgent(type, opts = {}) {
  const def = agentDefs.find((d) => d.type === type);
  if (!def || !def.available) return toast(`Agente "${type}" no disponible.`);

  // Modelos locales: primero preguntar qué modelo ejecutar.
  if (def.needsModel && !opts.model) {
    return openModelPicker(def);
  }
  const model = opts.model || null;

  const id = `a${++agentSeq}-${Date.now()}`;
  const name = nextName();

  // Card
  const card = document.createElement('div');
  card.className = 'agent-card spawning';
  const cx = (viewport.clientWidth / 2 - view.x) / view.scale - 280 + spawnCascade;
  const cy = (viewport.clientHeight / 2 - view.y) / view.scale - 190 + spawnCascade;
  spawnCascade = (spawnCascade + 36) % 216;
  card.style.left = `${cx}px`;
  card.style.top = `${cy}px`;
  card.style.zIndex = ++zTop;

  card.innerHTML = `
    <div class="agent-header">
      <button class="traffic" title="Cerrar agente">✕</button>
      <span class="status"></span>
      <span class="name">${name}</span>
      <span class="badge" style="background:${def.color}">${def.label}${model ? ` · ${escapeHtml(model)}` : ''}</span>
      <span class="cwd"></span>
    </div>
    <div class="agent-term"></div>
    <div class="resize-handle"></div>`;
  canvas.appendChild(card);
  card.addEventListener('animationend', () => card.classList.remove('spawning'), { once: true });

  // Terminal
  const term = new Terminal({
    fontSize: 12.5,
    fontFamily: '"SF Mono", ui-monospace, Menlo, Monaco, monospace',
    cursorBlink: true,
    allowProposedApi: true,
    allowTransparency: true,
    theme: TERM_THEMES[document.body.dataset.theme] || TERM_THEMES.midnight,
    scrollback: 5000,
  });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open(card.querySelector('.agent-term'));
  fit.fit();

  term.onData((data) => wsSend({ type: 'input', id, data }));

  const agent = {
    id, name, type, def, model, card, term, fit,
    status: 'idle',
    statusEl: card.querySelector('.status'),
    cwdEl: card.querySelector('.cwd'),
    workTimer: null,
  };
  agents.set(id, agent);
  emptyHint.classList.add('hidden');

  wsSend({ type: 'spawn', id, agent: type, model, cols: term.cols, rows: term.rows, cwd: workDir || null });

  // Focus / raise
  card.addEventListener('pointerdown', () => {
    card.style.zIndex = ++zTop;
    document.querySelectorAll('.agent-card.focused').forEach((c) => c.classList.remove('focused'));
    card.classList.add('focused');
  });

  // Close
  card.querySelector('.traffic').onclick = () => closeAgent(agent);

  // Drag by header
  const header = card.querySelector('.agent-header');
  header.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.traffic')) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, left: card.offsetLeft, top: card.offsetTop };
    const move = (ev) => {
      card.style.left = `${start.left + (ev.clientX - start.x) / view.scale}px`;
      card.style.top = `${start.top + (ev.clientY - start.y) / view.scale}px`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  // Resize by handle
  const handle = card.querySelector('.resize-handle');
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY, w: card.offsetWidth, h: card.offsetHeight };
    let fitQueued = false;
    const move = (ev) => {
      card.style.width = `${Math.max(340, start.w + (ev.clientX - start.x) / view.scale)}px`;
      card.style.height = `${Math.max(240, start.h + (ev.clientY - start.y) / view.scale)}px`;
      // fit() fuerza layout: como mucho una vez por frame, no por cada pointermove
      if (!fitQueued) {
        fitQueued = true;
        requestAnimationFrame(() => { fitQueued = false; fit.fit(); });
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      fit.fit();
      wsSend({ type: 'resize', id, cols: term.cols, rows: term.rows });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });

  term.onResize(({ cols, rows }) => wsSend({ type: 'resize', id, cols, rows }));
  term.focus();
  toast(`${name} · ${def.label} se ha unido al lienzo`);
  return agent;
}

function closeAgent(agent) {
  wsSend({ type: 'kill', id: agent.id });
  agents.delete(agent.id);
  agent.card.classList.add('closing');
  agent.card.addEventListener('animationend', () => {
    agent.term.dispose();
    agent.card.remove();
    if (agents.size === 0) emptyHint.classList.remove('hidden');
  }, { once: true });
}

function setStatus(agent, status) {
  agent.status = status;
  agent.statusEl.className = `status${status === 'working' ? ' working' : status === 'dead' ? ' dead' : ''}`;
  agent.card.classList.toggle('working', status === 'working');
}

function markWorking(agent) {
  if (agent.status === 'dead') return;
  setStatus(agent, 'working');
  clearTimeout(agent.workTimer);
  agent.workTimer = setTimeout(() => {
    if (agent.status !== 'dead') setStatus(agent, 'idle');
  }, 2500);
}

function sendToAgent(agent, text) {
  wsSend({ type: 'input', id: agent.id, data: text });
  // Give TUIs a beat to ingest the text before submitting
  setTimeout(() => wsSend({ type: 'input', id: agent.id, data: '\r' }), 120);
}

// ---------------------------------------------------------------------------
// Broadcast
// ---------------------------------------------------------------------------

document.getElementById('broadcast-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('broadcast-input');
  const text = input.value.trim();
  if (!text) return;
  let count = 0;
  for (const agent of agents.values()) {
    if (agent.status !== 'dead') {
      sendToAgent(agent, text);
      count++;
    }
  }
  toast(count ? `Orden enviada a ${count} agente${count === 1 ? '' : 's'}` : 'No hay agentes en el lienzo');
  input.value = '';
});

// ---------------------------------------------------------------------------
// Organizar tarjetas (cuadrícula / fila / columna / cascada)
// ---------------------------------------------------------------------------

const ARRANGE_KEY = 'lienzo-arrange';
const ARRANGE_DEFAULTS = { mode: 'grid', gap: 24, cols: 0, sort: 'creation', uniform: true };
let arrangePrefs = { ...ARRANGE_DEFAULTS };
try {
  arrangePrefs = { ...ARRANGE_DEFAULTS, ...JSON.parse(storageGet(ARRANGE_KEY) || '{}') };
} catch { /* preferencias corruptas: usar las de fábrica */ }

function saveArrangePrefs() {
  storageSet(ARRANGE_KEY, JSON.stringify(arrangePrefs));
}

function sortedCards() {
  const list = [...agents.values()];
  if (arrangePrefs.sort === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  } else if (arrangePrefs.sort === 'type') {
    list.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  }
  return list; // 'creation': orden de llegada (inserción del Map)
}

// Coloca todas las tarjetas según el modo y encuadra la vista para verlas.
let arrangeTimer = null;
function arrangeCards(mode = arrangePrefs.mode) {
  const list = sortedCards();
  if (!list.length) { toast('No hay agentes que organizar'); return; }
  arrangePrefs.mode = mode;
  saveArrangePrefs();

  const gap = arrangePrefs.gap;
  // Celda: tamaño de fábrica si se igualan, o el máximo actual para no solapar.
  const cellW = arrangePrefs.uniform ? 560 : Math.max(...list.map((a) => a.card.offsetWidth));
  const cellH = arrangePrefs.uniform ? 380 : Math.max(...list.map((a) => a.card.offsetHeight));

  let cols;
  if (mode === 'row') cols = list.length;
  else if (mode === 'column') cols = 1;
  else cols = arrangePrefs.cols || Math.ceil(Math.sqrt(list.length));

  list.forEach((agent, i) => {
    const card = agent.card;
    card.classList.add('arranging');
    if (mode === 'cascade') {
      card.style.left = `${i * 44}px`;
      card.style.top = `${i * 44}px`;
      card.style.zIndex = ++zTop;
    } else {
      card.style.left = `${(i % cols) * (cellW + gap)}px`;
      card.style.top = `${Math.floor(i / cols) * (cellH + gap)}px`;
    }
    if (arrangePrefs.uniform) {
      card.style.width = `${cellW}px`;
      card.style.height = `${cellH}px`;
    }
  });

  const rows = Math.ceil(list.length / cols);
  const bw = mode === 'cascade' ? cellW + (list.length - 1) * 44 : cols * cellW + (cols - 1) * gap;
  const bh = mode === 'cascade' ? cellH + (list.length - 1) * 44 : rows * cellH + (rows - 1) * gap;
  fitViewTo(0, 0, bw, bh);

  // Al asentarse la transición, reajustar los terminales al tamaño nuevo.
  clearTimeout(arrangeTimer);
  arrangeTimer = setTimeout(() => {
    document.querySelectorAll('.agent-card.arranging').forEach((c) => c.classList.remove('arranging'));
    for (const agent of list) agent.fit.fit();
  }, 480);
}

// Centra la vista sobre un rectángulo del lienzo (coordenadas sin escalar).
function fitViewTo(bx, by, bw, bh) {
  const padX = 60, padTop = 90, padBottom = 60; // hueco para topbar y controles
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  const scale = Math.min(1, Math.max(0.25,
    Math.min((vw - padX * 2) / bw, (vh - padTop - padBottom) / bh)));
  const x = (vw - bw * scale) / 2 - bx * scale;
  const y = padTop + (vh - padTop - padBottom - bh * scale) / 2 - by * scale;
  glideView(x, y, scale);
}

// --- Popover de opciones ----------------------------------------------------
const arrangeBtn = document.getElementById('arrange-btn');
let arrangePop = null;

function closeArrangePop() {
  if (arrangePop) { arrangePop.remove(); arrangePop = null; }
  document.removeEventListener('pointerdown', onArrangeOutside, true);
}
function onArrangeOutside(e) {
  if (arrangePop && !arrangePop.contains(e.target) && e.target !== arrangeBtn) closeArrangePop();
}
function markArrangeMode(pop) {
  pop.querySelectorAll('.ap-modes button').forEach((b) =>
    b.classList.toggle('on', b.dataset.mode === arrangePrefs.mode));
}

function openArrangePop() {
  const pop = document.createElement('div');
  pop.className = 'arrange-pop';
  pop.innerHTML = `
    <div class="ap-head">Organizar el lienzo</div>
    <div class="ap-modes">
      <button type="button" data-mode="grid">⊞ Cuadrícula</button>
      <button type="button" data-mode="row">▤ Fila</button>
      <button type="button" data-mode="column">▥ Columna</button>
      <button type="button" data-mode="cascade">⧉ Cascada</button>
    </div>
    <label class="ap-row">Separación
      <input type="range" name="gap" min="12" max="64" step="4" value="${arrangePrefs.gap}" />
      <span class="ap-val">${arrangePrefs.gap}px</span>
    </label>
    <label class="ap-row">Columnas
      <select name="cols">
        <option value="0">Auto</option>
        ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}">${n}</option>`).join('')}
      </select>
    </label>
    <label class="ap-row">Ordenar por
      <select name="sort">
        <option value="creation">Llegada</option>
        <option value="name">Nombre</option>
        <option value="type">Agente</option>
      </select>
    </label>
    <label class="ap-check">
      <input type="checkbox" name="uniform" ${arrangePrefs.uniform ? 'checked' : ''} />
      Igualar tamaños
    </label>`;
  document.body.appendChild(pop);
  arrangePop = pop;

  pop.querySelector('select[name="cols"]').value = String(arrangePrefs.cols);
  pop.querySelector('select[name="sort"]').value = arrangePrefs.sort;
  markArrangeMode(pop);

  const r = arrangeBtn.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 296))}px`;
  pop.style.top = `${r.bottom + 8}px`;

  pop.querySelectorAll('.ap-modes button').forEach((b) => {
    b.onclick = () => { arrangeCards(b.dataset.mode); markArrangeMode(pop); };
  });
  pop.oninput = (e) => {
    const t = e.target;
    if (t.name === 'gap') {
      arrangePrefs.gap = +t.value;
      pop.querySelector('.ap-val').textContent = `${t.value}px`;
    } else if (t.name === 'cols') arrangePrefs.cols = +t.value;
    else if (t.name === 'sort') arrangePrefs.sort = t.value;
    else if (t.name === 'uniform') arrangePrefs.uniform = t.checked;
    saveArrangePrefs();
    if (agents.size) arrangeCards(arrangePrefs.mode); // vista previa en vivo
  };

  document.addEventListener('pointerdown', onArrangeOutside, true);
}

arrangeBtn.onclick = () => (arrangePop ? closeArrangePop() : openArrangePop());

// ---------------------------------------------------------------------------
// Voice control
// ---------------------------------------------------------------------------

const micBtn = document.getElementById('mic-btn');
const voiceChip = document.getElementById('voice-chip');
const voiceText = document.getElementById('voice-text');
let recognition = null;
let listening = false;

function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function findAgentByName(word) {
  const w = normalize(word);
  for (const agent of agents.values()) {
    const n = normalize(agent.name);
    if (n === w || n.startsWith(w) || w.startsWith(n)) return agent;
  }
  return null;
}

function findDefByWord(text) {
  const t = normalize(text);
  for (const def of agentDefs) {
    if (t.includes(def.type) || t.includes(normalize(def.label))) return def;
  }
  if (/\b(terminal|consola)\b/.test(t)) return agentDefs.find((d) => d.type === 'shell');
  return null;
}

function handleVoiceCommand(raw) {
  const text = raw.trim();
  if (!text) return;
  const norm = normalize(text);

  // "nuevo agente claude" / "new claude agent" / "invoca a codex"
  if (/^(nuevo|nueva|crea|invoca|abre|new|create|open|spawn)\b/.test(norm)) {
    const def = findDefByWord(norm);
    if (def && def.available) {
      spawnAgent(def.type);
      return;
    }
  }

  // "organiza el lienzo" / "alinea en cuadrícula" / "acomoda en cascada"
  // («ordena» queda reservado para la difusión: "ordena a todos que…")
  if (/^(organiza|alinea|acomoda|arrange|tidy)\b/.test(norm)) {
    const mode = /\b(fila|row)\b/.test(norm) ? 'row'
      : /\b(columna|column)\b/.test(norm) ? 'column'
      : /\b(cascada|cascade)\b/.test(norm) ? 'cascade'
      : /\b(cuadricula|grid)\b/.test(norm) ? 'grid'
      : arrangePrefs.mode;
    arrangeCards(mode);
    return;
  }

  // "cierra a marshall" / "close ada"
  const closeMatch = norm.match(/^(cierra|cerrar|close|kill|termina)\s+(?:a\s+)?(\S+)/);
  if (closeMatch) {
    const agent = findAgentByName(closeMatch[2]);
    if (agent) {
      closeAgent(agent);
      toast(`${agent.name} cerrado`);
      return;
    }
  }

  // "todos: corran los tests" / "everyone run the tests"
  const allMatch = text.match(/^\s*(todos|todas|all|everyone|everybody)[\s,:]+(.+)/i);
  if (allMatch) {
    let count = 0;
    for (const agent of agents.values()) {
      if (agent.status !== 'dead') { sendToAgent(agent, allMatch[2]); count++; }
    }
    toast(`Orden por voz enviada a ${count} agente${count === 1 ? '' : 's'}`);
    return;
  }

  // "marshall, corre los tests"
  const parts = text.match(/^\s*(\S+)[\s,:]+(.+)/);
  if (parts) {
    const agent = findAgentByName(parts[1]);
    if (agent) {
      sendToAgent(agent, parts[2]);
      toast(`→ ${agent.name}: ${parts[2]}`);
      return;
    }
  }

  toast(`No entendí a quién va dirigido: «${text}»`);
}

function setupRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = navigator.language && navigator.language.startsWith('es') ? 'es-ES' : navigator.language || 'es-ES';
  rec.continuous = true;
  rec.interimResults = true;
  rec.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) handleVoiceCommand(r[0].transcript);
      else interim += r[0].transcript;
    }
    voiceText.textContent = interim || 'Escuchando…';
  };
  rec.onend = () => {
    if (!listening) return;
    // start() puede lanzar si la sesión anterior aún no ha soltado el micrófono;
    // un único intento dejaría el modo voz muerto con el indicador encendido.
    try { rec.start(); } catch {
      setTimeout(() => {
        if (listening) { try { rec.start(); } catch { /* sigue ocupado */ } }
      }, 300);
    }
  };
  rec.onerror = (ev) => {
    if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
      toast('Permiso de micrófono denegado');
      stopListening();
    }
  };
  return rec;
}

function startListening() {
  recognition = recognition || setupRecognition();
  if (!recognition) {
    toast('Este navegador no soporta reconocimiento de voz (usa Chrome o Safari)');
    return;
  }
  listening = true;
  try { recognition.start(); } catch { /* already started */ }
  micBtn.classList.add('recording');
  siriGlow.classList.add('on');
  voiceChip.classList.remove('hidden');
  voiceText.textContent = 'Escuchando…';
}

function stopListening() {
  listening = false;
  if (recognition) recognition.stop();
  micBtn.classList.remove('recording');
  siriGlow.classList.remove('on');
  voiceChip.classList.add('hidden');
}

micBtn.onclick = () => (listening ? stopListening() : startListening());

// ---------------------------------------------------------------------------
// Themes & misc
// ---------------------------------------------------------------------------

// localStorage puede lanzar (datos de sitio/cookies bloqueados en el navegador):
// no debe tumbar el script entero.
function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* almacenamiento bloqueado */ }
}

const themeSelect = document.getElementById('theme-select');
const savedTheme = storageGet('lienzo-theme');
if (savedTheme && TERM_THEMES[savedTheme]) {
  document.body.dataset.theme = savedTheme;
  themeSelect.value = savedTheme;
}
themeSelect.onchange = () => {
  const t = themeSelect.value;
  document.body.dataset.theme = t;
  storageSet('lienzo-theme', t);
  for (const agent of agents.values()) {
    agent.term.options.theme = TERM_THEMES[t];
  }
};

let toastTimer = null;
function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}

let refitQueued = false;
window.addEventListener('resize', () => {
  if (refitQueued) return;
  refitQueued = true;
  requestAnimationFrame(() => {
    refitQueued = false;
    for (const agent of agents.values()) agent.fit.fit();
  });
});

// API mínima para el tutorial interactivo
window.LIENZO = { spawnAgent, closeAgent, arrangeCards, agents, siriGlow, toast };

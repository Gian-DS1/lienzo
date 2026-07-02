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
  ws = new WebSocket(`ws://${location.host}/ws`);
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
      agent.cwdEl.textContent = msg.cwd.replace(/^\/Users\/[^/]+/, '~');
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

async function loadAgentDefs() {
  const res = await fetch('/api/agents');
  const data = await res.json();
  agentDefs = data.agents;
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

  wsSend({ type: 'spawn', id, agent: type, model, cols: term.cols, rows: term.rows, cwd: null });

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
    const move = (ev) => {
      card.style.width = `${Math.max(340, start.w + (ev.clientX - start.x) / view.scale)}px`;
      card.style.height = `${Math.max(240, start.h + (ev.clientY - start.y) / view.scale)}px`;
      fit.fit();
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
    if (listening) {
      try { rec.start(); } catch { /* already restarting */ }
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

const themeSelect = document.getElementById('theme-select');
const savedTheme = localStorage.getItem('lienzo-theme');
if (savedTheme && TERM_THEMES[savedTheme]) {
  document.body.dataset.theme = savedTheme;
  themeSelect.value = savedTheme;
}
themeSelect.onchange = () => {
  const t = themeSelect.value;
  document.body.dataset.theme = t;
  localStorage.setItem('lienzo-theme', t);
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

window.addEventListener('resize', () => {
  for (const agent of agents.values()) agent.fit.fit();
});

// API mínima para el tutorial interactivo
window.LIENZO = { spawnAgent, closeAgent, agents, siriGlow, toast };

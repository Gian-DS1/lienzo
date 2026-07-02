const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { WebSocketServer } = require('ws');
const pty = require('@lydell/node-pty');

const PORT = process.env.PORT || 3000;
// Vincular solo a loopback: LIENZO arranca shells reales; nunca debe quedar
// expuesto a la red local. Ponible en 0.0.0.0 explícitamente con HOST si se sabe.
const HOST = process.env.HOST || '127.0.0.1';
const HOME = os.homedir();
const IS_WIN = process.platform === 'win32';

// Orígenes/hosts admitidos en el handshake WebSocket. Sin esto, cualquier página
// web que la víctima visite podría abrir ws://localhost:3000 y ejecutar comandos
// (cross-site WebSocket hijacking); y sin validar Host, un ataque de DNS rebinding
// alcanzaría el servicio aunque escuche solo en loopback.
const ALLOWED_HOSTS = new Set([
  `localhost:${PORT}`, `127.0.0.1:${PORT}`, `[::1]:${PORT}`,
]);
const ALLOWED_ORIGINS = new Set([
  `http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`, `http://[::1]:${PORT}`,
]);

// ---------------------------------------------------------------------------
// Agent CLI detection
// ---------------------------------------------------------------------------

// Localiza un ejecutable en el PATH. En Windows usa `where` (devuelve rutas con
// extensión, p. ej. claude.cmd); en Unix usa `which`.
function which(bin) {
  try {
    const out = IS_WIN
      ? execFileSync('where', [bin], { encoding: 'utf8' })
      : execFileSync('/usr/bin/which', [bin], { encoding: 'utf8' });
    const first = out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
    return first || null;
  } catch {
    return null;
  }
}

function firstExisting(paths) {
  for (const p of paths) {
    try {
      if (p && fs.statSync(p).isFile()) return p;
    } catch { /* keep looking */ }
  }
  return null;
}

// Busca un CLI instalado con npm -g de forma robusta y multiplataforma. Prueba
// primero rutas explícitas (funciona aunque la app se lance desde el Finder / un
// acceso directo con PATH mínimo) y cae a `which`/`where` como último recurso.
// En Windows los CLIs de npm son shims .cmd/.exe en la carpeta de node o en
// %APPDATA%\npm; en macOS/Linux son ejecutables junto a node o en /usr/local/bin.
function npmCli(name) {
  const nodeDir = path.dirname(process.execPath);
  const candidates = [];
  if (IS_WIN) {
    const exts = ['.cmd', '.exe', '.bat', ''];
    const dirs = [nodeDir, path.join(process.env.APPDATA || '', 'npm')];
    for (const d of dirs) for (const e of exts) candidates.push(path.join(d, name + e));
  } else {
    candidates.push(
      path.join(nodeDir, name),
      '/usr/local/bin/' + name,
      '/opt/homebrew/bin/' + name,
      path.join(HOME, '.local', 'bin', name),
    );
  }
  return firstExisting(candidates) || which(name);
}

// node-pty (ConPTY) no puede lanzar un .cmd/.bat directamente vía CreateProcess:
// hay que envolverlo con cmd.exe /c. Los .exe y los ejecutables Unix se lanzan tal cual.
function spawnSpec(bin, extraArgs) {
  if (IS_WIN && /\.(cmd|bat)$/i.test(bin)) {
    return { file: process.env.ComSpec || 'cmd.exe', args: ['/c', bin, ...extraArgs] };
  }
  return { file: bin, args: extraArgs };
}

// ---------------------------------------------------------------------------
// Modelos locales (Ollama). Corre modelos en tu propia máquina, sin cuenta.
// ---------------------------------------------------------------------------

function ollamaBin() {
  return which('ollama') || firstExisting([
    '/usr/local/bin/ollama',
    '/opt/homebrew/bin/ollama',
    '/usr/bin/ollama',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Ollama', 'ollama.exe'),
  ]);
}

// Lista los modelos ya descargados (`ollama list`), devolviendo sus nombres.
function ollamaModels() {
  const bin = ollamaBin();
  if (!bin) return [];
  try {
    const out = execFileSync(bin, ['list'], { encoding: 'utf8', timeout: 5000 });
    return out
      .split(/\r?\n/)
      .slice(1) // saltar la cabecera NAME/ID/SIZE…
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.split(/\s+/)[0]) // primera columna = NAME
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Nombre de modelo seguro (evita inyección de argumentos). Cubre etiquetas como
// llama3:latest, qwen2.5-coder:7b, library/llama3, etc.
const MODEL_RE = /^[\w./:-]{1,120}$/;

const AGENT_DEFS = [
  {
    type: 'claude',
    label: 'Claude Code',
    color: '#D97757',
    resolve: () => npmCli('claude') || firstExisting([path.join(HOME, '.claude', 'local', 'claude')]),
    args: [],
  },
  {
    type: 'codex',
    label: 'Codex',
    color: '#10A37F',
    resolve: () => npmCli('codex'),
    args: [],
  },
  {
    type: 'gemini',
    label: 'Gemini',
    color: '#4285F4',
    resolve: () => npmCli('gemini'),
    args: [],
  },
  {
    type: 'copilot',
    label: 'Copilot',
    color: '#8957E5',
    resolve: () => npmCli('copilot'),
    args: [],
  },
  {
    type: 'cursor',
    label: 'Cursor',
    color: '#8B5CF6',
    resolve: () => which('cursor-agent') || firstExisting([path.join(HOME, '.local', 'bin', 'cursor-agent')]),
    args: [],
  },
  {
    type: 'aider',
    label: 'Aider',
    color: '#22C55E',
    resolve: () => npmCli('aider'),
    args: [],
  },
  {
    type: 'ollama',
    label: 'Ollama',
    color: '#14B8A6',
    local: true,       // corre en tu máquina, sin cuenta
    needsModel: true,  // hay que elegir qué modelo ejecutar
    resolve: () => ollamaBin(),
    listModels: ollamaModels,
    runArgs: (model) => ['run', model],
    args: [],
  },
  {
    type: 'shell',
    label: IS_WIN ? 'PowerShell' : 'Shell',
    color: '#94A3B8',
    resolve: () => IS_WIN
      ? (firstExisting([path.join(process.env.SystemRoot || 'C:\\Windows',
          'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')]) || 'powershell.exe')
      : (process.env.SHELL || '/bin/zsh'),
    args: [],
  },
];

function detectAgents() {
  return AGENT_DEFS.map((def) => {
    const bin = def.resolve();
    return {
      type: def.type, label: def.label, color: def.color, available: !!bin, bin,
      local: !!def.local, needsModel: !!def.needsModel,
    };
  });
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/xterm', express.static(path.join(__dirname, 'node_modules', '@xterm', 'xterm')));
app.use('/vendor/addon-fit', express.static(path.join(__dirname, 'node_modules', '@xterm', 'addon-fit')));

app.get('/api/agents', (_req, res) => {
  res.json({ agents: detectAgents().map(({ bin, ...rest }) => rest), home: HOME, cwd: process.cwd() });
});

// Modelos locales instalados para un agente (p. ej. ?type=ollama).
app.get('/api/models', (req, res) => {
  const def = AGENT_DEFS.find((d) => d.type === req.query.type && typeof d.listModels === 'function');
  res.json({ models: def ? def.listModels() : [] });
});

const server = http.createServer(app);

// ---------------------------------------------------------------------------
// WebSocket: one connection per browser tab, multiplexing all terminals
// ---------------------------------------------------------------------------

// Aceptar el handshake solo si Host y (cuando lo hay) Origin están en la allowlist.
// Un cliente WebSocket crudo puede falsificar estos headers, pero el vector real
// —una web maliciosa en el navegador de la víctima— no puede: el navegador fija
// Origin y Host automáticamente.
function verifyClient({ req }) {
  const host = req.headers.host;
  if (!host || !ALLOWED_HOSTS.has(host)) return false;
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) return false;
  return true;
}

const wss = new WebSocketServer({ server, path: '/ws', verifyClient });

wss.on('connection', (ws) => {
  const terms = new Map(); // id -> pty process

  const send = (msg) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'spawn') {
      const def = AGENT_DEFS.find((d) => d.type === msg.agent);
      const bin = def && def.resolve();
      if (!bin) {
        send({ type: 'error', id: msg.id, message: `Agente "${msg.agent}" no disponible en esta máquina.` });
        return;
      }
      let extraArgs = def.args;
      if (def.needsModel) {
        const model = typeof msg.model === 'string' ? msg.model.trim() : '';
        if (!MODEL_RE.test(model)) {
          send({ type: 'error', id: msg.id, message: 'Modelo local no válido o no indicado.' });
          return;
        }
        extraArgs = def.runArgs(model);
      }
      let cwd = msg.cwd && fs.existsSync(msg.cwd) ? msg.cwd : HOME;
      try {
        const { file, args } = spawnSpec(bin, extraArgs);
        const proc = pty.spawn(file, args, {
          name: 'xterm-256color',
          cols: msg.cols || 80,
          rows: msg.rows || 24,
          cwd,
          env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
        });
        terms.set(msg.id, proc);
        proc.onData((data) => send({ type: 'data', id: msg.id, data }));
        proc.onExit(({ exitCode }) => {
          terms.delete(msg.id);
          send({ type: 'exit', id: msg.id, code: exitCode });
        });
        send({ type: 'spawned', id: msg.id, pid: proc.pid, cwd });
      } catch (err) {
        send({ type: 'error', id: msg.id, message: String(err.message || err) });
      }
    } else if (msg.type === 'input') {
      const proc = terms.get(msg.id);
      if (proc) proc.write(msg.data);
    } else if (msg.type === 'resize') {
      const proc = terms.get(msg.id);
      if (proc && msg.cols > 0 && msg.rows > 0) {
        try { proc.resize(msg.cols, msg.rows); } catch { /* races with exit */ }
      }
    } else if (msg.type === 'kill') {
      const proc = terms.get(msg.id);
      if (proc) {
        try { proc.kill(); } catch { /* already dead */ }
        terms.delete(msg.id);
      }
    }
  });

  ws.on('close', () => {
    for (const proc of terms.values()) {
      try { proc.kill(); } catch { /* already dead */ }
    }
    terms.clear();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`LIENZO listo en http://localhost:${PORT} (bind ${HOST})`);
  console.log('Agentes detectados:');
  for (const a of detectAgents()) {
    console.log(`  ${a.available ? '✓' : '✗'} ${a.label}${a.available ? `  (${a.bin})` : ''}`);
  }
});

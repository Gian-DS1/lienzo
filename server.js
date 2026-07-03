const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync, execFile } = require('child_process');
const { WebSocketServer } = require('ws');
const pty = require('@lydell/node-pty');

const PORT = process.env.PORT || 3000;
// Vincular solo a loopback: LIENZO arranca shells reales; nunca debe quedar
// expuesto a la red local. Ponible en 0.0.0.0 explícitamente con HOST si se sabe.
const HOST = process.env.HOST || '127.0.0.1';
const HOST_IS_LOOPBACK = ['127.0.0.1', 'localhost', '::1'].includes(HOST);
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
// Con un HOST no-loopback explícito hay que admitir además las direcciones
// reales de la máquina: si no, el HTTP serviría la página a la LAN pero el
// handshake WS rechazaría a todos los clientes (terminales muertos). Un Host
// de DNS rebinding (p. ej. evil.com:3000) sigue fuera de la lista.
if (!HOST_IS_LOOPBACK) {
  const addrs = HOST === '0.0.0.0' || HOST === '::'
    ? Object.values(os.networkInterfaces()).flat().map((i) => i && i.address).filter(Boolean)
    : [HOST];
  for (const addr of addrs) {
    const h = addr.includes(':') ? `[${addr}]` : addr; // IPv6 va entre corchetes
    ALLOWED_HOSTS.add(`${h}:${PORT}`);
    ALLOWED_ORIGINS.add(`http://${h}:${PORT}`);
  }
}

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
    // %APPDATA%\npm es el prefijo global por defecto de npm (sin espacios en la
    // ruta); se prueba antes que la carpeta de node (que puede ser Program Files).
    const dirs = [];
    if (process.env.APPDATA) dirs.push(path.join(process.env.APPDATA, 'npm'));
    dirs.push(nodeDir);
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

// PATH para los procesos de agentes. Cuando LIENZO se lanza desde el Finder o un
// acceso directo, hereda un PATH mínimo sin el directorio de node; los CLIs de npm
// (codex, etc.) son scripts con shebang `#!/usr/bin/env node` y mueren con
// «env: node: No such file or directory» (código 127). Anteponemos el directorio
// del node que ejecuta este servidor (y rutas comunes) al PATH heredado.
let cachedAgentPath = null;
function agentPath() {
  if (cachedAgentPath !== null) return cachedAgentPath;
  const parts = [path.dirname(process.execPath)];
  if (IS_WIN) {
    if (process.env.APPDATA) parts.push(path.join(process.env.APPDATA, 'npm'));
  } else {
    parts.push('/usr/local/bin', '/opt/homebrew/bin', path.join(HOME, '.local', 'bin'));
  }
  const current = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const p of current) if (!parts.includes(p)) parts.push(p);
  cachedAgentPath = parts.join(path.delimiter);
  return cachedAgentPath;
}

// Claves de API para los agentes (p. ej. ANTHROPIC_API_KEY, OPENAI_API_KEY):
// lanzado desde el Dock/acceso directo, LIENZO no hereda los `export` del shell
// del usuario, así que se leen de ~/.lienzo.env (líneas CLAVE=valor, # comenta).
function userEnvFile() {
  const env = {};
  try {
    const text = fs.readFileSync(path.join(HOME, '.lienzo.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[m[1]] = v;
    }
  } catch { /* sin fichero: nada que añadir */ }
  return env;
}

// Entorno de los agentes con el PATH reforzado. En Windows la clave puede ser
// «Path»: hay que sobrescribir la existente, no añadir una «PATH» duplicada.
function agentEnv() {
  const env = { ...process.env, ...userEnvFile(), TERM: 'xterm-256color', COLORTERM: 'truecolor' };
  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
  env[pathKey] = agentPath();
  return env;
}

// ---------------------------------------------------------------------------
// Modelos locales (Ollama). Corre modelos en tu propia máquina, sin cuenta.
// ---------------------------------------------------------------------------

function ollamaBin() {
  const candidates = IS_WIN
    ? [
        path.join(process.env.LOCALAPPDATA || 'C:\\', 'Programs', 'Ollama', 'ollama.exe'),
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Ollama', 'ollama.exe'),
      ]
    : ['/usr/local/bin/ollama', '/opt/homebrew/bin/ollama', '/usr/bin/ollama'];
  // Rutas de instalación estándar primero (statSync, sin subproceso); si no,
  // se busca en el PATH con which/where.
  return firstExisting(candidates) || which('ollama');
}

// Lista los modelos ya descargados (`ollama list`), devolviendo sus nombres.
// Asíncrono (no bloquea el event loop) y con caché de 3 s para que peticiones
// repetidas no relancen el subproceso ni permitan saturar el servidor.
let ollamaCache = { at: 0, models: [] };
function ollamaModels() {
  return new Promise((resolve) => {
    if (Date.now() - ollamaCache.at < 3000) return resolve(ollamaCache.models);
    const bin = ollamaBin();
    if (!bin) return resolve([]);
    execFile(bin, ['list'], { encoding: 'utf8', timeout: 5000 }, (err, stdout) => {
      if (err) return resolve(ollamaCache.models); // devuelve lo último bueno (o [])
      const models = stdout
        .split(/\r?\n/)
        .slice(1) // saltar la cabecera NAME/ID/SIZE…
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.split(/\s+/)[0]) // primera columna = NAME
        .filter(Boolean);
      ollamaCache = { at: Date.now(), models };
      resolve(models);
    });
  });
}

// Nombre de modelo seguro (evita inyección de argumentos; no puede empezar por
// «-» para que ollama no lo interprete como flag). Cubre etiquetas como
// llama3:latest, qwen2.5-coder:7b, library/llama3, etc.
const MODEL_RE = /^[\w][\w./:-]{0,119}$/;

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

// La detección puede lanzar subprocesos (which/where), así que se cachea unos
// segundos: reduce el coste en recargas rápidas y evita que peticiones repetidas
// a /api/agents saturen la máquina, sin dejar de reflejar un CLI recién instalado.
let agentsCache = { at: 0, list: null };
function detectAgents() {
  if (agentsCache.list && Date.now() - agentsCache.at < 4000) return agentsCache.list;
  const list = AGENT_DEFS.map((def) => {
    const bin = def.resolve();
    return {
      type: def.type, label: def.label, color: def.color, available: !!bin, bin,
      local: !!def.local, needsModel: !!def.needsModel,
    };
  });
  agentsCache = { at: Date.now(), list };
  return list;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/xterm', express.static(path.join(__dirname, 'node_modules', '@xterm', 'xterm')));
app.use('/vendor/addon-fit', express.static(path.join(__dirname, 'node_modules', '@xterm', 'addon-fit')));

app.get('/favicon.ico', (_req, res) => {
  res.sendFile(path.join(__dirname, 'assets', 'icon.ico'), (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});

app.get('/api/agents', (_req, res) => {
  res.json({ agents: detectAgents().map(({ bin, ...rest }) => rest), home: HOME, cwd: process.cwd() });
});

// Modelos locales instalados para un agente (p. ej. ?type=ollama).
app.get('/api/models', async (req, res) => {
  const def = AGENT_DEFS.find((d) => d.type === req.query.type && typeof d.listModels === 'function');
  res.json({ models: def ? await def.listModels() : [] });
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
      // Binario desde la caché de detección: evita relanzar which/where (síncrono,
      // bloquea todos los terminales) por spawn, y coincide con lo que vio la UI.
      const found = def && detectAgents().find((a) => a.type === def.type);
      const bin = found && found.bin;
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
          env: agentEnv(),
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

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const hint = IS_WIN ? '$env:PORT=3001; npm start' : 'PORT=3001 npm start';
    console.error(`El puerto ${PORT} ya está en uso. ¿LIENZO ya está abierto? ` +
      `Ciérralo, o arranca con otro puerto:  ${hint}`);
  } else {
    console.error('Error del servidor:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`LIENZO listo en http://localhost:${PORT} (bind ${HOST})`);
  if (!HOST_IS_LOOPBACK) {
    console.log('⚠ HOST no-loopback: LIENZO queda accesible desde la red y abre shells reales.');
  }
  console.log('Agentes detectados:');
  for (const a of detectAgents()) {
    console.log(`  ${a.available ? '✓' : '✗'} ${a.label}${a.available ? `  (${a.bin})` : ''}`);
  }
});

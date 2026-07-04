#!/usr/bin/env node
/*
 * LIENZO — lanzador multiplataforma.
 * Arranca el servidor si no está corriendo, espera a que responda y abre una
 * ventana de app (Chrome/Edge en modo --app, o el navegador por defecto).
 * Funciona igual en Windows, macOS y Linux; sin dependencias externas.
 */
'use strict';

const path = require('path');
const http = require('http');
const net = require('net');
const fs = require('fs');
const os = require('os');
const { spawn, execFile, execFileSync } = require('child_process');

const { buildMacApp } = require('./build-mac-app');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3000;
const APP_URL = `http://localhost:${PORT}/`;
const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';

function portOpen(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port }, () => {
      sock.destroy();
      resolve(true);
    });
    sock.on('error', () => resolve(false));
    sock.setTimeout(700, () => {
      sock.destroy();
      resolve(false);
    });
  });
}

function httpOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode > 0);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1200, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function startServer() {
  // Redirigir la salida del servidor a un log en la carpeta temporal, para poder
  // diagnosticar si algo falla. Si no se puede abrir, se descarta la salida.
  let out = 'ignore';
  try {
    out = fs.openSync(path.join(os.tmpdir(), 'lienzo.log'), 'a');
  } catch { /* sin log */ }
  const child = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', out, out],
    windowsHide: true,
    env: process.env,
  });
  child.unref();
}

// Proceso desacoplado que ignora errores de arranque: un binario ausente
// (p. ej. sin xdg-open) emitiría 'error' sin manejador y tumbaría el lanzador.
function launchDetached(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore', ...opts });
  child.on('error', () => {});
  child.unref();
}

// Variables de ~/.lienzo.env (las mismas que ven los agentes). Aquí solo se
// usa LIENZO_WINDOW, para elegir cómo abrir la ventana sin tocar comandos.
function userEnvVars() {
  const env = {};
  try {
    const text = fs.readFileSync(path.join(os.homedir(), '.lienzo.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch { /* sin fichero */ }
  return env;
}

function firstFile(paths) {
  for (const p of paths) {
    try {
      if (p && fs.statSync(p).isFile()) return p;
    } catch { /* next */ }
  }
  return null;
}

// Cadena clásica de Windows: modo --app de Edge (preinstalado) o Chrome, o el
// navegador por defecto. Plan B de la ventana nativa y modo LIENZO_WINDOW=chrome.
function openWinBrowsers(allowApp) {
  const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = process.env['LOCALAPPDATA'] || '';
  const edge = firstFile([
    path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ]);
  const chrome = firstFile([
    path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ]);
  const app = allowApp && (edge || chrome);
  if (app) {
    launchDetached(app, [`--app=${APP_URL}`, '--new-window']);
  } else {
    // Navegador por defecto
    launchDetached('cmd', ['/c', 'start', '""', APP_URL], { windowsHide: true });
  }
}

// Ventana nativa de Windows: WinForms + WebView2 creada por PowerShell
// (scripts/webview-win.ps1) — sin navegador y sin binarios propios. Si el SDK
// aún no está descargado o el script muere al arrancar, se cae a Edge/Chrome.
function openWinNative() {
  const dll = path.join(ROOT, 'webview2', 'Microsoft.Web.WebView2.WinForms.dll');
  if (!fs.existsSync(dll)) {
    // SDK ausente (setup sin red): descargarlo para la próxima y abrir Edge hoy.
    launchDetached(process.execPath, [path.join(ROOT, 'scripts', 'fetch-webview2.js')]);
    return openWinBrowsers(true);
  }
  return new Promise((resolve) => {
    const icon = path.join(ROOT, 'assets', 'icon.ico');
    // -Sta: WinForms necesita apartamento monohilo (powershell.exe 5.1 ya lo es
    // por defecto, pero explícito evita un fallo si resolviera a un host MTA).
    const args = ['-NoProfile', '-NonInteractive', '-Sta', '-ExecutionPolicy', 'Bypass',
      '-WindowStyle', 'Hidden', '-File', path.join(ROOT, 'scripts', 'webview-win.ps1'),
      '-Url', APP_URL];
    if (fs.existsSync(icon)) args.push('-Icon', icon);
    const child = spawn('powershell', args, { detached: true, stdio: 'ignore', windowsHide: true });
    let settled = false;
    const settle = (fallback) => {
      if (settled) return;
      settled = true;
      if (fallback) openWinBrowsers(true); else child.unref();
      resolve();
    };
    child.on('error', () => settle(true));
    child.on('exit', (code) => settle(code !== 0));
    // PowerShell + WebView2 tardan en arrancar: margen antes de darlo por bueno
    setTimeout(() => settle(false), 2500);
  });
}

function openWindows() {
  const mode = process.env.LIENZO_WINDOW || userEnvVars().LIENZO_WINDOW || 'native';
  if (mode === 'chrome') return openWinBrowsers(true);
  if (mode === 'browser') return openWinBrowsers(false);
  return openWinNative();
}

// Cadena clásica: modo --app de Chrome/Brave/Edge si están, o el navegador
// por defecto. Es el plan B de la ventana nativa y el modo LIENZO_WINDOW=chrome.
function openMacBrowsers(allowApp) {
  const browsers = ['Google Chrome', 'Brave Browser', 'Microsoft Edge'];
  const found = allowApp && browsers.find((b) => {
    try { return fs.statSync(`/Applications/${b}.app`).isDirectory(); } catch { return false; }
  });
  if (found) {
    launchDetached('open', ['-na', found, '--args', `--app=${APP_URL}`]);
  } else {
    execFile('open', [APP_URL], () => { /* mejor esfuerzo */ });
  }
}

// ¿El Mac es Apple Silicon (arm64), aunque este node corra traducido por Rosetta?
// Se cachea; process.arch ya basta si node es arm64, si no se consulta al sistema.
let _arm64Hw = null;
function isAppleSiliconHw() {
  if (!IS_MAC) return false;
  if (_arm64Hw !== null) return _arm64Hw;
  if (process.arch === 'arm64') { _arm64Hw = true; return true; }
  try {
    _arm64Hw = execFileSync('sysctl', ['-n', 'hw.optional.arm64'], { encoding: 'utf8' }).trim() === '1';
  } catch { _arm64Hw = false; }
  return _arm64Hw;
}

// En Apple Silicon lanza SIEMPRE el slice nativo (arm64). Si LIENZO se abrió
// desde un proceso x86_64 (p. ej. la terminal de un editor bajo Rosetta), el
// applet universal heredaría x86_64: macOS mostraría el aviso de «app Intel» y
// la ventana JXA fallaría con -2700. `arch -arm64` fuerza la arquitectura nativa;
// en Mac Intel se lanza tal cual (no existe slice arm64 que forzar).
function spawnMacWindow(cmd, args, childEnv) {
  const opts = { detached: true, stdio: 'ignore', env: childEnv };
  return isAppleSiliconHw()
    ? spawn('arch', ['-arm64', cmd, ...args], opts)
    : spawn(cmd, args, opts);
}

// Ventana nativa de macOS: app real compilada con osacompile (barra de menús y
// Dock muestran «LIENZO»). La URL y el icono se pasan por entorno. Si osacompile
// no está o falla, se usa la ventana de osascript; y si esa muriera al arrancar,
// se cae a los navegadores. Nota: el control por voz solo existe en Chrome.
function openMac() {
  const mode = process.env.LIENZO_WINDOW || userEnvVars().LIENZO_WINDOW || 'native';
  if (mode === 'chrome') return openMacBrowsers(true);
  if (mode === 'browser') return openMacBrowsers(false);

  const icon = path.join(ROOT, 'assets', 'icon-1024.png');
  const childEnv = { ...process.env, LIENZO_URL: APP_URL };
  if (fs.existsSync(icon)) childEnv.LIENZO_ICON = icon;

  const exec = buildMacApp(false); // construye la .app si falta o cambió el script
  return new Promise((resolve) => {
    const child = exec
      ? spawnMacWindow(exec, [], childEnv)
      : spawnMacWindow('osascript', ['-l', 'JavaScript', path.join(ROOT, 'scripts', 'webview-mac.js')], childEnv);
    let settled = false;
    const settle = (fallback) => {
      if (settled) return;
      settled = true;
      if (fallback) openMacBrowsers(true); else child.unref();
      resolve();
    };
    child.on('error', () => settle(true));
    child.on('exit', (code) => settle(code !== 0));
    setTimeout(() => settle(false), 2000);
  });
}

function openLinux() {
  const candidates = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];
  const which = (bin) => {
    try {
      const out = require('child_process').execFileSync('which', [bin], { encoding: 'utf8' }).trim();
      return out || null;
    } catch { return null; }
  };
  const app = candidates.map(which).find(Boolean);
  if (app) {
    launchDetached(app, [`--app=${APP_URL}`]);
  } else {
    launchDetached('xdg-open', [APP_URL]);
  }
}

function openBrowser() {
  if (IS_WIN) return openWindows();
  if (IS_MAC) return openMac();
  return openLinux();
}

(async () => {
  if (!(await portOpen(PORT))) {
    startServer();
  }
  // Esperar a que el servidor responda (hasta ~15 s)
  for (let i = 0; i < 60; i++) {
    if (await httpOk(APP_URL)) break;
    await sleep(250);
  }
  await openBrowser();
  // Dar un instante a que el navegador tome el proceso antes de salir
  await sleep(400);
})();

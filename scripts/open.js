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
const { spawn, execFile } = require('child_process');

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

function firstFile(paths) {
  for (const p of paths) {
    try {
      if (p && fs.statSync(p).isFile()) return p;
    } catch { /* next */ }
  }
  return null;
}

function openWindows() {
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
  const app = chrome || edge;
  if (app) {
    spawn(app, [`--app=${APP_URL}`, '--new-window'], { detached: true, stdio: 'ignore' }).unref();
  } else {
    // Navegador por defecto
    spawn('cmd', ['/c', 'start', '""', APP_URL], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  }
}

function openMac() {
  const browsers = ['Google Chrome', 'Brave Browser', 'Microsoft Edge'];
  const found = browsers.find((b) => {
    try { return fs.statSync(`/Applications/${b}.app`).isDirectory(); } catch { return false; }
  });
  if (found) {
    spawn('open', ['-na', found, '--args', `--app=${APP_URL}`], { detached: true, stdio: 'ignore' }).unref();
  } else {
    execFile('open', [APP_URL]);
  }
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
    spawn(app, [`--app=${APP_URL}`], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [APP_URL], { detached: true, stdio: 'ignore' }).unref();
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
  openBrowser();
  // Dar un instante a que el navegador tome el proceso antes de salir
  await sleep(400);
})();

#!/usr/bin/env node
/*
 * LIENZO — construye la app nativa de macOS.
 * Compila scripts/webview-mac.js a una app real con `osacompile` (herramienta de
 * serie en macOS, no compila código nativo ni produce ningún .exe/binario
 * nuestro). El resultado es una .app con su propio bundle, así la barra de menús
 * y el Dock muestran «LIENZO» en vez de «osascript».
 *
 *   node scripts/build-mac-app.js       (lo llama `npm run setup` en macOS)
 *
 * Como módulo: require('./build-mac-app').buildMacApp() devuelve la ruta del
 * ejecutable del applet (o null si no se pudo construir).
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'scripts', 'webview-mac.js');
const OUT_DIR = path.join(ROOT, 'mac-app');
const APP = path.join(OUT_DIR, 'LIENZO.app');
const EXEC = path.join(APP, 'Contents', 'MacOS', 'applet');
const PLIST = path.join(APP, 'Contents', 'Info.plist');
const ICNS_DST = path.join(APP, 'Contents', 'Resources', 'applet.icns');

// El applet ya construido está al día si es más nuevo que su script fuente.
function isFresh() {
  try {
    return fs.statSync(EXEC).mtimeMs >= fs.statSync(SRC).mtimeMs;
  } catch {
    return false;
  }
}

function plistBuddy(cmd) {
  execFileSync('/usr/libexec/PlistBuddy', ['-c', cmd, PLIST], { stdio: 'ignore' });
}

// Añade (o actualiza) una clave del Info.plist, exista o no de antemano.
function setPlist(key, value) {
  try { plistBuddy(`Set :${key} ${value}`); }
  catch { try { plistBuddy(`Add :${key} string ${value}`); } catch { /* opcional */ } }
}

// Construye la app si falta o si el script cambió. Devuelve la ruta del
// ejecutable, o null si osacompile no está disponible / falla.
function buildMacApp(force) {
  if (!force && isFresh()) return EXEC;
  try {
    fs.rmSync(APP, { recursive: true, force: true });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    // osacompile fija CFBundleName al nombre del bundle → «LIENZO».
    execFileSync('osacompile', ['-l', 'JavaScript', '-o', APP, SRC], { stdio: 'ignore' });
    setPlist('CFBundleDisplayName', 'LIENZO');
    setPlist('CFBundleIdentifier', 'dev.lienzo.app');
    const icns = path.join(ROOT, 'assets', 'icon.icns');
    if (fs.existsSync(icns)) fs.copyFileSync(icns, ICNS_DST); // icono propio en el Dock
    return fs.existsSync(EXEC) ? EXEC : null;
  } catch {
    return null;
  }
}

module.exports = { buildMacApp, APP, EXEC };

if (require.main === module) {
  const ok = buildMacApp(true);
  process.stdout.write(ok
    ? `✓ App de macOS lista en ${APP}\n`
    : '· No se pudo construir la app de macOS (se usará la ventana de osascript o el navegador).\n');
  process.exit(0);
}

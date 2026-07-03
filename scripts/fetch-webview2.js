#!/usr/bin/env node
/*
 * LIENZO — descarga el SDK de WebView2 (DLLs oficiales de Microsoft) para la
 * ventana nativa de Windows. Es una dependencia, como node_modules: se guarda
 * en <repo>/webview2 (ignorada por git) y no hay nada que compilar.
 *
 *   node scripts/fetch-webview2.js      (lo llama `npm run setup` en Windows)
 */
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const VERSION = '1.0.2792.45'; // versión estable fijada del paquete NuGet
const PKG_URL = `https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/${VERSION}`;
const ROOT = path.resolve(__dirname, '..');
const DEST = path.join(ROOT, 'webview2');
const MARKER = path.join(DEST, 'VERSION');

function log(msg) { process.stdout.write(msg + '\n'); }

// GET con redirecciones (nuget.org redirige a su CDN).
function download(url, file, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('demasiadas redirecciones'));
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(download(res.headers.location, file, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const out = fs.createWriteStream(file);
      res.pipe(out);
      out.on('finish', () => out.close(resolve));
      out.on('error', reject);
      res.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  try {
    if (fs.existsSync(MARKER) && fs.readFileSync(MARKER, 'utf8').trim() === VERSION) {
      log(`✓ SDK WebView2 ${VERSION} ya descargado (${DEST})`);
      return;
    }

    log(`Descargando SDK WebView2 ${VERSION} (NuGet, ~5 MB)…`);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lienzo-wv2-'));
    const nupkg = path.join(tmp, 'webview2.nupkg');
    await download(PKG_URL, nupkg);

    // Un .nupkg es un zip; `tar` lo extrae y viene de serie en Windows 10+,
    // macOS y la mayoría de Linux (bsdtar).
    const extracted = path.join(tmp, 'pkg');
    fs.mkdirSync(extracted, { recursive: true });
    execFileSync('tar', ['-xf', nupkg, '-C', extracted]);

    // PowerShell 5.1 es .NET Framework (4.8 en todo Windows 10/11) → DLLs de
    // lib/net462. El cargador nativo debe coincidir con la arquitectura del
    // Windows donde corre.
    const winArch = (process.env.PROCESSOR_ARCHITECTURE || os.arch()).toLowerCase();
    const loaderArch = winArch.includes('arm64') ? 'win-arm64' : 'win-x64';
    const files = [
      ['lib/net462/Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.Core.dll'],
      ['lib/net462/Microsoft.Web.WebView2.WinForms.dll', 'Microsoft.Web.WebView2.WinForms.dll'],
      [`runtimes/${loaderArch}/native/WebView2Loader.dll`, 'WebView2Loader.dll'],
    ];
    fs.mkdirSync(DEST, { recursive: true });
    for (const [src, dst] of files) {
      const from = path.join(extracted, ...src.split('/'));
      if (!fs.existsSync(from)) throw new Error(`falta ${src} en el paquete`);
      fs.copyFileSync(from, path.join(DEST, dst));
    }
    fs.writeFileSync(MARKER, VERSION + '\n');
    fs.rmSync(tmp, { recursive: true, force: true });
    log(`✓ SDK WebView2 listo en ${DEST}`);
  } catch (e) {
    log('· No se pudo descargar el SDK de WebView2: ' + (e && e.message));
    log('  Sin él, LIENZO abre con Edge; se reintenta en el próximo arranque.');
    process.exitCode = 1;
  }
})();

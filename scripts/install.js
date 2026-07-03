#!/usr/bin/env node
/*
 * LIENZO — instalador de acceso directo / app.
 * Crea un lanzador nativo para el sistema actual que abre LIENZO como un
 * programa normal (doble clic), apuntando a esta copia del repo y a este node.
 *
 *   node scripts/install.js      (o: npm run setup)
 */
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const NODE = process.execPath;
const OPEN = path.join(ROOT, 'scripts', 'open.js');
const ASSETS = path.join(ROOT, 'assets');
const HOME = os.homedir();

function log(msg) { process.stdout.write(msg + '\n'); }

// --------------------------------------------------------------------- macOS
function installMac() {
  const appDir = path.join(HOME, 'Applications', 'LIENZO.app');
  const macOS = path.join(appDir, 'Contents', 'MacOS');
  const resources = path.join(appDir, 'Contents', 'Resources');
  fs.rmSync(appDir, { recursive: true, force: true });
  fs.mkdirSync(macOS, { recursive: true });
  fs.mkdirSync(resources, { recursive: true });

  // Rutas embebidas entre comillas simples: es el único quoting de bash sin
  // caracteres activos (dólar, backtick, barra); solo se escapa la comilla simple.
  const shq = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
  const exec = `#!/bin/bash
# Resolver node (esta instalación primero, luego rutas comunes)
NODE=${shq(NODE)}
[ -x "$NODE" ] || NODE="$(command -v node)"
for c in "$HOME/.nvm/versions/node/"*/bin/node /opt/homebrew/bin/node /usr/local/bin/node; do
  [ -x "$NODE" ] && break; [ -x "$c" ] && NODE="$c"
done
if [ -z "$NODE" ] || [ ! -x "$NODE" ]; then
  osascript -e 'display alert "LIENZO" message "No se encontró Node.js. Instálalo desde nodejs.org." as critical'
  exit 1
fi
exec "$NODE" ${shq(OPEN)}
`;
  const execPath = path.join(macOS, 'LIENZO');
  fs.writeFileSync(execPath, exec);
  fs.chmodSync(execPath, 0o755);

  const icns = path.join(ASSETS, 'icon.icns');
  if (fs.existsSync(icns)) fs.copyFileSync(icns, path.join(resources, 'icon.icns'));

  fs.writeFileSync(path.join(appDir, 'Contents', 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>LIENZO</string>
  <key>CFBundleDisplayName</key><string>LIENZO</string>
  <key>CFBundleIdentifier</key><string>dev.lienzo.app</string>
  <key>CFBundleVersion</key><string>1.0.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleExecutable</key><string>LIENZO</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
`);
  // Refrescar el icono en el Finder
  try { execFileSync('touch', [appDir]); } catch { /* opcional */ }
  log(`✓ App creada: ${appDir}`);
  log('  Ábrela desde Launchpad/Spotlight o arrástrala al Dock.');

  // Compilar la app de la ventana nativa (osacompile) para que la barra de menús
  // muestre «LIENZO». Mejor esfuerzo: si falla, el lanzador la reintenta o usa
  // la ventana de osascript.
  try {
    require('./build-mac-app').buildMacApp(true);
    log('✓ Ventana nativa lista (osacompile)');
  } catch { log('· No se pudo compilar la ventana nativa; se hará al abrir LIENZO.'); }
}

// ------------------------------------------------------------------- Windows
function installWindows() {
  const launchers = path.join(ROOT, 'launchers');
  fs.mkdirSync(launchers, { recursive: true });
  const vbs = path.join(launchers, 'LIENZO.vbs');
  // En VBScript la barra invertida NO se escapa (es literal); solo las comillas
  // dobles se escapan duplicándolas. Estilo de ventana 0 = oculta (sin consola).
  const vbsStr = (s) => s.replace(/"/g, '""');
  fs.writeFileSync(vbs, `' LIENZO - lanzador oculto
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "${vbsStr(ROOT)}"
sh.Run """${vbsStr(NODE)}"" ""${vbsStr(OPEN)}""", 0, False
`);

  const ico = path.join(ASSETS, 'icon.ico');
  const iconArg = fs.existsSync(ico) ? ico : NODE;
  const desktop = path.join(HOME, 'Desktop');
  const startMenu = path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'),
    'Microsoft', 'Windows', 'Start Menu', 'Programs');

  // En cadenas PowerShell entre comillas simples, la barra invertida es literal;
  // solo hay que duplicar las comillas simples.
  const ps1 = (s) => s.replace(/'/g, "''");
  const mkShortcut = (dir) => {
    fs.mkdirSync(dir, { recursive: true });
    const lnk = path.join(dir, 'LIENZO.lnk');
    const ps = `$s = (New-Object -ComObject WScript.Shell).CreateShortcut('${ps1(lnk)}')
$s.TargetPath = '${ps1(vbs)}'
$s.WorkingDirectory = '${ps1(ROOT)}'
$s.IconLocation = '${ps1(iconArg)}'
$s.Description = 'LIENZO - comanda un ejercito de agentes de IA'
$s.Save()`;
    execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps]);
    return lnk;
  };

  try { mkShortcut(desktop); log(`✓ Acceso directo en el Escritorio`); } catch (e) { log('· No se pudo crear el acceso del Escritorio: ' + e.message); }
  try { mkShortcut(startMenu); log(`✓ Acceso directo en el menú Inicio`); } catch (e) { log('· No se pudo crear el acceso del menú Inicio: ' + e.message); }
  log(`  Lanzador: ${vbs}`);

  // DLLs del SDK de WebView2 para la ventana nativa (dependencia descargada,
  // no un binario nuestro). Mejor esfuerzo: sin red, el lanzador reintenta y
  // mientras tanto abre con Edge.
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'fetch-webview2.js')], { stdio: 'inherit' });
  } catch { log('· SDK de WebView2 no descargado; se reintentará al abrir LIENZO.'); }
}

// --------------------------------------------------------------------- Linux
function installLinux() {
  const appsDir = path.join(HOME, '.local', 'share', 'applications');
  fs.mkdirSync(appsDir, { recursive: true });
  const iconPng = path.join(ASSETS, 'icon-1024.png');
  const desktopFile = path.join(appsDir, 'lienzo.desktop');
  // Argumento citado de Exec según la spec de .desktop: se escapan " ` $ \
  // con barra invertida y el % se duplica (es código de campo).
  const dq = (s) => '"' + s.replace(/[\\"$`]/g, '\\$&').replace(/%/g, '%%') + '"';
  fs.writeFileSync(desktopFile, `[Desktop Entry]
Type=Application
Name=LIENZO
Comment=Comanda un ejército de agentes de IA
Exec=${dq(NODE)} ${dq(OPEN)}
Icon=${fs.existsSync(iconPng) ? iconPng : 'utilities-terminal'}
Terminal=false
Categories=Development;Utility;
`);
  fs.chmodSync(desktopFile, 0o755);
  try { execFileSync('update-desktop-database', [appsDir]); } catch { /* opcional */ }
  log(`✓ Lanzador creado: ${desktopFile}`);
  log('  Búscalo como «LIENZO» en tu menú de aplicaciones.');
}

// Nunca fallar: este script corre como `postinstall`, así que un error creando el
// acceso directo no debe romper `npm install`. Se avisa y se termina con éxito.
try {
  log('Instalando el acceso directo de LIENZO…');
  log(`  Repo: ${ROOT}`);
  log(`  Node: ${NODE}`);
  if (process.platform === 'win32') installWindows();
  else if (process.platform === 'darwin') installMac();
  else installLinux();
  log('Listo. Abre LIENZO como cualquier otra app.');
} catch (e) {
  log('· No se pudo crear el acceso directo automáticamente: ' + (e && e.message));
  log('  Puedes reintentarlo luego con:  npm run setup');
}
process.exit(0);

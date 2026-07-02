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

  const exec = `#!/bin/bash
# Resolver node (esta instalación primero, luego rutas comunes)
NODE="${NODE}"
[ -x "$NODE" ] || NODE="$(command -v node)"
for c in "$HOME/.nvm/versions/node/"*/bin/node /opt/homebrew/bin/node /usr/local/bin/node; do
  [ -x "$NODE" ] && break; [ -x "$c" ] && NODE="$c"
done
if [ -z "$NODE" ] || [ ! -x "$NODE" ]; then
  osascript -e 'display alert "LIENZO" message "No se encontró Node.js. Instálalo desde nodejs.org." as critical'
  exit 1
fi
exec "$NODE" "${OPEN}"
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
}

// ------------------------------------------------------------------- Windows
function installWindows() {
  const launchers = path.join(ROOT, 'launchers');
  fs.mkdirSync(launchers, { recursive: true });
  const vbs = path.join(launchers, 'LIENZO.vbs');
  // Run con estilo 0 = ventana oculta (sin consola parpadeando)
  fs.writeFileSync(vbs, `' LIENZO — lanzador oculto
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "${ROOT.replace(/\\/g, '\\\\')}"
sh.Run """${NODE.replace(/\\/g, '\\\\')}"" ""${OPEN.replace(/\\/g, '\\\\')}""", 0, False
`);

  const ico = path.join(ASSETS, 'icon.ico');
  const iconArg = fs.existsSync(ico) ? ico : NODE;
  const desktop = path.join(HOME, 'Desktop');
  const startMenu = path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'),
    'Microsoft', 'Windows', 'Start Menu', 'Programs');

  const mkShortcut = (dir) => {
    fs.mkdirSync(dir, { recursive: true });
    const lnk = path.join(dir, 'LIENZO.lnk');
    const ps = `$s = (New-Object -ComObject WScript.Shell).CreateShortcut('${lnk}')
$s.TargetPath = '${vbs}'
$s.WorkingDirectory = '${ROOT}'
$s.IconLocation = '${iconArg}'
$s.Description = 'LIENZO — comanda un ejército de agentes de IA'
$s.Save()`;
    execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps]);
    return lnk;
  };

  try { mkShortcut(desktop); log(`✓ Acceso directo en el Escritorio`); } catch (e) { log('· No se pudo crear el acceso del Escritorio: ' + e.message); }
  try { mkShortcut(startMenu); log(`✓ Acceso directo en el menú Inicio`); } catch (e) { log('· No se pudo crear el acceso del menú Inicio: ' + e.message); }
  log(`  Lanzador: ${vbs}`);
}

// --------------------------------------------------------------------- Linux
function installLinux() {
  const appsDir = path.join(HOME, '.local', 'share', 'applications');
  fs.mkdirSync(appsDir, { recursive: true });
  const iconPng = path.join(ASSETS, 'icon-1024.png');
  const desktopFile = path.join(appsDir, 'lienzo.desktop');
  fs.writeFileSync(desktopFile, `[Desktop Entry]
Type=Application
Name=LIENZO
Comment=Comanda un ejército de agentes de IA
Exec="${NODE}" "${OPEN}"
Icon=${fs.existsSync(iconPng) ? iconPng : 'utilities-terminal'}
Terminal=false
Categories=Development;Utility;
`);
  fs.chmodSync(desktopFile, 0o755);
  try { execFileSync('update-desktop-database', [appsDir]); } catch { /* opcional */ }
  log(`✓ Lanzador creado: ${desktopFile}`);
  log('  Búscalo como «LIENZO» en tu menú de aplicaciones.');
}

log('Instalando el acceso directo de LIENZO…');
log(`  Repo: ${ROOT}`);
log(`  Node: ${NODE}`);
if (process.platform === 'win32') installWindows();
else if (process.platform === 'darwin') installMac();
else installLinux();
log('Listo. Abre LIENZO como cualquier otra app.');

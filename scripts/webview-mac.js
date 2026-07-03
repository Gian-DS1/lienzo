#!/usr/bin/env osascript -l JavaScript
/*
 * LIENZO — ventana nativa de macOS (WKWebView del sistema, sin navegador).
 * Se compila a una app real con `osacompile` (scripts/build-mac-app.js) para
 * que la barra de menús y el Dock muestren «LIENZO» y no «osascript». El applet
 * recibe la URL y el icono por variables de entorno (osacompile no pasa argv);
 * se mantiene el fallback a argv para ejecutarlo suelto con `osascript` en dev.
 *
 *   LIENZO_URL=… LIENZO_ICON=… mac-app/LIENZO.app/Contents/MacOS/applet
 *   osascript -l JavaScript scripts/webview-mac.js <url> [icono.png]   (dev)
 */
'use strict';
ObjC.import('Cocoa');
ObjC.import('WebKit');

function env(name) {
  const v = $.NSProcessInfo.processInfo.environment.objectForKey(name);
  return v && !v.isNil() ? v.js : '';
}

function run(argv) {
  const url = env('LIENZO_URL') || String((argv && argv[0]) || 'http://localhost:3000/');
  const iconPath = env('LIENZO_ICON') || (argv && argv[1] ? String(argv[1]) : '');

  const app = $.NSApplication.sharedApplication;
  app.setActivationPolicy(0); // 0 = NSApplicationActivationPolicyRegular (Dock + foco)

  // Cerrar la ventana debe terminar el proceso; si no, osascript seguiría
  // vivo e invisible para siempre.
  ObjC.registerSubclass({
    name: 'LienzoDelegate',
    protocols: ['NSApplicationDelegate'],
    methods: {
      'applicationShouldTerminateAfterLastWindowClosed:': {
        types: ['B', ['@']],
        implementation: () => true,
      },
    },
  });
  app.setDelegate($.LienzoDelegate.alloc.init);

  // Menú mínimo: sin un menú Edición, macOS no enruta ⌘C/⌘V/⌘X/⌘A y no se
  // podría pegar en los terminales; y sin «Salir» no funcionaría ⌘Q.
  const mainMenu = $.NSMenu.alloc.init;
  const appItem = $.NSMenuItem.alloc.init;
  const appMenu = $.NSMenu.alloc.init;
  appMenu.addItemWithTitleActionKeyEquivalent('Salir de LIENZO', 'terminate:', 'q');
  appItem.setSubmenu(appMenu);
  mainMenu.addItem(appItem);
  const editItem = $.NSMenuItem.alloc.init;
  const editMenu = $.NSMenu.alloc.initWithTitle('Edición');
  editMenu.addItemWithTitleActionKeyEquivalent('Deshacer', 'undo:', 'z');
  editMenu.addItemWithTitleActionKeyEquivalent('Cortar', 'cut:', 'x');
  editMenu.addItemWithTitleActionKeyEquivalent('Copiar', 'copy:', 'c');
  editMenu.addItemWithTitleActionKeyEquivalent('Pegar', 'paste:', 'v');
  editMenu.addItemWithTitleActionKeyEquivalent('Seleccionar todo', 'selectAll:', 'a');
  editItem.setSubmenu(editMenu);
  mainMenu.addItem(editItem);
  app.setMainMenu(mainMenu);

  // Icono propio en el Dock (además del nombre ya renombrado a «LIENZO»).
  if (iconPath) {
    const img = $.NSImage.alloc.initWithContentsOfFile(iconPath);
    if (img && !img.isNil()) app.applicationIconImage = img;
  }

  // Ventana centrada, ~90 % de la pantalla visible.
  const vf = $.NSScreen.mainScreen.visibleFrame;
  const w = Math.min(1480, vf.size.width * 0.9);
  const h = Math.min(940, vf.size.height * 0.92);
  const win = $.NSWindow.alloc.initWithContentRectStyleMaskBackingDefer(
    $.NSMakeRect(vf.origin.x + (vf.size.width - w) / 2, vf.origin.y + (vf.size.height - h) / 2, w, h),
    1 | 2 | 4 | 8, // Titled | Closable | Miniaturizable | Resizable
    2,             // NSBackingStoreBuffered
    false,
  );
  win.title = 'LIENZO';
  win.setFrameAutosaveName('LIENZO'); // recuerda tamaño y posición

  const conf = $.WKWebViewConfiguration.alloc.init;
  const web = $.WKWebView.alloc.initWithFrameConfiguration(win.contentView.bounds, conf);
  web.autoresizingMask = 2 | 16; // WidthSizable | HeightSizable
  web.loadRequest($.NSURLRequest.requestWithURL($.NSURL.URLWithString(url)));
  win.contentView.addSubview(web);

  win.makeKeyAndOrderFront($.nil);
  app.activateIgnoringOtherApps(true);
  app.run; // bucle de eventos; termina al cerrar la ventana
}

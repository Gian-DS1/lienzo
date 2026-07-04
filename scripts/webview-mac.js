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
  // vivo e invisible para siempre. AppKit llama a este método opcional por
  // `respondsToSelector:`, así que NO declaramos `protocols: ['NSApplicationDelegate']`:
  // hacerlo obliga a JXA a comparar la firma de tipos contra el protocolo, y bajo
  // Rosetta/x86_64 BOOL se codifica 'c' (no 'B'), lo que revienta con
  // «method types do not match the protocol method types (-2700)».
  ObjC.registerSubclass({
    name: 'LienzoDelegate',
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

  // Por defecto WKWebView RECHAZA toda petición de cámara/micrófono de la página
  // (getUserMedia y el reconocimiento de voz webkitSpeechRecognition). Sin un
  // WKUIDelegate que conteste, la respuesta es «denegado» al instante y macOS ni
  // siquiera muestra el diálogo de permiso: por eso la voz no funcionaba en la
  // ventana nativa. Concediendo la captura, el sistema pide el permiso REAL del
  // micrófono (el Info.plist ya trae NSMicrophoneUsageDescription) y la voz va
  // igual que en Chrome. Se usa respondsToSelector:, así que no declaramos el
  // protocolo (misma razón que LienzoDelegate). Firma: void, con NSInteger ('q')
  // para WKMediaCaptureType y un bloque ('@?') como decisionHandler.
  ObjC.registerSubclass({
    name: 'LienzoUIDelegate',
    methods: {
      'webView:requestMediaCapturePermissionForOrigin:initiatedByFrame:type:decisionHandler:': {
        types: ['v', ['@', '@', '@', 'q', '@?']],
        implementation: (_web, _origin, _frame, _type, decisionHandler) => {
          decisionHandler(1); // WKPermissionDecisionGrant
        },
      },
    },
  });
  // WKWebView.UIDelegate es una referencia DÉBIL: hay que guardar el delegado en
  // una variable viva o el recolector lo liberaría y volvería el «denegado».
  const uiDelegate = $.LienzoUIDelegate.alloc.init;
  web.setUIDelegate(uiDelegate);

  web.loadRequest($.NSURLRequest.requestWithURL($.NSURL.URLWithString(url)));
  win.contentView.addSubview(web);

  win.makeKeyAndOrderFront($.nil);
  app.activateIgnoringOtherApps(true);
  app.run; // bucle de eventos; termina al cerrar la ventana
}

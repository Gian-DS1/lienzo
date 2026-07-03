# LIENZO ◩

**Comanda un ejército de agentes de IA en un solo lienzo.** Réplica funcional del sistema
que vende [cnvs.dev](https://cnvs.dev/): Claude Code, Codex, Gemini, Copilot y **modelos
locales** (Ollama) corriendo en paralelo sobre un canvas infinito, dirigidos con texto
o con tu voz.

Tú diriges, ellos construyen, tú publicas.

Funciona en **macOS, Windows y Linux**. Solo necesitas [Node.js 18+](https://nodejs.org).

## Instalación

> 🪟 **¿Windows?** Sigue la **[guía paso a paso para Windows »](docs/WINDOWS.md)**
> — de cero, sin saber programar, explicando qué app abrir y qué comando escribir
> en cada paso.

Con [Node.js 18+](https://nodejs.org) instalado, en una terminal (macOS/Linux) o en
**PowerShell** (Windows):

```bash
git clone https://github.com/Gian-DS1/lienzo.git
cd lienzo
npm install        # instala dependencias y crea el acceso directo automáticamente
```

`npm install` ejecuta `npm run setup`, que crea un **acceso directo nativo** para tu
sistema (usa este repo y tu instalación de Node — nada de rutas fijas):

| Sistema | Qué crea | Cómo abrirlo |
|---|---|---|
| **macOS** | `~/Applications/LIENZO.app` | Launchpad / Spotlight / Dock |
| **Windows** | Acceso directo en Escritorio y menú Inicio | Doble clic en **LIENZO** |
| **Linux** | Entrada `LIENZO` en el menú de apps | Búscala en tu lanzador |

Al abrirlo, LIENZO arranca su servidor local (si no está ya corriendo) y abre una
ventana de app sin barra de navegador. **No hace falta tener Chrome** (ni ningún
otro navegador concreto) y no se instala ningún ejecutable:

- **macOS** — ventana **nativa** con el WebKit del sistema (un script de
  `osascript` que macOS trae de serie).
- **Windows** — modo `--app` de **Edge**, que viene preinstalado (o Chrome si está).
- **Linux** — modo `--app` de Chromium/Chrome, o el navegador por defecto.

¿Prefieres otra ventana en macOS? Añade `LIENZO_WINDOW=chrome` (modo app de
Chrome/Brave/Edge) o `LIENZO_WINDOW=browser` (navegador por defecto) a `~/.lienzo.env`.

Si prefieres la terminal: `npm start` y abre <http://localhost:3000>.

> **Node.js** es el único requisito. `@lydell/node-pty` incluye binarios
> precompilados para Windows (x64/ARM), macOS y Linux, así que **no hace falta
> compilar nada** ni tener herramientas de build.
>
> 💡 Clona el proyecto en una **carpeta local normal** (p. ej. `C:\Users\tú\lienzo`
> o `~/Proyectos`), **no** dentro de OneDrive/iCloud: los sincronizadores pueden
> bloquear archivos y dar errores de acceso.

## Diseño

Lenguaje visual inspirado en el **Liquid Glass** de Apple (WWDC25): superficies
translúcidas con `backdrop-filter` (blur + saturación), bordes de luz de 0.5px,
brillos especulares y sombras en capas. Las animaciones usan curvas de resorte
(`cubic-bezier`) al estilo iOS; las tarjetas activas muestran un **borde de
gradiente cónico rotatorio** al estilo Apple Intelligence, y el modo voz enciende
un **resplandor de borde de pantalla completo** tipo Siri. El icono
(chispa en gradiente sobre squircle oscuro) se genera con `assets/make-icon.swift`
y se exporta a `.icns` (macOS) y `.ico` (Windows).

## Qué hace

- **Canvas infinito** — paneo (arrastra el fondo o rueda del ratón), zoom (⌘/Ctrl + rueda
  o botones −/+), tarjetas arrastrables por su cabecera y redimensionables por la esquina.
- **Organizar con un clic** — el botón <kbd>Organizar</kbd> alinea todas las tarjetas en
  **cuadrícula, fila, columna o cascada** con animación y encuadre automático de la vista.
  Personalizable: separación, número de columnas, orden (llegada/nombre/agente) e igualar
  tamaños; tus preferencias se recuerdan. También por voz: `«organiza el lienzo»`.
- **Agentes reales en paralelo** — cada tarjeta es un proceso PTY independiente con un
  terminal completo (xterm.js). Los agentes se detectan automáticamente en tu máquina:

  | Agente | Binario | Instalación |
  |---|---|---|
  | Claude Code (Anthropic) | `claude` | `npm i -g @anthropic-ai/claude-code` |
  | Codex (OpenAI/GPT) | `codex` | `npm i -g @openai/codex` |
  | Gemini (Google) | `gemini` | `npm i -g @google/gemini-cli` |
  | Copilot (GitHub) | `copilot` | `npm i -g @github/copilot` |
  | **Ollama (modelos locales)** | `ollama` | [ollama.com/download](https://ollama.com/download) |
  | Cursor | `cursor-agent` | `curl https://cursor.com/install -fsS \| bash` |
  | Aider | `aider` | `pip install aider-install && aider-install` |
  | Shell / PowerShell | `$SHELL` / `powershell` | siempre disponible |

  Los que no estén instalados aparecen deshabilitados; instala uno y reinicia el
  servidor para activarlo. La primera vez, cada agente en la nube pide iniciar sesión
  con tu propia cuenta dentro de su tarjeta.

  > 🔑 **Claves de API para agentes** — si un CLI necesita una variable de entorno,
  > ponla en `~/.lienzo.env` (líneas `CLAVE=valor`); LIENZO se la pasa a todos los
  > agentes aunque lo abras desde el Dock o un acceso directo, donde los `export`
  > de tu shell no llegan. Ejemplo: Google retiró el login con cuenta individual
  > de Gemini CLI (julio 2026), así que crea una API key gratis en
  > [aistudio.google.com/apikey](https://aistudio.google.com/apikey), añade
  > `GEMINI_API_KEY=tu_clave` a `~/.lienzo.env` y elige «Use Gemini API Key» en su tarjeta.
- **Modelos locales** 🖥️ — el botón **Ollama** (con distintivo `local`) corre modelos
  en tu propia máquina: **gratis, privados y sin conexión**. Al pulsarlo eliges qué
  modelo ejecutar de una lista de los que ya tienes descargados (o escribes el nombre
  de cualquiera). Puedes mezclar modelos locales y en la nube en el mismo lienzo.
  Configuración en tres pasos:

  ```bash
  # 1. Instala Ollama desde https://ollama.com/download  (Windows/macOS/Linux)
  # 2. Descarga un modelo (para programar: qwen2.5-coder, deepseek-coder-v2, codellama)
  ollama pull llama3
  # 3. Abre LIENZO, pulsa «Ollama» y elige el modelo. Listo.
  ```

  Los modelos grandes piden más RAM (~8 GB para 7B, ~16 GB para 13B); si va lento,
  usa uno más pequeño (`phi3`, `mistral`) o una variante cuantizada
  (`llama3:8b-instruct-q4_0`). Detalle completo en la app: **Guía → Local**.
- **Tutorial interactivo** — se abre solo en la primera visita, o cuando quieras
  con el botón <kbd>?</kbd> de la barra: un recorrido de coach-marks con anillo
  de gradiente que se desliza entre elementos, demos en vivo (invoca un agente,
  enciende el resplandor Siri) y navegación con ←/→/Esc.
- **Guía** — el botón <kbd>Guía</kbd> abre un panel deslizante con tres pestañas:
  *Flujo óptimo* (seis pasos para coordinar varios agentes a la vez, más combos
  recomendados), *Membresías* (cómo iniciar sesión y qué suscripción usa cada
  modelo en la nube: Claude, Codex/GPT, Gemini, Copilot) y *Local* (cómo instalar
  Ollama y correr modelos en tu propia máquina).
- **Nombres de tripulación** — los agentes se llaman Marshall, Chase, Ada, Grace, Linus…
  para poder dirigirte a ellos por voz.
- **Difusión** — la barra superior envía una misma orden a todos los agentes vivos.
- **Control por voz** 🎙 — pulsa el micrófono (requiere Chrome o Safari; la ventana
  nativa de macOS no trae reconocimiento de voz — usa `LIENZO_WINDOW=chrome`) y habla:
  - `«Marshall, corre los tests»` → envía la orden a ese agente
  - `«todos: describe tu estado»` → difusión a todos
  - `«nuevo agente claude»` / `«abre una terminal»` → invoca un agente
  - `«cierra a Ada»` → cierra ese agente
  - `«organiza el lienzo»` / `«alinea en cuadrícula»` → ordena las tarjetas
- **Temas** — Midnight, Carbon, Paper y Synthwave; el terminal cambia de paleta con el tema.

## Arquitectura

```
server.js           Express + WebSocket. Detección de CLIs multiplataforma y
                    multiplexado de terminales PTY (@lydell/node-pty) por conexión:
                    spawn / input / resize / kill.
scripts/open.js     Lanzador: arranca el servidor y abre la ventana de la app
                    (Windows / macOS / Linux, sin dependencias).
scripts/webview-mac.js  Ventana nativa de macOS: WKWebView del sistema vía
                    osascript (JXA) — sin Chrome y sin binarios que compilar.
scripts/install.js  Crea el acceso directo nativo del sistema (npm run setup).
public/index.html   Estructura: barra superior, viewport, controles de zoom, chip de voz.
public/app.js       Canvas (pan/zoom/drag/resize), xterm.js por agente, difusión,
                    Web Speech API para voz, temas.
public/tutorial.js  Recorrido de coach-marks de la primera visita.
public/guide.js     Panel de Guía (flujo óptimo + membresías).
public/styles.css   Temas y componentes vía variables CSS.
assets/             Icono en PNG/.icns/.ico y el generador en Swift.
```

Reinstalar el acceso directo en cualquier momento: `npm run setup`.

## Seguridad

LIENZO abre terminales reales, así que el servidor está pensado para uso local:

- **Solo loopback** — se vincula a `127.0.0.1`, nunca a la red local. Para exponerlo
  a propósito, arranca con `HOST=0.0.0.0` (bajo tu responsabilidad).
- **Handshake WebSocket validado** — se rechazan las conexiones cuyo `Host` u `Origin`
  no sean `localhost`/`127.0.0.1` (o, si arrancas con un `HOST` no-loopback, las
  direcciones reales de tu máquina), lo que bloquea el *cross-site WebSocket hijacking*
  (una web maliciosa abriendo `ws://localhost:3000`) y el *DNS rebinding*.

Usa las suscripciones de IA que ya tengas: cada CLI se autentica con su propia cuenta,
igual que en un terminal normal. Sin suscripción mensual: es tuyo, corre en tu máquina.

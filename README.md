# LIENZO ◩

**Comanda un ejército de agentes de IA en un solo lienzo.** Réplica funcional del sistema
que vende [cnvs.dev](https://cnvs.dev/): Claude Code, Codex, Cursor y más corriendo en
paralelo sobre un canvas infinito, dirigidos con texto o con tu voz.

Tú diriges, ellos construyen, tú publicas.

Funciona en **macOS, Windows y Linux**. Solo necesitas [Node.js 18+](https://nodejs.org).

## Instalación

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
ventana de app sin barra de navegador (Chrome/Edge en modo `--app`).

Si prefieres la terminal: `npm start` y abre <http://localhost:3000>.

> **Node.js** es el único requisito. `@lydell/node-pty` incluye binarios
> precompilados para Windows (x64/ARM), macOS y Linux, así que **no hace falta
> compilar nada** ni tener herramientas de build.

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
- **Agentes reales en paralelo** — cada tarjeta es un proceso PTY independiente con un
  terminal completo (xterm.js). Los agentes se detectan automáticamente en tu máquina:

  | Agente | Binario | Instalación |
  |---|---|---|
  | Claude Code (Anthropic) | `claude` | `npm i -g @anthropic-ai/claude-code` |
  | Codex (OpenAI/GPT) | `codex` | `npm i -g @openai/codex` |
  | Gemini (Google) | `gemini` | `npm i -g @google/gemini-cli` |
  | Copilot (GitHub) | `copilot` | `npm i -g @github/copilot` |
  | Cursor | `cursor-agent` | `curl https://cursor.com/install -fsS \| bash` |
  | Aider | `aider` | `pip install aider-install && aider-install` |
  | Shell | `$SHELL` | siempre disponible |

  Los que no estén instalados aparecen deshabilitados; instala uno y reinicia el
  servidor para activarlo. La primera vez, cada agente pide iniciar sesión con tu
  propia cuenta dentro de su tarjeta.
- **Tutorial interactivo** — se abre solo en la primera visita, o cuando quieras
  con el botón <kbd>?</kbd> de la barra: un recorrido de coach-marks con anillo
  de gradiente que se desliza entre elementos, demos en vivo (invoca un agente,
  enciende el resplandor Siri) y navegación con ←/→/Esc.
- **Guía** — el botón <kbd>Guía</kbd> abre un panel deslizante con dos pestañas:
  *Flujo óptimo* (seis pasos para coordinar varios agentes a la vez, más combos
  recomendados) y *Membresías* (cómo iniciar sesión y qué suscripción usa cada
  modelo: Claude, Codex/GPT, Gemini, Copilot).
- **Nombres de tripulación** — los agentes se llaman Marshall, Chase, Ada, Grace, Linus…
  para poder dirigirte a ellos por voz.
- **Difusión** — la barra superior envía una misma orden a todos los agentes vivos.
- **Control por voz** 🎙 — pulsa el micrófono (Chrome o Safari) y habla:
  - `«Marshall, corre los tests»` → envía la orden a ese agente
  - `«todos: describe tu estado»` → difusión a todos
  - `«nuevo agente claude»` / `«abre una terminal»` → invoca un agente
  - `«cierra a Ada»` → cierra ese agente
- **Temas** — Midnight, Carbon, Paper y Synthwave; el terminal cambia de paleta con el tema.

## Arquitectura

```
server.js           Express + WebSocket. Detección de CLIs multiplataforma y
                    multiplexado de terminales PTY (@lydell/node-pty) por conexión:
                    spawn / input / resize / kill.
scripts/open.js     Lanzador: arranca el servidor y abre el navegador en modo app
                    (Windows / macOS / Linux, sin dependencias).
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
  no sean `localhost`/`127.0.0.1`, lo que bloquea el *cross-site WebSocket hijacking*
  (una web maliciosa abriendo `ws://localhost:3000`) y el *DNS rebinding*.

Usa las suscripciones de IA que ya tengas: cada CLI se autentica con su propia cuenta,
igual que en un terminal normal. Sin suscripción mensual: es tuyo, corre en tu máquina.

# Instalar y usar LIENZO en Windows — guía paso a paso

Esta guía te lleva de cero a tener **LIENZO** abriéndose con doble clic en tu PC
con Windows 10 u 11. No hace falta saber programar. Cada paso te dice **qué app
abrir** y **qué comando escribir**.

> **Tiempo estimado:** 10 minutos (más lo que tarde tu internet en descargar).

---

## Índice

1. [Instalar Node.js](#1-instalar-nodejs)
2. [Descargar LIENZO](#2-descargar-lienzo)
3. [Instalar LIENZO](#3-instalar-lienzo)
4. [Abrir LIENZO](#4-abrir-lienzo)
5. [Conectar tus modelos de IA](#5-conectar-tus-modelos-de-ia)
6. [Modelos locales (opcional, gratis)](#6-modelos-locales-opcional-gratis)
7. [Si algo falla](#7-si-algo-falla)

---

## 1. Instalar Node.js

Node.js es el único requisito de LIENZO. Es gratis.

1. Abre tu navegador y ve a **<https://nodejs.org>**.
2. Pulsa el botón grande que dice **«LTS»** (versión recomendada). Se descargará
   un archivo `.msi` (p. ej. `node-v22.x.x-x64.msi`).
3. Abre el archivo descargado (doble clic) y pulsa **Next → Next → Install**.
   Acepta los términos y deja todas las opciones por defecto.
   - 💡 Si aparece una casilla llamada *«Automatically install the necessary
     tools…»*, puedes **dejarla sin marcar**: LIENZO no necesita compilar nada.
4. Cuando termine, pulsa **Finish**.

**Comprobar que quedó bien instalado:**

1. Pulsa la tecla **Windows**, escribe `powershell` y abre **Windows PowerShell**.
2. En la ventana azul que aparece, escribe este comando y pulsa **Enter**:

   ```powershell
   node --version
   ```

   Debe responder algo como `v22.11.0`. Si ves un número de versión, ¡listo!
   Si dice *«no se reconoce…»*, cierra PowerShell, vuelve a abrirlo y reintenta;
   si sigue igual, reinicia el PC (Windows a veces necesita reiniciar para ver
   Node en el PATH).

---

## 2. Descargar LIENZO

Tienes dos formas. La **Opción A (ZIP)** es la más fácil si no usas Git.

### Opción A — Descargar el ZIP (recomendada para empezar)

1. Ve a **<https://github.com/Gian-DS1/lienzo>** en tu navegador.
2. Pulsa el botón verde **`< > Code`** y luego **«Download ZIP»**.
3. Se descarga `lienzo-main.zip`. Ábrelo y **extrae** la carpeta a un lugar
   sencillo, por ejemplo tu carpeta de usuario:
   `C:\Users\TU-USUARIO\lienzo`.
   - ⚠️ **Importante:** NO la dejes dentro de OneDrive ni en el Escritorio
     sincronizado. Elige una carpeta local normal (como `C:\Users\TU-USUARIO\`).
     OneDrive puede bloquear archivos mientras sincroniza y causar errores.

### Opción B — Con Git (si ya lo tienes)

1. Abre **PowerShell** (tecla Windows → escribe `powershell` → Enter).
2. Ve a tu carpeta de usuario y clona el proyecto:

   ```powershell
   cd $HOME
   git clone https://github.com/Gian-DS1/lienzo.git
   ```

   Esto crea la carpeta `C:\Users\TU-USUARIO\lienzo`.

---

## 3. Instalar LIENZO

Ahora vas a instalar las piezas internas de LIENZO. **Todo esto se hace en
PowerShell.**

1. Abre **PowerShell** (tecla Windows → `powershell` → Enter).
2. **Entra en la carpeta de LIENZO.** Escribe `cd`, un espacio, y la ruta donde
   la dejaste. Si la extrajiste en tu carpeta de usuario:

   ```powershell
   cd $HOME\lienzo
   ```

   > 💡 Truco: puedes escribir `cd ` (con espacio) y luego **arrastrar la carpeta**
   > desde el Explorador de archivos a la ventana de PowerShell; pega la ruta sola.

3. **Instala.** Escribe este comando y pulsa **Enter**:

   ```powershell
   npm install
   ```

   Verás muchas líneas de texto durante 1–2 minutos. Es normal. Al terminar,
   LIENZO **crea automáticamente** un acceso directo llamado **LIENZO** en tu
   **Escritorio** y en el **menú Inicio**, y descarga el pequeño componente que
   le da su **ventana propia** (el SDK de WebView2, ~5 MB). Verás al final algo
   como:

   ```
   ✓ Acceso directo en el Escritorio
   ✓ Acceso directo en el menú Inicio
   ✓ SDK WebView2 listo en C:\Users\TU-USUARIO\lienzo\webview2
   ```

   > ¿No aparecieron los accesos directos? Ejecuta manualmente:
   > ```powershell
   > npm run setup
   > ```
   > 💡 Si en vez del ✓ del SDK WebView2 ves un `·` de aviso (por ejemplo, sin
   > internet en ese momento), no pasa nada: LIENZO lo descargará solo la próxima
   > vez que lo abras, y mientras tanto usará Edge. No tienes que hacer nada.

Ya está instalado. No necesitas volver a tocar PowerShell para usarlo.

---

## 4. Abrir LIENZO

- Busca el icono **LIENZO** (una chispa de colores) en tu **Escritorio** y haz
  **doble clic**. También puedes pulsar la tecla Windows, escribir `LIENZO` y
  pulsar Enter.
- Se abre una **ventana propia de LIENZO** — una ventana nativa de Windows con
  **WebView2** (el motor que Windows ya trae de serie): no usa ni abre ningún
  navegador. Si tu equipo no tuviera WebView2 (muy raro), LIENZO cae solo a una
  ventana de Edge sin barra de direcciones.
- Detrás, LIENZO arranca su pequeño servidor local automáticamente. No verás
  ninguna ventana negra de consola: es silencioso.

> **Nota:** el control por **voz** 🎙 no está disponible en la ventana nativa
> (es una limitación de WebView2). Si quieres usarlo, haz que LIENZO abra con
> Chrome/Edge en modo app. En **PowerShell**:
>
> ```powershell
> Add-Content -Path "$HOME\.lienzo.env" -Value 'LIENZO_WINDOW=chrome'
> ```
>
> y vuelve a abrir LIENZO. (Valores posibles: `native` —por defecto—, `chrome` o
> `browser` para el navegador por defecto.)

> **Aviso de SmartScreen / Firewall:** la primera vez, Windows puede preguntar si
> permites la app o mostrar «Windows protegió tu PC». Pulsa **«Más información» →
> «Ejecutar de todas formas»**, o **«Permitir acceso»** en el aviso del Firewall.
> LIENZO solo escucha en tu propia máquina (`127.0.0.1`), nunca en la red.

---

## 5. Conectar tus modelos de IA

Cada agente (Claude, Codex, Gemini, Copilot) usa **tu propia cuenta**. Los botones
de la barra superior que aparezcan **atenuados** son CLIs que aún no tienes
instalados. Para instalarlos, abre **PowerShell** y ejecuta la línea que
corresponda (puedes instalar solo los que uses):

| Agente | Comando (en PowerShell) |
|---|---|
| Claude Code (Anthropic) | `npm i -g @anthropic-ai/claude-code` |
| Codex (OpenAI/GPT) | `npm i -g @openai/codex` |
| Gemini (Google) | `npm i -g @google/gemini-cli` |
| Copilot (GitHub) | `npm i -g @github/copilot` |

Después de instalar uno, **cierra la ventana de LIENZO y vuelve a abrirla** (doble
clic en el acceso directo): el botón del agente aparecerá activo.

Para saber **qué verás al iniciar sesión en cada uno** (pantallas, código de
dispositivo, qué plan necesitas), abre LIENZO y pulsa **Guía → Membresías**: hay
un paso a paso detallado de cada proveedor.

### Claves de API (y el caso de Gemini)

Algunos agentes usan una **clave de API** en vez de (o además de) iniciar sesión
en el navegador. En LIENZO se ponen en un archivo llamado **`.lienzo.env`** dentro
de tu carpeta de usuario; LIENZO se las pasa a todos los agentes al arrancar.

> ⚠️ **Gemini, importante (julio 2026):** Google **retiró el inicio de sesión con
> cuenta individual** en Gemini CLI. Si eliges «Sign in with Google» verás el error
> *«This client is no longer supported…»*. La vía que **sí funciona** es una clave
> de API gratuita:
>
> 1. Entra en **<https://aistudio.google.com/apikey>** con tu cuenta de Google y
>    pulsa **«Create API key»**. Copia la clave.
> 2. Abre **PowerShell** y crea el archivo con tu clave (pega la tuya entre las
>    comillas):
>
>    ```powershell
>    Add-Content -Path "$HOME\.lienzo.env" -Value 'GEMINI_API_KEY=pega_tu_clave_aqui'
>    ```
>
>    > Se hace por PowerShell porque el Explorador de Windows no deja crear con
>    > facilidad archivos que empiezan por punto (`Add-Content` crea el archivo si
>    > no existe). Para **ver o editar** el archivo luego, o cambiar la clave:
>    > `notepad "$HOME\.lienzo.env"`.
> 3. **Cierra y vuelve a abrir LIENZO.** En la tarjeta de Gemini elige la opción
>    **«2. Use Gemini API Key»** y pulsa Enter. Listo.

El mismo archivo `.lienzo.env` admite otras variables (una por línea, formato
`CLAVE=valor`) para cualquier agente que necesite una.

---

## 6. Modelos locales (opcional, gratis)

Puedes correr modelos de IA **en tu propio PC**, gratis y sin cuenta, con Ollama:

1. Ve a **<https://ollama.com/download>** y descarga el instalador de Windows.
   Ábrelo e instálalo (siguiente, siguiente).
2. Abre **PowerShell** y descarga un modelo. Por ejemplo:

   ```powershell
   ollama pull llama3
   ```

   (Para programar van muy bien `qwen2.5-coder` o `deepseek-coder-v2`; ligeros:
   `phi3`, `mistral`.)
3. Abre LIENZO, pulsa el botón **Ollama** (lleva el distintivo `local`), elige el
   modelo de la lista y listo.

Más detalle en la app: **Guía → Local**.

---

## 7. Si algo falla

**«node no se reconoce como un comando»**
Node.js no quedó en el PATH. Cierra y reabre PowerShell. Si persiste, reinicia el
PC. Si aún falla, reinstala Node.js desde <https://nodejs.org> con las opciones por
defecto.

**El acceso directo no hace nada / se cierra al instante**
Abre PowerShell, entra en la carpeta (`cd $HOME\lienzo`) y arranca a mano para ver
el mensaje de error:

```powershell
npm start
```

Luego abre tu navegador en <http://localhost:3000>. Si `npm start` dice que el
**puerto 3000 está en uso**, es que LIENZO ya está abierto (búscalo en la barra de
tareas) o quedó un proceso previo; ciérralo, o arranca en otro puerto:

```powershell
$env:PORT=3001; npm start
```

**La ventana de LIENZO no aparece (o parpadea y se cierra)**
LIENZO abre su ventana propia con WebView2. Si tu Windows no lo tuviera, debería
caer solo a Edge; si aun así no ves nada, fuerza el modo navegador y vuelve a abrir:

```powershell
Add-Content -Path "$HOME\.lienzo.env" -Value 'LIENZO_WINDOW=chrome'
```

Para volver a la ventana nativa luego, borra esa línea del archivo
(`notepad "$HOME\.lienzo.env"`). Si quieres reinstalar el componente de la ventana
(el SDK de WebView2), ejecuta:

```powershell
node scripts\fetch-webview2.js
```

Casi todos los Windows 10/11 traen WebView2 de fábrica; si el tuyo no, se instala
gratis desde el «Evergreen Runtime» de Microsoft (busca «WebView2 Runtime» en
<https://developer.microsoft.com/microsoft-edge/webview2/>).

**Un agente muere con un error nada más abrirse**
Asegúrate de haberlo instalado (sección 5) y de haber **reiniciado LIENZO** después.
El log del servidor está en `%TEMP%\lienzo.log`; ábrelo con el Bloc de notas para
ver detalles:

```powershell
notepad $env:TEMP\lienzo.log
```

**Quiero mover la carpeta de LIENZO**
Los accesos directos apuntan a la ubicación actual. Si mueves la carpeta, vuelve a
ejecutar `npm run setup` desde la nueva ubicación para regenerarlos.

**Reinstalar el acceso directo en cualquier momento**

```powershell
cd $HOME\lienzo
npm run setup
```

---

¿Todo listo? Vuelve al [README](../README.md) para ver todo lo que LIENZO puede
hacer (canvas infinito, control por voz, difusión de órdenes, temas…).

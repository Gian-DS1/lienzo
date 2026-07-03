/* LIENZO — panel de Guía (flujo óptimo multi-agente + membresías de LLM) */
'use strict';

(() => {
  // -------------------------------------------------------------- contenido
  const WORKFLOW = [
    {
      icon: '①',
      title: 'Reparte por rol, no por archivo',
      body: 'Da a cada agente una responsabilidad clara en vez de trocear un mismo ' +
        'fichero entre varios. Un patrón que funciona: <b>un constructor</b> que ' +
        'implementa, <b>un probador</b> que escribe y corre los tests, y <b>un ' +
        'revisor</b> que integra y critica. Así evitas que dos agentes editen las ' +
        'mismas líneas a la vez.',
    },
    {
      icon: '②',
      title: 'Alinea con una difusión inicial',
      body: 'Antes de repartir, usa la barra <b>«Ordena a todos»</b> para darles el ' +
        'mismo contexto: el objetivo, las restricciones y dónde está el código. ' +
        'Un minuto de contexto compartido ahorra diez de trabajo descoordinado.',
    },
    {
      icon: '③',
      title: 'Construyan en paralelo, integra en serie',
      body: 'Deja que varios agentes avancen a la vez —ese es el superpoder del ' +
        'lienzo— pero que <b>solo uno</b> haga el merge/commit final. La ' +
        'integración en serie evita conflictos y mantiene una única fuente de verdad.',
    },
    {
      icon: '④',
      title: 'Elige el modelo por su fortaleza',
      body: 'No todos rinden igual en cada tarea. Reparte según el punto fuerte de ' +
        'cada uno (ver la pestaña <b>Membresías</b>) y contrasta: pide la misma ' +
        'solución a dos modelos y quédate con la mejor, o usa uno para escribir y ' +
        'otro para revisar en frío.',
    },
    {
      icon: '⑤',
      title: 'Aísla a cada agente',
      body: 'Trabaja con cada agente en su propio directorio o rama de git ' +
        '(<code>git worktree</code> es ideal). Si dos comparten carpeta y editan a ' +
        'la vez, se pisan. Arrastra las tarjetas para agruparlas por tarea y no ' +
        'perder de vista quién hace qué.',
    },
    {
      icon: '⑥',
      title: 'Verifica antes de publicar',
      body: 'Que un agente independiente ejecute la prueba real (tests, build, la app ' +
        'corriendo) antes de dar algo por terminado. «Funciona» solo cuenta cuando ' +
        'otro lo comprobó, no cuando quien lo escribió lo afirma.',
    },
  ];

  const COMBOS = [
    { tag: 'Función nueva', text: 'Claude construye · Codex escribe los tests · Gemini revisa el diseño de la API.' },
    { tag: 'Bug difícil', text: 'Pide la causa raíz a Claude y a Codex por separado; compara hipótesis y arregla con la que convenza.' },
    { tag: 'Refactor grande', text: 'Un agente por módulo, cada uno en su rama; un revisor final integra y corre la suite completa.' },
  ];

  const PROVIDERS = [
    {
      color: '#D97757',
      name: 'Claude Code',
      vendor: 'Anthropic',
      strength: 'Razonamiento largo, refactors amplios y seguir instrucciones complejas.',
      steps: [
        'Pulsa <b>Claude Code</b>. La tarjeta muestra <i>«Welcome to Claude Code»</i> y te pide elegir un <b>tema</b> (Dark/Light): muévete con ↑↓ y pulsa <kbd>Enter</kbd>.',
        'Aparece <i>«Select login method»</i>. Elige <b>1. Claude account with subscription</b> (o <b>2. Anthropic Console</b> si pagas por API) y <kbd>Enter</kbd>.',
        'Se abre tu navegador en <code>claude.ai</code>. Inicia sesión y pulsa <b>Authorize</b>.',
        'Vuelve a la tarjeta: verás <i>«Login successful»</i> y el prompt listo. Ya puedes escribir tu primera instrucción.',
      ],
      plans: [
        'Suscripción <b>Claude Pro / Max / Team / Enterprise</b> (recomendado, sin costo por uso).',
        'Cuenta <b>Anthropic Console</b> con facturación por API.',
      ],
      install: 'npm i -g @anthropic-ai/claude-code',
    },
    {
      color: '#10A37F',
      name: 'Codex',
      vendor: 'OpenAI · GPT',
      strength: 'Generación de código rápida y precisa; buen compañero para tests.',
      steps: [
        'Pulsa <b>Codex</b>. La tarjeta muestra <i>«Welcome to Codex»</i> y dos opciones.',
        'Elige <b>«Sign in with ChatGPT»</b> y pulsa <kbd>Enter</kbd>: se abre el navegador.',
        'Inicia sesión con tu cuenta de <b>ChatGPT</b> (Plus/Pro/Team) y pulsa <b>Allow</b>.',
        'Vuelve a la tarjeta: verás <i>«Signed in»</i> y el prompt de Codex. ¿Prefieres API? Elige <b>«connect an API key»</b>.',
      ],
      plans: [
        'Plan <b>ChatGPT Plus / Pro / Team</b> incluye Codex.',
        'O una <b>API key de OpenAI</b> para facturación por uso.',
      ],
      install: 'npm i -g @openai/codex',
    },
    {
      color: '#4285F4',
      name: 'Gemini',
      vendor: 'Google',
      strength: 'Contexto enorme (millones de tokens) y multimodal.',
      steps: [
        '⚠ <b>«Sign in with Google»</b> para cuentas individuales fue <b>retirado por Google</b> ' +
          '(julio 2026): da <i>«This client is no longer supported…»</i> y sugiere migrar a ' +
          'Antigravity. Usa una <b>API key</b>: sigue funcionando y es gratis.',
        'Consigue tu clave en <code>aistudio.google.com/apikey</code> con tu cuenta de Google.',
        'Crea el archivo <code>~/.lienzo.env</code> con la línea <code>GEMINI_API_KEY=tu_clave</code> ' +
          'y reinicia LIENZO (así la ven los agentes aunque abras LIENZO desde el Dock).',
        'Pulsa <b>Gemini</b> y en el menú de acceso elige <b>«Use Gemini API Key»</b> y <kbd>Enter</kbd>. Listo.',
      ],
      plans: [
        '<b>API key de AI Studio</b> (gratuita, nivel generoso) — la vía recomendada hoy.',
        'Cuentas de pago <b>Code Assist Standard/Enterprise</b> o <b>Vertex AI</b> siguen soportando login corporativo.',
      ],
      install: 'npm i -g @google/gemini-cli',
    },
    {
      color: '#8957E5',
      name: 'Copilot',
      vendor: 'GitHub',
      strength: 'Integración con tu contexto de GitHub (issues, PRs, repos).',
      steps: [
        'Pulsa <b>Copilot</b>. Si no has entrado, escribe <code>/login</code> y <kbd>Enter</kbd>.',
        'La tarjeta muestra un <b>código de dispositivo</b> (p. ej. <code>AB12-CD34</code>) y la URL <code>github.com/login/device</code>.',
        'Abre esa URL, pega el código y autoriza con tu cuenta de <b>GitHub</b> (con suscripción Copilot activa).',
        'Vuelve a la tarjeta: verás <i>«Signed in as tu-usuario»</i>. Listo.',
      ],
      plans: [
        'Requiere una suscripción <b>GitHub Copilot</b> (Free, Pro, Business o Enterprise).',
        'El plan Free da un número limitado de peticiones al mes.',
      ],
      install: 'npm i -g @github/copilot',
    },
  ];

  const LOCAL_STEPS = [
    {
      icon: '①',
      title: 'Instala Ollama',
      body: 'Descárgalo de <code>ollama.com/download</code> (Windows, macOS y Linux). ' +
        'Es gratis y corre los modelos <b>en tu propia máquina</b>: sin cuenta, sin ' +
        'conexión y sin que tus datos salgan de tu equipo.',
    },
    {
      icon: '②',
      title: 'Descarga un modelo',
      body: 'En una terminal: <code>ollama pull llama3</code>. Para programar van muy ' +
        'bien <code>qwen2.5-coder</code>, <code>deepseek-coder-v2</code> o ' +
        '<code>codellama</code>; ligeros y rápidos: <code>phi3</code>, <code>mistral</code>.',
    },
    {
      icon: '③',
      title: 'Ábrelo en LIENZO',
      body: 'Pulsa el botón <b>Ollama</b> (lleva el distintivo <span class="local-chip">local</span>), ' +
        'elige un modelo de la lista o escribe su nombre, y aparece como una tarjeta más. ' +
        'Puedes correr varios modelos locales y en la nube a la vez en el mismo lienzo.',
    },
    {
      icon: '④',
      title: 'Elige según tu equipo',
      body: 'Los modelos grandes necesitan más memoria: como regla, ~8&nbsp;GB de RAM para ' +
        'modelos de 7B, ~16&nbsp;GB para 13B. Si va lento, prueba uno más pequeño o una ' +
        'variante cuantizada (p. ej. <code>llama3:8b-instruct-q4_0</code>).',
    },
  ];

  // --- Orquestar: qué agente por tarea, ahorro de tokens, prompts, comandos ---
  const PICK = [
    { tag: 'Refactor amplio · specs largas',
      text: '<b>Claude Code</b> — razona sobre muchos archivos y sigue instrucciones ' +
        'complejas. Sube a Opus (o el modelo tope) solo para lo difícil; Sonnet basta para el día a día.' },
    { tag: 'Código y tests, rápido',
      text: '<b>Codex</b> (GPT) — generación ágil y precisa; buen compañero para cubrir con ' +
        'pruebas lo que otro implementó.' },
    { tag: 'Leer un repo entero de golpe',
      text: '<b>Gemini</b> — contexto de millones de tokens y barato por token: ideal para ' +
        '«entiende todo este proyecto y resúmelo».' },
    { tag: 'Contexto de GitHub',
      text: '<b>Copilot</b> — conectado a tus issues, PRs y repositorios.' },
    { tag: 'Repetitivo · privado · gratis',
      text: '<b>Ollama local</b> — sin costo ni conexión. Para código: <code>qwen2.5-coder</code> ' +
        'o <code>deepseek-coder-v2</code>.' },
    { tag: 'Bug difícil',
      text: 'Pide la <b>causa raíz</b> a dos modelos en paralelo (p. ej. Claude y Codex) y ' +
        'quédate con la hipótesis que convenza.' },
  ];

  const SAVE = [
    {
      icon: '◆',
      title: 'Baja de modelo cuando la tarea es fácil',
      body: 'Con <code>/model</code> elige uno pequeño (Haiku) para lo trivial, uno equilibrado ' +
        '(Sonnet) para el día a día, y reserva el más capaz (Opus o el tope de gama) para el ' +
        'razonamiento duro. Pagar el modelo caro por renombrar variables es tirar tokens.',
    },
    {
      icon: '◆',
      title: 'Limpia el contexto entre tareas',
      body: 'El historial se reenvía —y se cobra— en cada mensaje. Usa <code>/clear</code> al ' +
        'cambiar de tema, y <code>/compact</code> para condensar una sesión larga que sigue ' +
        'siendo relevante.',
    },
    {
      icon: '◆',
      title: 'Da los archivos, no los busques',
      body: 'Menciona rutas con <code>@src/archivo</code> para que el agente no gaste tokens ' +
        'explorando el repo a ciegas.',
    },
    {
      icon: '◆',
      title: 'Fija el contexto una sola vez',
      body: 'Un <code>CLAUDE.md</code> (créalo con <code>/init</code>) guarda convenciones, ' +
        'comandos y estructura del proyecto, para no repetirlos en cada prompt.',
    },
    {
      icon: '◆',
      title: 'Planifica antes de editar',
      body: 'En cambios grandes, pide un plan antes de tocar código (modo plan). Evita trabajo ' +
        'desechado y re-prompts caros por ir a ciegas.',
    },
    {
      icon: '◆',
      title: 'Descarga lo pesado a lo barato',
      body: 'Usa Gemini o un modelo local para leer y resumir montañas de código; reserva el ' +
        'modelo caro para decidir y escribir lo fino.',
    },
  ];

  const PROMPTS = [
    { tag: 'Objetivo + límites + criterio',
      text: '«Implementa X en <code>@archivo</code>. No cambies la API pública. Hecho = tests ' +
        'verdes y <code>npm run build</code> sin errores.»' },
    { tag: 'Contexto primero',
      text: 'Usa «Ordena a todos» para dar objetivo, restricciones y dónde está el código antes ' +
        'de repartir roles. Un minuto de contexto compartido ahorra diez de descoordinación.' },
    { tag: 'Rol explícito',
      text: '«Eres el <b>probador</b>: escribe y corre los tests de lo que hizo Marshall; no ' +
        'implementes tú.»' },
    { tag: 'Verificación en frío',
      text: '«Revisa este diff y busca solo bugs reales, con el caso que los dispara.» Que quien ' +
        'revisa no sea quien escribió.' },
  ];

  const COMMANDS = [
    { cmd: '/clear', when: 'Empezar una tarea nueva sin arrastrar (ni pagar) el historial anterior.' },
    { cmd: '/compact', when: 'Condensar una sesión larga que aún necesitas mantener.' },
    { cmd: '/model', when: 'Subir o bajar de modelo según la dificultad y el costo.' },
    { cmd: '/init', when: 'Generar un CLAUDE.md con el contexto del repo.' },
    { cmd: '/cost', when: 'Ver los tokens y el gasto de la sesión.' },
    { cmd: '/review', when: 'Revisar un PR o los cambios pendientes.' },
    { cmd: 'Esc', when: 'Interrumpir para corregir el rumbo sin relanzar el prompt.' },
    { cmd: '«ultrathink»', when: 'Subir el presupuesto de razonamiento en algo difícil (cuesta más: con criterio).' },
  ];

  // ------------------------------------------------------------------ DOM
  const scrim = el('div', 'guide-scrim hidden');
  const panel = el('aside', 'guide-panel hidden');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Guía de LIENZO');
  document.body.append(scrim, panel);

  panel.innerHTML = `
    <div class="guide-head">
      <div class="guide-title"><span class="guide-spark">✦</span><h2>Guía de LIENZO</h2></div>
      <button class="guide-close" title="Cerrar">✕</button>
    </div>
    <div class="guide-tabs" role="tablist">
      <button class="guide-tab on" data-tab="flow" role="tab">Flujo óptimo</button>
      <button class="guide-tab" data-tab="orchestrate" role="tab">Orquestar</button>
      <button class="guide-tab" data-tab="plans" role="tab">Membresías</button>
      <button class="guide-tab" data-tab="local" role="tab">Local</button>
    </div>
    <div class="guide-body">
      <section class="guide-pane" data-pane="flow">
        <p class="guide-lead">Seis pasos para sacar el máximo a varios agentes trabajando a la vez.</p>
        <ol class="guide-steps">
          ${WORKFLOW.map((s) => `
            <li class="guide-step">
              <span class="guide-step-icon">${s.icon}</span>
              <div><h3>${s.title}</h3><p>${s.body}</p></div>
            </li>`).join('')}
        </ol>
        <h3 class="guide-subhead">Combos recomendados</h3>
        <div class="guide-combos">
          ${COMBOS.map((c) => `
            <div class="guide-combo"><span class="guide-combo-tag">${c.tag}</span><p>${c.text}</p></div>`).join('')}
        </div>
      </section>

      <section class="guide-pane hidden" data-pane="orchestrate">
        <p class="guide-lead">Cómo repartir el trabajo, <b>elegir el modelo por la tarea</b> y
          gastar menos tokens. Los comandos son de <b>Claude Code</b>; los demás agentes tienen
          los suyos (mira su <code>/help</code>).</p>

        <h3 class="guide-subhead">Elige el agente por la tarea</h3>
        <div class="guide-combos">
          ${PICK.map((c) => `
            <div class="guide-combo"><span class="guide-combo-tag">${c.tag}</span><p>${c.text}</p></div>`).join('')}
        </div>

        <h3 class="guide-subhead">Gasta menos tokens (sobre todo en Claude Code)</h3>
        <ol class="guide-steps">
          ${SAVE.map((s) => `
            <li class="guide-step">
              <span class="guide-step-icon">${s.icon}</span>
              <div><h3>${s.title}</h3><p>${s.body}</p></div>
            </li>`).join('')}
        </ol>

        <h3 class="guide-subhead">Prompts que rinden</h3>
        <div class="guide-combos">
          ${PROMPTS.map((c) => `
            <div class="guide-combo"><span class="guide-combo-tag">${c.tag}</span><p>${c.text}</p></div>`).join('')}
        </div>

        <h3 class="guide-subhead">Comandos útiles · Claude Code</h3>
        <div class="guide-cmds">
          ${COMMANDS.map((c) => `
            <div class="guide-cmd"><code>${c.cmd}</code><span>${c.when}</span></div>`).join('')}
        </div>
        <p class="guide-foot">Regla de oro del costo: <b>modelo pequeño por defecto, grande solo
          cuando la tarea lo pida</b>, y <code>/clear</code> al cambiar de tema. Reparte por rol
          (constructor · probador · revisor) y deja que <b>uno solo</b> integre.</p>
      </section>

      <section class="guide-pane hidden" data-pane="plans">
        <p class="guide-lead">Cada agente usa <b>tu propia cuenta</b>. La primera vez te pedirá
          iniciar sesión dentro de su tarjeta; no hay costo extra de LIENZO.</p>
        <div class="guide-providers">
          ${PROVIDERS.map((p) => `
            <div class="guide-provider">
              <div class="guide-provider-head">
                <span class="guide-provider-dot" style="background:${p.color};color:${p.color}"></span>
                <div><b>${p.name}</b><span class="guide-provider-vendor">${p.vendor}</span></div>
              </div>
              <p class="guide-provider-strength"><span class="guide-label">Fuerte en</span> ${p.strength}</p>
              <div class="guide-provider-block">
                <span class="guide-label">Paso a paso · qué verás</span>
                <ol class="guide-provider-steps">${p.steps.map((x) => `<li>${x}</li>`).join('')}</ol>
              </div>
              <div class="guide-provider-block">
                <span class="guide-label">Qué necesitas</span>
                <ul class="guide-provider-plans">${p.plans.map((x) => `<li>${x}</li>`).join('')}</ul>
              </div>
              <p class="guide-provider-install"><span class="guide-label">Instalar</span> <code>${p.install}</code></p>
            </div>`).join('')}
        </div>
        <p class="guide-foot">¿Un botón sale atenuado? Ese CLI no está instalado. Cópiate su línea
          <code>npm i -g …</code>, ejecútala en una terminal y reinicia LIENZO para activarlo.
          ¿Quieres modelos <b>gratis y sin cuenta</b>? Mira la pestaña <b>Local</b>.</p>
      </section>

      <section class="guide-pane hidden" data-pane="local">
        <p class="guide-lead">Corre modelos <b>en tu propia máquina</b> con <b>Ollama</b>:
          gratis, privado y sin conexión. Cuatro pasos.</p>
        <ol class="guide-steps">
          ${LOCAL_STEPS.map((s) => `
            <li class="guide-step">
              <span class="guide-step-icon">${s.icon}</span>
              <div><h3>${s.title}</h3><p>${s.body}</p></div>
            </li>`).join('')}
        </ol>
        <p class="guide-foot">El botón <b>Ollama</b> aparece activo en cuanto lo instalas.
          Si no ves modelos en la lista, descarga uno con <code>ollama pull &lt;modelo&gt;</code>
          y vuelve a abrir el selector.</p>
      </section>
    </div>`;

  // ------------------------------------------------------------- comportamiento
  function el(tag, className) {
    const n = document.createElement(tag);
    n.className = className;
    return n;
  }

  let open = false;
  function openPanel() {
    if (open) return;
    open = true;
    scrim.classList.remove('hidden');
    panel.classList.remove('hidden');
    requestAnimationFrame(() => {
      scrim.classList.add('shown');
      panel.classList.add('shown');
    });
  }
  function closePanel() {
    if (!open) return;
    open = false;
    scrim.classList.remove('shown');
    panel.classList.remove('shown');
    setTimeout(() => {
      scrim.classList.add('hidden');
      panel.classList.add('hidden');
    }, 380);
  }

  panel.querySelector('.guide-close').onclick = closePanel;
  scrim.onclick = closePanel;
  document.getElementById('guide-btn').addEventListener('click', () => (open ? closePanel() : openPanel()));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) closePanel();
  });

  panel.querySelectorAll('.guide-tab').forEach((tab) => {
    tab.onclick = () => {
      panel.querySelectorAll('.guide-tab').forEach((t) => t.classList.toggle('on', t === tab));
      const which = tab.dataset.tab;
      panel.querySelectorAll('.guide-pane').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== which));
      panel.querySelector('.guide-body').scrollTop = 0;
    };
  });
})();

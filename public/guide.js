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
      login: 'Dentro de la tarjeta escribe <code>/login</code> y elige tu método.',
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
      login: 'Al abrirlo, elige <b>«Sign in with ChatGPT»</b> y autoriza en el navegador.',
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
      login: 'Al abrirlo, inicia sesión con tu <b>cuenta de Google</b> en el navegador.',
      plans: [
        '<b>Gemini Code Assist</b> tiene un nivel gratuito generoso con tu cuenta Google.',
        'O exporta una <b>API key</b> de AI Studio: <code>export GEMINI_API_KEY=…</code>',
      ],
      install: 'npm i -g @google/gemini-cli',
    },
    {
      color: '#8957E5',
      name: 'Copilot',
      vendor: 'GitHub',
      strength: 'Integración con tu contexto de GitHub (issues, PRs, repos).',
      login: 'Dentro de la tarjeta usa <code>/login</code> y autoriza con tu cuenta de GitHub.',
      plans: [
        'Requiere una suscripción <b>GitHub Copilot</b> (Free, Pro, Business o Enterprise).',
        'El plan Free da un número limitado de peticiones al mes.',
      ],
      install: 'npm i -g @github/copilot',
    },
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
      <button class="guide-tab" data-tab="plans" role="tab">Membresías</button>
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
              <p class="guide-provider-login"><span class="guide-label">Iniciar sesión</span> ${p.login}</p>
              <ul class="guide-provider-plans">${p.plans.map((x) => `<li>${x}</li>`).join('')}</ul>
              <p class="guide-provider-install"><span class="guide-label">Instalar</span> <code>${p.install}</code></p>
            </div>`).join('')}
        </div>
        <p class="guide-foot">¿Un botón sale atenuado? Ese CLI no está instalado. Cópiate su línea
          <code>npm i -g …</code>, ejecútala en una terminal y reinicia LIENZO para activarlo.</p>
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

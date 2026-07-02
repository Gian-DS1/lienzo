/* LIENZO — tutorial interactivo (coach marks estilo Apple) */
'use strict';

(() => {
  const DONE_KEY = 'lienzo-tour-v1';

  const STEPS = [
    {
      target: null,
      title: 'Bienvenido a LIENZO',
      body: 'Un lienzo, un ejército de agentes de IA trabajando en paralelo. ' +
        'Este recorrido dura un minuto — te enseño lo esencial.',
      cta: 'Empezar',
    },
    {
      target: '#spawn-buttons',
      title: 'Invoca a tus agentes',
      body: 'Cada botón lanza un agente real en su propia terminal: <b>Claude Code</b>, ' +
        '<b>Codex</b> (GPT), <b>Gemini</b>, <b>Copilot</b>… Los atenuados no están ' +
        'instalados en tu Mac; instálalos y aparecerán solos. La primera vez, cada ' +
        'agente te pedirá iniciar sesión con tu propia cuenta dentro de su tarjeta.',
    },
    {
      target: '.agent-card',
      title: 'La tarjeta del agente',
      body: 'Es una terminal completa: haz clic dentro y escribe. Arrástrala por su ' +
        'cabecera, cambia su tamaño desde la esquina inferior derecha y ciérrala con ' +
        'el <span class="tour-dot-red"></span> rojo. Mientras el agente trabaja, su ' +
        'borde se enciende con un resplandor.',
      onEnter(api) {
        if (api.agents.size === 0) api.spawnAgent('shell');
      },
    },
    {
      target: '#zoom-controls',
      title: 'Muévete por el lienzo',
      body: 'Arrastra el fondo para desplazarte y usa la rueda o el trackpad. ' +
        'Con <kbd>⌘</kbd> + rueda haces zoom hacia el cursor, o usa estos botones. ' +
        '<b>100%</b> restablece la vista.',
    },
    {
      target: '#broadcast-form',
      title: 'Dirige a todos a la vez',
      body: 'Escribe aquí una orden y se envía a todos los agentes vivos del lienzo ' +
        'al mismo tiempo. Ideal para «corre los tests» o «describe tu estado».',
    },
    {
      target: '#mic-btn',
      title: 'Comanda con tu voz',
      body: 'Pulsa el micrófono y habla:<br>' +
        '<code>«Marshall, corre los tests»</code><br>' +
        '<code>«todos: describan su estado»</code><br>' +
        '<code>«nuevo agente gemini»</code> · <code>«cierra a Ada»</code>',
      onEnter(api) { api.siriGlow.classList.add('on'); },
      onLeave(api) { api.siriGlow.classList.remove('on'); },
    },
    {
      target: '#theme-select',
      title: 'Apariencia',
      body: 'Cuatro temas de vidrio: Midnight, Carbon, Paper y Synthwave. ' +
        'Los terminales adaptan su paleta al instante.',
    },
    {
      target: null,
      title: 'Tú diriges, ellos construyen, tú publicas',
      body: 'Eso es todo. Reparte el trabajo entre varios agentes y míralos avanzar ' +
        'en paralelo. Puedes reabrir este recorrido cuando quieras con el botón ' +
        '<b>?</b> de la barra.',
      cta: 'A crear ✦',
    },
  ];

  let idx = -1;
  let active = false;

  const ring = el('div', 'tour-ring hidden');
  const card = el('div', 'tour-card hidden');
  document.body.append(ring, card);

  function el(tag, className) {
    const n = document.createElement(tag);
    n.className = className;
    return n;
  }

  function api() {
    return window.LIENZO;
  }

  function start() {
    if (active) return;
    active = true;
    idx = -1;
    ring.classList.remove('hidden');
    card.classList.remove('hidden');
    next(1);
  }

  function finish() {
    const step = STEPS[idx];
    if (step && step.onLeave) step.onLeave(api());
    active = false;
    localStorage.setItem(DONE_KEY, '1');
    ring.classList.add('leaving');
    card.classList.add('leaving');
    setTimeout(() => {
      ring.classList.add('hidden');
      card.classList.add('hidden');
      ring.classList.remove('leaving');
      card.classList.remove('leaving');
    }, 320);
  }

  function next(dir) {
    const prev = STEPS[idx];
    if (prev && prev.onLeave) prev.onLeave(api());
    idx += dir;
    if (idx < 0) idx = 0;
    if (idx >= STEPS.length) return finish();
    const step = STEPS[idx];
    if (step.onEnter) step.onEnter(api());
    render();
  }

  function render() {
    const step = STEPS[idx];
    card.innerHTML = `
      <div class="tour-head"><span class="tour-spark">✦</span><h2>${step.title}</h2></div>
      <p>${step.body}</p>
      <div class="tour-footer">
        <button class="tour-skip">Saltar</button>
        <div class="tour-dots">${STEPS.map((_, i) =>
          `<span class="${i === idx ? 'on' : ''}"></span>`).join('')}</div>
        <div class="tour-nav">
          ${idx > 0 ? '<button class="tour-back">Atrás</button>' : ''}
          <button class="tour-next">${step.cta || (idx === STEPS.length - 1 ? 'Listo' : 'Siguiente')}</button>
        </div>
      </div>`;
    card.querySelector('.tour-skip').onclick = finish;
    card.querySelector('.tour-next').onclick = () => next(1);
    const back = card.querySelector('.tour-back');
    if (back) back.onclick = () => next(-1);
    position();
    // Reposicionar tras la animación de aparición del objetivo (p. ej. tarjeta recién invocada)
    setTimeout(position, 650);
  }

  function position() {
    if (!active) return;
    const step = STEPS[idx];
    const target = step.target ? document.querySelector(step.target) : null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 9;

    if (target) {
      const r = target.getBoundingClientRect();
      ring.style.left = `${r.left - pad}px`;
      ring.style.top = `${r.top - pad}px`;
      ring.style.width = `${r.width + pad * 2}px`;
      ring.style.height = `${r.height + pad * 2}px`;
      ring.style.borderRadius = '20px';
    } else {
      // Sin objetivo: el anillo colapsa al centro y la sombra atenúa todo
      ring.style.left = `${vw / 2}px`;
      ring.style.top = `${vh / 2}px`;
      ring.style.width = '0px';
      ring.style.height = '0px';
      ring.style.borderRadius = '50%';
    }

    // Medir la tarjeta ya renderizada y colocarla cerca del objetivo
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    let x, y;
    if (!target) {
      x = (vw - cw) / 2;
      y = (vh - ch) / 2;
    } else {
      const r = target.getBoundingClientRect();
      x = Math.min(Math.max(12, r.left + r.width / 2 - cw / 2), vw - cw - 12);
      y = r.bottom + pad + 18;
      if (y + ch > vh - 12) y = r.top - pad - ch - 18;
      if (y < 12) y = 12;
    }
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;
  }

  window.addEventListener('resize', position);
  window.addEventListener('keydown', (e) => {
    if (!active) return;
    if (e.key === 'Escape') finish();
    else if (e.key === 'ArrowRight') next(1);
    else if (e.key === 'ArrowLeft') next(-1);
  });

  document.getElementById('help-btn').addEventListener('click', start);

  // Primer arranque: espera a que la barra cargue y lanza el recorrido
  if (!localStorage.getItem(DONE_KEY)) {
    setTimeout(start, 700);
  }
})();

/** Ten confirmed units: prerequisites, eight lists, final configuration. */
export function renderInstallationProgress() {
  return `<section data-install-progress-panel hidden aria-labelledby="install-progress-heading">
    <h2 id="install-progress-heading">Instalação em andamento</h2>
    <p data-install-progress-label role="status" aria-live="polite">Preparando a instalação…</p>
    <progress data-install-progress max="10" aria-label="Progresso da instalação"></progress>
    <p data-install-progress-count>Verificando os pré-requisitos…</p>
    <div class="install-progress-activity" aria-hidden="true"></div>
    <p data-install-progress-elapsed>Tempo decorrido: 0 s</p>
    <p><strong>Não feche, não recarregue e não saia desta página.</strong> A criação e verificação dos campos pode levar alguns minutos. A barra avança somente quando uma etapa é confirmada.</p>
  </section>`;
}

/** DOM-only progress lifecycle. No writes, retries or inferred completion. */
export function startInstallationProgress(root, { isCurrent = () => true, clock = globalThis } = {}) {
  const panel = root.querySelector?.('[data-install-progress-panel]');
  const bar = root.querySelector?.('[data-install-progress]');
  const label = root.querySelector?.('[data-install-progress-label]');
  const count = root.querySelector?.('[data-install-progress-count]');
  const elapsed = root.querySelector?.('[data-install-progress-elapsed]');
  const now = typeof clock.now === 'function' ? () => clock.now() : () => Date.now();
  const started = now(); let active = true, timer;
  const valid = () => active && root.isConnected !== false && isCurrent() === true;
  if (panel) { panel.hidden = false; panel.setAttribute?.('aria-busy', 'true'); panel.scrollIntoView?.({ block: 'nearest' }); }
  if (bar) { bar.max = 10; bar.removeAttribute?.('value'); }
  function update(stage = {}) {
    if (!valid()) return;
    let completed;
    if (stage.phase === 'lists' && Number.isSafeInteger(stage.completed) && stage.completed >= 0 && stage.completed <= 8) completed = stage.completed + 1;
    else if (stage.phase === 'configuration') completed = 9;
    else if (stage.phase === 'complete') completed = 10;
    if (bar && completed !== undefined) bar.value = completed;
    if (count) count.textContent = completed === undefined ? 'Verificando os pré-requisitos…' : `${completed} de 10 etapas confirmadas (${completed * 10}%).`;
    if (label) label.textContent = typeof stage.message === 'string' ? stage.message : 'Instalação em andamento…';
  }
  update({message:'Preparando a instalação e verificando as dependências…'});
  const tick = () => {
    if (!valid()) { stop(); return; }
    const seconds = Math.max(0, Math.floor((now() - started) / 1000));
    if (elapsed) elapsed.textContent = `Tempo decorrido: ${seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`}. Aguardando confirmação do SharePoint.`;
  };
  if (typeof clock.setInterval === 'function') timer = clock.setInterval(tick, 1000);
  const warnBeforeLeaving = event => { if (valid()) { event.preventDefault(); event.returnValue = ''; } };
  const leave = () => stop();
  globalThis.addEventListener?.('beforeunload', warnBeforeLeaving);
  globalThis.addEventListener?.('pagehide', leave);
  function stop() {
    if (!active) return;
    active = false;
    if (timer !== undefined) clock.clearInterval?.(timer);
    globalThis.removeEventListener?.('beforeunload', warnBeforeLeaving);
    globalThis.removeEventListener?.('pagehide', leave);
    panel?.setAttribute?.('aria-busy', 'false');
  }
  return Object.freeze({ update, stop });
}

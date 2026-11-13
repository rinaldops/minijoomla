import { escapeHtml } from '../libraries/minijoomla/security/sanitize.js';
import { renderInstallationProgress, startInstallationProgress } from './progress.js';

export function renderInstallationPage(state = {}, { publicView = false } = {}) {
  const status = typeof state.status === 'string' ? state.status : 'unavailable';
  const canInstall = !publicView && (status === 'ready' || status === 'partial' && state.canResume === true);
  const message = typeof state.message === 'string' ? state.message : 'Não foi possível verificar a instalação.';
  const rows = Array.isArray(state.plan?.lists) ? state.plan.lists : [];
  const summary = rows.map(row => `<li>${escapeHtml(row.title ?? row.domain ?? '')} — ${row.exists ? 'preservada' : 'a criar'}</li>`).join('');
  const siteName = typeof state.settings?.siteName === 'string' ? state.settings.siteName : 'MINIJOOMLA';
  const siteDescription = typeof state.settings?.siteDescription === 'string' ? state.settings.siteDescription : '';
  const checks = Array.isArray(state.checks) ? state.checks.map(check => `<li>${check.ok ? 'OK' : 'Indisponível'} — ${escapeHtml(check.name)}: ${escapeHtml(check.message)}</li>`).join('') : '';
  return `<section class="minijoomla-installation" aria-labelledby="minijoomla-install-heading">
    <h1 id="minijoomla-install-heading">Instalação do MINIJOOMLA</h1>
    <p>CMS genérico Joomla-like. Site Cassiopeia e painel Atum; nenhuma extensão ou conteúdo específico será instalado automaticamente.</p>
    <p role="status" aria-live="polite" data-install-status>${escapeHtml(message)}</p>
    ${publicView ? '' : renderInstallationProgress()}
    ${checks ? `<h2>Verificação antes da instalação</h2><ul>${checks}</ul>` : ''}
    ${publicView ? '<p>O administrador deve concluir a instalação na página do painel.</p>' : `<ul>${summary}</ul>
    ${canInstall ? `<form data-install-form><label for="install-site-name">Nome do site</label><input id="install-site-name" name="siteName" maxlength="200" required value="${escapeHtml(siteName)}" autocomplete="off">
    <label for="install-site-description">Descrição</label><textarea id="install-site-description" name="siteDescription" maxlength="500">${escapeHtml(siteDescription)}</textarea>
    <p>A confirmação cria somente a infraestrutura nativa e sua configuração. Dados de exemplo, extensões e templates serão escolhidos depois. Nenhum dado existente será sobrescrito.</p>
    <label><input type="checkbox" name="confirmed" required> Confirmo a instalação da infraestrutura no site atual.</label>
    <button type="submit">${status === 'partial' ? 'Retomar instalação verificada' : 'Instalar MINIJOOMLA'}</button></form>` : '<p>Não há ação de reinstalação disponível. Verifique a instalação e os recibos antes de tentar novamente.</p>'}
    ${state.canReset ? `<form data-install-reset-form><h2>Reiniciar tentativa</h2><p>Limpa somente o diário desta instalação e ${Number.isSafeInteger(state.resetListCount) ? state.resetListCount : 0} lista(s) vazia(s) comprovadas pelos recibos. O pacote, as páginas, o SPMIDDLE e outros dados do site são preservados. Feche outras abas de instalação antes de continuar.</p><label><input type="checkbox" name="resetConfirmed" required> Confirmo o reinício desta tentativa e a remoção das listas vazias indicadas.</label><button type="submit">Reiniciar instalação</button></form>` : ''}
    <button type="button" data-install-recheck>Verificar novamente</button>`}
  </section>`;
}

export async function mountInstallationPage({ root, service, documentRef = globalThis.document, publicView = false, onInstalled } = {}) {
  if (!root || root === documentRef?.body || root === documentRef?.documentElement || typeof root.innerHTML !== 'string' || !service || typeof service.inspect !== 'function' || typeof service.install !== 'function') throw new TypeError('Instalação requer raiz dedicada e serviço.');
  let active = true, generation = 0, busy = false, progressController;
  const unload = () => { progressController?.stop(); active = false; generation++; };
  globalThis.addEventListener?.('pagehide', unload);
  const isCurrent = revision => active && root.isConnected !== false && generation === revision;
  async function transition(configuration) {
    progressController?.stop();
    active = false;
    globalThis.removeEventListener?.('pagehide', unload);
    try { await onInstalled(configuration); }
    catch {
      if (root.isConnected === false) return;
      root.innerHTML = '<section class="minijoomla-installation" role="alert"><h1>Instalação preservada</h1><p>A infraestrutura foi verificada, mas não foi possível abrir o aplicativo. Recarregue a página e verifique os recursos publicados. Não reinstale nem apague o diário.</p></section>';
    }
  }
  async function refresh(previousMessage) {
    if (!active || busy) return;
    const revision = ++generation;
    root.innerHTML = renderInstallationPage({ status: 'unavailable', message: 'Verificando a instalação…' }, { publicView });
    const state = await service.inspect({ isCurrent: () => isCurrent(revision) });
    if (!isCurrent(revision)) return;
    if (state.status === 'installed' && typeof onInstalled === 'function') { await transition(state.configuration); return; }
    root.innerHTML = renderInstallationPage(previousMessage ? { ...state, message: `${previousMessage} ${state.message ?? ''}` } : state, { publicView });
    const recheck = root.querySelector?.('[data-install-recheck]');
    recheck?.addEventListener('click', () => { if (isCurrent(revision) && !busy) refresh().catch(showError); });
    const resetForm = root.querySelector?.('[data-install-reset-form]');
    resetForm?.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy || !isCurrent(revision) || !resetForm.elements?.namedItem('resetConfirmed')?.checked || typeof service.reset !== 'function') return;
      busy = true; resetForm.querySelector('button[type="submit"]').disabled = true;
      try {
        const result = await service.reset({ confirm: true, planToken: state.plan?.token, isCurrent: () => isCurrent(revision) });
        if (!isCurrent(revision)) return;
        busy = false; await refresh(result.message);
      } catch { showError(); }
      finally { busy = false; }
    });
    const form = root.querySelector?.('[data-install-form]');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy || !isCurrent(revision) || !form.elements?.namedItem('confirmed')?.checked) return;
      const siteName = form.elements.namedItem('siteName')?.value;
      const siteDescription = form.elements.namedItem('siteDescription')?.value;
      busy = true;
      progressController = startInstallationProgress(root, { isCurrent: () => isCurrent(revision) });
      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      const installStatus = root.querySelector('[data-install-status]');
      if (installStatus) installStatus.textContent = 'Instalação em andamento. Verificando dependências; não feche nem recarregue a página…';
      try {
        const result = await service.install({ confirm: true, plan: state.plan, settings: { ...(state.settings ?? {}), siteName, siteDescription }, isCurrent: () => isCurrent(revision), onStage: stage => progressController.update(stage), onProgress(progress) {
          if (!isCurrent(revision)) return;
          progressController.update({ ...progress, message: `Lista ${progress.completed} de ${progress.total} verificada. Preparando a próxima etapa…` });
          const status = root.querySelector('[data-install-status]');
          if (status) status.textContent = typeof progress.message === 'string' ? progress.message : `Lista ${progress.completed} de ${progress.total} verificada. Instalando…`;
        } });
        if (!isCurrent(revision)) return;
        if (result.status === 'installed' && typeof onInstalled === 'function') { await transition(result.configuration); }
        else { progressController.stop(); busy = false; await refresh(result.message); }
      } catch { showError(); }
      finally { progressController?.stop(); busy = false; }
    });
  }
  function showError() {
    progressController?.stop();
    if (!active) return;
    const status = root.querySelector?.('[data-install-status]');
    if (status) status.textContent = 'Instalação interrompida. Verifique o diário e o destino; não há repetição automática.';
    const form = root.querySelector?.('[data-install-form]');
    if (form) form.querySelector('button[type="submit"]').disabled = true;
  }
  await refresh();
  return Object.freeze({ stop() { unload(); globalThis.removeEventListener?.('pagehide', unload); }, refresh });
}

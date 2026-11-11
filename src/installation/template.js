import { escapeHtml } from '../libraries/minijoomla/security/sanitize.js';

export function renderInstallationPage(state = {}, { publicView = false } = {}) {
  const status = typeof state.status === 'string' ? state.status : 'unavailable';
  const canInstall = !publicView && (status === 'ready' || status === 'partial' && state.canResume === true);
  const message = typeof state.message === 'string' ? state.message : 'Não foi possível verificar a instalação.';
  const rows = Array.isArray(state.plan?.lists) ? state.plan.lists : [];
  const summary = rows.map(row => `<li>${escapeHtml(row.title ?? row.domain ?? '')} — ${row.exists ? 'preservada' : 'a criar'}</li>`).join('');
  const siteName = typeof state.settings?.siteName === 'string' ? state.settings.siteName : 'MINIJOOMLA';
  const siteDescription = typeof state.settings?.siteDescription === 'string' ? state.settings.siteDescription : '';
  return `<section class="minijoomla-installation" aria-labelledby="minijoomla-install-heading">
    <h1 id="minijoomla-install-heading">Instalação do MINIJOOMLA</h1>
    <p>CMS genérico Joomla-like. Site Cassiopeia e painel Atum; nenhuma extensão ou conteúdo específico será instalado automaticamente.</p>
    <p role="status" aria-live="polite" data-install-status>${escapeHtml(message)}</p>
    ${publicView ? '<p>O administrador deve concluir a instalação na página do painel.</p>' : `<ul>${summary}</ul>
    ${canInstall ? `<form data-install-form><label for="install-site-name">Nome do site</label><input id="install-site-name" name="siteName" maxlength="200" required value="${escapeHtml(siteName)}" autocomplete="off">
    <label for="install-site-description">Descrição</label><textarea id="install-site-description" name="siteDescription" maxlength="500">${escapeHtml(siteDescription)}</textarea>
    <p>A confirmação cria somente a infraestrutura nativa e sua configuração. Dados de exemplo, extensões e templates serão escolhidos depois. Nenhum dado existente será sobrescrito.</p>
    <label><input type="checkbox" name="confirmed" required> Confirmo a instalação da infraestrutura no site atual.</label>
    <button type="submit">${status === 'partial' ? 'Retomar instalação verificada' : 'Instalar MINIJOOMLA'}</button></form>` : '<p>Não há ação de reinstalação disponível. Verifique a instalação e os recibos antes de tentar novamente.</p>'}
    <button type="button" data-install-recheck>Verificar novamente</button>`}
  </section>`;
}

export async function mountInstallationPage({ root, service, documentRef = globalThis.document, publicView = false, onInstalled } = {}) {
  if (!root || root === documentRef?.body || root === documentRef?.documentElement || typeof root.innerHTML !== 'string' || !service || typeof service.inspect !== 'function' || typeof service.install !== 'function') throw new TypeError('Instalação requer raiz dedicada e serviço.');
  let active = true, generation = 0, busy = false;
  const unload = () => { active = false; generation++; };
  globalThis.addEventListener?.('pagehide', unload);
  const isCurrent = revision => active && root.isConnected !== false && generation === revision;
  async function transition(configuration) {
    active = false;
    globalThis.removeEventListener?.('pagehide', unload);
    try { await onInstalled(configuration); }
    catch {
      if (root.isConnected === false) return;
      root.innerHTML = '<section class="minijoomla-installation" role="alert"><h1>Instalação preservada</h1><p>A infraestrutura foi verificada, mas não foi possível abrir o aplicativo. Recarregue a página e verifique os recursos publicados. Não reinstale nem apague o diário.</p></section>';
    }
  }
  async function refresh() {
    if (!active || busy) return;
    const revision = ++generation;
    root.innerHTML = renderInstallationPage({ status: 'unavailable', message: 'Verificando a instalação…' }, { publicView });
    const state = await service.inspect({ isCurrent: () => isCurrent(revision) });
    if (!isCurrent(revision)) return;
    if (state.status === 'installed' && typeof onInstalled === 'function') { await transition(state.configuration); return; }
    root.innerHTML = renderInstallationPage(state, { publicView });
    const recheck = root.querySelector?.('[data-install-recheck]');
    recheck?.addEventListener('click', () => { if (isCurrent(revision) && !busy) refresh().catch(showError); });
    const form = root.querySelector?.('[data-install-form]');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy || !isCurrent(revision) || !form.elements?.namedItem('confirmed')?.checked) return;
      const siteName = form.elements.namedItem('siteName')?.value;
      const siteDescription = form.elements.namedItem('siteDescription')?.value;
      busy = true;
      const button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      try {
        const result = await service.install({ confirm: true, plan: state.plan, settings: { ...(state.settings ?? {}), siteName, siteDescription }, isCurrent: () => isCurrent(revision), onProgress(progress) {
          if (!isCurrent(revision)) return;
          const status = root.querySelector('[data-install-status]');
          if (status) status.textContent = typeof progress.message === 'string' ? progress.message : 'Instalando…';
        } });
        if (!isCurrent(revision)) return;
        if (result.status === 'installed' && typeof onInstalled === 'function') { await transition(result.configuration); }
        else { busy = false; await refresh(); }
      } catch { showError(); }
      finally { busy = false; }
    });
  }
  function showError() {
    if (!active) return;
    const status = root.querySelector?.('[data-install-status]');
    if (status) status.textContent = 'Instalação interrompida. Verifique o diário e o destino; não há repetição automática.';
    const form = root.querySelector?.('[data-install-form]');
    if (form) form.querySelector('button[type="submit"]').disabled = true;
  }
  await refresh();
  return Object.freeze({ stop() { active = false; generation++; globalThis.removeEventListener?.('pagehide', unload); }, refresh });
}

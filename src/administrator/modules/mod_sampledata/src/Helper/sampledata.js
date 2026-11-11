import { renderSampleDataPage } from '../../tmpl/default.js';

export async function loadSampleDataPage({ sampleDataService, documentRef, router, shell, isCurrent }) {
  const link = (path, params) => router.link(path, params);
  let state;
  try { state = sampleDataService ? await sampleDataService.inspect({ isCurrent }) : { status: 'unavailable', message: 'Pacote ou armazenamento de instalação não configurado.' }; }
  catch { state = { status: 'unavailable', message: 'Não foi possível verificar os dados de exemplo. Nenhum registro foi alterado.' }; }
  return { html: renderSampleDataPage(state, link, shell), bind() {
    const button = documentRef.body.querySelector?.('[data-sample-install]');
    const status = documentRef.body.querySelector?.('[data-sample-status]');
    const progress = documentRef.body.querySelector?.('[data-sample-progress]');
    if (!button || !sampleDataService || !['ready', 'partial'].includes(state.status) || state.status === 'partial' && !state.canResume) return;
    let pending = false;
    button.addEventListener?.('click', async () => {
      if (!isCurrent() || button.disabled || pending) return;
      if (!globalThis.confirm?.('Instalar os dados de exemplo do Joomla nos domínios vazios? Uma retomada usa somente recibos verificados. Nenhum dado existente será sobrescrito.')) return;
      if (!isCurrent()) return;
      pending = true; button.disabled = true;
      try {
        const result = await sampleDataService.install({ confirm: true, isCurrent, onProgress(event) {
          if (!isCurrent()) return;
          if (status) status.textContent = event.message ?? 'Instalando…';
          if (progress) { progress.max = event.total || 1; progress.value = event.completed || 0; }
        } });
        if (!isCurrent()) return;
        if (status) status.textContent = result.message;
        if (result.status === 'installed') await router.navigate(link('/sampledata'));
        else button.disabled = !(result.canResume || result.reason === 'confirmation-required');
      } catch { if (isCurrent() && status) status.textContent = 'Instalação interrompida. Verifique o diário antes de repetir; não há rollback automático.'; }
      finally { pending = false; }
    });
  } };
}

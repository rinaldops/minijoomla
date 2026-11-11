import { escapeHtml } from '../../../../../libraries/minijoomla/security/sanitize.js';

export async function loadExtensionRootsPage({ service, documentRef, router, shell, isCurrent = () => true } = {}) {
  const link = path => router.link(path);
  const state = service ? await service.inspect({ isCurrent }) : { status: 'unavailable', message: 'Configuração de raízes não está disponível neste host.' };
  const available = state.status === 'ready';
  const roots = state.configuration?.joomlaDiscoveryRoots ?? [];
  const rows = roots.map(root => `<tr><td>${escapeHtml(root.id)}</td><td>${escapeHtml(root.baseUrl)}<br><small>SHA-256: ${escapeHtml(root.inventoryHash ?? '')}</small></td><td>${root.discover ? 'Incluída na descoberta' : 'Retida para revisão/rollback'}</td><td><form data-root-discovery="${escapeHtml(root.id)}"><input type="checkbox" name="confirmed" required aria-label="Confirmar mudança de descoberta da raiz ${escapeHtml(root.id)}"><button type="submit" class="admin-btn"${available ? '' : ' disabled'}>${root.discover ? 'Ocultar da descoberta' : 'Incluir na descoberta'}</button></form></td></tr>`).join('');
  const bodyHtml = `<p>Raízes são aprovações de pacotes já copiados no site. Configurá-las não instala, habilita ou seleciona extensões/templates. Todas as revisões retidas contam no limite de dez raízes.</p>
    <p role="status" aria-live="polite" data-roots-status>${escapeHtml(state.message ?? '')}</p>
    ${roots.length ? `<div class="admin-table-wrap"><table class="admin-list"><caption>Raízes aprovadas (${roots.length}/10)</caption><thead><tr><th scope="col">ID</th><th scope="col">Pasta</th><th scope="col">Estado</th><th scope="col">Descoberta</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p>Nenhuma raiz configurada.</p>'}
    ${available ? `<form data-root-add class="admin-install"><label for="admin-root-config">host-config.json de um pacote imutável</label><textarea id="admin-root-config" name="configuration" rows="12" maxlength="262144" required spellcheck="false"></textarea>
      <p>Informe uma única raiz, hash do inventário e seus vínculos CSS por revisão. O inventário e os arquivos serão lidos e verificados antes de salvar. Aprovações anteriores não serão removidas.</p>
      <label><input type="checkbox" name="confirmed" required> Confirmo a aprovação desta raiz e seus recursos, sem instalar extensões.</label>
      <button type="submit" class="admin-btn"${roots.length >= 10 ? ' disabled' : ''}>Verificar e adicionar raiz</button></form>` : ''}
    <p>Depois de salvar, recarregue a página para utilizar a nova configuração na descoberta e no site. O arquivo da instalação inicial não será alterado.</p>`;
  return {
    html: shell({ activeKey: 'extensionRoots', pageTitle: 'Raízes de extensões', breadcrumbItems: [{ label: 'Painel de controle', href: link('/') }, { label: 'Raízes de extensões' }], bodyHtml, link }),
    bind() {
      let busy = false, consumed = false;
      const root = documentRef.body;
      const report = message => { if (isCurrent()) { const node = root.querySelector('[data-roots-status]'); if (node) node.textContent = message; } };
      const bind = (form, operation) => form?.addEventListener('submit', async event => {
        event.preventDefault();
        if (!available || busy || consumed || !isCurrent() || form.querySelector('[name="confirmed"]')?.checked !== true) return;
        busy = true;
        consumed = true;
        const button = form.querySelector('button[type="submit"]'); if (button) button.disabled = true;
        try {
          const result = await operation();
          if (!isCurrent()) return;
          report(result.message ?? 'Não foi possível confirmar a configuração.');
          // Keep the captured ETag invalidated after any attempt. Reopen this
          // route explicitly for a fresh snapshot; never repeat a write here.
        } catch { report('Operação interrompida. Verifique a configuração antes de tentar novamente; nenhuma escrita será repetida automaticamente.'); }
        finally { busy = false; if (isCurrent()) availableForms().forEach(item => { const control = item.querySelector('button[type="submit"]'); if (control) control.disabled = true; }); }
      });
      const availableForms = () => Array.from(root.querySelectorAll?.('[data-root-add], [data-root-discovery]') ?? []);
      const add = root.querySelector('[data-root-add]');
      bind(add, async () => {
        const raw = add.querySelector('[name="configuration"]')?.value;
        if (typeof raw !== 'string' || raw.length > 262144) throw new TypeError('Configuração inválida.');
        return service.add({ confirm: true, input: JSON.parse(raw), expectedETag: state.etag, isCurrent });
      });
      root.querySelectorAll?.('[data-root-discovery]')?.forEach(form => {
        const id = form.dataset.rootDiscovery;
        const selected = roots.find(item => item.id === id);
        bind(form, () => service.setDiscover({ confirm: true, rootId: id, discover: !selected.discover, expectedETag: state.etag, isCurrent }));
      });
    }
  };
}

import { renderTemplateDiscoveryPage } from '../../tmpl/discover/default.js';

// Register an already published template, never install/upload code or select a default.
export async function loadTemplateDiscoveryPage({ adminService, discoveryService, documentRef, router, shell, isCurrent }) {
  const link = (path, params) => router.link(path, params);
  const fallback = (bodyHtml, pageTitle = 'Descobrir templates') => ({ html: shell({ activeKey: 'templates', pageTitle, breadcrumbItems: [{ label: 'Painel de controle', href: link('/') }, { label: 'Templates' }], bodyHtml, link }) });
  if (adminService.templates?.available === false) return fallback('<p role="status">Catálogo de templates não configurado. Os templates integrados continuam disponíveis na <a href="' + link('/config') + '">configuração do site</a>.</p>', 'Templates');
  if (!discoveryService?.templates) return fallback('<p class="admin-empty" role="status">Descoberta de templates não está configurada nesta composição.</p>');
  try {
    const [registered, found] = await Promise.all([adminService.templates.list(), discoveryService.templates.scan()]);
    const entries = found.filter((entry) => !registered.some((item) => item.key === entry.key)).map((entry) => structuredClone(entry));
    return { html: renderTemplateDiscoveryPage(entries, link, shell), bind() {
      const status = documentRef.body.querySelector?.('.admin-management-status');
      documentRef.body.querySelectorAll?.('[data-admin-template-register]')?.forEach?.((button) => {
        const entry = entries.find((item) => item.key === button.dataset?.adminTemplateRegister && !item.error);
        if (!entry) return;
        button.addEventListener?.('click', async () => {
          if (!isCurrent() || button.disabled || button.dataset?.adminTemplateRegister !== entry.key) return;
          if (!globalThis.confirm?.('Registrar e habilitar este template já publicado? Confirme que a origem do manifesto é confiável.')) return;
          if (!isCurrent()) return;
          button.disabled = true;
          try {
            await adminService.templates.create({
              title: entry.title, key: entry.key, version: entry.version, entryPointUrl: entry.entryPointUrl,
              styles: entry.styles, positions: structuredClone(entry.positions), ...(entry.paramDefinitions===undefined?{}:{paramDefinitions:structuredClone(entry.paramDefinitions)}), discoveredFrom: entry.discoveredFrom, enabled: true
            });
            if (isCurrent()) await router.navigate(link('/templates/discover'));
          } catch (error) {
            if (isCurrent() && status) status.textContent = error?.code === 'concurrency-conflict'
              ? 'O registro ou a configuração foi alterado por outra pessoa. Recarregue antes de tentar novamente.'
              : error?.name === 'ValidationError' ? error.message : 'Não foi possível registrar o template.';
          } finally { button.disabled = false; }
        });
      });
    } };
  } catch {
    return fallback('<p role="alert">Não foi possível consultar a pasta de templates ou o catálogo. Verifique o caminho e as permissões e tente novamente. Nenhum registro foi alterado.</p>');
  }
}

import { renderDiscoveryPage } from '../../tmpl/discover/default.js';
import { prepareDiscoveryEntries } from '../Model/discovery.js';

const CONFIRMATIONS = {
  upgrade: 'Atualizar a versao deste modulo preservando suas instancias e configuracoes?',
  rollback: 'Reverter a versao deste modulo para o pacote anterior aprovado?',
  install: 'Registrar esta extensão desabilitada? Confirme que a origem do manifesto é confiável. A habilitação será uma ação separada.'
};

// Discovery reads metadata only. Registration stays disabled until a separate action.
export async function loadExtensionDiscoveryPage({ adminService, discoveryService, documentRef, router, shell, isCurrent }) {
  const link = (path, params) => router.link(path, params);
  const fallback = (bodyHtml) => ({ html: shell({ activeKey: 'extensions', pageTitle: 'Descobrir extensões', breadcrumbItems: [{ label: 'Painel de controle', href: link('/') }, { label: 'Extensões registradas' }], bodyHtml, link }) });
  if (!discoveryService) return fallback('<p class="admin-empty" role="status">Descoberta de extensões não está configurada nesta composição.</p>');
  try {
    const [registered, report] = await Promise.all([
      adminService.extensions.list(),
      discoveryService.scanReport ? discoveryService.scanReport() : discoveryService.scan().then((entries) => ({ entries }))
    ]);
    const prepared = await prepareDiscoveryEntries(report.entries, registered, adminService.extensions);
    const entries = prepared.map((entry) => structuredClone(entry));
    return { html: renderDiscoveryPage(entries, link, shell, report), bind() {
      const status = documentRef.body.querySelector?.('.admin-management-status');
      documentRef.body.querySelectorAll?.('[data-admin-register]')?.forEach?.((button) => {
        const entry = entries.find((item) => item.key === button.dataset?.adminRegister && !item.error);
        if (!entry) return;
        button.addEventListener?.('click', async () => {
          if (!isCurrent() || button.disabled || button.dataset?.adminRegister !== entry.key) return;
          if (!globalThis.confirm?.(CONFIRMATIONS[entry.action] ?? CONFIRMATIONS.install)) return;
          if (!isCurrent()) return;
          button.disabled = true;
          try {
            // The XML installer owns versioned candidates; legacy JSON manifests stay on the catalogue.
            if (entry.candidateId) {
              if (!discoveryService.installer) throw Object.assign(new Error('Instalador XML nao configurado.'), { name: 'ValidationError' });
              if (entry.action === 'upgrade') await discoveryService.installer.upgrade(entry.installedId, entry, { etag: entry.installedEtag });
              else if (entry.action === 'rollback') await discoveryService.installer.rollback(entry.installedId, { etag: entry.installedEtag });
              else await discoveryService.installer.install(entry);
            } else {
              const metadata = JSON.parse(entry.manifestJson || '{}');
              await adminService.extensions.create({
                title: entry.title, key: entry.key, type: entry.type, entryPointUrl: entry.entryPointUrl,
                discoveredFrom: entry.discoveredFrom, enabled: false,
                manifestJson: entry.manifestJson || '{}', folder: entry.type === 'Plugin' ? metadata.group || 'content' : ''
              });
            }
            if (isCurrent()) await router.navigate(link('/extensions/discover'));
          } catch (error) {
            if (isCurrent() && status) status.textContent = error?.code === 'concurrency-conflict'
              ? 'O registro ou a configuração foi alterado por outra pessoa. Recarregue antes de tentar novamente.'
              : error?.name === 'ValidationError' ? error.message : 'Não foi possível registrar a extensão.';
          } finally { button.disabled = false; }
        });
      });
    } };
  } catch {
    return fallback('<p role="alert">Não foi possível consultar a pasta de extensões ou o catálogo. Verifique o caminho e as permissões e tente novamente. Nenhum registro foi alterado.</p>');
  }
}

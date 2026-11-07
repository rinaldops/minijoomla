import { renderDiscoveryPage } from '../../tmpl/discover/default.js';
import { prepareDiscoveryEntries } from '../Model/discovery.js';
import { confirmInstallerAction } from '../View/confirmation.js';

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
      const root = documentRef.body;
      let inFlight = false;
      const status = documentRef.body.querySelector?.('.admin-management-status');
      documentRef.body.querySelectorAll?.('[data-admin-register]')?.forEach?.((button) => {
        const entry = entries.find((item) => item.key === button.dataset?.adminRegister && !item.error);
        if (!entry) return;
        button.addEventListener?.('click', async () => {
          const current = () => isCurrent() && documentRef.body === root && root.isConnected !== false && button.isConnected !== false && root.contains?.(button) !== false;
          if (!current() || inFlight || button.disabled || button.dataset?.adminRegister !== entry.key) return;
          // Lock the entire screen, including the asynchronous consent phase.
          // Neither mutable scan objects nor datasets may refresh the screen ETag.
          inFlight = true;
          try {
            const submission = structuredClone(entry);
            if (!await confirmInstallerAction({ documentRef, entry: submission, message: CONFIRMATIONS[submission.action] ?? CONFIRMATIONS.install, isCurrent: current })) return;
            if (!current() || button.dataset?.adminRegister !== submission.key) return;
            button.disabled = true;
            // The XML installer owns versioned candidates; legacy JSON manifests stay on the catalogue.
            if (submission.candidateId) {
              if (!discoveryService.installer) throw Object.assign(new Error('Instalador XML nao configurado.'), { name: 'ValidationError' });
              if (submission.action === 'upgrade') await discoveryService.installer.upgrade(submission.installedId, submission, { etag: submission.installedEtag });
              else if (submission.action === 'rollback') await discoveryService.installer.rollback(submission.installedId, { etag: submission.installedEtag });
              else await discoveryService.installer.install(submission);
            } else {
              const metadata = JSON.parse(submission.manifestJson || '{}');
              await adminService.extensions.create({
                title: submission.title, key: submission.key, type: submission.type, entryPointUrl: submission.entryPointUrl,
                discoveredFrom: submission.discoveredFrom, enabled: false,
                manifestJson: submission.manifestJson || '{}', folder: submission.type === 'Plugin' ? metadata.group || 'content' : ''
              });
            }
            if (current()) await router.navigate(link('/extensions/discover'));
          } catch (error) {
            if (current() && status) status.textContent = error?.code === 'concurrency-conflict'
              ? 'O registro ou a configuração foi alterado por outra pessoa. Recarregue antes de tentar novamente.'
              : error?.name === 'ValidationError' ? error.message : 'Não foi possível registrar a extensão.';
          } finally { inFlight = false; button.disabled = false; }
        });
      });
    } };
  } catch {
    return fallback('<p role="alert">Não foi possível consultar a pasta de extensões ou o catálogo. Verifique o caminho e as permissões e tente novamente. Nenhum registro foi alterado.</p>');
  }
}

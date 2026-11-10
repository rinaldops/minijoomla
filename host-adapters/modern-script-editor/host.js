/*
 * Host do Modern Script Editor para o site público e o painel administrativo.
 * scripts/deploy-sharepoint.mjs injeta a configuração e publica este arquivo em
 * host/ de cada release imutável; a mesma release nunca é regravada.
 * O painel é escolhido pelo contêiner da página, nunca pela URL.
 */
import { resolveInstallationContext } from './installation-context.js';
const PRECONFIGURED = /* MINIJOOMLA_CONFIG */ null;
// Generic copied package has null; deployment may inject one explicit object.
let CONFIG = PRECONFIGURED ?? {};
const SITE_ROOT = '[data-minijoomla-site]';
const ADMIN_ROOT = '[data-minijoomla-admin-root]';

function waitForRoot(timeoutMs = 8000) {
  const find = () => document.querySelector(`${SITE_ROOT},${ADMIN_ROOT}`);
  return new Promise((resolve) => {
    const found = find();
    if (found) return resolve(found);
    const observer = new MutationObserver(() => {
      const root = find();
      if (!root) return;
      observer.disconnect();
      resolve(root);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); resolve(find()); }, timeoutMs);
  });
}

async function mountSite(root) {
  const [{ mountMiniJoomlaSite }, { createSharePointRestClient }] = await Promise.all([
    import('../libraries/minijoomla/composition/mountMiniJoomlaSite.js'),
    import('../libraries/vendor/spmiddle/sharepoint-rest-browser/src/index.js')
  ]);
  // Sem autenticação própria: a sessão exibida pelo módulo de login é a do SharePoint.
  const user = await fetch(`${CONFIG.webUrl === '/' ? '' : CONFIG.webUrl}/_api/web/currentuser?$select=Title`, { headers: { accept: 'application/json;odata=nometadata' } })
    .then((response) => (response.ok ? response.json() : null)).catch(() => null);
  await mountMiniJoomlaSite({
    root,
    moduleStyles: CONFIG.moduleStyles ?? {},
    moduleStyleRevisions: CONFIG.moduleStyleRevisions ?? {},
    config: { ...(CONFIG.initialSite ?? {}), session: user?.Title ? { name: user.Title } : undefined },
    webUrl: CONFIG.webUrl,
    lists: CONFIG.lists,
    cacheMs: 5000,
    transportFactory: ({ webUrl }) => createSharePointRestClient({ webUrl: webUrl || '/' })
  });
}

async function mountAdmin(root) {
  const [{ createMiniJoomlaAdminApp }, { createAdminApplication }, { attachRichTextEditor }, { createSharePointFileClient }, { createSharePointRestClient }, { createAtomicExtensionKeyGuard }, { toSharePointFileTransport, withSharePointMediaFolder }] = await Promise.all([
    import('../libraries/minijoomla/composition/createMiniJoomlaAdminApp.js'),
    import('../administrator/components/com_minijoomla/app.js'),
    import('../administrator/components/com_minijoomla/editor.js'),
    import('../libraries/vendor/spmiddle/sharepoint-files/src/files.js'),
    import('../libraries/vendor/spmiddle/sharepoint-rest-browser/src/index.js'),
    import('../libraries/minijoomla/infrastructure/spmiddle-extension-guard.js'),
    import('../libraries/minijoomla/infrastructure/sharepoint-media-folder.js')
  ]);
  const stylesheet = document.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('./admin.scoped.css', import.meta.url).href;
  document.head.append(stylesheet);
  const fileClient = ({ webUrl }) => {
    const transport = createSharePointRestClient({ webUrl: webUrl || '/' });
    const client = createSharePointFileClient({ transport: toSharePointFileTransport(transport), libraryPath: CONFIG.libraryPath });
    return {
      ...client,
      // O cliente do SPMIDDLE não exclui arquivos; recycle() mantém a exclusão recuperável pela lixeira.
      deleteFile: ({ folderPath, fileName }) => transport.request(`${webUrl === '/' ? '' : webUrl}/_api/web/GetFileByServerRelativeUrl('${CONFIG.libraryPath}/${folderPath}/${encodeURIComponent(fileName).replaceAll("'", "''")}')/recycle()`, { method: 'POST' })
    };
  };
  const [{ loadJoomlaBlogPackage }, { createSampleDataJournal }] = await Promise.all([
    import('../plugins/sampledata/blog/blog.js'),
    import('../libraries/minijoomla/infrastructure/sample-data-journal.js')
  ]);
  let sampleDataJournalStore;
  try { sampleDataJournalStore = createSampleDataJournal({ storage: globalThis.localStorage, key: `minijoomla:sampledata:${CONFIG.webUrl}:joomla-blog`, locks: globalThis.navigator?.locks }); }
  catch { /* A missing durable journal disables installation, not the editor. */ }
  const releaseBase = new URL('../', import.meta.url).pathname;
  const sampleDataPackageLoader = async () => loadJoomlaBlogPackage({ releaseBase: CONFIG.sampleData?.releaseBase ?? releaseBase,
    mediaBase: CONFIG.sampleData?.mediaBase ?? `${releaseBase}media/sampledata/joomla-blog` });
  const app = createMiniJoomlaAdminApp({
    webUrl: CONFIG.webUrl,
    transportFactory: ({ webUrl }) => createSharePointRestClient({ webUrl: webUrl || '/' }),
    extensionsFileClientFactory: fileClient,
    joomlaDiscoveryRoots: CONFIG.joomlaDiscoveryRoots ?? [],
    joomlaFileClientFactory: ({ webUrl, root }) => {
      const client = createSharePointFileClient({ transport: toSharePointFileTransport(createSharePointRestClient({ webUrl: webUrl || '/' })), libraryPath: root.baseUrl });
      return { listFolders: client.listFoldersAll, listFiles: client.listFilesAll, downloadFile: client.downloadFile };
    },
    assertAtomicExtensionKey: createAtomicExtensionKeyGuard({ transport: createSharePointRestClient({ webUrl: CONFIG.webUrl }), webUrl: CONFIG.webUrl, listId: CONFIG.lists.extensions?.listId }),
    mediaFileClientFactory: ({webUrl}) => withSharePointMediaFolder({fileClient:fileClient({webUrl}),transport:createSharePointRestClient({webUrl:webUrl || '/'}),libraryPath:CONFIG.libraryPath}),
    lists: CONFIG.lists,
    sampleDataPackageLoader, sampleDataJournalStore,
    config: CONFIG.initialSite
  });
  const application = createAdminApplication({
    adminService: app.admin,
    pluginRuntime: app.adminPlugins,
    autoStart: false,
    discoveryService: app.discovery,
    mediaService: app.media,
    sampleDataService: app.sampleData,
    documentRef: { body: root, documentElement: null, title: '' },
    richTextEditorFactory: (elementId, options) => attachRichTextEditor(elementId, {
      vendorBaseUrl: new URL('../media/vendor/tinymce', import.meta.url).pathname,
      documentRef: document,
      uploadImage: app.media?.uploadImage,
      ...options
    })
  });
  await application.start();
}

const root = await waitForRoot();
try {
  if (!root) throw new TypeError('Contêiner do MINIJOOMLA ausente.');
  if (!CONFIG.lists) {
    const context = resolveInstallationContext({configured:CONFIG,pageContext:globalThis._spPageContextInfo,locationRef:location,releaseUrl:new URL('../',import.meta.url).href});
    const [{createSharePointRestClient},{createSharePointInstallationPort},{createInstallationService},{createInstallationJournal},{mountInstallationPage}]=await Promise.all([
      import('../libraries/vendor/spmiddle/sharepoint-rest-browser/src/index.js'),
      import('../libraries/minijoomla/infrastructure/sharepoint-installation.js'),
      import('../libraries/minijoomla/application/installation-service.js'),
      import('../libraries/minijoomla/infrastructure/installation-journal.js'),
      import('../installation/template.js')
    ]);
    const transport=createSharePointRestClient({webUrl:context.webUrl});
    let journalStore;
    try { journalStore=createInstallationJournal({storage:globalThis.localStorage,key:`minijoomla:installation:${context.webUrl}`}); }
    catch { /* Absence must fail closed in the service; no journal-free writes. */ }
    const port=createSharePointInstallationPort({...context,transport,mutationTransportFactory:guard=>createSharePointRestClient({webUrl:context.webUrl,fetchImpl:(url,init)=>{guard();return fetch(url,init);}})});
    const service=createInstallationService({port,journalStore});
    const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('../media/installation/installation.css',import.meta.url).href;document.head.append(style);
    await mountInstallationPage({root,service,publicView:root.matches(SITE_ROOT),onInstalled:async configuration=>{
      CONFIG=configuration;
      style.remove();
      await (root.matches(ADMIN_ROOT)?mountAdmin(root):mountSite(root));
    }});
  } else {
  await (root.matches(ADMIN_ROOT) ? mountAdmin(root) : mountSite(root));
  }
} catch (error) {
  console.error('MINIJOOMLA: falha ao iniciar no host.', error);
  if (root) {
    root.textContent = 'Não foi possível iniciar o MINIJOOMLA.';
    root.setAttribute('role', 'alert');
  }
}

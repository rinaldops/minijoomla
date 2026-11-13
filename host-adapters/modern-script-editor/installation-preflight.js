/** Fixed copied-release prerequisites only. No extension discovery, provisioning,
 * journal intent, CDN or separate SiteAssets/spmiddle installation is involved.
 * Keep imports literal: the generic stager audits this host's complete closure.
 */
export const REQUIRED_INSTALLATION_MODULES = Object.freeze([
  { name: 'SPMIDDLE REST', path: 'libraries/vendor/spmiddle/sharepoint-rest-browser/src/index.js', exports: ['createSharePointRestClient', 'createSharePointListClient', 'createDataSourceRegistry'], load: () => import('../libraries/vendor/spmiddle/sharepoint-rest-browser/src/index.js') },
  { name: 'SPMIDDLE files', path: 'libraries/vendor/spmiddle/sharepoint-files/src/files.js', exports: ['createSharePointFileClient'], load: () => import('../libraries/vendor/spmiddle/sharepoint-files/src/files.js') },
  { name: 'SPMIDDLE data core', path: 'libraries/vendor/spmiddle/data-core/src/index.js', exports: ['createMapper', 'createRepository'], load: () => import('../libraries/vendor/spmiddle/data-core/src/index.js') },
  { name: 'installation port', path: 'libraries/minijoomla/infrastructure/sharepoint-installation.js', exports: ['createSharePointInstallationPort'], load: () => import('../libraries/minijoomla/infrastructure/sharepoint-installation.js') },
  { name: 'installation service', path: 'libraries/minijoomla/application/installation-service.js', exports: ['createInstallationService'], load: () => import('../libraries/minijoomla/application/installation-service.js') },
  { name: 'installation journal', path: 'libraries/minijoomla/infrastructure/installation-journal.js', exports: ['createInstallationJournal'], load: () => import('../libraries/minijoomla/infrastructure/installation-journal.js') },
  { name: 'installation page', path: 'installation/template.js', exports: ['mountInstallationPage'], load: () => import('../installation/template.js') },
  { name: 'administrator composition', path: 'libraries/minijoomla/composition/createMiniJoomlaAdminApp.js', exports: ['createMiniJoomlaAdminApp'], load: () => import('../libraries/minijoomla/composition/createMiniJoomlaAdminApp.js') },
  { name: 'administrator application', path: 'administrator/components/com_minijoomla/app.js', exports: ['createAdminApplication'], load: () => import('../administrator/components/com_minijoomla/app.js') },
  { name: 'rich text editor', path: 'administrator/components/com_minijoomla/editor.js', exports: ['attachRichTextEditor'], load: () => import('../administrator/components/com_minijoomla/editor.js') },
  { name: 'extension key guard', path: 'libraries/minijoomla/infrastructure/spmiddle-extension-guard.js', exports: ['createAtomicExtensionKeyGuard'], load: () => import('../libraries/minijoomla/infrastructure/spmiddle-extension-guard.js') },
  { name: 'media transport', path: 'libraries/minijoomla/infrastructure/sharepoint-media-folder.js', exports: ['toSharePointFileTransport', 'withSharePointMediaFolder'], load: () => import('../libraries/minijoomla/infrastructure/sharepoint-media-folder.js') },
  { name: 'sample data loader', path: 'plugins/sampledata/blog/blog.js', exports: ['loadJoomlaBlogPackage'], load: () => import('../plugins/sampledata/blog/blog.js') },
  { name: 'sample data journal', path: 'libraries/minijoomla/infrastructure/sample-data-journal.js', exports: ['createSampleDataJournal'], load: () => import('../libraries/minijoomla/infrastructure/sample-data-journal.js') },
  { name: 'extension roots port', path: 'libraries/minijoomla/infrastructure/sharepoint-extension-roots.js', exports: ['createSharePointExtensionRootsPort'], load: () => import('../libraries/minijoomla/infrastructure/sharepoint-extension-roots.js') },
  { name: 'extension roots service', path: 'libraries/minijoomla/application/extension-roots-service.js', exports: ['createExtensionRootsService'], load: () => import('../libraries/minijoomla/application/extension-roots-service.js') },
  { name: 'public site', path: 'libraries/minijoomla/composition/mountMiniJoomlaSite.js', exports: ['mountMiniJoomlaSite'], load: () => import('../libraries/minijoomla/composition/mountMiniJoomlaSite.js') }
].map(entry => Object.freeze({ ...entry, exports: Object.freeze(entry.exports) })));

// Assets used by the built-in host/editor, not every optional package asset.
// Importing the compositions above verifies their transitive static JS graph.
const EDITOR_PLUGINS = 'lists link image table code charmap emoticons media searchreplace fullscreen visualchars visualblocks nonbreaking codesample insertdatetime accordion anchor directionality preview help'.split(' ');
export const REQUIRED_INSTALLATION_ASSETS = Object.freeze([
  'media/installation/installation.css', 'host/admin.scoped.css',
  'media/templates/site/cassiopeia/css/template.css',
  'media/vendor/tinymce/tinymce.min.js', 'media/vendor/tinymce/themes/silver/theme.min.js',
  'media/vendor/tinymce/models/dom/model.min.js', 'media/vendor/tinymce/icons/default/icons.min.js',
  'media/vendor/tinymce/skins/ui/oxide/skin.min.css', 'media/vendor/tinymce/skins/ui/oxide/content.min.css',
  'media/vendor/tinymce/skins/content/default/content.min.css',
  'media/vendor/tinymce/plugins/emoticons/js/emojis.min.js',
  'media/vendor/tinymce/plugins/help/js/i18n/keynav/en.js',
  ...EDITOR_PLUGINS.map(name => `media/vendor/tinymce/plugins/${name}/plugin.min.js`)
]);

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safePath = value => typeof value === 'string' && value.startsWith('/') && !value.includes('//') && !/[\\%?#:'"<>\u0000-\u0020\u007f]/.test(value) && !value.split('/').some(part => part === '.' || part === '..') && (value === '/' || !value.endsWith('/'));
const functions = (value, names) => value && names.every(name => typeof value[name] === 'function');
const error = message => { throw new TypeError(message); };

async function boundedText(response, limit) {
  const announced = response.headers?.get?.('content-length');
  if (announced != null && /^\d+$/.test(announced) && Number(announced) > limit) error('Resposta excede o limite de tamanho.');
  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).length > limit) error('Resposta excede o limite de tamanho.');
    return text;
  }
  const decoder = new TextDecoder(); let text = '', size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { Promise.resolve(reader.cancel()).catch(() => {}); error('Resposta excede o limite de tamanho.'); }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock?.(); }
}

async function parallel(items, operation) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, items.length) }, async () => {
    while (next < items.length) await operation(items[next++]);
  }));
}

/** Returned callback is injectable into service/page, but the host uses only
 * service preflight to avoid duplicate checks. Each invocation is fresh; a
 * cached success cannot authorize a later installation. Module loader callbacks
 * are trusted test hooks, never URLs/data from extension catalogs.
 */
export function createInstallationPreflight({ context, releaseUrl, locationRef = globalThis.location, fetchImpl = globalThis.fetch,
  storageProvider = () => globalThis.localStorage, moduleLoaders, timeoutMs = 8000 } = {}) {
  return async function preflight({ isCurrent, signal } = {}) {
    const checks = [];
    const current = () => {
      if (signal?.aborted || isCurrent && isCurrent() !== true) error('Verificação cancelada após mudança de contexto.');
    };
    const check = async (name, operation) => {
      try { current(); const message = await operation(); current(); checks.push({ name, ok: true, message }); return true; }
      catch (failure) { checks.push({ name, ok: false, message: failure instanceof Error ? failure.message : 'Pré-requisito indisponível.' }); return false; }
    };
    const finish = () => {
      const failed = checks.find(item => !item.ok);
      return { ok: !failed, message: failed ? `Instalação desabilitada: ${failed.message}` : 'Pré-requisitos da release, armazenamento e SharePoint verificados.', checks };
    };
    let release;
    if (!await check('release', () => {
      if (!safePath(context?.webUrl) || !safePath(context?.libraryPath) || !context.libraryPath.startsWith(`${context.webUrl === '/' ? '' : context.webUrl}/SiteAssets/`)) error('Contexto de instalação inválido.');
      release = new URL(releaseUrl);
      if (release.protocol !== 'https:' || release.origin !== locationRef?.origin || release.username || release.password || release.search || release.hash || !release.pathname.startsWith(`${context.libraryPath}/releases/`) || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\/$/.test(release.pathname.slice(`${context.libraryPath}/releases/`.length))) error('Os recursos devem pertencer à mesma release HTTPS do site atual.');
      if (typeof fetchImpl !== 'function' || typeof storageProvider !== 'function' || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000 || isCurrent !== undefined && typeof isCurrent !== 'function' || signal !== undefined && !(signal instanceof AbortSignal)) error('Verificação limitada indisponível.');
      return 'Release local e contexto fixados.';
    })) return finish();

    async function bounded(operation) {
      current();
      const controller = new AbortController(); let timer, listener;
      const deadline = new Promise((_, reject) => {
        const cancel = message => { controller.abort(); reject(new TypeError(message)); };
        timer = setTimeout(() => cancel('Tempo limite ao verificar os recursos da instalação.'), timeoutMs);
        listener = () => cancel('Verificação cancelada.');
        signal?.addEventListener('abort', listener, { once: true });
      });
      try { const value = await Promise.race([Promise.resolve().then(() => operation(controller.signal)), deadline]); current(); return value; }
      finally { clearTimeout(timer); signal?.removeEventListener('abort', listener); controller.abort(); }
    }
    const read = (url, kind, method = 'GET') => bounded(async requestSignal => {
      const response = await fetchImpl(url, { method, signal: requestSignal, cache: 'no-store', credentials: 'same-origin', redirect: 'error', headers: { Accept: kind === 'json' ? 'application/json;odata=nometadata' : '*/*' } });
      if (response?.ok !== true || response.status < 200 || response.status >= 300 || response.redirected || response.url && new URL(response.url, release).href !== new URL(url, release).href) error('Recurso ausente, inacessível ou redirecionado.');
      const mime = (response.headers?.get?.('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (kind === 'json' ? mime !== 'application/json' : kind === 'css' ? mime !== 'text/css' : !['text/javascript', 'application/javascript', 'application/x-javascript', 'text/ecmascript', 'application/ecmascript'].includes(mime)) error('Tipo de conteúdo inválido; verifique os arquivos copiados da release.');
      const text = await boundedText(response, kind === 'json' ? 64 * 1024 : 2 * 1024 * 1024);
      if (!text.trim() || /^\s*(?:<!doctype\s+html|<html|<head|<body)/i.test(text)) error('Recurso vazio ou página HTML em vez do recurso esperado.');
      if (kind !== 'json') return text;
      try { return JSON.parse(text); } catch { error('SharePoint retornou JSON inválido.'); }
    });

    await check('storage', () => {
      const storage = storageProvider();
      if (!functions(storage, ['getItem', 'setItem', 'removeItem'])) error('Armazenamento privado gravável indisponível; nenhum diário será criado.');
      const key = `minijoomla:preflight:${context.webUrl}:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}:${Math.random()}`}`;
      const value = 'minijoomla-storage-probe';
      if (storage.getItem(key) !== null) error('Não foi possível reservar a sonda privada de armazenamento.');
      try { storage.setItem(key, value); if (storage.getItem(key) !== value) error('Armazenamento não confirmou gravação e leitura.'); }
      finally { storage.removeItem(key); }
      if (storage.getItem(key) !== null) error('Armazenamento não confirmou remoção da sonda privada.');
      return 'Sonda temporária gravada, lida e removida sem alterar o diário.';
    });
    await parallel(REQUIRED_INSTALLATION_MODULES, entry => check(`module:${entry.name}`, async () => {
      try {
        await read(new URL(entry.path, release).href, 'js');
        const load = moduleLoaders === undefined ? entry.load : moduleLoaders[entry.name];
        if (typeof load !== 'function') error('Importador obrigatório ausente.');
        const namespace = await bounded(() => load());
        if (!functions(namespace, entry.exports)) error('Contrato de exports incompatível.');
        const noRequests = () => error('Uma factory executou I/O durante a verificação de contrato.');
        if (entry.name === 'SPMIDDLE REST') {
          const client = namespace.createSharePointRestClient({ webUrl: context.webUrl, fetchImpl: noRequests, maxRetries: 0 });
          if (!functions(client, ['request', 'getDigest']) || (client.webUrl || '/') !== context.webUrl) error('Contrato do cliente REST incompatível.');
        }
        if (entry.name === 'SPMIDDLE files') {
          const client = namespace.createSharePointFileClient({ libraryPath: context.libraryPath, transport: { webUrl: context.webUrl, request: noRequests } });
          if (!functions(client, ['uploadFile', 'listFiles', 'listFoldersAll', 'listFilesAll', 'downloadFile'])) error('Contrato do cliente de arquivos incompatível.');
        }
        return `${entry.name}: importação real e contrato verificados.`;
      } catch (failure) { error(`${entry.path}: importação/contrato indisponível. Confira o pacote completo da mesma release (SPMIDDLE está vendorizado no ZIP). ${failure.message ?? ''}`); }
    }));
    await parallel(REQUIRED_INSTALLATION_ASSETS, path => check(`asset:${path}`, async () => {
      try { await read(new URL(path, release).href, path.endsWith('.css') ? 'css' : 'js'); return 'Recurso obrigatório da mesma release acessível.'; }
      catch (failure) { error(`${path}: ${failure.message ?? 'recurso indisponível'}`); }
    }));
    const web = context.webUrl === '/' ? '' : context.webUrl;
    let permissions;
    const webOk = await check('sharepoint-web', async () => {
      const data = await read(`${web}/_api/web?$select=Id,Url,ServerRelativeUrl,EffectiveBasePermissions`, 'json');
      const value = data?.d ?? data;
      if (!GUID.test(value?.Id ?? '') || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value.Id) || value.ServerRelativeUrl !== context.webUrl) error('O SharePoint não confirmou a identidade do web atual.');
      const url = new URL(value.Url);
      if (url.origin !== release.origin || (url.pathname.replace(/\/$/, '') || '/') !== context.webUrl || url.username || url.password || url.search || url.hash) error('O SharePoint respondeu para outro web.');
      permissions = value.EffectiveBasePermissions;
      return 'Identidade REST e URL do web atual verificadas.';
    });
    const permissionOk = await check('manage-lists', () => {
      const mask = value => typeof value === 'number' && Number.isSafeInteger(value) || typeof value === 'string' && /^-?\d{1,10}$/.test(value) ? Number(value) : NaN;
      const low = mask(permissions?.Low), high = mask(permissions?.High);
      if (!webOk || !Number.isSafeInteger(low) || !Number.isSafeInteger(high) || low < -2147483648 || high < -2147483648 || low > 4294967295 || high > 4294967295 || ((low >>> 0) & 2048) !== 2048) error('Permissão ManageLists não foi comprovada no web atual. Solicite permissão para gerenciar listas.');
      return 'Permissão efetiva ManageLists comprovada (bit 12).';
    });
    await check('request-digest', async () => {
      if (!permissionOk || checks.some(item => !item.ok)) error('Digest não solicitado: pré-requisitos obrigatórios da instalação indisponíveis.');
      const data = await read(`${web}/_api/contextinfo`, 'json', 'POST');
      const value = data?.GetContextWebInformation ?? data?.d?.GetContextWebInformation ?? data?.d ?? data;
      if (typeof value?.FormDigestValue !== 'string' || !value.FormDigestValue.trim() || value.FormDigestValue.length > 8192 || /[\u0000-\u001f\u007f]/.test(value.FormDigestValue) || !Number.isFinite(Number(value.FormDigestTimeoutSeconds)) || Number(value.FormDigestTimeoutSeconds) <= 30) error('SharePoint não forneceu um request digest válido e utilizável.');
      const url = new URL(value.WebFullUrl);
      if (url.origin !== release.origin || (url.pathname.replace(/\/$/, '') || '/') !== context.webUrl || url.username || url.password || url.search || url.hash) error('Request digest pertence a outro web.');
      return 'Request digest válido no web atual; nenhum segredo é incluído no relatório.';
    });
    return finish();
  };
}

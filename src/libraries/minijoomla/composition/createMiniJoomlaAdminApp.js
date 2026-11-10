/*
 * Composição real do painel administrativo do MINIJOOMLA — estende
 * createMiniJoomlaSharePointApp (composição base de leitura, inalterada)
 * com o serviço CRUD administrativo (admin-service.js) e, quando as
 * respectivas factories são informadas, o serviço de descoberta de
 * extensões (extension-discovery-service.js) e o serviço de upload de
 * imagens do editor (media-upload-service.js).
 *
 * Mantida separada de createMiniJoomlaSharePointApp.js de propósito: o
 * app público (src/index.js, bootstrap real já publicado) nunca precisa
 * do admin-service nem do createSharePointFileClient — só quem monta o
 * painel administrativo (src/administrator/components/com_minijoomla/) importa este módulo.
 *
 * `extensionsFileClientFactory`, quando informado, é uma função
 * `({ webUrl }) => fileClient` compatível com createSharePointFileClient
 * do SPMIDDLE (pacote sharepoint-files), já apontada para a pasta de
 * releases onde EXTENSIONS_FOLDER vive — esta composição não decide
 * libraryPath/credencial, apenas injeta o resultado no serviço de
 * descoberta. Sem essa factory, `discovery` fica `null` e o painel
 * "Extensões" deve ocultar a ação "Descobrir" (mas continua permitindo
 * listar/ativar/desativar o que já está registrado).
 */
import { createMiniJoomlaSharePointApp } from './createMiniJoomlaSharePointApp.js';
import { createAdminService } from '../application/admin-service.js';
import { createExtensionDiscoveryService } from '../application/extension-discovery-service.js';
import { createMediaUploadService } from '../application/media-upload-service.js';
import { createTemplateDiscoveryService } from '../application/extension-discovery-service.js';
import { createJoomlaDiscoveryService } from '../application/joomla-discovery.js';
import { createJoomlaExtensionInstaller } from '../application/joomla-extension-installer.js';
import { createAdminPluginsRuntime } from '../application/admin-plugins.js';

/*
 * `mediaFileClientFactory`, quando informado, segue o MESMO padrão de
 * `extensionsFileClientFactory` acima: `({ webUrl }) => fileClient`
 * compatível com createSharePointFileClient, já apontado para a pasta
 * de uploads real de imagens do TinyMCE (MEDIA_FOLDER, ver
 * application/media-upload-service.js). Sem essa factory, `media`
 * fica `null` e `attachRichTextEditor` nunca recebe um
 * `imageUploadHandler` — o TinyMCE então rejeita a inserção de
 * imagem na origem (ver src/administrator/components/com_minijoomla/editor.js), nunca insere um
 * `data:` URI inline.
 */
export function createMiniJoomlaAdminApp({ extensionsFileClientFactory, mediaFileClientFactory, pluginManager, importModule,
  joomlaDiscoveryRoots = [], joomlaFileClientFactory, assertAtomicExtensionKey, ...appOptions } = {}) {
  const app = createMiniJoomlaSharePointApp(appOptions);
  // An explicitly injected manager (including null to opt out) has precedence;
  // never load persisted plugins into a caller-owned/public manager. Deliberate
  // omission of lists.extensions keeps legacy partial compositions plugin-free;
  // a CONFIGURED catalog that fails to load must instead block article saves.
  let admin;
  const adminPlugins = pluginManager === undefined && app.repositories.extensions
    ? createAdminPluginsRuntime({ importModule, getPlugins: () => admin.extensions.list() }) : null;
  admin = createAdminService(app.repositories, { pluginManager: adminPlugins ?? pluginManager });
  const fileClient = typeof extensionsFileClientFactory === 'function' ? extensionsFileClientFactory({ webUrl: appOptions.webUrl }) : null;
  const legacy = fileClient ? createExtensionDiscoveryService(fileClient) : null;
  if (!Array.isArray(joomlaDiscoveryRoots)) throw new TypeError('joomlaDiscoveryRoots deve ser uma lista.');
  if (joomlaDiscoveryRoots.length && typeof joomlaFileClientFactory !== 'function') throw new TypeError('Raizes XML requerem joomlaFileClientFactory.');
  const discovery = joomlaDiscoveryRoots.length ? createJoomlaDiscoveryService({ legacy,
    roots: joomlaDiscoveryRoots.map((root) => ({ ...root, files: joomlaFileClientFactory({ webUrl: appOptions.webUrl, root }) })) }) : legacy;
  const templates = fileClient ? createTemplateDiscoveryService(fileClient) : null;
  const installer = joomlaDiscoveryRoots.length ? createJoomlaExtensionInstaller({ discovery, admin, repositories: app.repositories, assertAtomicKey: assertAtomicExtensionKey }) : null;
  const discoveryWithTemplates = discovery ? Object.freeze({ ...discovery, templates, ...(installer ? { installer } : {}) }) : null;
  const media = typeof mediaFileClientFactory === 'function'
    ? createMediaUploadService(mediaFileClientFactory({ webUrl: appOptions.webUrl }))
    : null;
  return Object.freeze({ ...app, admin, adminPlugins, discovery: discoveryWithTemplates, templates, media });
}

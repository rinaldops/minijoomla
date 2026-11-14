/*
 * Descoberta de extensões (equivalente à tela "Discover" do
 * com_installer do Joomla real — nunca ao upload/instalação de
 * com_installer, que exige extrair e executar código no servidor; ver
 * docs/CONTRATOS.md#minijoomla--integração-com-spmiddle-local-e-caminho-para-remoto e a decisão registrada na conversa
 * desta frente para a justificativa completa).
 *
 * Fluxo: o desenvolvedor copia manualmente os arquivos JS de um
 * módulo/plugin novo, mais um manifesto, para a pasta convencional
 * EXTENSIONS_FOLDER (dentro do mesmo RELEASE_BASE onde o resto do pacote
 * MINIJOOMLA já está publicado — ver docs/INSTALACAO.md#rollback-e-limites-de-aceite). Esta
 * função só LÊ essa pasta via createSharePointFileClient real do SPMIDDLE
 * (nunca grava nela, nunca executa o entrypoint) e devolve os manifestos
 * válidos encontrados; o registro em si (gravar em MiniJoomlaExtensions)
 * é uma ação explícita e separada do painel (admin-service.js,
 * extensions.create), nunca automática.
 *
 * Um manifesto na pasta, sozinho, nunca é executado por esta função nem
 * por qualquer outro código deste projeto: a extensão só é carregada em
 * runtime (src/index.js) depois que alguém a registra explicitamente pelo
 * painel, confirmando que o entrypoint é confiável.
 */
import { ValidationError, ownDataValue } from '../core/contracts.js';
import { extensionKey, sameSiteModuleUrl, templatePositions, templateStyles } from './extension-input.js';
import { normalizeParamDefinitions } from './declared-params.js';

export const EXTENSIONS_FOLDER = 'extensions';
export const TEMPLATES_FOLDER = 'templates';
const MANIFEST_SUFFIX = '.manifest.json';
const EXTENSION_TYPES = new Set(['Module', 'Plugin']);

function decodeManifestBytes(bytes) {
  if (bytes instanceof ArrayBuffer) return new TextDecoder('utf-8').decode(bytes);
  if (ArrayBuffer.isView(bytes)) return new TextDecoder('utf-8').decode(bytes);
  if (typeof bytes === 'string') return bytes;
  throw new ValidationError('Conteúdo do manifesto em formato inesperado.');
}

function validateManifest(key, raw) {
  extensionKey(key);
  const data = JSON.parse(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new ValidationError(`${key}: manifesto deve ser um objeto JSON.`);
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  const type = typeof data.type === 'string' ? data.type.trim() : '';
  const entryPointUrl = typeof data.entryPointUrl === 'string' ? data.entryPointUrl.trim() : '';
  if (!title) throw new ValidationError(`${key}: manifesto.title é obrigatório.`);
  if (!EXTENSION_TYPES.has(type)) throw new ValidationError(`${key}: manifesto.type deve ser "Module" ou "Plugin".`);
  if (!entryPointUrl) throw new ValidationError(`${key}: manifesto.entryPointUrl é obrigatório.`);
  sameSiteModuleUrl(entryPointUrl);
  if (data.params !== undefined) {
    // The pinned consumer reads values from ordinary objects. Reject inherited
    // names here without changing that consumer or rewriting raw definitions.
    for (const definition of normalizeParamDefinitions(data.params)) {
      if (Object.hasOwn(Object.prototype, definition.name)) throw new ValidationError(`${key}: nome de parâmetro reservado (${definition.name}).`);
    }
  }
  if (type === 'Plugin' && data.group !== undefined && data.group !== null) {
    if (typeof data.group !== 'string' || (data.group !== '' && !/^[a-z][a-z0-9_-]{0,39}$/.test(data.group.trim()))) throw new ValidationError(`${key}: manifesto.group inválido.`);
  }
  return { title, type, entryPointUrl, manifestJson: raw };
}

/*
 * `fileClient` é o resultado de createSharePointFileClient (pacote
 * sharepoint-files do SPMIDDLE), já apontado para RELEASE_BASE pela
 * composição que monta a aplicação admin — este módulo não decide
 * webUrl/libraryPath, apenas consome o cliente injetado.
 */
export function createTemplateDiscoveryService(fileClient) {
  if (!fileClient || typeof fileClient.listFiles !== 'function' || typeof fileClient.downloadFile !== 'function') throw new TypeError('fileClient deve ser o resultado de createSharePointFileClient.');
  async function scan() {
    const listed = await fileClient.listFiles({ folderPath: TEMPLATES_FOLDER });
    const files = listed?.data?.value ?? listed?.value ?? [];
    const manifests = files.filter((file) => typeof file?.Name === 'string' && file.Name.endsWith('.manifest.json'));
    const found = [];
    for (const file of manifests) {
      const key = file.Name.slice(0, -'.manifest.json'.length);
      try {
        extensionKey(key);
        const response = await fileClient.downloadFile({ folderPath: TEMPLATES_FOLDER, fileName: file.Name });
        const data = JSON.parse(decodeManifestBytes(response?.data ?? response));
        const title = typeof data.title === 'string' ? data.title.trim() : '';
        const version = typeof data.version === 'string' ? data.version.trim() : '';
        const entryPointUrl = typeof data.entryPointUrl === 'string' ? data.entryPointUrl.trim() : '';
        const positions = JSON.parse(templatePositions(data.positions));
        if (!title || !version || !entryPointUrl || !positions.length) throw new ValidationError(`${key}: manifesto de template incompleto.`);
        sameSiteModuleUrl(entryPointUrl);
        const normalizedStyles = templateStyles(data.styles);
        const styles = typeof data.styles === 'string' ? data.styles.trim() : normalizedStyles;
        const declarations = ownDataValue(data, 'paramDefinitions');
        const alias = Object.hasOwn(data, 'paramDefinitions') ? undefined : ownDataValue(data, 'params');
        const definitions = Object.hasOwn(data, 'paramDefinitions') ? declarations : Array.isArray(alias) ? alias : undefined;
        if (definitions !== undefined && !Array.isArray(definitions)) throw new ValidationError(`${key}: paramDefinitions deve ser uma lista.`);
        const paramDefinitions = normalizeParamDefinitions(definitions);
        found.push({ key, title, version, type: 'Template', entryPointUrl, styles, positions, paramDefinitions, discoveredFrom: `${TEMPLATES_FOLDER}/${file.Name}`, error: null });
      } catch (error) { found.push({ key, title: key, version: '', type: null, entryPointUrl: null, styles: '', positions: [], paramDefinitions: [], discoveredFrom: `${TEMPLATES_FOLDER}/${file.Name}`, error: error.message }); }
    }
    return found;
  }
  async function scanUnregistered(registered) { const keys = new Set((Array.isArray(registered) ? registered : []).map((item) => item.key)); return (await scan()).filter((item) => !keys.has(item.key)); }
  return Object.freeze({ scan, scanUnregistered });
}

export function createExtensionDiscoveryService(fileClient) {
  if (!fileClient || typeof fileClient.listFiles !== 'function' || typeof fileClient.downloadFile !== 'function') {
    throw new TypeError('fileClient deve ser o resultado de createSharePointFileClient.');
  }

  /*
   * Varre EXTENSIONS_FOLDER por arquivos `<key>.manifest.json`, lê e
   * valida cada um. Um manifesto malformado é reportado com seu erro
   * (`error`), nunca interrompe a varredura dos demais — equivalente ao
   * "Discover" real do Joomla, que lista o que encontrou mesmo quando uma
   * entrada individual tem problema.
   */
  async function scan() {
    const listed = await fileClient.listFiles({ folderPath: EXTENSIONS_FOLDER });
    const files = listed?.data?.value ?? listed?.value ?? [];
    const manifestFiles = files.filter((file) => typeof file?.Name === 'string' && file.Name.endsWith(MANIFEST_SUFFIX));
    const found = [];
    for (const file of manifestFiles) {
      const key = file.Name.slice(0, -MANIFEST_SUFFIX.length);
      try {
        const response = await fileClient.downloadFile({ folderPath: EXTENSIONS_FOLDER, fileName: file.Name });
        const manifest = validateManifest(key, decodeManifestBytes(response?.data ?? response));
        found.push({ key, discoveredFrom: `${EXTENSIONS_FOLDER}/${file.Name}`, ...manifest, error: null });
      } catch (error) {
        found.push({ key, discoveredFrom: `${EXTENSIONS_FOLDER}/${file.Name}`, title: key, type: null, entryPointUrl: null, error: error.message });
      }
    }
    return found;
  }

  /*
   * Compara o resultado de scan() com as extensões já registradas
   * (adminService.extensions.list()) e devolve só as que ainda não têm um
   * registro com a mesma `key` — o que o painel "Extensões" mostra como
   * "pronto para registrar".
   */
  async function scanUnregistered(registeredExtensions) {
    const registeredKeys = new Set((Array.isArray(registeredExtensions) ? registeredExtensions : []).map((extension) => extension.key));
    const scanned = await scan();
    return scanned.filter((entry) => !registeredKeys.has(entry.key));
  }

  return Object.freeze({ scan, scanUnregistered });
}

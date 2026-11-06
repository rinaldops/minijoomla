/*
 * Upload real de imagens inseridas no editor TinyMCE do painel
 * administrativo — resolve o bug real reportado pelo usuário: uma
 * imagem colada/arrastada no TinyMCE (sem este serviço) era inserida
 * como `<img src="data:image/...;base64,...">` (data URI inline), que
 * `src/libraries/minijoomla/security/sanitize.js` (safeUrl) bloqueia DE PROPÓSITO — `data:`
 * é um vetor real de XSS (poderia carregar HTML/SVG malicioso
 * disfarçado de imagem), não um bug do sanitizador. O artigo publicado
 * mostrava só um quadrado quebrado (`<img src="#">`) onde a imagem
 * deveria estar.
 *
 * Único caminho real e seguro de resolver isso: dar ao TinyMCE um
 * destino de upload real (equivalente ao `com_media` do Joomla real),
 * para que a imagem exista como um arquivo de verdade no SharePoint,
 * referenciada por uma URL normal (`/teams/.../uploads/<nome>.png`) —
 * nunca por afrouxar `safeUrl` para aceitar `data:`.
 *
 * `fileClient` é o resultado de createSharePointFileClient (pacote
 * sharepoint-files do SPMIDDLE, já vendorizado em
 * tmp/release-stage/*\/vendor/spmiddle/sharepoint-files/ — mesmo
 * princípio de injeção já usado por createExtensionDiscoveryService:
 * este módulo não decide webUrl/libraryPath, só consome o cliente
 * injetado pela composição que monta o bootstrap real.
 *
 * Nomeação de arquivo: nunca reaproveita o nome original do arquivo do
 * usuário (pode colidir com outro upload ou conter caracteres que o
 * SharePoint rejeita) — gera um nome próprio
 * `<timestamp>-<contador>.<extensão>` a partir do MIME type informado
 * pelo próprio `blobInfo` do TinyMCE (`blob.type`), nunca do nome de
 * arquivo original.
 */
import { ValidationError } from '../core/contracts.js';

export const MEDIA_FOLDER = 'uploads';
// Limite verificado aqui antes de chamar o cliente, inclusive no upload pelo TinyMCE.
export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;

const MIME_EXTENSIONS = Object.freeze({
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp'
});

export const MEDIA_MIME_TYPES = Object.freeze(Object.keys(MIME_EXTENSIONS));

let uploadCounter = 0;

function extensionForMimeType(mimeType) {
  const type = String(mimeType ?? '').toLowerCase();
  const extension = Object.hasOwn(MIME_EXTENSIONS, type) ? MIME_EXTENSIONS[type] : undefined;
  if (!extension) throw new ValidationError(`Tipo de imagem não suportado: ${mimeType || '(vazio)'}.`);
  return extension;
}

function generateFileName(mimeType, now) {
  uploadCounter = (uploadCounter + 1) % 100000;
  return `img-${now()}-${uploadCounter}.${extensionForMimeType(mimeType)}`;
}

/*
 * `fileClient` deve expor `uploadFile({ folderPath, fileName, content,
 * contentType, overwrite })` (contrato de createSharePointFileClient) —
 * falha alto e claro se não expuser, mesmo princípio já aplicado por
 * createExtensionDiscoveryService para `fileClient` inválido.
 */
export function createMediaUploadService(fileClient, { now = Date.now } = {}) {
  if (!fileClient || typeof fileClient.uploadFile !== 'function') {
    throw new TypeError('fileClient deve ser o resultado de createSharePointFileClient.');
  }

  /*
   * `content` é o `ArrayBuffer`/`Uint8Array` real dos bytes da imagem
   * (TinyMCE entrega isso via `blobInfo.blob()` + `FileReader`/
   * `arrayBuffer()`, nunca a string base64 em si — ver
   * src/administrator/components/com_minijoomla/editor.js, `images_upload_handler`). Devolve a URL
   * server-relative real do arquivo (`ServerRelativeUrl`), para uso
   * direto como `<img src="...">` — já aceita por `safeUrl` (caminho
   * absoluto a partir da raiz do site, mesmo formato que qualquer
   * outro link interno do MINIJOOMLA).
   *
   * Achado real (supervisão, inserção de imagem num artigo real): o
   * TinyMCE monta o editor dentro de um `<iframe>` próprio (confirmado
   * em produção: `editor.iframeElement`/`editor.getWin() !== window`).
   * Uma imagem colada/arrastada por um evento real do usuário produz um
   * `Blob`/`ArrayBuffer` pertencente ao REALM DO IFRAME, não ao da
   * janela principal — `content instanceof ArrayBuffer` falha nesse
   * caso mesmo sendo um `ArrayBuffer` genuíno (confirmado ao vivo:
   * `Object.prototype.toString.call(content)` continua
   * `"[object ArrayBuffer]"`; só `instanceof` quebra entre realms
   * diferentes). Rejeitar esse upload reproduzia exatamente o erro
   * relatado: "Failed to upload image: content deve ser um
    * ArrayBuffer/Uint8Array...". `imageBytes` verifica o brand nativo e
    * produz uma vista Uint8Array local, sem aceitar tags forjadas. Offsets
    * e comprimentos de subarrays/DataViews são preservados; strings base64
    * e `data:` URI continuam rejeitados.
   */
  function imageBytes(content) {
    try {
      if (ArrayBuffer.isView(content)) return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
      // Native brand check accepts another realm, but not a forged Symbol.toStringTag.
      const length = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get.call(content);
      return new Uint8Array(content, 0, length);
    } catch {
      throw new ValidationError('content deve ser um ArrayBuffer/Uint8Array com os bytes reais da imagem.');
    }
  }

  async function uploadImage({ content, mimeType } = {}) {
    const bytes = imageBytes(content);
    if (!bytes.byteLength) throw new ValidationError('A imagem está vazia.');
    if (bytes.byteLength > MEDIA_MAX_BYTES) throw new ValidationError('Imagem maior que o limite de 10 MiB.');
    // MIME declarado e tamanho são checados; não decodifica nem certifica a imagem.
    const type = String(mimeType ?? '').toLowerCase();
    const fileName = generateFileName(type, now);
    const response = await fileClient.uploadFile({
      folderPath: MEDIA_FOLDER, fileName, content: bytes, contentType: type, overwrite: false
    });
    const serverRelativeUrl = response?.data?.ServerRelativeUrl;
    if (typeof serverRelativeUrl !== 'string' || !serverRelativeUrl.startsWith('/') || serverRelativeUrl.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(serverRelativeUrl)) {
      throw new ValidationError('O SharePoint não retornou uma URL server-relative válida para o arquivo enviado.');
    }
    return { url: serverRelativeUrl };
  }

  /*
   * Gerenciador de mídia (com_media): lista os arquivos da pasta de uploads.
   * ponytail: no máximo 500 itens por consulta; paginar com $skiptoken se a pasta crescer.
   */
  async function list() {
    if (typeof fileClient.listFiles !== 'function') throw new ValidationError('O cliente de arquivos não permite listar a pasta de uploads.');
    const response = await fileClient.listFiles({ folderPath: MEDIA_FOLDER, query: '?$select=Name,ServerRelativeUrl,Length,TimeLastModified&$top=500' });
    const files = response?.data?.value ?? response?.data?.d?.results ?? response?.value ?? [];
    return files.filter((file) => typeof file?.Name === 'string' && file.ServerRelativeUrl).map((file) => ({
      name: file.Name, url: file.ServerRelativeUrl, size: Number(file.Length) || 0, modified: file.TimeLastModified ?? '',
      isImage: /\.(png|jpe?g|gif|webp)$/i.test(file.Name)
    })).sort((a, b) => String(b.modified).localeCompare(String(a.modified)) || a.name.localeCompare(b.name));
  }

  // Exclusão só existe se o fileClient a expuser (createSharePointFileClient atual não expõe).
  const remove = typeof fileClient.deleteFile === 'function'
    ? async (name) => {
      if (typeof name !== 'string' || !/^[\w.-]+$/.test(name) || name.startsWith('.')) throw new ValidationError('Nome de arquivo inválido.');
      await fileClient.deleteFile({ folderPath: MEDIA_FOLDER, fileName: name });
    }
    : undefined;

  return Object.freeze({ uploadImage, list, remove, canDelete: Boolean(remove) });
}

import { packagePath } from '../application/package-path.js';

const MAX_BYTES = 10 * 1024 * 1024;

/** Read-only bridge for revision assets anywhere inside the configured web.
 * The underlying SPMIDDLE file client must be rooted at webUrl, not at the
 * discovery library. Neither this port nor a download creates folders/files.
 */
export function createSharePointTemplateRevisionFiles({ fileClient, webUrl } = {}) {
  if (typeof fileClient?.downloadFile !== 'function') throw new TypeError('Cliente de leitura de revisão indisponível.');
  if (webUrl !== '/') {
    if (typeof webUrl !== 'string' || !webUrl.startsWith('/') || webUrl.endsWith('/')) throw new TypeError('Web de revisão inválido.');
    packagePath(webUrl.slice(1));
  }
  const web = webUrl === '/' ? '' : webUrl;
  return Object.freeze({
    async downloadFile({ folderPath, fileName, maxBytes = MAX_BYTES, signal } = {}) {
      // The service supplies full server-relative folders, including '' for a
      // file at the root web. Never accept siblings with a shared text prefix.
      if (typeof folderPath !== 'string') throw new TypeError('Pasta de revisão inválida.');
      if (folderPath !== web) {
        if (!folderPath.startsWith(`${web}/`)) throw new TypeError('Asset fora do web de revisão.');
        packagePath(folderPath.slice(web.length + 1));
      }
      packagePath(fileName);
      if (fileName.includes('/')) throw new TypeError('Nome de arquivo deve ser simples.');
      if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > MAX_BYTES) throw new TypeError('Limite de download inválido.');
      return fileClient.downloadFile({ folderPath: folderPath === web ? '' : folderPath.slice(web.length + 1), fileName, maxBytes, signal });
    }
  });
}

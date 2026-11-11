/** Host compatibility: REST represents web root as '', file client needs '/'. */
export function toSharePointFileTransport(transport) {
  if (!transport || typeof transport.request !== 'function' || typeof transport.webUrl !== 'string') throw new TypeError('Transporte de arquivos inválido.');
  return Object.freeze({ ...transport, webUrl: transport.webUrl || '/' });
}

/** Dedicated uploads directory only. Reading never creates folders; explicit
 * upload creates the missing child, not its base, and never retries a mutation.
 */
export function withSharePointMediaFolder({ fileClient, transport, libraryPath } = {}) {
  if (!fileClient || typeof fileClient.uploadFile !== 'function' || typeof fileClient.listFiles !== 'function' || !transport || typeof transport.request !== 'function') throw new TypeError('Cliente de mídia inválido.');
  const web = transport.webUrl === '/' ? '' : transport.webUrl;
  const safePath = value => typeof value === 'string' && value.length <= 1000 && value.startsWith('/') && !value.includes('//') && !/[\\?#%:'"<>\u0000-\u0020\u007f]/.test(value) && !value.endsWith('/') && !value.split('/').some(part=>part==='.'||part==='..');
  if (typeof web !== 'string' || web && !safePath(web) || !safePath(libraryPath) || !libraryPath.startsWith(`${web}/SiteAssets/`)) throw new TypeError('Destino de mídia inválido.');
  const api = `${web}/_api/web`;
  const uploads = `${libraryPath}/uploads`;
  const metadataUrl = path => `${api}/GetFolderByServerRelativePath(decodedurl='${path}')?$select=Exists,ServerRelativeUrl`;
  const missing = error => error?.status === 404;
  async function readFolder(path, allowMissing) {
    let response;
    try { response = await transport.request(metadataUrl(path), { method: 'GET' }); }
    catch (error) { if (allowMissing && missing(error)) return null; throw error; }
    if (allowMissing && response?.status === 404) return null;
    const folder = response?.data?.d ?? response?.data;
    if (!Number.isInteger(response?.status) || response.status < 200 || response.status >= 300 || folder?.Exists !== true || folder.ServerRelativeUrl !== path) throw new TypeError('Pasta de mídia não pôde ser verificada.');
    return folder;
  }
  const checkFolder = input => { if (input?.folderPath !== 'uploads') throw new TypeError('Somente a pasta de uploads é gerenciada.'); };
  return Object.freeze({
    ...fileClient,
    async listFiles(input) {
      checkFolder(input);
      if (await readFolder(uploads, true)) return fileClient.listFiles(input);
      // A missing package/base is not an empty, valid media directory.
      await readFolder(libraryPath, false);
      return { status: 200, data: { value: [] } };
    },
    async uploadFile(input) {
      checkFolder(input);
      if (!await readFolder(uploads, true)) {
        await readFolder(libraryPath, false);
        // Recheck next to POST; cross-browser uniqueness is the server's job.
        if (!await readFolder(uploads, true)) {
          const created = await transport.request(`${api}/folders/AddUsingPath(decodedurl='${uploads}')`, { method: 'POST' });
          const data = created?.data?.d ?? created?.data;
          if (!Number.isInteger(created?.status) || created.status < 200 || created.status >= 300 || data?.ServerRelativeUrl !== uploads) throw new TypeError('Criação da pasta de mídia sem confirmação.');
        }
        await readFolder(uploads, false);
      }
      return fileClient.uploadFile(input);
    }
  });
}

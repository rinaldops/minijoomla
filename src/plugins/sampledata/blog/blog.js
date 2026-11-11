import { JOOMLA_BLOG_DATA } from './data.js';

/** Package is data only. Host injects approved asset roots; no tenant or IDs here. */
export function createJoomlaBlogPackage({ releaseBase, mediaBase = new URL('../../../media/sampledata/joomla-blog/', import.meta.url).href } = {}) {
  if (typeof releaseBase !== 'string' || !releaseBase) throw new TypeError('Raiz da release não configurada.');
  const base = releaseBase.replace(/\/$/, '');
  const media = mediaBase.replace(/\/$/, '');
  const text = JSON.stringify(JOOMLA_BLOG_DATA)
    .replaceAll('__SAMPLE_RELEASE_BASE__', base).replaceAll('__SAMPLE_MEDIA_BASE__', media);
  const result = JSON.parse(text);
  // Native template behavior has not changed with patch releases. Keep the
  // original declared version for recognizing the already installed sample.
  return result;
}

export function sampleDataAssets() {
  return JOOMLA_BLOG_DATA.assets.map(asset => ({ ...asset }));
}

/** Only read assets inside the host-approved media root before offering install. */
export async function loadJoomlaBlogPackage({ releaseBase, mediaBase, fetchImpl = globalThis.fetch } = {}) {
  const pack = createJoomlaBlogPackage({ releaseBase, mediaBase });
  if (typeof fetchImpl !== 'function' || !globalThis.crypto?.subtle) throw new TypeError('Validação de recursos de exemplo indisponível.');
  const root = (mediaBase ?? new URL('../../../media/sampledata/joomla-blog/', import.meta.url).href).replace(/\/$/, '');
  for (const asset of sampleDataAssets()) {
    const response = await fetchImpl(`${root}/${asset.path}`, { cache: 'no-store' });
    if (!response.ok || response.redirected || !/^image\/jpeg\b/i.test(response.headers.get('content-type') ?? '')) throw new Error('Imagem de exemplo não disponível no pacote aprovado.');
    const announced = response.headers.get('content-length');
    if (announced !== null && Number(announced) > asset.bytes) { await response.body?.cancel(); throw new Error('Imagem de exemplo excede o tamanho aprovado.'); }
    let bytes;
    if (response.body?.getReader) {
      const reader = response.body.getReader(), chunks = []; let total = 0;
      try {
        while (true) { const part = await reader.read(); if (part.done) break; total += part.value.byteLength; if (total > asset.bytes) { await reader.cancel(); throw new Error('Imagem de exemplo excede o tamanho aprovado.'); } chunks.push(part.value); }
      } finally { reader.releaseLock(); }
      const output = new Uint8Array(total); let offset = 0;
      for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
      bytes = output.buffer;
    } else bytes = await response.arrayBuffer();
    if (bytes.byteLength !== asset.bytes) throw new Error('Imagem de exemplo diverge do pacote aprovado.');
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
    if (bytes.byteLength !== asset.bytes || hash !== asset.sha256) throw new Error('Imagem de exemplo diverge do pacote aprovado.');
  }
  return pack;
}

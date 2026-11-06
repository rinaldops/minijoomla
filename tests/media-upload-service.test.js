import assert from 'node:assert/strict';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { createMediaUploadService, MEDIA_FOLDER, MEDIA_MAX_BYTES } from '../src/libraries/minijoomla/application/media-upload-service.js';

/*
 * Fake compatível com o shape de resposta de createSharePointFileClient
 * (pacote sharepoint-files do SPMIDDLE): uploadFile devolve
 * `{ data: { ServerRelativeUrl, ... } }` (shape REST real de
 * .../Files/add(...), confirmado contra o tenant real nesta sessão).
 */
function createFakeFileClient({ fails = false } = {}) {
  const calls = [];
  return {
    calls,
    async uploadFile(input) {
      calls.push(input);
      assert.equal(input.folderPath, MEDIA_FOLDER);
      if (fails) return { data: {} };
      return { data: { ServerRelativeUrl: `/teams/SAPScripting/SiteAssets/minijoomla/uploads/${input.fileName}` } };
    }
  };
}

export async function runMediaUploadServiceTests() {
  // 1. upload real: content chega intacto ao fileClient, nome gerado (nunca o nome original do usuário), extensão derivada do MIME type real.
  const now = () => 1700000000000;
  const service = createMediaUploadService(createFakeFileClient(), { now });
  const content = new Uint8Array([1, 2, 3]).buffer;
  const result = await service.uploadImage({ content, mimeType: 'image/png' });
  assert.match(result.url, /^\/teams\/SAPScripting\/SiteAssets\/minijoomla\/uploads\/img-1700000000000-\d+\.png$/);

  // 2. cada upload recebe um nome distinto, mesmo no mesmo timestamp (contador incremental), nunca uma colisão silenciosa.
  const second = await service.uploadImage({ content, mimeType: 'image/png' });
  assert.notEqual(result.url, second.url);

  // 3. extensão real é derivada do MIME type informado, não de um nome de arquivo (o `blobInfo` do TinyMCE não garante nome com extensão correta).
  const jpeg = await service.uploadImage({ content, mimeType: 'image/jpeg' });
  assert.match(jpeg.url, /\.jpg$/);

  // 4. MIME type fora da allowlist conhecida falha alto e claro, nunca aceita silenciosamente um tipo arbitrário.
  await assert.rejects(() => service.uploadImage({ content, mimeType: 'application/pdf' }), /tipo de imagem|não suportado/i);
  await assert.rejects(() => service.uploadImage({ content, mimeType: '' }), /tipo de imagem|não suportado/i);

  // 5. content que não é ArrayBuffer/Uint8Array (ex.: uma string base64) é rejeitado antes de alcançar o fileClient — nunca reintroduz o bug real do data: URI por outro caminho.
  await assert.rejects(() => service.uploadImage({ content: 'aGVsbG8=', mimeType: 'image/png' }), /ArrayBuffer|Uint8Array|bytes/i);

  // 6. resposta do SharePoint sem ServerRelativeUrl (upload que "deu certo" sem devolver onde o arquivo foi salvo) falha alto e claro, nunca devolve uma URL undefined/vazia usável no editor.
  const brokenService = createMediaUploadService(createFakeFileClient({ fails: true }));
  await assert.rejects(() => brokenService.uploadImage({ content, mimeType: 'image/png' }), /URL/i);

  // 7. fileClient inválido (sem o contrato esperado) falha alto e claro, mesmo princípio já aplicado por createExtensionDiscoveryService.
  assert.throws(() => createMediaUploadService({}), TypeError);
  assert.throws(() => createMediaUploadService(null), TypeError);

  // 8. achado real (supervisão, inserção de imagem num artigo real): o TinyMCE monta o
  // editor dentro de um <iframe> próprio; uma imagem colada/arrastada por um evento real
  // do usuário produz um ArrayBuffer pertencente ao REALM DO IFRAME, não ao da janela
  // principal — `instanceof ArrayBuffer` falha nesse caso mesmo sendo um ArrayBuffer
  // genuíno (reproduzido aqui com um realm Node real via node:vm, não um mock). O erro
  // relatado ("Failed to upload image: content deve ser um ArrayBuffer/Uint8Array...")
  // reproduz-se com o content antigo e deixa de ocorrer com a normalização atual.
  const otherRealm = vm.createContext();
  const crossRealmBuffer = vm.runInContext('new ArrayBuffer(4)', otherRealm);
  assert.equal(crossRealmBuffer instanceof ArrayBuffer, false, 'pré-condição: o ArrayBuffer de outro realm não deve ser instanceof neste realm');
  const crossRealmService = createMediaUploadService(createFakeFileClient(), { now });
  const crossRealmResult = await crossRealmService.uploadImage({ content: crossRealmBuffer, mimeType: 'image/png' });
  assert.match(crossRealmResult.url, /\.png$/);
  const sentContent = (await (async () => {
    const calls = [];
    const captureClient = { async uploadFile(input) { calls.push(input); return { data: { ServerRelativeUrl: '/x/y.png' } }; } };
    const captureService = createMediaUploadService(captureClient, { now });
    await captureService.uploadImage({ content: crossRealmBuffer, mimeType: 'image/png' });
    return calls[0].content;
  })());
  assert.ok(ArrayBuffer.isView(sentContent), 'content enviado ao fileClient deve ser um TypedArray realm-safe (ArrayBuffer.isView), nunca o ArrayBuffer de outro realm repassado cru');

  // 9. um objeto que finge ser um ArrayBuffer só por ter `byteLength` numérico (nunca a tag interna real) continua rejeitado — a normalização para outro realm não relaxa a validação de forma/tag.
  await assert.rejects(() => crossRealmService.uploadImage({ content: { byteLength: 4 }, mimeType: 'image/png' }), /ArrayBuffer|Uint8Array|bytes/i);

  const boundedClient = createFakeFileClient();
  const bounded = createMediaUploadService(boundedClient, { now });
  const forgedBuffer = { [Symbol.toStringTag]: 'ArrayBuffer', byteLength: 3, length: 3, 0: 1, 1: 2, 2: 3 };
  for (const invalid of [new ArrayBuffer(0), new Uint8Array(MEDIA_MAX_BYTES + 1), forgedBuffer]) {
    await assert.rejects(() => bounded.uploadImage({ content: invalid, mimeType: 'image/png' }), /vazi|limite|bytes|ArrayBuffer/i);
  }
  for (const mimeType of ['__proto__', 'constructor', 'application/pdf']) {
    await assert.rejects(() => bounded.uploadImage({ content, mimeType }), /não suportado/i);
  }
  assert.equal(boundedClient.calls.length, 0, 'invalid bytes, limits and inherited MIME keys fail before uploadFile');
  const detached = new ArrayBuffer(4);
  structuredClone(detached, { transfer: [detached] });
  await assert.rejects(() => bounded.uploadImage({ content: detached, mimeType: 'image/png' }), /bytes|ArrayBuffer/i);
  assert.equal(boundedClient.calls.length, 0);

  const backing = new Uint8Array([99, 1, 2, 3, 88]);
  const foreignView = vm.runInNewContext('new Uint8Array([99, 1, 2, 3, 88]).subarray(1, 4)');
  for (const view of [backing.subarray(1, 4), new DataView(backing.buffer, 1, 3), foreignView]) {
    await bounded.uploadImage({ content: view, mimeType: 'IMAGE/PNG' });
    const sent = boundedClient.calls.at(-1);
    assert.equal(sent.content.constructor, Uint8Array, 'transport always gets a local byte view');
    assert.deepEqual([...sent.content], [1, 2, 3], 'offset/length are bytes, never the entire backing buffer');
    assert.equal(sent.contentType, 'image/png');
    assert.equal(sent.overwrite, false);
  }
  await bounded.uploadImage({ content: new Uint8Array(MEDIA_MAX_BYTES), mimeType: 'image/png' });
  assert.equal(boundedClient.calls.at(-1).content.byteLength, MEDIA_MAX_BYTES, 'the exact documented limit is accepted');
  await bounded.uploadImage({ content: new Uint8Array(new ArrayBuffer(MEDIA_MAX_BYTES + 10), 5, 3), mimeType: 'image/png' });
  assert.equal(boundedClient.calls.at(-1).content.byteLength, 3, 'a small view of a large buffer is not an oversized upload');

  for (const url of [undefined, '', 7, {}, 'javascript:alert(1)', 'https://other.example/image.png', '//other.example/image.png', '/uploads/\\x.png', '/uploads/x\n.png']) {
    let uploads = 0;
    const invalidResponse = createMediaUploadService({ async uploadFile() { uploads++; return { data: { ServerRelativeUrl: url } }; } }, { now });
    await assert.rejects(() => invalidResponse.uploadImage({ content, mimeType: 'image/png' }), /URL/i);
    assert.equal(uploads, 1, 'an invalid acknowledgement occurs after upload; never silently retry or pretend no file was sent');
  }
  const originalFailure = Object.assign(new Error('transport failed'), { code: 'unavailable' });
  const failed = createMediaUploadService({ uploadFile: async () => { throw originalFailure; } });
  await assert.rejects(() => failed.uploadImage({ content, mimeType: 'image/png' }), (error) => error === originalFailure);

  console.log('ok - media upload: envia os bytes reais da imagem e devolve a URL real do arquivo, com nome gerado e extensão derivada do MIME type');
  console.log('ok - media upload: rejeita MIME type não suportado e conteúdo que não são bytes reais (nunca reabre o bug do data: URI por outro caminho)');
  console.log('ok - media upload: resposta do SharePoint sem ServerRelativeUrl e fileClient inválido falham alto e claro');
  console.log('ok - media upload: aceita um ArrayBuffer de outro realm (ex.: produzido dentro do <iframe> do editor TinyMCE), normalizando para um TypedArray local, e continua rejeitando um objeto que só finge ter a forma de um ArrayBuffer');
  console.log('ok - media upload: strict byte brand/size/MIME checks before transport, exact local byte views and server-relative acknowledgements without retries');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runMediaUploadServiceTests();

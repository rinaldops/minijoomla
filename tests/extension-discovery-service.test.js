import assert from 'node:assert/strict';
import { createExtensionDiscoveryService, createTemplateDiscoveryService, EXTENSIONS_FOLDER, TEMPLATES_FOLDER } from '../src/libraries/minijoomla/application/extension-discovery-service.js';

/*
 * Fake compatível com o shape de resposta de createSharePointFileClient
 * (pacote sharepoint-files do SPMIDDLE): listFiles devolve `{ data: { value: [...] } }`
 * (lista de arquivos com `Name`), downloadFile devolve `{ data: <bytes> }`.
 */
function createFakeFileClient(files) {
  return {
    async listFiles({ folderPath } = {}) {
      assert.equal(folderPath, EXTENSIONS_FOLDER);
      return { data: { value: Object.keys(files).map((name) => ({ Name: name })) } };
    },
    async downloadFile({ folderPath, fileName } = {}) {
      assert.equal(folderPath, EXTENSIONS_FOLDER);
      if (!(fileName in files)) throw new Error('arquivo não encontrado');
      const contents = files[fileName];
      return { data: typeof contents === 'string' ? new TextEncoder().encode(contents).buffer : contents };
    }
  };
}

export async function runExtensionDiscoveryServiceTests() {
  const templateFileClient = {
    async listFiles({ folderPath } = {}) {
      assert.equal(folderPath, TEMPLATES_FOLDER);
      return { data: { value: [{ Name: 'camap.manifest.json' }, { Name: 'broken.manifest.json' }] } };
    },
    async downloadFile({ folderPath, fileName } = {}) {
      assert.equal(folderPath, TEMPLATES_FOLDER);
      const manifests = {
        'camap.manifest.json': JSON.stringify({ title: 'CAMAP', version: '0.1.0', entryPointUrl: '/templates/camap.js', styles: '/templates/camap.css', positions: ['menu', 'main-top', 'footer'], params: { unrelated: true }, group: '../not-a-plugin' }),
        'broken.manifest.json': '{}'
      };
      return { data: new TextEncoder().encode(manifests[fileName]).buffer };
    }
  };
  const templateService = createTemplateDiscoveryService(templateFileClient);
  const templates = await templateService.scan();
  assert.deepEqual(templates.find((entry) => entry.key === 'camap'), { key: 'camap', title: 'CAMAP', version: '0.1.0', type: 'Template', entryPointUrl: '/templates/camap.js', styles: '/templates/camap.css', positions: ['menu', 'main-top', 'footer'], paramDefinitions: [], discoveredFrom: 'templates/camap.manifest.json', error: null });
  assert.equal(Object.hasOwn(templates[0], 'manifestJson'), false, 'template discovery keeps its distinct contract and validation');
  assert.notEqual(templates.find((entry) => entry.key === 'broken').error, null);
  console.log('ok - template discovery: manifesto válido é descoberto e manifesto incompleto é reportado');
  // 1. manifesto válido é encontrado e devolvido com os campos do contrato.
  const helloManifest = JSON.stringify({ title: 'Hello Module', type: 'Module', entryPointUrl: '../extensions/hello-module.js' });
  const service = createExtensionDiscoveryService(createFakeFileClient({
    'hello-module.manifest.json': helloManifest,
    'hello-module.js': 'export const render = () => "<p>Hello</p>";', // arquivo real do módulo, ignorado pelo scan (não termina em .manifest.json)
    'broken.manifest.json': '{ not valid json'
  }));
  const scanned = await service.scan();
  assert.equal(scanned.length, 2);
  const valid = scanned.find((entry) => entry.key === 'hello-module');
  assert.deepEqual(valid, { key: 'hello-module', discoveredFrom: 'extensions/hello-module.manifest.json', title: 'Hello Module', type: 'Module', entryPointUrl: '../extensions/hello-module.js', manifestJson: helloManifest, error: null });

  // 2. manifesto malformado não interrompe a varredura: aparece com `error` preenchido, não lança.
  const broken = scanned.find((entry) => entry.key === 'broken');
  assert.equal(broken.error !== null, true);
  assert.equal(broken.type, null);
  assert.equal(broken.entryPointUrl, null);
  assert.equal(Object.hasOwn(broken, 'manifestJson'), false);

  // 3. manifesto com campo obrigatório ausente também é reportado com erro, não registrado silenciosamente como válido.
  const missingFieldService = createExtensionDiscoveryService(createFakeFileClient({
    'incompleto.manifest.json': JSON.stringify({ title: 'Sem tipo' })
  }));
  const [incompleto] = await missingFieldService.scan();
  assert.match(incompleto.error, /type/);

  // 4. scanUnregistered filtra o que já tem uma extensão registrada com a mesma key.
  const unregistered = await service.scanUnregistered([{ key: 'hello-module' }]);
  assert.deepEqual(unregistered.map((entry) => entry.key), ['broken']);
  assert.deepEqual(await service.scanUnregistered([]), scanned);

  const unsafeService = createExtensionDiscoveryService(createFakeFileClient({
    'unsafe.manifest.json': JSON.stringify({ title: 'Unsafe', type: 'Plugin', entryPointUrl: 'data:text/javascript,alert(1)' }),
    'bad key.manifest.json': JSON.stringify({ title: 'Bad key', type: 'Module', entryPointUrl: '/ok.js' })
  }));
  assert.ok((await unsafeService.scan()).every((entry) => entry.error && entry.type === null && entry.entryPointUrl === null && !Object.hasOwn(entry, 'manifestJson')), 'unsafe entrypoints/invalid keys are never offered for registration');

  // 4b. a descoberta por arquivo REJEITA entryPointUrl de outra origem HTTPS
  // (não só javascript:/data:/credenciais): um manifesto na pasta nunca pode
  // apontar para código hospedado fora do próprio site, porque o runtime
  // importa esse entrypoint diretamente no navegador do visitante/admin
  // (modules/dynamic-modules.js). Mesma regra exigida do instalador manual
  // (parseExtensionManifest) — a descoberta por pasta não pode ser uma porta
  // mais frouxa para o mesmo risco.
  const crossOriginService = createExtensionDiscoveryService(createFakeFileClient({
    'cross-origin.manifest.json': JSON.stringify({ title: 'Cross Origin', type: 'Module', entryPointUrl: 'https://evil.example/x.js' })
  }));
  const [crossOriginEntry] = await crossOriginService.scan();
  assert.match(crossOriginEntry.error, /pr[oó]prio site/);
  assert.equal(crossOriginEntry.type, null);
  assert.equal(crossOriginEntry.entryPointUrl, null);
  assert.equal(Object.hasOwn(crossOriginEntry, 'manifestJson'), false);

  const crossOriginTemplateService = createTemplateDiscoveryService({
    async listFiles() { return { value: [{ Name: 'cross-origin.manifest.json' }] }; },
    async downloadFile() { return JSON.stringify({ title: 'Template', version: '1', entryPointUrl: 'https://evil.example/t.js', positions: ['footer'] }); }
  });
  const [crossOriginTemplate] = await crossOriginTemplateService.scan();
  assert.match(crossOriginTemplate.error, /pr[oó]prio site/);
  assert.equal(crossOriginTemplate.entryPointUrl, null);

  const invalidTemplateService = createTemplateDiscoveryService({
    async listFiles() { return { value: [{ Name: 'bad.manifest.json' }, { Name: 'array-css.manifest.json' }] }; },
    async downloadFile({ fileName }) { return JSON.stringify({ title: 'Template', version: '1', entryPointUrl: '/template.js', positions: fileName === 'bad.manifest.json' ? ['not a position'] : ['footer'], styles: ['/template.css'] }); }
  });
  const mixedTemplates = await invalidTemplateService.scan();
  assert.ok(mixedTemplates[0].error);
  assert.equal(mixedTemplates[1].error, null);
  assert.equal(mixedTemplates[1].styles, '["/template.css"]');

  // 5. fileClient inválido (sem o contrato esperado) falha alto e claro, não silenciosamente.
  assert.throws(() => createExtensionDiscoveryService({}), TypeError);
  assert.throws(() => createExtensionDiscoveryService(null), TypeError);

  await rawManifestTests();
  await invalidMetadataTests();
  await reservedParamNameTests();
  await dataOnlyDiscoveryTests();

  console.log('ok - extension discovery: encontra manifesto válido com o contrato esperado, ignora arquivos que não são manifesto');
  console.log('ok - extension discovery: manifesto malformado ou incompleto é reportado com erro, nunca interrompe a varredura nem é tratado como válido');
  console.log('ok - extension discovery: scanUnregistered filtra extensões já registradas pela mesma key');
  console.log('ok - extension discovery: entryPointUrl de outra origem HTTPS é rejeitado tanto para extensões quanto para templates, nunca só javascript:/data:/credenciais');
}

async function rawManifestTests() {
  const raw = ' \r\n{\n  "key": "not-the-filename", "title": "  Extensão ç 🚀  ",\n  "type": " Plugin ", "entryPointUrl": " ../extensions/raw.mjs?v=1 ",\n  "group": "system", "version": "1.2", "future": {"enabled": true, "escaped": "\\u006b\\u0065\\u0065\\u0070", "nested": [null, {"keep": "  original  "}]},\n  "params": [{"name": " mode ", "type": "select", "options": ["safe", "fast"], "default": "safe", "future": 42}]\n}\t\r\n';
  const bytes = new TextEncoder().encode(raw);
  const padded = new Uint8Array(bytes.length + 4);
  padded.set(bytes, 2);
  // Direct/wrapped responses and UTF-8 buffers/views use the same raw string.
  for (const payload of [raw, bytes.buffer, bytes, padded.subarray(2, bytes.length + 2), new DataView(padded.buffer, 2, bytes.length)]) {
    for (const wrapped of [false, true]) {
      const discovery = createExtensionDiscoveryService({
        async listFiles() { return { value: [{ Name: 'raw-plugin.manifest.json' }] }; },
        async downloadFile() { return wrapped ? { data: payload } : payload; }
      });
      const [entry] = await discovery.scan();
      assert.deepEqual(entry, { key: 'raw-plugin', discoveredFrom: 'extensions/raw-plugin.manifest.json', title: 'Extensão ç 🚀', type: 'Plugin', entryPointUrl: '../extensions/raw.mjs?v=1', manifestJson: raw, error: null });
      assert.deepEqual(new TextEncoder().encode(entry.manifestJson), bytes, 'UTF-8 whitespace, escapes and unknown metadata survive decoding unchanged');
      assert.equal(JSON.parse(entry.manifestJson).params[0].name, ' mode ', 'definition validation must not rewrite raw metadata');
      assert.deepEqual(await discovery.scanUnregistered([{ key: 'other' }]), [entry]);
      assert.deepEqual(await discovery.scanUnregistered([{ key: entry.key }]), []);
      assert.deepEqual(await discovery.scanUnregistered(null), [entry]);
    }
  }
  for (const metadata of [{}, { group: '' }, { group: null }, { group: 'content' }, { group: ' \tcontent\r\n' }, { group: 'custom_group-1' }, { group: `a${'1'.repeat(39)}` }, { params: null }, { params: '' }, { params: '[]' }, { params: '[{"name":" label ","type":"text","default":"Safe","future":true}]' }]) {
    const manifestJson = JSON.stringify({ title: 'Legacy', type: 'Plugin', entryPointUrl: './legacy.js', ...metadata });
    const [entry] = await createExtensionDiscoveryService(createFakeFileClient({ 'legacy.manifest.json': manifestJson })).scan();
    assert.equal(entry.error, null, 'optional metadata retains the existing definitions/group acceptance rules');
    assert.equal(entry.manifestJson, manifestJson);
  }
  const moduleManifest = JSON.stringify({ title: 'Module', type: 'Module', entryPointUrl: './module.js', group: { ignored: 'not a plugin group' } });
  const [module] = await createExtensionDiscoveryService(createFakeFileClient({ 'module.manifest.json': moduleManifest })).scan();
  assert.equal(module.error, null);
  assert.equal(module.manifestJson, moduleManifest, 'Module group is preserved as uninterpreted metadata');
  console.log('ok - extension discovery: raw string/UTF-8 buffers/views preserve whitespace and unknown fields while identity uses the filename');
}

async function invalidMetadataTests() {
  const cases = [
    ['invalid-json', '{broken', /JSON|property|position|Unexpected/i],
    ['json-array', '[]', /objeto JSON/],
    ['json-null', 'null', /objeto JSON/],
    ['params-object', { params: {} }, /params/],
    ['params-json', { params: '{broken' }, /params/],
    ['params-type', { params: [{ name: 'code', type: 'javascript' }] }, /tipo não suportado/],
    ['params-duplicate', { params: [{ name: 'mode' }, { name: ' mode ' }] }, /duplicado/],
    ['params-name', { params: [{ name: 'bad.name' }] }, /Nome de parâmetro inválido/],
    ['params-select', { params: [{ name: 'mode', type: 'select', options: [] }] }, /options/],
    ['params-default', { params: [{ name: 'limit', type: 'number', min: 1, default: 0 }] }, /maior ou igual/],
    ...['System', '../system', 'two groups', '1group', 'a'.repeat(41), [], [null], ['content'], true, false, 0, 1, {}, { value: 'content' }, ' ', '\t\r\n', '\u00a0'].map((group, index) => [`group-${index}`, { group }, /group/]),
    ...['javascript:alert(1)', 'data:text/javascript,alert(1)', '//evil.example/x.js', 'https://evil.example/x.js', '/module.css', '/bad path.js', 'http://['].map((entryPointUrl, index) => [`url-${index}`, { entryPointUrl }, /entryPointUrl/]),
    ['template', { type: 'Template' }, /type/]
  ];
  const files = Object.fromEntries(cases.map(([key, data]) => [`${key}.manifest.json`, typeof data === 'string' ? data : JSON.stringify({ title: 'Invalid', type: 'Plugin', entryPointUrl: './invalid.js', ...data })]));
  files['last-valid.manifest.json'] = '{"title":"Valid","type":"Module","entryPointUrl":"./valid.js","params":[]}';
  const discovery = createExtensionDiscoveryService(createFakeFileClient(files));
  const scanned = await discovery.scan();
  for (const [key, , errorPattern] of cases) {
    const entry = scanned.find((item) => item.key === key);
    assert.match(entry.error, errorPattern);
    assert.equal(entry.type, null);
    assert.equal(entry.entryPointUrl, null);
    assert.equal(Object.hasOwn(entry, 'manifestJson'), false, 'invalid entries never expose actionable metadata');
  }
  assert.equal(scanned.at(-1).error, null, 'one invalid manifest must not interrupt subsequent downloads');
  const filtered = await discovery.scanUnregistered([{ key: 'last-valid' }, { key: 'params-duplicate' }]);
  assert.deepEqual(filtered, scanned.filter((entry) => !['last-valid', 'params-duplicate'].includes(entry.key)));
  console.log('ok - extension discovery: invalid/duplicate params, plugin groups, JSON and URLs fail closed without changing template rules');
}

async function reservedParamNameTests() {
  const names = Object.getOwnPropertyNames(Object.prototype);
  for (const name of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', '__proto__']) assert.ok(names.includes(name));
  const files = {};
  let index = 0;
  for (const type of ['Plugin', 'Module']) {
    for (const name of names) {
      for (const paramType of ['text', 'textarea', 'number', 'checkbox', 'select', 'color', 'url']) {
        for (const padded of [false, true]) {
          const definitions = [{ name: padded ? ` \t${name}\r\n` : name, type: paramType, ...(paramType === 'select' ? { options: ['safe'] } : {}) }];
          for (const params of [definitions, JSON.stringify(definitions)]) {
            files[`reserved-${index++}.manifest.json`] = JSON.stringify({ title: 'Reserved', type, entryPointUrl: './reserved.js', params });
          }
        }
      }
    }
  }
  const discovery = createExtensionDiscoveryService(createFakeFileClient(files));
  const scanned = await discovery.scan();
  assert.equal(scanned.length, index);
  for (const entry of scanned) {
    assert.match(entry.error, /nome de parâmetro (reservado|inválido)/i, 'all prototype names fail closed, including names already rejected by the definitions grammar');
    assert.equal(entry.type, null);
    assert.equal(entry.entryPointUrl, null);
    assert.equal(Object.hasOwn(entry, 'manifestJson'), false);
  }
  assert.deepEqual(await discovery.scanUnregistered([]), scanned);
  console.log(`ok - extension discovery: ${index} reserved-name cases fail closed across Module/Plugin, all parameter types, trimmed names and array/JSON-string definitions`);
}

async function dataOnlyDiscoveryTests() {
  const client = createFakeFileClient({
    'never-import.manifest.json': '{"title":"Data only","type":"Plugin","entryPointUrl":"./missing-never-import.js","future":"throw new Error()"}',
    'missing-never-import.js': 'throw new Error("JavaScript must never execute during discovery");',
    'readme.txt': 'ignored',
    'other.json': '{}'
  });
  const downloads = [];
  const discovery = createExtensionDiscoveryService({ ...client,
    async downloadFile(input) {
      downloads.push(input.fileName);
      assert.ok(input.fileName.endsWith('.manifest.json'), 'entrypoint JS is never downloaded');
      return client.downloadFile(input);
    }
  });
  const [entry] = await discovery.scan();
  assert.equal(entry.error, null, 'a nonexistent relative JS entrypoint is not imported or resolved during discovery');
  assert.deepEqual(await discovery.scanUnregistered([]), [entry]);
  assert.deepEqual(downloads, ['never-import.manifest.json', 'never-import.manifest.json']);
  console.log('ok - extension discovery: scan and scanUnregistered read manifests only, never execute/import entrypoint JS');
}

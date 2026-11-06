import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createDemoRepositories } from '../examples/demo-repositories.js';
import { attachRichTextEditor } from '../src/administrator/components/com_minijoomla/editor.js';
import { createMediaUploadService } from '../src/libraries/minijoomla/application/media-upload-service.js';
import { createApplication } from '../src/index.js';
import { createFakeAdapter } from '../src/libraries/minijoomla/infrastructure/fake-adapter.js';

const check = (condition, message) => { if (!condition) throw new Error(message); };
async function until(predicate, message) {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(message);
}
function fixture() {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const repositories = createDemoRepositories({ storage });
  return { repositories, service: createAdminService(repositories), values };
}

// Native TinyMCE + actual form submission, but NO tenant or real file writes.
export async function runFinalEditorDomTests(documentRef = globalThis.document, { imageUrl = '/tmp/sol-final-pixel.png' } = {}) {
  const { repositories, service, values } = fixture();
  const root = documentRef.createElement('div');
  documentRef.body.append(root);
  const uploads = [];
  const media = createMediaUploadService({ uploadFile: async (input) => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    uploads.push(input);
    return { data: { ServerRelativeUrl: imageUrl } };
  } });
  const app = createAdminApplication({ adminService: service, documentRef: { body: root }, autoStart: false,
    richTextEditorFactory: (id, options) => attachRichTextEditor(id, { vendorBaseUrl: '/src/media/vendor/tinymce', uploadImage: media.uploadImage, ...options })
  });
  const checks = [];
  const editor = () => globalThis.tinymce.get('admin-field-articles-articletext');
  try {
    await app.router.navigate('#/articles/new');
    check(editor()?.initialized, 'TinyMCE did not initialize');
    root.querySelector('[name="title"]').value = 'Aceite nativo final';
    root.querySelector('[name="alias"]').value = 'aceite-nativo-final';
    root.querySelector('[name="state"]').value = 'Published';
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6VAAAAABJRU5ErkJggg==';
    const win = editor().getWin();
    const bytes = new win.Uint8Array([...atob(b64)].map((char) => char.charCodeAt(0)));
    const blob = new win.Blob([bytes], { type: 'image/png' });
    const cached = editor().editorUpload.blobCache.create('final-native-image', blob, b64);
    editor().editorUpload.blobCache.add(cached);
    editor().setContent(`<p>Introdução <strong>formatada</strong></p><hr id="system-readmore"><p>Corpo completo</p><img src="${cached.blobUri()}" alt="Pixel de aceite">`);
    root.querySelector('[data-admin-form] button[type="submit"]').click();
    await until(() => !root.querySelector('[data-admin-form]'), 'Native create did not finish');
    let record = (await service.articles.list()).find((row) => row.alias === 'aceite-nativo-final');
    check(record, 'Article creation did not reach storage');
    check(uploads.length === 1 && uploads[0].overwrite === false && ArrayBuffer.isView(uploads[0].content), 'Cross-realm image upload contract failed');
    check(!/\b(?:data|blob):/.test(record.introtext + record.fulltext), 'Inline image URI persisted');
    check(record.introtext.includes('<strong>') && record.fulltext.includes(imageUrl), 'Readmore split or upload URL lost');
    checks.push('create-format-readmore-cross-realm-upload-sync');
    await app.router.navigate(`#/articles/${record.id}`);
    check(editor().getContent().includes(imageUrl) && editor().getContent().includes('system-readmore'), 'Reopening lost HTML/image/readmore');
    const publishing = root.querySelector('#admin-article-tab-articles-publishing-label');
    publishing.click();
    check(publishing.getAttribute('aria-selected') === 'true' && !root.querySelector(`#${publishing.getAttribute('aria-controls')}`).hidden, 'Publication tab failed');
    root.querySelector('#admin-article-tab-articles-content-label').click();
    editor().setContent(editor().getContent().replace('Corpo completo', 'Corpo editado'));
    root.querySelector('[data-admin-form] button[type="submit"]').click();
    await until(() => !root.querySelector('[data-admin-form]'), 'Native edit did not finish');
    record = await service.articles.get(record.id);
    check(record.fulltext.includes('Corpo editado') && record.fulltext.includes(imageUrl), 'Edit lost uploaded image');
    checks.push('edit-tabs-reopen-image-preserved');
    await app.router.navigate(`#/articles/${record.id}`);
    await service.articles.update(record.id, { title: 'Atualização concorrente' }, { etag: record.etag });
    const before = JSON.stringify([...values]);
    root.querySelector('[name="title"]').value = 'Tentativa obsoleta';
    root.querySelector('[data-admin-form] button[type="submit"]').click();
    await until(() => root.querySelector('.admin-form-status')?.textContent.includes('Recarregue'), 'Native stale ETag not announced');
    check(JSON.stringify([...values]) === before, 'Stale editor form changed data');
    checks.push('editor-captured-etag-no-write');
    const article = await service.articles.get(record.id);
    const publicRoot = documentRef.createElement('div');
    documentRef.body.append(publicRoot);
    const publicApp = createApplication({ adapter: createFakeAdapter({ articles: [{ ...article, published: true, tags: [], fulltext: article.fulltext + '<script>window.__unsafeFinal=true</script>' }] }),
      documentRef: { body: publicRoot }, autoStart: false });
    await publicApp.start();
    await publicApp.router.navigate(`#/article/${article.alias}`);
    check(publicRoot.querySelector(`img[src="${imageUrl}"]`) && !publicRoot.querySelector('script'), 'Public image or sanitization failed');
    await until(() => publicRoot.querySelector('img')?.complete && publicRoot.querySelector('img')?.naturalWidth > 0, 'Uploaded preview image did not load');
    publicApp.stop();
    publicRoot.remove();
    checks.push('public-sanitization-and-image');
    check((await repositories.articles.findMany()).items.length === 3, 'Synthetic article count unexpected');
    return { success: true, checks, syntheticStorage: true, uploadTransport: 'synthetic', realTenantWrites: false };
  } finally {
    app.stop();
    for (const instance of globalThis.tinymce?.get() ?? []) if (root.contains(instance.targetElm)) instance.remove();
    root.remove();
  }
}

export async function runFinalModulesDomTests(documentRef = globalThis.document) {
  const { service, repositories } = fixture();
  const root = documentRef.createElement('div');
  documentRef.body.append(root);
  const app = createAdminApplication({ adminService: service, documentRef: { body: root }, autoStart: false });
  const checks = [];
  try {
    await app.router.navigate('#/moduleInstances/new?type=custom-html');
    const form = root.querySelector('[data-ext-form="module"]');
    const field = (name) => form.querySelector(`[name="${name}"]`);
    field('title').value = 'Módulo final';
    field('position').value = 'sidebar-right';
    field('param:title').value = 'Título final';
    field('param:html').value = '<p>Conteúdo final nativo</p>';
    field('param:headerTag').value = 'h3';
    field('param:headerClass').value = 'final-heading';
    field('param:moduleClass').value = 'final-module';
    field('assignment').value = 'only';
    form.querySelector('[name="assignmentToken"][value="route:home"]').checked = true;
    form.querySelector('button[type="submit"]').click();
    await until(() => !root.querySelector('[data-ext-form="module"]'), 'Native module submit failed');
    const row = (await service.moduleInstances.list()).find((item) => item.title === 'Módulo final');
    check(row, 'Native module not persisted');
    const publicRoot = documentRef.createElement('div');
    const site = createApplication({ documentRef: { body: publicRoot }, autoStart: false,
      getModuleInstances: async () => (await repositories.moduleInstances.findMany()).items });
    await site.start();
    await site.router.navigate('#/');
    check(publicRoot.querySelector('.final-module h3.final-heading')?.textContent === 'Título final', 'Native settings not consumed by public chrome');
    await site.router.navigate('#/search?q=conteudo');
    check(!publicRoot.querySelector('.final-module'), 'Home-only assignment ignored');
    checks.push('native-module-submit-chrome-home-assignment');
    let current = await service.moduleInstances.get(row.id);
    await service.moduleInstances.update(row.id, { assignment: 'except', assignmentTokens: ['route:home'] }, { etag: current.etag });
    await site.router.navigate('#/');
    check(!publicRoot.querySelector('.final-module'), 'Except home assignment ignored');
    await site.router.navigate('#/search');
    check(publicRoot.querySelector('.final-module'), 'Except other route missing');
    current = await service.moduleInstances.get(row.id);
    await service.moduleInstances.update(row.id, { publishUp: '2099-01-01T00:00:00Z' }, { etag: current.etag });
    await site.router.navigate('#/search');
    check(!publicRoot.querySelector('.final-module'), 'Future module visible');
    current = await service.moduleInstances.get(row.id);
    await service.moduleInstances.update(row.id, { publishUp: null, publishDown: '2000-01-01T00:00:00Z' }, { etag: current.etag });
    await site.router.navigate('#/search');
    check(!publicRoot.querySelector('.final-module'), 'Expired module visible');
    checks.push('assignment-except-and-schedule-public-consumers');
    current = await service.moduleInstances.get(row.id);
    await service.moduleInstances.update(row.id, { publishDown: null }, { etag: current.etag });
    await app.router.navigate('#/moduleInstances');
    root.querySelector(`[data-ext-select][value="${row.id}"]`).checked = true;
    root.querySelector('[name="batchAction"]').value = 'trash';
    root.querySelector('[data-ext-batch] button[type="submit"]').click();
    await until(async () => (await service.moduleInstances.get(row.id)).trashed === true, 'Native batch trash failed');
    await until(() => !root.querySelector(`[data-ext-select][value="${row.id}"]`), 'Native batch did not reload');
    await site.router.navigate('#/search');
    check(!publicRoot.querySelector('.final-module'), 'Trashed module still rendered');
    checks.push('native-batch-trash-public-removal');
    site.stop();
    return { success: true, checks, syntheticStorage: true, realTenantWrites: false };
  } finally { app.stop(); root.remove(); }
}

export async function runFinalImageMarginsDomTests(documentRef = globalThis.document) {
  const { service } = fixture();
  const root = documentRef.createElement('div');
  documentRef.body.append(root);
  const app = createAdminApplication({ adminService: service, documentRef: { body: root }, autoStart: false,
    richTextEditorFactory: (id, options) => attachRichTextEditor(id, { vendorBaseUrl: '/src/media/vendor/tinymce', ...options }) });
  try {
    await app.router.navigate('#/articles/1');
    const ed = globalThis.tinymce.get('admin-field-articles-articletext');
    ed.setContent('<p>Texto e imagem</p><img src="/tmp/sol-final-pixel.png" alt="Pixel">');
    ed.selection.select(ed.getBody().querySelector('img'));
    ed.execCommand('mceImage');
    await until(() => documentRef.querySelector('.tox-dialog [role="tab"]'), 'Image dialog did not open');
    const advanced = [...documentRef.querySelectorAll('.tox-dialog [role="tab"]')].find((tab) => tab.textContent === 'Advanced');
    check(advanced && ed.options.get('image_advtab') === true, 'Advanced image tab unavailable');
    advanced.click();
    for (const [label, value] of [['Vertical space', '12'], ['Horizontal space', '16']]) {
      const fieldLabel = [...documentRef.querySelectorAll('.tox-dialog label')].find((item) => item.textContent === label);
      const input = documentRef.getElementById(fieldLabel?.htmlFor);
      check(input, `${label} input unavailable`);
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    [...documentRef.querySelectorAll('.tox-dialog button')].find((button) => button.textContent === 'Save').click();
    root.querySelector('[data-admin-form] button[type="submit"]').click();
    await until(() => !root.querySelector('[data-admin-form]'), 'Image margin form did not save');
    const row = await service.articles.get(1);
    const { sanitizeHtml } = await import('../src/libraries/minijoomla/security/sanitize.js');
    const publicRoot = documentRef.createElement('div');
    documentRef.body.append(publicRoot);
    try {
      publicRoot.innerHTML = sanitizeHtml(row.introtext + row.fulltext);
      const style = documentRef.defaultView.getComputedStyle(publicRoot.querySelector('img'));
      check(style.marginTop === '12px' && style.marginBottom === '12px' && style.marginLeft === '16px' && style.marginRight === '16px', 'Public computed image margins lost');
    } finally { publicRoot.remove(); }
    await app.router.navigate('#/articles/1');
    check(globalThis.tinymce.get('admin-field-articles-articletext').getContent().includes('12px 16px'), 'Reopened image lost spacing');
    return { success: true, checks: ['native-image-advanced-dialog', 'pixel-spacing-save-public-computed-reopen'], syntheticStorage: true };
  } finally { app.stop(); root.remove(); }
}

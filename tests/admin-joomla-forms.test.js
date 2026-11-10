import assert from 'node:assert/strict';
import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createMediaUploadService } from '../src/libraries/minijoomla/application/media-upload-service.js';
import { createContentPages } from '../src/administrator/components/com_minijoomla/content-pages.js';
import { renderArticleAdminForm } from '../src/administrator/components/com_minijoomla/render-article-form.js';
import { ARTICLE_FIELDS, ARTICLE_EDITOR_LAYOUT } from '../src/administrator/components/com_minijoomla/field-schemas.js';
import { buildMenuPath, parseMenuPath, MENU_TYPES } from '../src/administrator/components/com_minijoomla/menu-types.js';
import { MiniJoomlaArticles, MiniJoomlaCategories, MiniJoomlaTags } from '../src/libraries/minijoomla/infrastructure/spmiddle-schemas.js';
import { Router } from '../src/libraries/minijoomla/core/router.js';
import { createDemoRepositories } from '../examples/demo-repositories.js';

function element(extra = {}) {
  const handlers = new Map();
  const attrs = {};
  return { value: '', textContent: '', disabled: false, ...extra,
    setAttribute: (name, value) => { attrs[name] = value; }, getAttribute: (name) => attrs[name],
    addEventListener(name, callback) { handlers.set(name, callback); },
    dispatch(name, event = {}) { return handlers.get(name)?.({ preventDefault() {}, ...event }); }
  };
}

// Só os controles renderizados existem (como num formulário real); apenas o despacho de eventos é simulado.
function documentDouble(extra = {}) {
  let html = '';
  const inputs = new Map();
  const status = element();
  const imageStatus = element();
  const form = element({
    querySelector: (selector) => {
      if (selector === '[data-admin-image-status]') return imageStatus;
      const named = selector.match(/^\[(?:name|data-admin-image-file|data-admin-image-preview)="(.+)"\]$/);
      if (selector.startsWith('[data-admin-image-file')) return extra.fileInput ?? null;
      if (selector.startsWith('[data-admin-image-preview')) return extra.preview ?? null;
      return named ? inputs.get(named[1]) ?? null : null;
    },
    querySelectorAll: (selector) => selector === '[data-admin-image-upload]' ? (extra.uploadButtons ?? []) : []
  });
  const body = {
    get innerHTML() { return html; },
    set innerHTML(value) {
      html = value;
      inputs.clear();
      for (const match of value.matchAll(/<(input|textarea|select)\b([^>]*\bname="([^"]+)"[^>]*)>([\s\S]*?)(?:<\/\1>|(?=<))/g)) {
        inputs.set(match[3], element({ disabled: /\bdisabled\b/.test(match[2]), value: /\bvalue="([^"]*)"/.exec(match[2])?.[1] ?? '', checked: /\bchecked\b/.test(match[2]), selectedOptions: [] }));
      }
    },
    querySelector: (selector) => selector === '[data-admin-form]' ? form : selector === '.admin-form-status' ? status : null,
    querySelectorAll: () => []
  };
  return { documentRef: { body }, form, inputs, status, imageStatus };
}

export async function runAdminJoomlaFormsTests() {
  // 1. Schema: Trashed provisionado; colunas novas de categorias/tags com padrão Published.
  assert.ok(MiniJoomlaArticles.fields.find((field) => field.internalName === 'State').choices.includes('Trashed'));
  assert.deepEqual(MiniJoomlaCategories.fields.find((field) => field.internalName === 'State').choices, ['Published', 'Unpublished', 'Trashed']);
  assert.equal(MiniJoomlaCategories.fields.find((field) => field.internalName === 'State').defaultValue, 'Published');
  for (const name of ['Description', 'ParentId', 'State']) assert.ok(MiniJoomlaTags.fields.some((field) => field.internalName === name), `tags.${name}`);

  // 2. Menu: tipos geram o path existente e o inverso reconhece; desconhecidos viram "custom".
  assert.equal(buildMenuPath({ type: 'home' }), '/');
  assert.equal(buildMenuPath({ type: 'category-blog', category: 'noticias' }), '/category/noticias');
  assert.equal(buildMenuPath({ type: 'category-list', category: 'noticias' }), '/category/noticias?layout=list');
  assert.equal(buildMenuPath({ type: 'article', article: 'a b' }), '/article/a%20b');
  assert.equal(buildMenuPath({ type: 'tag', tag: 'copa 2026' }), '/tag/copa%202026');
  assert.equal(buildMenuPath({ type: 'url', url: 'javascript:alert(1)' }), null, 'URL externa só http(s)');
  assert.equal(buildMenuPath({ type: 'url', url: 'https://example.org/x' }), 'https://example.org/x');
  assert.equal(buildMenuPath({ type: 'article' }), null, 'sem alvo não gera caminho');
  for (const path of ['/', '/tags', '/search', '/archive', '/category/a', '/category/a?layout=list', '/article/b', '/tag/c%20d', 'https://x.test/y']) assert.equal(buildMenuPath({ type: parseMenuPath(path).type, ...Object.fromEntries(Object.entries(parseMenuPath(path))) }), path, path);
  assert.equal(parseMenuPath('/qualquer/coisa').type, 'custom');
  assert.deepEqual(MENU_TYPES.map((type) => type.key), ['home', 'category-blog', 'category-list', 'article', 'tag', 'tags', 'search', 'archive', 'url']);

  const repositories = createDemoRepositories({ storage: (() => { const store = new Map(); return { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) }; })() });
  const service = createAdminService(repositories);
  const category = (await service.categories.list())[0];
  const custom = await service.menu.create({ title: 'Legado', path: '/legado/personalizado', published: 'Published' });
  const typed = await service.menu.create({ title: 'Tipado', path: '/category/noticias', published: 'Published' });
  const doc = documentDouble();
  const app = createAdminApplication({ adminService: service, documentRef: doc.documentRef, autoStart: false });
  await app.router.navigate(`#/menu/${custom.id}`);
  assert.match(doc.documentRef.body.innerHTML, /<option value="custom" selected>Caminho existente \(preservado\): \/legado\/personalizado<\/option>|<option value="custom"[^>]*>Caminho existente/);
  doc.inputs.set('published', element({ value: 'Published' }));
  doc.inputs.set('menuType', element({ value: 'custom' }));
  doc.inputs.set('title', element({ value: 'Legado 2' }));
  await doc.form.dispatch('submit');
  assert.equal(doc.status.textContent, 'Salvo com sucesso.');
  const keptCustom = await service.menu.get(custom.id);
  assert.equal(keptCustom.path, '/legado/personalizado', 'caminho existente preservado na edição');
  assert.equal(keptCustom.title, 'Legado 2');
  await app.router.navigate(`#/menu/${typed.id}`);
  doc.inputs.set('published', element({ value: 'Published' }));
  doc.inputs.set('menuType', element({ value: 'category-list' }));
  doc.inputs.set('targetCategory', element({ value: category.alias }));
  await doc.form.dispatch('submit');
  assert.equal((await service.menu.get(typed.id)).path, `/category/${category.alias}?layout=list`);
  await app.router.navigate(`#/menu/${typed.id}`);
  doc.inputs.set('published', element({ value: 'Published' }));
  doc.inputs.set('menuType', element({ value: 'article' }));
  doc.inputs.set('targetArticle', element({ value: '' }));
  await doc.form.dispatch('submit');
  assert.match(doc.status.textContent, /Escolha o destino/);
  assert.equal((await service.menu.get(typed.id)).path, `/category/${category.alias}?layout=list`, 'sem alvo nada é gravado');

  // 3. Formulário de artigo: abas, metadados editáveis, informações somente leitura.
  const html = renderArticleAdminForm({ formId: 'articles', fields: ARTICLE_FIELDS, values: { id: 7, title: 'T', alias: 't', created: '2026-01-02T03:04:05Z', modified: 'x<b>', attribsJson: '{"images":{"image_intro":"/uploads/a.png"}}' }, layout: ARTICLE_EDITOR_LAYOUT, imageUpload: true });
  for (const key of ['content', 'images', 'options', 'publishing', 'metadata']) assert.match(html, new RegExp(`id="admin-article-tab-articles-${key}-label"`));
  assert.match(html, /name="images:image_intro"[^>]*value="\/uploads\/a\.png"/);
  assert.match(html, /data-admin-image-upload="images:image_fulltext"/);
  assert.match(html, /<img class="admin-image-preview"[^>]*src="\/uploads\/a\.png"/);
  assert.doesNotMatch(renderArticleAdminForm({ formId: 'articles', fields: ARTICLE_FIELDS, values: { id: 1 }, layout: ARTICLE_EDITOR_LAYOUT }), /data-admin-image-upload/, 'sem serviço de mídia não há controle de envio');
  assert.match(html, /<dt>ID<\/dt><dd>7<\/dd>/);
  assert.match(html, /modified|Modificado em<\/dt><dd>x&lt;b&gt;/);
  assert.doesNotMatch(html, /name="metaDescription" readonly/);

  // 4. Salvar imagens/links: só as chaves editadas mudam; attribs e chaves desconhecidas de images persistem.
  const article = await service.articles.create({ title: 'Com imagem', alias: 'com-imagem', attribsJson: JSON.stringify({ show_title: 1, future: { keep: true }, images: { image_intro: '/uploads/old.png', float_intro: 'left' } }) });
  const uploads = [];
  const media = createMediaUploadService({ uploadFile: async (input) => { uploads.push(input); return { data: { ServerRelativeUrl: `/sites/x/uploads/${input.fileName}` } }; } }, { now: () => 1 });
  const fileInput = element({ files: [{ type: 'image/png', size: 4, arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer }] });
  const preview = element({ hidden: true, src: '' });
  const uploadButton = element({ dataset: { adminImageUpload: 'images:image_fulltext' } });
  const articleDoc = documentDouble({ fileInput, preview, uploadButtons: [uploadButton] });
  const articleApp = createAdminApplication({ adminService: service, mediaService: media, documentRef: articleDoc.documentRef, autoStart: false });
  await articleApp.router.navigate(`#/articles/${article.id}`);
  articleDoc.inputs.clear();
  articleDoc.inputs.set('images:image_fulltext', element({ value: '' }));
  await uploadButton.dispatch('click');
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].folderPath, 'uploads');
  assert.match(uploads[0].fileName, /^img-1-\d+\.png$/);
  const uploadedUrl = `/sites/x/uploads/${uploads[0].fileName}`;
  assert.equal(articleDoc.inputs.get('images:image_fulltext').value, uploadedUrl, 'A URL confirmada pelo upload preenche o campo, independentemente de uploads anteriores');
  assert.equal(preview.hidden, false);
  assert.match(articleDoc.imageStatus.textContent, /Salve o artigo/);
  fileInput.files = [{ type: 'application/pdf', size: 4, arrayBuffer: async () => new ArrayBuffer(4) }];
  await uploadButton.dispatch('click');
  assert.equal(uploads.length, 1, 'tipo não suportado nunca chega ao serviço');
  assert.match(articleDoc.imageStatus.textContent, /não suportado/);

  articleDoc.inputs.set('images:image_intro_alt', element({ value: 'Texto alt' }));
  articleDoc.inputs.set('urls:urla', element({ value: 'https://example.org/a' }));
  await articleDoc.form.dispatch('submit');
  const saved = JSON.parse((await service.articles.get(article.id)).attribsJson);
  assert.deepEqual(saved.images, { image_intro: '/uploads/old.png', float_intro: 'left', image_fulltext: uploadedUrl, image_intro_alt: 'Texto alt' });
  assert.deepEqual(saved.urls, { urla: 'https://example.org/a' });
  assert.equal(saved.show_title, 1);
  assert.deepEqual(saved.future, { keep: true });
  await articleApp.router.navigate(`#/articles/${article.id}`);
  articleDoc.inputs.clear();
  articleDoc.inputs.set('images:image_intro', element({ value: 'javascript:alert(1)' }));
  await articleDoc.form.dispatch('submit');
  assert.match(articleDoc.status.textContent, /caminho iniciado por/, 'URL de imagem insegura é recusada');
  assert.equal(JSON.parse((await service.articles.get(article.id)).attribsJson).images.image_intro, '/uploads/old.png');
  await articleApp.router.navigate(`#/articles/${article.id}`);
  articleDoc.inputs.clear();
  articleDoc.inputs.set('images:image_intro', element({ value: '' }));
  await articleDoc.form.dispatch('submit');
  const cleared = JSON.parse((await service.articles.get(article.id)).attribsJson);
  assert.equal(cleared.images.image_intro, undefined);
  assert.equal(cleared.images.float_intro, 'left');
  await articleApp.router.navigate(`#/articles/${article.id}`);
  articleDoc.inputs.clear();
  articleDoc.inputs.set('metaDescription', element({ value: 'Nova meta' }));
  articleDoc.inputs.set('metaKeywords', element({ value: 'a, b' }));
  await articleDoc.form.dispatch('submit');
  const meta = await service.articles.get(article.id);
  assert.equal(meta.metaDescription, 'Nova meta');
  assert.equal(meta.metaKeywords, 'a, b');
  assert.equal(meta.attribsJson, JSON.stringify(cleared), 'metadados não alteram attribsJson');

  // 5. Excluir só da lixeira no formulário de artigo.
  await articleApp.router.navigate(`#/articles/${article.id}`);
  articleDoc.inputs.clear();
  assert.doesNotMatch(articleDoc.documentRef.body.innerHTML, /data-admin-delete/);
  const fresh = await service.articles.get(article.id);
  await service.articles.update(article.id, { state: 'Trashed' }, { etag: fresh.etag });
  await articleApp.router.navigate(`#/articles/${article.id}`);
  articleDoc.inputs.clear();
  assert.match(articleDoc.documentRef.body.innerHTML, /data-admin-delete/);

  // 5b. Categorias/tags: estado e pai em árvore sem o próprio item/descendentes; excluir só da lixeira.
  const parent = await service.categories.create({ title: 'Pai', alias: 'pai' });
  const kid = await service.categories.create({ title: 'Filho', alias: 'filho', parentId: parent.id });
  await articleApp.router.navigate(`#/categories/${parent.id}`);
  const categoryHtml = articleDoc.documentRef.body.innerHTML;
  assert.match(categoryHtml, /name="state"/);
  assert.doesNotMatch(categoryHtml, new RegExp(`<option value="${kid.id}"[^>]*>— Filho`), 'descendente não é opção de pai (evita ciclo)');
  assert.doesNotMatch(categoryHtml, /data-admin-delete/);
  await articleApp.router.navigate('#/tags/new');
  assert.match(articleDoc.documentRef.body.innerHTML, /name="parentId"[\s\S]*name="description"[\s\S]*value="Trashed"/);

  // 6. Mídia: listar, prévia segura, copiar URL, excluir com confirmação somente se o cliente permitir.
  const files = [{ Name: 'b<i>.png', ServerRelativeUrl: '/sites/x/uploads/b.png', Length: '2048', TimeLastModified: '2026-02-01T00:00:00Z' }, { Name: 'doc.pdf', ServerRelativeUrl: '/sites/x/uploads/doc.pdf', Length: '5', TimeLastModified: '2026-01-01T00:00:00Z' }];
  const removed = [];
  const withDelete = createMediaUploadService({ uploadFile: async () => ({}), listFiles: async (options) => { assert.equal(options.folderPath, 'uploads'); return { data: { value: files } }; }, deleteFile: async (input) => { removed.push(input.fileName); } });
  const listed = await withDelete.list();
  assert.deepEqual(listed.map((file) => [file.name, file.isImage, file.size]), [['b<i>.png', true, 2048], ['doc.pdf', false, 5]]);
  assert.equal(withDelete.canDelete, true);
  await assert.rejects(() => withDelete.remove('../x.png'), /inválido/);
  await withDelete.remove('doc.pdf');
  assert.deepEqual(removed, ['doc.pdf']);
  const withoutDelete = createMediaUploadService({ uploadFile: async () => ({}), listFiles: async () => ({ data: { value: files } }) });
  assert.equal(withoutDelete.canDelete, false);
  const router = new Router({ base: '' });
  const shell = ({ bodyHtml }) => bodyHtml;
  const mediaDoc = documentDouble();
  const mediaPages = createContentPages({ adminService: service, documentRef: mediaDoc.documentRef, router, shell, mediaService: withDelete });
  const mediaView = await mediaPages.render({ path: '/media', params: {} });
  assert.match(mediaView.html, /<img src="\/sites\/x\/uploads\/b\.png" alt=""/);
  assert.match(mediaView.html, /b&lt;i&gt;\.png/);
  assert.doesNotMatch(mediaView.html, /<i>/);
  assert.match(mediaView.html, /data-ext-action="copy"/);
  assert.match(mediaView.html, /data-ext-action="delete"/);
  assert.match(mediaView.html, /type="file"[^>]*accept="image\/png,image\/jpeg,image\/gif,image\/webp"/);
  assert.match(mediaView.html, /role="status" aria-live="polite"/);
  const noDeleteView = await createContentPages({ adminService: service, documentRef: mediaDoc.documentRef, router, shell, mediaService: withoutDelete }).render({ path: '/media', params: {} });
  assert.doesNotMatch(noDeleteView.html, /data-ext-action="delete"/);
  assert.match(noDeleteView.html, /Exclusão indisponível/);
  assert.match((await createContentPages({ adminService: service, documentRef: mediaDoc.documentRef, router, shell }).render({ path: '/media', params: {} })).html, /não configurado/);

  console.log('ok - admin joomla forms: tipos de menu, aba Imagens e links com upload, metadados editáveis, attribs preservados, exclusão só da lixeira e gerenciador de mídia');
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) await runAdminJoomlaFormsTests();

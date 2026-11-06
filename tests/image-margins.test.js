import assert from 'node:assert/strict';
import { sanitizeHtml, sanitizeImageMargins } from '../src/libraries/minijoomla/security/sanitize.js';
import { attachRichTextEditor, READMORE_MARKER } from '../src/administrator/components/com_minijoomla/editor.js';
import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createDemoRepositories } from '../examples/demo-repositories.js';
import { createSPMiddleAdapter } from '../src/libraries/minijoomla/infrastructure/spmiddle-adapter.js';
import { renderArticle, renderArticleList } from '../src/components/com_content/tmpl/article/default.js';
import { customHtmlModule } from '../src/modules/mod_custom/mod_custom.js';

const allMargins = (top, right = top, bottom = top, left = right) => `margin-top: ${top}px; margin-right: ${right}px; margin-bottom: ${bottom}px; margin-left: ${left}px`;
const image = (style, src = '/safe.png') => `<img src="${src}" alt="Teste" style="${style}">`;

// A partial synthetic host exposing only richtext controls, which the admin
// explicitly supports. Renderers, binding, editor wrapper and services are real;
// DOM dispatch and TinyMCE APIs are doubles, not a browser/editor acceptance test.
function editorDocument() {
  let html = '';
  let submit;
  const inputs = new Map();
  const status = { textContent: '' };
  const form = {
    querySelector: (selector) => inputs.get(/^\[name="(.+)"\]$/.exec(selector)?.[1]) ?? null,
    addEventListener(name, callback) { if (name === 'submit') submit = callback; }
  };
  const decode = (value) => value.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }[entity]));
  const documentRef = {
    getElementById: (id) => [...inputs.values()].find((input) => input.id === id) ?? null,
    body: {
      get innerHTML() { return html; },
      set innerHTML(value) {
        html = value;
        inputs.clear();
        submit = undefined;
        for (const match of value.matchAll(/<textarea\s+id="([^"]+)"\s+name="([^"]+)"[^>]*data-admin-richtext[^>]*>([\s\S]*?)<\/textarea>/g)) {
          inputs.set(match[2], { id: match[1], value: decode(match[3]), hasAttribute: (name) => name === 'data-admin-readmore' && match[0].includes('data-admin-readmore') });
        }
      },
      querySelector: (selector) => selector === '[data-admin-form]' ? form : selector === '.admin-form-status' ? status : null,
      querySelectorAll: (selector) => selector === '[data-admin-richtext]' ? [...inputs.values()] : []
    }
  };
  return { documentRef, inputs, status, submit: () => submit({ preventDefault() {} }) };
}

async function runEditorImageRoundTrip() {
  const stored = new Map();
  const repositories = createDemoRepositories({ storage: { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) } });
  const service = createAdminService(repositories);
  const intro = image('float:left; width:280px; margin:20px; position:fixed; color:red');
  const full = image('float:right; width:4000px; margin:0 200px');
  const record = await service.articles.create({ title: 'Image layout', alias: 'image-layout', introtext: intro, fulltext: full, state: 'Published', note: 'Preserve untouched metadata' });
  const doc = editorDocument();
  const editors = new Map();
  const previous = globalThis.tinymce;
  const previousPreInit = globalThis.tinyMCEPreInit;
  let nextUpload;
  let uploads = 0;
  let saves = 0;
  let removes = 0;
  let app;
  try {
    globalThis.tinymce = {
      get: (id) => editors.get(id) ?? null,
      async init(options) {
        assert.equal(options.image_advtab, true);
        assert.equal(options.relative_urls, false);
        const id = options.selector.slice(1);
        const textarea = doc.documentRef.getElementById(id);
        const listeners = new Map();
        const editor = {
          content: textarea.value,
          getContent() { return this.content; },
          on(names, callback) { for (const name of names.split(' ')) listeners.set(name, callback); },
          emit(name) { listeners.get(name)?.(); },
          ui: { registry: { addButton() {} } },
          async uploadImages() { uploads += 1; if (nextUpload) await nextUpload(this); },
          save() { saves += 1; textarea.value = this.getContent(); },
          remove() { removes += 1; editors.delete(id); }
        };
        editors.set(id, editor);
        options.setup(editor);
      }
    };
    app = createAdminApplication({ adminService: service, documentRef: doc.documentRef, autoStart: false,
      richTextEditorFactory: (id, options) => attachRichTextEditor(id, { ...options, documentRef: doc.documentRef, vendorBaseUrl: '/vendor/tinymce', loadScript: async () => {} }) });
    const beforeOpen = JSON.stringify([...stored]);
    await app.router.navigate(`#/articles/${record.id}`);
    const textarea = doc.inputs.get('articletext');
    const editor = editors.get(textarea.id);
    assert.equal(editor.content, `${intro}${READMORE_MARKER}${full}`);
    assert.equal(JSON.stringify([...stored]), beforeOpen, 'opening the editor never rewrites stored image CSS');
    for (const event of ['change', 'input', 'undo', 'redo', 'SetContent']) {
      textarea.value = 'stale';
      editor.emit(event);
      assert.equal(textarea.value, editor.content, `${event} synchronizes exact HTML without sanitizing author content`);
    }
    assert.equal(JSON.stringify([...stored]), beforeOpen, 'editor synchronization alone does not persist');

    // Model an upload completing without change/input: the real wrapper must
    // await uploadImages, then save, before the admin reads the textarea.
    const pendingIntro = intro.replace('/safe.png', 'blob:https://minijoomla.invalid/pending');
    const uploadedIntro = intro.replace('/safe.png', '/uploads/image.png');
    editor.content = textarea.value = `${pendingIntro}${READMORE_MARKER}${full}`;
    let releaseUpload;
    const uploadGate = new Promise((resolve) => { releaseUpload = resolve; });
    let uploadStarted;
    const started = new Promise((resolve) => { uploadStarted = resolve; });
    nextUpload = async (instance) => {
      uploadStarted();
      await uploadGate;
      instance.content = `${uploadedIntro}${READMORE_MARKER}${full}`;
    };
    const submission = doc.submit();
    let watchdog;
    try {
      await Promise.race([started, submission.then(() => { throw new Error('admin submit completed without starting editor upload synchronization'); }), new Promise((_, reject) => { watchdog = setTimeout(() => reject(new Error('editor upload synchronization did not start')), 2000); })]);
      assert.equal(saves, 0, 'save waits for pending uploads');
      assert.equal(JSON.stringify([...stored]), beforeOpen, 'admin does not write before uploads finish');
    } finally {
      clearTimeout(watchdog);
      releaseUpload();
    }
    await submission;
    assert.equal(uploads, 1);
    assert.equal(saves, 1);
    const saved = await service.articles.get(record.id);
    assert.equal(saved.introtext, uploadedIntro, 'admin persists exact post-upload CSS, not public sanitizer output');
    assert.equal(saved.fulltext, full);
    assert.equal(saved.note, record.note);
    assert.equal('articletext' in saved, false);
    assert.equal(removes, 1, 'navigation destroys the editor after successful save');
    const beforePublic = JSON.stringify([...stored]);
    const adapter = createSPMiddleAdapter({ articleRepository: repositories.articles, categoryRepository: repositories.categories, now: '2026-06-01' });
    const publicArticle = await adapter.getArticle(record.alias);
    const rendered = renderArticle(publicArticle);
    assert.ok(rendered.includes(image(`float: left; width: 280px; ${allMargins(20)}`, '/uploads/image.png')));
    assert.ok(rendered.includes(image(`float: right; width: 4000px; ${allMargins(0, 200)}`)));
    assert.doesNotMatch(rendered, /position:|color:|blob:/);
    assert.equal(JSON.stringify([...stored]), beforePublic, 'public rendering never rewrites the article');

    nextUpload = undefined;
    await app.router.navigate('#/config');
    const configTextarea = doc.inputs.get('customHtmlBody');
    const configEditor = editors.get(configTextarea.id);
    const custom = image('float:none; width:0; margin:200px; background:url(https://minijoomla.invalid/evil)');
    configEditor.content = custom;
    configEditor.emit('SetContent');
    assert.equal(configTextarea.value, custom);
    await doc.submit();
    const savedConfig = await service.siteConfig.get();
    assert.equal(savedConfig.customHtmlBody, custom);
    const beforeCustomRender = JSON.stringify([...stored]);
    const customRendered = customHtmlModule.render({ settings: { html: savedConfig.customHtmlBody } });
    assert.ok(customRendered.includes(image(`float: none; width: 0px; ${allMargins(200)}`)));
    assert.doesNotMatch(customRendered, /background|url\(/);
    assert.equal(JSON.stringify([...stored]), beforeCustomRender);
    assert.equal(uploads, 2);
    assert.equal(saves, 2);
  } finally {
    app?.stop();
    if (previous === undefined) delete globalThis.tinymce;
    else globalThis.tinymce = previous;
    if (previousPreInit === undefined) delete globalThis.tinyMCEPreInit;
    else globalThis.tinyMCEPreInit = previousPreInit;
  }
}

export async function runImageMarginsTests() {
  assert.equal(sanitizeImageMargins('margin: 12px 8px; margin-left: 20px'), 'margin-top: 12px; margin-right: 8px; margin-bottom: 12px; margin-left: 20px');
  assert.equal(sanitizeImageMargins('margin: 0; margin-right: .5px'), 'margin-top: 0px; margin-right: 0.5px; margin-bottom: 0px; margin-left: 0px');
  // float:left/right/none and a bounded pixel width are a deliberate, narrow
  // extension of the same image-only contract (not arbitrary CSS): they are
  // what Joomla's own TinyMCE image dialog writes for "align left/right" and
  // "Width", and dropping them silently used to break the author's intended
  // layout (image rendered oversized and unfloated on the public frontend).
  assert.equal(sanitizeImageMargins('float:left; width:280px; margin:20px'), 'float: left; width: 280px; margin-top: 20px; margin-right: 20px; margin-bottom: 20px; margin-left: 20px');
  assert.equal(sanitizeImageMargins('float:right'), 'float: right');
  assert.equal(sanitizeImageMargins('float:middle; width:50%; width:4001px'), '');
  assert.equal(sanitizeHtml('<img src="/safe.png" alt="Teste" style="margin: 12px 8px; float:left; width:280px; position:fixed; background:url(javascript:evil)">'), '<img src="/safe.png" alt="Teste" style="float: left; width: 280px; margin-top: 12px; margin-right: 8px; margin-bottom: 12px; margin-left: 8px">');
  for (const value of ['margin:-1px', 'margin:201px', 'margin:100%', 'margin:expression(alert(1))', 'margin:var(--unsafe)', 'margin:calc(2px)', 'margin:1px!important', 'margin:1px 2px 3px 4px 5px', 'margin:1px;position:fixed;color:red', 'float:expression(alert(1))', 'float:left !important', 'width:calc(100% - 1px)', 'width:4001px']) {
    const result = sanitizeImageMargins(value);
    assert.ok(!/position|color|expression|var|calc|important|%|-1px|201px|4001px/.test(result));
  }
  assert.equal(sanitizeHtml('<p style="margin:12px">Texto</p><img src="data:image/svg+xml,evil" onerror="alert(1)" style="margin:200px">'), '<p>Texto</p><img src="#" style="margin-top: 200px; margin-right: 200px; margin-bottom: 200px; margin-left: 200px">');
  for (const float of ['left', 'right', 'none']) {
    for (let width = 0; width <= 4000; width += 1) {
      assert.equal(sanitizeImageMargins(`float:${float};width:${width}px`), `float: ${float}; width: ${width}px`);
    }
  }
  for (let margin = 0; margin <= 200; margin += 1) {
    assert.equal(sanitizeImageMargins(`margin:${margin}px`), allMargins(margin));
    for (const side of ['top', 'right', 'bottom', 'left']) assert.equal(sanitizeImageMargins(`margin-${side}:${margin}px`), `margin-${side}: ${margin}px`);
  }
  for (const [raw, expected] of [['width:0', 'width: 0px'], ['width:.5px', 'width: 0.5px'], ['width:3999.99px', 'width: 3999.99px'], ['width:4000.00PX', 'width: 4000px'], ['margin:.01px', allMargins(0.01)], ['margin:200.00px', allMargins(200)], ['margin:1px 2px 3px', allMargins(1, 2, 3)], ['margin:1px 2px 3px 4px', allMargins(1, 2, 3, 4)], [' FLOAT : RIGHT ; WIDTH : 280.50PX ', 'float: right; width: 280.5px']]) {
    assert.equal(sanitizeImageMargins(raw), expected, raw);
  }
  const rejected = ['float:middle', 'float:inline-start', 'float:left !important', 'float:var(--float)', 'width:-1px', 'width:4000.01px', 'width:4001px', 'width:9999px', 'width:40000px', 'width:280', 'width:50%', 'width:1em', 'width:1e2px', 'width:NaNpx', 'width:Infinitypx', 'width:1.001px', 'width:calc(100% - 1px)', 'width:var(--width)', 'width:20px!important', 'margin:-.01px', 'margin:200.01px', 'margin:1.001px', 'margin:auto', 'margin:1px 2px 3px 4px 5px', 'margin-left:1px 2px', 'height:100px', 'max-width:100%', 'position:fixed', 'background:url(javascript:evil)', '--width:10px', 'color:red'];
  for (const raw of rejected) {
    assert.equal(sanitizeImageMargins(raw), '', raw);
    assert.equal(sanitizeImageMargins(`float:left;width:280px;margin:20px;${raw}`), `float: left; width: 280px; ${allMargins(20)}`, `rejected declaration must not erase valid ones: ${raw}`);
  }
  assert.equal(sanitizeImageMargins('float:left;float:right;float:none;width:1px;width:280px;margin:1px;margin-left:20px;margin:2px'), `float: none; width: 280px; ${allMargins(2)}`, 'last valid declaration wins');
  for (const tag of ['p', 'a', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li']) assert.equal(sanitizeHtml(`<${tag} style="float:left;width:280px;margin:20px">Texto</${tag}>`), `<${tag}>Texto</${tag}>`, `image CSS must not leak onto ${tag}`);
  const consumerStyle = `float: left; width: 280px; ${allMargins(20)}`;
  const consumerInput = image('float:left;width:280px;margin:20px;position:fixed;color:red');
  assert.equal(sanitizeImageMargins(consumerStyle), consumerStyle, 'normalized image styles are idempotent');
  const article = { title: 'Image consumers', alias: 'image-consumers', introtext: consumerInput, fulltext: consumerInput };
  const settings = { html: consumerInput };
  const beforeConsumers = structuredClone({ article, settings });
  const renderedArticle = renderArticle(article);
  assert.ok(renderedArticle.includes(`<div class="article-intro">${image(consumerStyle)}</div>`));
  assert.ok(renderedArticle.includes(`<div class="article-body">${image(consumerStyle)}</div>`));
  assert.ok(renderArticleList({ items: [article] }).includes(image(consumerStyle)));
  assert.ok(customHtmlModule.render({ settings }).includes(image(consumerStyle)));
  assert.deepEqual({ article, settings }, beforeConsumers, 'all public consumers are read-only');
  for (const src of ['data:image/png;base64,evil', 'DATA:image/svg+xml,evil', 'blob:https://minijoomla.invalid/pending', 'javascript:evil', 'vbscript:evil', 'file:///unsafe.png']) {
    const unsafeImage = image('float:left;width:280px;margin:20px', src).replace('>', ' onerror="evil()">');
    const sanitized = image(consumerStyle, '#');
    assert.equal(sanitizeHtml(unsafeImage), sanitized, src);
    for (const rendered of [renderArticle({ introtext: unsafeImage, fulltext: unsafeImage }), renderArticleList({ items: [{ introtext: unsafeImage }] }), customHtmlModule.render({ settings: { html: unsafeImage } })]) {
      assert.ok(rendered.includes(sanitized), `blocked URL must stay blocked in each consumer: ${src}`);
      assert.doesNotMatch(rendered, /onerror=|src="(?:data|blob|javascript|vbscript|file):/i);
    }
  }
  const previous = globalThis.tinymce;
  const previousPreInit = globalThis.tinyMCEPreInit;
  let options;
  try {
    globalThis.tinymce = { init: async (input) => { options = input; }, get: () => null };
    const handle = await attachRichTextEditor('test-image-editor', { vendorBaseUrl: '/vendor/tinymce', loadScript: async () => {} });
    assert.equal(options.image_advtab, true);
    assert.equal(options.relative_urls, false);
    await handle.sync();
    handle.destroy();
  } finally {
    if (previous === undefined) delete globalThis.tinymce;
    else globalThis.tinymce = previous;
    if (previousPreInit === undefined) delete globalThis.tinyMCEPreInit;
    else globalThis.tinyMCEPreInit = previousPreInit;
  }
  await runEditorImageRoundTrip();
  console.log('ok - image-only float/width/margin bounds, CSS and data/blob rejection, public consumers and real editor/admin save round-trip in memory (TinyMCE/DOM doubles)');
}

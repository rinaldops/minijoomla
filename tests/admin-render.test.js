import assert from 'node:assert/strict';
import { renderAdminForm, readAdminFormValues } from '../src/administrator/components/com_minijoomla/render-form.js';
import { renderArticleAdminForm } from '../src/administrator/components/com_minijoomla/render-article-form.js';
import { renderArticleAdminForm as renderCanonicalArticleForm } from '../src/administrator/components/com_content/tmpl/article/edit.js';

assert.equal(renderArticleAdminForm, renderCanonicalArticleForm, 'existing hosts use the canonical com_content editor');
import { renderAdminList } from '../src/administrator/components/com_minijoomla/render-list.js';
import { ARTICLE_FIELDS, ADMIN_DOMAINS, ARTICLE_EDITOR_LAYOUT, ARTICLE_OPTION_FIELDS } from '../src/administrator/components/com_minijoomla/field-schemas.js';

export async function runAdminRenderTests() {
  // 1. renderAdminForm: cada campo tem label associado por id previsível, tipos corretos (text/textarea/select/checkbox/number/datetime), required/readOnly refletidos, valor escapado.
  const html = renderAdminForm({ formId: 'artigo', fields: ARTICLE_FIELDS, values: { title: '<Título>', featured: true, state: 'Draft', publishUp: '2026-01-01T00:00' }, submitLabel: 'Criar artigo', cancelHref: '#/admin/articles' });
  assert.match(html, /<form class="admin-form" data-admin-form="artigo">/);
  assert.match(html, /<label for="admin-field-artigo-title">Título \*<\/label>/);
  assert.match(html, /<input type="text" id="admin-field-artigo-title" name="title" required value="&lt;Título&gt;">/);
  assert.match(html, /<textarea id="admin-field-artigo-articletext" name="articletext" data-admin-richtext data-admin-readmore rows="4"><\/textarea>/);
  assert.match(html, /<select id="admin-field-artigo-state" name="state"><option value="Published">Published<\/option><option value="Draft" selected>Draft<\/option><option value="Archived">Archived<\/option><option value="Trashed">Trashed<\/option><\/select>/);
  assert.match(html, /<input type="checkbox" id="admin-field-artigo-featured" name="featured" checked>/);
  assert.match(html, /<input type="datetime-local" id="admin-field-artigo-publishUp" name="publishUp" value="2026-01-01T00:00">/);
  assert.match(html, /<button type="submit" class="admin-btn admin-btn-success">.*Criar artigo<\/button>/);
  assert.match(html, /class="admin-btn admin-btn-ghost admin-form-cancel" href="#\/admin\/articles">.*Cancelar<\/a>/);

  // 2. renderAdminForm: campo readOnly vira input disabled, nunca aceitando edição nem submissão silenciosa de valor alterado.
  const readOnlyHtml = renderAdminForm({ formId: 'ext', fields: ADMIN_DOMAINS.extensions.fields, values: { discoveredFrom: 'extensions/x.manifest.json' } });
  assert.match(readOnlyHtml, /<input type="text" id="admin-field-ext-discoveredFrom" name="discoveredFrom" readonly disabled value="extensions\/x\.manifest\.json">/);

  // 3. readAdminFormValues: converte número/checkbox corretamente a partir de um formElement fake (querySelector por name), tolera campo ausente no DOM sem lançar.
  function fakeInput(value, checked) { return { value, checked }; }
  const formElement = {
    querySelector: (selector) => ({
      '[name="title"]': fakeInput('Novo título'),
      '[name="categoryId"]': fakeInput('10'),
      '[name="featured"]': fakeInput(undefined, true),
      '[name="publishUp"]': fakeInput('')
    })[selector] ?? null
  };
  const values = readAdminFormValues(formElement, ARTICLE_FIELDS);
  assert.equal(values.title, 'Novo título');
  assert.equal(values.categoryId, 10);
  assert.equal(values.featured, true);
  assert.equal(values.publishUp, '');
  assert.equal('alias' in values, false); // campo sem input correspondente no DOM fake é simplesmente omitido, não lança

  // 4. renderAdminList: colunas escolhidas (com rótulo mapeável), link de edição por id (com ícone), estado vazio acessível, link de "Novo" opcional.
  const listHtml = renderAdminList({ rows: [{ id: 1, title: '<Artigo>', alias: 'artigo' }], columns: ['title', 'alias'], columnLabels: { title: 'Título' }, editHref: (id) => `#/admin/articles/${id}`, newHref: '#/admin/articles/new' });
  assert.match(listHtml, /<th scope="col">Título<\/th><th scope="col">alias<\/th><th scope="col">Ação<\/th>/);
  assert.match(listHtml, /<th scope="row"><a href="#\/admin\/articles\/1" aria-label="Editar: &lt;Artigo&gt;">&lt;Artigo&gt;<\/a><\/th><td>artigo<\/td>/);
  assert.match(listHtml, /<td class="admin-col-action"><a class="admin-btn admin-btn-ghost" href="#\/admin\/articles\/1" aria-label="Editar: &lt;Artigo&gt;">.*Editar<\/a><\/td>/);
  assert.match(listHtml, /<div class="admin-table-wrap"><table class="admin-list">/);
  assert.match(listHtml, /<a class="admin-new-link admin-btn admin-btn-success" href="#\/admin\/articles\/new">.*Novo<\/a>/);
  const emptyList = renderAdminList({ rows: [], emptyLabel: 'Nada por aqui.' });
  assert.match(emptyList, /<p class="admin-empty" role="status">Nada por aqui\.<\/p>/);

  // 4b. renderAdminList: estados reconhecidos (state/published) e flags (featured/enabled) renderizam como ÍCONE CIRCULAR sem texto visível (texto só para leitor de tela via .visually-hidden) — nunca um badge com texto cru; featured=false mostra a estrela vazia (nunca "false" literal, nunca célula vazia).
  const badgeHtml = renderAdminList({ rows: [{ id: 2, title: 'Y', state: 'Published', featured: true }, { id: 3, title: 'Z', state: 'Draft', featured: false }], columns: ['title', 'state', 'featured'], editHref: () => '#' });
  assert.match(badgeHtml, /<span class="admin-state-icon is-active">.*<span class="visually-hidden">Publicado<\/span><\/span>/);
  assert.match(badgeHtml, /<span class="admin-state-icon is-featured">.*<span class="visually-hidden">Destaque<\/span><\/span>/);
  assert.match(badgeHtml, /<span class="admin-state-icon">.*<span class="visually-hidden">Rascunho<\/span><\/span>/);
  assert.ok(!badgeHtml.includes('>false<'));

  // 5. renderAdminList: um href malicioso (javascript:) é neutralizado pela mesma fronteira safeUrl já usada publicamente.
  const unsafeList = renderAdminList({ rows: [{ id: 1, title: 'X' }], editHref: () => 'javascript:alert(1)' });
  assert.ok(!unsafeList.includes('javascript:'));
  const unsafeTitle = renderAdminList({ rows: [{ id: 1, title: '"><script>alert(1)</script>' }], editHref: () => '#/articles/1' });
  assert.ok(!unsafeTitle.includes('<script>'));
  assert.match(unsafeTitle, /aria-label="Editar: &quot;&gt;&lt;script&gt;/);
  const namedList = renderAdminList({ rows: [{ id: 7, name: 'Categoria' }, { id: 8, name: '' }], titleField: 'name', editHref: (id) => `#/categories/${id}` });
  assert.match(namedList, /<th scope="row"><a href="#\/categories\/7" aria-label="Editar: Categoria">Categoria<\/a>/);
  assert.match(namedList, /aria-label="Editar: Registro 8">Registro 8<\/a>/);
  const titleOmitted = renderAdminList({ rows: [{ id: 1, title: 'X', alias: 'x' }], columns: ['alias'] });
  assert.ok(!titleOmitted.includes('scope="row"'));

  // 6. renderAdminForm: campo select relacional usa relationOptions (nunca field.options) e marca a opção selecionada pelo valor real do registro; emptyOptionLabel aparece como primeira opção.
  const categoryField = [{ name: 'categoryId', label: 'Categoria', type: 'select', relation: 'categories', emptyOptionLabel: '— sem categoria —' }];
  const relationHtml = renderAdminForm({ formId: 'artigo', fields: categoryField, values: { categoryId: 2 }, relationOptions: { categoryId: [{ value: 1, label: 'Blog' }, { value: 2, label: 'Help' }] } });
  assert.match(relationHtml, /<select id="admin-field-artigo-categoryId" name="categoryId"><option value="">— sem categoria —<\/option><option value="1">Blog<\/option><option value="2" selected>Help<\/option><\/select>/);

  // 7. renderAdminForm: campo multiselect relacional marca várias opções como selected a partir de um array de valores (tags de um artigo).
  const tagsField = [{ name: 'tags', label: 'Tags', type: 'multiselect', relation: 'tags' }];
  const multiselectHtml = renderAdminForm({ formId: 'artigo', fields: tagsField, values: { tags: ['Love'] }, relationOptions: { tags: [{ value: 'Millions', label: 'Millions' }, { value: 'Love', label: 'Love' }] } });
  assert.match(multiselectHtml, /<select id="admin-field-artigo-tags" name="tags" multiple size="5"><option value="Millions">Millions<\/option><option value="Love" selected>Love<\/option><\/select>/);

  // 8. readAdminFormValues: multiselect lê selectedOptions como array; campo com valueType:'number' converte para número mesmo sendo um <select>, não <input type="number">.
  const relationFormElement = {
    querySelector: (selector) => ({
      '[name="categoryId"]': { value: '2' },
      '[name="tags"]': { selectedOptions: [{ value: 'Millions' }, { value: 'Love' }] }
    })[selector] ?? null
  };
  const relationFields = [{ name: 'categoryId', type: 'select', valueType: 'number' }, { name: 'tags', type: 'multiselect' }];
  const relationValues = readAdminFormValues(relationFormElement, relationFields);
  assert.equal(relationValues.categoryId, 2);
  assert.deepEqual(relationValues.tags, ['Millions', 'Love']);

  // 9. renderAdminList: searchHref/searchValue renderizam a barra de busca ("searchtools") com o termo atual preenchido.
  const searchHtml = renderAdminList({ rows: [{ id: 1, title: 'X' }], editHref: () => '#', searchHref: '#/articles', searchValue: 'termo <atual>' });
  assert.match(searchHtml, /<form class="admin-searchbar" method="get" action="#\/articles" role="search">/);
  assert.match(searchHtml, /<input type="search" id="admin-list-search" name="q" value="termo &lt;atual&gt;"/);

  // 10. renderAdminList: pagination só aparece com mais de 1 página; página atual marcada com aria-current, demais como link real.
  const noPaginationHtml = renderAdminList({ rows: [{ id: 1, title: 'X' }], editHref: () => '#', pagination: { page: 1, pageCount: 1, link: () => '#' } });
  assert.ok(!noPaginationHtml.includes('admin-pagination'));
  const paginationHtml = renderAdminList({ rows: [{ id: 1, title: 'X' }], editHref: () => '#', pagination: { page: 2, pageCount: 3, link: (page) => `#/articles?page=${page}` } });
  assert.match(paginationHtml, /<a href="#\/articles\?page=1">1<\/a>/);
  assert.match(paginationHtml, /<span aria-current="page">2<\/span>/);
  assert.match(paginationHtml, /<a href="#\/articles\?page=3">3<\/a>/);

  // 11. renderAdminForm: sem nenhum field.tab, a saída continua plana (sem role="tablist"), preservando o comportamento de todo formulário já existente.
  const flatHtml = renderAdminForm({ formId: 'artigo', fields: ARTICLE_FIELDS, values: {} });
  assert.ok(!flatHtml.includes('role="tablist"'));

  // 12. renderAdminForm: com field.tab (ex.: SITE_CONFIG_FIELDS), agrupa em abas ARIA (tablist/tab/tabpanel); só a primeira aba começa visível, as demais com `hidden`; campo sem tab cai na primeira aba.
  const tabFields = [
    { name: 'siteName', label: 'Nome', type: 'text', tab: 'Site' },
    { name: 'basePath', label: 'Caminho base', type: 'text', tab: 'Sistema' },
    { name: 'legacyField', label: 'Legado (sem tab)', type: 'text' }
  ];
  const tabbedHtml = renderAdminForm({ formId: 'site-config', fields: tabFields, values: { siteName: 'X' } });
  assert.match(tabbedHtml, /<div class="admin-tabs" role="tablist">/);
  assert.match(tabbedHtml, /<button type="button" role="tab" id="admin-tab-site-config-site-label" aria-controls="admin-tab-site-config-site-panel" aria-selected="true" data-admin-tab-button tabindex="0">Site<\/button>/);
  assert.match(tabbedHtml, /<button type="button" role="tab" id="admin-tab-site-config-sistema-label" aria-controls="admin-tab-site-config-sistema-panel" aria-selected="false" data-admin-tab-button tabindex="-1">Sistema<\/button>/);
  assert.match(tabbedHtml, /<div role="tabpanel" id="admin-tab-site-config-site-panel" aria-labelledby="admin-tab-site-config-site-label" data-admin-tab-panel>.*Nome/);
  assert.match(tabbedHtml, /<div role="tabpanel" id="admin-tab-site-config-sistema-panel" aria-labelledby="admin-tab-site-config-sistema-label" data-admin-tab-panel hidden>/);
  assert.match(tabbedHtml, /Legado \(sem tab\).*<\/div><div role="tabpanel" id="admin-tab-site-config-sistema-panel"/); // campo sem tab fica na primeira aba (Site), antes do fechamento do painel

  console.log('ok - renderAdminForm produces accessible labeled fields for every supported type, escapes values and marks required/readOnly');
  console.log('ok - readAdminFormValues converts number/checkbox/text from a form-like object and tolerates a missing field');
  console.log('ok - renderAdminList renders chosen columns with an escaped, safe edit link, an accessible empty state, and an optional "new" link');
  console.log('ok - renderAdminList renders recognized state/featured/enabled values as circular state icons (no visible text) instead of raw text');
  console.log('ok - renderAdminForm renders a relational select/multiselect from relationOptions, marking the real stored value(s) as selected');
  console.log('ok - readAdminFormValues reads multiselect as an array and converts a select with valueType number');
  console.log('ok - renderAdminList renders the search bar with the current escaped term');
  console.log('ok - renderAdminList renders pagination only above 1 page, marking the current page and linking the others');
  console.log('ok - renderAdminForm stays flat (no tablist) when no field declares a tab');
  console.log('ok - renderAdminForm groups fields into ARIA tabs when at least one field declares a tab, defaulting untagged fields to the first tab');

  // 13. renderAdminForm: campo richtext (ex.: ARTICLE_FIELDS.articletext) renderiza como textarea com data-admin-richtext (e data-admin-readmore, quando field.readMoreButton), mesmo contrato de leitura que textarea simples.
  const richtextHtml = renderAdminForm({ formId: 'artigo', fields: ARTICLE_FIELDS, values: { articletext: '<p>Texto</p>' } });
  assert.match(richtextHtml, /<textarea id="admin-field-artigo-articletext" name="articletext" data-admin-richtext data-admin-readmore rows="4">&lt;p&gt;Texto&lt;\/p&gt;<\/textarea>/);
  const richtextFormElement = { querySelector: (selector) => selector === '[name="articletext"]' ? { value: '<p>Editado</p>' } : null };
  const richtextValues = readAdminFormValues(richtextFormElement, ARTICLE_FIELDS);
  assert.equal(richtextValues.articletext, '<p>Editado</p>');
  console.log('ok - renderAdminForm renders a richtext field as a textarea with data-admin-richtext/data-admin-readmore, and readAdminFormValues reads it exactly like a plain textarea');

  // 14. renderAdminForm: um campo richtext SEM readMoreButton (ex.: customHtmlBody da configuração do site) nunca recebe data-admin-readmore — o botão "Leia mais" é exclusivo de articletext.
  const noReadMoreField = [{ name: 'customHtmlBody', label: 'HTML', type: 'richtext' }];
  const noReadMoreHtml = renderAdminForm({ formId: 'site-config', fields: noReadMoreField, values: {} });
  assert.match(noReadMoreHtml, /<textarea id="admin-field-site-config-customHtmlBody" name="customHtmlBody" data-admin-richtext rows="4">/);
  assert.ok(!noReadMoreHtml.includes('data-admin-readmore'));
  console.log('ok - renderAdminForm never adds data-admin-readmore to a richtext field without readMoreButton (customHtmlBody stays a plain rich editor)');

  // 15. renderArticleAdminForm: estrutura Joomla-like com cabeçalho (title/alias), abas ARIA e grid main+sidebar.
  const articleLayoutHtml = renderArticleAdminForm({
    formId: 'articles',
    fields: ARTICLE_FIELDS,
    values: { title: 'X', alias: 'x', state: 'Draft' },
    relationOptions: { categoryId: [{ value: 1, label: 'Blog' }] },
    layout: ARTICLE_EDITOR_LAYOUT,
    submitLabel: 'Salvar',
    cancelHref: '#/articles'
  });
  assert.match(articleLayoutHtml, /<form class="admin-form admin-form-article" data-admin-form="articles">/);
  assert.match(articleLayoutHtml, /<div class="admin-article-header">[\s\S]*admin-field-articles-title[\s\S]*admin-field-articles-alias/);
  assert.match(articleLayoutHtml, /role="tablist"/);
  assert.match(articleLayoutHtml, /role="tab"/);
  assert.match(articleLayoutHtml, /role="tabpanel"/);
  assert.match(articleLayoutHtml, /class="admin-article-grid"/);
  assert.match(articleLayoutHtml, /class="admin-article-main"/);
  assert.match(articleLayoutHtml, /class="admin-article-sidebar"/);
  for (const field of ARTICLE_FIELDS) assert.equal((articleLayoutHtml.match(new RegExp(`name="${field.name}"`, 'g')) ?? []).length, 1, `${field.name} appears once, never disappears or duplicates`);
  for (const field of ARTICLE_OPTION_FIELDS) assert.match(articleLayoutHtml, new RegExp(`name="${field.name}"`));
  for (const key of ['content', 'images', 'options', 'publishing', 'metadata']) assert.match(articleLayoutHtml, new RegExp(`id="admin-article-tab-articles-${key}-label"`));
  assert.match(articleLayoutHtml, /name="attribsJson" readonly disabled/);
  for (const name of ['metaDescription', 'metaKeywords']) assert.doesNotMatch(articleLayoutHtml, new RegExp(`name="${name}" readonly`));
  assert.match(articleLayoutHtml, /name="images:image_intro"[\s\S]*name="images:image_fulltext_caption"[\s\S]*name="urls:urla"/);
  assert.match(articleLayoutHtml, /data-admin-article-accessibility/);
  assert.match(articleLayoutHtml, /Campos personalizados, Schema\.org, permissões\/ACL/);
  assert.doesNotMatch(articleLayoutHtml, /Nenhum campo nesta aba|name="(?:rules|image_intro|urla)"/);
  console.log('ok - renderArticleAdminForm renders a Joomla-like article editor layout with header fields, ARIA tabs, and a main+sidebar grid');

  console.log('admin render: 15 testes aprovados');
}

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const joomla = resolve(project, '..', 'JOOMLA');
const revision = '52559589cb6a02c9e2fc48270f92b3aff7b8b7a0';
const get = path => execFileSync('git', ['show', `${revision}:${path}`], { cwd: joomla });
const iniPath = 'administrator/language/en-GB/plg_sampledata_blog.ini';
const phpPath = 'plugins/sampledata/blog/src/Extension/Blog.php';
const php = get(phpPath).toString('utf8');
const ini = {};
for (const line of get(iniPath).toString('utf8').split(/\r?\n/)) {
  if (!line.trim() || line.startsWith(';')) continue;
  const match = /^([A-Z0-9_]+)="((?:[^"\\]|\\.)*)"$/.exec(line);
  if (!match || Object.hasOwn(ini, match[1])) throw Error('Unsupported or duplicate INI entry');
  ini[match[1]] = match[2].replace(/\\(["\\])/g, '$1');
}
const key = suffix => ini['PLG_SAMPLEDATA_BLOG_SAMPLEDATA_' + suffix];
const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const row = (key, values, refs = {}) => ({ key, values, ...refs });
const categories = Array.from({ length: 4 }, (_, i) => row(slug(key(`CONTENT_CATEGORY_${i}_TITLE`)), { title: key(`CONTENT_CATEGORY_${i}_TITLE`), alias: slug(key(`CONTENT_CATEGORY_${i}_TITLE`)), description: '', state: 'Published' }, { parentRef: null }));
const tags = Array.from({ length: 4 }, (_, i) => row(slug(key(`TAG_${i}_TITLE`)), { name: key(`TAG_${i}_TITLE`), alias: slug(key(`TAG_${i}_TITLE`)), state: 'Published', description: '' }, { parentRef: i === 3 ? slug(key('TAG_2_TITLE')) : null }));
const block = php.split('$articles = [')[1].split('\n        ];')[0];
const offsets = [...block.matchAll(/'catid'\s*=>\s*\$catIds\[(\d+)\]/g)];
if (offsets.length !== 11) throw Error('Article reference changed');
const files = new Map();
const articles = offsets.map((entry, i) => {
  const text = block.slice(entry.index, offsets[i + 1]?.index ?? block.length);
  const images = {};
  for (const kind of ['intro', 'fulltext']) {
    const asset = new RegExp(`'image_${kind}'\\s*=>\\s*'([^'#]*)(?:#[^']*)?'`).exec(text)?.[1];
    if (!asset) continue;
    images['image_' + kind] = '__SAMPLE_MEDIA_BASE__/' + asset;
    const alt = new RegExp(`'image_${kind}_alt'\\s*=>\\s*(?:\\$this->getApplication\\(\\)->getLanguage\\(\\)->_\\('([^']+)'\\)|'([^']*)')`).exec(text);
    images['image_' + kind + '_alt'] = alt?.[1] ? ini[alt[1]] : alt?.[2] ?? '';
    images['image_' + kind + '_caption'] = new RegExp(`'image_${kind}_caption'\\s*=>\\s*'([^']*)'`).exec(text)?.[1] ?? '';
    images['float_' + kind] = new RegExp(`'float_${kind}'\\s*=>\\s*'([^']*)'`).exec(text)?.[1] ?? '';
    files.set(asset, get(asset));
  }
  return row(slug(key(`CONTENT_ARTICLE_${i}_TITLE`)), {
    title: key(`CONTENT_ARTICLE_${i}_TITLE`), alias: slug(key(`CONTENT_ARTICLE_${i}_TITLE`)),
    introtext: key(`CONTENT_ARTICLE_${i}_INTROTEXT`).replace('href="index.php"', 'href="#/"'), fulltext: key(`CONTENT_ARTICLE_${i}_FULLTEXT`),
    state: 'Published', featured: /'featured'\s*=>\s*1/.test(text), publishUp: '2026-11-06T00:00:00.000Z', publishDown: null,
    author: 'Joomla sample data', authorAlias: 'Joomla sample data', language: '*', note: '', versionNote: '', featuredUp: null, featuredDown: null,
    metaDescription: '', metaKeywords: '', attribsJson: JSON.stringify({ images })
  }, { categoryRef: categories[Number(entry[1])].key, tagRefs: text.includes("array_map('strval', $tagIds)") ? tags.map(t => t.key) : [] });
});
const menuDefinitions = [['blog-home', 0, '/', null], ['about', 1, '/article/about', null], ['working-on-your-site', 4, '/category/help', null], ['sample-layouts', 11, '/categories', null], ['category-list', 12, '/category/blog?layout=list', 'sample-layouts'], ['articles', 13, '/category/joomla', 'sample-layouts'], ['typography', 14, '/article/typography', null], ['search', 15, '/search', null]];
const menu = menuDefinitions.map(([id, i, path, parentRef], index) => row(id, { title: key(`MENUS_ITEM_${i}_TITLE`), path, published: 'Published', ordering: index + 1 }, { parentRef }));
const extensions = [['emailcloak', 3, { mode: '1' }], ['loadmodule', 7, { style: 'xhtml' }], ['pagebreak', 8, { title: '1', multipage_toc: '1', showall: '1' }], ['pagenavigation', 9, { position: '1' }]].map(([id, ordering, params]) => row(id, { title: 'plg_content_' + id, key: id, type: 'Plugin', entryPointUrl: 'native:' + id, enabled: true, ordering, params, manifestJson: JSON.stringify({ group: 'content', params: [] }) }));
const templates = [row('cassiopeia', { title: 'Cassiopeia', key: 'cassiopeia', version: '0.8.0', entryPointUrl: '__SAMPLE_RELEASE_BASE__/templates/cassiopeia/index.js', styles: '', positionsJson: JSON.stringify(['topbar', 'below-top', 'menu', 'search', 'banner', 'breadcrumbs', 'top-a', 'top-b', 'main-top', 'sidebar-left', 'sidebar-right', 'main-bottom', 'bottom-a', 'bottom-b', 'footer', 'component']), enabled: true })];
const module = (id, extensionKey, title, position, ordering, settings, route, showTitle = true) => row(id, { title, extensionKey, position, ordering, settings, enabled: true, showTitle, scopeKind: 'All', scopeRoute: '', scopeCategoryAlias: '', trashed: false, publishUp: '2026-11-06T00:00:00.000Z', publishDown: null, assignment: route ? 'only' : 'all', assignmentTokens: route ? ['route:' + route] : [], note: '' });
const banner = key('MODULES_MODULE_8_CONTENT').replace('%s', '#/article/typography');
files.set('images/banners/banner.jpg', get('images/banners/banner.jpg'));
const moduleInstances = [
  module('latest-posts', 'articles', key('MODULES_MODULE_4_TITLE'), 'top-a', 6, { limit: 3, category: 'joomla', ordering: 'title', showDate: false }, 'home', false),
  module('archive-months', 'articles-archive', key('MODULES_MODULE_3_TITLE'), 'sidebar-right', 4, { limit: 10 }),
  module('popular-tags', 'tags-popular', key('MODULES_MODULE_9_TITLE'), 'bottom-b', 1, {}),
  module('similar-items', 'related-items', key('MODULES_MODULE_10_TITLE'), 'bottom-b', 0, { limit: 5, showDate: false }, 'article'),
  module('search', 'search', key('MODULES_MODULE_7_TITLE'), 'search', 1, { label: 'Search', buttonText: 'Search' }, null, false),
  module('text-banner', 'custom-html', key('MODULES_MODULE_8_TITLE'), 'banner', 1, { title: '', html: '<img src="__SAMPLE_MEDIA_BASE__/images/banners/banner.jpg" alt="" loading="lazy">' + banner }, 'home', false),
  module('older-posts', 'articles', key('MODULES_MODULE_5_TITLE'), 'bottom-b', 2, { limit: 6, category: 'blog', ordering: 'oldest', showDate: false })
];
// Read the actual native defaults; generator imports metadata, never PHP/render code.
const { TEMPLATE_PARAM_DEFINITIONS } = await import('../src/templates/cassiopeia/index.js');
const defaults = Object.fromEntries(TEMPLATE_PARAM_DEFINITIONS.filter(d => d.default !== undefined).map(d => [d.name, d.default]));
const siteConfig = [row('site-configuration', { siteName: 'Joomla Blog', siteDescription: 'Joomla Blog sample content — supported subset', templateKey: 'cassiopeia', homeView: 'category', homeCategory: 'blog', language: '*', timezone: 'UTC', basePath: '', pageSize: 8, customHtmlTitle: '', customHtmlBody: '', offline: false, offlineMessage: '', componentParamsJson: JSON.stringify({ content: { numLeading: 4, numIntro: 4, numColumns: 2, numLinks: 0, orderBy: 'publishUp-desc' } }), templateStylesJson: JSON.stringify([{ id: 'cassiopeia-default', template: 'cassiopeia', title: 'Cassiopeia — Default', home: true, params: defaults }]) })];
const data = { schemaVersion: 1, id: 'joomla-blog', version: 1, title: 'Joomla Blog Sample Data', source: { revision, copyright: '(C) 2017 Open Source Matters, Inc.', license: 'GPL-2.0-or-later', references: [phpPath, iniPath, 'installation/sql/mysql/base.sql'] }, domains: { categories, tags, articles, menu, extensions, templates, moduleInstances, siteConfig }, assets: [...files].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })) };
const target = resolve(project, 'src/plugins/sampledata/blog/data.js');
const generated = '// Generated from Joomla reference ' + revision + '. GPL-2.0-or-later; (C) Open Source Matters.\nexport const JOOMLA_BLOG_DATA = ' + JSON.stringify(data, null, 2) + ';\n';
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== generated) throw Error('Generated sample data differs');
} else { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, generated); }
for (const [path, bytes] of files) {
  const destination = resolve(project, 'src/media/sampledata/joomla-blog', path);
  if (process.argv.includes('--check')) { if (!readFileSync(destination).equals(bytes)) throw Error('Sample image differs'); }
  else { mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, bytes); }
}
console.log(`Joomla sample: 40 records, ${files.size} exact-byte JPEGs, revision ${revision}`);

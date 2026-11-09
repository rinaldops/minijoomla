import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(PROJECT, 'tmp');
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const slash = (value) => value.split(sep).join('/');

// Exact local paths, never globs or a recursive source copy. New files require
// an explicit selection review. Inclusion is NOT a privacy/rights approval.
export const CONTRIBUTOR_FILES = Object.freeze([
  '.gitattributes',
  '.gitignore',
  'LICENSE.md',
  'README.md',
  'package.json',
  'docs/ADMIN-LAYOUT-TESTS.md',
  'docs/CONTRIBUTING.md',
  'docs/CONTRIBUTOR-SELECTION.md',
  'docs/CONTRATOS-EVOLUCAO-XML.md',
  'docs/LOCAL-DEMO.md',
  'docs/EXTENSOES-JOOMLA.md',
  'docs/ETAPA-1-SAMPLE-DATA.md',
  'docs/RELEASE-CORE.md',
  'docs/SECURITY.md',
  'docs/THIRD-PARTY-NOTICES.md',
  'docs/PROVENIENCIA-DOCUMENTATION.md',
  'docs/licenses/GPL-2.0.txt',
  'examples/admin.html',
  'examples/demo-plugin.js',
  'examples/demo-repositories.js',
  'examples/index.html',
  'scripts/audit-distribution.js',
  'scripts/check-syntax.js',
  'scripts/release-check.js',
  'scripts/serve-local.js',
  'scripts/stage-contributor.js',
  'scripts/stage-release.js',
  'scripts/module-manifests.js',
  'scripts/prepare-module-adoption.js',
  'scripts/prepare-editorial-adaptation.js',
  'scripts/prepare-highlights-adaptation.js',
  'scripts/prepare-topsections-adaptation.js',
  'scripts/prepare-xml-module-group.js',
  'scripts/prepare-hero-adaptation.js',
  'scripts/prepare-home-adaptation.js',
  'scripts/prepare-recursos-adaptation.js',
  'scripts/prepare-showcase-adaptation.js',
  'scripts/prepare-documentation-adaptation.js',
  'scripts/prepare-documentation-source-package.js',
  'scripts/documentation-frozen-build/LICENSE.md',
  'scripts/documentation-frozen-build/package.json',
  'scripts/documentation-frozen-build/docs/THIRD-PARTY-NOTICES.md',
  'scripts/documentation-frozen-build/docs/licenses/GPL-2.0.txt',
  'scripts/documentation-frozen-build/scripts/prepare-documentation-adaptation.js',
  'scripts/documentation-frozen-build/scripts/prepare-documentation-source-package.js',
  'scripts/documentation-frozen-build/scripts/prepare-editorial-adaptation.js',
  'scripts/documentation-frozen-build/scripts/prepare-hero-adaptation.js',
  'scripts/documentation-frozen-build/scripts/prepare-home-adaptation.js',
  'scripts/documentation-frozen-build/scripts/prepare-module-adoption.js',
  'scripts/documentation-frozen-build/src/libraries/minijoomla/application/declared-params.js',
  'scripts/documentation-frozen-build/src/libraries/minijoomla/application/extension-input.js',
  'scripts/documentation-frozen-build/src/libraries/minijoomla/application/joomla-manifest.js',
  'scripts/documentation-frozen-build/src/libraries/minijoomla/application/package-path.js',
  'scripts/documentation-frozen-build/src/libraries/minijoomla/core/contracts.js',
  'scripts/documentation-frozen-build/src/libraries/vendor/parse-xml/LICENSE',
  'scripts/documentation-frozen-build/src/libraries/vendor/parse-xml/notices.txt',
  'scripts/documentation-frozen-build/src/libraries/vendor/parse-xml/parse-xml.js',
  'scripts/generate-joomla-sampledata.js',
  'scripts/test-admin-layout.js',
  'scripts/test-standalone-examples.js',
  'src/media/templates/administrator/atum/css/template.css',
  'src/administrator/components/com_minijoomla/app.js',
  'src/administrator/components/com_minijoomla/article-accessibility.js',
  'src/administrator/components/com_minijoomla/content-pages.js',
  'src/administrator/components/com_minijoomla/editor.js',
  'src/administrator/components/com_minijoomla/extension-management.js',
  'src/administrator/components/com_minijoomla/extension-pages.js',
  'src/administrator/components/com_minijoomla/field-schemas.js',
  'src/administrator/components/com_minijoomla/icons.js',
  'src/administrator/components/com_minijoomla/menu-types.js',
  'src/administrator/components/com_menus/src/Model/menu-item.js',
  'src/administrator/components/com_categories/tmpl/categories/default.js',
  'src/administrator/components/com_modules/tmpl/modules/default.js',
  'src/administrator/components/com_modules/tmpl/positions/default.js',
  'src/administrator/components/com_modules/tmpl/module/edit.js',
  'src/administrator/components/com_modules/tmpl/select/default.js',
  'src/administrator/components/com_plugins/tmpl/plugins/default.js',
  'src/administrator/components/com_plugins/tmpl/plugin/edit.js',
  'src/administrator/components/com_templates/tmpl/styles/default.js',
  'src/administrator/components/com_templates/tmpl/style/edit.js',
  'src/administrator/components/com_tags/tmpl/tags/default.js',
  'src/administrator/components/com_config/tmpl/application/default.js',
  'src/administrator/components/com_config/tmpl/components/default.js',
  'src/administrator/components/com_installer/src/Controller/discover.js',
  'src/administrator/components/com_installer/src/View/confirmation.js',
  'src/administrator/components/com_installer/tmpl/discover/default.js',
  'src/administrator/components/com_installer/tmpl/manage/default.js',
  'src/administrator/components/com_templates/src/Controller/discover.js',
  'src/administrator/components/com_templates/tmpl/discover/default.js',
  'src/administrator/components/com_content/src/Model/article.js',
  'src/administrator/components/com_content/tmpl/articles/default.js',
  'src/administrator/components/com_media/tmpl/media/default.js',
  'src/administrator/components/com_minijoomla/render-article-form.js',
  'src/administrator/components/com_minijoomla/render-form.js',
  'src/administrator/components/com_minijoomla/render-list.js',
  'src/administrator/components/com_installer/src/Model/discovery.js',
  'src/administrator/templates/atum/index.js',
  'src/administrator/templates/atum/templateDetails.xml',
  'src/media/vendor/tinymce/icons/default/icons.min.js',
  'src/media/vendor/tinymce/license.md',
  'src/media/vendor/tinymce/models/dom/model.min.js',
  'src/media/vendor/tinymce/notices.txt',
  'src/media/vendor/tinymce/plugins/accordion/plugin.min.js',
  'src/media/vendor/tinymce/plugins/anchor/plugin.min.js',
  'src/media/vendor/tinymce/plugins/charmap/plugin.min.js',
  'src/media/vendor/tinymce/plugins/code/plugin.min.js',
  'src/media/vendor/tinymce/plugins/codesample/plugin.min.js',
  'src/media/vendor/tinymce/plugins/directionality/plugin.min.js',
  'src/media/vendor/tinymce/plugins/emoticons/js/emojiimages.min.js',
  'src/media/vendor/tinymce/plugins/emoticons/js/emojis.min.js',
  'src/media/vendor/tinymce/plugins/emoticons/plugin.min.js',
  'src/media/vendor/tinymce/plugins/fullscreen/plugin.min.js',
  'src/media/vendor/tinymce/plugins/help/js/i18n/keynav/en.js',
  'src/media/vendor/tinymce/plugins/help/js/i18n/keynav/pt_BR.js',
  'src/media/vendor/tinymce/plugins/help/plugin.min.js',
  'src/media/vendor/tinymce/plugins/image/plugin.min.js',
  'src/media/vendor/tinymce/plugins/insertdatetime/plugin.min.js',
  'src/media/vendor/tinymce/plugins/link/plugin.min.js',
  'src/media/vendor/tinymce/plugins/lists/plugin.min.js',
  'src/media/vendor/tinymce/plugins/media/plugin.min.js',
  'src/media/vendor/tinymce/plugins/nonbreaking/plugin.min.js',
  'src/media/vendor/tinymce/plugins/preview/plugin.min.js',
  'src/media/vendor/tinymce/plugins/searchreplace/plugin.min.js',
  'src/media/vendor/tinymce/plugins/table/plugin.min.js',
  'src/media/vendor/tinymce/plugins/visualblocks/plugin.min.js',
  'src/media/vendor/tinymce/plugins/visualchars/plugin.min.js',
  'src/media/vendor/tinymce/skins/content/default/content.min.css',
  'src/media/vendor/tinymce/skins/ui/oxide/content.min.css',
  'src/media/vendor/tinymce/skins/ui/oxide/skin.min.css',
  'src/media/vendor/tinymce/themes/silver/theme.min.js',
  'src/media/vendor/tinymce/tinymce.min.js',
  'src/libraries/minijoomla/application/admin-extensions-service.js',
  'src/libraries/minijoomla/application/admin-service.js',
  'src/libraries/minijoomla/application/admin-plugins.js',
  'src/libraries/minijoomla/application/sample-data-service.js',
  'src/libraries/minijoomla/infrastructure/sample-data-journal.js',
  'src/administrator/modules/mod_sampledata/tmpl/default.js',
  'src/administrator/modules/mod_sampledata/mod_sampledata.js',
  'src/administrator/modules/mod_sampledata/mod_sampledata.xml',
  'src/administrator/modules/mod_sampledata/src/Helper/sampledata.js',
  'src/plugins/sampledata/blog/blog.js',
  'src/plugins/sampledata/blog/blog.xml',
  'src/plugins/sampledata/blog/data.js',
  'src/media/sampledata/joomla-blog/images/banners/banner.jpg',
  'src/media/sampledata/joomla-blog/images/sampledata/cassiopeia/nasa1-1200.jpg',
  'src/media/sampledata/joomla-blog/images/sampledata/cassiopeia/nasa1-400.jpg',
  'src/media/sampledata/joomla-blog/images/sampledata/cassiopeia/nasa1-640.jpg',
  'src/media/sampledata/joomla-blog/images/sampledata/cassiopeia/nasa2-1200.jpg',
  'src/media/sampledata/joomla-blog/images/sampledata/cassiopeia/nasa2-400.jpg',
  'src/media/sampledata/joomla-blog/images/sampledata/cassiopeia/nasa2-640.jpg',
  'src/media/sampledata/joomla-blog/images/sampledata/cassiopeia/nasa3-1200.jpg',
  'src/media/sampledata/joomla-blog/images/sampledata/cassiopeia/nasa3-400.jpg',
  'src/media/sampledata/joomla-blog/images/sampledata/cassiopeia/nasa3-640.jpg',
  'src/media/sampledata/joomla-blog/images/sampledata/cassiopeia/nasa4-1200.jpg',
  'src/media/sampledata/joomla-blog/images/sampledata/cassiopeia/nasa4-400.jpg',
  'src/libraries/minijoomla/application/component-options.js',
  'src/libraries/minijoomla/application/content-service.js',
  'src/libraries/minijoomla/application/declared-params.js',
  'src/libraries/minijoomla/application/extension-discovery-service.js',
  'src/libraries/minijoomla/application/extension-input.js',
  'src/libraries/minijoomla/application/extension-migration-plan.js',
  'src/libraries/minijoomla/application/extension-manifest.js',
  'src/libraries/minijoomla/application/joomla-discovery.js',
  'src/libraries/minijoomla/application/joomla-extension-installer.js',
  'src/libraries/minijoomla/application/joomla-host-config.js',
  'src/libraries/minijoomla/application/joomla-package-assets.js',
  'src/libraries/minijoomla/application/joomla-manifest.js',
  'src/libraries/minijoomla/application/legacy-module-assignment.js',
  'src/libraries/minijoomla/application/media-upload-service.js',
  'src/libraries/minijoomla/application/module-assignment.js',
  'src/libraries/minijoomla/application/module-catalog.js',
  'src/libraries/minijoomla/application/module-styles.js',
  'src/libraries/minijoomla/application/package-path.js',
  'src/libraries/minijoomla/application/site-config-overrides.js',
  'src/libraries/minijoomla/application/template-runtime.js',
  'src/libraries/minijoomla/application/template-styles.js',
  'src/components/com_content/tmpl/archive/default.js',
  'src/components/com_content/tmpl/article/default.js',
  'src/components/com_content/tmpl/categories/default.js',
  'src/components/com_content/tmpl/category/blog.js',
  'src/components/com_content/tmpl/category/default.js',
  'src/components/com_content/tmpl/featured/default.js',
  'src/components/com_finder/tmpl/search/default.js',
  'src/components/com_tags/tmpl/tag/default.js',
  'src/components/com_tags/tmpl/tags/default.js',
  'src/administrator/components/com_content/tmpl/article/edit.js',
  'src/layouts/joomla/content/info_block.js',
  'src/layouts/joomla/content/links.js',
  'src/layouts/joomla/content/intro_image.js',
  'src/layouts/joomla/content/full_image.js',
  'src/layouts/joomla/content/tags.js',
  'src/layouts/joomla/pagination/links.js',
  'src/libraries/minijoomla/composition/createMiniJoomlaAdminApp.js',
  'src/libraries/minijoomla/composition/createMiniJoomlaSharePointApp.js',
  'src/libraries/minijoomla/composition/createMiniJoomlaSiteApplication.js',
  'src/libraries/minijoomla/composition/mountMiniJoomlaSite.js',
  'src/libraries/minijoomla/core/config.js',
  'src/libraries/minijoomla/core/contracts.js',
  'src/libraries/minijoomla/core/date-window.js',
  'src/libraries/minijoomla/core/events.js',
  'src/libraries/minijoomla/core/format.js',
  'src/libraries/minijoomla/core/router.js',
  'src/index.js',
  'src/libraries/minijoomla/infrastructure/fake-adapter.js',
  'src/libraries/minijoomla/infrastructure/spmiddle-adapter.js',
  'src/libraries/minijoomla/infrastructure/spmiddle-data-sources.js',
  'src/libraries/minijoomla/infrastructure/spmiddle-error-translation.js',
  'src/libraries/minijoomla/infrastructure/spmiddle-repositories.js',
  'src/libraries/minijoomla/infrastructure/spmiddle-schemas.js',
  'src/libraries/minijoomla/infrastructure/spmiddle-test-schemas.js',
  'src/libraries/minijoomla/infrastructure/spmiddle-extension-guard.js',
  'src/libraries/minijoomla/index.js',
  'src/libraries/vendor/parse-xml/LICENSE',
  'src/libraries/vendor/parse-xml/notices.txt',
  'src/libraries/vendor/parse-xml/parse-xml.js',
  'src/libraries/minijoomla/modules/dynamic-modules.js',
  'src/libraries/minijoomla/modules/registry.js',
  'src/libraries/minijoomla/modules/module-helpers.js',
  'src/modules/mod_articles/mod_articles.js',
  'src/modules/mod_articles/mod_articles.xml',
  'src/modules/mod_articles/tmpl/default.js',
  'src/modules/mod_articles_categories/mod_articles_categories.js',
  'src/modules/mod_articles_categories/mod_articles_categories.xml',
  'src/modules/mod_articles_categories/tmpl/default.js',
  'src/modules/mod_footer/mod_footer.js',
  'src/modules/mod_footer/mod_footer.xml',
  'src/modules/mod_footer/tmpl/default.js',
  'src/modules/mod_login/mod_login.js',
  'src/modules/mod_login/mod_login.xml',
  'src/modules/mod_login/tmpl/default.js',
  'src/modules/mod_related_items/mod_related_items.js',
  'src/modules/mod_related_items/mod_related_items.xml',
  'src/modules/mod_related_items/tmpl/default.js',
  'src/libraries/minijoomla/modules/content-runtime.js',
  'src/libraries/minijoomla/plugins/manager.js',
  'src/modules/mod_articles_archive/mod_articles_archive.js',
  'src/modules/mod_articles_archive/mod_articles_archive.xml',
  'src/modules/mod_articles_archive/tmpl/default.js',
  'src/modules/mod_articles_category/mod_articles_category.js',
  'src/modules/mod_articles_category/mod_articles_category.xml',
  'src/modules/mod_articles_category/tmpl/default.js',
  'src/modules/mod_articles_latest/mod_articles_latest.js',
  'src/modules/mod_articles_latest/mod_articles_latest.xml',
  'src/modules/mod_articles_latest/tmpl/default.js',
  'src/modules/mod_articles_news/mod_articles_news.js',
  'src/modules/mod_articles_news/mod_articles_news.xml',
  'src/modules/mod_articles_news/tmpl/default.js',
  'src/modules/mod_breadcrumbs/mod_breadcrumbs.js',
  'src/modules/mod_breadcrumbs/mod_breadcrumbs.xml',
  'src/modules/mod_breadcrumbs/tmpl/default.js',
  'src/modules/mod_custom/mod_custom.js',
  'src/modules/mod_custom/mod_custom.xml',
  'src/modules/mod_custom/tmpl/default.js',
  'src/modules/mod_menu/tmpl/default.js',
  'src/modules/mod_menu/mod_menu.js',
  'src/modules/mod_menu/mod_menu.xml',
  'src/modules/mod_search/mod_search.js',
  'src/modules/mod_search/mod_search.xml',
  'src/modules/mod_search/tmpl/default.js',
  'src/modules/mod_tags_popular/mod_tags_popular.js',
  'src/modules/mod_tags_popular/mod_tags_popular.xml',
  'src/modules/mod_tags_popular/tmpl/default.js',
  'src/modules/mod_tags_similar/mod_tags_similar.js',
  'src/modules/mod_tags_similar/mod_tags_similar.xml',
  'src/modules/mod_tags_similar/tmpl/default.js',
  'src/plugins/content/emailcloak/emailcloak.js',
  'src/plugins/content/emailcloak/emailcloak.xml',
  'src/plugins/content/loadmodule/loadmodule.js',
  'src/plugins/content/loadmodule/loadmodule.xml',
  'src/plugins/content/pagebreak/pagebreak.js',
  'src/plugins/content/pagebreak/pagebreak.xml',
  'src/plugins/content/pagenavigation/pagenavigation.js',
  'src/plugins/content/pagenavigation/pagenavigation.xml',
  'src/libraries/minijoomla/security/sanitize.js',
  'src/media/templates/site/camap/css/layout.css',
  'src/media/templates/site/camap/css/responsive.css',
  'src/media/templates/site/camap/css/template.css',
  'src/media/templates/site/cassiopeia/css/template.css',
  'src/templates/camap/index.js',
  'src/templates/camap/templateDetails.xml',
  'src/templates/cassiopeia/index.js',
  'src/templates/cassiopeia/templateDetails.xml',
  'tests/adapter-contract.test.js',
  'tests/admin-app.test.js',
  'tests/admin-discovery-registration.test.js',
  'tests/admin-errors-dom.test.js',
  'tests/admin-extensions-app.test.js',
  'tests/admin-extensions-service.test.js',
  'tests/admin-integrity.test.js',
  'tests/admin-joomla-content.test.js',
  'tests/admin-joomla-forms.test.js',
  'tests/admin-layout-browser.js',
  'tests/admin-layout-dom.test.js',
  'tests/admin-layout-runner.test.js',
  'tests/admin-layout.html',
  'tests/admin-management-dom.test.js',
  'tests/admin-management.test.js',
  'tests/admin-render.test.js',
  'tests/admin-menu-model.test.js',
  'tests/admin-article-model.test.js',
  'tests/admin-component-views.test.js',
  'tests/admin-config-view.test.js',
  'tests/admin-discovery-views.test.js',
  'tests/admin-taxonomy-views.test.js',
  'tests/admin-modules-view.test.js',
  'tests/admin-plugins-view.test.js',
  'tests/admin-plugins-runtime.test.js',
  'tests/admin-template-styles-view.test.js',
  'tests/admin-module-form-view.test.js',
  'tests/admin-extension-forms-view.test.js',
  'tests/admin-component-options-view.test.js',
  'tests/admin-installer-view.test.js',
  'tests/admin-template-discovery.test.js',
  'tests/admin-service.test.js',
  'tests/article-accessibility.test.js',
  'tests/article-schedule.test.js',
  'tests/camap-template.test.js',
  'tests/cassiopeia-template.test.js',
  'tests/component-options-runtime.test.js',
  'tests/contributor-stage.test.js',
  'tests/core.test.js',
  'tests/distribution-audit.test.js',
  'tests/dynamic-modules.test.js',
  'tests/editor-final.test.js',
  'tests/entity-contracts-final.test.js',
  'tests/extension-discovery-service.test.js',
  'tests/extension-migration-plan.test.js',
  'tests/featured-schedule.test.js',
  'tests/final-acceptance-dom.test.js',
  'tests/image-margins.test.js',
  'tests/legacy-assignment-browser.js',
  'tests/legacy-assignment-forms.test.js',
  'tests/legacy-module-assignment.test.js',
  'tests/media-upload-service.test.js',
  'tests/menu-tree.test.js',
  'tests/modules-joomla.test.js',
  'tests/joomla-discovery.test.js',
  'tests/joomla-host.test.js',
  'tests/joomla-package-assets.test.js',
  'tests/joomla-pilot-lifecycle.test.js',
  'tests/module-adoption.test.js',
  'tests/admin-installer-confirmation.test.js',
  'tests/camap-editorial-adoption.test.js',
  'tests/editorial-adaptation.test.js',
  'tests/highlights-adaptation.test.js',
  'tests/topsections-adaptation.test.js',
  'tests/xml-module-group.test.js',
  'tests/hero-adaptation.test.js',
  'tests/home-adaptation.test.js',
  'tests/recursos-adaptation.test.js',
  'tests/showcase-adaptation.test.js',
  'tests/documentation-adaptation.test.js',
  'tests/documentation-source-package.test.js',
  'tests/joomla-manifest.test.js',
  'tests/module-manifests.test.js',
  'tests/module-runtime.test.js',
  'tests/offline-gate.test.js',
  'tests/plugins-builtin.test.js',
  'tests/plugins-native-runtime.test.js',
  'tests/plugins-save-events.test.js',
  'tests/published-parameter-compat.test.js',
  'tests/provisioning-model.test.js',
  'tests/query-options.test.js',
  'tests/query-options-main-regression.test.js',
  'tests/query-options-main-spmiddle.test.js',
  'tests/plugin-group-storage.test.js',
  'tests/sample-data-service.test.js',
  'tests/sample-data-journal.test.js',
  'tests/sample-data-package.test.js',
  'tests/sample-data-view.test.js',
  'tests/sample-data-native.html',
  'tests/sample-data-singleton.test.js',
  'tests/release-check.test.js',
  'tests/release-stage.test.js',
  'tests/review-fixes.test.js',
  'tests/run-tests.js',
  'tests/runner.test.js',
  'tests/schema-migration.test.js',
  'tests/sanitize-html.test.js',
  'tests/serve-local.test.js',
  'tests/site-config-overrides.test.js',
  'tests/site-views-core.test.js',
  'tests/site-runtime.test.js',
  'tests/spmiddle-adapter.test.js',
  'tests/spmiddle-adapter-cache.test.js',
  'tests/spmiddle-error-translation.test.js',
  'tests/spmiddle-integration.test.js',
  'tests/standalone-examples.test.js',
  'tests/static-ui.test.js',
  'tests/tinymce-notices.test.js',
  'tests/tooling-validation.test.js'
].sort());

function within(root, path) {
  const name = relative(root, path);
  return name === '' || (name !== '..' && !name.startsWith(`..${sep}`) && !isAbsolute(name));
}

function statIfPresent(path) {
  try { return lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function noLinks(path) {
  // lstat detects dangling links too; junctions count as links on Windows.
  let current = resolve(path);
  while (true) {
    if (statIfPresent(current)?.isSymbolicLink()) throw new Error('contributor-links-not-allowed');
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

function validName(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= 240 &&
    !/[\\:%<>"|?*\u0000-\u0020\u007f-\u009f]/.test(name) && !name.startsWith('/') &&
    name.split('/').every((part) => part && !['.', '..', '.git'].includes(part.toLowerCase()) &&
      !/[. ]$/.test(part) && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}

function outputPath(output) {
  if (typeof output !== 'string' || !output || /[\u0000-\u001f]/.test(output) ||
      /^(?:[a-z][\w+.-]*:\/\/|[\\/]{2})/i.test(output) || output.split(/[\\/]/).includes('..')) {
    throw new Error('contributor-output-invalid');
  }
  const path = resolve(PROJECT, output);
  if (!within(TMP, path) || relative(TMP, path) === '' || !validName(slash(relative(PROJECT, path)))) {
    throw new Error('contributor-output-must-be-tmp-descendant');
  }
  noLinks(path);
  return path;
}

function regularFile(root, name) {
  const path = join(root, name);
  noLinks(path);
  const stat = statIfPresent(path);
  if (!stat?.isFile()) throw new Error('contributor-selected-file-missing-or-not-regular');
  if (stat.nlink !== 1) throw new Error('contributor-hardlinks-not-allowed');
  if (!within(root, realpathSync(path))) throw new Error('contributor-source-escape');
  return readFileSync(path);
}

function makeManifest(files) {
  return {
    schemaVersion: 1, target: 'contributor-local', algorithm: 'sha256',
    publicationApproved: false, privacyApproved: false, rightsApproved: false,
    files: [...files].map(([path, data]) => ({ path, bytes: data.length, sha256: sha256(data) }))
  };
}

/** Exact-byte local selection. Fixture roots may only be project tmp descendants. */
export function stageContributor({ output, sourceRoot = PROJECT } = {}) {
  const destination = outputPath(output);
  if (statIfPresent(destination)) throw new Error('contributor-destination-exists-no-overwrite');
  const source = resolve(sourceRoot);
  const projectSource = relative(PROJECT, source) === '';
  if (!projectSource && (!within(TMP, source) || relative(TMP, source) === '')) throw new Error('contributor-fixture-root-must-be-tmp-descendant');
  noLinks(source);
  if (!statIfPresent(source)?.isDirectory()) throw new Error('contributor-source-root-unavailable');
  if (!projectSource && (within(source, destination) || within(destination, source))) throw new Error('contributor-source-output-overlap');
  if (CONTRIBUTOR_FILES.some((name) => !validName(name)) || new Set(CONTRIBUTOR_FILES.map((name) => name.toLowerCase())).size !== CONTRIBUTOR_FILES.length) throw new Error('contributor-allowlist-invalid');
  const files = new Map(CONTRIBUTOR_FILES.map((name) => [name, regularFile(source, name)]));
  const manifest = makeManifest(files);
  // No rewriting, sanitization, import traversal or sibling/Git/tmp reads.
  for (const [name, data] of files) {
    if (!regularFile(source, name).equals(data)) throw new Error('contributor-source-changed');
  }
  mkdirSync(dirname(destination), { recursive: true });
  noLinks(destination);
  mkdirSync(destination); // Exclusive reservation: an existing/racing stage fails.
  for (const [name, data] of [...files, ['manifest.json', Buffer.from(json(manifest))]]) {
    const path = join(destination, name);
    noLinks(path);
    mkdirSync(dirname(path), { recursive: true });
    noLinks(path);
    writeFileSync(path, data, { flag: 'wx' });
  }
  verifyContributorStage({ output: destination });
  return { output: destination, manifest };
}

/** Read-only integrity/inventory gate; NOT a candidate, privacy or rights audit. */
export function verifyContributorStage({ output } = {}) {
  const root = outputPath(output);
  const manifestBytes = regularFile(root, 'manifest.json');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (!Array.isArray(manifest?.files) || manifest.files.length !== CONTRIBUTOR_FILES.length ||
      manifest.files.some((entry, index) => entry?.path !== CONTRIBUTOR_FILES[index])) throw new Error('contributor-manifest-selection-mismatch');
  const names = [];
  function walk(directory) {
    noLinks(directory);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      noLinks(path);
      if (entry.isDirectory()) {
        const name = `${slash(relative(root, path))}/`;
        if (!CONTRIBUTOR_FILES.some((file) => file.startsWith(name))) throw new Error('contributor-unmanifested-directory');
        walk(path);
      }
      else if (entry.isFile()) names.push(slash(relative(root, path)));
      else throw new Error('contributor-stage-not-regular');
    }
  }
  walk(root);
  if (JSON.stringify(names.sort()) !== JSON.stringify([...CONTRIBUTOR_FILES, 'manifest.json'].sort())) throw new Error('contributor-unmanifested-or-missing-file');
  const files = new Map(CONTRIBUTOR_FILES.map((name) => [name, regularFile(root, name)]));
  if (!manifestBytes.equals(Buffer.from(json(makeManifest(files))))) throw new Error('contributor-manifest-or-integrity-mismatch');
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--output') throw new Error('contributor-usage');
    const { manifest } = stageContributor({ output: args[1] });
    console.log(`CONTRIBUTOR LOCAL: ${manifest.files.length} exact-byte files; deterministic SHA256 manifest. Publication/privacy/rights approval: false.`);
  } catch {
    // Do not echo filesystem errors, untrusted paths or selected content.
    console.error('stage-contributor: rejected local selection/output. Use --output tmp/<new-stage>; no overwrite, links or escapes.');
    process.exitCode = 1;
  }
}

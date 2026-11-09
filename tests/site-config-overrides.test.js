import assert from 'node:assert/strict';
import { toSiteConfigOverrides } from '../src/libraries/minijoomla/application/site-config-overrides.js';
import { templateParamDefinitions } from '../src/libraries/minijoomla/application/template-styles.js';

export async function runSiteConfigOverridesTests() {
  // Test with null/empty record
  assert.deepEqual(toSiteConfigOverrides(null), {});
  assert.deepEqual(toSiteConfigOverrides(undefined), {});
  const empty = toSiteConfigOverrides({});
  assert.equal(empty.siteName, undefined);
  assert.equal(empty.templateKey, undefined);
  assert.ok('templateParams' in empty);
  assert.ok('templateStyleId' in empty);
  assert.ok('componentParams' in empty);
  assert.equal(empty.templateStyleId, 'default-default');
  assert.ok(Object.hasOwn(empty, 'componentParamsJson'));
  assert.equal(empty.componentParamsJson, undefined);
  const storedParams = ' { "content": { "listLimit": 10 }, "future": { "keep": true } } ';
  assert.equal(toSiteConfigOverrides({ componentParamsJson: storedParams }).componentParamsJson, storedParams,
    'Preserve exact provenance without canonicalizing whitespace or unknown saved configuration');
  assert.equal(empty.componentParams.content.listLimit, 10, 'display defaults remain declared');
  assert.deepEqual(empty.queryParams, { content: { orderBy: 'publishUp-desc' }, search: { searchPhrases: 'all' } }, 'missing persisted limits must not become saved 10');
  const queryJson = '{"content":{"listLimit":10,"orderBy":"title-asc","showTitle":false,"unknown":true},"search":{"resultsLimit":2,"searchPhrases":"any","highlightTerms":false},"custom":{"secret":"not-a-query"}}';
  const queryOverrides = toSiteConfigOverrides({ componentParamsJson: queryJson });
  assert.equal(queryOverrides.componentParamsJson, queryJson, 'raw provenance stays exact and is not rewritten');
  assert.deepEqual(queryOverrides.queryParams, { content: { listLimit: 10, orderBy: 'title-asc' }, search: { resultsLimit: 2, searchPhrases: 'any' } });
  assert.ok(Object.isFrozen(queryOverrides.queryParams.content));
  for (const componentParamsJson of [undefined, '', '{bad', '[]', '{"content":{"listLimit":true,"orderBy":["title-asc"]},"search":{"resultsLimit":[2],"searchPhrases":"bad"}}']) {
    assert.deepEqual(toSiteConfigOverrides({ componentParamsJson }).queryParams, empty.queryParams, 'invalid queries resolve safe filtered defaults without affecting provenance');
  }

  // Test with minimal record
  const minimal = { siteName: 'Test Site' };
  const overridesMinimal = toSiteConfigOverrides(minimal);
  assert.equal(overridesMinimal.siteName, 'Test Site');
  assert.ok('templateParams' in overridesMinimal);
  assert.ok('templateStyleId' in overridesMinimal);
  assert.ok('componentParams' in overridesMinimal);

  // Test with customHtml — only includes when customHtmlBody is present
  const withoutBody = { customHtmlTitle: 'Title', customHtmlBody: '' };
  assert.deepEqual(toSiteConfigOverrides(withoutBody).customHtml, undefined);
  
  const withBody = { customHtmlTitle: 'Title', customHtmlBody: '<p>HTML</p>' };
  assert.deepEqual(toSiteConfigOverrides(withBody).customHtml, { title: 'Title', html: '<p>HTML</p>' });
  
  const withBodyNoTitle = { customHtmlBody: '<p>HTML</p>' };
  assert.deepEqual(toSiteConfigOverrides(withBodyNoTitle).customHtml, { title: undefined, html: '<p>HTML</p>' });

  // Test with templateStylesJson containing Cassiopeia style
  const cassiopeiaConfig = {
    templateKey: 'cassiopeia',
    templateStylesJson: JSON.stringify([
      {
        id: 'cass-1',
        template: 'cassiopeia',
        title: 'Custom Cassiopeia',
        home: true,
        params: {
          logoFile: '/images/logo.png',
          brand: 'logo',
          siteTitle: 'Custom Title',
          colorName: 'alternative',
          fluidContainer: true
        }
      }
    ])
  };
  const cassiopeiaOverrides = toSiteConfigOverrides(cassiopeiaConfig);
  assert.equal(cassiopeiaOverrides.templateKey, 'cassiopeia');
  assert.equal(cassiopeiaOverrides.templateStyleId, 'cass-1');
  assert.ok(cassiopeiaOverrides.templateParams.logoFile);
  assert.equal(cassiopeiaOverrides.templateParams.brand, 'logo');
  assert.equal(cassiopeiaOverrides.templateParams.colorName, 'alternative');
  assert.equal(cassiopeiaOverrides.templateParams.fluidContainer, true);

  // Test with templateStylesJson containing CAMAP style
  const camapConfig = {
    templateKey: 'camap',
    templateStylesJson: JSON.stringify([
      {
        id: 'camap-1',
        template: 'camap',
        title: 'Custom CAMAP',
        home: true,
        params: {
          brand: true,
          siteTitle: 'Portal CAMAP',
          accentColor: 'green',
          heroTitle: 'Bem-vindo',
          heroActionLabel: 'Saiba mais',
          heroActionUrl: 'https://example.com',
          pairSections: true,
          backTop: true
        }
      }
    ])
  };
  const camapOverrides = toSiteConfigOverrides(camapConfig);
  assert.equal(camapOverrides.templateKey, 'camap');
  assert.equal(camapOverrides.templateStyleId, 'camap-1');
  assert.equal(camapOverrides.templateParams.siteTitle, 'Portal CAMAP');
  // accentColor is stored as the select value, not yet translated to hex (that happens in resolveCamapParams at render time)
  assert.equal(camapOverrides.templateParams.accentColor, 'green');
  assert.equal(camapOverrides.templateParams.heroTitle, 'Bem-vindo');
  assert.equal(camapOverrides.templateParams.heroActionLabel, 'Saiba mais');
  assert.equal(camapOverrides.templateParams.pairSections, true);
  assert.equal(camapOverrides.templateParams.backTop, true);

  // Test that offline/metaDescription/etc. only appear when present and not empty
  const partial = {
    offline: false,
    offlineMessage: '',
    metaDescription: 'Meta desc',
    metaKeywords: '',
    robots: 'index, follow'
  };
  const partialOverrides = toSiteConfigOverrides(partial);
  assert.equal(partialOverrides.offline, false);
  assert.equal(partialOverrides.metaDescription, 'Meta desc');
  assert.equal(partialOverrides.robots, 'index, follow');
  // Empty or null fields should not appear
  assert.equal(partialOverrides.offlineMessage, undefined);
  assert.equal(partialOverrides.metaKeywords, undefined);

  // Migration: a record created before homeView/homeCategory existed (schemaVersion 1)
  // never has those fields — toSiteConfigOverrides must omit them (not pass `undefined`
  // through as an explicit override that would shadow createConfig's own default),
  // so a pre-existing site keeps rendering `category`/`noticias` exactly as before the
  // schemaVersion 2 migration, with zero required backfill.
  const legacyRecord = { id: 1, title: 'MiniJoomlaSiteConfig', siteName: 'Site antigo' };
  const legacyOverrides = toSiteConfigOverrides(legacyRecord);
  assert.equal('homeView' in legacyOverrides, false, 'homeView ausente no registro legado não deve aparecer como override');
  assert.equal('homeCategory' in legacyOverrides, false, 'homeCategory ausente no registro legado não deve aparecer como override');
  const { createConfig } = await import('../src/libraries/minijoomla/core/config.js');
  const migratedConfig = createConfig(legacyOverrides);
  assert.equal(migratedConfig.homeView, 'category', 'config aplica o default category quando o registro legado não declara homeView');
  assert.equal(migratedConfig.homeCategory, 'noticias', 'config aplica o default noticias quando o registro legado não declara homeCategory');

  // A record that DOES declare homeView/homeCategory (schemaVersion 2) propagates them unchanged.
  const migratedRecord = { ...legacyRecord, homeView: 'featured', homeCategory: 'eventos' };
  const migratedOverrides = toSiteConfigOverrides(migratedRecord);
  assert.equal(createConfig(migratedOverrides).homeView, 'featured');
  assert.equal(createConfig(migratedOverrides).homeCategory, 'eventos');

  console.log('ok - toSiteConfigOverrides omite homeView/homeCategory ausentes de um registro legado (schemaVersion 1), preservando os defaults category/noticias sem exigir backfill');
  console.log('site-config-overrides: toSiteConfigOverrides correctly computes templateParams, templateStyleId, componentParams and handles customHtml/metadata');
}

import assert from 'node:assert/strict';
import { resolveInstallationContext } from '../host-adapters/modern-script-editor/installation-context.js';

export function runInstallationContextTests() {
  const options={pageContext:{webServerRelativeUrl:'/sites/example'},locationRef:{origin:'https://tenant.example'},releaseUrl:'https://tenant.example/sites/example/SiteAssets/minijoomla/releases/1.0.0/'};
  assert.deepEqual(resolveInstallationContext(options),{webUrl:'/sites/example',libraryPath:'/sites/example/SiteAssets/minijoomla'});
  assert.deepEqual(resolveInstallationContext({...options,pageContext:{webServerRelativeUrl:'/'},releaseUrl:'https://tenant.example/SiteAssets/minijoomla/releases/1.0.0/'}),{webUrl:'/',libraryPath:'/SiteAssets/minijoomla'});
  for(const webServerRelativeUrl of ['//external','/../x','/site?x','/site x'])assert.throws(()=>resolveInstallationContext({...options,pageContext:{webServerRelativeUrl}}));
  assert.throws(()=>resolveInstallationContext({...options,releaseUrl:'https://another.example/sites/example/SiteAssets/a'}));
  assert.throws(()=>resolveInstallationContext({...options,configured:{libraryPath:'/sites/other/SiteAssets/minijoomla'}}));
  assert.throws(()=>resolveInstallationContext({...options,releaseUrl:'https://tenant.example/sites/example/SiteAssets/custom/releases/1.0.0/'}));
  // Modern SharePoint pages never populate window._spPageContextInfo (classic-only
  // global); without it, the same-origin release path itself is the fallback signal.
  const noPageContext={locationRef:{origin:'https://tenant.example'},releaseUrl:'https://tenant.example/sites/example/SiteAssets/minijoomla/releases/1.0.0/'};
  assert.deepEqual(resolveInstallationContext(noPageContext),{webUrl:'/sites/example',libraryPath:'/sites/example/SiteAssets/minijoomla'});
  assert.deepEqual(resolveInstallationContext({...noPageContext,releaseUrl:'https://tenant.example/SiteAssets/minijoomla/releases/1.0.0/'}),{webUrl:'/',libraryPath:'/SiteAssets/minijoomla'});
  assert.deepEqual(resolveInstallationContext({...noPageContext,releaseUrl:'https://tenant.example/teams/Comunidades-de-interesse-192/SiteAssets/minijoomla/releases/0.17.1/'}),{webUrl:'/teams/Comunidades-de-interesse-192',libraryPath:'/teams/Comunidades-de-interesse-192/SiteAssets/minijoomla'});
  // Explicit configured.webUrl/pageContext still take precedence over the release path.
  assert.deepEqual(resolveInstallationContext({...noPageContext,configured:{webUrl:'/sites/other'},releaseUrl:'https://tenant.example/sites/other/SiteAssets/minijoomla/releases/1.0.0/'}),{webUrl:'/sites/other',libraryPath:'/sites/other/SiteAssets/minijoomla'});
  // No '/SiteAssets/' marker anywhere in the release path: no fallback, context is absent.
  assert.throws(()=>resolveInstallationContext({...noPageContext,releaseUrl:'https://tenant.example/sites/example/other/minijoomla/releases/1.0.0/'}));
  console.log('ok - installation context: same-site generic bootstrap without list IDs; derives webUrl from the release path when window._spPageContextInfo is absent (modern pages); root web, custom webUrl precedence and unsafe context rejects');
}

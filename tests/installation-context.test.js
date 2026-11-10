import assert from 'node:assert/strict';
import { resolveInstallationContext } from '../host-adapters/modern-script-editor/installation-context.js';

export function runInstallationContextTests() {
  const options={pageContext:{webServerRelativeUrl:'/sites/example'},locationRef:{origin:'https://tenant.example'},releaseUrl:'https://tenant.example/sites/example/SiteAssets/minijoomla/releases/1.0.0/'};
  assert.deepEqual(resolveInstallationContext(options),{webUrl:'/sites/example',libraryPath:'/sites/example/SiteAssets/minijoomla'});
  assert.deepEqual(resolveInstallationContext({...options,pageContext:{webServerRelativeUrl:'/'},releaseUrl:'https://tenant.example/SiteAssets/minijoomla/releases/1.0.0/'}),{webUrl:'/',libraryPath:'/SiteAssets/minijoomla'});
  for(const webServerRelativeUrl of [undefined,'//external','/../x','/site?x','/site x'])assert.throws(()=>resolveInstallationContext({...options,pageContext:{webServerRelativeUrl}}));
  assert.throws(()=>resolveInstallationContext({...options,releaseUrl:'https://another.example/sites/example/SiteAssets/a'}));
  assert.throws(()=>resolveInstallationContext({...options,configured:{libraryPath:'/sites/other/SiteAssets/minijoomla'}}));
  assert.throws(()=>resolveInstallationContext({...options,releaseUrl:'https://tenant.example/sites/example/SiteAssets/custom/releases/1.0.0/'}));
  console.log('ok - installation context: same-site generic bootstrap without list IDs; root web and unsafe context rejects');
}

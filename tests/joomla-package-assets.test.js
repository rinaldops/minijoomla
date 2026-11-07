import assert from 'node:assert/strict';
import { assertJoomlaPackageAssets } from '../src/libraries/minijoomla/application/joomla-package-assets.js';

export function runJoomlaPackageAssetsTests() {
  const key = 'example.module';
  const descriptors = [
    { key, entryPointUrl: '/sites/example/packages/v1/module.js', styles: ['/sites/example/packages/v1/style.css'] },
    { key, entryPointUrl: '/sites/example/packages/v2/module.js', styles: ['/sites/example/packages/v2/style.css'] }
  ];
  const config = { moduleStyles: { [key]: descriptors[1].styles }, moduleStyleRevisions: { [key]: Object.fromEntries(descriptors.map(d => [d.entryPointUrl, d.styles])) } };
  assert.equal(assertJoomlaPackageAssets(config, descriptors), true);
  assert.throws(() => assertJoomlaPackageAssets({ moduleStyles: config.moduleStyles }, descriptors), /vínculo/);
  const wrong = structuredClone(config); wrong.moduleStyleRevisions[key][descriptors[0].entryPointUrl] = descriptors[1].styles;
  assert.throws(() => assertJoomlaPackageAssets(wrong, descriptors), /difere/);
  const duplicate = structuredClone(config); duplicate.moduleStyleRevisions[key][descriptors[0].entryPointUrl].push(descriptors[0].styles[0]);
  assert.throws(() => assertJoomlaPackageAssets(duplicate, descriptors));
  assert.throws(() => assertJoomlaPackageAssets(config, []), /ausentes/);
  const ordered = { ...descriptors[0], styles: ['/sites/example/packages/v1/base.css', '/sites/example/packages/v1/override.css'] };
  const cascade = { moduleStyleRevisions: { [key]: { [ordered.entryPointUrl]: [...ordered.styles] } } };
  assert.equal(assertJoomlaPackageAssets(cascade, [ordered]), true);
  cascade.moduleStyleRevisions[key][ordered.entryPointUrl].reverse();
  assert.throws(() => assertJoomlaPackageAssets(cascade, [ordered]), /difere/);
  console.log('ok - verified XML package assets require exact per-entrypoint CSS bindings, never latest-version fallback');
}

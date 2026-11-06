import assert from 'node:assert/strict';
import { MENU_TYPES, buildMenuPath, parseMenuPath } from '../src/administrator/components/com_minijoomla/menu-types.js';
import * as model from '../src/administrator/components/com_menus/src/Model/menu-item.js';
import { ValidationError } from '../src/libraries/minijoomla/core/contracts.js';

export function runAdminMenuModelTests() {
  assert.equal(MENU_TYPES, model.MENU_TYPES);
  assert.equal(buildMenuPath, model.buildMenuPath);
  assert.equal(parseMenuPath, model.parseMenuPath);
  assert.equal(model.toMenuFormValues().menuType, 'category-blog');
  assert.equal(model.toMenuFormValues().targetCategory, 'noticias');
  for (const path of ['/', '/tags', '/search', '/archive', '/category/a', '/category/a?layout=list', '/article/a%20b', '/tag/c%20d', 'https://example.org/x']) {
    const record = Object.freeze(Object.defineProperty({ id: 7, title: 'Menu', path }, 'etag', { value: '"captured"' }));
    const values = model.toMenuFormValues(record);
    assert.equal(model.prepareMenuFormValues(values, record).path, path);
    assert.equal(record.etag, '"captured"');
    assert.equal('etag' in values, false);
  }
  for (const path of ['/old/path?a=b#item', '/article/%broken', '/category/a?legacy=1']) {
    const record = Object.freeze({ path });
    const values = Object.freeze({ ...model.toMenuFormValues(record), title: 'Renomeado', path: '/tampered' });
    const input = model.prepareMenuFormValues(values, record);
    assert.equal(input.path, path, 'custom path is the captured record, not an editable forged path');
    assert.equal(input.title, 'Renomeado');
    for (const name of ['menuType', 'targetCategory', 'targetArticle', 'targetTag', 'targetUrl']) assert.equal(name in input, false);
    assert.equal(model.menuTypeOptions(values).at(-1).value, 'custom');
  }
  assert.ok(!model.menuTypeOptions(model.toMenuFormValues({ path: '/' })).some(({ value }) => value === 'custom'));
  assert.deepEqual(model.prepareMenuFormValues({ title: 'X', menuType: 'category-list', targetCategory: 'a b' }), { title: 'X', path: '/category/a%20b?layout=list' });
  for (const values of [{ menuType: 'custom' }, { menuType: 'article' }, { menuType: 'unknown' }, { menuType: 'url', targetUrl: 'javascript:alert(1)' }]) assert.throws(() => model.prepareMenuFormValues(values), ValidationError);
  console.log('ok - com_menus model: canonical/legacy identity, typed roundtrips and exact custom-path preservation');
}

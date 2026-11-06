import assert from 'node:assert/strict';
import { planLegacyModuleAssignment } from '../src/libraries/minijoomla/application/legacy-module-assignment.js';
import { ASSIGNMENT_ROUTES } from '../src/libraries/minijoomla/application/module-assignment.js';
import { resolveModuleEntries } from '../src/libraries/minijoomla/modules/dynamic-modules.js';

const NOW = new Date('2026-11-04T12:00:00Z');

function assertRefusal(record, reason) {
  const plan = planLegacyModuleAssignment(record);
  assert.deepEqual(plan, { convertible: false, reason });
  assert.ok(Object.isFrozen(plan));
  assert.equal(Object.hasOwn(plan, 'assignment'), false);
  assert.equal(Object.hasOwn(plan, 'assignmentTokens'), false);
  return plan;
}

function assertExact(record, assignment, assignmentTokens) {
  const plan = planLegacyModuleAssignment(record);
  assert.deepEqual(plan, { convertible: true, reason: 'exact', assignment, assignmentTokens });
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.assignmentTokens));
  assert.throws(() => { plan.assignment = 'none'; }, TypeError);
  assert.throws(() => { plan.assignmentTokens.push('route:search'); }, TypeError);
  return plan;
}

function runtimeEntries(record, context) {
  return resolveModuleEntries([record], context, NOW);
}

export function runLegacyModuleAssignmentTests() {
  // Ausente/null/vazio segue All no legado; valores significativos não são
  // aparados, convertidos para string ou aceitos por truthiness.
  assertExact(undefined, 'all', []);
  assertExact(null, 'all', []);
  const allRecords = [
    {}, { scopeKind: undefined }, { scopeKind: null }, { scopeKind: '' }, { scopeKind: 'All' },
    { scopeKind: 'All', scopeRoute: '', scopeCategoryAlias: '' },
    { scopeKind: null, scopeRoute: null, scopeCategoryAlias: undefined }
  ];
  for (const record of allRecords) assertExact(record, 'all', []);

  assert.deepEqual(ASSIGNMENT_ROUTES, ['home', 'category', 'article', 'search', 'archive']);
  const routeRecords = [];
  for (const route of ASSIGNMENT_ROUTES) {
    for (const alias of [undefined, null, '']) {
      const record = { scopeKind: 'Route', scopeRoute: route, scopeCategoryAlias: alias };
      assertExact(record, 'only', [`route:${route}`]);
      routeRecords.push(record);
    }
  }

  for (const scopeKind of ['all', 'route', ' Route', 'Route ', 'All\n', 'Unknown', ' ', false, 0, [], {}, Symbol('kind')]) {
    assertRefusal({ scopeKind, scopeRoute: 'home' }, 'unsupported-kind');
  }
  for (const scopeRoute of [undefined, null, '', 'unknown', 'Home', 'CATEGORY', ' home', 'home ', 'home\n', false, 0, [], {}, Symbol('route')]) {
    assertRefusal({ scopeKind: 'Route', scopeRoute }, 'unsupported-route');
  }

  // All aceita somente campos vazios; nem dados obsoletos válidos são
  // removidos silenciosamente. Isso vale também para kind implícito.
  for (const scopeKind of [undefined, null, '', 'All']) {
    for (const scopeRoute of ['home', 'unknown', ' ', false, 0, []]) {
      assertRefusal({ scopeKind, scopeRoute }, 'unsupported-route');
    }
    for (const scopeCategoryAlias of ['a', ' ', false, 0, []]) {
      assertRefusal({ scopeKind, scopeCategoryAlias }, 'unsupported-category');
    }
    assertRefusal({ scopeKind, scopeRoute: 'home', scopeCategoryAlias: 'a' }, 'unsupported-category');
  }

  for (const route of ASSIGNMENT_ROUTES.filter((route) => route !== 'category')) {
    for (const scopeCategoryAlias of ['a', 'invalid alias', false, 0, {}]) {
      assertRefusal({ scopeKind: 'Route', scopeRoute: route, scopeCategoryAlias }, 'unsupported-category');
    }
  }
  for (const scopeCategoryAlias of ['a', 'b', 'news_2026-11', '0', `a${'b'.repeat(99)}`]) {
    assertRefusal({ scopeKind: 'Route', scopeRoute: 'category', scopeCategoryAlias }, 'category-intersection');
  }
  for (const scopeCategoryAlias of ['A', ' a', 'a ', 'a\n', 'a\r\n', 'a/b', 'a.b', '-a', '_a', 'a'.repeat(101), ' ', false, 0, 1, [], {}, Symbol('alias')]) {
    assertRefusal({ scopeKind: 'Route', scopeRoute: 'category', scopeCategoryAlias }, 'unsupported-category');
  }
  assertRefusal({ scopeKind: 'Route', scopeCategoryAlias: 'a' }, 'unsupported-route');
  assertRefusal({ scopeKind: 'Route', scopeRoute: 'unknown', scopeCategoryAlias: 'a' }, 'unsupported-route');

  // assignment truthy prevalece até sobre legado inválido; valores futuros
  // não podem ser reinterpretados por este helper.
  for (const assignment of ['all', 'none', 'only', 'except', 'future-mode', ' ', true, 1, [], {}, Symbol('assignment')]) {
    const record = Object.freeze({ assignment, scopeKind: 'Unknown', assignmentJson: '{unknown-json' });
    const before = Object.getOwnPropertyDescriptors(record);
    assertRefusal(record, 'already-assigned');
    assert.deepEqual(Object.getOwnPropertyDescriptors(record), before);
  }
  for (const assignment of [undefined, null, '', false, 0, NaN]) {
    assertExact({ assignment, scopeKind: 'Route', scopeRoute: 'home' }, 'only', ['route:home']);
  }

  // Nunca consultar getters herdados, nem assignmentJson próprio/herdado.
  const inherited = Object.create(null);
  for (const field of ['assignment', 'scopeKind', 'scopeRoute', 'scopeCategoryAlias', 'assignmentJson']) {
    Object.defineProperty(inherited, field, { get() { throw new Error(`leitura herdada: ${field}`); } });
  }
  assertExact(Object.create(inherited), 'all', []);
  const ownRoute = Object.create(inherited);
  Object.defineProperties(ownRoute, { scopeKind: { value: 'Route' }, scopeRoute: { value: 'home' } });
  assertExact(ownRoute, 'only', ['route:home']);
  const inheritedRoute = Object.create({ scopeRoute: 'home', scopeCategoryAlias: 'a' });
  inheritedRoute.scopeKind = 'Route';
  assertRefusal(inheritedRoute, 'unsupported-route');
  const assignedWithoutScopeRead = { assignment: 'unknown' };
  Object.defineProperty(assignedWithoutScopeRead, 'scopeKind', { get() { throw new Error('assignment deve encerrar o plano'); } });
  assertRefusal(assignedWithoutScopeRead, 'already-assigned');

  const unreadJson = { scopeKind: 'Route', scopeRoute: 'home' };
  Object.defineProperty(unreadJson, 'assignmentJson', { get() { throw new Error('assignmentJson não deve ser lido'); } });
  Object.freeze(unreadJson);
  const unreadBefore = Object.getOwnPropertyDescriptors(unreadJson);
  assertExact(unreadJson, 'only', ['route:home']);
  assert.deepEqual(Object.getOwnPropertyDescriptors(unreadJson), unreadBefore);
  for (const assignmentJson of ['{unknown-json', '{"future":true}', '["category:a"]', null, false, { unknown: true }]) {
    const record = { scopeKind: 'Route', scopeRoute: 'home', assignmentJson };
    const before = Object.getOwnPropertyDescriptors(record);
    assertExact(record, 'only', ['route:home']);
    assert.deepEqual(Object.getOwnPropertyDescriptors(record), before);
  }
  const frozenRecord = Object.freeze({ scopeKind: 'Route', scopeRoute: 'archive', metadata: Object.freeze({ untouched: true }) });
  const frozenBefore = Object.getOwnPropertyDescriptors(frozenRecord);
  assertExact(frozenRecord, 'only', ['route:archive']);
  assert.deepEqual(Object.getOwnPropertyDescriptors(frozenRecord), frozenBefore);
  const mutableRecord = { scopeKind: 'All', metadata: { untouched: true } };
  const mutableBefore = Object.getOwnPropertyDescriptors(mutableRecord);
  assertExact(mutableRecord, 'all', []);
  assert.deepEqual(Object.getOwnPropertyDescriptors(mutableRecord), mutableBefore);
  assert.equal(Object.isFrozen(mutableRecord), false, 'helper não congela o record recebido');
  assert.equal(Object.isFrozen(mutableRecord.metadata), false);

  // Prova pelo resolver PÚBLICO real, não por uma cópia local de matchesScope
  // ou tokensFor. Serialização abaixo é só uma nova fixture de atribuição,
  // não aplicação/mutação de dados persistidos pelo helper.
  const contexts = [{}, { route: 'unknown', categoryAlias: 'a', menuItemId: 7 }];
  for (const route of ASSIGNMENT_ROUTES) {
    for (const categoryAlias of [undefined, 'a', 'b']) {
      for (const menuItemId of [undefined, 1, 999999999]) contexts.push({ route, categoryAlias, menuItemId });
    }
  }
  let comparisons = 0;
  for (const record of [...allRecords, ...routeRecords]) {
    const legacy = Object.freeze({ extensionKey: 'fixture-module', position: 'sidebar', enabled: true, assignmentJson: '{ignored-legacy-json', ...record });
    const before = Object.getOwnPropertyDescriptors(legacy);
    const plan = planLegacyModuleAssignment(legacy);
    assert.equal(plan.convertible, true);
    const converted = Object.freeze({ ...legacy, assignment: plan.assignment, assignmentJson: JSON.stringify(plan.assignmentTokens) });
    for (const context of contexts) {
      assert.deepEqual(runtimeEntries(converted, context), runtimeEntries(legacy, context), `visibilidade exata: ${JSON.stringify(record)} / ${JSON.stringify(context)}`);
      comparisons += 1;
    }
    assert.deepEqual(Object.getOwnPropertyDescriptors(legacy), before);
  }

  // Contraprova: category:a sozinho amplia para article:a; route:category
  // OR category:a amplia também para category:b. O plano deve recusar ambos.
  const intersection = Object.freeze({ extensionKey: 'intersection', position: 'sidebar', scopeKind: 'Route', scopeRoute: 'category', scopeCategoryAlias: 'a' });
  assertRefusal(intersection, 'category-intersection');
  const categoryToken = { ...intersection, assignment: 'only', assignmentTokens: ['category:a'] };
  const routeOrCategory = { ...intersection, assignment: 'only', assignmentTokens: ['route:category', 'category:a'] };
  const articleA = { route: 'article', categoryAlias: 'a', menuItemId: 1 };
  const categoryA = { route: 'category', categoryAlias: 'a', menuItemId: 1 };
  const categoryB = { route: 'category', categoryAlias: 'b', menuItemId: 2 };
  assert.equal(runtimeEntries(intersection, categoryA).sidebar.length, 1);
  assert.equal(runtimeEntries(intersection, articleA).sidebar.length, 0);
  assert.equal(runtimeEntries(categoryToken, articleA).sidebar.length, 1);
  assert.equal(runtimeEntries(intersection, categoryB).sidebar.length, 0);
  assert.equal(runtimeEntries(routeOrCategory, categoryB).sidebar.length, 1);
  assert.equal(runtimeEntries(routeOrCategory, articleA).sidebar.length, 1);

  console.log(`ok - legacy module assignment: planos exatos imutáveis, recusas conservadoras, own properties/JSON preservados e ${comparisons} comparações pelo resolver público`);
}

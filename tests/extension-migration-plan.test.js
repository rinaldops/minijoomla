import assert from 'node:assert/strict';
import * as migration from '../src/libraries/minijoomla/application/extension-migration-plan.js';
import { parseJoomlaManifest } from '../src/libraries/minijoomla/application/joomla-manifest.js';

const { planExtensionMigration } = migration;
const target = { baseUrl: '/sites/example/SiteAssets/packages/2.0.0', manifestPath: 'modules/mod_example/mod_example.xml' };
const xml = (fields = '<field name="message" type="text" default="new" />') => `<extension type="module" client="site" xmlns:mj="urn:minijoomla:runtime:1" mj:key="example.module"><name>Example</name><version>2.0.0</version><files><filename module="mod_example">mod_example.js</filename></files><config><fields name="params">${fields}</fields></config></extension>`;
const input = (overrides = {}) => ({
  extension: { id: 1, etag: '"old-extension"', key: 'example.module', type: 'Module', enabled: false,
    entryPointUrl: '/sites/example/SiteAssets/legacy.js', manifestJson: '{ "version": "1.0.0", "params": [{"name":"message","type":"text","default":"old"}], "privateMetadata": {"retained":true} }' },
  instances: [{ id: 10, etag: '"old-instance"', extensionKey: 'example.module', enabled: false, trashed: true,
    settingsJson: '{ "message": "saved", "moduleClass": "custom", "headerTag": "h3", "headerClass": "heading", "unknown": {"nested":[1,true]} }', title: 'Private instance', position: 'main-top' }],
  completeInstances: true, targetXml: xml(), target: { ...target }, ...overrides
});

function refused(value, pattern) {
  const plan = planExtensionMigration(value);
  assert.equal(plan.ready, false);
  assert.equal(plan.convertible, false);
  assert.equal(plan.executionAvailable, false);
  assert.equal(plan.packageVerified, false);
  assert.match(plan.reason, pattern);
  assert.ok(Object.isFrozen(plan));
  return plan;
}

function frozen(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}

function assertDeepFrozen(value) {
  if (value && typeof value === 'object') {
    assert.ok(Object.isFrozen(value), 'all output objects, including already shallow-frozen descriptors, are frozen');
    Object.values(value).forEach(assertDeepFrozen);
  }
}

export async function runExtensionMigrationPlanTests() {
  assert.deepEqual(Object.keys(migration), ['planExtensionMigration'], 'no executor or rollback exports');
  const original = input(), copy = structuredClone(original);
  frozen(original);
  const plan = planExtensionMigration(original);
  assert.equal(plan.ready, true);
  assert.equal(plan.convertible, true);
  assert.equal(plan.reason, null);
  assert.equal(plan.sourceKind, 'legacy-json');
  assert.equal(plan.executionAvailable, false);
  assert.equal(plan.packageVerified, false);
  assert.equal(plan.target.packageVerified, false);
  assert.equal(plan.remoteCompletenessProven, false);
  assert.equal(plan.snapshotsAuthenticityProven, false);
  assert.equal(plan.completenessDeclared, true);
  assert.equal(plan.requiresExplicitReview, true);
  assert.equal(plan.containsPrivateSnapshots, true);
  assert.equal(plan.changes.extension.previousXmlRevisionAvailable, false);
  assert.deepEqual(plan.instanceCounts, { total: 1, disabled: 1, trashed: 1 });
  assert.deepEqual(original, copy, 'input deeply frozen and unmodified');
  assert.deepEqual(plan.snapshots, { extension: copy.extension, instances: copy.instances });
  assert.notEqual(plan.snapshots.extension, original.extension);
  assert.equal(plan.snapshots.extension.manifestJson, original.extension.manifestJson);
  assert.equal(plan.snapshots.instances[0].settingsJson, original.instances[0].settingsJson);
  assert.equal(plan.snapshots.instances[0].etag, '"old-instance"');
  assert.equal(plan.changes.extension.etag, '"old-extension"');
  assert.equal(plan.changes.instances[0].after.message, 'saved');
  assert.equal(plan.changes.instances[0].after.moduleClass, 'custom');
  assert.equal(plan.changes.instances[0].after.headerTag, 'h3');
  assert.equal(plan.changes.instances[0].after.headerClass, 'heading');
  assert.deepEqual(plan.changes.instances[0].after.unknown, { nested: [1, true] });
  assert.deepEqual(plan.changes.extension.metadataBefore.privateMetadata, { retained: true });
  assert.ok(plan.changes.extension.schema.some((change) => change.kind === 'default'));
  assert.ok(Object.isFrozen(plan.changes.instances[0].after.unknown.nested));
  assertDeepFrozen(plan);
  assert.throws(() => { plan.changes.instances[0].after.message = 'tampered'; }, TypeError);

  const realRows = input();
  Object.defineProperty(realRows.extension, 'etag', { value: '"sp-extension"', enumerable: false });
  Object.defineProperty(realRows.instances[0], 'etag', { value: '"sp-instance"', enumerable: false });
  const exactManifest = realRows.extension.manifestJson, exactSettings = realRows.instances[0].settingsJson;
  frozen(realRows);
  const realRowPlan = planExtensionMigration(realRows);
  assert.equal(realRowPlan.ready, true, 'SPMIDDLE own non-enumerable ETags are valid data');
  assert.equal(realRowPlan.snapshots.extension.etag, '"sp-extension"');
  assert.equal(realRowPlan.snapshots.instances[0].etag, '"sp-instance"');
  assert.equal(realRowPlan.changes.extension.etag, '"sp-extension"');
  assert.equal(realRowPlan.changes.instances[0].etag, '"sp-instance"');
  assert.equal(realRowPlan.snapshots.extension.manifestJson, exactManifest);
  assert.equal(realRowPlan.snapshots.instances[0].settingsJson, exactSettings);
  assert.equal(Object.getOwnPropertyDescriptor(realRows.extension, 'etag').enumerable, false, 'capture does not mutate descriptors');
  assert.equal(Object.getOwnPropertyDescriptor(realRows.instances[0], 'etag').enumerable, false);
  assert.equal(Object.getOwnPropertyDescriptor(realRowPlan.snapshots.extension, 'etag').enumerable, true, 'private snapshot can serialize the captured ETag');
  assertDeepFrozen(realRowPlan);

  const defaults = input(); defaults.instances[0].settingsJson = '{}';
  const defaultPlan = planExtensionMigration(defaults);
  assert.equal(defaultPlan.ready, true);
  assert.equal(defaultPlan.changes.instances[0].after.message, 'new');
  assert.ok(defaultPlan.changes.instances[0].changes.some((change) => change.kind === 'effective-default' && change.name === 'message' && change.before.value === 'old' && change.after.value === 'new'));
  assert.ok(defaultPlan.changes.instances[0].changes.some((change) => change.kind === 'default-added' && change.name === 'headerTag'));

  const renaming = input({ parameterMap: { message: 'body' }, targetXml: xml('<field name="body" type="text" default="new" /><field name="extra" type="text" default="added" /><field name="optional" type="text" />') });
  const renamed = planExtensionMigration(renaming);
  assert.equal(renamed.ready, true);
  assert.equal(renamed.changes.instances[0].after.body, 'saved');
  assert.equal(Object.hasOwn(renamed.changes.instances[0].after, 'message'), false);
  assert.equal(renamed.changes.instances[0].after.extra, 'added');
  assert.equal(Object.hasOwn(renamed.changes.instances[0].after, 'optional'), false);
  assert.ok(renamed.changes.instances[0].changes.some((change) => change.kind === 'rename'));
  assert.equal(renamed.changes.extension.schema.filter((change) => change.kind === 'added-declaration').length, 2);
  const removal = planExtensionMigration(input({ targetXml: xml('') }));
  assert.equal(removal.ready, true);
  assert.equal(removal.changes.instances[0].after.message, 'saved');
  assert.ok(removal.changes.instances[0].retainedUnknownNames.includes('message'));
  assert.ok(removal.changes.extension.schema.some((change) => change.kind === 'removed-declaration' && change.unknownValuesPreserved));
  const defaultRemoved = planExtensionMigration(input({ targetXml: xml('<field name="message" type="text" />'), instances: [{ ...input().instances[0], settingsJson: '{}' }] }));
  assert.equal(defaultRemoved.ready, true);
  assert.equal(Object.hasOwn(defaultRemoved.changes.instances[0].after, 'message'), false);
  assert.ok(defaultRemoved.changes.extension.schema.some((change) => change.kind === 'default' && !change.after.present));
  assert.ok(defaultRemoved.changes.instances[0].changes.some((change) => change.kind === 'effective-default' && change.name === 'message' && !change.after.present));

  const reserved = input(); reserved.instances[0].settingsJson = '{"message":"saved","__proto__":{"private":"keep"},"constructor":{"nested":{"__proto__":true}},"toJSON":"data"}';
  const kept = planExtensionMigration(reserved);
  assert.equal(kept.ready, true);
  assert.equal(Object.hasOwn(kept.changes.instances[0].after, '__proto__'), true);
  assert.deepEqual(kept.changes.instances[0].after.__proto__, { private: 'keep' });
  assert.equal(Object.getPrototypeOf(kept.changes.instances[0].after), Object.prototype);
  assert.equal(kept.changes.instances[0].after.constructor.nested.__proto__, true);
  assert.equal(kept.changes.instances[0].after.toJSON, 'data');
  assert.equal({}.private, undefined);
  reserved.extension.manifestJson = '{"__proto__":{"privateMetadata":true},"params":[]}';
  const privateMetadata = planExtensionMigration(reserved);
  assert.equal(privateMetadata.ready, true);
  assert.equal(Object.hasOwn(privateMetadata.changes.extension.metadataBefore, '__proto__'), true);
  assert.equal(privateMetadata.changes.extension.metadataBefore.__proto__.privateMetadata, true);

  const typed = input({ targetXml: xml('<field name="message" type="number" min="1" max="10" default="2" />') });
  typed.instances[0].settingsJson = '{"message":"3"}';
  const conversion = planExtensionMigration(typed);
  assert.equal(conversion.ready, true);
  assert.equal(conversion.containsConversions, true);
  assert.equal(conversion.requiresExplicitReview, true);
  assert.equal(conversion.changes.instances[0].after.message, 3);
  assert.deepEqual(conversion.changes.instances[0].targetConversions[0], { name: 'message', before: '3', after: 3 });
  assert.ok(conversion.changes.instances[0].changes.some((change) => change.kind === 'value' && change.before.value === '3' && change.after.value === 3));
  for (const value of ['saved', '11', ' 3 ', '', null, true, {}, []]) {
    const invalid = structuredClone(typed); invalid.instances[0].settingsJson = JSON.stringify({ message: value });
    const result = refused(invalid, /Valores incompatíveis/);
    assert.equal(result.changes.instances[0].after, null, 'incompatible values never become a partial approved replacement');
    assert.ok(result.changes.instances[0].errors.length);
    assert.equal(result.snapshots.instances[0].settingsJson, invalid.instances[0].settingsJson);
  }
  const historical = structuredClone(typed);
  historical.extension.manifestJson = JSON.stringify({ params: JSON.stringify([{ name: 'message', type: 'number', default: '2', min: 1 }]) });
  const historicalPlan = planExtensionMigration(historical);
  assert.equal(historicalPlan.ready, true, 'legacy params may be a JSON list string');
  assert.deepEqual(historicalPlan.changes.instances[0].historicalNormalizations[0], { name: 'message', before: '3', after: 3 });
  historical.instances[0].settingsJson = '{"message":"bad historical number"}';
  const historicalRefusal = refused(historical, /Valores incompatíveis/);
  assert.ok(historicalRefusal.changes.instances[0].errors.some((error) => error.stage === 'source'));
  const historicalMismatch = input(); historicalMismatch.extension.manifestJson = '{"params":[{"name":"message","type":"number"}]}';
  const historicalMismatchPlan = refused(historicalMismatch, /Valores incompatíveis/);
  assert.ok(historicalMismatchPlan.changes.instances[0].errors.some((error) => error.stage === 'source'));

  const complex = input({ targetXml: xml('<field name="message" type="text" /><field name="items" type="textarea" mj:type="json" mj:valueType="array" default="[]" /><field name="check" type="checkbox" default="1" />') });
  complex.instances[0].settingsJson = JSON.stringify({ message: 'saved', items: JSON.stringify([{ name: 'x' }]), check: '0' });
  const complexPlan = planExtensionMigration(complex);
  assert.equal(complexPlan.ready, true);
  assert.deepEqual(complexPlan.changes.instances[0].after.items, [{ name: 'x' }]);
  assert.equal(complexPlan.changes.instances[0].after.check, false);
  assert.equal(complexPlan.changes.instances[0].targetConversions.length, 2);
  assertDeepFrozen(complexPlan);
  complex.instances[0].settingsJson = '{"message":"saved","items":{}}';
  refused(complex, /Valores incompatíveis/);

  const noRows = planExtensionMigration(input({ instances: [] }));
  assert.equal(noRows.ready, true);
  assert.equal(noRows.remoteCompletenessProven, false, 'local empty list does not prove remote completeness');
  const many = input(); many.instances.push({ ...many.instances[0], id: 11, enabled: true, trashed: false, etag: '"other"' });
  assert.equal(planExtensionMigration(many).changes.instances.length, 2, 'disabled and trash never filtered out');
  many.instances[1].settingsJson = '{broken';
  const badSecond = refused(many, /objeto JSON válido/);
  assert.equal(badSecond.snapshots.instances.length, 2, 'failed JSON validation never drops a captured row');
  assert.equal(badSecond.snapshots.instances[1].settingsJson, '{broken');

  refused(undefined, /objeto próprio/);
  refused(JSON.stringify(input()), /objeto próprio/);
  refused({ ...input(), completeInstances: false }, /completeInstances/);
  const absent = input(); delete absent.completeInstances; refused(absent, /snapshot parcial/);
  refused(input({ instances: null }), /instances/);
  refused(input({ instances: [null] }), /registro/);
  const duplicate = input(); duplicate.instances.push({ ...duplicate.instances[0] }); refused(duplicate, /duplicados/);
  for (const etag of [undefined, '', '*', ' * ', 'W/"weak"', 'opaque', ' "spaced" ', '"one", "two"', '"a*" trailing']) {
    const e = input(); e.extension.etag = etag; refused(e, /ETag|objeto JSON válido/);
    const i = input(); i.instances[0].etag = etag; refused(i, /ETag|objeto JSON válido/);
  }
  for (const id of [0, -1, 1.5, '10']) { const bad = input(); bad.instances[0].id = id; refused(bad, /id deve/); }
  for (const field of ['id', 'etag', 'enabled', 'settingsJson', 'extensionKey']) { const bad = input(); delete bad.instances[0][field]; refused(bad, /snapshot parcial/); }
  for (const field of ['id', 'etag', 'enabled', 'key', 'type', 'entryPointUrl', 'manifestJson']) { const bad = input(); delete bad.extension[field]; refused(bad, /snapshot parcial/); }
  for (const value of ['', '{broken', '[]', '"{}"', 'false', 'null', ' ']) {
    const bad = input(); bad.instances[0].settingsJson = value; refused(bad, /objeto JSON válido/);
    bad.instances[0].settingsJson = '{}'; bad.extension.manifestJson = value; refused(bad, /objeto JSON válido/);
  }
  for (const field of [
    '<field name=" message" type="text" />',
    `<field name="message" type="text" label="${'a'.repeat(201)}" />`,
    `<field name="message" type="text" description="${'a'.repeat(501)}" />`
  ]) refused(input({ targetXml: xml(field) }), /correcao explicita/);
  // Strict migration metadata is opt-in; legacy discovery retains its existing
  // normalization/truncation rather than adopting stricter migration semantics.
  const legacyXml = xml(`<field name=" message" type="text" label="${'a'.repeat(201)}" description="${'b'.repeat(501)}" />`);
  const legacyParams = parseJoomlaManifest(legacyXml, target).params;
  assert.equal(legacyParams[0].name, 'message');
  assert.equal(legacyParams[0].label.length, 200);
  assert.equal(legacyParams[0].description.length, 500);
  assert.deepEqual(parseJoomlaManifest(legacyXml, { ...target, strictMetadata: false }).params, legacyParams);
  assert.throws(() => parseJoomlaManifest(legacyXml, { ...target, strictMetadata: true }), /correcao explicita/);
  const objectSnapshot = input(); objectSnapshot.instances[0].settingsJson = {}; refused(objectSnapshot, /string JSON persistida/);
  for (const status of ['unsupported', 'skipped', 'conflict', 'invalid']) { const bad = input(); bad.instances[0].status = status; refused(bad, /não suportada/); }
  const wrongKey = input(); wrongKey.instances[0].extensionKey = 'other'; refused(wrongKey, /extensionKey/);
  const wrongType = input(); wrongType.extension.type = 'Plugin'; refused(wrongType, /type Module/);
  const badInstanceType = input(); badInstanceType.instances[0].type = 'Plugin'; refused(badInstanceType, /type/);
  const wrongTargetKey = input({ targetXml: xml().replace('example.module', 'other') }); refused(wrongTargetKey, /identidade/);
  const wrongIdentity = input(); wrongIdentity.extension.manifestJson = '{"miniJoomla":{"identity":"module:site::mod_other"}}'; refused(wrongIdentity, /identidade/);
  const sameIdentity = input(); sameIdentity.extension.manifestJson = '{"miniJoomla":{"identity":"module:site::mod_example","profile":"joomla-xml-v1"},"params":[]}';
  assert.equal(planExtensionMigration(sameIdentity).sourceKind, 'joomla-xml');
  const nestedKey = input(); nestedKey.extension.manifestJson = '{"miniJoomla":{"key":"other"}}'; refused(nestedKey, /identidade/);
  const corruptRuntime = input(); corruptRuntime.extension.manifestJson = '{"miniJoomla":null}'; refused(corruptRuntime, /corrompida/);
  refused(input({ targetXml: xml().replace('type="module"', 'type="plugin"') }), /group/);
  refused(input({ targetXml: xml().replace('mod_example.js', 'mod_example.php') }), /PHP/);
  refused(input({ targetXml: xml('<field name="constructor" />') }), /reservado/);
  refused(input({ targetXml: xml('<field name="moduleClass" />') }), /avançados/);
  refused(input({ targetXml: xml('<field name="message" /><field name="message" />') }), /duplicado/);
  refused(input({ targetXml: xml('<field name="message" maxlength="3" />') }), /Valores incompatíveis/);
  refused(input({ targetXml: xml('<field name="message" required="true" />') }), /nao suportado/);
  const sourceDuplicate = input(); sourceDuplicate.extension.manifestJson = '{"params":[{"name":"x"},{"name":"x"}]}'; refused(sourceDuplicate, /duplicado/);
  const sourceReserved = input(); sourceReserved.extension.manifestJson = '{"params":[{"name":"constructor"}]}'; refused(sourceReserved, /reservado/);
  const sourceAdvanced = input(); sourceAdvanced.extension.manifestJson = '{"params":[{"name":"moduleClass","type":"text","default":""}]}';
  refused(sourceAdvanced, /avançados/); // Native XML redeclarations are an explicit first-increment limitation.
  const sourceBadParams = input(); sourceBadParams.extension.manifestJson = '{"params":"not a JSON list"}'; refused(sourceBadParams, /lista JSON/);
  const sourceObjectParams = input(); sourceObjectParams.extension.manifestJson = '{"params":{}}'; refused(sourceObjectParams, /lista/);
  const sourceWhitespace = input(); sourceWhitespace.extension.manifestJson = '{"params":[{"name":" message"}]}'; refused(sourceWhitespace, /nome inseguro/);
  const sourceLongLabel = input(); sourceLongLabel.extension.manifestJson = JSON.stringify({ params: [{ name: 'message', label: 'x'.repeat(201) }] }); refused(sourceLongLabel, /truncamento/);

  for (const map of [[], null, { message: 1 }, { '*': 'message' }, { message: '*' }, { message: 'constructor' }, { message: 'moduleClass' }, { missing: 'message' }, { message: 'absent' }, { ' message': 'message' }]) refused(input({ parameterMap: map }), /Mapeamento|parameterMap/);
  const collisions = input({ targetXml: xml('<field name="body" />'), parameterMap: { message: 'body' } });
  collisions.instances[0].settingsJson = '{"message":"saved","body":"unknown but existing"}'; refused(collisions, /colisão/);
  const duplicateMap = input({ targetXml: xml('<field name="body" />'), parameterMap: { message: 'body', unknown: 'body' } }); refused(duplicateMap, /duplicados/);
  refused(input({ targetXml: xml('<field name="body" /><field name="message" />'), parameterMap: { message: 'body', body: 'message' } }), /cadeia|origem/);
  const declaredCollision = input({ targetXml: xml('<field name="body" />'), parameterMap: { message: 'body' } }); declaredCollision.extension.manifestJson = '{"params":[{"name":"message"},{"name":"body"}]}'; refused(declaredCollision, /colisão/);
  const reservedMap = JSON.parse('{"__proto__":"message"}'); refused(input({ parameterMap: reservedMap }), /inseguro/);
  assert.equal(planExtensionMigration(input({ parameterMap: { message: 'message' } })).ready, true);
  const unknownRename = input({ targetXml: xml('<field name="message" /><field name="data" type="textarea" mj:type="json" mj:valueType="object" />'), parameterMap: { unknown: 'data' } });
  const unknownRenamePlan = planExtensionMigration(unknownRename);
  assert.equal(unknownRenamePlan.ready, true);
  assert.deepEqual(unknownRenamePlan.changes.instances[0].after.data, { nested: [1, true] });
  assert.equal(Object.hasOwn(unknownRenamePlan.changes.instances[0].after, 'unknown'), false);

  let calls = 0;
  const getter = () => { calls++; throw new Error('must not execute'); };
  const accessed = input(); Object.defineProperty(accessed.extension, 'etag', { get: getter, enumerable: true }); refused(accessed, /objeto JSON válido/);
  const hiddenEtagGetter = input(); Object.defineProperty(hiddenEtagGetter.instances[0], 'etag', { get: getter, enumerable: false }); refused(hiddenEtagGetter, /objeto JSON válido/);
  const hiddenOther = input(); Object.defineProperty(hiddenOther.extension, 'etag', { value: '"real"', enumerable: false }); Object.defineProperty(hiddenOther.extension, 'privateHidden', { value: true, enumerable: false }); refused(hiddenOther, /objeto JSON válido/);
  const xmlGetter = input(); Object.defineProperty(xmlGetter, 'targetXml', { get: getter, enumerable: true }); refused(xmlGetter, /objeto JSON válido/);
  const targetGetter = input(); Object.defineProperty(targetGetter.target, 'baseUrl', { get: getter, enumerable: true }); refused(targetGetter, /objeto JSON válido/);
  const mapGetter = input(); mapGetter.parameterMap = {}; Object.defineProperty(mapGetter.parameterMap, 'message', { get: getter, enumerable: true }); refused(mapGetter, /objeto JSON válido/);
  const callback = input({ parameterMap: { message: getter } }); refused(callback, /objeto JSON válido/);
  const toJson = input(); toJson.extension.toJSON = getter; refused(toJson, /objeto JSON válido/);
  const inherited = input(); inherited.extension = Object.create(inherited.extension); refused(inherited, /objeto JSON válido/);
  const inheritedTarget = input(); inheritedTarget.target = Object.create(target); refused(inheritedTarget, /objeto JSON válido/);
  const inheritedSchema = input(); inheritedSchema.extension.manifestJson = '{}'; inheritedSchema.extension.extra = Object.create({ name: 'message', type: 'text' }); refused(inheritedSchema, /objeto JSON válido/);
  const nestedGetter = input(); nestedGetter.extension.extra = {}; Object.defineProperty(nestedGetter.extension.extra, 'secret', { get: getter, enumerable: true }); refused(nestedGetter, /objeto JSON válido/);
  const sparse = input(); sparse.instances.length = 2; refused(sparse, /objeto JSON válido/);
  const extraArray = input(); extraArray.instances.extra = true; refused(extraArray, /objeto JSON válido/);
  const symbol = input(); symbol.extension[Symbol('hidden')] = true; refused(symbol, /objeto JSON válido/);
  const hidden = input(); Object.defineProperty(hidden.extension, 'secret', { value: true }); refused(hidden, /objeto JSON válido/);
  const cycle = input(); cycle.extension.self = cycle.extension; refused(cycle, /objeto JSON válido/);
  assert.equal(calls, 0, 'no getters, toJSON or mappings executed');
  refused(input({ targetXml: { key: 'example.module', packageVerified: true } }), /texto XML/);
  refused(input({ target: { ...target, packageVerified: true } }), /alegação/);
  refused(input({ targetDescriptor: { verified: true } }), /Opção não suportada/);
  refused(input({ parameterEdits: { 10: { message: 'fixed' } } }), /Opção não suportada/);
  refused(input({ target: { baseUrl: 'https://example.invalid/pkg', manifestPath: target.manifestPath } }), /server-relative/);
  assert.equal(planExtensionMigration(input()).target.descriptor.entryPointUrl, `${target.baseUrl}/modules/mod_example/mod_example.js`);
  console.log('ok - extension migration: pure private preview, exact ETags/snapshots, conservative schema changes, explicit renames and no executor');
}

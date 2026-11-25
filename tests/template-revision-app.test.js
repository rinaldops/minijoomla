import assert from 'node:assert/strict';
import { renderTemplateRevisionPage, bindTemplateRevisionPage, loadTemplateRevisionPage } from '../src/administrator/components/com_templates/template-revision-page.js';

/*
 * Testes de interface memory-only para a UI de revisão de template
 * (#/templates/revision). Nao sao testes de aceite visual/live/mockup:
 * nenhum browser, nenhuma rede, nenhum DOM real — apenas fakes mínimos de
 * `documentRef`/`templateRevisionService`/`adminService`, no mesmo padrão
 * de tests/extension-roots-view.test.js. Cobrem exatamente o contrato
 * acordado: prepare somente leitura, commit single-intent com duplicado
 * desabilitado, `uncertain` bloqueando replay automático, rollback seletivo
 * usando o ETag do próprio receipt, navegação obsoleta nunca autorizando
 * escrita/atualização visual, e escaping de HTML nos dados exibidos.
 */

const shell = ({ bodyHtml }) => bodyHtml;
const router = { link: (path) => `#${path}` };

function makeElement(overrides = {}) {
  const el = { hidden: false, disabled: false, checked: false, textContent: '', ...overrides };
  const byEvent = new Map();
  el.addEventListener = (event, handler) => { byEvent.set(event, handler); };
  el.dispatch = (event) => byEvent.get(event)?.({ preventDefault() {} });
  return el;
}

function makeRoot({ withForms = true } = {}) {
  const status = makeElement();
  const diff = makeElement({ hidden: true });
  const diffFields = new Map();
  diff.querySelector = (selector) => {
    const match = selector.match(/data-revision-field="([^"]+)"/);
    if (!match) return null;
    if (!diffFields.has(match[1])) diffFields.set(match[1], makeElement());
    return diffFields.get(match[1]);
  };
  const templateSelect = makeElement({ value: '7' });
  const baseInput = makeElement({ value: '/sites/exemplo/SiteAssets/templates/sample/1.0.1/' });
  const manifestInput = makeElement({ value: 'manifest.json' });
  const inventoryInput = makeElement({ value: 'inventory.json' });
  const hashInput = makeElement({ value: 'a'.repeat(64) });
  const prepareFields = { templateId: templateSelect, baseUrl: baseInput, manifestPath: manifestInput, inventoryPath: inventoryInput, inventoryHash: hashInput };
  const prepareButton = makeElement();
  const prepareForm = withForms ? makeElement() : null;
  if (prepareForm) prepareForm.querySelector = (selector) => {
    if (selector === 'button[type="submit"]') return prepareButton;
    const match = selector.match(/name="([^"]+)"/);
    return match ? prepareFields[match[1]] : null;
  };

  const commitConfirm = makeElement();
  const commitButton = makeElement();
  const commitForm = withForms ? makeElement({ hidden: true }) : null;
  if (commitForm) commitForm.querySelector = (selector) => {
    if (selector === 'button[type="submit"]') return commitButton;
    if (selector === '[name="confirmCommit"]') return commitConfirm;
    return null;
  };

  const rollbackConfirm = makeElement();
  const rollbackButton = makeElement();
  const rollbackSummary = makeElement();
  const rollbackForm = withForms ? makeElement({ hidden: true }) : null;
  if (rollbackForm) rollbackForm.querySelector = (selector) => {
    if (selector === 'button[type="submit"]') return rollbackButton;
    if (selector === '[name="confirmRollback"]') return rollbackConfirm;
    if (selector === '[data-revision-field="committed"]') return rollbackSummary;
    return null;
  };

  const root = {
    querySelector: (selector) => {
      if (selector === '[data-revision-prepare]') return prepareForm;
      if (selector === '[data-revision-status]') return status;
      if (selector === '[data-revision-diff]') return diff;
      if (selector === '[data-revision-commit]') return commitForm;
      if (selector === '[data-revision-rollback]') return rollbackForm;
      return null;
    }
  };
  return { root, status, diff, diffFields, prepareForm, prepareButton, commitForm, commitConfirm, commitButton, rollbackForm, rollbackConfirm, rollbackButton, rollbackSummary };
}

function fakeReady(overrides = {}) {
  return {
    status: 'ready', reason: 'ready',
    plan: {
      token: 'plan-1', candidateAssets: [{ path: 'a' }],
      snapshot: { template: { id: 7, title: 'Exemplo', key: 'sample', version: '1.0.0' } },
      manifest: { version: '1.0.1', styles: ['./css/template.css'] },
      after: { entryPointUrl: '/index.js' }
    },
    snapshot: { assets: [{ path: 'b' }] },
    expectedETag: { template: '"t1"', config: '"c1"' },
    ...overrides
  };
}

export async function runTemplateRevisionAppTests() {
  // 1) Render: HTML escaping of template rows and empty-state guard.
  const htmlEscaped = renderTemplateRevisionPage([{ id: 1, title: 'A<&>', key: 'k<&>', version: '1<&>' }], router.link, shell);
  assert.ok(htmlEscaped.includes('A&lt;&amp;&gt;') && !htmlEscaped.includes('A<&>'));
  const htmlEmpty = renderTemplateRevisionPage([], router.link, shell);
  assert.ok(htmlEmpty.includes('Nenhum template registrado para revisar.') && !htmlEmpty.includes('data-revision-prepare'));

  // 2) loadTemplateRevisionPage: feature-unavailable / catalog-unavailable / list failure fallbacks never throw and never call the service.
  const unavailable = await loadTemplateRevisionPage({ router, shell, documentRef: { body: {} } });
  assert.ok(unavailable.html.includes('não está configurada'));
  const catalogUnavailable = await loadTemplateRevisionPage({ templateRevisionService: {}, adminService: { templates: { available: false } }, router, shell, documentRef: { body: {} } });
  assert.ok(catalogUnavailable.html.includes('Catálogo de templates não configurado'));
  const listFailure = await loadTemplateRevisionPage({ templateRevisionService: {}, adminService: { templates: { list: async () => { throw new Error('boom'); } } }, router, shell, documentRef: { body: {} } });
  assert.ok(listFailure.html.includes('Não foi possível carregar'));

  // 3) Happy path: prepare (read-only) -> diff shown -> commit requires confirmation -> single-intent disables duplicate submit -> rollback uses receipt's own ETag.
  let current = true;
  const calls = { prepare: 0, commit: 0, rollback: 0 };
  let receivedCommit, receivedRollback;
  const service = {
    prepare: async (input) => { calls.prepare++; assert.equal(input.templateId, 7); assert.deepEqual(input.candidate, { baseUrl: '/sites/exemplo/SiteAssets/templates/sample/1.0.1/', manifestPath: 'manifest.json', inventoryPath: 'inventory.json', inventoryHash: 'a'.repeat(64) }); return fakeReady(); },
    commit: async (input) => { calls.commit++; receivedCommit = input; return { status: 'committed', reason: 'committed', plan: fakeReady().plan, committedAt: 'now', postUpdateETag: '"t2"', rollback: { token: 'rb-1', expectedETag: { template: '"t2"', config: '"c1"' } } }; },
    rollback: async (input) => { calls.rollback++; receivedRollback = input; return { status: 'rolled-back', reason: 'rolled-back', rollbackETag: '"t3"' }; }
  };
  const fixture = makeRoot();
  bindTemplateRevisionPage({ documentRef: { body: fixture.root }, templateRevisionService: service, isCurrent: () => current });

  // Commit/rollback are disabled before any prepare succeeds.
  fixture.commitForm.dispatch('submit');
  fixture.rollbackForm.dispatch('submit');
  assert.equal(calls.commit, 0);
  assert.equal(calls.rollback, 0);

  fixture.prepareForm.dispatch('submit');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(calls.prepare, 1);
  assert.equal(fixture.diff.hidden, false, 'prepare (read-only) must reveal the diff/summary before any write is possible');
  assert.equal(fixture.commitForm.hidden, false);
  assert.equal(fixture.diffFields.get('versions').textContent, '1.0.0 → 1.0.1');

  // commit blocked without explicit confirmation checkbox.
  fixture.commitForm.dispatch('submit');
  assert.equal(calls.commit, 0, 'commit must require explicit confirmation, not just a click');

  fixture.commitConfirm.checked = true;
  fixture.commitForm.dispatch('submit');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(calls.commit, 1);
  assert.equal(receivedCommit.confirm, true);
  assert.deepEqual(receivedCommit.expectedETag, { template: '"t1"', config: '"c1"' });
  assert.equal(fixture.commitButton.disabled, true);

  // Single intent: a second submit on the same plan never dispatches again, even after re-checking the box.
  fixture.commitConfirm.checked = true;
  fixture.commitForm.dispatch('submit');
  await Promise.resolve();
  assert.equal(calls.commit, 1, 'duplicate submission on an already-consumed plan must be disabled, not retried');

  // rollback: becomes available only after a successful commit, and reuses the receipt's own expectedETag (never a hand-built one).
  assert.equal(fixture.rollbackForm.hidden, false);
  fixture.rollbackForm.dispatch('submit');
  assert.equal(calls.rollback, 0, 'rollback must require its own explicit confirmation');
  fixture.rollbackConfirm.checked = true;
  fixture.rollbackForm.dispatch('submit');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(calls.rollback, 1);
  assert.deepEqual(receivedRollback.rollback, { token: 'rb-1', expectedETag: { template: '"t2"', config: '"c1"' } });
  assert.deepEqual(receivedRollback.expectedETag, { template: '"t2"', config: '"c1"' });
  assert.equal(receivedRollback.confirm, true);

  // single intent also applies to rollback.
  fixture.rollbackConfirm.checked = true;
  fixture.rollbackForm.dispatch('submit');
  await Promise.resolve();
  assert.equal(calls.rollback, 1, 'duplicate rollback submission on a consumed receipt must be disabled, not retried');

  // 3b) One-intention-per-visit lock: prepare is attemptable exactly once per
  // visit, success or failure — a second prepare submit (even with changed
  // fields) must never re-dispatch, must never overwrite the ready/receipt
  // already in use, and the prepare button stays disabled permanently.
  fixture.prepareForm.dispatch('submit');
  await Promise.resolve();
  assert.equal(calls.prepare, 1, 'prepare must never be attempted a second time in the same visit, even after a successful first attempt');
  assert.equal(fixture.prepareButton.disabled, true);

  // 3c) A failed prepare also permanently locks prepare for this visit (no
  // "try again" without reloading — a new visit, a new state).
  const failedPrepareFixture = makeRoot();
  let failedPrepareCalls = 0;
  const failedPrepareService = { prepare: async () => { failedPrepareCalls++; return { status: 'validation-failed', reason: 'validation-failed', message: 'Inventário diverge.' }; } };
  bindTemplateRevisionPage({ documentRef: { body: failedPrepareFixture.root }, templateRevisionService: failedPrepareService, isCurrent: () => true });
  failedPrepareFixture.prepareForm.dispatch('submit');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(failedPrepareCalls, 1);
  assert.equal(failedPrepareFixture.prepareButton.disabled, true);
  failedPrepareFixture.prepareForm.dispatch('submit');
  await Promise.resolve();
  assert.equal(failedPrepareCalls, 1, 'a failed prepare must not be retryable in the same visit either');

  // 3d) While commit is in flight, a concurrent rollback submit on the same
  // visit must be rejected and must not consume the receipt commit is about
  // to produce.
  const concurrentFixture = makeRoot();
  let releaseCommit;
  let concurrentPrepareCalls = 0;
  const concurrentService = {
    prepare: async () => { concurrentPrepareCalls++; return fakeReady(); },
    commit: async () => new Promise((resolve) => { releaseCommit = () => resolve({ status: 'committed', reason: 'committed', plan: fakeReady().plan, committedAt: 'now', postUpdateETag: '"t9"', rollback: { token: 'rb-9', expectedETag: { template: '"t9"', config: '"c1"' } } }); })
  };
  bindTemplateRevisionPage({ documentRef: { body: concurrentFixture.root }, templateRevisionService: concurrentService, isCurrent: () => true });
  concurrentFixture.prepareForm.dispatch('submit');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(concurrentPrepareCalls, 1);
  concurrentFixture.commitConfirm.checked = true;
  concurrentFixture.commitForm.dispatch('submit'); // commit in flight, not yet resolved
  await Promise.resolve();
  concurrentFixture.rollbackConfirm.checked = true;
  concurrentFixture.rollbackForm.dispatch('submit');
  await Promise.resolve();
  releaseCommit();
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(concurrentFixture.rollbackForm.hidden, false, 'a rollback submitted while commit was still in flight must not have consumed the freshly-minted receipt');

  // 3e) Once a receipt exists, a rollback in flight must not accept a second
  // submit until it resolves (no duplicate dispatch mid-flight).
  let releaseRollback;
  let rollbackDispatchCount = 0;
  const busyIsolationService = {
    prepare: async () => fakeReady(),
    commit: async () => ({ status: 'committed', reason: 'committed', plan: fakeReady().plan, committedAt: 'now', postUpdateETag: '"t7"', rollback: { token: 'rb-7', expectedETag: { template: '"t7"', config: '"c1"' } } }),
    rollback: async () => { rollbackDispatchCount++; return new Promise((resolve) => { releaseRollback = () => resolve({ status: 'rolled-back', reason: 'rolled-back', rollbackETag: '"t7b"' }); }); }
  };
  const busyIsolationFixture = makeRoot();
  bindTemplateRevisionPage({ documentRef: { body: busyIsolationFixture.root }, templateRevisionService: busyIsolationService, isCurrent: () => true });
  busyIsolationFixture.prepareForm.dispatch('submit');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  busyIsolationFixture.commitConfirm.checked = true;
  busyIsolationFixture.commitForm.dispatch('submit');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  busyIsolationFixture.rollbackConfirm.checked = true;
  busyIsolationFixture.rollbackForm.dispatch('submit'); // in flight now
  await Promise.resolve();
  busyIsolationFixture.rollbackConfirm.checked = true;
  busyIsolationFixture.rollbackForm.dispatch('submit'); // second click mid-flight
  await Promise.resolve();
  assert.equal(rollbackDispatchCount, 1, 'a second rollback click while the first is still in flight must not dispatch again');
  releaseRollback();
  await Promise.resolve(); await Promise.resolve();

  // 4) `uncertain` must block replay: no automatic retry, status message says
  // so WITHOUT suggesting reload/new-prepare as a way to "try again" (it must
  // demand external reconciliation instead), and it locks ALL further writes
  // and preparation for this visit — not just the stage that produced it.
  const uncertainFixture = makeRoot();
  let uncertainCommitCalls = 0;
  const uncertainService = {
    prepare: async () => fakeReady(),
    commit: async () => { uncertainCommitCalls++; return { status: 'uncertain', reason: 'uncertain', message: 'Indeterminado.' }; }
  };
  bindTemplateRevisionPage({ documentRef: { body: uncertainFixture.root }, templateRevisionService: uncertainService, isCurrent: () => true });
  uncertainFixture.prepareForm.dispatch('submit');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  uncertainFixture.commitConfirm.checked = true;
  uncertainFixture.commitForm.dispatch('submit');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(uncertainCommitCalls, 1);
  assert.ok(!/recarregue|recarregar|tente novamente|repita o prepare/i.test(uncertainFixture.status.textContent), 'uncertain message must never suggest reload/retry as a recovery path');
  assert.match(uncertainFixture.status.textContent, /confira o registro/i);
  uncertainFixture.commitConfirm.checked = true;
  uncertainFixture.commitForm.dispatch('submit');
  await Promise.resolve();
  assert.equal(uncertainCommitCalls, 1, 'uncertain result must never be replayed automatically nor via a repeated manual submit on the same plan');
  // uncertain must also lock rollback for the rest of this visit.
  uncertainFixture.rollbackConfirm.checked = true;
  uncertainFixture.rollbackForm.dispatch('submit');
  await Promise.resolve();
  assert.equal(uncertainFixture.rollbackForm.hidden, true, 'uncertain must lock rollback for the rest of this visit');

  // uncertain surfaced by rollback must likewise lock any further action in this visit.
  const uncertainRollbackFixture = makeRoot();
  let uncertainRollbackCalls = 0;
  const uncertainRollbackService = {
    prepare: async () => fakeReady(),
    commit: async () => ({ status: 'committed', reason: 'committed', plan: fakeReady().plan, committedAt: 'now', postUpdateETag: '"t8"', rollback: { token: 'rb-8', expectedETag: { template: '"t8"', config: '"c1"' } } }),
    rollback: async () => { uncertainRollbackCalls++; return { status: 'uncertain', reason: 'uncertain', message: 'Indeterminado no rollback.' }; }
  };
  bindTemplateRevisionPage({ documentRef: { body: uncertainRollbackFixture.root }, templateRevisionService: uncertainRollbackService, isCurrent: () => true });
  uncertainRollbackFixture.prepareForm.dispatch('submit');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  uncertainRollbackFixture.commitConfirm.checked = true;
  uncertainRollbackFixture.commitForm.dispatch('submit');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  uncertainRollbackFixture.rollbackConfirm.checked = true;
  uncertainRollbackFixture.rollbackForm.dispatch('submit');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(uncertainRollbackCalls, 1);
  assert.ok(!/recarregue|recarregar|tente novamente/i.test(uncertainRollbackFixture.status.textContent));
  // Attempting rollback again (hypothetically re-shown) must not re-dispatch.
  uncertainRollbackFixture.rollbackConfirm.checked = true;
  uncertainRollbackFixture.rollbackForm.dispatch('submit');
  await Promise.resolve();
  assert.equal(uncertainRollbackCalls, 1, 'uncertain rollback must never be replayed automatically');

  // 5) Stale navigation must never authorize a write, nor a late visual update.
  let navCurrent = true;
  const staleFixture = makeRoot();
  let staleCommitCalls = 0;
  const staleService = {
    prepare: async () => fakeReady(),
    commit: async () => { staleCommitCalls++; return { status: 'committed', reason: 'committed', plan: fakeReady().plan, committedAt: 'now', postUpdateETag: '"t2"', rollback: { token: 'rb-2', expectedETag: { template: '"t2"', config: '"c1"' } } }; }
  };
  bindTemplateRevisionPage({ documentRef: { body: staleFixture.root }, templateRevisionService: staleService, isCurrent: () => navCurrent });
  staleFixture.prepareForm.dispatch('submit');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  staleFixture.commitConfirm.checked = true;
  navCurrent = false; // navigated away before the async commit resolves
  staleFixture.commitForm.dispatch('submit');
  assert.equal(staleCommitCalls, 0, 'navigating away before submit must not authorize dispatching the write');
  navCurrent = true;
  await Promise.resolve();

  // A prepare that resolves after navigating away must not mutate the (stale) DOM either.
  let prepareCurrent = true;
  const lateFixture = makeRoot();
  const lateService = { prepare: async () => { prepareCurrent = false; return fakeReady(); } };
  bindTemplateRevisionPage({ documentRef: { body: lateFixture.root }, templateRevisionService: lateService, isCurrent: () => prepareCurrent });
  lateFixture.prepareForm.dispatch('submit');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(lateFixture.diff.hidden, true, 'a prepare that resolves after navigating away must not update the stale page');
  assert.equal(lateFixture.commitForm.hidden, true);

  // 6) Failure path reported generically (no internals leaked) and never reveals the commit form.
  const failFixture = makeRoot();
  const failService = { prepare: async () => ({ status: 'validation-failed', reason: 'validation-failed', message: 'Inventário diverge do pin externo.' }) };
  bindTemplateRevisionPage({ documentRef: { body: failFixture.root }, templateRevisionService: failService, isCurrent: () => true });
  failFixture.prepareForm.dispatch('submit');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(failFixture.commitForm.hidden, true);
  assert.equal(failFixture.status.textContent, 'Inventário diverge do pin externo.');

  const thrownFixture = makeRoot();
  const thrownService = { prepare: async () => { throw new Error('network dropped mid-flight with internal stack details'); } };
  bindTemplateRevisionPage({ documentRef: { body: thrownFixture.root }, templateRevisionService: thrownService, isCurrent: () => true });
  thrownFixture.prepareForm.dispatch('submit');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(thrownFixture.status.textContent, 'Não foi possível preparar a revisão.');
  assert.ok(!thrownFixture.status.textContent.includes('stack'));

  console.log('ok - template revision app: escaping, read-only prepare/diff, explicit confirmation, single-intent commit/rollback without duplicate dispatch, uncertain blocks replay, stale navigation never authorizes a write or a late DOM update, generic error reporting');
}

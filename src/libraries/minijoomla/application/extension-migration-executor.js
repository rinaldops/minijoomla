/*
 * Assisted migration executor: the gates from docs/CONTRATOS.md#evolução-xml--contratos-e-gates-aprovados
 * section 4 ("Futuro executor: gates antes de qualquer gravação"), built on
 * top of the pure preview in extension-migration-plan.js. Never fabricates
 * data of its own: every value written here is the exact `after` object the
 * caller's own frozen plan already reported, re-verified against fresh
 * reads before each write. No automatic retry with `*`, no silent partial
 * apply and no bulk rollback across unrelated rows.
 *
 * Durable journal shape (same withLock contract as sample-data-service.js):
 *   { schemaVersion: 1, extensionId, instanceIds: [...], signature,
 *     stage: 'extension'|'instances'|'done', extensionReceipt: {etag}|null,
 *     instanceReceipts: [{id,etag}...], pending: {...}|null,
 *     rollback: { extension: {snapshot}, instances: [{id,snapshot}] } | null }
 *
 * `signature` binds the journal to one specific, already-approved plan
 * (extension id/etag, instance ids/etags, target key/entryPointUrl and the
 * exact approved after-values) — a changed plan can never resume a stale
 * journal; it must be re-previewed explicitly.
 */
import { ValidationError } from '../core/contracts.js';
import { planExtensionMigration } from './extension-migration-plan.js';

class MigrationExecutionError extends Error {
  constructor(status, reason, message, details = {}) {
    super(message); this.status = status; this.reason = reason; this.details = details;
  }
}
const fail = (status, reason, message, details) => { throw new MigrationExecutionError(status, reason, message, details); };
const own = (object, key) => Object.hasOwn(object, key);
const validId = (id) => Number.isSafeInteger(Number(id)) && Number(id) > 0;
const validEtag = (etag) => typeof etag === 'string' && Boolean(etag.trim()) && etag.trim() !== '*';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

async function signatureOf(plan) {
  const text = canonical({
    extension: { id: plan.changes.extension.id, etag: plan.changes.extension.etag, entryPointUrlAfter: plan.changes.extension.entryPointUrl.after },
    instances: plan.changes.instances.map((item) => ({ id: item.id, etag: item.etag, after: item.after })),
    target: { key: plan.target.descriptor.key, type: plan.target.descriptor.type, manifestPath: plan.target.manifestPath }
  });
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  return `canonical:${text}`;
}

const STORE_LOCKS = new WeakMap();
function withJournalLock(store, operation) {
  if (typeof store?.withLock === 'function') return store.withLock(operation);
  if (!store || !['object', 'function'].includes(typeof store)) return operation();
  const previous = STORE_LOCKS.get(store);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  STORE_LOCKS.set(store, gate);
  return (async () => {
    try { if (previous) await previous; return await operation(); }
    finally { release(); if (STORE_LOCKS.get(store) === gate) STORE_LOCKS.delete(store); }
  })();
}

function context(isCurrent) {
  const guard = () => { if (isCurrent && isCurrent() !== true) fail('partial', 'abandoned', 'A tela mudou. Nenhuma nova operação será iniciada.', { abandoned: true }); };
  return { guard, async call(operation) { guard(); try { const result = await operation(); guard(); return result; } catch (error) { guard(); throw error; } } };
}

function validateJournalShape(raw, plan, signature) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Journal inválido.');
  const journal = JSON.parse(JSON.stringify(raw));
  if (journal.schemaVersion !== 1 || journal.signature !== signature) throw new Error('Journal não corresponde ao plano aprovado atual.');
  if (Number(journal.extensionId) !== Number(plan.changes.extension.id)) throw new Error('Journal pertence a outra extensão.');
  if (!['extension', 'instances', 'done'].includes(journal.stage)) throw new Error('Estágio de journal inválido.');
  if (journal.extensionReceipt !== null && (typeof journal.extensionReceipt !== 'object' || !validEtag(journal.extensionReceipt.etag))) throw new Error('Recibo de extensão inválido.');
  if (!Array.isArray(journal.instanceReceipts)) throw new Error('Recibos de instância inválidos.');
  const seen = new Set();
  for (const receipt of journal.instanceReceipts) {
    if (!receipt || !validId(receipt.id) || !validEtag(receipt.etag) || seen.has(Number(receipt.id))) throw new Error('Recibo de instância inválido ou duplicado.');
    seen.add(Number(receipt.id));
  }
  if (journal.pending !== null && (typeof journal.pending !== 'object' || !own(journal.pending, 'kind'))) throw new Error('Entrada pendente inválida.');
  return journal;
}

/**
 * createExtensionMigrationExecutor({ admin, repositories, journalStore })
 * `admin.extensions.update` deliberately refuses to change `entryPointUrl`
 * (it belongs to the installed manifest, the same guard the discovery
 * installer respects) — this executor is one of the few callers allowed to
 * move it, so the extension row itself is written through the raw
 * `repositories.extensions.update`, exactly like joomla-extension-installer.js
 * does for upgrade/rollback. Everything else (reads, instance writes, the
 * extension read used to detect concurrent edits) goes through `admin`,
 * same surface the rest of the panel already uses.
 */
export function createExtensionMigrationExecutor({ admin, repositories, journalStore } = {}) {
  let busy = false;
  const available = Boolean(admin?.extensions?.get && repositories?.extensions?.update && admin.moduleInstances?.get && admin.moduleInstances.update
    && typeof journalStore?.read === 'function' && typeof journalStore?.write === 'function');

  function result(status, reason, message, details = {}) { return { status, reason, message, ...details }; }

  async function freshPlan(ctx, planInput, journal) {
    const doneInstanceIds = new Set((journal?.instanceReceipts ?? []).map((receipt) => Number(receipt.id)));
    const extensionDone = Boolean(journal?.extensionReceipt);
    const extensionRow = await ctx.call(() => admin.extensions.get(planInput.extension.id));
    if (!extensionRow || extensionRow.id !== planInput.extension.id) fail('blocked', 'extension-missing', 'A extensão não existe mais. Nenhuma alteração foi feita.');
    if (!extensionDone && extensionRow.etag !== planInput.extension.etag) fail('blocked', 'extension-changed', 'A extensão foi alterada por outra pessoa desde a prévia aprovada. Repita a prévia antes de continuar.');
    const instanceRows = [];
    for (const row of planInput.instances) {
      const current = await ctx.call(() => admin.moduleInstances.get(row.id));
      if (!current || Number(current.id) !== Number(row.id)) fail('blocked', 'instance-missing', 'Uma instância referenciada não existe mais. Nenhuma alteração foi feita.', { instanceId: row.id });
      if (!doneInstanceIds.has(Number(row.id)) && current.etag !== row.etag) fail('blocked', 'instance-changed', 'Uma instância foi alterada por outra pessoa desde a prévia aprovada. Repita a prévia antes de continuar.', { instanceId: row.id });
      // The plan must keep validating against the approved snapshot's
      // before-value for already-migrated rows (their live etag changed by
      // design); only genuinely pending rows use the fresh read for safety.
      instanceRows.push(doneInstanceIds.has(Number(row.id)) ? row : current);
    }
    const plan = planExtensionMigration({ ...planInput, extension: extensionDone ? planInput.extension : extensionRow, instances: instanceRows });
    if (!plan.ready) fail('blocked', 'plan-rejected', 'O plano não é mais válido com os dados atuais. Revise e repita a prévia.', { reason: plan.reason });
    return plan;
  }

  /** Re-verify the caller's already-approved plan against fresh reads; never trusts a stale snapshot. */
  async function inspect({ planInput, isCurrent } = {}) {
    if (busy) return result('partial', 'busy', 'Uma migração já está em andamento.', { busy: true });
    const ctx = context(isCurrent);
    try {
      const approved = planExtensionMigration(planInput);
      if (!approved.ready) fail('blocked', 'plan-rejected', 'O plano informado não é válido.', { reason: approved.reason });
      const signature = await signatureOf(approved);
      let journal = null;
      try { const raw = await ctx.call(() => journalStore.read()); if (raw !== null && raw !== undefined) journal = validateJournalShape(raw, approved, signature); }
      catch (error) { if (error instanceof MigrationExecutionError) throw error; fail('blocked', 'invalid-journal', 'Journal de migração inválido. Revisão manual necessária.'); }
      if (journal?.stage === 'done') return result('done', 'done', 'Migração já concluída e verificada.', { plan: approved, canResume: false, stage: 'done' });
      const plan = await freshPlan(ctx, planInput, journal);
      return result(journal ? 'resumable' : 'ready', journal ? 'resumable' : 'ready',
        journal ? 'Migração parcial anterior encontrada; retomada segura disponível.' : 'Plano revalidado com dados atuais. Confirme para aplicar.',
        { plan, canResume: Boolean(journal), stage: journal?.stage ?? 'extension' });
    } catch (error) {
      return error instanceof MigrationExecutionError ? result(error.status, error.reason, error.message, error.details) : result('unavailable', 'read-failed', 'Não foi possível revalidar o plano. Nenhuma alteração foi feita.');
    }
  }

  async function apply({ planInput, confirm, isCurrent } = {}) {
    if (!available) return result('unavailable', 'dependencies-unavailable', 'Executor de migração indisponível: forneça admin.extensions/moduleInstances e um journal durável.');
    if (busy) return result('partial', 'busy', 'Uma migração já está em andamento.', { busy: true });
    if (confirm !== true) return result('blocked', 'confirmation-required', 'Confirmação explícita obrigatória. Nenhuma alteração foi feita.', { cancelled: true });
    busy = true;
    const ctx = context(isCurrent);
    let journal = null;
    let remoteStarted = false;
    async function execute() {
      ctx.guard();
      const approved = planExtensionMigration(planInput);
      if (!approved.ready) fail('blocked', 'plan-rejected', 'O plano informado não é válido.', { reason: approved.reason });
      const signature = await signatureOf(approved);
      let raw;
      try { raw = await ctx.call(() => journalStore.read()); } catch { fail('unavailable', 'journal-unavailable', 'Não foi possível ler o journal durável.'); }
      if (raw !== null && raw !== undefined) {
        try { journal = validateJournalShape(raw, approved, signature); }
        catch (error) { if (error instanceof MigrationExecutionError) throw error; fail('blocked', 'invalid-journal', 'Journal de migração inválido. Revisão manual necessária; nenhuma gravação será repetida.'); }
      }
      if (journal?.stage === 'done') return result('done', 'done', 'Migração já concluída e verificada.', { plan: approved });
      const plan = await freshPlan(ctx, planInput, journal);
      async function persist(next, reason) {
        try { await ctx.call(() => journalStore.write(next)); }
        catch { fail('partial', reason, 'Não foi possível confirmar a gravação do journal. A alteração pode ter ocorrido; revisão manual necessária.', { uncertain: true }); }
        journal = next;
      }
      if (!journal) {
        await persist({ schemaVersion: 1, extensionId: plan.changes.extension.id, instanceIds: plan.changes.instances.map((item) => item.id),
          signature, stage: 'extension', extensionReceipt: null, instanceReceipts: [], pending: null,
          rollback: { extension: { etag: plan.changes.extension.etag, entryPointUrl: plan.changes.extension.entryPointUrl.before, metadataBefore: plan.changes.extension.metadataBefore },
            instances: plan.changes.instances.map((item) => ({ id: item.id, etag: item.etag, before: item.before })) } }, 'journal-write-failed');
      }
      if (journal.stage === 'extension' && !journal.extensionReceipt) {
        const fresh = await ctx.call(() => admin.extensions.get(plan.changes.extension.id));
        if (!fresh || fresh.etag !== plan.changes.extension.etag) fail('blocked', 'extension-changed', 'A extensão foi alterada por outra pessoa desde a prévia. Repita a prévia antes de continuar.');
        await persist({ ...journal, pending: { kind: 'extension', id: plan.changes.extension.id } }, 'pending-write-failed');
        let updated;
        try {
          remoteStarted = true;
          updated = await ctx.call(() => repositories.extensions.update(plan.changes.extension.id,
            { entryPointUrl: plan.changes.extension.entryPointUrl.after, manifestJson: JSON.stringify(plan.target.metadata) }, { etag: plan.changes.extension.etag }));
          if (!updated) updated = await ctx.call(() => admin.extensions.get(plan.changes.extension.id));
        } catch (error) {
          if (error?.code === 'concurrency-conflict') fail('blocked', 'extension-changed', 'A extensão foi alterada por outra pessoa durante a aplicação. Nenhuma instância foi tocada.');
          fail('partial', 'pending-uncertain', 'A atualização da extensão não pôde ser confirmada. O journal pendente foi preservado para revisão manual.', { uncertain: true });
        }
        if (!updated || !validEtag(updated.etag)) fail('partial', 'update-unverified', 'A extensão atualizada não possui ETag verificável. Revisão manual necessária.', { uncertain: true });
        remoteStarted = false;
        await persist({ ...journal, stage: 'instances', extensionReceipt: { etag: updated.etag }, pending: null }, 'receipt-write-failed');
      }
      for (let index = journal.instanceReceipts.length; index < plan.changes.instances.length; index += 1) {
        const item = plan.changes.instances[index];
        const fresh = await ctx.call(() => admin.moduleInstances.get(item.id));
        if (!fresh || fresh.etag !== item.etag) fail('blocked', 'instance-changed', 'Uma instância foi alterada por outra pessoa desde a prévia. Repita a prévia antes de continuar.', { completedInstances: index });
        await persist({ ...journal, pending: { kind: 'instance', id: item.id, index } }, 'pending-write-failed');
        let updated;
        try {
          remoteStarted = true;
          updated = await ctx.call(() => admin.moduleInstances.update(item.id, { settings: item.after }, { etag: item.etag }));
          if (!updated) updated = await ctx.call(() => admin.moduleInstances.get(item.id));
        } catch (error) {
          if (error?.code === 'concurrency-conflict') fail('blocked', 'instance-changed', 'Uma instância foi alterada por outra pessoa durante a aplicação.', { completedInstances: index });
          fail('partial', 'pending-uncertain', 'A atualização de uma instância não pôde ser confirmada. O journal pendente foi preservado para revisão manual.', { uncertain: true, completedInstances: index });
        }
        if (!updated || !validEtag(updated.etag)) fail('partial', 'update-unverified', 'A instância atualizada não possui ETag verificável. Revisão manual necessária.', { uncertain: true, completedInstances: index });
        remoteStarted = false;
        await persist({ ...journal, instanceReceipts: [...journal.instanceReceipts, { id: item.id, etag: updated.etag }], pending: null }, 'receipt-write-failed');
      }
      await persist({ ...journal, stage: 'done', pending: null }, 'receipt-write-failed');
      return result('done', 'done', 'Migração aplicada e verificada: extensão e todas as instâncias atualizadas.', { plan, completedInstances: plan.changes.instances.length });
    }
    try { ctx.guard(); return await withJournalLock(journalStore, execute); }
    catch (error) {
      const details = { ...(remoteStarted ? { uncertain: true } : {}), ...(error.details ?? {}) };
      return error instanceof MigrationExecutionError ? result(error.status, error.reason, error.message, details)
        : result('partial', 'execution-failed', 'Migração interrompida. Não há rollback automático; verifique o journal antes de continuar.', details);
    } finally { busy = false; }
  }

  /**
   * Rollback only reads from the journal's own captured `rollback` snapshot
   * (the exact before-values from the plan that started this journal) — it
   * never re-derives values from a new preview, and never touches a row the
   * journal did not itself change.
   */
  async function rollback({ isCurrent } = {}) {
    if (!available) return result('unavailable', 'dependencies-unavailable', 'Executor de migração indisponível.');
    if (busy) return result('partial', 'busy', 'Uma migração já está em andamento.', { busy: true });
    busy = true;
    const ctx = context(isCurrent);
    try {
      let raw;
      try { raw = await ctx.call(() => journalStore.read()); } catch { fail('unavailable', 'journal-unavailable', 'Não foi possível ler o journal durável.'); }
      if (!raw) return result('blocked', 'no-journal', 'Não há journal de migração para reverter.');
      if (!raw.rollback || typeof raw.rollback !== 'object') fail('blocked', 'no-rollback-data', 'O journal não contém dados de reversão; revisão manual necessária.');
      if (raw.pending !== null) fail('blocked', 'pending-uncertain', 'Há uma operação pendente com resultado incerto. Verifique manualmente antes de reverter.', { uncertain: true });
      const { extension: extensionBefore, instances: instancesBefore } = raw.rollback;
      for (let index = raw.instanceReceipts.length - 1; index >= 0; index -= 1) {
        const receipt = raw.instanceReceipts[index];
        const before = instancesBefore.find((entry) => Number(entry.id) === Number(receipt.id));
        if (!before) fail('blocked', 'no-rollback-data', 'Instância sem dados de reversão capturados; revisão manual necessária.', { instanceId: receipt.id });
        const fresh = await ctx.call(() => admin.moduleInstances.get(receipt.id));
        if (!fresh || fresh.etag !== receipt.etag) fail('blocked', 'instance-changed', 'Uma instância foi alterada por outra pessoa desde a migração; reversão interrompida sem apagar edições concorrentes.', { instanceId: receipt.id });
        await ctx.call(() => admin.moduleInstances.update(receipt.id, { settings: before.before }, { etag: receipt.etag }));
      }
      if (raw.extensionReceipt) {
        const fresh = await ctx.call(() => admin.extensions.get(raw.extensionId));
        if (!fresh || fresh.etag !== raw.extensionReceipt.etag) fail('blocked', 'extension-changed', 'A extensão foi alterada por outra pessoa desde a migração; reversão interrompida sem apagar edições concorrentes.');
        await ctx.call(() => repositories.extensions.update(raw.extensionId, { entryPointUrl: extensionBefore.entryPointUrl, manifestJson: JSON.stringify(extensionBefore.metadataBefore) }, { etag: raw.extensionReceipt.etag }));
      }
      await ctx.call(() => journalStore.write(null));
      return result('rolled-back', 'rolled-back', 'Reversão concluída: extensão e instâncias restauradas aos valores anteriores à migração.');
    } catch (error) {
      return error instanceof MigrationExecutionError ? result(error.status, error.reason, error.message, error.details) : result('partial', 'rollback-failed', 'Reversão interrompida; o journal foi preservado para revisão manual.');
    } finally { busy = false; }
  }

  return Object.freeze({ available, inspect, apply, rollback });
}

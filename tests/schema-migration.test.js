/*
 * Testes locais do plano de continuidade §2.3: schema antigo (v1, sem as
 * colunas novas) -> provisionamento (inspect/apply/verify, SPMIDDLE real) ->
 * leitura/gravação parcial com os campos novos, ETag, repetição, falhas e
 * reversão de dados — sem rede. Modela restrições REST documentadas no
 * projeto; esta execução não confirma comportamento contra um tenant:
 *
 *   - uma gravação que referencia uma propriedade/coluna inexistente na
 *     lista real falha com HTTP 400 ("The property '<X>' does not exist on
 *     type '...'") — nunca é silenciosamente ignorada ou convertida em
 *     sucesso;
 *   - um campo Choice só é aceito sob `__metadata.type: "SP.FieldChoice"`,
 *     nunca sob o `SP.Field` genérico (contrato implementado em
 *     SPMIDDLE/packages/sharepoint-provisioning/src/provisioning.js).
 *
 * Usa createMapper/createRepository (data-core) e createProvisioningManager
 * (sharepoint-provisioning) reais do SPMIDDLE, sobre o MESMO transporte em
 * memória que createSharePointListClient consumiria — nenhuma chamada de
 * rede, nenhum tenant/GUID real.
 */
import assert from 'node:assert/strict';
import { createMapper, createRepository } from '../../SPMIDDLE/packages/data-core/src/index.js';
import { createSharePointListClient } from '../../SPMIDDLE/packages/sharepoint-rest-browser/src/index.js';
import { createProvisioningManager } from '../../SPMIDDLE/packages/sharepoint-provisioning/src/index.js';
import { MiniJoomlaModuleInstances } from '../src/libraries/minijoomla/infrastructure/spmiddle-schemas.js';
import { MINIJOOMLA_FIELD_MAPPINGS } from '../src/libraries/minijoomla/infrastructure/spmiddle-repositories.js';

const WEB_URL = '/sites/minijoomla-schema-migration-test';
const LIST_TITLE = 'MiniJoomlaModuleInstances';

function notFound(message = 'not found') {
  return Object.assign(new Error(message), { code: 'not-found', status: 404 });
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/*
 * Transporte estritamente local que modela dois comportamentos REST:
 *   1. POST/MERGE com uma propriedade cujo InternalName não existe no
 *      `fields` atual da lista falha com HTTP 400
 *      (InvalidClientQueryException), nunca aceita silenciosamente — o
 *      mesmo "The property 'X' does not exist on type '...'" real.
 *   2. POST de criação de campo com `Choices` só é aceito quando
 *      `__metadata.type === 'SP.FieldChoice'`; sob o `SP.Field` genérico,
 *      falha com a mesma mensagem real.
 * `fields` é o inventário explícito da fixture, não descoberta remota.
 * Exportado para a suíte das oito entidades usar o mesmo double estrito.
 */
export function createSchemaMemoryTransport({ webUrl = WEB_URL, title = LIST_TITLE, fields = [] } = {}) {
  const listRoot = `${webUrl}/_api/web/lists/getbytitle('${title}')`;
  const itemsPath = `${listRoot}/items`;
  const fieldsPath = `${listRoot}/fields`;
  const state = { list: { Id: '00000000-0000-4000-8000-000000000001', Title: title, BaseTemplate: 100 }, fields: clone(fields), items: new Map(), nextId: 1, nextVersion: 1, requests: [], failFieldOnce: null };
  const response = (data, status = 200, etag = null) => ({ data: clone(data), status, etag });
  const knownInternalNames = () => new Set(state.fields.map((field) => field.InternalName));

  function assertKnownProperties(body) {
    const unknown = Object.keys(body ?? {}).find((key) => key !== '__metadata' && !knownInternalNames().has(key));
    if (unknown) {
      const error = new Error(`The property '${unknown}' does not exist on type 'SP.Data.${title}ListItem'. Make sure to only use property names that are defined by the type.`);
      error.code = '-1, Microsoft.SharePoint.Client.InvalidClientQueryException';
      error.status = 400;
      throw error;
    }
  }

  return {
    webUrl, state,
    async request(path, options = {}) {
      const method = String(options.method ?? 'GET').toUpperCase();
      const body = options.body ?? {};
      state.requests.push({ path, method, body: clone(body), etag: options.etag });

      if (method === 'GET' && (path === listRoot || path.startsWith(`${listRoot}?`))) return response(state.list);
      if (method === 'GET' && path.startsWith(fieldsPath)) return response({ value: state.fields });
      if (method === 'GET' && path === `${listRoot}/indexes`) return response({ value: [] });

      if (method === 'POST' && path === fieldsPath) {
        if (state.failFieldOnce === body.InternalName) {
          state.failFieldOnce = null;
          throw Object.assign(new Error('Falha local injetada na criação de campo'), { code: 'service-unavailable', status: 503 });
        }
        if (knownInternalNames().has(body.InternalName)) throw Object.assign(new Error('Campo já existe'), { status: 400 });
        const isChoice = Array.isArray(body.Choices?.results ?? body.Choices);
        if (isChoice && body.__metadata?.type !== 'SP.FieldChoice') {
          const error = new Error(`The property 'Choices' does not exist on type '${body.__metadata?.type ?? 'SP.Field'}'. Make sure to only use property names that are defined by the type.`);
          error.code = '-1, Microsoft.SharePoint.Client.InvalidClientQueryException';
          error.status = 400;
          throw error;
        }
        const typeNames = { 2: 'Text', 3: 'Note', 4: 'DateTime', 6: 'Choice', 8: 'Boolean', 9: 'Number' };
        const field = { InternalName: body.InternalName, StaticName: body.InternalName, Title: body.Title, TypeAsString: typeNames[body.FieldTypeKind] ?? body.FieldTypeKind, Required: body.Required === true };
        if (isChoice) field.Choices = body.Choices.results ?? body.Choices;
        state.fields.push(field);
        return response(field, 201);
      }

      if (method === 'GET' && (path === itemsPath || path.startsWith(`${itemsPath}?`))) {
        return response({ value: [...state.items.values()].map(clone) });
      }
      if (method === 'POST' && path === itemsPath) {
        assertKnownProperties(body);
        const id = state.nextId++;
        const etag = `"${state.nextVersion++}"`;
        const item = { Id: id, ...clone(body), '@odata.etag': etag };
        state.items.set(id, item);
        return response(item, 201, etag);
      }
      if (path.startsWith(`${itemsPath}(`) && path.endsWith(')')) {
        const id = Number(path.slice(itemsPath.length + 1, -1));
        const item = state.items.get(id);
        if (!item) throw notFound('item not found');
        if (method === 'GET') return response(item, 200, item['@odata.etag']);
        if (options.etag !== item['@odata.etag']) throw Object.assign(new Error('ETag does not match'), { code: 'concurrency-conflict', status: 412 });
        // SharePoint pode responder MERGE com 204 e nenhum item/ETag. O
        // consumidor precisa reler antes de outra escrita, inclusive undo.
        if (method === 'MERGE') { assertKnownProperties(body); Object.assign(item, clone(body)); item['@odata.etag'] = `"${state.nextVersion++}"`; return response(null, 204); }
        if (method === 'DELETE') { state.items.delete(id); return response(null, 204); }
      }
      throw new Error(`Unexpected ${method} ${path}`);
    }
  };
}

const V1_FIELDS = [
  { InternalName: 'Title', TypeAsString: 'Text', Required: true },
  { InternalName: 'ExtensionKey', TypeAsString: 'Text', Required: true },
  { InternalName: 'Position', TypeAsString: 'Text', Required: true },
  { InternalName: 'Ordering', TypeAsString: 'Number', Required: false },
  { InternalName: 'SettingsJson', TypeAsString: 'Note', Required: false },
  { InternalName: 'Enabled', TypeAsString: 'Boolean', Required: false },
  { InternalName: 'ScopeKind', TypeAsString: 'Choice', Required: false, Choices: ['All', 'Route'] },
  { InternalName: 'ScopeRoute', TypeAsString: 'Text', Required: false },
  { InternalName: 'ScopeCategoryAlias', TypeAsString: 'Text', Required: false }
];

function buildRepository(transport) {
  const client = createSharePointListClient({ transport, listPath: `lists/getbytitle('${LIST_TITLE}')` });
  const mapper = createMapper({ mapping: MINIJOOMLA_FIELD_MAPPINGS.moduleInstances });
  return createRepository({ source: 'moduleInstances', schema: MiniJoomlaModuleInstances, mapper, client });
}

export async function runSchemaMigrationTests() {
  // 1. O inventário local v1 (campos novos ausentes) aceita
  // normalmente uma gravação que só usa os campos antigos — preservando o
  // escopo legado, exatamente como o runtime público já exige
  // (resolveModuleEntries cai para scopeKind/scopeRoute/scopeCategoryAlias
  // quando assignment está ausente).
  const v1Transport = createSchemaMemoryTransport({ fields: V1_FIELDS });
  const v1Repository = buildRepository(v1Transport);
  const legacyCreated = await v1Repository.create({ title: 'Legado', extensionKey: 'articles-latest', position: 'sidebar', scopeKind: 'Route', scopeRoute: 'home' });
  assert.equal(legacyCreated.title, 'Legado');
  assert.ok(legacyCreated.etag);

  // 2. A MESMA lista v1 rejeita, de forma alta e clara (nunca convertida em
  // sucesso silencioso nem em lista vazia), uma gravação que usa um campo
  // do schema v2 ainda ausente — modela o HTTP 400 documentado
  // ("The property 'ShowTitle' does not exist on type '...'").
  await assert.rejects(
    () => v1Repository.create({ title: 'Precisa de v2', extensionKey: 'articles-latest', position: 'sidebar', showTitle: false }),
    (error) => { assert.equal(error.status, 400); assert.match(error.message, /ShowTitle.*does not exist/); return true; }
  );
  // Nenhum item parcial foi deixado para trás pela tentativa rejeitada.
  assert.equal(v1Transport.state.items.size, 1);

  console.log('ok - schema migration: lista em schemaVersion 1 aceita gravação só com campos legados e rejeita alto e claro (HTTP 400) uma gravação que usa um campo do schema v2 ainda ausente, sem deixar item parcial');

  // 3. inspect()/apply()/verify() (SPMIDDLE real, createProvisioningManager)
  // contra a MESMA lista v1 — plano idempotente: inspect não escreve nada;
  // apply cria exatamente os campos v2 ausentes, incluindo o campo Choice
  // (Assignment) com a metadata correta; verify confirma a presença dos
  // nomes depois (limite de validação de tipos demonstrado no cenário 8).
  const manager = createProvisioningManager({ schema: MiniJoomlaModuleInstances, transport: v1Transport });
  const inspected = await manager.inspect();
  assert.equal(inspected.missing, undefined); // a lista já existe (missing só aparece quando a lista inteira falta)
  const missingNames = inspected.actions.filter((action) => action.kind === 'field').map((action) => action.target);
  assert.deepEqual(new Set(missingNames), new Set(['ShowTitle', 'PublishUp', 'PublishDown', 'Trashed', 'Assignment', 'AssignmentJson', 'Note']));
  assert.equal(v1Transport.state.fields.length, V1_FIELDS.length); // inspect não escreveu nada

  await assert.rejects(() => manager.apply(), /confirm/i); // sem confirmação explícita, nunca escreve
  assert.equal(v1Transport.state.fields.length, V1_FIELDS.length);

  await assert.rejects(() => manager.apply({ confirm: () => false }), (error) => error.code === 'confirmation-denied');
  assert.equal(v1Transport.state.requests.filter((request) => request.method !== 'GET' && request.path.endsWith('/fields')).length, 0);

  const applied = await manager.apply({ confirm: true });
  assert.equal(applied.status, 'complete', JSON.stringify(applied.results.filter((r) => r.status === 'failed'), null, 2));
  const assignmentField = v1Transport.state.fields.find((field) => field.InternalName === 'Assignment');
  assert.ok(assignmentField && assignmentField.Choices, 'o campo Choice Assignment deve existir com suas opções (Choices) persistidas');
  assert.deepEqual(assignmentField.Choices, ['all', 'none', 'only', 'except']);
  assert.equal(assignmentField.TypeAsString, 'Choice');
  assert.equal(v1Transport.state.requests.find((request) => request.method === 'POST' && request.body.InternalName === 'Assignment').body.__metadata.type, 'SP.FieldChoice');

  const verified = await manager.verify();
  assert.equal(verified.actions.length, 0, 'depois do apply, todos os nomes declarados devem estar presentes');
  assert.equal(verified.compatible, true);

  console.log('ok - schema migration: inspect/apply/verify (SPMIDDLE real) provisiona 7 campos v2 ausentes incluindo SP.FieldChoice/Assignment, exige confirmação e verifica presença dos nomes');

  // 4. Depois do provisionamento, a MESMA gravação do passo 2 (antes
  // rejeitada) funciona — leitura/gravação parcial dos campos novos, sem
  // perder os dados já existentes (o item "Legado" criado antes continua
  // intacto, nunca migrado/reescrito por este processo).
  const afterMigration = await v1Repository.create({ title: 'Agora com v2', extensionKey: 'articles-latest', position: 'sidebar', showTitle: false, assignment: 'only', assignmentJson: JSON.stringify(['route:home']) });
  assert.equal(afterMigration.showTitle, false);
  assert.equal(afterMigration.assignment, 'only');
  const stillLegacy = await v1Repository.findById(legacyCreated.id);
  assert.equal(stillLegacy.title, 'Legado');
  assert.equal(stillLegacy.scopeRoute, 'home'); // preservado, nunca sobrescrito pela migração de schema

  console.log('ok - schema migration: depois do provisionamento, a gravação com campos v2 (antes rejeitada) funciona, e o item legado criado antes do provisionamento permanece intacto');

  // 5. ETag/repetição/falha: um UPDATE com ETag obsoleto no mesmo item
  // (conflito local) continua rejeitado mesmo depois da migração de
  // schema — a migração de schema não contorna nem mascara conflito de
  // concorrência otimista.
  const staleEtag = afterMigration.etag;
  await v1Repository.update(afterMigration.id, { title: 'Primeira edição' }, { etag: staleEtag });
  await assert.rejects(
    () => v1Repository.update(afterMigration.id, { title: 'Segunda edição (etag obsoleto)' }, { etag: staleEtag }),
    (error) => error.code === 'concurrency-conflict'
  );
  const afterConflict = await v1Repository.findById(afterMigration.id);
  assert.equal(afterConflict.title, 'Primeira edição'); // rejeição atômica de uma escrita, não rollback de schema

  // Repetir o MESMO apply (idempotência real): nenhum campo duplicado,
  // nenhuma segunda tentativa de criar um campo já existente.
  const writesBeforeRepeat = v1Transport.state.requests.filter((request) => request.method !== 'GET').length;
  const secondApply = await manager.apply({ confirm: true });
  assert.equal(secondApply.plan.actions.length, 0);
  assert.equal(v1Transport.state.fields.length, V1_FIELDS.length + 7);
  assert.equal(v1Transport.state.requests.filter((request) => request.method !== 'GET').length, writesBeforeRepeat);

  console.log('ok - schema migration: ETag obsoleto continua rejeitado após a migração (sem rollback mascarado), e repetir apply é idempotente (nenhum campo duplicado)');

  // 6. Undo explícito de dados com snapshot e ETag atual. O MERGE 204 não
  // devolve entidade: releitura é obrigatória; nunca usar o ETag do snapshot.
  const snapshot = { title: afterMigration.title, assignment: afterMigration.assignment, assignmentJson: afterMigration.assignmentJson, showTitle: afterMigration.showTitle };
  await assert.rejects(() => v1Repository.update(afterMigration.id, snapshot, { etag: afterMigration.etag }), (error) => error.status === 412);
  assert.equal(await v1Repository.update(afterMigration.id, snapshot, { etag: afterConflict.etag }), null);
  const restored = await v1Repository.findById(afterMigration.id);
  for (const [key, value] of Object.entries(snapshot)) assert.deepEqual(restored[key], value);
  await v1Repository.delete(restored.id, { etag: restored.etag });
  assert.equal(v1Transport.state.items.size, 1);
  assert.equal((await v1Repository.findById(legacyCreated.id)).scopeRoute, 'home');
  assert.equal(v1Transport.state.fields.length, V1_FIELDS.length + 7, 'undo de dados não remove campos');
  console.log('ok - schema migration: snapshot de dados restaurado com ETag relido, criação sintética removida e campos preservados; não é rollback de schema');

  // 7. apply não é transação: falha de um campo deixa os outros aplicados.
  // verify deve expor a pendência; repetir aplica só o que ainda falta.
  const partialTransport = createSchemaMemoryTransport({ fields: V1_FIELDS });
  const partialRepository = buildRepository(partialTransport);
  const partialLegacy = await partialRepository.create({ title: 'Preservar', extensionKey: 'articles-latest', position: 'sidebar' });
  const legacyBefore = clone(partialTransport.state.items.get(partialLegacy.id));
  partialTransport.state.failFieldOnce = 'Assignment';
  const partialManager = createProvisioningManager({ schema: MiniJoomlaModuleInstances, transport: partialTransport });
  const failedApply = await partialManager.apply({ confirm: true });
  assert.equal(failedApply.status, 'failed');
  assert.deepEqual(failedApply.results.filter((result) => result.status === 'failed').map((result) => result.action.target), ['Assignment']);
  assert.equal(failedApply.results.filter((result) => result.status === 'applied').length, 6);
  const partialVerify = await partialManager.verify();
  assert.equal(partialVerify.compatible, false);
  assert.deepEqual(partialVerify.actions.map((action) => action.target), ['Assignment']);
  assert.deepEqual(partialTransport.state.items.get(partialLegacy.id), legacyBefore);
  const repaired = await partialManager.apply({ confirm: true });
  assert.equal(repaired.status, 'complete');
  assert.deepEqual(repaired.results.map((result) => result.action.target), ['Assignment']);
  assert.equal((await partialManager.verify()).compatible, true);
  assert.equal(new Set(partialTransport.state.fields.map((field) => field.InternalName)).size, partialTransport.state.fields.length);
  assert.deepEqual(partialTransport.state.items.get(partialLegacy.id), legacyBefore);
  console.log('ok - schema migration: falha parcial explícita, verify incompatível e retomada aditiva sem duplicação ou reescrita de dados');

  // 8. Limite real da API: verify compara presença, não o tipo do campo.
  // Não interpretar compatible=true como validação de tipos ou downgrade.
  const assignment = partialTransport.state.fields.find((field) => field.InternalName === 'Assignment');
  assignment.TypeAsString = 'Text';
  assert.equal((await partialManager.verify()).compatible, true);
  assert.equal(typeof partialManager.rollback, 'undefined');
  assert.equal(typeof partialManager.remove, 'undefined');
  console.log('ok - schema migration: limite explícito — verify não detecta tipo divergente e manager não oferece rollback/remove');

  console.log('schema migration: 8 cenários locais aprovados');
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll('\\', '/')}`) runSchemaMigrationTests();

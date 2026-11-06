import assert from 'node:assert/strict';
import { withErrorTranslation } from '../src/libraries/minijoomla/infrastructure/spmiddle-error-translation.js';
import { DataError } from '../src/libraries/minijoomla/core/contracts.js';

export async function runSPMiddleErrorTranslationTests() {
  const transportDetail = new Error('internal transport detail (status 503, path /_api/web/lists/...)');
  transportDetail.name = 'SharePointRestError';
  transportDetail.code = 'throttled';
  transportDetail.status = 503;
  transportDetail.path = '/teams/SAPScripting/_api/web/lists/getbytitle(\'MiniJoomlaArticles\')/items';

  const failing = withErrorTranslation({
    findMany: async () => { throw transportDetail; },
    findById: async () => { throw transportDetail; },
    create: async () => { throw transportDetail; }
  });

  await assert.rejects(() => failing.findMany({}), (error) => {
    assert.ok(error instanceof DataError, 'deve traduzir para DataError');
    assert.equal(error.message, 'Falha ao consultar conteúdo.');
    assert.ok(!error.message.includes('status 503'), 'a mensagem traduzida não deve conter detalhe de transporte');
    assert.ok(!error.message.includes('/_api/'), 'a mensagem traduzida não deve conter caminho interno');
    assert.equal(error.cause, transportDetail, 'o erro original fica disponível em .cause para diagnóstico interno');
    return true;
  });

  await assert.rejects(() => failing.findById('1'), (error) => error instanceof DataError && error.cause === transportDetail);

  // create/update/delete não fazem parte do contrato de leitura e não são
  // envolvidos por este wrapper: o Marco D depende do erro original exato
  // (status/code) para detectar conflito de ETag.
  await assert.rejects(() => failing.create({}), (error) => error === transportDetail);

  // Um DataError já traduzido não é embrulhado de novo (sem cadeia de cause
  // aninhada quando camadas superiores também usam este wrapper).
  const alreadyTranslated = new DataError('Falha ao consultar conteúdo.', { cause: transportDetail });
  const doublyWrapped = withErrorTranslation({ findMany: async () => { throw alreadyTranslated; } });
  await assert.rejects(() => doublyWrapped.findMany({}), (error) => error === alreadyTranslated);

  // Um repositório ausente/invälido passa através sem lançar aqui (a
  // validação de "repository válido" é responsabilidade de quem monta a
  // composição, não deste wrapper).
  assert.equal(withErrorTranslation(null), null);
  assert.equal(withErrorTranslation(undefined), undefined);

  console.log('ok - spmiddle error translation: traduz falha de transporte para DataError sem vazar detalhe, preservando a causa');
  console.log('ok - spmiddle error translation: não embrulha create/update/delete, nem um DataError já traduzido');
  console.log('spmiddle error translation: 2 testes aprovados');
}

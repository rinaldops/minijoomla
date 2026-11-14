/*
 * Tradução de erro de transporte -> erro de domínio (pendência registrada
 * em docs/CONTRATOS.md#minijoomla--integração-com-spmiddle-local-e-caminho-para-remoto e docs/ESTADO.md#gates-atuais-de-publicação-e-distribuição
 * §4/§5). Qualquer falha do transporte REST ou do repositório (inclusive
 * `SharePointRestError`) se torna, para quem lê conteúdo, um único
 * `DataError` ("Falha ao consultar conteúdo"), com o erro original só em
 * `.cause` — nunca exibido.
 *
 * Um único tipo (DataError), não NotFoundError: "não encontrado" (regra 2
 * de docs/CONTRATOS.md#minijoomla--contrato-v1-congelado-dos-adapters-de-conteúdo) já é `null` depois de uma leitura
 * bem-sucedida filtrada por alias/tag em memória. Um erro de transporte
 * (ex.: lista renomeada, HTTP 404 na própria lista) é falha de
 * configuração/ambiente, não "este alias não existe" — tratá-lo como
 * NotFoundError esconderia um problema de ambiente atrás de uma mensagem
 * que parece dizer "conteúdo não existe".
 *
 * Por que não altera src/libraries/minijoomla/infrastructure/spmiddle-adapter.js: esse adapter é
 * documentado como inalterado (Marco B) e tem um teste que fixa a
 * propagação do erro original por referência ("transport detail must
 * remain outside the domain result", tests/spmiddle-adapter.test.js, com
 * um repositório fixture direto, fora desta composição). Em vez disso,
 * esta função envolve os *repositories* reais antes de injetá-los no
 * adapter — aplicado só pela composição remota
 * (src/libraries/minijoomla/composition/createMiniJoomlaSharePointApp.js).
 *
 * Por que `app.repositories.*` cru continua existindo separadamente: a
 * evidência de escrita (Marco D, docs/ESTADO.md#gates-atuais-de-publicação-e-distribuição
 * §8.1) depende do erro original exato (`error.status === 412`,
 * `error.code === 'concurrency-conflict'`) para detectar conflito de ETag.
 * Por isso só findMany/findById (leitura) são traduzidos, nunca
 * create/update/delete.
 */
import { DataError } from '../core/contracts.js';

function translate(error) {
  if (error instanceof DataError) return error;
  return new DataError('Falha ao consultar conteúdo.', { cause: error });
}

export function withErrorTranslation(repository) {
  if (!repository || typeof repository !== 'object') return repository;
  return Object.freeze({
    ...repository,
    async findMany(...args) { try { return await repository.findMany(...args); } catch (error) { throw translate(error); } },
    async findById(...args) { try { return await repository.findById(...args); } catch (error) { throw translate(error); } }
  });
}

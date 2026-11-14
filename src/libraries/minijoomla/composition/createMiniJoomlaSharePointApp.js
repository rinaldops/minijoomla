/*
 * Composição real do MINIJOOMLA contra o SPMIDDLE (sem mock) — Marco B.
 *
 * Esta função monta a cadeia completa:
 *
 *   schema (spmiddle-schemas.js)
 *     -> data sources (spmiddle-data-sources.js, createDataSourceRegistry)
 *       -> repositories (spmiddle-repositories.js, createMapper+createRepository)
 *         -> tradução de erro de transporte->domínio (spmiddle-error-translation.js)
 *           -> createSPMiddleAdapter (infrastructure/spmiddle-adapter.js, inalterado)
 *             -> createContentService (application/content-service.js)
 *
 * Nenhuma URL real, GUID real ou credencial é embutida aqui: tudo vem de
 * `options`, informado pelo chamador (testes locais usam um transporte fake;
 * uma futura integração remota injeta `transportFactory`/`webUrl`/`lists`
 * reais a partir de configuração operacional, nunca hardcoded). Esta função
 * não faz nenhuma requisição de rede por si só — ela só monta objetos; a
 * primeira requisição ocorre apenas quando o adapter/serviço resultante for
 * efetivamente chamado (`listArticles`, `getArticle`, etc.).
 *
 * `createApplication` (src/index.js) continua usando `createFakeAdapter()`
 * por padrão; esta composição é um caminho alternativo e aditivo, não uma
 * substituição.
 *
 * `repositories` no retorno permanece cru (sem tradução de erro): o Marco D
 * (escrita sintética, docs/ESTADO.md#gates-atuais-de-publicação-e-distribuição) depende
 * do erro original exato (`error.status`/`error.code`) para detectar
 * conflito de ETag. Só a cópia injetada no adapter (leitura) é traduzida.
 */
import { createMiniJoomlaDataSources } from '../infrastructure/spmiddle-data-sources.js';
import { createMiniJoomlaSPMiddleRepositories } from '../infrastructure/spmiddle-repositories.js';
import { withErrorTranslation } from '../infrastructure/spmiddle-error-translation.js';
import { createSPMiddleAdapter } from '../infrastructure/spmiddle-adapter.js';
import { createContentService } from '../application/content-service.js';
import { createConfig } from '../core/config.js';

/*
 * `webUrl`: URL server-relative do site (ex.: "/teams/SAPScripting").
 * `transportFactory`: fábrica de transporte compatível com
 *   createSharePointRestClient; testes locais passam uma fábrica que
 *   devolve um transporte fake/em memória.
 * `lists`: mapa { articles, categories, tags, menu } -> { listId } ou
 *   { listPath }; domínios omitidos ficam fora do registro e, portanto,
 *   fora dos repositories (tags/menu são opcionais para o adapter).
 * `fields`/`pageSize`/`now`: passados adiante para createSPMiddleAdapter.
 * `config`: configuração do site MINIJOOMLA (createConfig).
 */
export function createMiniJoomlaSharePointApp({
  webUrl,
  transportFactory,
  lists = {},
  fields,
  pageSize,
  now,
  cacheMs,
  config = {}
} = {}) {
  const dataSources = createMiniJoomlaDataSources({ webUrl, transportFactory, lists });
  const repositories = createMiniJoomlaSPMiddleRepositories(dataSources);
  if (!repositories.articles) throw new TypeError('lists.articles é obrigatório para montar o adapter SPMIDDLE do MINIJOOMLA.');
  if (!repositories.categories) throw new TypeError('lists.categories é obrigatório para montar o adapter SPMIDDLE do MINIJOOMLA.');

  const adapter = createSPMiddleAdapter({
    articleRepository: withErrorTranslation(repositories.articles),
    categoryRepository: withErrorTranslation(repositories.categories),
    tagRepository: withErrorTranslation(repositories.tags),
    menuRepository: withErrorTranslation(repositories.menu),
    fields,
    pageSize,
    now,
    cacheMs
  });

  const siteConfig = createConfig(config);
  const content = createContentService(adapter, siteConfig);

  return Object.freeze({ dataSources, repositories, adapter, content, config: siteConfig });
}

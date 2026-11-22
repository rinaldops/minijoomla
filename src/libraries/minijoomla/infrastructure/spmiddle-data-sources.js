/*
 * Registro de data sources SPMIDDLE do MINIJOOMLA (local, sem rede).
 *
 * Usa `createDataSourceRegistry` do pacote `sharepoint-rest-browser` do
 * SPMIDDLE para declarar, de forma fechada, quais sites/listas esta
 * aplicação pode acessar. Nenhuma URL, GUID ou caminho de lista é embutido
 * aqui: tudo vem de `options`, informado pela composição que monta a
 * aplicação (ver src/libraries/minijoomla/composition/createMiniJoomlaSharePointApp.js). Criar o
 * registro não faz nenhuma requisição — o transporte só é instanciado sob
 * demanda, via `getTransport`/`getListClient`.
 */
import { createDataSourceRegistry } from '../../../../../SPMIDDLE/packages/sharepoint-rest-browser/src/index.js';
import { MINIJOOMLA_SCHEMAS } from './spmiddle-schemas.js';

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} deve ser um objeto.`);
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} deve ser um texto não vazio.`);
  return value.trim();
}

/*
 * `lists` mapeia cada domínio (articles/categories/tags/menu/extensions/templates/
 * moduleInstances) para `{ listId }` ou `{ listPath }`. Domínios omitidos
 * simplesmente não entram no registro (por exemplo, uma composição que
 * ainda não tem a lista de menu provisionada pode omitir `menu`).
 */
export function createMiniJoomlaDataSources({ webUrl, transportFactory, lists = {} } = {}) {
  text(webUrl, 'webUrl');
  object(lists, 'lists');
  const domains = Object.keys(MINIJOOMLA_SCHEMAS).filter((domain) => lists[domain] !== undefined);
  const sources = domains.map((domain) => {
    const schema = MINIJOOMLA_SCHEMAS[domain];
    const entry = object(lists[domain], `lists.${domain}`);
    const hasId = entry.listId !== undefined;
    const hasPath = entry.listPath !== undefined;
    if (hasId === hasPath) throw new TypeError(`lists.${domain} deve informar exatamente um de listId ou listPath.`);
    return {
      key: domain,
      webUrl,
      ...(hasId ? { listId: text(entry.listId, `lists.${domain}.listId`) } : { listPath: text(entry.listPath, `lists.${domain}.listPath`) }),
      schemaKey: schema.key
    };
  });
  const registry = createDataSourceRegistry({
    allowedWebUrls: [webUrl],
    transportFactory,
    sources
  });
  return Object.freeze({
    registry,
    domains: Object.freeze(domains),
    schemaFor(domain) { return MINIJOOMLA_SCHEMAS[domain]; },
    getListClient(domain) { return registry.getListClient(domain); },
    getTransport(domain) { return registry.getTransport(domain); }
  });
}

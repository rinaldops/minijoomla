/*
 * Memória de filtros por listagem, compartilhada pelos módulos de páginas
 * administrativas (app.js, content-pages.js, extension-pages.js).
 *
 * Vive num módulo próprio, sem dependências, para que as páginas possam
 * usá-la sem importar `app.js` (que importa as páginas — um import de
 * volta seria circular).
 *
 * Regra escolhida, explícita: a ÚLTIMA query explícita (a URL com que o
 * usuário saiu daquela lista) é lembrada por lista em `sessionStorage` — a
 * memória vive enquanto a aba do navegador viver, some quando ela fecha e
 * nunca vaza para outra aba, que é o comportamento esperado de um painel
 * administrativo. Ao abrir uma lista SEM query explícita (clique na
 * sidebar), a query lembrada é reaplicada; abrir a lista COM query
 * explícita sempre vence e substitui a memória (é mais recente e foi
 * pedida diretamente). Como a navegação da sidebar e os retornos
 * pós-salvar já carregam a query na URL, a sidebar passa a devolver o
 * usuário exatamente à lista filtrada de onde ele saiu.
 *
 * `sessionStorage` é acessado sempre dentro de try/catch: modo privado,
 * política de cookies ou um `storage` indisponível (ex.: testes sem DOM)
 * nunca pode quebrar a navegação — na pior hipótese o filtro não é
 * lembrado, que é o comportamento antigo, nunca um erro de tela.
 */
const LIST_FILTER_PREFIX = 'minijoomla.admin.listFilters:';

/*
 * Escopo da memória: LISTA dentro de SITE dentro de USUÁRIO.
 *
 * `sessionStorage` é por ORIGEM, não por site: num tenant SharePoint todos
 * os sites (`/teams/camap-agp`, `/sites/outro`) compartilham a mesma
 * origem. Sem o site na chave, filtrar Artigos em `/teams/camap-agp` e
 * depois abrir Artigos em `/sites/outro` reaplicaria os filtros do outro
 * site — que apontam para ids de categorias/tags inexistentes ali, ou pior,
 * para ids homônimos de outro conteúdo. A chave inclui o caminho do site.
 *
 * O usuário entra pelo mesmo motivo, no eixo da PESSOA: numa sessão em que
 * dois logins usam a mesma aba (troca de conta, kiosk), o recorte de
 * filtros de um vazaria para o outro. O identificador é OPACO (`listMemoryUserToken`
 * no host) e nunca deve carregar e-mail ou nome em texto claro no arquivo
 * de runtime: aqui só se aceita um token já reduzido, e um valor ausente
 * simplesmente não entra na chave (comportamento antigo, por site).
 *
 * Ausente o escopo, a chave degrada para o formato anterior por site —
 * nunca lança.
 */
export const SCOPE_ABSENT = '-';

/*
 * Host injeta o escopo uma vez, quando monta o app (`configureListMemoryScope`).
 * Guardado em variável de módulo, não em `globalThis`, para não vazar entre
 * testes que montam mais de um app no mesmo processo.
 */
let memoryScope = { site: '', user: '' };

/*
 * Normaliza o caminho do site para uma forma estável e curta: sem barras
 * duplicadas ou sobrando, minúsculo (SharePoint compara caminhos sem
 * diferenciar caixa, então `/teams/CAMAP-AGP` e `/teams/camap-agp` são o
 * MESMO site e precisam da MESMA memória). `''`/`'/'` viram `-`.
 */
export function normalizeMemorySite(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw || raw === '/') return SCOPE_ABSENT;
  const path = raw.replace(/\/{2,}/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  return path || SCOPE_ABSENT;
}

/*
 * Token de usuário: aceita só um identificador curto e sem separador
 * (`:` é o separador da chave). Qualquer coisa maior, vazia ou com `:` é
 * descartada — a memória volta a ser por site, nunca corrompe a chave nem
 * grava dado pessoal longo no índice do `sessionStorage`.
 */
export function normalizeMemoryUser(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw || raw.length > 64 || raw.includes(':')) return SCOPE_ABSENT;
  return raw;
}

/*
 * Chamado pelo host que monta o app (`host.js`), com o site real e um
 * token opaco do usuário. Idempotente e tolerante a ausência: sem
 * argumentos, limpa o escopo de volta para o formato por site.
 */
export function configureListMemoryScope({ site, user } = {}) {
  memoryScope = { site: normalizeMemorySite(site), user: normalizeMemoryUser(user) };
}

export function currentMemoryScope() { return memoryScope; }

/*
 * Parâmetros que NUNCA entram na memória, mesmo que estejam na URL:
 * `page` pertence à listagem exibida, não ao recorte de filtros. Se a
 * memória guardasse a página, voltar de um formulário depois de filtrar
 * mais restritamente cairia numa página vazia. A regra fica aqui, no
 * único ponto de gravação, para não depender de cada chamador limpar o
 * parâmetro — `app.js` grava `location.params` cru, que inclui `page`.
 */
const TRANSIENT_PARAMS = new Set(['page']);

export function listFilterKey(path, scope = memoryScope) {
  const site = normalizeMemorySite(scope?.site);
  const user = normalizeMemoryUser(scope?.user);
  return `${LIST_FILTER_PREFIX}${site}:${user}:${String(path ?? '')}`;
}

export function rememberListFilters(path, params, storage = globalThis.sessionStorage, scope = memoryScope) {
  if (!path || !storage) return;
  try {
    const meaningful = Object.entries(params ?? {}).filter(([key, value]) => !TRANSIENT_PARAMS.has(key) && value !== undefined && value !== null && value !== '');
    if (meaningful.length) storage.setItem(listFilterKey(path, scope), JSON.stringify(Object.fromEntries(meaningful)));
    else storage.removeItem(listFilterKey(path, scope));
  } catch { /* sem memória de filtro: comportamento antigo, nunca erro de tela */ }
}

export function recallListFilters(path, storage = globalThis.sessionStorage, scope = memoryScope) {
  if (!path || !storage) return {};
  try {
    const raw = storage.getItem(listFilterKey(path, scope));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([key, value]) => typeof key === 'string' && (typeof value === 'string' || typeof value === 'number')).map(([key, value]) => [key, String(value)]));
  } catch { return {}; }
}

/*
 * Estado da LISTA que precisa sobreviver a abrir/criar/duplicar/cancelar/
 * voltar: cada filtro ativo (barra do topo e menus de coluna), a busca e a
 * ordenação/limite — nunca `page`, que pertence à listagem exibida e não ao
 * registro aberto (voltar de um formulário para a página 7 de uma lista que
 * o filtro encolheu mostraria vazio). Sem isto, "cancelar" voltava para a
 * lista limpa, que é o defeito relatado.
 *
 * Valores vazios são descartados para que um filtro removido não continue
 * viajando na URL como `?state=`.
 */
export function listStateFrom(params = {}, extras = {}) {
  return Object.fromEntries(Object.entries({ ...params, ...extras })
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, String(value)]));
}
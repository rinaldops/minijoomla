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

export function listFilterKey(path) { return `${LIST_FILTER_PREFIX}${String(path ?? '')}`; }

export function rememberListFilters(path, params, storage = globalThis.sessionStorage) {
  if (!path || !storage) return;
  try {
    const meaningful = Object.entries(params ?? {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
    if (meaningful.length) storage.setItem(listFilterKey(path), JSON.stringify(Object.fromEntries(meaningful)));
    else storage.removeItem(listFilterKey(path));
  } catch { /* sem memória de filtro: comportamento antigo, nunca erro de tela */ }
}

export function recallListFilters(path, storage = globalThis.sessionStorage) {
  if (!path || !storage) return {};
  try {
    const raw = storage.getItem(listFilterKey(path));
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
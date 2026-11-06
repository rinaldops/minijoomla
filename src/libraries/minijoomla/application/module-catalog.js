/*
 * Catálogo administrativo dos tipos de módulo (equivalente funcional à
 * tela "Selecionar um tipo de módulo" do com_modules). Metadados e
 * parâmetros declarados são dados puros; o código de renderização dos
 * módulos continua em src/modules/ e não é importado pelo painel.
 */
import { BUILTIN_MODULE_KEYS } from './extension-input.js';
import { ValidationError } from '../core/contracts.js';
import { normalizeParamDefinitions, parseJsonObject } from './declared-params.js';

const limit = (fallback) => ({ name: 'limit', type: 'number', label: 'Quantidade de itens', min: 1, max: 50, default: fallback });

export const BUILTIN_MODULE_TYPES = Object.freeze([
  { key: 'articles-latest', title: 'Artigos — Mais recentes', description: 'Lista os artigos publicados mais recentes.', params: [limit(5)] },
  { key: 'articles-category', title: 'Artigos — Categoria', description: 'Lista artigos de uma categoria.', params: [limit(5), { name: 'category', type: 'text', label: 'Alias da categoria', default: '' }] },
  { key: 'articles-news', title: 'Artigos — Destaques', description: 'Exibe artigos em destaque.', params: [limit(3)] },
  { key: 'tags-similar', title: 'Tags — Similares', description: 'Artigos relacionados pelas tags do artigo atual.', params: [limit(5)] },
  { key: 'tags-popular', title: 'Tags — Populares', description: 'Nuvem/lista das tags mais usadas.', params: [] },
  { key: 'articles-archive', title: 'Artigos — Arquivados', description: 'Lista de meses com artigos publicados.', params: [limit(12)] },
  { key: 'custom-html', title: 'HTML personalizado', description: 'Bloco de HTML sanitizado definido pelo administrador.', params: [{ name: 'title', type: 'text', label: 'Título exibido (se ausente, usa o título do módulo)', default: '' }, { name: 'html', type: 'textarea', label: 'Conteúdo HTML', default: '' }] },
  { key: 'login', title: 'Login / sessão', description: 'Mostra o usuário da sessão do host ou um link de entrada; nunca coleta senha.', params: [{ name: 'loginUrl', type: 'text', label: 'URL de entrada', default: '' }, { name: 'loginText', type: 'text', label: 'Texto do link', default: 'Entrar' }, { name: 'greeting', type: 'text', label: 'Saudação', default: 'Olá' }] },
  { key: 'articles-categories', title: 'Artigos — Categorias', description: 'Lista de categorias (mod_articles_categories).', params: [{ name: 'parent', type: 'text', label: 'ID da categoria pai (vazio = raiz)', default: '' }, { name: 'maxLevel', type: 'number', label: 'Níveis', min: 1, max: 10, default: 1 }, { name: 'showCount', type: 'checkbox', label: 'Mostrar contagem', default: false }] },
  { key: 'related-items', title: 'Itens relacionados', description: 'Artigos com tags ou palavras-chave em comum com o artigo atual.', params: [limit(5), { name: 'showDate', type: 'checkbox', label: 'Mostrar data', default: false }] },
  { key: 'footer', title: 'Rodapé', description: 'Copyright com ano e nome do site.', params: [{ name: 'siteName', type: 'text', label: 'Nome do site', default: '' }, { name: 'text', type: 'text', label: 'Texto adicional', default: '' }] },
  { key: 'articles', title: 'Artigos', description: 'Lista genérica de artigos por categoria e ordenação.', params: [limit(5), { name: 'category', type: 'text', label: 'Alias da categoria', default: '' }, { name: 'ordering', type: 'select', label: 'Ordenação', options: ['recent', 'oldest', 'title'], default: 'recent' }, { name: 'showDate', type: 'checkbox', label: 'Mostrar data', default: false }] },
  { key: 'search', title: 'Busca', description: 'Formulário de busca do site.', params: [{ name: 'label', type: 'text', label: 'Rótulo do campo', default: 'Buscar' }, { name: 'buttonText', type: 'text', label: 'Texto do botão', default: 'Buscar' }] }
].map((type) => Object.freeze({ ...type, builtin: true, params: normalizeParamDefinitions(type.params) })));

// Package names are independent of the persisted module keys (custom-html, etc.).
// Menu and breadcrumbs are built into the shell, not selectable admin types.
export const NATIVE_MODULE_PACKAGES = Object.freeze([
  ...BUILTIN_MODULE_TYPES.map((type) => Object.freeze({ ...type, folder: `mod_${type.key === 'custom-html' ? 'custom' : type.key.replaceAll('-', '_')}` })),
  Object.freeze({ key: 'menu', folder: 'mod_menu', title: 'Menu', description: 'Menu hierárquico do site.', params: normalizeParamDefinitions([
    { name: 'startLevel', type: 'number', label: 'Nível inicial', min: 1, default: 1 },
    { name: 'endLevel', type: 'number', label: 'Nível final', min: 0, default: 0 },
    { name: 'showAllChildren', type: 'checkbox', label: 'Mostrar todos os filhos', default: true }
  ]) }),
  Object.freeze({ key: 'breadcrumbs', folder: 'mod_breadcrumbs', title: 'Breadcrumbs', description: 'Trilha de navegação do site.', params: normalizeParamDefinitions([
    { name: 'showHome', type: 'checkbox', label: 'Mostrar início', default: true },
    { name: 'showLast', type: 'checkbox', label: 'Mostrar último item', default: true },
    { name: 'separator', type: 'text', label: 'Separador', default: '' }
  ]) })
]);

/*
 * Allowlist alinhada às 9 tags realmente aceitas pela validação do
 * serviço (admin-service.js, linha `headerTag inválida`) e pelo runtime
 * público (HEADER_TAGS em src/libraries/minijoomla/modules/dynamic-modules.js e
 * src/libraries/minijoomla/modules/content-runtime.js). Achado real: esta lista ficava com só
 * 7 opções (sem `h1`/`p`), impedindo o administrador de escolher valores
 * que o backend e o runtime já aceitavam — a UI era mais restrita que o
 * próprio contrato que ela existe para configurar.
 */
export const MODULE_ADVANCED_PARAMS = normalizeParamDefinitions([
  { name: 'moduleClass', type: 'text', label: 'Classe CSS do módulo', default: '' },
  { name: 'headerTag', type: 'select', label: 'Tag do título', options: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'p'], default: 'h2' },
  { name: 'headerClass', type: 'text', label: 'Classe CSS do título', default: '' }
]);

export const MODULE_CLASS_PATTERN = /^[a-zA-Z0-9_ -]{0,120}$/;

if (BUILTIN_MODULE_TYPES.length !== BUILTIN_MODULE_KEYS.length) throw new Error('Catálogo de módulos nativos desatualizado.');

/* Junta tipos nativos com módulos registrados (`type === 'Module'`), cujos parâmetros vêm do manifesto persistido. */
export function moduleTypeCatalog(extensions = []) {
  if (!Array.isArray(extensions)) throw new ValidationError('Catálogo de módulos deve ser uma lista.');
  const registered = extensions.filter((row) => row?.type === 'Module').map((row) => {
    const manifest = parseJsonObject(row.manifestJson, { strict: true, field: 'manifestJson' });
    const params = normalizeParamDefinitions(manifest.params);
    return Object.freeze({ key: row.key, title: row.title || row.key, description: String(manifest.description ?? ''), params, builtin: false, enabled: row.enabled !== false, version: String(manifest.version ?? '') });
  });
  return [...BUILTIN_MODULE_TYPES, ...registered.filter((row) => !BUILTIN_MODULE_KEYS.includes(row.key))];
}

export function findModuleType(catalog, key) {
  return catalog.find((type) => type.key === key) ?? null;
}

/*
 * Schemas de campo declarativos por domínio administrável — mesmo
 * princípio já usado por `settingsSchema` de módulos
 * (src/libraries/minijoomla/modules/content-runtime.js): dados puros, consumidos por
 * src/administrator/components/com_minijoomla/render-form.js para montar o formulário e por
 * src/administrator/components/com_minijoomla/render-list.js para escolher quais colunas mostrar numa
 * listagem. Nenhuma validação de negócio vive aqui — isso é
 * responsabilidade de src/libraries/minijoomla/application/admin-service.js; estes schemas só
 * descrevem como CADA CAMPO deve ser apresentado/editado.
 *
 * `relation`: quando presente, identifica outro domínio administrável
 * (chave de ADMIN_DOMAINS) cujos registros alimentam as opções de um
 * select/multiselect — equivalente visual ao Joomla real (categoria de
 * um artigo, extensão de uma instância de módulo, nunca um ID digitado
 * cru). `valueField`/`labelField` escolhem quais propriedades do
 * registro relacionado tornam-se `option.value`/`option.label`.
 * `valueType: 'number'` força a conversão de volta para número ao ler o
 * formulário (ver readAdminFormValues em render-form.js) — necessário
 * porque o widget passa a ser um `<select>`, mas o valor persistido
 * continua sendo numérico (categoryId/parentId). `excludeSelf: true`
 * remove da lista de opções o próprio registro em edição (uma categoria
 * nunca pode ser pai de si mesma).
 *
 * `type: 'richtext'`: renderiza como `<textarea>` igual a `'textarea'`
 * (mesmo valor lido/escrito por readAdminFormValues — nenhuma mudança
 * de contrato de dados), mas src/administrator/components/com_minijoomla/app.js liga um editor TinyMCE
 * real por cima (src/administrator/components/com_minijoomla/editor.js) assim que a tela monta — achado
 * real reportado pelo usuário: sem isso, o único jeito de formatar
 * texto era digitar HTML cru à mão, inviabilizando o uso prático do
 * painel para quem edita conteúdo. Reservado APENAS para os campos
 * cujo valor final o site público trata como HTML real via
 * sanitizeHtml — `article.articletext` (ver abaixo; decomposto em
 * introtext/fulltext na fronteira de persistência, ambos tratados como
 * HTML real por src/components/com_content/tmpl/article/default.js) e `customHtmlBody`
 * (src/libraries/minijoomla/modules/content-runtime.js, customHtmlModule.settings.html).
 * Confirmado por varredura: todo outro campo de texto (description de
 * categoria, siteDescription) é tratado como TEXTO PURO (`escapeHtml`,
 * nunca sanitizeHtml) pelo site público — dar um editor rico a esses
 * campos faria o usuário formatar algo que o site exibiria como tags
 * HTML literais escapadas na tela, um contrato quebrado nunca
 * documentado como aceitável.
 *
 * `articletext` (ARTICLE_FIELDS) — achado real de 2ª rodada: o Joomla
 * real NUNCA expõe `introtext`/`fulltext` como dois campos
 * independentes no admin (ver web-devs/JOOMLA/administrator/components/
 * com_content/forms/article.xml, campo único `articletext`); um
 * primeiro rascunho desta funcionalidade os expunha como dois campos
 * separados, o que (a) divergia da estrutura real do editor do Joomla e
 * (b) causou um bug real relatado pelo usuário quando o dataset de
 * amostra populou artigos sem a quebra "Leia mais" (todo o HTML foi
 * escrito em `introtext`, deixando `fulltext` vazio — comportamento
 * NORMAL no Joomla real, onde a maioria dos artigos nunca usa "Leia
 * mais"). Corrigido unificando num único campo `articletext`
 * (`readMoreButton: true`, consumido só por src/administrator/components/com_minijoomla/editor.js para
 * adicionar o botão "Leia mais" ao toolbar do TinyMCE), composto/
 * decomposto em introtext/fulltext na fronteira de apresentação
 * (src/administrator/components/com_minijoomla/app.js: toArticleFormValues/fromArticleFormValues),
 * replicando EXATAMENTE a lógica real de
 * administrator/components/com_content/src/Model/ArticleModel.php
 * (linha ~417, compõe) e libraries/src/Table/Content.php::bind()
 * (linha ~151, decompõe) via o mesmo marcador literal
 * `<hr id="system-readmore">` que o Joomla real usa — nunca um
 * marcador inventado. O schema persistido (introtext/fulltext como
 * dois campos, admin-service.js/spmiddle-repositories.js) permanece
 * inalterado; só a apresentação no admin muda.
 */

export const ARTICLE_FIELDS = [
  { name: 'title', label: 'Título', type: 'text', required: true },
  { name: 'alias', label: 'Alias', type: 'text', required: true },
  { name: 'articletext', label: 'Texto do artigo', type: 'richtext', readMoreButton: true },
  { name: 'categoryId', label: 'Categoria', type: 'select', relation: 'categories', valueField: 'id', labelField: 'title', valueType: 'number', emptyOptionLabel: '— sem categoria —' },
  { name: 'state', label: 'Estado', type: 'select', options: ['Published', 'Draft', 'Archived', 'Trashed'] },
  { name: 'featured', label: 'Destaque', type: 'checkbox' },
  { name: 'publishUp', label: 'Publicar a partir de', type: 'datetime' },
  { name: 'publishDown', label: 'Publicar até', type: 'datetime' },
  { name: 'author', label: 'Autor', type: 'text' },
  { name: 'authorAlias', label: 'Apelido do autor (alias)', type: 'text' },
  { name: 'language', label: 'Idioma (ex.: pt-BR)', type: 'text' },
  { name: 'note', label: 'Nota interna', type: 'textarea' },
  { name: 'versionNote', label: 'Nota editorial (sem histórico de versões)', type: 'textarea' },
  { name: 'featuredUp', label: 'Destaque a partir de', type: 'datetime' },
  { name: 'featuredDown', label: 'Destaque até', type: 'datetime' },
  { name: 'metaDescription', label: 'Meta descrição', type: 'textarea' },
  { name: 'metaKeywords', label: 'Meta palavras-chave', type: 'textarea' },
  { name: 'attribsJson', label: 'Opções persistidas (somente leitura)', type: 'textarea', readOnly: true },
  { name: 'tags', label: 'Tags', type: 'multiselect', relation: 'tags', valueField: 'name', labelField: 'name' }
];

/*
 * Layout Joomla-like do editor de artigos (Fase 1 do plano
 * docs/PLANO-EDITOR-ARTIGOS-JOOMLA-LIKE.md).
 *
 * Importante: ARTICLE_FIELDS permanece como a lista canônica de campos
 * existentes (sem `tab`), para não alterar o comportamento do renderer
 * genérico (render-form.js) nem seus testes.
 *
 * O editor de artigos usa um renderer especializado
 * (src/administrator/components/com_minijoomla/render-article-form.js) que interpreta este layout para
 * exibir cabeçalho, abas e sidebar, sem alterar o modelo persistido.
 */
export const ARTICLE_EDITOR_LAYOUT = Object.freeze({
  header: ['title', 'alias'],
  tabs: [
    {
      key: 'content',
      label: 'Conteúdo',
      main: ['articletext'],
      sidebar: ['state', 'categoryId', 'featured', 'tags', 'language']
    },
    {
      key: 'images',
      label: 'Imagens e links',
      main: [],
      sidebar: [],
      description: 'Imagens de introdução e do artigo (chaves images.* de attribsJson) e links A/B/C (urls.*), no formato do Joomla. Envie um arquivo ou informe uma URL /caminho ou https://.'
    },
    {
      key: 'options',
      label: 'Opções',
      main: ['attribsJson'],
      sidebar: [],
      description: 'Opções individuais substituem o padrão do componente. Apenas as opções abaixo são consumidas pelo site.'
    },
    {
      key: 'publishing',
      label: 'Publicação',
      main: ['publishUp', 'publishDown', 'featuredUp', 'featuredDown', 'author', 'authorAlias'],
      sidebar: ['note', 'versionNote'],
      description: 'Datas usam o fuso local deste navegador. Notas são internas; não há histórico de versões.'
    },
    {
      key: 'metadata',
      label: 'Metadados',
      main: ['metaDescription', 'metaKeywords'],
      sidebar: [],
      description: 'Meta descrição e palavras-chave do artigo, gravadas nas colunas MetaDescription/MetaKeywords. O uso no HTML público depende do template ativo.'
    }
  ]
});

// Chaves reais de images/urls do article.xml (gravadas em attribsJson.images / attribsJson.urls). Campos de formulário: `grupo:chave`.
const group = (groupName, keys) => keys.map(([key, label, type = 'text']) => Object.freeze({ key, group: groupName, name: `${groupName}:${key}`, label, type }));
export const ARTICLE_IMAGE_FIELDS = Object.freeze(group('images', [
  ['image_intro', 'Imagem de introdução (URL)'], ['image_intro_alt', 'Texto alternativo da imagem de introdução'], ['image_intro_caption', 'Legenda da imagem de introdução'],
  ['image_fulltext', 'Imagem do artigo completo (URL)'], ['image_fulltext_alt', 'Texto alternativo da imagem do artigo'], ['image_fulltext_caption', 'Legenda da imagem do artigo']
]));
export const ARTICLE_LINK_FIELDS = Object.freeze(['a', 'b', 'c'].flatMap((letter) => group('urls', [
  [`url${letter}`, `Link ${letter.toUpperCase()} (URL)`], [`url${letter}text`, `Link ${letter.toUpperCase()} — texto`]
])));

// Subconjunto real de attribs do article.xml com consumidor público. São
// controles de apresentação, não novas colunas de persistência.
export const ARTICLE_OPTION_FIELDS = Object.freeze([
  ['show_title', 'Exibir título'], ['link_titles', 'Título como link nas listas'],
  ['show_intro', 'Exibir introdução'], ['show_category', 'Exibir categoria'],
  ['show_author', 'Exibir autor'], ['show_publish_date', 'Exibir data de publicação'],
  ['show_tags', 'Exibir tags']
].map(([key, label]) => Object.freeze({ key, name: `attrib:${key}`, label, type: 'select', options: ['', '1', '0'] })));

export const ARTICLE_EDITOR_LIMITS = 'Imagens e links podem ser inseridos no texto pelo editor; a aba Advanced da janela de imagem permite espaçamento horizontal/vertical em pixels (margens públicas de 0 a 200 px). Imagem de introdução/artigo, legendas e links A/B/C ficam na aba Imagens e links. Campos personalizados, Schema.org, permissões/ACL, associações, usuários, configuração de edição por usuário e histórico de versões não são implementados.';

export const CATEGORY_FIELDS = [
  { name: 'title', label: 'Título', type: 'text', required: true },
  { name: 'alias', label: 'Alias', type: 'text', required: true },
  { name: 'parentId', label: 'Categoria pai', type: 'select', relation: 'categories', valueField: 'id', labelField: 'title', valueType: 'number', emptyOptionLabel: '— nenhuma (raiz) —', excludeSelf: true },
  { name: 'description', label: 'Descrição (texto simples, sem formatação)', type: 'textarea' },
  { name: 'state', label: 'Estado', type: 'select', options: ['Published', 'Unpublished', 'Trashed'] }
];

export const TAG_FIELDS = [
  { name: 'name', label: 'Nome', type: 'text', required: true },
  { name: 'alias', label: 'Alias', type: 'text' },
  { name: 'parentId', label: 'Tag pai', type: 'select', relation: 'tags', valueField: 'id', labelField: 'name', valueType: 'number', emptyOptionLabel: '— nenhuma (raiz) —', excludeSelf: true },
  { name: 'description', label: 'Descrição (texto simples, sem formatação)', type: 'textarea' },
  { name: 'state', label: 'Estado', type: 'select', options: ['Published', 'Unpublished', 'Trashed'] }
];

export const MENU_FIELDS = [
  { name: 'title', label: 'Título', type: 'text', required: true },
  { name: 'menuType', label: 'Tipo de item de menu', type: 'select', required: true },
  { name: 'targetCategory', label: 'Categoria', type: 'select', relation: 'categories', valueField: 'alias', labelField: 'title', emptyOptionLabel: '— selecione —' },
  { name: 'targetArticle', label: 'Artigo', type: 'select', relation: 'articles', valueField: 'alias', labelField: 'title', emptyOptionLabel: '— selecione —' },
  { name: 'targetTag', label: 'Tag', type: 'select', relation: 'tags', valueField: 'name', labelField: 'name', emptyOptionLabel: '— selecione —' },
  { name: 'targetUrl', label: 'URL externa (http:// ou https://)', type: 'text' },
  { name: 'path', label: 'Caminho gerado', type: 'text', readOnly: true },
  { name: 'parentId', label: 'Item pai', type: 'select', relation: 'menu', valueField: 'id', labelField: 'title', valueType: 'number', emptyOptionLabel: '— nenhum (nível superior) —', excludeSelf: true },
  { name: 'published', label: 'Publicado', type: 'select', options: ['Published', 'Draft'] },
  { name: 'ordering', label: 'Ordem', type: 'number' }
];

export const EXTENSION_FIELDS = [
  { name: 'title', label: 'Título', type: 'text', required: true },
  { name: 'key', label: 'Chave única', type: 'text', required: true, readOnly: true },
  { name: 'type', label: 'Tipo', type: 'text', readOnly: true },
  { name: 'entryPointUrl', label: 'URL do módulo ES (entrypoint)', type: 'text', required: true, readOnly: true },
  { name: 'discoveredFrom', label: 'Descoberto a partir de', type: 'text', readOnly: true },
  { name: 'enabled', label: 'Habilitado', type: 'checkbox' }
];

export const MODULE_INSTANCE_FIELDS = [
  { name: 'title', label: 'Título da instância', type: 'text', required: true },
  { name: 'extensionKey', label: 'Extensão', type: 'select', relation: 'extensions', valueField: 'key', labelField: 'title', required: true, emptyOptionLabel: '— selecione —' },
  { name: 'position', label: 'Posição', type: 'select', options: ['topbar', 'below-top', 'menu', 'search', 'banner', 'breadcrumbs', 'top-a', 'top-b', 'main-top', 'sidebar-left', 'sidebar-right', 'main-bottom', 'bottom-a', 'bottom-b', 'footer', 'sidebar', 'content'] },
  { name: 'ordering', label: 'Ordem', type: 'number' },
  { name: 'settingsText', label: 'Configurações (JSON)', type: 'textarea' },
  { name: 'enabled', label: 'Habilitado', type: 'checkbox' },
  { name: 'scopeKind', label: 'Escopo', type: 'select', options: ['All', 'Route'] },
  { name: 'scopeRoute', label: 'Rota (quando escopo = Route)', type: 'select', options: ['', 'home', 'category', 'article', 'search', 'archive'] },
  { name: 'scopeCategoryAlias', label: 'Alias da categoria (quando rota = category)', type: 'text' }
];

/*
 * `tab`: agrupa os campos em abas (equivalente visual às abas "Site" /
 * "Sistema" / "Servidor" do com_config real do Joomla — aqui reduzidas
 * às únicas duas que têm sentido dentro do escopo do MINIJOOMLA, mais
 * uma própria para o HTML personalizado; nunca uma aba "Permissões",
 * que pertence a ACL, fora de escopo). Campos sem `tab` caem na
 * primeira aba declarada. Quem monta a tela (render-form.js) só agrupa
 * pela ordem de primeira ocorrência — a ordem das abas nasce da ordem
 * dos campos aqui, não de uma lista separada.
 */
export const SITE_CONFIG_FIELDS = [
  { name: 'siteName', label: 'Nome do site', type: 'text', tab: 'Site' },
  { name: 'templateKey', label: 'Template ativo', type: 'select', relation: 'templates', tab: 'Site' },
  { name: 'siteDescription', label: 'Descrição do site (texto simples, sem formatação)', type: 'textarea', tab: 'Site' },
  { name: 'language', label: 'Idioma (ex.: pt-BR)', type: 'text', tab: 'Site' },
  { name: 'timezone', label: 'Fuso horário (ex.: America/Sao_Paulo)', type: 'text', tab: 'Site' },
  { name: 'basePath', label: 'Caminho base', type: 'text', tab: 'Sistema' },
  { name: 'pageSize', label: 'Itens por página', type: 'number', tab: 'Sistema' },
  { name: 'customHtmlTitle', label: 'HTML personalizado — título', type: 'text', tab: 'HTML personalizado' },
  { name: 'customHtmlBody', label: 'HTML personalizado — conteúdo', type: 'richtext', tab: 'HTML personalizado' },
  { name: 'homeView', label: 'Página inicial exibe', type: 'select', options: ['category', 'featured'], tab: 'Página inicial' },
  { name: 'homeCategory', label: 'Alias da categoria da página inicial', type: 'text', tab: 'Página inicial' },
  { name: 'offline', label: 'Site offline (manutenção)', type: 'checkbox', tab: 'Offline' },
  { name: 'offlineMessage', label: 'Mensagem de site offline', type: 'textarea', tab: 'Offline' },
  { name: 'metaDescription', label: 'Meta descrição do site (indisponível)', type: 'textarea', tab: 'Metadados', readOnly: true },
  { name: 'metaKeywords', label: 'Meta palavras-chave (indisponíveis)', type: 'textarea', tab: 'Metadados', readOnly: true },
  { name: 'robots', label: 'Robots (indisponível)', type: 'select', options: ['', 'index, follow', 'noindex, follow', 'index, nofollow', 'noindex, nofollow'], tab: 'Metadados', readOnly: true },
  { name: 'sitenamePagetitles', label: 'Nome do site no título (indisponível)', type: 'select', options: ['none', 'before', 'after'], tab: 'Metadados', readOnly: true }
];

export const TEMPLATE_FIELDS = [
  { name: 'title', label: 'Título', type: 'text', required: true },
  { name: 'key', label: 'Chave única', type: 'text', required: true, readOnly: true },
  { name: 'version', label: 'Versão', type: 'text', required: true },
  { name: 'entryPointUrl', label: 'Entrypoint ES do template', type: 'text', required: true, readOnly: true },
  { name: 'styles', label: 'Folhas de estilo (array JSON de URLs)', type: 'textarea' },
  { name: 'positionsText', label: 'Posições (JSON)', type: 'textarea', required: true },
  { name: 'discoveredFrom', label: 'Descoberto a partir de', type: 'text', readOnly: true },
  { name: 'enabled', label: 'Habilitado', type: 'checkbox' }
];

/*
 * Catálogo de domínios administráveis (equivalente a com_content,
 * com_categories, com_tags, com_menus, com_modules do Joomla real —
 * com_config é tratado separadamente por ser linha única, não uma
 * listagem). `idField` é sempre "id" (convenção de todos os schemas
 * SPMIDDLE deste projeto); `titleField` escolhe qual campo identifica a
 * linha numa listagem/confirmação.
 */
export const ADMIN_DOMAINS = Object.freeze({
  articles: { label: 'Artigos', fields: ARTICLE_FIELDS, titleField: 'title' },
  categories: { label: 'Categorias', fields: CATEGORY_FIELDS, titleField: 'title' },
  tags: { label: 'Tags', fields: TAG_FIELDS, titleField: 'name' },
  menu: { label: 'Menus', fields: MENU_FIELDS, titleField: 'title' },
  extensions: { label: 'Extensões', fields: EXTENSION_FIELDS, titleField: 'title' },
  moduleInstances: { label: 'Módulos', fields: MODULE_INSTANCE_FIELDS, titleField: 'title' },
  templates: { label: 'Templates', fields: TEMPLATE_FIELDS, titleField: 'title' }
});

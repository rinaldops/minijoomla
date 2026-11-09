# MINIJOOMLA — inventário e matriz de equivalência Joomla

> **Escopo vigente posterior:** prioridade no fechamento dos recursos padrão
> Joomla-like já acordados; Videoteca/Forum e expansão externa suspensos.
> A matriz abaixo conserva fases/históricos e não mede paridade integral.
> Os seis blocos nativos restantes estão no topo do plano de continuidade.

> Esta matriz registra a fase 1 e mantém suas afirmações históricas. O estado
> atual, incluindo integração SharePoint anterior e lacunas da expansão local,
> está no [handoff](HANDOFF-DESENVOLVIMENTO.md) e no
> [plano de continuidade](PLANO-CONTINUIDADE-MINIJOOMLA.md).

**Fase:** 1 — fundação local e contratos fake
**Status:** fase local aceita; zoom/alto contraste real e integração SharePoint
 permanecem explicitamente fora do aceite concluído
**Fonte de escopo:** `PROMPT-DESENVOLVIMENTO-MINIJOOMLA.md`
**Limite:** nenhuma integração real com SharePoint, `Preview.aspx` ou
`Default.aspx` faz parte desta fase.

## Atualização da matriz — 05/11/2026

Registro adicional; as matrizes históricas abaixo não foram reescritas.
Verificação: **E2E** = no tenant `rinaldops.sharepoint.com/sites/camap-agp`
(release 0.4.5); **local** = suítes automatizadas (52 suítes, 0 falhas).

| Área | Estado | Observação |
| --- | --- | --- |
| Artigo: bloco de informações, imagens de introdução/completa, links A/B/C | Presente | local + E2E |
| Layouts blog e lista, destaques, índice de categorias, página de tag, lista de tags, filtro de arquivo, paginação, impressão | Presente | local + E2E |
| Módulos: login (somente sessão do host), articles-categories, related-items, footer, articles | Presente | login não autentica por conta própria |
| Admin: lista de artigos com filtros, ordenação, lixeira, lote, duplicar | Presente | local + E2E |
| Admin: abas de imagens, links e metadados; categorias aninhadas e tags com estado; seletor de tipo de item de menu; gerenciador de mídia | Presente | local + E2E |
| Plugins nativos e eventos de exibição/gravação | Presente | habilitação via linhas `native:<key>` |
| i18n / arquivos de idioma | Ausente | textos fixos |
| SEF com caminhos | Parcial | só rotas hash; a página é hospedada pelo SharePoint |
| com_contact, com_banners, com_newsfeeds, com_fields, com_workflow | Ausente | |
| com_finder (índice), com_redirect | Ausente | |
| Versões/histórico de conteúdo, check-in | Ausente | |
| mod_articles_popular | Ausente | não há dados de acessos |
| mod_feed | Ausente | sem contrato |
| ACL | Ausente por desenho | |

## 1. Objetivo e princípio de equivalência

### Rodada integrada de fechamento — 03/11/2026

Esta atualização prevalece sobre lacunas históricas já resolvidas abaixo.
As 14 capturas de `../JOOMLA/prints` foram inventariadas e lidas por OCR local;
não foi possível interpretar seus pixels nesta sessão. XML oficial de artigos
e Schema.org foi consultado como referência, sem copiar implementação PHP.

| Área | Entrega comprovada | Limite explícito |
| --- | --- | --- |
| Editor | Conteúdo, Opções e Publicação; opções individuais efetivas, autor/alias/idioma, agendamento, readmore/upload/ETag, relatório local de acessibilidade | Não reproduz as oito abas Joomla: imagens/links ficam no texto; sem campos A/B/C, Schema.org, ACL, usuários, histórico ou configuração por usuário |
| Imagem no texto | `image_advtab: true`; janela nativa com Vertical/Horizontal space; 12/16 px salvos, reabertos e calculados no DOM público | Somente margens de 0–200 px; float, bordas e CSS livre não são preservados pelo sanitizador |
| Módulos | Chrome/título, atribuições, agenda, lote/lixeira e remoção autoritativa | Conversão assistida de escopo legado não existe; legado/unlisted preservados |
| Plugins | Refresh de params/order/url, lifecycle e cache, snapshots profundamente congelados | Hooks pendentes não têm timeout; URL imutável nova para código novo; filtros iniciados terminam com snapshot anterior |
| Administração | Corrupção/indisponibilidade bloqueia formular defaults e escrita; SEO/tags sem consumidor desabilitados | Não é ACL; permissões permanecem SharePoint |
| Templates | Atum/Cassiopeia adequados à paleta institucional, CAMAP com hero h2; matriz DOM 320/768/1366/1920, laterais vazias/preenchidas e um h1 | Skin TinyMCE intacta; OCR/DOM não são equivalência visual pixel a pixel |
| Acessibilidade | Foco/skip, menus Enter/Escape e tabs Arrow/Home/End/Tab/Shift+Tab no Edge via FIORI-AUTO | Zoom CSS não é zoom real; forced-colors/media e leitores de tela não aceitos integralmente |
| Persistência | Oito entidades, schema anterior/atual, ETags, falhas parciais/retomada e undo local | Sem transação/rollback de schema, teste destrutivo no tenant ou garantia de índices/tipos existentes |

Ver os limites e resultados mais recentes no
[handoff](HANDOFF-DESENVOLVIMENTO.md). Publicação de assets/canvas não equivale
a aceite de escrita de todos os formulários no tenant.

O MINIJOOMLA reproduz somente comportamentos públicos e genéricos do Joomla
necessários à instalação minimalista. “Equivalente” significa compatibilidade de
conceito, fluxo e contrato de apresentação; não significa copiar código, ativos,
nomes de sites corporativos ou implementar toda a plataforma Joomla.

A fronteira da fase é:

```text
fake data/fixtures → adapter local → casos de uso → view models
→ componentes/módulos → shell/template
```

Componentes e templates não conhecem SharePoint, REST, listas `mse*`, ETags,
URLs internas, cookies ou detalhes de autenticação. ACL, permissões editoriais e
administração de usuários ficam explicitamente fora do escopo.

## 2. Inventário da primeira fase

| Área | Equivalente Joomla de referência | Entrega/contrato da fase 1 | Evidência mínima de aceite |
| --- | --- | --- | --- |
| Bootstrap | núcleo da aplicação e ciclo de vida | inicialização configurável, registro de serviços, montagem do shell e eventos de início/fim | aplicação inicia com fixture local, sem rede, e finaliza sem erro |
| Shell/template | template, posições de módulo e layout geral | estrutura responsiva com header, navegação, área de conteúdo, posições de módulos, mensagens e footer | renderização consistente em estados normal, loading, vazio, erro e 404 |
| Router | URLs amigáveis e roteamento de componentes | rotas para artigo, categoria e fallback 404; parâmetros validados e navegação interna | rota válida, rota inexistente, alias inválido, query de paginação e back/forward testados |
| Módulos | extensões de apresentação posicionáveis | registro, seleção por posição, ordem, ativação/configuração e ciclo de renderização | módulo fake isolado pode ser incluído/removido sem alterar o template |
| `com_content` | componente de conteúdo | leitura de artigo, lista/blog de categoria, filtros editoriais aplicáveis, ordenação e paginação | view model estável para artigo e categoria com fixture fake |
| Categorias | hierarquia de categorias | contrato de categoria pai/filha, resolução por alias/id e filtragem de artigos | categoria existente, vazia, hierárquica e inexistente cobertas |
| Tags | relações artigo-tag | contrato de tags e associação; suporte mínimo para exibição/filtro | artigo com zero, uma e várias tags; relação ausente não quebra a tela |
| Menus | menu principal, secundário e de acesso | itens declarativos com rota, label, ordem, estado ativo e destino interno | menus e breadcrumbs apontam para rotas válidas e são acessíveis por teclado |
| Contratos fake | camada de dados substituível | serviços/ports locais para conteúdo, categorias, tags e menus; fixtures determinísticas | testes executam sem rede e podem trocar fixture por fake alternativo |
| Testes | cobertura dos fluxos públicos | unitários de router/contratos/view models/módulos e integração local do shell | comando de testes reproduzível; falhas apontam contrato ou fluxo específico |

### 2.1 Contratos funcionais mínimos

O contrato de módulos da fase é declarativo e neutro: cada definição deve
expor `name`, `settings`, opcionalmente `settingsSchema`, `position`, `order`,
`enabled` e `render(context)`. O registry seleciona módulos por posição,
ordena-os de forma determinística e ignora entradas desabilitadas. Loaders
futuros devem entregar estados `idle`, `loading`, `ready`, `empty` ou `error`;
nenhuma configuração pode executar JavaScript arbitrário.

Os contratos devem ser assíncronos mesmo quando o fake for síncrono, para não
criar uma incompatibilidade artificial com um adapter futuro. Os nomes abaixo
são semânticos; a implementação pode escolher outra nomenclatura, desde que
mantenha a mesma responsabilidade e tipagem documentada.

```text
ContentService
  getArticle(ref, options) -> Article | NotFound
  listArticles(query) -> Page<Article>

CategoryService
  getCategory(ref) -> Category | NotFound
  listCategories(query) -> Category[]

TagService
  listTags(query) -> Tag[]
  listArticlesByTag(tagRef, query) -> Page<Article>

MenuService
  getMenu(name) -> Menu
```

Todo resultado deve declarar estado de ausência, paginação quando aplicável e
erros de domínio sem vazar detalhes de transporte. `Article`, `Category`, `Tag`,
`Menu` e `Page` são view/data contracts neutros; não devem conter objetos de
SharePoint nem propriedades de infraestrutura. O contrato deve acomodar, quando
necessário, título, alias, resumo/texto, imagem segura, autor textual,
categoria, tags, estado editorial, datas, destaque, itens de menu e relação
hierárquica.

## 3. Matriz de equivalência detalhada

### 3.1 Núcleo, shell e router

| Capacidade Joomla-like | MINIJOOMLA fase 1 | Estado | Lacuna/limite |
| --- | --- | --- | --- |
| Bootstrap | composição de dependências e inicialização local | incluído | não há provisioning nem configuração remota |
| Template | shell com posições nomeadas (`header`, `navigation`, `content`, `sidebar`, `footer`) | incluído | sem cópia de template proprietário; identidade visual deve seguir as regras do workspace |
| Navegação | links internos e estado ativo | incluído | sem publicação, histórico de URL externo ou ACL |
| URLs amigáveis | aliases e parâmetros de rota | incluído | regras devem ser definidas sem assumir IIS/SharePoint |
| 404 | estado de rota não encontrada | incluído | não substitui página de erro do host |
| Loading/erro/vazio | estados explícitos em shell, componente e módulo | incluído | mensagens não podem revelar detalhes de backend |
| Breadcrumbs | módulo derivado da rota/hierarquia | incluído | item raiz ("Início") e cada categoria ancestral são links reais; só a página atual (último item) fica como texto com `aria-current`, igual ao Joomla real (`mod_breadcrumbs/tmpl/default.php`) |
| Configuração de site | título, descrição, idioma, fuso e metadados como configuração local | parcial | sem configuração por tenant e sem armazenamento persistente |

### 3.2 Conteúdo e taxonomia

| Capacidade Joomla-like | MINIJOOMLA fase 1 | Estado | Critério específico |
| --- | --- | --- | --- |
| Artigo individual | `com_content` + rota de artigo | incluído | alias resolve artigo; artigo ausente apresenta estado controlado |
| Blog de categoria | consulta paginada + cards/itens de artigo | incluído | categoria, ordenação e página aparecem no view model |
| Lista de artigos | `listArticles` com filtros seguros | incluído | limite de página e parâmetros inválidos têm fallback previsível |
| Categoria hierárquica | `parentId`/referência equivalente e filhos | incluído | ciclos e referências órfãs são rejeitados pelo contrato fake |
| Tags | relações many-to-many e filtro | incluído | tags desconhecidas não causam erro de renderização |
| Estado editorial | publicado/draft/arquivado e janela de publicação | parcial | primeira fase cobre leitura determinística; autorização de edição não existe |
| Destaque | atributo de artigo para filtro/ordenação | incluído | filtro `featured` em `listArticles`, consumido pelo módulo `mod_articles_news`; sem painel editorial |
| Busca | rota `#/search`, consulta textual paginada e formulário acessível | incluído | indexação avançada e módulo `mod_search` completo ficam para onda posterior |
| Sanitização | fronteira de segurança antes da renderização | requisito | HTML/URL/atributos precisam ser sanitizados; nunca usar conteúdo não confiável diretamente |

### 3.3 Módulos

Cada módulo deve declarar `name`, `settingsSchema`, posição, view model,
renderização e estados `loading`, `empty` e `error`. A configuração é
declarativa e validada; não permite JavaScript arbitrário.

| Módulo Joomla de referência | Escopo da fase 1 | Estado |
| --- | --- | --- |
| `mod_menu` | alimentado por `MenuService`, com item ativo e estados vazios | incluído |
| `mod_breadcrumbs` | derivado do router e das categorias/menus | incluído |
| `mod_articles_latest` | contrato, fixture e consumo no sidebar do shell | incluído |
| `mod_articles_news` | view compacta de artigos selecionados | incluído; lista compacta por `featured`, limite seguro, sem indexação avançada |
| `mod_articles_category` | lista filtrada por categoria | incluído junto do fluxo de categoria |
| `mod_articles_archive` | agrupamento temporal de arquivados | incluído; `listArchive`/`listArticles({year, month})` em ambos os adapters, rota `#/archive`, módulo no sidebar |
| `mod_tags_popular` | agregação por contagem de tags e consumo no sidebar do shell | incluído |
| `mod_tags_similar` | artigos relacionados por tags em comum, exibidos na rota de artigo | incluído; ordenação por nº de tags compartilhadas e data, sem indexação avançada |
| `mod_search` | interface e contrato de busca na rota dedicada | incluído; indexação avançada permanece futura |
| `mod_login` | somente sessão simulada/configurável, se necessária ao shell | opcional; sem autenticação real |
| HTML personalizado | conteúdo sanitizado, sem script | incluído; `customHtmlModule` (`src/libraries/minijoomla/modules/content-runtime.js`), configurado via `config.customHtml` (`src/libraries/minijoomla/core/config.js`), reaproveitando `sanitizeHtml` já usado por `renderArticle` |
| Feed | somente com contrato explícito | fora da fase 1 |

### 3.4 Plugins e eventos

`src/libraries/minijoomla/plugins/manager.js` (`createPluginManager`) implementa a API de
plugins exigida pelo prompt de desenvolvimento: registro declarativo
(`register({ name, events })`, nunca uma string/script avaliado),
`onContentPrepare` (filtro de texto de artigo antes da sanitização final —
também é o ponto de extensão para filtros de link dentro do corpo, já que
links de conteúdo são HTML nesse mesmo texto), `onSearchPrepare` (filtro do
termo de busca, equivalente ao ponto de extensão de
indexação/busca do prompt), e `onAppInit`/`onAppFinalize` (inicialização e
finalização da aplicação). `createApplication` aceita `plugins: []` e
invoca os quatro pontos de extensão nas rotas de artigo/busca e no
`start()`/`stop()`; um plugin sem handler para um evento é ignorado
nesse evento, e um handler que lança erro não interrompe a cadeia nem a
renderização (mesmo princípio já usado pelo registry de módulos).

### 3.5 Painel administrativo (extensão pós-fase 1, 01/11/2026)

> Fora do escopo original da "Fase 1" descrita no topo deste documento —
> adicionado por pedido explícito do usuário após a conclusão do Marco D,
> modelado no `administrator/` real do Joomla (comportamento/conceito,
> nunca código PHP literal), cobrindo a estrutura completa do admin Joomla
> **exceto ACL** (nunca `com_users`, nunca upload/execução de código do
> `com_installer`). Implementado como app separado (`src/administrator/components/com_minijoomla/`), nunca
> compartilhando página/router com o app público.

| Capacidade Joomla admin de referência | MINIJOOMLA | Estado |
| --- | --- | --- |
| `com_content` (gerenciar artigos) | `src/administrator/components/com_minijoomla/` área "Artigos", CRUD via `admin-service.js` | incluído |
| `com_categories` | área "Categorias" | incluído |
| `com_tags` | área "Tags" | incluído |
| `com_menus` | área "Menu" | incluído |
| `com_config` (configuração do site) | área "Configuração", upsert de linha única (`MiniJoomlaSiteConfig`) | incluído |
| `com_modules` (instâncias de módulo, multi-instância, escopo) | área "Instâncias de módulo" (`MiniJoomlaModuleInstances`); escopo por rota + alias de categoria opcional, não lista arbitrária de páginas | incluído, com granularidade reduzida de propósito |
| Tela "Discover" (descoberta de extensão sem instalador) | `extension-discovery-service.js`, varre pasta convencional `extensions/`, nunca executa/instala — equivalente ao Discover real, nunca ao fluxo de upload do `com_installer` | incluído |
| `com_installer` (upload/instalação de extensão) | não implementado, de propósito — arquitetonicamente incompatível com uma SPA hospedada em SharePoint e com a regra "nunca executar JavaScript arbitrário vindo de conteúdo/config" | fora do escopo, permanentemente |
| `com_users`/ACL | não implementado | fora do escopo, por decisão explícita do usuário |
| Carregamento dinâmico de módulo/plugin descoberto | `src/libraries/minijoomla/modules/dynamic-modules.js` (`createExtensionLoader`/`resolveModuleEntries`), estritamente aditivo — zero `import()` extra quando nenhuma instância/extensão é informada à aplicação pública | incluído |

**Dois achados reais do tenant** (nunca exercitados por nenhum trabalho
anterior, só descobertos ao validar o painel contra o SharePoint real) —
documentados em `docs/INTEGRATION-SPMIDDLE.md` §12 e
`docs/CHECKLIST-CONCLUSAO-MINIJOOMLA.md` §8.2: `findMany()` do SPMIDDLE
nunca anexa ETag (só `findById`/`create`/`update`); e o campo customizado
`Author` colide com o campo de sistema nativo "Created By" do SharePoint,
sendo silenciosamente renomeado para `Author0` pelo próprio tenant.

### 3.6 Fidelidade visual do painel administrativo ao Atum real (01-02/11/2026)

> Decisão explícita do usuário: o painel administrativo deve se parecer o
> mais próximo possível do `administrator/` real do Joomla — cores,
> tipografia e estrutura visual preservadas, consultando
> `web-devs/JOOMLA/` como fonte de verdade (nunca cópia literal de
> PHP/SCSS). A adequação à identidade visual Petrobras fica reservada ao
> TEMPLATE DO SITE PÚBLICO (`src/media/templates/site/cassiopeia/css/template.css`), nunca a este
> painel. Detalhe completo em `docs/INTEGRATION-SPMIDDLE.md` §15.

Reconstruído `src/media/templates/administrator/atum/css/template.css`/`src/administrator/components/com_minijoomla/icons.js` com a
estrutura/paleta REAIS do template Atum: header + sidebar na mesma
família de azul-marinho (`#132f53`), toolbar/tabela com fundo claro,
badges de estado pequenos com ícone (nunca "pills" sólidos), botões com
cor só até o hover (verde para ações positivas, azul para
navegação/cancelar, vermelho real `#c52827` para exclusão/erro — única
exceção documentada à regra geral de paleta Petrobras, restrita a este
painel administrativo), tipografia `Roboto`. Ícones SVG próprios
reconstroem a mesma silhueta dos ícones Font Awesome 6 reais usados pelo
Atum, sem vendorizar a biblioteca. Publicado e validado contra o tenant
real (`Administrator.aspx`); também adicionados seletores relacionais em
formulários (categoria/extensão como `<select>` real, tags como
multiselect), confirmação de exclusão, busca/paginação em listagens e
abas ARIA na configuração do site.

### 3.7 Correção estrutural do painel administrativo: sidebar em árvore, cpanel agrupado (02/11/2026)

> Achado real do usuário: §3.6 corrigiu cor/tipografia mas não a
> ESTRUTURA — comparação com capturas de tela reais do painel de um
> Joomla 6.2.0 administrado pelo usuário revelou 3 divergências
> estruturais (sidebar plana em vez de árvore; badges com texto em vez
> de ícone circular; cpanel sem agrupamento). Detalhe completo em
> `docs/INTEGRATION-SPMIDDLE.md` §16.

Sidebar reescrita como árvore de 2 níveis (`has-arrow`/`mm-collapse`,
mesmo vocabulário do `mod_menu` real), com "Tags" em "Componentes"
(replicando a ausência real de `com_tags` no preset de menu real, não
uma posição inventada). Painel de controle reescrito como cards
ícone-acima/texto-abaixo agrupados em "Site"/"Sistema", seguindo a
classificação real de `QuickIconHelper.php`. Indicadores de estado
(publicado/destaque/habilitado) reescritos como ícone circular sem
texto visível (`.admin-state-icon`, 26px — mesma medida do
`.tbody-icon` real), com nova cor `--atum-featured: #c78800` para
destaque. Validado localmente (116 testes + inspeção DOM ao vivo);
republicado e revalidado no tenant real em 02/11/2026.

### 3.8 Editor de texto rico real (TinyMCE) e correção de dois bugs visuais reais (02/11/2026)

> Prioridade alta reportada pelo usuário em supervisão: sem recursos
> de formatação (negrito/itálico/listas), o usuário ficava obrigado a
> digitar HTML cru nos campos de texto do admin, o que invalidaria o
> uso prático do painel. Detalhe completo em
> `docs/INTEGRATION-SPMIDDLE.md` §17.

TinyMCE 7.9.1 self-hosted real (licença GPL-2.0-or-later, a mesma do
`plg_editors_tinymce` do Joomla) vendorizado em
`src/media/vendor/tinymce/` (árvore minimal ~1.24 MB, só os arquivos
do preset "simple" real do plugin: bold/underline/strikethrough,
undo/redo, bullist/numlist). Aplicado só aos dois campos que o site
público trata como HTML real (`fulltext` de Artigos,
`customHtmlBody` da configuração) — confirmado por varredura de todo
`sanitizeHtml(` no código, nunca a `introtext`/`description`/
`siteDescription`, que o site público trata como texto puro.
Corrigidos também dois bugs visuais reais encontrados na mesma
supervisão (`.visually-hidden` nunca definido em `admin.css`; links
de nível 2 da sidebar sem cor branca por um seletor CSS incompleto) e
um terceiro encontrado durante a própria validação do editor (uma
instância dentro de uma aba oculta nascia com 0×0 de dimensão e nunca
se recalculava — corrigido adiando a inicialização até a aba ser
revelada). 23 testes novos/atualizados, validado ao vivo via
FIORI-AUTO contra `examples/admin.html`.

## 4. Lacunas, dependências e decisões

### Inventário de continuidade — 03/11/2026

Revisão de código local para o item §3.2 do plano de continuidade; não é
aprovação visual nem validação de dados no tenant. Referências Joomla abaixo
foram consultadas somente para comparar conceitos, sem copiar implementação.

| Superfície | Referência em `../../JOOMLA/` | Consumidor MINIJOOMLA | Diferenças e limites observados |
| --- | --- | --- | --- |
| Artigo | `components/com_content/tmpl/article/default.php` | `src/components/com_content/tmpl/article/default.js`, `renderArticle` | Título, autor/data, tags e intro/corpo sanitizados; sem ACL, edição pública, associações multilíngues ou todos os eventos de apresentação Joomla. `showIntro=false` pode ocultar todo o conteúdo de um artigo sem quebra “Leia mais”; requer revisão do contrato antes de alterar. |
| Categoria/blog | `components/com_content/tmpl/category/blog.php` | `src/components/com_content/tmpl/category/default.js`, `renderArticleList` | Título/descrição e lista paginada; não há divisão entre artigos principais, introdutórios e links, grade configurável ou navegação de subcategorias na página. Descrição é texto escapado, não HTML preparado por plugins. |
| Destaques/home | `components/com_content/tmpl/featured/default.php` | ramo `home` de `src/index.js` | Consulta por categoria ou destaque conforme configuração; reutiliza lista única, não todas as regiões e opções de blog do Joomla. |
| Busca | Formulário e consulta textual locais; sem equivalência ao índice Smart Search | `src/components/com_finder/tmpl/search/default.js` | Termo e status acessíveis, paginação e destaque seguro de título; sem índice, ranking, facetas ou realce no HTML do corpo. Corrigida a passagem agrupada das opções pela rota e a conversão na demo; desligar/reativar destaque foi comprovado após gravação e releitura, inclusive em DOM nativo local. |
| Arquivo | `components/com_content/tmpl/archive/default.php` | `src/components/com_content/tmpl/archive/default.js`, módulo `articles-archive` | Links por mês/ano e lista paginada; sem formulário Joomla de filtro por título/mês/ano/limite. |
| Tags | `modules/mod_tags_popular/tmpl/default.php` | `renderTags`, módulo `tags-popular` | Exibição/contagem e links para busca textual; isso **não equivale** a uma página dedicada filtrada pela identidade da tag. |
| Menus | `modules/mod_menu/tmpl/default.php` | `src/modules/mod_menu/tmpl/default.js` | Hierarquia, ordem, trilha ativa e controles de submenu próprios; sem todos os tipos de item, níveis configuráveis, ACL ou associações do Joomla. |
| Breadcrumbs | `modules/mod_breadcrumbs/tmpl/default.php` | `breadcrumbsModule`, `src/index.js` | Raiz/ancestrais navegáveis e página atual sem link; a política implementada é coberta localmente. |

As diferenças são inventário, não autorização para implementar indiscriminadamente
todos os recursos do Joomla. Priorizar defeitos demonstráveis nas páginas atuais;
novos contratos de tags, blog ou apresentação exigem escopo e aceite definidos.

### Lacunas conhecidas

1. ~~Não há definição final de API pública dos serviços, esquema de erro ou
   convenção de `ref` (id, alias ou objeto)~~ — resolvido: contrato
   congelado em `docs/CONTRACTS-MINIJOOMLA.md`, verificado pela suíte de
   conformidade `tests/adapter-contract.test.js`.
2. ~~Indexação avançada, plugins/eventos completos, feed, edição, upload e
   ACL não são entregas da fase 1~~ — a API de plugins (`onContentPrepare`/
   `onSearchPrepare`/`onAppInit`/`onAppFinalize`, §3.4) e `mod_articles_archive`/
   HTML personalizado (§3.3) foram implementados; indexação avançada
   (ranking/relevância de busca), feed, edição, upload e ACL continuam fora
   da fase 1.
3. A acessibilidade visual precisa ser verificada em viewport 320, 768, 1366 e
   1920 px, zoom e alto contraste; não há aprovação visual implícita nesta
   matriz.
4. O fuso, idioma e serialização de datas devem ser normalizados no contrato,
   sem depender do relógio ou locale da máquina de teste.

### Dependências obrigatórias

- JavaScript moderno com módulos ES e dependências mínimas.
- Runner de testes determinístico e comando documentado no README do projeto.
- Fixtures locais versionadas, pequenas e sem dados pessoais ou corporativos.
- Sanitizador/validador de HTML, URLs, limites de texto, listas e paginação.
- Contratos de serviço injetáveis, com fake sem acesso de rede.
- Tokens e regras de identidade visual de `web-devs/docs/IDENTIDADE-PETROBRAS.md`:
  branco predominante, cores autorizadas, contraste WCAG e superfícies
  estruturais com cantos retos.

## 5. Critérios de aceite da fase 1

- [x] A matriz foi revisada e cada item implementado aponta para teste ou
  evidência local; itens não implementados permanecem marcados como lacuna.
- [x] O shell monta header, navegação, conteúdo, posições de módulo e footer,
  incluindo loading, vazio, erro e 404.
- [x] Router cobre artigo, categoria, parâmetros, alias inválido e fallback;
  navegação interna não exige reload indevido.
- [x] Existe ao menos uma página de artigo e uma página de categoria usando
  exclusivamente fake contracts.
- [x] Artigos, categorias, tags e menus têm fixtures e contratos sem tipos de
  SharePoint; ordenação, paginação e janelas de publicação são testáveis.
- [x] Módulos são registráveis/configuráveis, possuem view model e não têm
  dependência do template concreto ou de rede.
- [x] Testes cobrem rotas, estados, menus/breadcrumbs, filtros, paginação,
  sanitização, teclado e execução sem rede.
- [ ] Layout e conteúdo respeitam teclado, foco, zoom, contraste e larguras
  320/768/1366/1920 px.
- [ ] `git diff --check` passa e o working tree contém somente as alterações
  intencionais da entrega.
- [x] Não houve publicação, alteração em `Preview.aspx`/`Default.aspx` ou
  criação de dados editoriais permanentes.

## 6. Rollback da fase 1

O rollback é local e reversível:

1. identificar o commit da fase no histórico do repositório;
2. parar o uso do pacote/artefato local da fase e preservar logs de testes;
3. voltar o consumidor ao commit anterior conhecido, ou remover somente os
   arquivos da fase por um commit de reversão (`git revert <commit>`);
4. executar novamente a suíte de testes e `git diff --check`;
5. confirmar que nenhum adapter de produção, site SharePoint ou dado editorial
   foi alterado — nesta fase eles não devem existir.

Não usar reset destrutivo nem apagar fixtures compartilhadas sem verificar
referências. Qualquer futura publicação deverá ter rollback próprio, baseado em
versão imutável do pacote, e não pode ser inferida deste rollback local.

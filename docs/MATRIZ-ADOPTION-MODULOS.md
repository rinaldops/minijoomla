# Matriz de adoção dos dez módulos CAMAP

> **Separação vigente dos produtos:** Videoteca/Forum pertencem ao TD, fora
> da instalação genérica MINIJOOMLA. Esta matriz é registro histórico de análise,
> não catálogo a instalar no CMS padrão. Templates CAMAP são referência
> transitória do template externo CAMAP-V3 e serão retirados depois de concluído.

> **Expansão suspensa por steering posterior:** Videoteca e Forum não devem ser
> desenvolvidos neste momento. Foco somente no fechamento nativo Joomla-like;
> os módulos externos pendentes não bloqueiam essa fila. Preservar ensaios e
> módulos já instalados, sem remover/desabilitar por inferência. Plano vigente
> em [continuidade](PLANO-CONTINUIDADE-MINIJOOMLA.md).

> **Documentation — retomada (09/11/2026):** 24 campos preservados; fontes/notices,
> vínculo GPL e mapa de derivação materializados em 0.5.x após reprovação do mapa
> 0.4.x. Gate técnico específico e ensaio isolado no site passaram após retestes,
> sem adoção ou raiz persistida. [Ciclo e limites](CICLO-DOCUMENTATION-ISOLADO.md).
> Não é aprovação jurídica/global nem acessibilidade integral; sete módulos pendentes.
> A antiga fila Videoteca está suspensa; as duas aprovações restantes não são consumidas.

> **Showcase — atualização (09/11/2026):** 0.5.x passou no ensaio isolado público/
> admin, incluindo cinco modos, imagens e teclado contínuo. Sphere é a lista estática
> autorizada, masonry adaptativo e carousel empilhado enquanto focado; diferenças
> documentadas. [Ciclo/limites](CICLO-SHOWCASE-ISOLADO.md). Não adotado; sete módulos
> pendentes. Próximo input isolado: Documentation.

> **Recursos — atualização (09/11/2026):** 0.4.x passou no ensaio público/admin
> após falha de compacta longa em 0.3.x e reconciliação do template pelo usuário.
> UI estática honesta, aliases e formulário em memória validados. [Ciclo/limites](CICLO-RECURSOS-ISOLADO.md).
> Não adotado; sete módulos pendentes. Próximo input isolado: Showcase.

> **Home — evolução posterior (09/11/2026):** renderer/URLs/IDs corrigidos e
> reflow CSS por contêiner retestado com 0.4.0/0.4.1 nas duas páginas. 0.3.x não
> aprovada no público estreito e mantida imutável. [Ciclo/limites](CICLO-HOME-ISOLADO.md).
> Formulário/teclado em memória; Home não adotado. Sete módulos ainda pendentes;
> próximo input: Recursos, sem consumir novas raízes no host publicado.

> **Hero — evolução posterior:** pacote isolado corrigiu URLs/objetos, IDs fixos,
> textos longos e mídia ausente; ensaio no site/memória passou sem adoção ou root
> configurado. [Ciclo real e limites](CICLO-HERO-ISOLADO.md). Fonte original abaixo
> permanece intacta; sete módulos ainda não adotados.

> **Posterior — 08/11/2026:** Topsections também corrigido/adotado na 0.15.0,
> incluindo reflow de raiz estreita/texto longo. [Ciclo real](CICLO-TOPSECTIONS.md).
> Sete módulos pendentes; [capacidade](CAPACIDADE-RAIZES-XML.md) é o próximo gate.
> Fontes/pacotes antigos não foram modificados globalmente.

> **08/11/2026:** Highlights também corrigido/adotado individualmente, incluindo
> classes CSS e título horizontal em linha própria. [Ciclo real](CICLO-HIGHLIGHTS.md).
> Oito módulos continuam pendentes; riscos da fonte original abaixo não foram
> alterados globalmente. Auto sem width permanece vertical na instância gerenciada.

> **Posterior à auditoria:** primeiro editorial corrigido/adotado com pacote
> isolado 0.3.0, na release 0.13.0. [Evidências](ETAPA-2C-EDITORIAL-ADOTADO.md).
> Nove módulos continuam pendentes; helper/arquivos originais não modificados.
> Proveniência MIT da raiz comprovada apenas para o grafo mínimo editorial/
> helper/CSS; a falta de LICENSE em CAMAP2 não significa falta de licença.

Auditoria independente local, 07/11/2026. **Pacotes preparados não são módulos
instalados.** A expansão após o piloto está no escopo do coordenador; esta frente
somente inspecionou fontes/pacotes e produziu este documento. Nenhuma alteração
em CAMAP2, núcleo, testes, ferramentas, host ou registros; nenhuma publicação,
rede, navegação ou build. A release administrativa `0.11` e o aceite de UI do
piloto pertencem ao coordenador; não foram revalidados por esta auditoria.

## Resultado e significado dos gates

Os dez módulos têm contrato JavaScript síncrono e XML preparável no perfil atual.
**Todos são candidatos a preparação/aceitação delimitada**, não a exposição de
dados arbitrários. Importar o mesmo helper não torna todos os módulos inutilizáveis:
o risco depende dos campos efetivamente consumidos e da configuração recebida.

- **URL:** os dez usam `safeUrl` em caminhos de render reais. O filtro atual
  permite destinos que a política do núcleo recusa. Bloqueia aceitação de URLs
  não revisadas, não uma fixture fechada com fragmentos locais revisados.
- **Schema:** XML valida o tipo externo array/objeto, não contratos de cada item.
  A revisão/validação adicional abaixo é gate de dados, **não recurso já
  implementado no XML**. Três módulos simples quebram com itens `null`.
- **Direitos:** todos os planos continuam com `sourceLicensePresent:false`,
  `rightsApproved:false`, `publicationApproved:false`. Falta comprovação legal;
  não há autorização de distribuição derivada desta matriz.
- **Aceite real:** piloto, instalação individual, edição, habilitação,
  atualização/reversão, CSS e persistência precisam de evidências do coordenador.
  Hash/XML corretos não cumprem esses gates.

O [documento editorial](MODULO-EDITORIAL-XML.md) registra um gate conservador de
exposição até correção/revisão da fonte. Esta matriz não o revoga: o subconjunto
delimitado do editorial é candidato a ensaio/aceitação sob decisão coordenada,
não uma declaração de `adoptionReady` ou liberação de publicação.

## Evidência inspecionada

Fontes reais: `../CAMAP2/extensions/camap/_shared/render.js`, os onze
`../CAMAP2/extensions/camap/<mod>/module.js` (incluindo o piloto para comparação),
CSS relevante e os dez XML em
`tmp/adoption-agent-real-<mod>-0.2.0/modules/<mod>/<mod>.xml`.

Conferência independente com Node, somente `fs/path/crypto`, nos dez pacotes
existentes `tmp/adoption-agent-real-<mod>-0.2.0/`:

- Sete payloads inventariados por pacote; tamanhos e SHA-256 válidos em todos.
- Pin de `MANIFEST-SHA256.json` no `host-config.json` corresponde aos seus bytes.
- Implementação e helper coincidem com CAMAP2 após normalização CRLF → LF.
- XML contém exatamente os campos enumerados abaixo; wrapper reexporta a
  implementação original. Nenhum entrypoint dos dez foi executado nesta frente.
- Flags de migração, host e publicação permanecem `false` em todos os planos.

O fechamento JS/CSS com parsers e descoberta reais já foi preparado/auditado na
etapa documentada em [MODULE-ADOPTION.md](MODULE-ADOPTION.md). Esta frente não
reexecutou o gerador nem declara uma nova auditoria dinâmica desse fechamento.
Revisões adicionais do editorial `tmp/editorial-adoption-0.2.0/` e
`tmp/editorial-adoption-0.2.1/` continuam preparação, não instalação.

## Defeitos comuns e alcance exato

### U1 — filtro por prefixo não é política de URL

`../CAMAP2/extensions/camap/_shared/render.js:2` apenas testa
`/^(#|\/|https:\/\/)/i` após `String(...).trim()`. Ensaio puro do helper original
já lido, com `new URL` local e **sem navegação/requisição**, confirmou:

| Entrada neutra | Resultado |
| --- | --- |
| `#/article/local-a`, `/local/path` | Aceitas; origem local na resolução |
| `//example.invalid/path` | Aceita; resolve em outra origem |
| `/\example.invalid/path` | Aceita; resolve em outra origem |
| `https://reader:placeholder@example.invalid/path` | Aceita com credenciais fictícias |
| `javascript:alert(1)`, `data:text/plain,local`, `http://example.invalid/path` | Fallback `#` |

Escape HTML evita quebrar atributos, mas não impede navegação ou carga de asset.
`#javascript:...` é fragmento, não execução do scheme `javascript:`.
Os campos de URL destes pacotes são `text`/`textarea` ou membros de JSON, **não
parâmetros `url`**. Por isso não recebem automaticamente `coerceParam(type:'url')`
de `src/libraries/minijoomla/application/declared-params.js:153-160`.

Gate inicial proposto: somente fragmentos locais explicitamente revisados;
imagens ausentes. Caminhos server-relative e HTTPS futuros exigem validação
completa de protocolo/origem/credenciais/backslash/controles e destino autorizado.
Essa regra não se aplica às URLs de pacote/CSS do host, que têm validação própria.

### S1 — JSON válido não garante item renderizável

`declared-params.js` já restringe JSON a dados densos/copied, sem getters,
`toJSON`, ciclos ou protótipos executáveis. Isso **não exige** `items[n].title`
string nem impede `items:[null]`. O registry captura exceções e devolve alerta
seguro (`src/libraries/minijoomla/modules/registry.js:10`), mas não corrige dados.

- Editorial/highlights/topsections: leitura direta de propriedades; `null` no
  conjunto renderizado provoca exceção. Strings/números/arrays podem gerar
  cartões sem significado, sem satisfazer o contrato editorial de dados.
- Documentação/fórum/recursos/videoteca: normalizadores recusam `null`, arrays e
  escalares como itens; depois fazem coerções. Isso reduz crashes, **não valida
  URL, booleans de negócio ou todos os subcampos**.
- Showcase: descarta `null`/escalares, mas o filtro aceita arrays como objetos;
  arrays JSON comuns sem `title` acabam descartados. Não é um schema de item.
- Hero: ações têm acesso opcional; palavras não são verificadas como strings.
- Home: estatísticas exigem `value`/`label` strings; lista vazia restaura defaults,
  não representa necessariamente ausência de estatísticas.

## Matriz operacional

Todas as linhas abaixo dependem de direitos e aceite real ainda pendentes.
“Delimitado” significa configuração explícita revisada e gate de entrada em
todas as edições; não basta preencher uma vez e permitir edição arbitrária depois.

| Módulo / chave preservada | Bloqueio de entrada não revisada | Subconjunto delimitado para próximo aceite | CSS |
| --- | --- | --- | --- |
| `mod_camap_editorial` / `camap.mod_camap_editorial` | U1 em links/CTA; S1; `limit` sem bounds XML | 1–3 objetos título/URL, fragmentos revisados, sem imagens/HTML; respeitar gate editorial | `db.css` |
| `mod_camap_highlights` / `camap.mod_camap_highlights` | U1 em `items[].url`; S1; lista sem limite próprio | 1–3 itens texto, URL omitida ou fragmento revisado, layout explícito | `highlights.css` |
| `mod_camap_topsections` / `camap.mod_camap_topsections` | U1 em `items[].url`; S1; quantidade sem teto próprio | 1–6 objetos título/URL, `itemLimit` inteiro positivo finito | `sd.css` |
| `mod_hero` / `camap.mod_hero` | U1 em imagem/ações; forma das ações/palavras não validada | Um bloco, uma palavra string, sem imagem/ações ou ações revisadas | `hero.css` |
| `mod_home` / `camap.mod_home` | U1 nas ações; defaults de ações/estatísticas e CSS legado | Ações explícitas, stats neutras não vazias, título/descrição texto; um bloco | `home.css` |
| `mod_recursos` / `camap.mod_recursos` | U1 em breadcrumb/links; flags internas por truthiness; CSS legado | 1–6 links canônicos, flags booleanas, fragmentos revisados; controles sem promessa interativa | `recursos.css` |
| `mod_showcase` / `camap.mod_showcase` | U1 em links/imagens; item não tipado; modos avançados sem aceite | `mode:list`, 1–3 itens texto, sem imagem; outros modos só com aceite próprio | `showcase.css` |
| `mod_documentation` / `camap.mod_documentation` | U1 em árvore/artigos/imagens/paginação; IDs/flags coercivos | Pequena árvore com IDs únicos, sem imagem, artigos revisados e paginação pré-computada | `documentation.css` |
| `mod_videoteca` / `camap.mod_videoteca` | U1 em links; V1 thumbnails CSS sem filtro; flags e CSS legado | 1–6 vídeos canônicos, thumbnails vazias nas duas listas, catálogo estático | `videoteca.css` |
| `mod_forum` / `camap.mod_forum` | U1 em `pageHref`; F1 cor CSS sem validação; destino externo não garantido | 1–6 tópicos canônicos, cores `#rrggbb`, chips desligados, destino testável revisado | `forum.css` |

## Contratos específicos — fonte, não funcionalidades presumidas

Notação: `s` = string; `n` = number; `b` = boolean; `a` = array;
`o` = object; enumerações aparecem entre parênteses. No XML, arrays/objetos são
JSON com `mj:valueType`; radio `0/1` é booleano normalizado e list vira select.
Defaults e limites continuam os originais. Os exemplos são **configurações
propostas**, não parâmetros persistidos, nem substitutos do schema.

### 1. Editorial

Fonte `mod_camap_editorial/module.js:2-4`. Quatro campos na ordem XML:
`title:s="Destaques"`, `limit:n=3`, `items:a=[]`, `catalogTarget:s=""`.
`render` usa `stateMessage`, `escapeHtml` e `safeUrl` em `principal.url`,
`secondary[].url` e `catalogTarget`. Item consumido: `{title,url,summary?}`.
Primeiro item tem resumo; secundários somente link. Imagens, `alt` e HTML rico
não são suportados. `limit:0` volta a 3; negativos zeram itens; teto interno 100;
frações são truncadas por `slice`. Nenhum min/max foi declarado no XML.

Configuração candidata: `{"title":"Editorial local","limit":2,"items":[{"title":"Publicação A","url":"#/article/local-a","summary":"Resumo local"}],"catalogTarget":""}`.
Revisar cada objeto/string, quantidade e link antes de render/persistência;
caracterizar vazio/loading/error e item `null`. Detalhes e duas revisões em
[MODULO-EDITORIAL-XML.md](MODULO-EDITORIAL-XML.md).

### 2. Highlights

Fonte `mod_camap_highlights/module.js:2-4`. Três campos:
`title:s=""`, `layout:enum(horizontal,vertical,auto)="auto"`, `items:a=[]`.
`render` usa `stateMessage` e `escapeHtml`; `safeUrl(i.url)` somente se `i.url`
for truthy. Item: `{title,description?,url?}`; imagens não são renderizadas.
`auto` usa **argumento de contexto** `width >= 760`, não mede DOM e não prova
que o host forneça largura. Sem width, resulta vertical. Não há teto de itens.

Configuração candidata: `{"title":"Destaques locais","layout":"vertical","items":[{"title":"Item A","description":"Descrição local"}]}`.
Checar item `null`, texto/atributos escapados e ambos os layouts; `auto` somente
depois de verificar o contrato real de width no host. Sem link, U1 não é ativado
nessa configuração, embora o código consumidor continue no pacote.

### 3. Topsections

Fonte `mod_camap_topsections/module.js:2-4`. Três campos:
`title:s=""`, `items:a=[]`, `itemLimit:n=6`.
`render` usa `stateMessage`, `escapeHtml`, `safeUrl(i.url)` em cada item exibido.
Item: `{title,url}`; saída é lista de links, sem imagens/resumos.
`itemLimit:0` volta a 6; negativos zeram itens; não há teto no renderer/XML;
frações são truncadas pelo `slice`.

Configuração candidata: `{"title":"Seções locais","items":[{"title":"Seção A","url":"#/category/local"}],"itemLimit":1}`.
Checar lista vazia, estados, `null`, quantidade e link; impor limite de fixture
não significa acrescentar silenciosamente bounds ao schema externo.

### 4. Hero

Fonte `mod_hero/module.js:2-5`. Sete campos:
`title:s="Profundidade com"`, `rotatingWords:a=["propósito"]`, `mission:s=""`,
`imageUrl:s=""`, `imageAlt:s=""`, `primaryAction:o={}`, `secondaryAction:o={}`.
Função exportada `renderHero`; `render` delega. `safeUrl` é usado em
`imageUrl` e `primaryAction.target`/`secondaryAction.target` quando há label;
links com fallback `#` são omitidos. Imagem truthy recusada pelo filtro ainda
gera `src=""`. Texto e `alt` escapados. Ação: `{label,target}` — **não `href`**.
Somente a primeira palavra aparece; não há rotação JS, timer ou estado de carga.
Título usa ID fixo `camap-hero-title`: duas instâncias duplicam esse ID.

Configuração candidata: `{"title":"Apresentação local","rotatingWords":["conteúdo"],"mission":"Texto local","imageUrl":"","imageAlt":"","primaryAction":{},"secondaryAction":{}}`.
Aceitar inicialmente uma instância, sem mídia. Imagem/ação futuras precisam de
contrato de subcampos, URL/alt e destino; estados não são recurso deste módulo.

### 5. Home

Fonte `mod_home/module.js:3-63`. Oito campos:
`eyebrow:s` (max 80), `title:s` (180), `primaryHighlight:s` (80),
`secondaryHighlight:s` (80), `description:s` (400), `primaryAction:o`,
`secondaryAction:o`, `stats:a`. Defaults estão em `defaults`, inclusive ações
`{label,href}` e quatro estatísticas prontas; não são contadores de serviço.
Funções: `highlight`, `action`, `stats`, `decoration`, `renderHome` exportada.
`safeUrl(action.href)` nas duas ações. Ações são mescladas aos defaults: `{}`
não as desliga. Label vazio explícito omite link. `stats:[]` volta aos defaults;
lista não vazia é cortada em oito antes de filtrar pares string `{value,label}`.
`secondaryHighlight` está no schema mas **não é consumido no render**.

Configuração candidata: `{"eyebrow":"Workspace local","title":"Conteúdo local","primaryHighlight":"Conteúdo","secondaryHighlight":"","description":"Descrição local","primaryAction":{"label":"Abrir conteúdo","href":"#/category/local"},"secondaryAction":{"label":"","href":"#"},"stats":[{"value":"1","label":"ITEM LOCAL"}]}`.
Checar estados e ausência de métricas originais inesperadas. Título usa ID fixo
`mse-home-title`; limitar a uma instância. `decoration()` não aplica a classe
`.mse-home__floater` definida no CSS aos spans: efeito visual original não está
comprovado. Ver também C1 abaixo antes de aceitar aparência.

### 6. Recursos

Fonte `mod_recursos/module.js:16-51,70-155,166-423`. Onze campos:
`title:s="Explore Mais"`, `homeLabel:s="Hub TD"`, `homeHref:s="#inicio"`,
`search:s=""`, `category:s="todas"`, `sort:enum(curada,alfabetica)="curada"`,
`view:enum(cartoes,compacta)="cartoes"`, `showActions:b=true`,
`showShortcuts:b=true`, `categories:a=[]`, `links:a=[]`.
Funções: `normalizeLink(s)`, `getCategories`, `flatLinks`, `filteredLinks`,
`groupByCategory`, `pageBar`, `shortcutCard`, `resourceCard`, `compactRow`,
render default. `safeUrl` em `pageBar(homeHref)` e nos três formatos de link.
`hostFromUrl` extrai hostname localmente; **não reforça a validação de URL**.

Item canônico completo: `{title,url,category,description,iconKey,order,
openInNewWindow,active}`. Aliases observados: `Title,URL,Categoria,Descricao,
IconeChave,Ordem,AbrirNovaJanela,Ativo`. Strings/número são coercivos;
`Boolean("false")` e `Boolean("0")` são true. Nova janela usa
`rel="noopener noreferrer"`, mas isso não torna o destino seguro.
Categorias são strings; vazias acionam catálogo default. Ordem curada é
categoria → order → título. Sem imagens, favoritos, submissão ou fetch.
Busca/filtro/ordem vêm de settings; controles não têm handlers.
`state:empty` não força vazio se links existirem; somente loading/error têm ramo.

Configuração candidata: `{"title":"Recursos locais","homeLabel":"Início","homeHref":"#/","search":"","category":"todas","sort":"curada","view":"compacta","showActions":false,"showShortcuts":false,"categories":["Local"],"links":[{"title":"Recurso A","url":"#/article/local-a","category":"Local","description":"Texto local","iconKey":"RA","order":1,"openInNewWindow":false,"active":true}]}`.
Checar flags booleanas, ordenação/filtro com re-render explícito, vazio/error e
C1. Não apresentar os controles estáticos como recursos funcionais completos.

### 7. Showcase

Fonte `mod_showcase/module.js:13-56,58-257`. Oito campos:
`title:s="Showcase"` (120), `introText:s=""` (800),
`mode:enum(list,carousel,masonry,sphere,timeline)="list"`, `items:a=[]`,
`columns:n=3` (1–6), `carouselItemMinWidth:n=280` (180–560),
`sphereSize:n=520` (240–900), `timelineLabel:s="Linha do tempo"` (120).
Funções: `normalizeMode/Columns/Number/Items`, `renderHeader/Image/Meta/Card`,
`renderList/Carousel/Masonry/Sphere/Timeline`, `renderShowcase` exportada.
`safeUrl` em `renderImage(imageUrl)`, `renderCard(url)`, `renderSphere(url)` e
`renderTimeline(url)`. Imagem inválida vira ausente; link fallback vira texto.

Item consumido completo: `{title,url,description,imageUrl,imageAlt,category,
date,extraInfo,size}`; strings coercivas; título vazio descartado; size só
`sm/md/lg`. Textos/alt/datetime escapados; data não é validada/ordenada.
Sem fontes remotas/jQuery/PHP. Carousel é scroll-snap CSS; sphere é anel 2D
animado em CSS, não nuvem 3D; reduced-motion presente no CSS. Lista sem teto.

Configuração candidata: `{"title":"Vitrine local","introText":"Texto local","mode":"list","items":[{"title":"Item A","description":"Descrição local","url":"#/article/local-a","imageUrl":"","imageAlt":""}],"columns":1,"carouselItemMinWidth":280,"sphereSize":520,"timelineLabel":"Linha do tempo"}`.
Começar por list. Outros modos requerem reflow, foco, movimento e leitura
próprios; aprovação do modo list não aprova todos os modos.

### 8. Documentação

Fonte `mod_documentation/module.js:42-121,127-429`. **24 campos**, ordem XML:
`view`, `title`, `showPageHeading`, `pageHeading`, `showBaseDescription`,
`baseDescription`, `categories`, `maxLevelCategories`, `showEmptyCategoriesCat`,
`showSubcatDescCat`, `showCatNumArticlesCat`, `activeCategoryId`,
`showCategoryTitle`, `showDescription`, `showDescriptionImage`, `showCatTags`,
`maxLevel`, `showEmptyCategories`, `showSubcatDesc`, `showCatNumArticles`,
`showNoArticles`, `rootLabel`, `rootHref`, `pagination`.

- `view`: enum categories/category, default categories.
- Strings: title/pageHeading max 160; baseDescription 2000; activeCategoryId e
  rootLabel 120; rootHref 300. Defaults título/pageHeading “Documentação”,
  rootLabel “Categorias”, rootHref `#documentacao`, demais strings vazias.
- Arrays/objetos: categories `[]`, pagination `{}`.
- Números: maxLevelCategories/maxLevel default -1, min -1/max 10.
- Booleanos false: showPageHeading, showEmptyCategoriesCat,
  showEmptyCategories, showSubcatDesc. Os outros booleanos default true.

Funções: `normalizeArticle`, `normalizeCategory`, `buildTree`, `normalizeConfig`,
`renderCategoryCards`, `renderCategoriesView`, `renderChildrenList`,
`renderPagination`, `renderCategoryView`, `renderDocumentation` exportada.
`safeUrl` em href/image de cartões, href dos filhos, parent.href/rootHref no
voltar, article.href, pagination.prevHref/nextHref e imagem da categoria ativa.

Categoria: `{id,parentId,title,href,description,image,imageAlt,tags,articles,
numItems}`. Artigo: `{id,title,href,published}`. Pagination:
`{page,totalPages,prevHref,nextHref}`. Itens inválidos descartados; categorias
sem id/artigos sem título descartados; IDs duplicados ficam com último nó;
ciclos entre pais somem da grade e profundidade tem teto absoluto 20.
`published` ausente = true; string `"false"` também vira true. `numItems` pode
ser contador pré-computado e não equivale a artigos publicados.
Imagens/alt e descrições são escapados; `showDescriptionImage:false` só desliga
imagem na view category, **não as imagens dos cartões categories**.

Configuração candidata: `{"view":"categories","title":"Documentação local","showPageHeading":false,"showBaseDescription":true,"baseDescription":"Texto local","categories":[{"id":"local-a","parentId":null,"title":"Categoria A","href":"#/category/local","image":"","imageAlt":"","articles":[{"id":"doc-a","title":"Documento A","href":"#/article/local-a","published":true}],"numItems":1}],"maxLevelCategories":1,"pagination":{}}`.
Também testar category com activeCategoryId conhecido, links de voltar e
paginação revisados. Sem componente PHP/Phoca, busca, ACL remota ou carregamento
automático; dados/páginas são fornecidos pelo host como configurações.

### 9. Videoteca

Fonte `mod_videoteca/module.js:31-76,164-265,355-595`. **16 campos**, ordem XML:
`title`, `homeLabel`, `homeHref`, `search`, `category`, `sort`, `page`,
`pageSize`, `showShowcase`, `showRecentList`, `showActions`, `showcaseLimit`,
`recentLimit`, `presenterSuffixes`, `videos`, `carouselVideos`.

- Strings/defaults: title “Videoteca” (120), homeLabel “Hub TD” (60),
  homeHref `#inicio` (300), search vazio (100), category “todas” (80),
  presenterSuffixes vazio (200).
- sort enum recentes/vistos/curtos, default recentes; page 1 (min 1),
  pageSize 12 (1–100); showcaseLimit/recentLimit 6 (0–12).
- showShowcase/showRecentList/showActions true; videos/carouselVideos `[]`.

Funções: `normalizeVideo(s)`, `accentFor`, `presentersFor`, `categoriesFor`,
`catalogCategories`, `sortedVideos` exportadas; `filteredVideos`, `paginate`,
`showcaseSelection`, `recentSelection`, `videoHref`, `thumbnailFor`,
`renderThumb/Card/CarouselSlide/Carousel/RecentList/Showcase/CatalogRows`,
`renderPageBar/FilterBar/Pagination`, `renderVideoteca` exportada.
`safeUrl` em `videoHref(video.url)` para todos os links de vídeo e
`renderPageBar(homeHref)`; **não em thumbnailFor ou backgrounds**.

Item canônico completo: `{id,title,url,category,categoryColor,date,duration,
durationSeconds,views,thumbnail,description,featured,carouselOrder,presenters,
tags}`. Aliases: `Id,Title,URL,FileRef,Categoria,CategoriaCor,Data,Duracao,
DuracaoSegundos,Visualizacoes,Miniatura,Descricao,Destaque,OrdemCarrossel,
Apresentadores,Tags`. `FileRef` é fallback de URL bruta; não resolve streams.
Presenters aceita lista/valor e membros title/Title; tags só array. Números são
coercivos; featured usa Boolean. `description` é normalizada mas não exibida.
`accentFor` valida seis dígitos hexadecimais, diferente do fórum.

**V1 — CSS/URL de thumbnail sem proteção de contexto:**
`renderThumb:359`, `renderCarouselSlide:403`, `renderRecentList:450` inserem
`thumbnail` em `background-image:url('...')` usando só `escapeHtml`. Não há
safeUrl nem escape/validação CSS: protocolos/destinos não são filtrados, e
aspas escapadas como entidades HTML voltam a aspas quando o atributo é lido
pelo DOM, podendo alterar o contexto CSS. É risco de carga de recurso/style,
não prova de execução JavaScript. Auditoria estática; nenhum fetch foi feito.
Vale tanto para `videos` quanto para `carouselVideos`.

Configuração candidata: `{"title":"Vídeos locais","homeLabel":"Início","homeHref":"#/","search":"","category":"todas","sort":"recentes","page":1,"pageSize":6,"showShowcase":false,"showRecentList":false,"showActions":false,"showcaseLimit":0,"recentLimit":0,"presenterSuffixes":"","videos":[{"id":"1","title":"Vídeo A","url":"#/article/video-local","category":"Local","categoryColor":"#006298","thumbnail":"","featured":false,"presenters":[],"tags":[]}],"carouselVideos":[]}`.
Gate: thumbnails vazias em toda entrada/edição até correção externa própria.
Busca/ordem/página requerem re-render por settings; controles não fazem isso.
Carousel não troca slides; somente primeira posição visível. RecentList só
é renderizada dentro do showcase quando há showcaseVideos, mesmo se habilitada
isoladamente. Não é player, upload, serviço de vídeo ou resolução SharePoint.

### 10. Fórum

Fonte `mod_forum/module.js:15-44,46-206`. Oito campos:
`title:s="Fórum"` (120), `pageHref:s="#/com_forum"` (300),
`topicKey:s="forumTopic"` (40), `limit:n=6` (1–24), `showChips:b=true`,
`showExcerpt:b=true`, `ctaText:s="Veja mais tópicos..."` (80), `topics:a=[]`.
Funções: `normalizedId`, `formattedDateTime`, `plainTextExcerpt`, `buildUrl`,
`topicHref`, `normalizeTopic(s)`, `categorySet`, `chipRow`, `card`,
`renderForumModule` exportada. `safeUrl` em `topicHref(buildUrl(pageHref,...))`
e CTA `pageHref`. Parâmetros do deep link são encodeURIComponent, mas a base
continua vulnerável a U1. `title` é declarado/default, **não exibido no render**.

Item canônico: `{id,title,author,createdAt,category,categoryColor,repliesCount,
body}`; id é inteiro positivo coercivo. Aliases observados:
`Id,Title,Author,DisplayAuthor,Autor,Created,DisplayCreatedAt,Modified,
UltimaAtividade,Categoria,categoryTitle,categoryName,categoryNome,CategoriaCor,
QuantidadeRespostas,Conteudo,content`; category também tenta Nome/Title/Cor em
objeto histórico, mas o primeiro valor `category` é convertido em string antes
dessas alternativas. Preferir campo canônico string.

**F1 — cor arbitrária em CSS inline:** `normalizeTopic:99` não valida cor;
`chipRow:146` e `card:165` interpolam em `style="--accent:..."` somente com
escape HTML. Um valor neutro como
`#006298;background-image:url(https://example.invalid/local)` continua com
delimitadores CSS. Pode acrescentar declarações/cargas de recurso; não foi
executado em navegador nem se alegou XSS JavaScript.

Configuração candidata: `{"title":"Fórum local","pageHref":"#/category/local","topicKey":"forumTopic","limit":1,"showChips":false,"showExcerpt":true,"ctaText":"Abrir conteúdo local","topics":[{"id":1,"title":"Tópico A","author":"Equipe local","category":"Local","categoryColor":"#006298","repliesCount":0,"body":"Texto local"}]}`.
O destino neutro só comprova link renderizado; não comprova abrir tópico. Aceite
de deep link de tópico exige rota/componente real aprovado separadamente.
Chips são estáticos, não filtros; excerpt é texto escapado cortado em 140 chars.
Sem backend PHP/SharePoint, criação/resposta/moderação ou serviço `com_forum`.

## C1 — CSS legado e títulos exigem aceite de integração

`home.css:4`, `recursos.css:3-4` e `videoteca.css:3` definem variáveis em
seletores `data-mse-module` legados. Os respectivos renderers não emitem esse
atributo e o registry atual não o acrescenta: apenas envolve moduleClass quando
configurada. Logo, cores/variáveis nesses blocos não estão garantidas pelo HTML
do pacote isolado. Isso é divergência estática concreta, não conclusão visual
de navegador. O coordenador deve validar wrapper/escopo aprovado ou correção
CSS externa delimitada, sem alterar globalmente o frontend para acomodar tudo.

`moduleClass/headerTag/headerClass` pertencem ao chrome do runtime
(`MODULE_ADVANCED_PARAMS`), não devem ser redeclarados pelos XML externos.
`showTitle` pertence à instância/contexto. Estes renderers não consomem
`showTitle/headerTag/headerClass`; seus h1/h2 internos não mudam por esses
controles. Não prometer ocultação/reclassificação do título interno sem
implementação. Campos Joomla customizados/required/multiple/filter/validate/
showon e grupos sem consumidor continuam recusados pelo perfil atual.

## Direitos/proveniência: ausência de prova não é licença inventada

CAMAP2 não tem `LICENSE*`/`COPYING*` na raiz e não tem `.git` próprio nesta cópia.
Existe licença no agregador `../LICENSE`, mas isso sozinho não estabelece o
alcance sobre ports e fontes incorporadas. Os comentários de documentação,
showcase, fórum e videoteca mencionam projetos/implementações de origem que
também exigem análise de proveniência. Nenhuma busca remota foi realizada.

Próximo gate mínimo: identificar titulares/origem e alcance de uso/modificação/
distribuição de cada módulo, helper e CSS; preservar avisos/licenças reais com
seus bytes; registrar decisão legal pelo coordenador no plano adequado. Não
copiar automaticamente a licença do núcleo/agregador nem trocar false por true
para destravar publicação. Os pacotes não contêm uma aprovação legal implícita.

## Próximas mudanças e checagens mínimas, sem expansão indiscriminada

1. **Entrada delimitada agora:** aprovar contrato canônico de dados por módulo,
   fixtures pequenas explícitas e validação/revisão em todas as edições. Limites
   propostos de fixture não alteram defaults/bounds XML. `keepUndeclared:true`
   preserva parâmetros legados; propriedades desconhecidas não viram recursos.
2. **Fonte externa, frente coordenada separada:** corrigir U1 no helper e
   testar todos os consumidores; tratar V1 especificamente no CSS de thumbnails;
   validar F1 como cor; normalizar itens dos três módulos simples; conferir C1,
   IDs fixos e campos declarados não consumidos. Não editar fontes preparadas
   diretamente nem inventar um fork amplo como correção implícita. A autorização
   geral para adoção não deve gerar pedidos redundantes; o coordenador delimita
   a frente, preserva fontes e define a revisão nova necessária.
3. **Preparar novamente só os módulos afetados**, em diretório novo imutável,
   sem sobrescrever estes pacotes. XML/defaults/schema, grafo/imports/CSS,
   inventário/hash e avisos precisam refletir os bytes novos. Mesmo helper
   modificado afeta o piloto empacotado se ele for regenerado, ainda que não use
   safeUrl; não atualizar sua revisão silenciosamente.
4. **Contratos genéricos independentes:** se futuramente houver schema de itens,
   validação de URLs nested ou lifecycle interativo, definir comportamento
   declarativo genérico com consumidor/testes próprios. Não embutir nomes,
   dados, serviços corporativos ou exceções CAMAP no núcleo; não anunciar suporte
   de plugins/templates/componentes/PHP ou campos avançados por esse caminho.
5. **Checagem offline focal por módulo:** envelope objeto; tipo e default XML;
   round-trip sem descarte; itens `null`/arrays/escalares; URLs de U1 e fallback;
   texto/atributo/alt seguros quando suportados; flags de negócio; estados reais
   (inclusive ausências), lista pequena/grande, CSS da revisão e cleanup. V1/F1
   exigem contraprovas próprias; teste que caracteriza defeito não o aprova.
   Só executar imports locais depois de revisar/fixar o grafo confiável; não é
   sandbox. Não é necessário rebuild/npm completo para esta auditoria.
6. **Capacidade de raízes antes da expansão:**
   `joomla-host-config.js:15` permite **no máximo dez raízes no total, inclusive
   revisões retidas com discover:false**. Onze módulos individuais já excedem
   esse limite; com rollback o problema aumenta. Não concatenar todos os planos,
   elevar o limite silenciosamente ou remover raízes em uso para contorná-lo.
   Agrupamento futuro em pacotes finitos por revisões, com múltiplos módulos
   explicitamente aprovados, pode economizar raízes, mas exige preparador,
   inventários/gates e seleção de descoberta próprios. Pacote agrupado não
   instala automaticamente todos os módulos nem explode em raízes novas.
7. **Aceitação real pelo coordenador após gate piloto comprovado:** capturar
   registros/instâncias/configurações/ETags privados; preservar os registros
   existentes (incluindo os 40 da amostra, conforme contrato da etapa, sem
   afirmar contagem remota atual). Descobrir sem import, verificar pacote,
   instalar desabilitado, habilitar/configurar somente a instância prevista,
   confirmar render/CSS/MIME/CSP/teclado/reflow e persistência. Se houver chave
   JSON legada instalada, usar prévia de migração assistida; não apagar para
   contornar guarda. Atualizar e reverter preservando ID/key/params/ordering/
   assignment/posição; manter código e CSS antigos aprovados, descobrir somente
   revisão ativa, comprovar disable/enable sem perdas e conflitos de ETag.

**Fechamento desta frente:** dez contratos/consumidores mapeados; defeitos e
subconjuntos delimitados registrados; integridade local dos dez pacotes
conferida. Nenhum gate legal, migração, instalação, publicação ou aceite remoto
foi declarado concluído. Único arquivo novo: este documento.

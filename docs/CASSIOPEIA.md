# Template público Cassiopeia

> A tela administrativa de estilos (`#/templates/styles`) está conectada à
> composição pública desde a integração registrada em
> [ADMINISTRATION-EXTENSIONS.md](ADMINISTRATION-EXTENSIONS.md) (ver
> `src/libraries/minijoomla/application/site-config-overrides.js`, usado tanto pelo painel quanto
> por `createMiniJoomlaSiteApplication.js`): um parâmetro salvo com ETag no
> estilo padrão do Cassiopeia chega a `config.templateParams` e é aplicado
> pelo `resolveTemplateParams` abaixo na próxima renderização pública —
> provado fim a fim (Node, sem navegador real) em
> `tests/site-runtime.test.js`. Os metadados do formulário (`logoFile`,
> `brand` como seleção) já batem com os parâmetros reais consumidos aqui,
> via `TEMPLATE_PARAM_DEFINITIONS` (fonte única, reutilizada por
> `src/libraries/minijoomla/application/template-styles.js`). Consulte o
> [plano de continuidade](PLANO-CONTINUIDADE-MINIJOOMLA.md) para o que ainda
> falta (revalidação em navegador real via FIORI-AUTO).

`src/templates/cassiopeia/index.js` + `src/media/templates/site/cassiopeia/css/template.css` implementam um template
público que reproduz, de forma independente, a estrutura de DOM, as classes, a
grade CSS e os componentes visuais do Cassiopeia do Joomla. A paleta padrão
**voltou à direção independente Cassiopeia em 04/11/2026**, preservando
estrutura, classes e opções persistidas. A adequação corporativa de03/11 é
histórica e foi rejeitada como requisito padrão pelo usuário. A versão neutra
é local: o site público publicado permanece na estilização anterior.
O Joomla local (`web-devs/JOOMLA`) foi usado apenas como referência de consulta;
nenhum bloco de código, imagem ou fonte foi copiado. O CSS registra em
comentário a derivação conceitual do Cassiopeia (GPL). Não há dependências
externas, CDN, fontes ou imagens remotas (somente SVGs inline/`data:`).

## Estrutura gerada

```text
div.cassiopeia-template.site.wrapper-static|wrapper-fluid[.has-sidebar-left][.has-sidebar-right]
    .colors-standard|colors-alternative[.font-roboto]  data-template="cassiopeia"
  a.skip-link → #main-content
  header#site-top.header.container-header.full-width[.position-sticky.sticky-top]
    div.container-topbar                 (posição topbar)
    div.grid-child.container-below-top   (posição below-top)
    div.grid-child.container-brand > div.navbar-brand > a.brand-logo > span.site-title | img.logo
                                     + div.site-description
    div.grid-child.container-nav
      div.navbar.navbar-expand-md > button.navbar-toggler[aria-expanded] + div.collapse.navbar-collapse#cassiopeia-navbar-collapse > div.container-menu
      div.container-search
  div.site-grid
    div.container-banner.full-width
    div.grid-child.container-top-a / container-top-b
    aside.grid-child.container-sidebar-left
    div.grid-child.container-component
      div.container-breadcrumbs, div.container-main-top,
      main.site-main#main-content (componente), div.container-main-bottom
    aside.grid-child.container-sidebar-right
    div.grid-child.container-bottom-a / container-bottom-b
  footer.container-footer.footer.full-width > div.grid-child
  a#back-top.back-to-top-link → #site-top
```

Regiões vazias não são renderizadas. Cada posição publicada recebe
`data-template-region` e `data-mj-position`. O botão do menu móvel só existe
quando há menu.

## Contrato de integração

- `renderShell({ config, menus, breadcrumbs, content, modules, busy })` retorna
  HTML; os componentes continuam responsáveis pelo HTML de navegação, busca,
  artigos e módulos. Textos de configuração são escapados.
- `TEMPLATE_POSITIONS`, `COMPONENT_POSITION`, `TEMPLATE_METADATA` (com `params`)
  e `TEMPLATE_PARAM_DEFINITIONS` expõem nomes para configuração e descoberta.
  `resolveTemplateParams(config)` devolve os parâmetros normalizados (congelado).
- Posições: `topbar`, `below-top`, `menu`, `search`, `banner`, `breadcrumbs`,
  `top-a`, `top-b`, `main-top`, `sidebar-left`, `sidebar-right`, `main-bottom`,
  `bottom-a`, `bottom-b`, `footer`. `component` contém o conteúdo principal.
- `menus` e `breadcrumbs` antecedem os módulos das posições homônimas. O template
  não cria landmarks `nav` próprios.
- `modules.content` é alias de `main-top`; `modules.sidebar` é alias de
  `sidebar-right` (concatenados, posição canônica primeiro, sem duplicar).
- `footer` omitido mostra o crédito com o nome do site; `modules.footer: ''`
  remove o rodapé inteiro (o retorno ao topo é o link `#back-top`).
- `busy: true` marca somente o `main` com `aria-busy`.

## Parâmetros de estilo

Lidos, nesta ordem, de `config.templateParams`, `config.styleParams` ou
`config.template.params` (objeto ou string JSON). Valores ausentes
(`undefined`, `null`, string vazia) usam o padrão silenciosamente. JSON
malformado, fonte que não é objeto e valores inválidos também usam o padrão
(o shell continua seguro), mas geram um único `console.warn` por resolução:
`MINIJOOMLA: parâmetros de estilo do template Cassiopeia inválidos; padrões aplicados.`
com detalhes `[{ field, reason }]` — apenas nomes fixos de campo/fonte e códigos
(`malformed-json`, `invalid-format`, `invalid-boolean`, `invalid-option`,
`invalid-text`, `unsafe-url`); valores recebidos nunca são registrados.
`resolveTemplateParams(config, { warn })` aceita um logger alternativo. Uma fonte
malformada não impede o uso da seguinte.

| Nome | Tipo | Padrão | Efeito |
| --- | --- | --- | --- |
| `brand` | `title` \| `logo` \| `none` | `title` (`logo` se `logoFile` existir e `brand` ausente) | Marca do cabeçalho; `0`/`false` = `none`. `logo` sem `logoFile` usa o título. |
| `logoFile` | URL | `''` | Imagem `img.logo`; URLs inseguras (`javascript:` etc.) são descartadas. |
| `siteTitle` | texto | `config.siteName` | Texto de `span.site-title`. |
| `siteDescription` | texto | `config.siteDescription` | Texto de `div.site-description`. |
| `colorName` | `standard` \| `alternative` | `standard` | Cassiopeia azul / bordô; aceita prefixo `colors_` do Joomla e alias legado `default` → `standard`. |
| `useFontScheme` | `system` \| `roboto` | `system` | Pilha de sistema ou Roboto instalado com fallback de sistema; nenhuma fonte é carregada externamente. |
| `fluidContainer` | booleano | `false` | `wrapper-fluid` (largura total) em vez de `wrapper-static`. |
| `stickyHeader` | booleano | `false` | Cabeçalho fixo (`position-sticky sticky-top`) a partir de 992px. |
| `backTop` | booleano | `true` | Link "voltar ao topo"; `false` remove. |

Booleanos aceitam `true/1/'1'/'true'/'yes'/'on'` e `false/0/'0'/'false'/'no'/'off'`.
As definições seguem o formato de `src/libraries/minijoomla/application/declared-params.js`
(`name`, `type`, `label`, `default`, `options`).

## Comportamento (`bindShell`)

Após inserir o HTML, chamar `bindShell(root)` e guardar a limpeza; executá-la
antes de substituir o HTML, ao trocar de template e em `stop()`. O binding:

- marca o root com `data-cassiopeia-js` (sem JS, o menu fica sempre visível);
- alterna `aria-expanded` e `.show` no toggler do menu móvel (< 768px);
- `Escape` fecha o menu e devolve o foco ao toggler quando o foco está nele;
- o estado do menu acompanha `matchMedia('(max-width: 767.98px)')`: desktop
  fica aberto, mobile recolhe; ao redimensionar, o foco sai de controles que
  ficarão ocultos. Escape externo ou já tratado pelo submenu não é capturado;
- skip link e voltar ao topo focam e rolam sem alterar o hash do router;
- o skip marca temporariamente o `main` com `data-focus-origin="skip"`,
  garantindo contorno mesmo sem `:focus-visible`; blur/cleanup removem a marca;
- mostra `#back-top` (`.visible`) após rolagem; com foco por teclado ele aparece;
- a limpeza remove listeners (inclusive `scroll`) e o atributo.

## Menu em árvore (`src/modules/mod_menu/tmpl/default.js`)

`menuModule.render` delega a `renderMenuTree({ menus, link, activePath, label, idPrefix })`.

- Hierarquia por `id`/`parentId`; somente itens publicados; descendentes de item
  despublicado ficam ocultos; pai inexistente promove o item ao nível superior;
  ciclos/autorreferência são quebrados de forma determinística (sem laço).
- Irmãos ordenados por `ordering` numérico e depois `title` (`compareMenuItems`).
- Sem filhos, a saída é idêntica ao menu plano histórico.
- Com filhos: `nav.mod-menu-tree[data-menu-tree] > ul.mod-menu.metismenu`,
  `li.metismenu-item.item-ID.level-N[.deeper.parent][.active][.current]`; o
  ancestral do item atual recebe `active`; `aria-current="page"` só no atual.
  Cada pai tem `button.mm-toggler[aria-expanded][aria-controls][hidden]` e
  `ul.mm-collapse[data-menu-tree-submenu]` com id único por instância.
- Sem JavaScript os botões ficam ocultos e todos os links visíveis.
- `bindMenuTree(root) → cleanup` (root = documento, contêiner ou o `nav`): exibe
  os botões, alterna `aria-expanded`/`.mm-show` fechando irmãos abertos, `Escape`
  fecha o submenu mais interno e devolve o foco ao botão (sem propagar ao
  Escape do shell), clique fora fecha; a limpeza remove listeners e restaura o
  estado. Não vincula duas vezes o mesmo `nav`. O host deve chamá-la após cada
  render e limpar antes de substituir o HTML.
- CSS Cassiopeia em `default.css` (dropdown no desktop ≥992px, colapso no
  móvel). Sem binding, os submenus permanecem em linha e acessíveis sem
  hover. Regras CAMAP equivalentes pertencem a `camap.css` (frente CAMAP).

## CSS

**Estado local atual:** CSS e rótulos de parâmetros neutros, com tokens
Cassiopeia azul/bordô e superfícies claras. Smoke nativo FIORI-AUTO nas quatro
larguras320/768/1366/1920px confirmou paletas, menu/Escape, foco skip sem mudar
rota, contenção de laterais e margens de imagem. Isso não é aceite visual
integral nem publicação do site. [PUBLIC-TEMPLATE.md](PUBLIC-TEMPLATE.md) descreve
tokens, contrastes, fontes e limitações vigentes.

### Registro histórico anterior à neutralização local

**Aceite integrado do coordenador (03/11):** matriz DOM nativo local nas quatro
larguras com laterais vazias/preenchidas e ambas as paletas, um h1 e sem overflow;
menu/submenu Enter/Escape, foco no resize e skip verificados pelo FIORI-AUTO.
Código incluído na 0.2.1 publicada; o host vigente usa CAMAP, portanto isso não
é uma inspeção Cassiopeia aplicada ao tenant. Zoom real/forced-colors, três níveis
complexos, sticky/extensões e equivalência visual integral permanecem distintos.

Escopado em `.cassiopeia-template` (o teste verifica todos os seletores, pois
`camap` também carrega `default.css`). Inclui paletas institucionais sólidas,
cabeçalho e rodapé brancos, `site-grid` com áreas `full-width`/`main`/laterais e colunas
`4 × 19.875rem` no contêiner estático, breakpoints 576/768/992/1200 do
Bootstrap 5, cards para módulos, menu horizontal com dropdown (`ul` aninhado),
breadcrumbs, blog/destaques (leading + colunas), artigo (meta com ícones, tags),
paginação, busca, alertas, página de erro, back-to-top, foco visível, impressão,
cores forçadas e movimento reduzido.

| Token / uso | `standard` (alias `default`) | `alternative` |
| --- | --- | --- |
| `--cassiopeia-color-primary` (marca/ação) | verde `#008542` | azul `#006298` |
| `--cassiopeia-color-link` | azul `#006298` | verde `#008542` |
| `--cassiopeia-color-hover` | verde `#008542` | azul `#006298` |
| `--cassiopeia-color-accent` | amarelo `#FDC82F` | amarelo `#FDC82F` |
| texto secundário / borda | azul `#006298` | azul `#006298` |
| fundo predominante | branco `#FFFFFF` | branco `#FFFFFF` |
| texto / pictogramas escuros | preto `#000000` | preto `#000000` |

São três cores institucionais na composição normal (verde/azul/amarelo),
além do branco e do preto restrito a texto/pictogramas. Erro usa exclusivamente
laranja `#ED8B00`, texto preto e fundo branco no bloco de estado. Não há
cinzas inventados, azul-marinho, vermelho/rosa, `rgba`/`hsl`, gradientes,
misturas de superfície, sombras ou opacidade que desbote textos/controles.
Ícone de menu usa três traços CSS, não sombras; o retorno ao topo é ocultado
por clipping, mantendo exposição por teclado, sem fade/transparência.

Texto normal atende AA: verde/branco ≈4,74:1; azul/branco ≈6,56:1;
preto/amarelo ≈13,48:1. Botões/página ativa/retorno ao topo têm foco branco
interno nas superfícies verde/azul; demais controles usam contorno verde/azul
no branco e o skip amarelo mantém texto preto/contorno institucional. As
cores de sistema em `forced-colors` são exceção acessível, não uma nova paleta.
Os cantos permanecem retos inclusive nos tokens de controles internos: não
foi necessária uma exceção funcional de raio. Nenhuma fonte é embarcada;
Petrobras Sans só deve estar disponível com ativo/licença autorizados no host.

## Divergências conhecidas do original

- Paletas originais do Cassiopeia foram substituídas pelas oficiais Petrobras
  por decisão explícita do usuário em 03/11/2026, com base branca predominante,
  sem mudar estrutura/grade. A referência histórica Joomla deixou de ser
  fonte normativa de cores, superfícies e tipografia.
- `backTop` é `true` por padrão (no Joomla é `0`) para preservar o comportamento.
- Item ativo do menu tem sublinhado sólido institucional (acessibilidade).
- As views não geram `dl.article-info` nem `pagenavigation`;
  a fidelidade vem de CSS sobre a marcação existente.
- Sem `logo.svg` padrão; sem fonte Roboto embarcada.

### Fechamento estático de 03/11/2026

Consulta somente leitura de `web-devs/JOOMLA/templates/cassiopeia/index.php`,
`media_source/templates/site/cassiopeia/scss/blocks/_css-grid.scss` e
`media_source/templates/site/cassiopeia/js/template.es6.js`; nenhum código ou
ativo dessas referências foi copiado.

Diferenças concretas corrigidas nesta revisão:

- o modo fluido não usa mais quatro trilhas de 25% somadas aos cinco gaps:
  trilhas `1fr` repartem o espaço restante, mantendo nomes/áreas da grade;
- dropdown branco tem contorno de foco azul interno, em vez de herdar o
  branco do cabeçalho; submenus sem JS deixam de exigir hover/foco do pai;
- submenus com JS abrem somente pelo botão/`.mm-show`, não por hover que
  contradiga `aria-expanded="false"` ou reabra o menu após Escape;
- cards de artigo/listas não ocultam overflow para mascarar texto longo e
  recortar o foco; tabelas e `pre` rolam localmente em `article-body`, `lead`,
  `article-card` e `custom-html`, inclusive quando todo o artigo está em `introtext`;
- skip link focado cabe no host estreito/zoom; busca pode quebrar linha,
  iframe tem largura limitada e voltar ao topo tem alvo de 44 px;
- raízes/cabeçalhos de módulos usam cantos retos; erro genérico de módulo
  usa laranja oficial, texto preto e fundo branco, não rosa/vermelho.

**Conflito histórico resolvido no código por decisão explícita:** a primeira
revisão preservou a aparência Joomla e identificou sua incompatibilidade com
a [diretriz de identidade](../../docs/IDENTIDADE-PETROBRAS.md). O usuário
subsequentemente determinou **adequar as cores e publicar**. Esta frente
aplicou a adequação dos dois esquemas, estados, sombras e tipografia; a
aprovação histórica não é mais usada como exceção de brand. Valores antigos
persistidos de `colorName` e `useFontScheme` continuam legíveis com o novo
mapping. Não foram introduzidas opções de hex livre `colorPrimary`/`colorLink`:
essas funções permanecem nos tokens fixos das paletas aprovadas. Imagens de
`logoFile` precisam ser oficiais/autorizadas e adequadas ao novo fundo branco,
sem recoloração pelo template. Conteúdo customizado e CSS do host não podem
reintroduzir cores/ativos inválidos; não estão cobertos pela whitelist do shell.

**Limite desta frente:** a autorização de publicação pertence à coordenação;
não há publicação executada aqui. Ainda é necessário validar a instância real,
assets aprovados, MIME/CSP/cache/permissões e rollback em versão imutável.

Pendente da coordenação via FIORI-AUTO: confirmar 320/768/1366/1920 px,
zoom 200%/400%, textos longos, menus de três níveis, ausência de overflow,
skip/Escape/Tab/Shift+Tab, foco no resize, cores forçadas e cabeçalho sticky
sem encobrir conteúdo/foco. Os testes Node são estruturais, não evidência
visual nem aprovação de produção. Nenhuma rede, navegador ou publicação foi
executada nesta frente.

## Verificação focada

Na raiz MINIJOOMLA:

```powershell
node --input-type=module -e "import('./tests/cassiopeia-template.test.js').then(m => m.runCassiopeiaTemplateTests())"
node tests\menu-tree.test.js
node --check src\templates\default.js
```

Os testes validam HTML, posições, parâmetros, aliases, escaping, binding e
escopo/regras CSS, whitelist de cores, três cores institucionais no estado
normal, base branca, ausência de sombras/misturas e contraste calculado de
texto; não substituem a validação visual no navegador.

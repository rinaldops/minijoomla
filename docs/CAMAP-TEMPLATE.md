# Template CAMAP

> A tela administrativa de estilos (`#/templates/styles`) está conectada à
> composição pública desde a integração registrada em
> [ADMINISTRATION-EXTENSIONS.md](ADMINISTRATION-EXTENSIONS.md) (ver
> `src/libraries/minijoomla/application/site-config-overrides.js`, usado tanto pelo painel quanto
> por `createMiniJoomlaSiteApplication.js`): um parâmetro salvo com ETag no
> estilo padrão do CAMAP chega a `config.templateParams` e é aplicado pelo
> `resolveCamapParams` abaixo na próxima renderização pública — provado fim
> a fim (Node, sem navegador real) em `tests/site-runtime.test.js`. Os
> metadados do formulário já batem com os parâmetros reais consumidos aqui
> (`CAMAP_PARAM_DEFINITIONS`, exportada deste mesmo módulo e reutilizada por
> `src/libraries/minijoomla/application/template-styles.js`), exceto `bandTones` (objeto por
> posição, deliberadamente fora do formulário simples — documentado no
> código). Consulte o [plano de continuidade](PLANO-CONTINUIDADE-MINIJOOMLA.md)
> para o que ainda falta (revalidação em navegador real via FIORI-AUTO).

Implementação própria do shell editorial CAMAP. Toma como modelo a página
publicada composta por mse-platform + CAMAP-AGP (Tema 1). A referência normativa
de cores e tipografia é `web-devs/docs/IDENTIDADE-PETROBRAS.md`. Não reutiliza
código, imagens, fontes, URLs, nomes ou dados desses projetos: a estrutura,
as métricas e os tokens foram observados e reimplementados. O nome da
central é texto e não reconstrói a marca Petrobras.

## Contrato e integração

`renderCamapShell({ config, menus, breadcrumbs, content, modules, busy })` é
puro e retorna HTML. O conteúdo de módulos deve chegar já
renderizado/sanitizado pelo pipeline responsável. Exporta também
`TEMPLATE_POSITIONS` (15), `COMPONENT_POSITION` (`component`),
`BAND_POSITIONS`, `BAND_TONES`, `resolveCamapParams(config)` e
`bindShell(root)`.

O runtime carrega, nesta ordem, `camap.css`, `camap-layout.css` e
`camap-responsive.css`. Todo seletor começa por `.camap-template`, sem
`:root`, `@import`, `url()`, sombras ou `100vw`. Após montar o HTML, o host
chama `bindShell(root)` e executa o cleanup retornado antes do próximo render.

## De-para de regiões (modelo → MINIJOOMLA)

Os documentos de de-para citados em CAMAP2 (`docs/ANALISE-…`, `docs/DE-PARA-…`)
não existem na cópia local. O mapeamento abaixo foi definido a partir de
`positions.css`/`index` do Tema 1 e do mockup Home v3.

| Região do modelo | Posição MINIJOOMLA | Tratamento |
| --- | --- | --- |
| faixa acima do cabeçalho | `topbar` | faixa branca, 8 px, filete cinza |
| cabeçalho (marca + menu + busca) | marca + `menu` + `search` | branco, 76 px, filete `#E3E9ED` |
| faixa abaixo do cabeçalho | `below-top` | faixa branca |
| hero | `banner` | azul-oceano, 360–500 px, divisor amarelo 6 px |
| breadcrumbs | `breadcrumbs` | 10 px, separador “/”, atual em negrito |
| home-a | `top-a` | branco, cards numerados em linha |
| home-b | `top-b` | branco com filete superior |
| conteúdo principal | `main-top` + `component` | coluna central, 32 px |
| laterais | `sidebar-left` / `sidebar-right` | colunas opcionais 14–18,75 rem |
| conteúdo abaixo | `main-bottom` | faixa de largura total após a grade |
| home-c | `bottom-a` | azul-oceano (padrão) |
| home-d | `bottom-b` | verde-água com cards brancos (padrão) |
| rodapé | `footer` | verde, marca e links brancos |

Aliases: `modules.content` → `main-top`; `modules.sidebar` → `sidebar-right`.
Posição explícita e alias são concatenados nessa ordem. `menus` e
`breadcrumbs` são concatenados aos módulos homônimos. Há exatamente um
`data-template-region`/`data-mj-position` por posição, mesmo vazia. Sidebars
vazias recebem `hidden` e não reservam trilha. Com `footer` vazio, o rodapé
mantém marca, nome e descrição; um módulo de rodapé os substitui.

## Parâmetros de estilo

Lidos de `config.styleParams` e `config.templateParams`; ambos podem ser objeto
ou string JSON, e `templateParams` prevalece. Valor ausente ou inválido usa o
padrão, sem erro.

| Parâmetro | Padrão | Efeito |
| --- | --- | --- |
| `brand` | `true` | exibe a marca textual no cabeçalho |
| `siteTitle` | `config.siteName` ou `Central CAMAP-AGP` | nome na marca e no rodapé |
| `siteDescription` | `ENGENHARIA, TECNOLOGIA E INOVAÇÃO` | linha superior da marca/rodapé; `""` oculta |
| `heroKicker`, `heroTitle`, `heroSubtitle` | vazio | com `heroTitle`, o `banner` vira hero; módulos do banner ocupam a coluna direita |
| `heroActionLabel` + `heroActionUrl` | vazio | botão amarelo; URL passa por `safeUrl` |
| `accentColor` | `#FDC82F` | hex ou nome da paleta (`amarelo`, `verde`, `verde-agua`, `azul`, `verde-claro`, `laranja`, `azul-claro`); outros valores são ignorados |
| `fluidContainer` | `false` | remove o limite de 1200 px (mantém o gutter) |
| `backTop` | `false` | link “Voltar ao topo” no rodapé |
| `pairSections` | `false` | `top-a`+`top-b` e `bottom-a`+`bottom-b` lado a lado quando ambos preenchidos |
| `bandTones` | `{ "bottom-a": "ocean", "bottom-b": "teal" }` | tom por faixa (`BAND_POSITIONS`): `white`, `ocean`, `teal`, `green` |

Booleanos aceitam `true/false`, `1/0`, `sim/não`, `yes/no` e `on/off`. Todo
texto é escapado. O destaque só gera `style="--camap-accent:#HEX"` no root
quando difere do padrão.

Validação: valores **ausentes** (`undefined`, `null` ou string vazia) usam o
padrão **sem aviso**. Valores **malformados ou inválidos** também usam o
padrão, para manter o shell seguro, mas nunca são ignorados em silêncio.
Exemplos:

- JSON malformado;
- `styleParams`/`templateParams` que não sejam objeto;
- cor fora da paleta;
- booleano não reconhecido;
- texto não textual;
- posição ou tom inválido em `bandTones`.

Nesses casos, o template emite um único `console.warn` por objeto de config:
`MINIJOOMLA CAMAP: parâmetros de template inválidos; padrões aplicados (…)`.
A mensagem lista apenas os nomes dos parâmetros e o tipo do problema, nunca
os valores recebidos. `resolveCamapParams(config, { warn })` aceita um
registrador injetado. Falha do registrador não interrompe a renderização. O
parsing de parâmetros de outros arquivos não foi alterado.

## Menu móvel e acessibilidade

- O skip link vai ao `main#main-content` sem alterar a rota hash.
- Com menu ou busca, o cabeçalho tem
  `button.camap-template__menu-toggle[aria-expanded][aria-controls]`, que nasce
  `hidden`, com a navegação visível. Sem JavaScript, o menu permanece usável.
- `bindShell` usa `matchMedia('(max-width: 767px)')`. No mobile, mostra o
  botão e recolhe a navegação (`aria-expanded="false"`). No desktop, oculta o
  botão e mantém a navegação aberta. Também acompanha mudanças de largura.
- Escape dentro da navegação, ou no botão, fecha o menu no mobile e devolve o
  foco ao botão. `data-shell-anchor="top"` rola ao topo e foca o skip link.
- O foco programático do roteador no `main` (`tabindex="-1"`) não desenha
  contorno. Ao ativar o skip link, o binder marca o alvo com
  `data-focus-origin="skip"`, que mostra um contorno interno de 3 px; a marca
  é removida no `blur`.
- Os alvos de toque têm pelo menos 44 px. O foco usa contorno de 3 px:
  oceano no branco, amarelo no oceano/verde e preto no verde-água. Há
  suporte a `prefers-reduced-motion` e `forced-colors`.

### Menu em árvore (`.mod-menu-tree`)

O contrato é de `src/modules/mod_menu/tmpl/default.js`: `nav.mod-menu-tree[data-menu-tree]`,
`li.parent`, `button.mm-toggler[data-menu-tree-toggle][hidden]` e
`ul.mm-collapse[data-menu-tree-submenu]`. Os estilos do CAMAP ficam em
`camap*.css`; `default.css` não contém seletores `.camap-template`.

- Sem JavaScript: os botões ficam `hidden` e os submenus aparecem em linha.
  Nenhum link é escondido.
- Os submenus só se recolhem com `bindMenuTree`, que marca o menu com
  `[data-menu-tree-js]` e alterna `.mm-show`. O ícone de seta reflete
  `aria-expanded`.
- Desktop (≥768 px): dropdown absoluto apenas no estado com script.
  - Fundo branco, filete verde de 4 px e largura de 12 a 20 rem.
  - Os dois últimos itens abrem alinhados à direita, para não causar overflow.
  - O 3º nível fica embutido no dropdown.
  - Com JS, somente o botão/`.mm-show` abre o submenu; hover não pode
    contradizer `aria-expanded` nem reabrir o dropdown após Escape.
- Mobile (≤767 px): acordeão estático de largura total, com link e botão
  na mesma linha.
- Links e botões têm 44 px. Hover e foco no submenu mostram filete na cor de
  destaque.
- Escape fecha primeiro o submenu, porque o módulo interrompe a propagação.
  `bindShell` também ignora eventos com `defaultPrevented`. Um segundo Escape
  fecha o painel móvel.
- No resize desktop → mobile, foco dentro do painel volta ao botão antes de
  ocultar a navegação; no sentido inverso, foco no botão passa ao primeiro
  controle da navegação. Cleanup restaura menu visível e botão oculto,
  removendo também listener/marca pendente do foco de skip.
- Anchors de módulos e cliques já tratados por outro binder não são capturados;
  o shell trata somente `main-content` e `top` sem mudar a rota.

## Correspondência visual com o modelo

- Tokens: oceano `#006298`, verde `#008542`, verde-água `#00B2A9`, amarelo
  `#FDC82F`, linha `#75787B`, cinza-claro `#E3E9ED`, hover `#F2F7FA`; laranja
  `#ED8B00` só no estado de erro.
- Contêiner `min(100% - 40px, 1200px)`; o gutter cai para 32 px em ≤560 px.
  As faixas têm 40 px verticais.
- Cabeçalho: marca com linha superior de .62 rem/800, espaçamento .12 em, em oceano e nome
  em verde. Os itens de menu têm 76 px, peso 700 e .9 rem. No hover, o texto
  fica verde e ganha sublinhado de 4 px na cor de destaque; o item atual tem
  sublinhado verde.
- Títulos de módulo têm marcador quadrado de 12 px na cor de destaque. As
  listas viram cards numerados `01`, `02`…, com seta e filete verde de 4 px.
  No verde-água, os cards são brancos, com gap de 2 px e número de 2,75 rem;
  no hover ficam verdes.
- Lista de artigos: grade de 3 colunas (2 em ≤959 px e 1 em ≤767 px), com
  cards de 22 px de padding. A divisória de 1 px é desenhada por cada card,
  com bordas sobrepostas por margem de −1 px. A lista não tem fundo, então,
  com 1 ou 2 artigos, as trilhas vazias não exibem bloco cinza.
- Breakpoints: 959 px (laterais empilham), 767 px (menu móvel, hero em 1
  coluna, cards em linhas) e 560 px.
- Cantos retos em todas as seções, raízes de módulos e controles.

### Divergências deliberadas

- O modelo estende faixas com `100vw`. Aqui elas ocupam a largura total
  **do shell**, sem overflow no host SharePoint.
- O título branco sobre verde-água não atinge AA. Aqui o texto sobre
  verde-água é preto.
- O foco amarelo sobre branco fica abaixo de 3:1, por isso a cor do foco
  varia conforme a superfície.
- Não há fotografia no hero nem marcas de profundidade/selos ilustrativos.
  Imagens aprovadas devem vir do módulo `banner`.
- Como o sanitizador remove classes, o estilo de módulo se baseia na
  estrutura (`h2`, `ul > li > a`, `.custom-html`), não em classes do modelo.

### Fechamento estático de 03/11/2026

**Aceite integrado posterior:** DOM nativo local 320/768/1366/1920, laterais
vazias/preenchidas, um h1, sem overflow, menu/submenu Enter/Escape/skip e foco
após resize passaram pelo FIORI-AUTO (aguardar media/render frame no resize).
Host CAMAP 0.2.1 foi publicado e relido com CSS/imagem carregados e chrome
SharePoint intacto. Isso não aprova extensões CAMAP2, zoom real/forced-colors,
ativos não fornecidos ou equivalência visual integral; ver handoff/runbook.

Consulta somente leitura do contrato `web-devs/CAMAP2/docs/CONTRATO-EXTENSOES.md`
e de `extensions/camap/mod_hero/module.js`, `mod_hero/hero.css` e
`mod_home/home.css` nessa referência. Nenhum código, imagem, fonte ou ativo
foi copiado. Comparação concreta:

- o hero nativo MINIJOOMLA já usa **`h2`**, enquanto `CAMAP2/mod_hero`
  produz `h1`; teste com `renderArticle()` protege o único `h1` do artigo;
- hero CAMAP2 empilha em 700 px; este shell conserva 767 px para alinhar
  hero e menu móvel, sem copiar suas métricas;
- `CAMAP2/mod_home/home.css` contém superfícies com `rgba(0,0,0,.1)` e tons
  `#267AA7/#3381AD/#1A72A2`. Não foram reproduzidos: o shell mantém azul
  oficial sólido e cantos retos conforme a diretriz de identidade;
- foram corrigidos encolhimento de breadcrumbs/CTA com texto sem espaços,
  largura do skip link, tabelas/`pre` em `lead`, teasers e módulos customizados,
  alvo de busca de 44 px, e foco contrastante interno em CTA amarelo;
- seletores de foco mais específicos do skip/CTA agora também respeitam
  `Highlight` em cores forçadas, sem redefinir identidade.

**Riscos fora do shell / aprovações pendentes:**

- Montar `camap.mod_hero` no banner junto a artigo ainda pode adicionar outro
  `h1` (e múltiplas instâncias usam o mesmo `camap-hero-title`). O shell não
  reescreve HTML de extensões. A extensão precisa contratar nível de título
  e identificadores por instância antes dessa composição; não alterada aqui.
- `mod_home` não é comprovação de identidade: superfícies escurecidas e tons
  não oficiais precisam de resolução pela frente CAMAP2/responsável pela
  marca antes de uso corporativo; o fato de a referência local existir não
  é aprovação. Conteúdo/assets/fontes inseridos por módulos são responsabilidade
  do pipeline e precisam de autorização própria.
- `accentColor`/`bandTones` aceitam cores oficiais, mas isso sozinho não
  valida o limite de três cores por composição, predominância branca e
  contraste dos marcadores sobre cada faixa. Validar a configuração concreta.
- A hierarquia editorial do hero `h2` antes do título principal e a
  ausência de `h1` quando `showTitle=false` são escolhas da composição de
  conteúdo, não corrigidas com headings artificiais no shell.

Pendente da coordenação via FIORI-AUTO: 320/768/1366/1920 px, zoom 200%/400%,
textos longos sem espaços, introtext com tabelas/`pre`, 1/2/3 cards, três níveis
de menu, Tab/Shift+Tab/Escape/skip, resize com foco, cores forçadas e validação
de fotos/logos oficiais. Testes Node não comprovam ausência de overflow ou
contraste renderizado no navegador/SharePoint. Esta frente não usou rede,
navegador nem publicação.

## Verificação

```powershell
node tests/run-tests.js *> tmp\camap-tests.txt; "EXIT=$LASTEXITCODE"
node scripts/check-syntax.js
node scripts/release-check.js
```

`tests/camap-template.test.js` cobre:

- posições, ordem das regiões e o cabeçalho;
- faixas fora da grade lateral, aliases e sidebars;
- rodapé padrão e personalizado;
- parâmetros, incluindo JSON, precedência, *whitelist* de destaque, tons,
  hero, `pairSections`, `fluidContainer`, `backTop` e `brand`;
- binder do menu móvel, com Escape, mudança de largura e cleanup;
- escopo de todos os seletores, cores da identidade e métricas-chave do CSS;
- montagem por `createApplication`.

Esses testes não comprovam a renderização visual. A validação visual
integrada cabe à coordenação, pelo FIORI-AUTO. Esta entrega não publica nada.
### Limite do runtime corporativo nesta entrega

Executor (`claude-sonnet-5`/`litellm`) e revisor
(`gpt-5-2-petrobras`/`azure_openai`) foram invocados pelo host `run_agent`
com `ToolPolicy`, consentimento e validação efetiva do destino PROD HTTPS.
Ambos encerraram com `runtime_unavailable`, zero chamadas ao modelo e zero
tokens: o SDK opcional `agents` está ausente no Python compartilhado.
O restore pelo feed corporativo, tentado pela frente paralela, encontrou
bundle de CA configurado inexistente; não foi repetido nem houve alteração
de TLS/proxy/certificados. Portanto **não houve implementação ou revisão
concluída por modelo corporativo**. A implementação e revisão estática locais
foram realizadas diretamente; envelopes sanitizados ficaram em
`tmp/camap-hub-executor.json` e `tmp/camap-hub-reviewer.json`.

# Highlights — contrato real e próximo aceite individual

> **Evolução posterior do ciclo:** ensaio no site confirmou também o título
> ocupando a primeira célula. A adaptação final corrigiu classes **e** aplicou
> `grid-column:1/-1` somente ao h2 horizontal; o pacote foi adotado na 0.14.0.
> [Teste, análise, validação e limites vigentes](CICLO-HIGHLIGHTS.md).
> Seções abaixo sobre patch só de classes/full-span pendente descrevem a primeira
> iteração e a fonte original; `auto` vertical sem width continua limite vigente.

Análise independente local em 08/11/2026, sobre MINIJOOMLA
`24b995a3da913238dcec38b42e20ac2378f9c117` (`MINIJOOMLA-worktree02`).
**Não é recibo de instalação, publicação ou validação visual.** Nenhuma fonte
CAMAP2, código do projeto, host, registro ou licença foi alterado nesta frente.
Somente este documento e o ensaio `tmp/highlights-analysis-audit.mjs` são novos.
Não houve rede, navegador, tenant, build/npm completo ou commit.

## Decisão e ciclo

O próximo candidato é **somente** `camap.mod_camap_highlights`, após o primeiro
editorial já documentado em [ETAPA-2C-EDITORIAL-ADOTADO.md](ETAPA-2C-EDITORIAL-ADOTADO.md).
Manter a sequência solicitada: **desenvolvimento → site → análise → validação
→ documentação**, fechando este módulo antes de escolher o seguinte. Não
transformar a fila dos nove restantes em instalação/adaptação automática em lote.

A fonte atual não comprova os três layouts visualmente: CSS e markup divergem,
e o runtime não entrega largura ao renderer. Preparação individual é possível;
o aceite exige resolver/explicitar esses gates, além dos dados e URLs. A correção
do editorial não modifica o helper empacotado do highlights antigo. A coordenação
delimitou o terceiro patch do builder a **`.camap-dt1` → `.camap-highlights`**, sem
mudar propriedades, estrutura HTML ou breakpoint; esta análise não redesenha esse
patch. Atum e Cassiopeia, seus estilos e contratos, permanecem intactos.

## 1. Escopo e parâmetros efetivamente consumidos

Fontes: `../CAMAP2/extensions/camap/mod_camap_highlights/module.js:1-4`,
`highlights.css:1`, XML `mod_camap_highlights.xml:19-25` e
`../CAMAP2/extensions/camap/_shared/render.js:1-3`.

| Parâmetro | Contrato original | Default |
| --- | --- | --- |
| `title` | string; XML `text` | `""` |
| `layout` | enum `horizontal`, `vertical`, `auto`; XML `list` | `auto` |
| `items` | array; XML JSON com `mj:valueType="array"` | `[]` |

Item consumido: **`{ title, description?, url? }`**, com nomes minúsculos exatos.
Título e descrição viram texto escapado. Se `url` for truthy, há um link de texto
fixo **“Saiba mais”**, após `safeUrl` e escape de atributo. Não há `target` ou
`rel` adicionais. URL omitida/vazia não produz link; uma URL truthy recusada pelo
helper produz `href="#"`, não omissão do link.

Não há aliases implementados: `Title`, `Description`, `URL`, `href`, `summary`,
`imageUrl`, `imageAlt` e `alt` não substituem os campos canônicos. Também não
existem `limit`, `columns`, `width`, `state`, `headingTag`, `introText`, CTA geral
ou provedor/lista de dados no schema. Chaves legadas preservadas não viram recursos.

É um **módulo textual de apresentação**, não um componente de catálogo/backend.
Não renderiza imagens, vídeo ou HTML rico; não faz fetch, busca, paginação,
carrossel, medição DOM, timer ou binding próprio. Recebe a lista em settings.
O runtime do site continua realizando suas próprias leituras de conteúdo e
registros; ausência de fetch no módulo não significa ausência de rede no host.

### Dados inválidos: caracterização original, não validação já implementada

- `items` fora de array: renderer usa `[]`; XML/admin deve recusar tipo externo
  inválido. JSON denso e seguro estruturalmente não valida cada item.
- `items:[null]`: acesso a `i.title` lança `TypeError`. O registry captura e
  retorna `<p class="module-error" role="alert">…</p>`, sem recuperar os cards.
- Escalares/arrays como itens e propriedades ausentes podem produzir cartões
  vazios; título `undefined` usa o default `""` de `escapeHtml`, título `null`
  vira o texto `null`. Outros tipos podem ser convertidos em texto sem significado.
- `description:null` vira vazio pelo `??`; descrição com tipo inválido não é
  rejeitada pelo renderer. `url` inválida truthy passa pela coerção do helper.
- `layout` desconhecido em chamada direta vira sufixo de classe escapado, sem
  fallback explícito. O campo enum do XML recusa valores fora das três opções.
- Não há teto de itens do módulo. Os limites genéricos JSON de
  `declared-params.js` não são um limite editorial de quantidade.

Gate inicial proposto: 1–3 objetos de dados simples, título string não vazio,
descrição opcional string, URL omitida/vazia ou fragmento local revisado. Revisar
todas as edições, não somente a fixture inicial. O número 3 é **limite de ensaio**,
não campo/bound novo do XML. Normalização defensiva deve ocorrer em uma adaptação
isolada e testada, sem apagar itens/configurações persistidos ou inventar aliases.

O helper atual aceita prefixos `#`, `/` e `https://`, inclusive protocolo relativo,
backslash e HTTPS com credenciais. HTML escapado não é política de destinos.
Bloquear URLs arbitrárias até hardening/revisão; testar destinos neutros sem
navegá-los. Não importar uma correção por associação ao editorial: selecionar,
documentar e inventariar os bytes do helper desta nova revisão individual.

## 2. HTML, headings e estados

Para `ready`, a árvore é literalmente:

```html
<section class="camap-highlights camap-highlights--vertical">
  <h2>Destaques locais</h2>
  <article>
    <h3>Item A</h3>
    <p>Descrição local</p>
    <a href="#/">Saiba mais</a>
  </article>
</section>
```

Não há h1, IDs, `aria-labelledby`, `role` explícito na section ou associação
individual dos links repetidos. Não declarar um landmark nomeado nem nomes de
link diferenciados que o renderer não emite. Avaliar leitura do h2/h3 e contexto
dos links “Saiba mais” na composição concreta.

`showTitle`, `headerTag` e `headerClass` são passados pelo registry, mas não são
consumidos aqui: `showTitle:false` **não oculta** o h2 interno, nem `headerTag:h3`
o converte. Default `title:""` ainda emite `<h2></h2>`; a fixture aceita deve
preencher título significativo. `moduleClass` envolve o HTML somente quando
não vazia: `<div class="module CLASSE"> <section>…</section> </div>`.
Logo, `.module>h2` do shell não seleciona esse h2 aninhado; não prometer marcador
quadrado de título pelo chrome. Não acrescentar um heading duplicado no wrapper.

| Contexto `state` | Saída original | Limite do aceite |
| --- | --- | --- |
| ausente / `ready` | section + h2 + todos os artigos | Com `items:[]`, section e h2, **sem** mensagem empty |
| `empty` | `<p role="status">Nenhum conteúdo disponível.</p>` | Substitui cards, mesmo se houver itens; sem section/h2 |
| `loading` | `<p role="status" aria-live="polite">Carregando…</p>` | Sem spinner, skeleton ou transição implementados |
| `error` | `<p role="alert">Não foi possível carregar este módulo.</p>` | Não tem classe `module-error`; diferente do catch do registry |

`createApplication` não fornece `state` aos módulos gerenciados. Esses três ramos
são comprováveis por chamada local controlada, não por colocar `state` no JSON da
instância. O busy/loading da página também não implica loading individual deste
módulo. Não prometer mensagens com borda/cor por classe: o helper não emite
`module-loading`/`module-empty`/`module-error`. Uma adaptação que trate lista vazia
como empty ou acrescente classes deve registrar essa diferença e testes próprios.

## 3. Largura e CSS: dois contratos diferentes

### `auto` usa contexto, não a largura observada da instância

O original calcula `Number(width) >= 760`, com `width = 0` por default.

| `render({ settings:{layout:"auto"}, width })` | Classe |
| --- | --- |
| ausente/`undefined`, `null`, 0, 759, string não numérica | `camap-highlights--vertical` |
| 760, 761, `"760"` | `camap-highlights--horizontal` |

`horizontal` e `vertical` explícitos ignoram width. `registry.js:16-19` preserva
`...context`; portanto um chamador que realmente forneça width o repassa.
**Isso não significa que a instância gerenciada o forneça:**

1. `dynamic-modules.js:224-263` deriva entries de `settingsJson`, posição,
   ordering, atribuição e chrome; não extrai largura.
2. `src/libraries/minijoomla/index.js:296-314` monta `moduleContext` com dados e
   roteamento, sem `width`/`state`, e chama `renderPosition(position,[entry],context)`.
3. `createMiniJoomlaSiteApplication.js:21-25` liga repositórios a esse runtime,
   sem medidor/injeção de largura de módulo.

O ensaio Node pelo **`createApplication` real**, com adapter local, loader
injetado e `documentRef:null`, confirmou contexto sem width/state. Mesmo
`settingsJson` contendo `width:999,state:"empty"`, o original ficou `ready` e
vertical: são propriedades de settings, não argumentos de contexto.
Não houve DOM, navegação/requisição ou registro real nesse ensaio.

Aceite inicial: layouts explícitos, mantendo default auto documentado como
vertical no caminho atual. **Auto responsivo verdadeiro é gate não fechado**:
exige contrato implementado/testado de largura real e rerender/cleanup, ou uma
adaptação responsiva local com semântica declarada. Não alterar silenciosamente
o núcleo nem anunciar resize responsivo só porque o helper recebe `width:760`.

### CSS atual não seleciona o markup

O arquivo atual inteiro é:

```css
.camap-dt1{padding:1rem 0}
.camap-dt1 article{border-left:.25rem solid #006298;padding:1rem}
.camap-dt1--horizontal{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
@media(max-width:700px){.camap-dt1--horizontal{grid-template-columns:1fr}}
```

O renderer emite `.camap-highlights`, **não** `.camap-dt1`. Não há regra para
`.camap-highlights--horizontal`/`--vertical`, flex, auto-fit, gap, heading full-span,
cor de texto ou fundo. CSS pretendido usa **grid de duas trilhas fixas**, com
redução a uma em viewport ≤700 px, não limiar de contexto 760 px.

Consequência estática: no DOM original sem classe legada acrescentada, essas
regras não aplicam grid, padding ou borda aos highlights. Com apenas estilos
inspecionados e defaults do navegador, section/article são blocos;
`grid-template-columns` é `none`. Isso é expectativa a conferir, **não medição
visual realizada**. Folha carregada e classe `--horizontal` não comprovam colunas.

### Primeira iteração coordenada: patch exato de classes

Substituir somente `.camap-dt1` por `.camap-highlights` na cópia isolada mantém
padding `1rem 0`, artigos com padding `1rem`/borda esquerda `.25rem solid #006298`,
horizontal `display:grid`/duas trilhas `minmax(0,1fr)` e media ≤700 px/uma trilha.
Não há full-span de heading nesse patch. Não inventar flex, gap ou auto-fit.

Propriedades esperadas para verificar **no site**, não medições desta frente:

| Alvo após patch exato | Computed style esperado, sem override externo |
| --- | --- |
| section horizontal, viewport >700 px | `display:grid`; `gridTemplateColumns` serializa duas larguras em px, não necessariamente a string `repeat(2,…)`; `gridAutoFlow:row`; `rowGap/columnGap:normal` (sem gap definido) |
| section horizontal, viewport ≤700 px | `display:grid`; `gridTemplateColumns` com uma largura |
| section vertical | `display:block`, `gridTemplateColumns:none` pelos defaults; a classe vertical não tem regra própria |
| section em ambos os layouts | padding top/bottom `1rem`, left/right zero (16 px verticais se root font-size for 16 px) |
| article | padding `1rem` nos quatro lados; borda esquerda sólida `.25rem`, `rgb(0, 98, 152)` (4 px se root font-size for 16 px) |
| h2 direto | `gridColumnStart/End:auto` e `gridRowStart/End:auto`; nenhuma declaração `1 / -1` |

`gridColumnStart:auto` sozinho não revela a célula usada; combinar propriedades
com as caixas dos três filhos. Não comparar serialização computada de colunas
em px à expressão CSS literal nem exigir 16/4 px quando o tamanho de rem diferir.

O ensaio puro original com dois itens confirmou três filhos diretos nesta ordem:
**h2, article A, article B**. Depois do patch exato, acima de 700 px e na ausência
de outra regra de placement, a auto-colocação CSS esperada é:

| Elemento direto | Linha | Coluna |
| --- | ---: | ---: |
| h2 | 1 | 1 |
| article A | 1 | 2 |
| article B | 2 | 1 |

Em ≤700 px, a única trilha coloca h2/A/B nas linhas 1/2/3. Com três itens,
o terceiro artigo ocuparia linha 2/coluna 2 acima do breakpoint. Logo, ver duas
trilhas não comprova duas colunas de **cards após um título de largura inteira**.
Aplicar classe horizontal apenas ao wrapper não corrige isso: a section aninhada
é o único grid item. Não usar esse workaround nem alterar Atum/Cassiopeia.

Essas são **expectativas estáticas**, não layout medido no navegador. A primeira
passagem no site deve conferir a revisão exata, propriedades computadas e caixas
de h2/artigos; registrar a disposição real na etapa de análise. Se o requisito
editorial confirmar título full-span e artigos A/B na mesma linha seguinte,
essa discrepância será defeito de apresentação a resolver na **segunda iteração**
do ciclo, com patch próprio aprovado, testes e nova revisão imutável — não uma
mudança antecipada deste builder. Separar integridade do patch de aceite final
do layout desejado; não aprovar full-span inexistente.

Outros limites dessa primeira iteração:

- `auto` gerenciado continua vertical sem width; classe corrigida não injeta
  largura nem transforma 700 px de viewport em 760 px de contexto.
- A borda azul fixa passará a aplicar e ficará sem contraste sobre `bottom-a`
  ocean. Priorizar `top-a`; contraste em faixa colorida é ensaio/decisão posterior,
  não justificativa para mudar cor/tom global silenciosamente.
- Se heading/borda/auto exigirem mudanças após análise do site, fechar cada
  correção delimitada no mesmo ciclo antes do módulo seguinte.

## 4. Posição gerenciada e herança

Proposta conservadora: **uma instância nova em `top-a`**, título neutro e layout
vertical inicial; não mover/substituir instâncias existentes, inclusive editorial
em `main-bottom`. `bottom-a` é alternativa para ensaio de contraste, não mudança
automática de posição. Confirmar ocupação e ordering antes da criação e não
reordenar registros antigos. Preservar template, `bandTones`, `pairSections`,
menus, artigos, piloto e configuração anteriores.

Defaults locais do shell CAMAP (`src/templates/camap/index.js:13,150-169` e
`src/media/templates/site/camap/css/template.css:1,4-6,82-89`):

| Posição/default | Superfície e texto/link esperados pelo shell | Foco |
| --- | --- | --- |
| `top-a`, sem tom | branco `#FFFFFF`; texto preto; link ocean `#006298` | ocean, outline 3 px |
| `bottom-a`, ocean | fundo `#006298`; texto/h2/h3/link brancos | amarelo `#FDC82F`, outline 3 px |

Highlights não define cor de texto/fundo: herda a tipografia/cor do ancestral;
o CSS declara apenas a cor da borda. O link usa regra
global `.camap-template a`. Verificar `getComputedStyle`, não assumir o default
se o estilo ativo tiver overrides. Medir contraste real (texto normal ≥4,5:1,
texto grande ≥3:1, indicador de foco ≥3:1) e ausência de recorte. A section pode
ter fundo computado transparente: conferir o fundo efetivo do ancestral.
Grid das **posições pareadas** não é grid dos **artigos**. Não ligar pairSections
para simular horizontal ou acrescentar duas instâncias para simular duas colunas.

## 5. Proveniência local focal, sem identidades privadas

Raiz Git real de CAMAP2: agregador **`..`**, commit local
`3f49a77db0760ffa7ca3c7d63fdba2f88d015f0a`. CAMAP2 não tem `.git` próprio;
`git ls-tree 124ac3… -- CAMAP2` retorna `040000 tree`, não gitlink/submódulo.
MIT existe em **`../LICENSE`**, inclusive no commit que introduziu os arquivos
exatos de highlights/helper/CSS. Conferidos cabeçalho MIT, grant, obrigação de
preservar aviso e disclaimer, sem imprimir copyright/identidades neste relatório.

Histórico local com formato somente hash/data, sem autores, mensagens ou remotes:

```text
git log --all --format="%H %cs" -- CAMAP2/extensions/camap/mod_camap_highlights/module.js CAMAP2/extensions/camap/mod_camap_highlights/highlights.css
```

- `124ac3ea1d002fe7dc517a7d03513d1238396dac` (02/11/2026): introdução; JS,
  helper e CSS atuais correspondem após CRLF/CR → LF, preservando conteúdo/BOM.
- `a71f1f6926912183aec2deda1f9b79891a80e583` (04/11/2026): revisão posterior;
  esses três arquivos **não correspondem** aos bytes locais atuais após LF.
  Não foi tomada como correção já aplicada. LICENSE é igual após LF nos dois.

Blobs originais exatos: módulo `03c68688f0d632b428cb2e95d14c31dc627792cd`;
CSS `30329d23ca5bacd64950896b98aa5a582a09a6bd`;
helper `7e1f9a068d8ee8f2e236a4650f694fbaa60cfc23`;
licença `c32140d07487f1113fa2d80873a86f81502606fa`.

| Arquivo | Bytes atuais | SHA-256 dos bytes atuais | SHA-256 após LF |
| --- | ---: | --- | --- |
| `../LICENSE` | 1102 | `9f855c789f6d1bd404f856ea7c3e7af498e0ee2cc1e842a47ed2559cac09a1a9` | `7e9fc2fab3b2511d64d64c1e0f00fc6a9b920801f3de8e608117ff1000200b7c` |
| `../CAMAP2/extensions/camap/mod_camap_highlights/module.js` | 1070 | `b33ce70f8e3a12c422dec6a0540429dd4657d2421ffd3bf0f35a053733a52872` | `64b687c2bb0781652f217992a4df063af65bb549695859d767a27bb5b7ff3af2` |
| `../CAMAP2/extensions/camap/mod_camap_highlights/highlights.css` | 252 | `50bb64f94cc5b9ffdf19aba6f84a230aac19eb1723c6ee55e0e9457f82e32e27` | `e9f8bc83be5b485a545c72a93f8417f1c0d58eca3acfbae099ad30923cdb8ab7` |
| `../CAMAP2/extensions/camap/_shared/render.js` | 654 | `fd6166e3e3ef13253d4cab93f38d098b1d373548233fea27b727fef42a48795e` | `33a925627f241ae6ed379ddaea89a53acfa24cbe91819aa36c1d0ba08aec5387` |

Inspeção focal de nomes `LICENSE`, `LICENSE.md`, `LICENSE.txt`, `COPYING`, `NOTICE`
em CAMAP2, `extensions`, `extensions/camap`, highlights e `_shared`: ausentes.
Isso **não nega a MIT da raiz real**. Módulo importa somente `_shared/render.js`;
CSS não contém `url()`/`@import`/assets. Wrapper/schema reexportam o módulo; o
wrapper/XML registram o gerador `tools/sync-joomla-sources.js`. Manifesto JS local
declara 0.1.0 e XML gerado 0.1.1: nova revisão deve fixar versão coerente pelo
preparador, não tratar esses números como versões já instaladas.

Há base documental local para preparar o grafo próprio mínimo sob a declaração
MIT do agregador, limitada aos direitos de seu titular. Histórico não prova
originalidade exclusiva; não é parecer jurídico nem licença global de CAMAP2.
Distribuição de cópias/porções substanciais deve incluir o aviso MIT **integral**,
inclusive copyright, no pacote apropriado; esta nota genérica não o substitui.
Registrar adaptações próprias separadas, preservando avisos, sem atribuir GPL
do MINIJOOMLA a toda origem. Material/port/assets adicionais requerem gate próprio.

`sourceLicensePresent:false` histórico descreve o local/pacote procurado, não
ausência da MIT aplicável. `rightsApproved:false`/`publicationApproved:false`
históricos não são parecer de ilegalidade ou proibição definitiva; tampouco
devem virar true por conveniência. Manter recibos anteriores e registrar a nova
decisão/evidência delimitada separadamente. Não confundir gate técnico ou aprovação
operacional com autorização ampla de distribuição/dados.

## 6. Plano de aceite — histórico da primeira iteração

O coordenador executou o ciclo posterior documentado em [CICLO-HIGHLIGHTS.md](CICLO-HIGHLIGHTS.md),
com correção adicional full-span, instância real, geometrias/layouts, revisões e
preservação. As propostas de patch somente de classes abaixo são históricas;
não representam pendência atual dessa correção nem evidência remota desta frente.

### Desenvolvimento e checagens locais focais

1. Congelar fontes/hashes; preparar **apenas highlights**, com duas revisões
   imutáveis novas. Patches isolados de itens/helper e terceiro patch CSS **somente
   de classes**, conforme delimitação coordenada; nenhuma alteração silenciosa
   da fonte irmã, dos pacotes antigos, do núcleo, de Atum ou de Cassiopeia.
2. Conferir XML/defaults/chave/versão, closure JS/CSS, avisos/fontes preferidas,
   inventário e pin; excluir código/HTML/imagens/dados/serviços de outros módulos.
3. Exercitar texto escapado, aliases ignorados, item nulo/tipos inválidos, URL
   segura/recusada, ready sem itens e estados diretos. Separar caracterização da
   origem dos resultados esperados da adaptação; não mascarar falha original.
4. Preservar testes `width` ausente/759/760/761 e explicit layouts; provar o caminho
   gerenciado, não só chamadas unitárias. Se auto verdadeiro não for implementado,
   manter limitação explícita e não aprová-lo como responsividade de instância.

Repetição da caracterização desta frente: `node tmp/highlights-analysis-audit.mjs`.
Usa fontes já revisadas, Node local, Git hash/data, fake adapter e loader injetado;
assertions passaram no baseline acima. Não gera pacote, não executa gerador,
não altera dados, não navega nem usa DOM double como prova visual.

### Site e preservação, somente pela frente coordenadora autorizada

1. Revalidar snapshot privado de registros/configuração/ETags e ocupação de
   `top-a`. O fechamento anterior documenta 44 registros e quatro raízes;
   **esta análise não releu a contagem/configuração remota atual**. Preservar
   integralmente os registros existentes e a amostra, não reinstalar Sample Data.
2. Manter as **quatro raízes anteriores idênticas**, inclusive seus `discover`,
   pins, URLs/revisões de CSS; acrescentar só duas roots de highlights: total
   proposto **6**, dentro do teto **10**, que inclui `discover:false`.
   Descobrir só revisão ativa de highlights e manter a outra aprovada para rollback.
   `mergeExtensionsConfigs` pode desligar descoberta das entradas anteriores
   (`index === último`): comparar o resultado e não alterar piloto/editorial por
   acidente ao concatenar/mesclar planos. Não elevar teto nem retirar roots em uso.
3. Se a contagem real divergir, recalcular a capacidade antes da expansão.
   Quatro vagas propostas restantes não autorizam os oito módulos seguintes;
   agrupamento futuro exige preparador/inventário/gates próprios e decisão separada.
4. Descoberta/verificação sem executar entrypoint; cadastro inicial desabilitado,
   cancelamento/Escape sem gravação e cadastro confirmado sem instância automática.
   Habilitar somente extensão prevista e criar **uma** instância nova revisada.
   Fixture: título “Destaques locais”, layout vertical, 1–3 itens neutros, URLs
   omitidas ou fragmentos locais aprovados; posição `top-a`, ordering/assignment
   explícitos sem reordenar antigos. Não persistir URLs maliciosas de contraprova.
5. Releitura de dados e site; edição pelo formulário preserva key/ID/atribuição/
   posição/ordering e parâmetros alheios. Conflito de ETag não grava nada.
   Alternar extensão e instância separadamente; render/CSS sai e volta sem perda.
6. Atualização → segunda revisão → reversão, com JS/helper/CSS exatos, mesma
   instância e snapshots antigos idênticos. Guardas de remoção não podem ser
   contornadas por exclusão. Distinguir operação por serviço da executada pelo
   botão real do painel; atualizar/reverter descoberta do highlights sem mexer
   nos flags anteriores. Rollback nunca requer apagar os registros novos/antigos.

### Análise/validação visual e funcional no site

FIORI-AUTO da sessão coordenadora, instância exclusiva e escopo já autorizado;
nenhum navegador foi usado nesta análise. Capturar apenas evidências necessárias,
mantendo endpoints, IDs, ETags e screenshots privados fora da documentação pública.

| Ensaio | Evidência concreta exigida |
| --- | --- |
| CSS da revisão ativa | Hash/bytes/MIME/CSP e um link `data-mj-module-style` correto; sheet antiga sai na troca/disable sem afetar outras |
| Horizontal, patch exato de classes | `.camap-highlights--horizontal`; `display:grid`, duas trilhas computadas em >700 px; h2/A/B diretos. Registrar expectativa h2+artigo A na linha 1, artigo B na linha 2, não aprovar título full-span inexistente |
| Placement/título com dois itens | Medir `getBoundingClientRect` de h2/A/B, `gridColumnStart/End` (esperados `auto`), largura do h2 e alinhamento dos artigos; comparar linhas/colunas com tolerância de arredondamento. Se full-span for requisito confirmado, abrir correção na segunda iteração, não redesenhar o primeiro patch |
| Vertical corrigido | `.camap-highlights--vertical`; uma coluna de articles, sem grid do wrapper confundido com layout interno |
| Auto original / adaptado | Original gerenciado fica vertical sem width; adaptação, se houver, prova limiar 759/760/761 da largura contratada, resize e cleanup; não só viewport |
| Breakpoints | Viewports 700/701 para CSS original e patch exato (1/2 trilhas), 759/760/761 para lógica contextual, e 767/768 para shell; valores não são equivalentes |
| Reflow | 320/768/1366/1920, zoom 200%/400%, 1/2/3 itens, título/descrição longos sem espaços; `scrollWidth`/caixas sem overflow/clipping |
| Herança | Cor/fundo efetivo de `top-a`; se `bottom-a` ensaiado, branco sobre ocean, foco amarelo e borda visível; não mudar tom global para esconder defeito |
| Headings e teclado | h2 não vazio, h3 por artigo, sem h1 extra/heading duplicado; Tab/Shift+Tab/Enter/foco visível nos links e destino aprovado real |
| Estados | `ready`/vazio originais e ramos diretos conforme tabela; catch do registry separado; sem alegar spinner/empty automático/estado persistível |
| Preservação | Snapshots/ETags de todos os anteriores idênticos; só extensão/instância previstas novas; piloto, editorial, conteúdo, menus e template preservados |

Documentar resultado observado, revisão, limites e contraprovas **depois** desse
ciclo. Gates da fonte original: CSS desalinhado; dados/URL sem defesa suficiente;
auto gerenciado sem largura. O patch de classes resolve o primeiro, não width,
full-span ou contraste de borda em ocean. Placement/título depende de análise
no site e, se necessário, segunda iteração antes do aceite final. Proveniência focal está
documentada, mas pacote novo/avisos e aceite de site continuam pendentes.
Nenhum resultado local fecha gate visual, tenant ou distribuição pública ampla.

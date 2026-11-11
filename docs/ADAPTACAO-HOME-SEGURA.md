# Adaptação segura e isolada da Home

> **Validação posterior do coordenador:** as duas revisões 0.4.x passaram no site
> público/admin, inclusive cada counter/label a 180 px, após correção e reteste.
> Formulário/teclado em memória; Home não instalado, oito raízes/48 itens intactos.
> [Resultado completo e limites](CICLO-HOME-ISOLADO.md). O histórico desta frente
> abaixo distingue os testes do builder da aceitação isolada posterior.

**Builder corrigido e testes locais concluídos; novo probe final e revisão
independente ficam com o coordenador.** Perfil fechado `mod_home` /
`camap.mod_home`, novas revisões `0.4.0` e `0.4.1`. As provas imutáveis
`0.3.0`/`0.3.1` permanecem intactas, mas falharam no gate de stats da raiz
pública 180px e não foram adotadas. Nenhuma instalação, publicação, configuração do host,
alteração de tenant/registros ou clearance global foi executada nesta frente.

## Contrato original preservado

Oito campos na ordem original, sem aliases ou opções novas:

| Campo | Tipo XML | Restrição original | Default completo |
| --- | --- | --- | --- |
| `eyebrow` | text | maxlength 80 | `Digital workspace` |
| `title` | text | maxlength 180 | `Tecnologia que conecta. Pessoas que transformam.` |
| `primaryHighlight` | text | maxlength 80 | `conecta` |
| `secondaryHighlight` | text | maxlength 80 | `transformam` |
| `description` | textarea | maxlength 400 | `A shared space for useful content, discussions and learning.` |
| `primaryAction` | JSON object | — | `{"label":"Open discussions","href":"#discussions"}` |
| `secondaryAction` | JSON object | — | `{"label":"Browse videos","href":"#videos"}` |
| `stats` | JSON array | — | array abaixo |

```json
[
  {"value":"17","label":"ENCONTROS REALIZADOS"},
  {"value":"1×/mês","label":"ENCONTRO AO VIVO"},
  {"value":"—","label":"APRESENTAÇÕES REALIZADAS"},
  {"value":"—","label":"MENSAGENS NO FÓRUM"}
]
```

`secondaryHighlight` **já não era usado no renderer original**. Permanece no
schema/defaults, sem implementar silenciosamente um segundo destaque. O
primeiro destaque mantém a busca `toLocaleLowerCase('pt-BR')`, o primeiro match
e os mesmos limites de `slice`, escapando separadamente texto e conteúdo do span.

Os counters são **estáticos**, não métricas vivas. `#discussions` e `#videos`
são fragmentos históricos, não garantias de backend ou navegação implementada.
Fixtures de ações personalizadas usam destinos locais neutros ou
`example.invalid`, sem chamar rede. O módulo não implementa imagens, vídeos,
carrossel, timers, consultas ou chrome/header.

## Exatamente três patches de fonte

### 1. Helper compartilhado

Reutiliza byte-exatamente `SAFE_URL_SOURCE` de
`scripts/prepare-editorial-adaptation.js`. Aceita fragmentos, caminhos
server-relative não protocol-relative e HTTPS sem credenciais. Rejeita
whitespace, controles, barras invertidas, protocolos alternativos e evasões
percent-encoded. Retorna os bytes seguros originais; não reconstrói a URL.
Só o helper no **novo pacote isolado** muda.

### 2. Renderer defensivo e nome acessível

- Inspeciona descritores próprios de objetos plain (`Object.prototype` ou
  prototype nulo), sem chamar getters, `toJSON`, métodos de coerção ou funções.
- `title`, `eyebrow`, `description` e highlights explicitamente não-string
  tornam-se strings vazias na cópia de renderização. Valores válidos continuam
  escapados; não há coerção de objetos.
- Actions preservam o merge original de campos **ausentes**: `{}` válido usa
  label/href defaults e um override parcial válido preserva o campo omitido.
  Override explícito inválido — null, undefined, tipo incorreto, getter, label
  branco ou href inseguro/`#` — **omite a ação**, sem restaurar o default e sem
  link de fallback. Label válido continua trimado como no original.
- Um objeto settings/context inteiro recusado por accessors, funções ou
  prototype inválido não recupera CTAs defaults. Settings inválidos não são
  persistidos nem serializados pelo renderer.
- `stats: []` e tipos legacy não-array mantêm o fallback original dos quatro
  counters. Arrays esparsos, accessors, propriedades extras ou mais de 500 itens
  são recusados. Array não vazio válido inspeciona só os primeiros oito itens;
  cada item precisa de `value` e `label` próprios string. String vazia continua
  aceita como no original; linhas inválidas são filtradas sem fallback.
- `renderHome(settings, state)` preserva os estados string `ready`, `loading`,
  `error`, `empty` e desconhecido. State não-string vira o estado desconhecido,
  sem coerção. O default renderer inspeciona settings/state próprios via
  descritores, recusando getters de contexto.
- `aria-labelledby="mse-home-title"` torna-se `aria-label` com o título
  **literal escapado**. Remove o ID fixo do `h1`, sem mudar a tag, hierarquia,
  classes restantes ou decoração. Duas instâncias têm zero IDs e não colidem.
  Título explicitamente vazio produz label vazio: conteúdo útil é advisory de
  autoria, não constraint nova.

Normalização existe apenas no snapshot de renderização. Não remove chaves
desconhecidas da persistência nem corrige JSON armazenado. O teste de
admin-service mostra update não relacionado preservando `settingsJson`
byte-exato, inclusive campos futuros, chave própria `__proto__`, linhas de
stats inválidas e href inseguro. Isso usa JSON aceito pelos tipos declarados;
um objeto JSON null pode ser recusado pelo validador administrativo existente,
independentemente do fallback defensivo no renderer.

**Limite:** params reais entram como JSON. A defesa não é sandbox contra
Proxy, globals alterados ou execução arbitrária. Apenas fontes originais
byte-fixadas são importadas em snapshots privados. Não se executa JavaScript
de um pacote arbitrário recebido.

### 3. CSS local, restauração da raiz e reflow limitado

O primeiro seletor original não correspondia à seção emitida:

```css
[data-mse-module="home"][data-mse-module="home"]
```

É substituído **uma única vez** por `.mse-home`. Variáveis locais, texto branco
e paleta original passam a alcançar a raiz real. A especificidade simples,
igual ao `.mse-home` posterior, é intencional: o `background: transparent`
inicial perde por ordem para o gradiente original posterior. Duplicar
`.mse-home.mse-home` tornaria o transparente mais específico e apagaria o
gradiente. O comentário histórico sobre loader/core permanece como fonte
original, não descreve o host MiniJoomla.

Todos os outros bytes/declaracões originais ficam intactos, mais este append:

```css
.mse-home{overflow-wrap:anywhere}
.mse-home__inner,.mse-home__stat{min-width:0}
.mse-home__stats{
  grid-template-columns:repeat(4,minmax(0,1fr));
  column-gap:min(2.6em,4%);
}
.mse-home__button{min-width:0;max-width:100%;box-sizing:border-box}
.mse-home__lines{overflow:hidden}
@media(max-width:760px){
  .mse-home__stats{grid-template-columns:repeat(2,minmax(0,1fr))}
}
.mse-home{container-type:inline-size}
@container(max-width:320px){
  .mse-home__stats{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@container(max-width:180px){
  .mse-home__stats{grid-template-columns:minmax(0,1fr)}
}
```

O limite de 4% no column-gap evita que os três gaps excedam a largura estreita;
o row-gap original, fontes, padding e estilos de botões permanecem. As duas
queries finais usam a **content-box da raiz**, excluindo padding, não o viewport:
até 320px são duas colunas; até 180px, uma coluna. A query de uma coluna vem
depois e prevalece. Acima de 320px continuam quatro colunas, ou duas quando o
viewport satisfaz o breakpoint original de 760px. Por exemplo, raiz pública
180px em viewport 1366px tem cerca de 70.72px úteis e recebe uma coluna; raiz
320px, cerca de 210.72px úteis e duas; raiz 900px, cerca de 790.72px e quatro.
`container-type:inline-size` pertence somente à própria `.mse-home`.

Clipping **adicionado** continua somente nas linhas decorativas `aria-hidden`,
cujas rotações extrapolavam o módulo. Nenhum clipping novo é aplicado a título,
ações, stats ou counters; o `overflow:hidden` **original** da raiz permanece,
mas não comprova conteúdo cabendo. Não altera body/CSS global, tema padrão,
paleta, template ou outro pacote. Navegador sem container queries não recebe
esta correção estreita; suporte e medidas reais pertencem ao gate de site.

Limites originais deliberadamente mantidos:

- O background mobile original aparece **antes** do gradiente `.mse-home`
  posterior e é sobreposto por ordem; não se promete que ele passou a funcionar.
  A grade de stats recebe tracks limitados e as queries locais descritas acima.
- O seletor Lite exige atributos explícitos `data-mse-module` e
  `data-mse-theme="Lite"`, que este renderer não emite. Não há promessa de
  forwarding do tema do host.
- Floaters são spans crus, sem a classe `.mse-home__floater` que ativaria a
  animação existente. Permanecem estáticos, sem adicionar a classe ou ativar
  animação infinita. As regras originais de reduced-motion ficam intactas.

O coordenador forneceu probe original somente leitura: raiz 320px em viewport
921px, scroll do módulo 7026px e do título 6989px, dois IDs fixos, accent sem
variável resolvida, texto escuro e nenhum background. Nos probes intermediários
180/320/768/900, títulos já cabiam e as linhas decorativas transformadas
extrapolavam a raiz. Isso era uma observação intermediária, não aprovação final.

O probe posterior no **site público real**, raiz 180px em viewport 1366px,
revelou um problema adicional em `0.3.x`: padding horizontal de 54.64px por
lado, quatro tracks de cerca de 15.56px e glyph `D` em `<b>` de aproximadamente
19.6px. `stats.scrollWidth` excedeu `stats.clientWidth` por **2px**. O gate
`stats-bounded180` **falhou**, ainda que o clipping original da raiz escondesse
o conteúdo. O admin em viewport 921px tinha tracks de aproximadamente 23.39px
e não revelou essa falha; breakpoint apenas de viewport era insuficiente.

Esse resultado exige novas revisões, não sobrescrever as provas imutáveis nem
relaxar assertions. **Node e AST não comprovam o resultado visual final.**
O coordenador deve medir novamente, no site público real, raiz/stats/counters
com `scrollWidth <= clientWidth` em 180px, além de todas as larguras do ciclo,
contraste, teclado/zoom e instâncias repetidas. Esconder overflow não é passar.
Para cada counter, verificar `b.scrollWidth <= b.clientWidth`; labels em spans
inline podem ter `clientWidth` zero, portanto medir os retângulos do texto com
`Range.getClientRects()` contra os limites do respectivo `.mse-home__stat`.
Essas verificações complementam, nunca substituem ou afrouxam, as assertions
originais da raiz e da grade. Um probe temporário de counter é diagnóstico,
**não** validação do pacote final: repetir com o CSS exato do novo pacote
congelado e registrar o receipt do coordenador antes de qualquer aprovação.

## Proveniência e licenças limitadas

Os três fontes foram comparados, somente leitura, com blobs Git do agregador
no commit `124ac3ea1d002fe7dc517a7d03513d1238396dac`. Igualdade histórica usa
somente CRLF/CR → LF, sem remover BOM.

| Fonte | SHA-256 raw original | SHA-256 LF/histórico |
| --- | --- | --- |
| `extensions/camap/_shared/render.js` | `fd6166e3e3ef13253d4cab93f38d098b1d373548233fea27b727fef42a48795e` | `33a925627f241ae6ed379ddaea89a53acfa24cbe91819aa36c1d0ba08aec5387` |
| `extensions/camap/mod_home/module.js` | `d97eccdf12a0f9fe989bf80ad67cbe8f4ba3dd4c1e3119c9e21ee293de0f851e` | `f57b7e0502442e6cca31f6450bb0bf55f5eff15655c278107899047cbf019717` |
| `extensions/camap/mod_home/home.css` | `bea83a74cf1413d9ccc954e8f34271d1b7032061ca1c41ee6ceec67941105d8f` | `7be4bc11a012357d8f932aacff12de44b0dd133874b379815db2f71c99fa5f2c` |

Hashes gerados finais LF:

- helper: `e6d967556bb4c36db272c967205977b8a9947fadb093819ce069802c91e29c76`;
- renderer: `bad4ece1107c2f6e565ab3bb643070d05fe946f915127bbd1f01ff8d33556e10`;
- CSS `0.4.x`: `25f53736ad63624cd041d2eb546011a2ba60c4cbbbd26dfa942444562b09d34e`.

Dos três fontes adaptados, só o CSS gerado muda em relação a `0.3.x`; helper e
renderer permanecem byte-exatos. XML/controles/notices recebem a nova versão
e a política correspondente. Pin CSS raw:
`e96240d0adcbee6770dee06eba570604428ed7a0efdee76678181689e40be60f`;
tamanhos original raw/LF 7872/7665 bytes, modificado raw/LF 8399/8192 bytes.
Os anchors originais e hashes de gerador/API permanecem iguais. A mudança CSS
na proveniência passa a `home-css-rendered-root-wrap-container-reflow-v2`;
formato/revisão do schema de proveniência continuam `v1`/`1`.

MIT herdado cobre o escopo desses **três fontes**, não o vendor inteiro. Texto
completo preservado byte-exato no pacote em `docs/licenses/CAMAP-ROOT-MIT.txt`:
hash raw `9f855c789f6d1bd404f856ea7c3e7af498e0ee2cc1e842a47ed2559cac09a1a9`,
histórico LF `7e9fc2fab3b2511d64d64c1e0f00fc6a9b920801f3de8e608117ff1000200b7c`.
GPL-2.0-or-later cobre apenas mudanças autorais, com texto completo preservado
em `docs/licenses/GPL-2.0.txt`, hash
`189b1af95d661151e054cea10c91b3d754e4de4d3fecfb074c1fb29476f7167b`.
Não se depende apenas de SPDX e não se licencia todo CAMAP por associação.

`ADAPTATION.json` registra todos os hashes, tamanhos, encoding, BOM/EOL, o
snapshot limitado, gerador/API originais e escopo das licenças. O perfil atual
tem zero notices na raiz CAMAP; um notice novo exige revisão. Metadata de
fixture para fontes não executadas é explicitamente sintética; somente a
auditoria local verifica cada entrada contra o checkout real.

## Builder, closure e verificações executadas

```powershell
node --test tests/home-adaptation.test.js
node --input-type=module -e "const m=await import('./tests/home-adaptation.test.js'); await m.runHomeAdaptationTests();"
node tests/home-adaptation.test.js --local-build
```

- **20 casos portáveis, todos passaram:** fonte original completa de 63 linhas,
  helper e CSS
  completos como dados estáticos; hashes são conferidos **antes** de importar
  fixtures. Sem checkout CAMAP, dependências adicionais, escrita ou rede.
  Runner exportado é sequential/awaited e importação não agenda `node:test`.
- **Build local atual: 21/21 casos passaram** (20 portáveis + build/auditoria
  das duas novas revisões).
  O teste prepara dois destinos novos, usa gerador original,
  XML completo/canônico confrontado com bytes reais gerados, AST CSS real
  permitindo só o primeiro remap + append exato, verificando os nove nós do
  append e a ordem das duas container queries, closure de imports, inventário,
  notices, discovery via file-port e reconstrução de todos os bytes finais.
  Confere 56 fontes de snapshot e 175 arquivos de dependências antes/depois;
  rejeita overwrite e snapshot já adaptado como override de fonte.
- **17 regressões Hero históricas:** todas passaram após a alteração aditiva em
  `scripts/prepare-hero-adaptation.js`: export de helpers já existentes para
  Buffer/metadata/chaves fechadas. Nenhum comportamento ou byte válido de
  pacote Hero foi alterado. Hero não foi editado nem reexecutado nesta correção CSS.
- Helpers compartilhados de bytes capturam intrínsecos de typed arrays:
  brand/prototype exatos e apenas índices próprios de dados. Recusam hooks,
  getters, symbols, own `length`, `toJSON` e impostores **antes** de ler/copiar
  bytes; Buffer pooled/sliced normal é aceito. Testes mantêm contador de
  execução de getters em zero.
- **Containers Map endurecidos somente no tooling Home:** overlay e finalizer
  exigem prototype exato `Map.prototype`, zero propriedades próprias e brand
  nativo validado pelo getter `size` capturado. Antes disso não consultam
  `size`, `has`, `get`, `entries` ou `Symbol.iterator` do caller. Copiam as
  entradas usando `Map.prototype.entries` e `MapIterator.prototype.next`
  capturados, com `Reflect.apply`, para Map novo privado. Subclasses, own
  getters/métodos/symbols, overrides de iterador e impostores sem brand são
  recusados. Um caso portável cobre **51 entradas negativas** nas duas APIs,
  com callbacks/getters executados **zero** vezes; Maps nativos normais seguem
  aceitos e todos os bytes de pacotes válidos são iguais. Proxy/globals hostis
  continuam fora do sandbox. Durante aquele hardening não houve alteração dos
  helpers Hero, runtime, CSS, notices, metadata ou hashes de payload.
- Novo caso portável exige as duas queries exatas e ordenadas após o breakpoint
  de viewport, sem clipping/fonts/padding nas novas regras. Preserva oito
  counters longos completos no markup e fixa os hashes inalterados de runtime.
- CLI atual aceita só Home, `0.4.0`/`0.4.1`, base explícita e novo destino
  `tmp/home-adapt-agent-*`. Overrides precisam corresponder aos originais
  confiáveis e à closure offline `tmp/step2/camap-source`; sem funções, hashes
  configuráveis, graph aberto, rede ou fallback regex de parser.
- Collector limita snapshots a 500 arquivos / 10 MiB e recusa links/junctions.
  Finalizer exige chaves fechadas, hashes/tamanhos fixados, XML canônico completo,
  flags falsas e ausência de payload estrangeiro, mesmo inventariado/rehashed.
- Closure final: **5 runtime** (wrapper, XML, CSS, renderer, helper),
  **13 arquivos totais / 11 payloads inventariados**. Inventory e host-config
  são controles; uma root proposta fixa o hash do inventário. Não foi aplicada
  ao host e não amplia sua capacidade.

Build atual auditado nesta frente, disponível para o coordenador. São saídas de
teste privadas, **não** os novos destinos de siteproof do coordenador:

| Versão | Diretório local | SHA-256 do inventário |
| --- | --- | --- |
| `0.4.0` | `tmp/home-adapt-agent-tests-FZ32nG/0.4.0` | `2dd3397c8d72d61d7e75cc4f38e3cc16fa24786d8afc3ff5d605d927aaf1851e` |
| `0.4.1` | `tmp/home-adapt-agent-tests-FZ32nG/0.4.1` | `42947e341e52b0e4023c131cc8f1cfb8652ef5c17cb6e79b0c41c265c72c8ef1` |

Reauditoria somente leitura desses dois destinos também passou **21/21**:

```powershell
node tests/home-adaptation.test.js --packages tmp/home-adapt-agent-tests-FZ32nG/0.4.0 tmp/home-adapt-agent-tests-FZ32nG/0.4.1
```

Comandos para o **coordenador** preparar destinos novos, uma vez, com a base
explícita do ciclo. Este agente não criou esses dois diretórios:

```powershell
node scripts/prepare-home-adaptation.js --version 0.4.0 --base /offline/home/0.4.0 --output tmp/home-adapt-agent-siteproof-040
node scripts/prepare-home-adaptation.js --version 0.4.1 --base /offline/home/0.4.1 --output tmp/home-adapt-agent-siteproof-041
node tests/home-adaptation.test.js --packages tmp/home-adapt-agent-siteproof-040 tmp/home-adapt-agent-siteproof-041
```

O hash do inventário depende da base explícita; os hashes da tabela de build
de teste não devem ser atribuídos automaticamente ao futuro siteproof.

## Provas históricas congeladas — não adotadas

Após o hardening Map, a reauditoria histórica **somente leitura** de `0.3.x`
passou **20/20 casos** (19 portáveis + auditoria das duas revisões), comparando
todos os bytes. Isso prova integridade, não sucesso de layout. O probe público
180px posterior falhou como descrito acima. Os 26 arquivos dessas duas provas
foram preservados; nenhum foi reconstruído/sobrescrito.

| Versão | Pacote congelado histórico | SHA-256 do inventário, inalterado |
| --- | --- | --- |
| `0.3.0` | `tmp/home-adapt-agent-siteproof-030` | `08424e45bc3d0bb97626eb9db4ed4946a9a96c9e725d96624ed038263d9d93ed` |
| `0.3.1` | `tmp/home-adapt-agent-siteproof-031` | `2d4333bdff66d0c8670204036d223941f8a0f0815f4d4243ce9178cf4d26d3b1` |

O tooling atual **não** prepara nem audita `0.3.x`: ele rejeita essas versões
explicitamente, em vez de reinterpretar pacotes antigos com os pins CSS novos.
Auditoria/reprodução de `0.3.x` exige o tooling histórico correspondente.
Antes da edição, os três arquivos desta frente foram copiados byte-exatamente
para `tmp/home-adapt-agent-legacy-tooling/{scripts,tests,docs}`. O receipt
privado `tmp/home-adapt-agent-legacy-tooling/receipt.json` registra seus hashes
e os hashes/tamanhos de todos os 26 arquivos congelados, reconferidos intactos
ao final desta correção; o snapshot parcial
de tooling precisa dos imports originais se for relocacionado para execução.
Não é necessário reauditar os antigos para construir as novas revisões.

Nesta correção só foram editados `scripts/prepare-home-adaptation.js`,
`tests/home-adaptation.test.js` e este documento. Foram criados destinos locais
de teste novos; nenhum pacote existente, CAMAP ou outro arquivo foi alterado.
Não foi executado full npm, instalação de dependências, navegador, rede,
tenant, publicação ou commit.

Esses diretórios tmp não são release publicada. `publicationApproved`,
`rightsApproved`, `migrated`, `tenantModified`, `hostConfigured` e
`currentRecordsModified` permanecem **false**. Revisão independente, probe final
de site, lifecycle/rollback e qualquer autorização futura são gates separados.

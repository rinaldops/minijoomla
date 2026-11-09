# MINIJOOMLA — Contrato v1 (congelado) dos adapters de conteúdo

**Status:** congelado — Marco A de `docs/INTEGRATION-SPMIDDLE.md`
**Verificação executável:** `tests/adapter-contract.test.js`
(`runContentAdapterContract`), rodada contra o `FakeAdapter` de referência em
`runAdapterContractTests` (`tests/run-tests.js`).

## Objetivo

### Consolidação nativa — plugins administrativos e Sample Data

As contribuições locais da principal foram reconciliadas com a branch validada:
runtime administrativo de plugins e Sample Data coexistem na composição, app
e host. Managers explicitamente injetados mantêm precedência; o contrato legado
beforeSave/afterSave é preservado. Managers com `captureSaveOperation` capturam
as duas fases/params para uma operação, inclusive se a persistência iniciada
termina depois de refresh/stop. Guardas impedem novas escritas pré-operação em
tela abandonada, mas não cancelam uma escrita já iniciada.

MERGE 204/null continua preservado; releitura posterior alimenta somente a
observação, não é snapshot atômico, retry ou transformação retroativa do artigo
persistido. Falha de observer/releitura não mascara gravação concluída. Grupos,
JSON desconhecido, ETags e validação existentes permanecem. A migração adicionada
é **prévia privada sem executor**, e `strictMetadata` XML é opt-in para não
regredir o perfil legado.

Validação deste incremento foi local/focal; não certifica save/lifecycle de
plugins no tenant nem instalação de Sample Data com plugins transformadores.
O site aceito não foi publicado/modificado como efeito da integração Git.
Fila de fechamento em [continuidade](PLANO-CONTINUIDADE-MINIJOOMLA.md).

O runtime nativo fornece guard síncrono imediatamente antes da persistência,
cobrindo cancelamento após a conclusão assíncrona do hook. Preparação de catálogo
e imports obsoletos não bloqueia a navegação atual; commits/lifecycle continuam
serializados e lifecycle já iniciado não recebe timeout/cancelamento forçado.
Guards customizados que retornam valor/Promise são inválidos. Rejeições de Promise
normal são observadas sem `await`, mas Promises com constructor/species adulterado
e proxies não fazem parte do contrato suportado nem de uma promessa de sandbox.

### Consultas reconciliadas na consolidação

`resolveContentQuery` conserva compatibilidade de chamadas da principal usando
a resolução protegida atual. Rota explícita válida prevalece sobre valores
salvos e padrões; aliases `orderBy`/`dir`/`searchPhrases` sobrevivem nos links de
paginação sem chegar como campos livres ao port. Limite salvo de lista não
substitui capacidade de blog/home/tags; matching literal NFC/whitespace e metadata
pública permanecem nos adapters atuais. `componentParamsJson` mantém proveniência
dos valores efetivamente salvos, sem tratar defaults de formulário como gravação.

Os testes da principal foram preservados em regressão distinta, sem substituir
os testes/guardas atuais. Integração SPMIDDLE tem entrada explícita e não mascara
ausência/falha do irmão. Não houve emissão de SEO no host, migração automática
ou regravação da configuração por essa compatibilidade.

Este documento congela o contrato de leitura que qualquer adapter de
conteúdo — hoje o `FakeAdapter` (`src/libraries/minijoomla/infrastructure/fake-adapter.js`) e um
adapter SPMIDDLE com transporte **local** — deve satisfazer para ser
consumido pelo `ContentService` (`src/libraries/minijoomla/application/content-service.js`) sem
exigir mudanças em componentes, módulos ou templates.

Nada aqui descreve comportamento novo. Onde há regras opcionais ou futuras,
elas são explicitamente marcadas como tal.

## 1. `ref` é sempre uma string

Todo parâmetro de referência a uma entidade é uma `string` — nunca um id
numérico, nunca um objeto. Hoje isso é sempre o `alias`:

- `getArticle(alias, options?)`
- `getCategory(alias)`
- `getCategoryPath(alias)`
- `listArticlesByTag(tag, options?)` — `tag` é o nome textual da tag.

Referência: `src/libraries/minijoomla/infrastructure/fake-adapter.js`, funções `getArticle`, `getCategory`, `getCategoryPath` e `listArticlesByTag`.

## 2. Leitura singular resolve `null` para "não encontrado", nunca lança

`getArticle` e `getCategory` resolvem `null` quando a entidade não existe ou
não está visível; não lançam exceção para esse caso. Isso inclui a aplicação de
políticas de visibilidade do domínio (por exemplo: itens fora de janela de
publicação, marcados como ocultos ou equivalentes) — o consumidor deve observar
apenas `null`.

Qualquer outra
falha (ex.: falha de transporte de um adapter real) pode lançar — o
`onNavigate` em `src/index.js` já converte qualquer erro lançado por um
adapter num estado de erro seguro genérico, sem vazar detalhe de
implementação (teste: "application converts adapter failures to a safe
error state").

Referência: `src/libraries/minijoomla/infrastructure/fake-adapter.js`, funções `getArticle` e `getCategory`;
`src/index.js` bloco `catch` do `onNavigate`.

## 3. Página paginada (`Page`) tem forma fixa

Toda leitura paginada resolve exatamente:

```text
{ items: Array, total: number, page: number, pageSize: number, pages: number }
```

`items` nunca é `null`/`undefined` (lista vazia quando não há resultado).
`listArticles` e `listArticlesByTag` (que delega para `listArticles`)
seguem essa forma. O `ContentService.category`/`.search` normalizam
qualquer página incompleta de um adapter parcial para essa mesma forma
(`normalizePage` em `content-service.js`), então um adapter futuro pode
confiar nessa normalização como rede de segurança, mas deve produzir a
forma correta por padrão.

Referência: `src/libraries/minijoomla/infrastructure/fake-adapter.js`, retorno de
`listArticles`; `src/libraries/minijoomla/application/content-service.js` função
`normalizePage`.

## 4. Listas não paginadas sempre resolvem array

`listCategories`, `listMenus`, `listTags`, `listSimilarArticles` e
`getCategoryPath` sempre resolvem um array (`[]` quando vazio), nunca
`null`/`undefined`. O `ContentService.categoryPath` já reforça isso com
`Array.isArray(path) ? path : []`.

Quando os itens de menu possuem `id` e `parentId`, ambos devem ser preservados:
sem o identificador do pai, uma árvore válida seria renderizada como lista
plana. O adapter SPMIDDLE remove itens não publicados e seus descendentes,
preservando itens órfãos legítimos e terminando a verificação de ciclos.
O módulo de menu ordena irmãos e resolve órfãos/ciclos sem recursão ilimitada.

Referência: `src/libraries/minijoomla/infrastructure/fake-adapter.js`, funções de listagem não paginada;
`src/libraries/minijoomla/application/content-service.js` linha `categoryPath`.

## 5. Vocabulário de erro disponível

`src/libraries/minijoomla/core/contracts.js` declara `NotFoundError`, `ValidationError` e
`DataError`. "Não encontrado" continua expresso por `null` (regra 2), não
por exceção — nenhum adapter lança `NotFoundError` para esse caso.

Desde 01/11/2026, `DataError` é usado deliberadamente pela composição real
contra SharePoint (`src/libraries/minijoomla/composition/createMiniJoomlaSharePointApp.js`, via
`src/libraries/minijoomla/infrastructure/spmiddle-error-translation.js`): qualquer falha de
transporte (rede, HTTP não-2xx, resposta inválida) chega ao `ContentService`
como `DataError` genérico, com o erro original preservado só em `.cause`
para diagnóstico interno, nunca na mensagem. `NotFoundError`/`ValidationError`
continuam sem uso — não há hoje um caminho que precise distinguir "parâmetro
inválido" de "falha de transporte" separadamente de `DataError`. Qualquer
erro lançado, tipado ou não, continua absorvido pelo mesmo tratamento seguro
da regra 2 (o `catch` genérico de `onNavigate` em `src/index.js`).

Referência: `src/libraries/minijoomla/core/contracts.js`; `src/libraries/minijoomla/infrastructure/spmiddle-error-translation.js`;
`docs/INTEGRATION-SPMIDDLE.md` §10.

## 6. Datas aceitam string ISO ou `Date`

Qualquer campo de data (`publishUp`, `publishDown`) pode ser uma string
compatível com `new Date(value)` ou uma instância de `Date`; o componente de
apresentação (`renderArticle`/`renderArticleList` em
`src/components/com_content/tmpl/article/default.js`) produz saída idêntica nos dois formatos. Um
adapter não precisa normalizar para um formato único antes de devolver.

Referência: `src/components/com_content/tmpl/article/default.js` função `renderDate`.

### 6.1 "now" por chamada (recomendação para adapters)

Quando um adapter aplicar regras dependentes do tempo (ex.: `publishUp`/
`publishDown`), ele deve capturar um **"agora" único por chamada** e usar esse
mesmo valor para todas as comparações internas daquela operação.

Motivação: evita inconsistência quando uma única chamada atravessa a virada do
relógio (mesmo que rara) e melhora a previsibilidade em testes.

> Esta recomendação é compatível com o contrato v1 e não altera as formas de
> retorno. Fake captura `now` no argumento de cada operação; SPMIDDLE captura
> uma vez após a leitura, preservando a prioridade `options.now` → relógio da
> fábrica → data atual. A lista administrativa captura um instante por render.

### 6.2 Agendamentos de artigo e indicadores administrativos

Refatoração de 04/11/2026: `src/libraries/minijoomla/core/date-window.js`
centraliza a interpretação temporal já aplicada pelos dois adapters. A forma
dos objetos públicos e os campos persistidos não mudam.

- `dateWindowStatus(up, down, now)` retorna `active`, `scheduled`, `expired`
  ou `invalid`; `inDateWindow` é verdadeiro apenas para `active`.
- Limite `undefined`, `null` ou `''` é aberto. Início inclusivo e término
  exclusivo; preservados milissegundos e offsets aceitos por `new Date`.
- Datas/relógio inválidos, intervalo invertido ou duração zero não ativam
  publicação/destaque. A validação precede a classificação futuro/encerrado.
- Não é um parser ISO estrito nem uma validação de escrita. Valores já
  aceitos por `Date` mantêm sua interpretação (inclusive `now: null`, epoch).
- Destaque fora de sua janela não despublica um artigo. Só recebe estrela
  ativa no admin quando publicação **e** destaque estão efetivos.

**Decoders legados preservados:** Fake publica somente com `published === true`
e destaca somente com `featured === true`. SPMIDDLE publica os valores exatos
`undefined`, `true`, `1`, `'1'`, `'Published'`, `'published'`, `'Publicado'`,
`'publicado'` no campo mapeado `state`; destaca `true`, `1` ou `'1'`. Outros
valores, inclusive `null`, `''`, `'true'` e caixa/whitespace diferentes, não
habilitam publicação. A igualdade entre adapters é temporal, não uma unificação
dos decoders. O admin usa o contrato de estado/flag SPMIDDLE.

Em `renderAdminList({ domain: 'articles', now, ... })`, o estado salvo continua
intacto e o indicador distingue publicação agendada, encerrada ou inválida;
rascunho/arquivado/despublicado permanecem inativos. Destaque desabilitado usa
estrela vazia; destaque ligado mas inativo informa a janela e, quando necessário,
o motivo da publicação inativa. Relógio, X e alerta são pictogramas próprios,
sem badge/texto visível ou dependência de cor para distinguir os novos estados.
Cada ícone mantém texto `.visually-hidden` e `title` escapado. Tooltip não
substitui esse texto; não se adiciona controle interativo a um indicador.

`createAdminApplication({ clock })` aceita relógio injetável para fixtures,
chamado uma vez após carregar a lista Artigos. Nova navegação/recarregamento
reavalia o instante; não há timer de atualização em uma tela parada. Nenhum
backfill, PATCH, leitura nova de ETag ou mudança dos formulários ocorre. Os
demais domínios mantêm a apresentação genérica. Adapters personalizados com
decoders diferentes precisam definir sua própria política de apresentação.

Evidência local: `tests/article-schedule.test.js`, `tests/admin-app.test.js`,
`tests/featured-schedule.test.js` e a fixture de agendamento em
`tests/admin-layout-browser.js`. Testes de `now` inválido/bordas, linhas
congeladas, métodos de escrita que rejeitam chamadas, strings de flags,
defaults legados, escaping e editor/ETag. O SPMIDDLE continua sem expor
`state` ou `featuredUp/featuredDown` no objeto público.

**Fechamento local para Git (04/11/2026):** revisão independente sem bloqueio
funcional; `npm test` aprovou 37 suítes sem skips/falhas, `npm run check` aprovou
128 arquivos JavaScript e o runner FIORI-AUTO voltou a aprovar sete larguras.
Tecnologias: módulos ES JavaScript, Node e Edge pelo FIORI-AUTO 0.3.3 (.NET 9).
O gate `release:check` passou somente estrutura e não aprovou publicação.
Não foram incluídos artefatos temporários ou novas configurações corporativas.

O planejamento inicial do incremento exigiu **cinco scripts e um manifesto**:
bootstrap, aplicação, renderer, ícones e helper temporal. Não reutilizar o pin
de ícones antigo do renderer 0.2.4: a base 0.2.1 não contém os novos exports ou
o helper. Os pins inicialmente planejados para base 0.2.1/CSS 0.2.3 foram
substituídos pelo rebaseline abaixo. Os adapters refatorados não fazem parte
desse recorte administrativo. Aceite assistivo/zoom e revisão de
privacidade/licenças do histórico continuam pendentes. A cobertura local de
teclado foi concluída nesta etapa, sem salvar registros; não substitui
teclado/leitor de tela no host real.

**Rebaseline obrigatório antes da publicação:** o canvas vigente encontrado
posteriormente aponta para 0.2.5, com correção de descoberta publicada por outra
frente, ausente da `main`. A aba inicialmente carregada ainda executava 0.2.4;
o DOM carregado não substitui a leitura do canvas/ETag. A 0.2.5 foi preservada.
Sua correção foi integrada ao painel: registro desabilitado, dados provenientes
do resultado de scan em vez de atributos adulteráveis e proteção contra handlers
de navegação obsoleta; testes em `tests/admin-discovery-registration.test.js`.
Quando `manifestJson` não vem do serviço, permanece o fallback já publicado
`{}` e grupo `content`; não se anuncia descoberta completa de parâmetros.

O pacote partiu da **base administrativa real 0.2.5**, preservou todos
os seus imports/editor/serviços e trocou só o bootstrap no canvas. O CSS dessa
base é byte a byte igual ao CSS aprovado 0.2.3, sem alteração visual adicional.
O site público permanece em 0.2.1. Esse rebaseline substitui os pins planejados
acima, sem sobrescrever versões ou reverter trabalho de outra frente.

Validação local do rebaseline: `npm test` aprovou **38 suítes, zero skips/falhas**;
`npm run check` aprovou **129 arquivos JavaScript**. Uma execução de teste
intermediária expirou no limite externo de 120s; a reexecução completa com 360s
concluiu sem esconder suites ou falhas. A correção preservada é JavaScript ES;
não exigiu atualização de pacotes, schemas, configurações ou registros.
O runner local também aprovou sete larguras com **237 verificações de teclado**
por Tab/Enter/Escape reais, contraprovas obrigatórias e cleanup confirmado;
ver [testes nativos](ADMIN-LAYOUT-TESTS.md).

**Fechamento da publicação administrativa 0.2.6 (04/11/2026):** fontes do
incremento em `7704ecdb3cee54543e4cd794206c260803ece058`, após o commit de
agendamentos `4fda2113c298ee4d06e2e701332d465c62f2d49f`; ambos enviados e
confirmados em `origin/main`. Pacote produzido de `git show`, não da árvore de
trabalho. Cinco scripts e um manifesto enviados com `overwrite=false` para
versão nova. **114 assets/dependências** conferidos remotamente por bytes,
SHA-256 e MIME antes/depois da ativação. O CSS continua sendo o arquivo da
base 0.2.5, com hash idêntico ao CSS aprovado 0.2.3.

A troca de `src` foi seletiva em uma webpart, protegida por ETag específico;
canvas preservado semanticamente, demais webparts mantidas. A página foi
publicada e recarregada com uma única montagem 0.2.6. O canvas **e o ETag** da
página pública permaneceram iguais; seu runtime/template/adapters continuam
em 0.2.1. Nenhuma lista, schema, registro ou mídia foi escrito pela validação.

Prévia e página efetiva passaram **320/768/769/900/1366/1920/2560px** via
instância FIORI-AUTO própria. Pós-publicação: **196 verificações funcionais**,
incluindo 42 checks sintéticos de agendamento, além de geometria nativa de
listas/cards; título abre artigo correspondente, três abas funcionam, TinyMCE
da base inicializa/encerra, opção avançada de imagem permanece e descoberta
mantém registro desabilitado. Registros/ETags foram comparados por `get(id)`;
os dois canvas/ETags foram relidos. Requisições não-GET/HEAD ficaram bloqueadas
durante o teste: somente tentativa de telemetry `ActivityLogger/LogActivity`
do host foi observada, separada de operações editoriais. Não houve violação
CSP observada durante a janela; isso não equivale a auditoria integral de CSP.

Lições da auditoria de prévia: `router.navigate` altera histórico mesmo sem
`start`; usar despacho local somente na instância de teste. Não substituir
propriedades congeladas via Proxy; construir fachada readonly. TinyMCE usa IDs
globais: a prévia exigiu host sem editor e IDs únicos próprios. Contraprovas
CSS foram escopadas às fixtures e o viewport original foi restaurado. Primeiras
execuções com fixture inadequada foram interrompidas e preservadas, não
contabilizadas como aceite. O teste efetivo também passou a esperar estados
vazios legítimos de módulos/plugins, sem mascarar alerts ou falhas de leitura.

**Rollback:** ler canvas e ETag atuais, restaurar somente o script administrativo
0.2.6 para 0.2.5, manter CSS 0.2.5 e outras webparts, aplicar com ETag específico,
publicar e verificar. Não restaurar cegamente canvas antigo nem apagar assets
imutáveis. A proteção é atômica no MERGE; não foi demonstrada condição atômica
do endpoint Publish. Releituras imediatas e verificação posterior detectam,
mas não impedem, publicação de edição concorrente nessa pequena janela.
Não houve divergência observada; requer coordenação de escritores em próximas
publicações. Evidências operacionais e backups ficaram apenas em `tmp` ignorado,
sem novos endpoints, GUIDs ou configurações corporativas na documentação Git.
A instância de publicação foi encerrada e a ausência de seus processos
confirmada por perfil/PID, sem encerrar ou controlar o navegador do usuário.

Permanecem fora do aceite: escrita editorial real/upload/exclusão, zoom real,
screen reader, forced colors/reduced motion e aprovação visual integral. A
publicação de tenant não aprova distribuição pública, privacidade do histórico
ou licenças/proveniência de terceiros. O gate `release:check` continua estrutural.

### 6.3. Descoberta de extensões: metadados declarativos v2

O contrato de leitura de artigos permanece v1. Este incremento separado e
aditivo de descoberta passa a retornar `manifestJson` nas entradas válidas de
`createExtensionDiscoveryService.scan()` e `scanUnregistered()`: texto original
decodificado em UTF-8, sem reserializar whitespace, escapes, definições ou chaves
desconhecidas. `key` continua vindo do nome do arquivo; `title`, `type` e
`entryPointUrl` mantêm a normalização anterior.

Quando presentes, `params` são validados pelo normalizador declarativo existente,
sem substituir o texto original. Grupo opcional de Plugin segue o mesmo formato
administrativo: `/^[a-z][a-z0-9_-]{0,39}$/`, após trim; ausente/null/`''` mantém o
fallback `content`. Valores não textuais e strings só de whitespace são
rejeitados: o consumidor anterior poderia recuperar o grupo bruto do manifesto
quando a pasta normalizada ficasse vazia. Grupo em Module permanece metadado,
nunca pasta de plugin. Nomes de parâmetro herdados de `Object.prototype`, como
`constructor` e `toString`, também são rejeitados neste scan por incompatibilidade
com o consumidor pinado; não há correção retroativa desse consumidor nem de
manifestos já persistidos nesta etapa.
JSON, parâmetros, grupo ou URL inválidos produzem entrada com erro, `type` e
`entryPointUrl` nulos, sem `manifestJson` acionável. A descoberta de templates
mantém seu contrato separado, sem esse novo campo ou regras de plugin.

Descobrir só lê manifestos: não baixa/importa/executa entrypoints nem registra
extensões. Registro continua explícito, confirmado e **desabilitado**, a partir
da entrada confiável de scan, não de atributos HTML. O serviço de persistência
existente continua serializando JSON para a nova gravação: preserva dados e
chaves desconhecidas, mas não promete whitespace byte-idêntico nessa gravação.
Não há backfill, habilitação automática, criação de instâncias ou reescrita de
registros antigos. Definições não materializam valores de parâmetros ao registrar.

Regressões em `tests/extension-discovery-service.test.js` e
`tests/admin-discovery-registration.test.js`: string/buffers/views UTF-8,
metadados desconhecidos, params inválidos/duplicados, grupos, URLs, ausência de
execução de JS e fluxo real scan → painel → serviço → repositórios em memória.
Consumo de definições por plugins/módulos e edição de valores com ETag são
testados localmente, mantendo registros legados e ETags intactos.

Validação local do incremento em 04/11/2026: **38 suítes aprovadas, zero skips ou
falhas**, e sintaxe de **129 arquivos JavaScript**. Uma execução expirou no limite
externo de 120s; a reexecução com limite ampliado concluiu. Revisão independente
encontrou os casos de grupo array/whitespace e nomes herdados antes da ativação;
foram corrigidos e a rodada completa voltou a passar, incluindo **672 casos**
de nomes reservados. O pacote administrativo **0.2.7**, produzido de `git show`
do commit `721864a8ec512687bc03157b9d489d3cced087cc`, altera três scripts e
adiciona manifesto, mantendo aplicação/agendamentos 0.2.6, CSS/editor/serviços
0.2.5 e site público 0.2.1. Fontes e correção foram enviadas a `origin/main`.

**Ativação administrativa verificada:** quatro arquivos enviados com
`overwrite=false`, **119 assets/dependências** conferidos por bytes, SHA-256 e
MIME. Permissões efetivas de assets/página permitiam criação/edição/aprovação;
o asset-base informou JavaScript, cache público de um dia e `nosniff`. Troca
seletiva de `src` com ETag específico, publicação e reload com uma montagem
0.2.7. CSS permaneceu byte-idêntico ao aprovado 0.2.3; demais webparts e
canvas/ETag do público foram preservados. Não houve escrita editorial,
registro de extensão no tenant, migração, exclusão ou upload de mídia.

Pré-ativação e página efetiva passaram sete larguras com **315 checks por
rodada**, dos quais 119 de metadados sintéticos e 196 funcionais. O fluxo de registro nesta auditoria
usa composição/serviço/painel reais, mas cliente de arquivos e repositório
**em memória**: não é teste de permissão ou registro efetivo no tenant. Passes
incluem os três casos negativos, metadados/grupo/params consumíveis, registro
desabilitado, cleanup e preservação do host/histórico. A rodada efetiva também
confirmou navegação título→editor, três abas, TinyMCE/cleanup, agendamentos e
registros/ETags de artigos e canvas/ETags das páginas intactos; assets foram
reconferidos após ela.
Aceite visual integral, zoom/mídias assistivas, privacidade/licenças e
distribuição seguem separados. A instância própria foi encerrada; ausência
dos seus processos confirmada sem controlar/fechar o navegador do usuário.
Evidências e backups ficaram somente em `tmp` ignorado. Uma alteração
concorrente no sanitizador apareceu depois da rodada Node e ficou fora deste
incremento/commit/pacote; o publicado usa os pins históricos verificados.

Rollback deste incremento: reler canvas/ETag, restaurar somente `src`
administrativo de 0.2.7 para 0.2.6, preservar CSS 0.2.5 e demais webparts,
publicar/verificar sem apagar assets. A condição atômica continua restrita ao
MERGE; Publish mantém a limitação de concorrência descrita no incremento anterior.

### 6.4. Correção de apresentação das imagens de artigos

O sanitizador image-only mantém agora `float: left|right|none` e `width`
de **0 a 4000 px**, além das margens de **0 a 200 px** já existentes. Valores
normalizados têm no máximo duas casas decimais; percentual, unidade arbitrária,
`calc()`, `var()`, `!important`, estilos de posicionamento/background e eventos
HTML continuam rejeitados. O contrato não se estende a estilos de outros tags.
O nome exportado `sanitizeImageMargins` foi preservado para compatibilidade.

A correção fornecida pelo usuário resolve a perda de alinhamento/largura na
apresentação pública das imagens criadas pelo TinyMCE. Não altera flags de
publicação, upload, serialização do editor ou ETags. O editor continua aguardando
`uploadImages()` antes de `save()`; o serviço persiste o HTML autoral exato e
somente a apresentação pública aplica a sanitização. `data:`/`blob:` continuam
bloqueados. Não há reescrita automática de artigos antigos.

Testes em `tests/image-margins.test.js`: todos os limites inteiros, contraprovas
CSS/URLs, introdução/fulltext/listagem/custom-HTML, ausência de mutação e round-trip
com wrapper do editor/painel/serviço reais e repositórios em memória. TinyMCE/DOM
são doubles nessa suíte; não se trata de gravação efetiva de artigos no tenant.
Rodada local: **38 suítes**, zero skips/falhas; sintaxe de **129 JavaScript**.
O pacote público **0.2.8**, publicado e verificado, deriva do runtime
efetivamente publicado 0.2.1, com sanitizador do commit
`fcc10876530c3fc9659bcf300316f1fa07b8cc7f` e
dependências imutáveis preservadas. Administração permanece 0.2.7; a troca de
template/Cassiopeia não integra esta correção.

Foram publicados **17 novos arquivos** sem overwrite: sanitizador, closure
reversa de imports públicos e bootstrap/manifesto. Demais módulos preservam os
bytes do pacote publicado 0.2.1, exceto pins de imports e origem histórica dos
recursos CSS; não são fontes locais recentes reapublicadas em bloco. **248
assets/dependências** foram conferidos por tamanho, SHA-256 e MIME antes/depois.
A troca ficou restrita ao script src público, com ETag específico; canvas e
ETag administrativos permaneceram iguais, assim como template/CSS/configuração.

Pré-ativação: **154 checks em sete larguras**, com TinyMCE real numa fixture
isolada, sync/estilos, consumidores públicos e runtime sintético. Esses testes
são preview, não a página pública efetiva. Pós-reload: uma montagem pública
0.2.8, CSS histórico e navegação real de artigo; o artigo aberto não tinha
imagens, portanto não confirmou a correção sobre imagem editorial persistida.
Uma fixture sintética temporária no componente do **template público efetivo**
passou nove checks de largura/alinhamento/margens e restauração do host.
Administração 0.2.7 passou 28 checks de preservação/editor/abas/agendamentos.
Não houve gravação editorial, upload de imagem, alteração de schema ou registro
de módulo/extensão. Artigos/ETags foram comparados sem alterações.

**Aceite posterior informado pelo usuário, 04/11/2026:** o usuário confirmou
ter testado a correção e solicitado continuidade. Isso acrescenta seu aceite
funcional às evidências acima; não transforma a fixture da automação em teste
de escrita editorial real nem comprova quais registros/ETags ele utilizou.

Limites: não é um novo teste de salvar/publicar artigo real no tenant, aceite
visual integral, zoom/leitor de tela ou aprovação de distribuição open source.
Evidências e backups permanecem em `tmp` ignorado, sem versionar dados do tenant.
A instância própria do FIORI-AUTO foi encerrada, com ausência dos seus processos
confirmada; o navegador do usuário não foi controlado nem fechado.

Rollback: restaurar apenas o script src público anterior 0.2.1, com canvas e
ETag recém-lidos, preservar demais webparts/CSS/assets e publicar/verificar.
MERGE usa ETag específico; Publish mantém a limitação de condição atômica não
comprovada descrita nos incrementos administrativos anteriores.

### 6.5. Contadores administrativos e parâmetros declarativos próprios

O card **Módulos do site** conta todas as instâncias salvas no repositório,
inclusive despublicadas e na lixeira. Não conta tipos nativos, extensões
habilitadas nem posições atualmente renderizadas. **Extensões registradas**
é a contagem separada dos registros de módulos/plugins; catálogos podem conter
tipos nativos e registrados sobrepostos. Nenhuma instância é criada para alterar
o contador. Rótulos, tooltip, nome acessível e explicação com links tornam essa
distinção explícita, sem modificar enums persistidos (`Module`/`Plugin`).

Consumidores declarativos leem apenas propriedades próprias: ausência e
`undefined` mantêm defaults, enquanto valores próprios explícitos continuam
normalizados. Chaves desconhecidas como `__proto__` são preservadas como dados
próprios sem modificar o protótipo. A visão administrativa de plugins valida
tanto `folder` quanto `manifest.group`; uma pasta válida não oculta um grupo
corrompido no manifesto. Strings válidas recebem trim somente na visão efetiva;
ausência/null/`''` conservam fallback `content`. Tipos inválidos e whitespace
falham com `ValidationError` antes de ações, sem backfill ou reescrita de JSON.
As restrições da descoberta 0.2.7 permanecem: este endurecimento não relaxa o
registro de novos nomes reservados nem executa entrypoints.

Testes locais cobrem contagem `0 → 1 → 2`, registros/ETags intactos, nomes
herdados, defaults e chaves futuras. Revisão independente detectou leitura
herdada adicional no formulário; corrigida com regressão de renderização →
submit, incluindo dez cenários e contraprova no código anterior.

**Incidente e restauração verificada:** o incremento 0.2.9 foi commitado/enviado
(`5a02adf`), passou 38 suítes e uma prévia sintética em sete larguras, e teve
15 arquivos novos publicados/134 assets totais verificados. Após reload, a rota
real de módulos revelou que a fonte local de parâmetros/formulário estava
atrasada em relação à base publicada: removia suporte `json` requerido pelo
catálogo histórico. A prévia não consultara esse catálogo, portanto não era
suficiente para aceitar compatibilidade. Não houve escrita editorial ou de
instâncias. Foi restaurado **somente o src administrativo para 0.2.7**, usando
canvas/ETag atuais, MERGE específico, publicação e leitura posterior; público
0.2.8 e seu canvas/ETag foram preservados. Reload confirmou uma montagem 0.2.7
e rota de módulos sem erro. A pasta 0.2.9 permanece imutável, mas não é a versão
ativa nem aprovada. Correção seguinte requer preservação dos contratos JSON,
limites/URLs e formulário reais da base, além de prévia com catálogo publicado
antes de qualquer nova ativação.

O teste nativo local em sete larguras passou geometria/teclado e contraprovas;
isso não é aceite visual integral. A captura privada não pôde ser interpretada
pelo modelo desta sessão; nenhuma análise visual de screenshot é alegada.

**Correção publicada — 0.2.10:** fonte `23f4696` commitada/enviada. Restaurados
`json`/`valueType`, limites `maxLength` e bounds numéricos, isolamento profundo
de defaults/dados, rejeição não executante de accessors/`toJSON`, URLs relativas
e hash. As funções de controle/leitura são iguais à base publicada, normalizando
somente quebras de linha e o prefixo export: textarea JSON com help, number
`step="any"`, valor numérico bruto até validação e URL em campo text/inputmode.
Revisão independente executou o grafo histórico com os módulos selecionados;
oito tipos nativos/três parâmetros avançados mantêm definições/defaults.

O pacote imutável inclui **15 arquivos novos (14 JS e manifesto), 119
dependências históricas, 134 assets** verificados por bytes/SHA-256/MIME.
Prévia em sete larguras incluiu fixture de parâmetros JSON e **snapshot somente
leitura do catálogo real** com todas as telas de tipos, sem escrita nos registros.
Passaram 770 checks de contrato/rotas mais 560 checks DOM de layout. Após reload,
uma montagem 0.2.10; sete larguras com rotas reais de artigos, módulos, plugins,
configuração e descoberta, TinyMCE real/três abas/cleanup e agendamentos sintéticos:
196 checks mais 1.043 checks DOM. Fixture corrigida de composição é distinguida
do incidente de runtime 0.2.9; execuções interrompidas não contam como aceite.

CSS administrativo 0.2.5 continua byte-idêntico a 0.2.3; editor e serviços
históricos, agendamento 0.2.6 e descoberta 0.2.7 preservados. Publicação alterou
somente o src administrativo, com canvas/ETag específico, MERGE e releituras
antes/depois de Publish. Público 0.2.8/canvas/ETag, outras webparts e artigos
preservados. Nenhuma instância, configuração ou conteúdo foi gravado pelos
testes; nenhum upload de mídia. **Rollback administrativo atual:** restaurar
somente src 0.2.10 → 0.2.7 usando canvas/ETag frescos, mantendo CSS e público,
sem apagar/reescrever assets imutáveis. Atomicidade de Publish continua não
comprovada. A 0.2.9 permanece disponível como artefato rejeitado, não ativo.

### 6.6. Público neutro Cassiopeia — 0.2.11

Fonte/proveniência `23f4696`; **9 arquivos novos (7 JS, CSS e manifesto),
248 dependências históricas, 257 assets** verificados por bytes/SHA-256/MIME.
Partiu dos bytes públicos 0.2.8 e aplicou somente seis módulos na closure reversa,
rótulos neutros, branch de CSS builtin e bootstrap. Sanitizer de imagens 0.2.8
permanece com SHA-256
`6330cf6e4d92f09be2c692aa8cf6704d27b04e776e57294c2133b24b942eece8`.
Imports absolutos 0.2.1, ambas as bases históricas de recursos, quatro CSS do
CAMAP opcional e recursos registrados externos preservados. Não é atualização
integral para todo o runtime da fonte local.

O bootstrap passa a fallback `cassiopeia`; configuração salva permanece
autoritativa, sem regravar sua seleção/estilos. Na leitura fresca anterior a
esta publicação, 0.2.8 **já renderizava Cassiopeia**, embora com CSS histórico;
a observação antiga de CAMAP não descreve esse estado posterior. Prévia com
configuração/registro reais confirmou seleção do CSS neutro. Pacote verificado
por inversão das alterações, hashes, grafo e 11 contraprovas VM.

Prévia nativa em sete larguras: **155 checks**, posições 15/aliases legados,
float/largura/margens de imagens sintéticas, sanitização negativa, cleanup e
DOM/rotas preservados. Teclas nativas Enter/Escape passaram dois checks do menu
móvel. Após reload, **77 checks em sete larguras**: montagem única 0.2.11,
Cassiopeia, CSS novo carregado/computado, navegação de artigo real sem erro,
canvas/ETags de ambas as páginas intactos durante testes. Sem gravação editorial,
alteração de configuração ou módulo, e sem upload. Aceite informado pelo usuário
da correção 0.2.8 não é reinterpretado como aceite visual da 0.2.11.

Tentativa de zoom nativo não estabeleceu 200%/400% (a razão DPR observada ficou
em 1); não foi contabilizada como passe. Forced colors, reduced motion reais,
leitor de tela e comparação visual integral continuam pendentes. A validação
funcional/DOM não promete equivalência pixel a pixel ao Joomla nem certifica
conteúdo, logos, acessibilidade integral, direitos ou distribuição independente.

**Rollback público atual:** ler canvas/ETag frescos, restaurar somente src
0.2.11 → 0.2.8, MERGE com ETag específico, releitura, Publish e verificação.
Manter administração 0.2.10 e outras webparts; não sobrescrever/apagar versões.
CSS anterior é resolvido pelo runtime anterior; não reproduzir canvas antigo
cegamente. Limite de atomicidade Publish é o mesmo do incremento administrativo.

**Fechamento local anterior aos avisos:** suíte completa reexecutada, **40 passes,
zero skips/falhas**; sintaxe de **131 JS**, verificadores offline dos dois pacotes
e releitura do estado publicado público aprovados. O child standalone passava 31 locais,
incluindo os exemplos e excluindo somente `runner.test.js` para evitar recursão;
o runner completo tem 32 locais e oito integrações opcionais. Oito documentos
foram conferidos: 87 links locais/27 âncoras e assinaturas de URLs corporativas,
GUIDs/credenciais/chaves no diff novo, sem achados nessas assinaturas. Isso não
certifica documentos inteiros, dados pessoais arbitrários ou histórico.

Índice antes dos três arquivos novos de avisos/controle: **429 rastreados/243 em
tmp/186 fora de tmp**. Inventário recursivo
continua falhando por mapeamento ausente do submódulo `JOOMLA`; não foi reparado
fora do escopo. `gh --version` novamente não foi encontrado no PATH e a consulta
HTTPS anterior falhou por cadeia de certificado; visibilidade permanece não
comprovada, sem contornar TLS. Uma nova captura local foi produzida por
FIORI-AUTO, mas o modelo não suporta entrada de imagem; não foi interpretada
nem enviada a um serviço visual externo. Mantém-se o bloqueio de comparação
visual integral, sem reinterpretar a captura como aceite.

**Incremento local posterior — avisos (`11afbe4`):** preservado `notices.txt` original do
TinyMCE, 471 bytes, sem alterar os 32 arquivos vendor anteriores; correspondência
local de 33/33 com pacote/arquivo retidos. Stage `all` exige/copia/hasha o aviso;
`site`/`core` continuam sem TinyMCE e rejeitam textos arbitrários. Git preserva os
bytes do vendor sem conversão de EOL. Nova suíte pura registrada: **41 suites
(33 locais/oito integrações), zero skips/falhas; sintaxe de 132 JS**, Node 24.18.0.
Child isolado passa 32 locais, incluindo exemplos/avisos e excluindo somente
`runner.test.js`; stage integral all 111/site 55/core 49 passou. Não publicado
no tenant, não altera fontes dos incrementos 0.2.10/0.2.11 nem certifica direitos,
proveniência ou fonte/build GPL correspondente; ver
[correção de avisos](THIRD-PARTY-NOTICES.md#subsequent-local-notice-preservation--2026-11-04).
Após esse commit, índice conferido: **432 rastreados/243 em tmp/189 fora de tmp**;
a contagem anterior 429/186 permanece histórica. Conferência final dos oito
documentos: **91 links locais/30 âncoras**, sem achados nas assinaturas limitadas
do diff novo; não é certificação de privacidade dos documentos/histórico.

### 6.7. Conversão assistida de atribuições legadas — local

Fonte commitada em **`7bc5b6e`**, continuidade posterior ao push `f1b4a84`, sem
nova publicação no host. O helper
`src/libraries/minijoomla/application/legacy-module-assignment.js` propõe somente equivalências
exatas: escopo All → `all`; rota nativa sem alias de categoria → `only` com um
token `route:<nome>`. Lê campos próprios, retorna plano/tokens congelados e não
lê, reescreve ou aplica `assignmentJson`. Modo novo já declarado e legado
desconhecido/inválido são recusados. Campos obsoletos significativos em All não
são apagados por inferência.

**Recusa intencional:** `Route/category` com alias exige rota **E** categoria;
as seleções atuais usam **OU**. `category:news` também alcança artigos; combinar
com `route:category` alcança outras categorias. A interface explica a diferença
e não oferece conversão automática desses registros. Não foi criado novo tipo
de token, schema ou mudança do runtime público para forçar essa equivalência.

A aba Atribuição de menu conserva o legado por padrão em registros antigos.
Mostra prévia e botões `type=button` para aplicar/restaurar **somente o formulário**.
Aplicar não substitui uma escolha manual já feita; restaurar mantém os demais
campos editados e os tokens antigos. Somente Salvar e fechar chama o serviço
existente com o ETag capturado. Cancelar/navegar sem salvar não grava. Campos
legados, desconhecidos e timestamps com segundos/milissegundos permanecem;
salvar sem conversão conserva o JSON de atribuição original. O serviço continua
omitindo defaults v2 em registros antigos não provisionados: converter All pode
permanecer sem coluna `assignment`, com a mesma visibilidade, não força migração.

**Validações locais:** 1.034 comparações de visibilidade pelo resolver público
real, contraprovas OR, testes de formulário com serviço/ETag reais em memória,
**43 suítes (35 locais/oito integrações), zero skips/falhas**, child isolado com
34 locais (exclui somente `runner.test.js`), sintaxe **136 JS**. Stage atual:
all **112**, site **55**, core **50** arquivos. Novo estágio core **0.3.1 / 50
arquivos / 496.268 bytes / zero candidatos** e hashes verificados; aprovações
de distribuição/direitos/privacidade continuam false. Core 0.3.0 anterior,
49/490.634/zero, permanece histórico e não foi sobrescrito.

FIORI-AUTO local próprio passou sete larguras: DOM/geometria dos controles,
cliques programáticos em apply/restore, falta do token como contraprova,
ausência de ações na interseção/registro moderno e cleanup. Teclado nativo
da suíte pré-existente também passou; **não** foi apresentado como teclado
nativo dos novos botões. Primeira execução do novo fixture falhou porque o
stub não declarou `batch`, requisito de roteamento; corrigido o fixture e
reexecutado integralmente. A falha inicial não conta como passe. Prévia/aceite
no SharePoint, zoom real, mídias assistivas e comparação visual integral deste
incremento não foram executados; nenhuma gravação/upload editorial no tenant.
Revisão independente direcionada sem achados bloqueantes; sugestão de testar
apply → restore → save foi incorporada, preservando token fora do catálogo,
JSON bruto, campos legados e ETag. Pacotes novos não foram publicados: o próximo
gate é construir fechamento administrativo seletivo a partir do **grafo real
0.2.10**, provar equivalência do serviço/formulário e prévia vinculada ao canvas
atual antes de ativar, sem reutilizar fontes locais completas ou alterar o
sanitizador público 0.2.8. Os incrementos já publicados permanecem 0.2.10/0.2.11.
Índice após a frente: **436 rastreados/243 em tmp/193 fora de tmp**. Conferência
dos oito documentos: **95 links locais/34 âncoras**, sem achados nas assinaturas
limitadas do novo diff; isso não audita histórico ou certifica privacidade.

### 6.8. Conversão assistida no host — 0.2.12

Posterior à fotografia local 6.7: pacote fonte `eb423f7`, delta `7bc5b6e` sobre
os bytes efetivos **0.2.10**, não substituição integral da fonte local. **Cinco
arquivos novos (quatro JS/manifesto), 134 dependências/139 assets** verificados
por bytes/SHA-256/MIME. Apenas tela/helper novos; app/bootstrap recebem somente
repins/marcador. Revisão independente conferiu inversão dos pins, fechamento
reverso, hashes, três suítes package-bound e mesma aresta assignment histórica
0.2.5. JSON/URLs/defaults/own-properties, editor/upload sync, CSS 0.2.5,
agendamentos 0.2.6, descoberta 0.2.7 e público 0.2.11/sanitizer 0.2.8 preservados.

Prévia sete larguras vinculada ao manifesto e canvas/ETag atuais passou catálogo
real, rotas, JSON e DOM/apply/restore/recusas sem escrita. **Incidente:** o revisor
designado somente leitura invocou indevidamente `apply` após existir a prévia
aprovada; executou MERGE específico/Publish. O coordenador constatou publicação,
não repetiu escrita e executou reload/verificação efetiva. A publicação era
autorizada pelo pedido, mas a fronteira de responsabilidade foi violada. Nenhum
rollback executado; não interpretar a chamada indevida como validação.

Reload: montagem única 0.2.12, sete larguras, rotas reais, TinyMCE/três abas/cleanup,
agenda sintética, artigos/páginas/ETags preservados. Tab/Enter nativos confiáveis
nos novos controles passaram sete larguras e contraprova de falta de tecla;
apply/restore mantêm edições não relacionadas e não submetem/gravam/navegam.
Registros de teclado temporários, sem módulo remoto/migração/upload. Execuções
interrompidas por timeout não contam; fixtures removidos, reexecução completa
posterior passou. Zoom/mídias/leitor/visual integral/escrita editorial continuam
abertos, não inferidos desses checks.

**Rollback atual:** restaurar somente `src` administrativo **0.2.12 → 0.2.10**
com canvas/ETag frescos, MERGE específico, releitura/Publish/verificação; manter
CSS, público e outras webparts, sem sobrescrever/apagar assets. Não executar
`apply` novamente: intenções de escrita já existem. Publish não tem condição
atômica comprovada. Evidências privadas `tmp/sol-admin-conversion-20261104/`.

### 6.9. Seleção contributor e auditoria local

`stage-contributor.js` usa allowlist explícita (171 arquivos), bytes originais,
manifesto determinístico, destino novo sob tmp, rejeição de links/hardlinks/escape
e verificação integral de inventário/hashes/flags false. Inclui demos/testes,
scripts e TinyMCE/avisos para o editor local; exclui irmão e evidências/runbooks.
Não é core runtime-only, clone público aprovado nem prova de direitos.
`audit-distribution.js` aceita core e contributor-local, aplica limites/declarações
antes de leituras e exige inventário contributor sem extras; reporta candidatos
sem valores, inclusive fixtures/regras/vendor/docs, sem whitelist ou correção
automática. CLI 1 com candidatos é gate bloqueado, não erro de integridade.

Runner integrado e child isolado conservam falhas locais/irmão instalado:
44 suítes completas/zero skips/falhas; seleção 36 passes/oito skips esperados,
child 35 locais, sintaxe 137 JS, sete grupos standalone/core e HTTP/MIME passaram.
Não foram aceites de navegador/editor da seleção. Referências excluídas,
privacidade dos candidatos/histórico e licença/proveniência/fonte-build dos
terceiros seguem gates. [Detalhes](CONTRIBUTOR-SELECTION.md).

## 7. Paginação: limites de `pageSize`

`pageSize` é sempre limitado a 1–50, tanto na configuração do site
(`createConfig`) quanto no adapter (`pageOptions` do `FakeAdapter`). Um
adapter futuro deve aplicar o mesmo limite ou confiar na normalização do
`ContentService`, nunca expor uma página maior que 50 itens.

Referência: `src/libraries/minijoomla/core/config.js`; `src/libraries/minijoomla/infrastructure/fake-adapter.js`
função `pageOptions`.

## Versionamento

Qualquer mudança a uma regra acima exige: nova seção "v2" versionada neste
documento, atualização de `tests/adapter-contract.test.js` e nova execução
da suíte contra **todo** adapter existente (`FakeAdapter` e composição local
SPMIDDLE em `tests/spmiddle-integration.test.js`). Não alterar uma regra existente
silenciosamente.

## Fora do contrato v1 de leitura

Operações de escrita, ETag/concorrência e schema não alteram as regras v1
acima. Os contratos locais dessas camadas estão separados no complemento
abaixo; CSRF, autenticação e permissões continuam sendo responsabilidade do
transporte/SharePoint, conforme os Marcos B/C/D de
[`INTEGRATION-SPMIDDLE.md`](INTEGRATION-SPMIDDLE.md).

## Complemento local — persistência e evolução aditiva (03/11/2026)

**Escopo da evidência:** testes Node exclusivamente locais, sem rede, navegador
ou publicação. Usam schemas e mappings reais do MINIJOOMLA e
`createDataSourceRegistry`, `createSharePointListClient`, `createMapper`,
`createRepository` e `createProvisioningManager` reais do SPMIDDLE; somente
`request(path, options)` é um double estrito em memória. Isso não representa
aceite em tenant, validação de tipos SharePoint, ACL ou garantia de produção.

Verificações executáveis:

- [`../tests/schema-migration.test.js`](../tests/schema-migration.test.js),
  export `runSchemaMigrationTests`: instâncias v1/v2, confirmação negada,
  ausência de coluna, ETag, repetição, falha parcial/retomada, undo de dados e
  limites reais do provisionador.
- [`../tests/entity-contracts-final.test.js`](../tests/entity-contracts-final.test.js),
  export `runEntityContractsFinalTests`: oito entidades, campos antigos/atuais,
  CRUD/mapping, defaults administrativos legados e reversão local de
   visibilidade/padrão de template. Registrado em `tests/run-tests.js`;
   a suíte também pode ser executada por import explícito.

```powershell
node --input-type=module -e "const s = await import('./tests/schema-migration.test.js'); await s.runSchemaMigrationTests(); const e = await import('./tests/entity-contracts-final.test.js'); await e.runEntityContractsFinalTests();"
```

### Entidades e inventários cobertos

Fontes canônicas: `src/libraries/minijoomla/infrastructure/spmiddle-schemas.js` e
`src/libraries/minijoomla/infrastructure/spmiddle-repositories.js`. `schemaVersion` é metadado da
declaração: não é uma coluna gravada na lista nem substitui seu inventário de
campos. As fixtures antigas abaixo são inventários explícitos, não descoberta
de listas remotas; para entidades sem acréscimos, o inventário permanece igual.

| Domínio / lista | Versão declarada | Diferença representativa antigo → atual |
| --- | --- | --- |
| `articles` / `MiniJoomlaArticles` | 1 | Campos editoriais opcionais: `AuthorAlias`, `Language`, `Note`, `VersionNote`, `FeaturedUp/Down`, `MetaDescription/Keywords`, `AttribsJson`; o número da versão não foi incrementado |
| `categories` / `MiniJoomlaCategories` | 1 | Sem colunas novas; `ParentId` é `Number`, descrição multilinha |
| `tags` / `MiniJoomlaTags` | 1 | Sem colunas novas; domínio `name` mapeia para `Title`, estado Choice |
| `menu` / `MiniJoomlaMenu` | 1 | Sem colunas novas; `ParentId`, `Published` e `Ordering` preservados |
| `extensions` / `MiniJoomlaExtensions` | 2 | `Ordering`, `Folder`, `ParamsJson`, `ManifestJson` |
| `moduleInstances` / `MiniJoomlaModuleInstances` | 2 | `ShowTitle`, `PublishUp/Down`, `Trashed`, `Assignment`, `AssignmentJson`, `Note` |
| `siteConfig` / `MiniJoomlaSiteConfig` | 2 | `Offline`, `OfflineMessage`, SEO legado, `HomeView`, `HomeCategory`, `TemplateStylesJson`, `ComponentParamsJson` |
| `templates` / `MiniJoomlaTemplates` | 1 | Sem colunas novas; estilos/posições serializados, entrada e ativação |

Todos os campos graváveis têm round-trip domínio → payload com nomes internos
independentes na fixture → leitura. `id` é somente leitura. O caso especial
editorial `author → Author0` é explícito: `Author` de sistema é `User`, enquanto
o schema declara o nome customizado `Author`. O teste inicia com `Author0`
textual já inventariado e **não prova** que um provisionamento remoto resolverá
a colisão dessa maneira. Verificar o InternalName e tipo reais é pré-condição
operacional; não adaptar silenciosamente para o campo de sistema.

### Contrato de escrita local

- Repository cru: `create(input)`, `findById(id)`, `findMany(query)`,
  `update(id, patch, { etag })`, `delete(id, { etag })`. Não encontrado cru
  propaga 404; o `null` do adapter de leitura continua sendo outra fronteira.
- Mapper rejeita campo desconhecido, `id` gravável e obrigatórios ausentes
  antes do transporte. Update é parcial: omissão preserva dados; `null`
  explícito é enviado como limpeza. Mapper não substitui validação de tipos,
  enumerações, relacionamentos ou políticas administrativas.
- ETag específico é necessário; o conflito simulado 412 não altera dados.
  `MERGE` pode responder 204 sem corpo e `repository.update` retornar `null`.
  Releia com `findById` antes da próxima escrita. `.etag` é não enumerável;
  spread/JSON de entidade não o inclui no snapshot. O SPMIDDLE atual também
  lê ETag por item de coleção quando existe metadata OData; não presumir que
  o header de uma lista seja o ETag de cada linha.
- Queries verificam tradução de select/filter/orderBy/top e escaping de aspas,
  não execução de OData pelo fake. Paginação/transporte HTTP reais continuam
  fora desta evidência.
- O serviço administrativo cobre os sete CRUDs próprios. `siteConfig` expõe
  `get/save` de linha única (upsert por primeira linha encontrada), **não**
  exclusão administrativa nem garantia do id numérico 1 ou unicidade imposta
  pelo SharePoint. CRUD bruto da configuração é testado só como persistência.
- Defaults v2 de extensões, instâncias e configuração são omitidos pelo admin
  se o registro ainda não possui a coluna. Valor novo não-padrão em inventário
  antigo é enviado e falha com 400, sem sucesso silencioso ou item parcial.
- SEO legado (`metaDescription`, `metaKeywords`, `robots`,
  `sitenamePagetitles`) continua legível no repository. `siteConfig.save`
  preserva valores existentes e rejeita alterações: não há contrato para
  manipular metadados globais do host. Sua persistência bruta não constitui
  suporte operacional/efeito público dessas opções.

### Provisionamento: idempotência e limites

`inspect()` e `verify()` somente leem. `apply()` exige confirmação efetiva,
reinspeciona e cria os campos ausentes; repetição não recria campos. A criação
de Choice usa `SP.FieldChoice` e opções declaradas. Os testes demonstram que
campos inexistentes rejeitam gravações antes de provisionar e que dados legados
não são reescritos pelo provisionamento.

**Não há transação ou rollback de schema.** Se um campo falha, outros podem ser
criados na mesma chamada; `status: 'failed'` e `results` precisam ser inspecionados.
Retomar depois de verificar o inventário aplica só pendências. O manager não
expõe `rollback`/`remove`, e não remove campos excedentes ou faz downgrade.

`verify().compatible` compara presença de nomes e índices, **não tipos,
Required, defaults ou opções Choice de campos existentes**. O teste demonstra
que um tipo divergente passa nessa verificação. Índices declarados têm
`supported: false`; `apply` pode retornar `complete` com ações `skipped` e
`verify.compatible === false`. Não confundir `complete` com schema inteiramente
compatível ou unicidade/índices efetivamente aplicados.

### Procedimento seguro de reversão e suas pré-condições

Este procedimento define limites e preparação; não executa operação remota.

1. **Antes de aplicar:** confirmar site/listas/versão imutável autorizados e
   janela sem escritores concorrentes. Capturar snapshot separado de dados
   com ids/chaves/relacionamentos, presença dos campos, valores e ETags;
   inventário completo de InternalName/tipo/Choice/defaults/índices/permissões;
   e configuração/pointer do host para a versão anterior. Guardar em local
   privado autorizado, nunca incluir segredos ou dados corporativos em testes.
2. **Validar o snapshot:** comprovar sua integridade, cobertura das oito listas
   e possibilidade de releitura/restauração. Registrar campos e linhas
   preexistentes versus criados pela operação. Congelar/desligar novas escritas
   na frente afetada; ausência dessas pré-condições impede declarar rollback
   seguro.
3. **Falha parcial de schema:** interromper liberação da versão, inspecionar
   `results` e inventário real. Preferir manter colunas aditivas e restaurar o
   consumidor anterior, ou retomar o apply autorizado após corrigir a causa.
   Não excluir campos/listas pelo provisionador nem prometer esquema antigo
   idêntico. Remoção destrutiva ou restauração integral do SharePoint exigiria
   mecanismo próprio, backup validado e autorização específica — não fornecidos
   por estes testes/API.
4. **Reversão de dados:** comparar snapshot com o estado pós-operação esperado,
   reler ETag atual e restaurar apenas os campos da alteração. Se houver edição
   de terceiro ou conflito, parar para conciliação; reler não autoriza sobrescrever
   trabalho alheio. `null` só limpa valor quando compatível com o campo, não
   remove a coluna/propriedade do schema. Excluir apenas linhas sintéticas
   identificadas como criadas pela operação, sem referências ativas e com ETag
   atual. Linhas removidas não podem ser recriadas preservando seu id por esta
   API; relacionamentos, versões e auditoria não são recuperados pelo CRUD.
5. **Reversão de publicação:** os testes revertem somente `Published/Draft`
   observado pelo adapter e `siteConfig.templateKey` preservando outros dados.
   Não restauram assets, HTML do MSE, cache, CSP ou metadados do host. Para uma
   liberação real, apontar o host para a versão imutável anterior preservada,
   mediante contrato/autorização do host, e revalidar dados/rotas/MIME/CSP/cache/
   permissões/visual/acessibilidade conforme
   [`../../docs/GUIA-PUBLICACAO.md`](../../docs/GUIA-PUBLICACAO.md).

O aceite local é: undo explícito com snapshot e ETag relido restaura valores e
visibilidade na fixture, conflito é rejeitado, criação sintética é removida e
campos permanecem. **Não** é aceite de rollback de schema, restauração integral
de SharePoint ou publicação/rollback real.

# MINIJOOMLA — integração com SPMIDDLE (local) e caminho para remoto

**Status (evidência apenas documental neste repositório):**

- Contratos locais do MINIJOOMLA (Marco A) continuam válidos e congelados.
- Existe um **adapter SPMIDDLE local já implementado** (sem rede/SharePoint durante a suíte local).
- A integração local real com os **pacotes** do SPMIDDLE (schemas próprios, registro de data sources, repositories, provisioning) está **concluída**, validada por `tests/spmiddle-integration.test.js` contra um transporte fake em memória — sem nenhuma requisição de rede real.
- A **integração remota (SharePoint)** de **leitura** (Marco C) e de **escrita
  controlada e sintética com ETag** (Marco D) foi **validada em 31/10/2026**
  contra o site de teste técnico corporativo autorizado
  `https://petrobrasbr.sharepoint.com/teams/SAPScripting`, usando 4 listas de
  teste dedicadas (`TesteMiniJoomla*`) estruturalmente idênticas aos schemas
  de produção. Ver §3 (Marco C e D) e o apêndice §8 para os achados de
  compatibilidade de tenant encontrados durante o provisionamento real.
- A publicação de conteúdo/UI na própria página `SitePages/MiniJoomla.aspx`
  foi **concluída em 01/11/2026** (pacote estático real enviado para
  `RELEASE_BASE`, ligado via Modern Script Editor existente), validada com
  um reload real da página e evidência visual em 320/768/1366/1920px. Três
  incidentes reais foram encontrados e corrigidos durante essa publicação —
  ver o apêndice §9. Zoom 200/400% e `forced-colors` continuam **fora do
  escopo**: nenhum método RPC do FioriAgent documentado emula isso hoje.
- A **tradução de erro de transporte→domínio** (lacuna §4 desde o Marco B)
  foi **implementada em 01/11/2026**: `src/libraries/minijoomla/infrastructure/spmiddle-error-translation.js`
  envolve os repositories de leitura da composição real, traduzindo
  qualquer falha de transporte para `DataError` sem detalhe de transporte
  na mensagem, preservando o erro original em `.cause`. Ver §10.
- **Headers reais (HTTPS/CSP/MIME/cache) e um 404 real** contra o tenant
  foram **confirmados em 01/11/2026** (leitura, sem escrita) — o 404 real
  revelou um defeito real no bootstrap publicado (rejeição de promessa não
  tratada, sem diagnóstico), corrigido, validado localmente e
  **republicado no SharePoint real** (upload do único arquivo corrigido,
  verificado por SHA-256, validado com reload real da página). **Timeout
  e indisponibilidade reais do tenant permanecem fora do escopo**, de
  propósito (sem forma segura de simular contra a infraestrutura real).
  Ver §11.

> Observação importante: este documento descreve o que **já está** (adapter
> local, composição real contra pacotes do SPMIDDLE, políticas e limites, a
> integração remota validada contra listas de teste, e agora a publicação
> real na própria página) e o que **ainda falta** (zoom/`forced-colors`,
> listas de produção, conteúdo editorial real).

O SPMIDDLE já existe como projeto maduro em `web-devs/SPMIDDLE` (submódulo,
repositório próprio), com transporte REST, schemas declarativos,
repositories/mappers e provisioning `inspect→plan→apply→verify` prontos e
usados por outro consumidor (CAMAP). Isso reduz o esforço para o MINIJOOMLA,
que agora consome esses pacotes diretamente (sem reimplementar nada deles) com
decisões específicas próprias — schemas `MiniJoomlaArticles`/`MiniJoomlaCategories`/
`MiniJoomlaTags`/`MiniJoomlaMenu`, mapeamento de campos e composição.

O aceite da fase local não equivale a prontidão para publicação em produção.
Os Marcos C (leitura) e D (escrita controlada e sintética) foram validados
em 31/10/2026 contra o site de teste técnico corporativo autorizado, usando
listas de teste dedicadas — não contra listas de produção nem através da
própria página `SitePages/MiniJoomla.aspx`. A publicação de conteúdo/UI na
página real, a matriz visual exigida pelo prompt (incluindo zoom/alto
contraste) e o provisionamento de listas de produção continuam pendentes e
exigem autorização operacional explícita para o destino e escopo
correspondentes.
**Princípio:** somente adapters/interfaces injetáveis

**Fase atual (local):**

- contratos/fake continuam como base de segurança;
- adapter SPMIDDLE existe e é executável **apenas em modo local** (sem conexão);
- a composição real (`src/libraries/minijoomla/composition/createMiniJoomlaSharePointApp.js`) usa os
  pacotes reais do SPMIDDLE contra um transporte fake, nunca contra rede real;
- testes continuam **sem rede**.

## 1. Objetivo e fronteira

O MINIJOOMLA deve continuar sendo uma camada Joomla-like independente. O
SPMIDDLE será uma implementação futura dos ports de dados, não uma dependência
dos componentes visuais. A integração prevista é:

```text
SPMIDDLE (transporte, auth, schemas, repositories, mappers, ETags)
        ↓ adapter que implementa ports neutros
MINIJOOMLA application services/use cases
        ↓ view models
componentes, módulos e template
```

### 1.1 O que existe hoje (local)

- O MINIJOOMLA mantém a fronteira: componentes não conhecem SPMIDDLE, REST, URL,
  token/cookie, ETag ou qualquer detalhe de transporte.
- O adapter SPMIDDLE local roda sem rede e serve para validar **mapeamento de
  domínio**, **política de visibilidade** e **limites** dentro do contrato do
  MINIJOOMLA.
- Desde a composição real local (`src/libraries/minijoomla/composition/createMiniJoomlaSharePointApp.js`),
  esse adapter é alimentado por repositories construídos com os pacotes reais
  do SPMIDDLE (`sharepoint-schema`, `data-core`, `sharepoint-rest-browser`),
  rodando contra um transporte fake em memória (`tests/spmiddle-integration.test.js`)
  — nunca contra um site SharePoint real, nem com provisioning aplicado fora de
  teste.

### 1.2 O que ainda NÃO existe (produção real)

A conexão remota real (URL SharePoint, chamada REST, autenticação via sessão
do host, ETag, provisioning) foi validada em 31/10/2026 (Marco C e D, ver §3
e o apêndice §8), e a publicação de conteúdo/UI na própria página
`SitePages/MiniJoomla.aspx` foi concluída e validada em 01/11/2026 (ver
apêndice §9) — mas tudo isso usando **4 listas de teste dedicadas**, nunca
listas de produção. Ainda não existem: alteração de `Default.aspx`,
schemas/listas de produção provisionados, uso de dados editoriais
reais/permanentes, ou validação de zoom 200/400%/`forced-colors` (lacuna de
ferramental documentada, não de implementação).

## 2. Interfaces estáveis e responsabilidade

Os ports devem representar necessidades de negócio/apresentação, sem reproduzir
assinaturas ou objetos internos do SPMIDDLE.

```text
ContentPort
  getArticle(ref, options) -> Promise<Result<Article>>
  listArticles(query) -> Promise<Page<Article>>

CategoryPort
  getCategory(ref) -> Promise<Result<Category>>
  listCategories(query) -> Promise<Category[]>

TagPort
  listTags(query) -> Promise<Tag[]>
  listArticlesByTag(tagRef, query) -> Promise<Page<Article>>

MenuPort
  getMenu(name) -> Promise<Menu>
```

Os tipos `Article`, `Category`, `Tag`, `Menu`, `Page` e `Result` são contratos
neutros do MINIJOOMLA. O adapter converte os dados de origem para esses tipos e
normaliza ausência, paginação, datas, ordenação e erros. Nenhum componente pode
receber uma resposta REST, item de lista, contexto de autenticação ou metadado
de transporte.

### 2.1 Política de visibilidade (regra do adapter)

O adapter deve aplicar uma política de visibilidade **antes** de devolver dados
para os ports neutros.

- Itens não visíveis devem se comportar como **"não encontrado"** para leitura
  singular (ou serem omitidos de listas), sem vazar a razão do bloqueio.
- Essa política é parte do domínio MINIJOOMLA (não da UI) e não depende de
  SharePoint estar disponível.

> Nota: a política exata (campos e combinações) é definida pelo adapter local e
> deve permanecer documentada e testada no nível de contrato. Este documento não
> assume campos SharePoint específicos.

### Responsabilidade por camada

| Camada | Responsabilidade | Não deve fazer |
| --- | --- | --- |
| Componentes/módulos/template | consumir view models, renderizar estados e emitir ações declaradas | importar SPMIDDLE, montar URL, ler token/ETag ou decidir schema |
| Casos de uso | compor ports, aplicar filtros e regras de apresentação | conhecer lista `mse*`, endpoint ou mecanismo de auth |
| Ports/interfaces | definir capacidades e tipos neutros | expor SDK do SharePoint ou detalhes de transporte |
| Adapter SPMIDDLE futuro | mapear ports para contratos/repositories do SPMIDDLE, traduzir erros e paginação | alterar componentes, contornar allowlists ou guardar segredos |
| SPMIDDLE | REST, autenticação, schemas, allowlists, repositories, mappers, ETags e provisioning | assumir decisões de layout ou renderização |
| Fake adapter | fixtures determinísticas, latência/erro simuláveis e dados de teste | acessar rede ou imitar credenciais reais |

## 3. Sequência de integração futura

### Marco A — congelar contratos locais (concluído)

- publicar tipos/versionamento dos ports;
- definir `NotFound`, validação, falha transitória e erro de contrato;
- definir paginação, limite máximo, ordenação, timezone e serialização de datas;
- manter o fake como implementação de referência e teste de conformidade.

**Saída:** componentes executam com fake sem nenhuma mudança de código visual.

**Status:** concluído. O contrato está congelado em
`docs/CONTRACTS-MINIJOOMLA.md` e verificado por uma suíte reutilizável
(`tests/adapter-contract.test.js`, função `runContentAdapterContract`), já
executada com sucesso contra o `FakeAdapter` de referência. Qualquer adapter
futuro — incluindo o `SPMiddleAdapter` do Marco B — é o portão de aceite
antes de substituir o fake em qualquer composição.

### Marco B — adapter de leitura isolado

Este marco está **concluído na parte local**: existe um adapter SPMIDDLE
**local** implementado para leitura (`src/libraries/minijoomla/infrastructure/spmiddle-adapter.js`,
inalterado), agora alimentável por **repositories reais** construídos com os
próprios pacotes do SPMIDDLE (`createMapper`/`createRepository`,
`createDataSourceRegistry`, `defineListSchema`), exercitados contra um
transporte fake em memória — sem nenhuma requisição de rede real. Isso cobre
a "implementação" do marco; a "autorização remota" (Marco C) continua
separada e pendente.

Regras que continuam valendo para o adapter (local e futuro remoto):

- implementar o adapter em módulo de infraestrutura separado;
- receber dependências SPMIDDLE por injeção, sem import global nos componentes;
- mapear schemas/DTOs para os tipos neutros e descartar campos não necessários;
- respeitar allowlists, limites e cancelamento do SPMIDDLE;
- cobrir o adapter com testes de contrato usando respostas sanitizadas/fakes,
  não com uma chamada real durante a suíte local.

#### Composição real local (sem rede)

- `src/libraries/minijoomla/infrastructure/spmiddle-schemas.js`: schemas próprios do MINIJOOMLA
  (`MiniJoomlaArticles`, `MiniJoomlaCategories`, `MiniJoomlaTags`,
  `MiniJoomlaMenu`), via `defineListSchema` — nomes lógicos que não reaproveitam
  `MSEContent`/`MSECategories`/etc. de outro consumidor do SPMIDDLE.
- `src/libraries/minijoomla/infrastructure/spmiddle-data-sources.js`: registro fechado via
  `createDataSourceRegistry`, recebendo `webUrl`/`transportFactory`/`lists` da
  composição que monta a aplicação — nunca hardcoded.
- `src/libraries/minijoomla/infrastructure/spmiddle-repositories.js`: um repositório real por
  domínio (`createMapper`+`createRepository`), com o mesmo mapeamento de
  campos que `DEFAULT_FIELDS` já usa em `spmiddle-adapter.js`.
- `src/libraries/minijoomla/composition/createMiniJoomlaSharePointApp.js`: injeta esses
  repositories reais em `createSPMiddleAdapter` **sem alterá-lo**, produzindo
  `{ adapter, content, dataSources, repositories, config }`. `createApplication`
  (`src/index.js`) continua usando `createFakeAdapter()` por padrão; esta
  composição é um caminho adicional, não a composição padrão.
- `tests/spmiddle-integration.test.js`: prova end-to-end (schema→registry→
  repository→adapter→content service) com um transporte fake em memória (mesmo
  contrato `request()` do transporte REST real) e executa `runContentAdapterContract`
  contra essa composição real, além do fluxo `inspect→apply→verify` do
  `createProvisioningManager` contra o schema `MiniJoomlaArticles`.

#### Limites e "now" por chamada

- **Limites:** o adapter deve respeitar o limite de paginação do contrato do
  MINIJOOMLA (1–50 por página) e não retornar páginas maiores.
- **"now" por chamada:** avaliações de visibilidade (ex.: janela de publicação)
  devem usar um **"agora" fixo por chamada** (capturado uma vez no início da
  operação), para evitar inconsistências internas quando o relógio avança entre
  filtros/mapeamentos.

**Saída:** os mesmos casos de uso podem escolher `FakeAdapter` ou
`SPMiddleAdapter` (fake ou com repositories reais) por composição.

### Marco C — leitura autorizada em Preview

Somente após aceite integral da matriz da fase 1 e autorização operacional
explícita. A primeira superfície futura é `Preview.aspx`; `Default.aspx` fica
para etapa posterior. Validar, antes de qualquer publicação ou conexão:

- destino de produção e sessão autorizada;
- HTTPS, certificado, CSP, MIME, cache e permissões;
- allowlists e schemas do SPMIDDLE;
- ausência de segredo em código, logs, fixtures ou documentação;
- comportamento de 404, timeout, resposta incompleta e indisponibilidade;
- rollback por versão imutável do pacote.

Este marco não autoriza escrita editorial, provisioning ou alteração de listas
de produção.

**Status (31/10/2026):** a leitura remota real foi **validada contra o
SharePoint real**, usando o site de teste técnico corporativo autorizado
`https://petrobrasbr.sharepoint.com/teams/SAPScripting` com sessão FIORI-AUTO
isolada (SSO automático, sem credenciais no MINIJOOMLA), mas **contra 4
listas de teste dedicadas** (`TesteMiniJoomlaArtigos`,
`TesteMiniJoomlaCategorias`, `TesteMiniJoomlaTags`, `TesteMiniJoomlaMenu`),
não contra listas de produção nem através da própria página `Preview.aspx`/
`SitePages/MiniJoomla.aspx`. As 4 listas foram provisionadas via
`inspect → apply → verify` real do `createProvisioningManager`, e a cadeia
completa (`createMiniJoomlaSharePointApp` → `createMiniJoomlaDataSources` →
`createMiniJoomlaSPMiddleRepositories` → `createSPMiddleAdapter` inalterado →
`createContentService`) foi exercitada com sucesso: `content.search(...)`,
`content.category(...)`, `adapter.listArticles(...)`,
`adapter.listCategories()`, `adapter.listTags()`, `adapter.listMenus()`
retornaram páginas/listas vazias bem formadas, sem erro. Isso prova que a
cadeia real schema→transporte REST→repository→adapter→content service
funciona de ponta a ponta contra o SharePoint real, indo além do transporte
fake do Marco B. Dois achados de compatibilidade de tenant encontrados
durante o provisionamento estão documentados no apêndice §8 — relevantes
para quem for provisionar listas de produção depois. A publicação
através da própria página e a validação de 404/timeout/indisponibilidade
continuam pendentes.

### Marco D — operações mutáveis, se aprovadas

Somente com contratos explícitos de escrita, validação, sanitização, CSRF,
idempotência e controle de concorrência. ETags e detalhes de conflito ficam no
adapter/SPMIDDLE; a UI recebe um erro de domínio acionável. ACL continua fora
do MINIJOOMLA até existir um escopo próprio, aprovado e documentado.

**Status (31/10/2026):** uma escrita controlada e **sintética** (sem dado
editorial real) foi validada contra a mesma lista de teste
`TesteMiniJoomlaArtigos`, usando `app.repositories.articles` (repositório
real do `data-core` do SPMIDDLE, não um atalho REST manual): `create(...)`
com sucesso e ETag real; releitura (`findById`) confirmando o mesmo ETag;
teste deliberado de conflito com ETag errada (`'"999999999"'`) retornando
**HTTP 412** / `error.code === 'concurrency-conflict'`, confirmando o
comportamento de concorrência otimista; `update(...)` com a ETag correta,
confirmado por releitura (SharePoint responde `204` sem corpo para `MERGE`);
e `delete(...)` seguido de releitura da lista mostrando **0 itens**, sem
resíduo. Isso valida o mecanismo de ETag/conflito do SPMIDDLE de ponta a
ponta contra o tenant real, mas **não** constitui aprovação de escrita
editorial de produção: contrato de validação/sanitização, CSRF e
idempotência em produção continuam pendentes (ver
`docs/CHECKLIST-CONCLUSAO-MINIJOOMLA.md` §8).

## 4. Matriz de dependências e lacunas

| Dependência/decisão | Dono | Pré-requisito para | Situação na fase 1 |
| --- | --- | --- | --- |
| Ports e tipos neutros | MINIJOOMLA | qualquer adapter | congelado e testado — `docs/CONTRACTS-MINIJOOMLA.md` |
| Fixtures e fake adapter | MINIJOOMLA | desenvolvimento e CI | obrigatório, sem rede |
| Schemas e allowlists | SPMIDDLE | adapter futuro | **concluído localmente** — `src/libraries/minijoomla/infrastructure/spmiddle-schemas.js` (`defineListSchema`) e `src/libraries/minijoomla/infrastructure/spmiddle-data-sources.js` (`createDataSourceRegistry`), específicos do MINIJOOMLA |
| Repositories e mappers SharePoint | SPMIDDLE | leitura autorizada | **concluído localmente** — `src/libraries/minijoomla/infrastructure/spmiddle-repositories.js` (`createRepository`/`createMapper`), injetados em `createSPMiddleAdapter` via `src/libraries/minijoomla/composition/createMiniJoomlaSharePointApp.js`, validado sem rede em `tests/spmiddle-integration.test.js` |
| Autenticação e sessão | SPMIDDLE/host autorizado | conexão futura | **validada em 31/10/2026** contra o tenant real via sessão FIORI-AUTO com SSO automático; sem credenciais mantidas pelo MINIJOOMLA |
| Política de erros/retry/timeout | contrato conjunto | confiabilidade | **quase completo**: timeout/retry de leitura são delegados ao transporte do SPMIDDLE (`createSharePointRestClient`, já usado pela composição real); a aplicação absorve falhas do adapter em estado seguro; a tradução de erro de transporte→domínio foi implementada em 01/11/2026 (`src/libraries/minijoomla/infrastructure/spmiddle-error-translation.js`, `withErrorTranslation`), aplicada aos repositories que alimentam o adapter de leitura na composição real — qualquer falha de transporte **ou resposta malformada** (confirmado com um item real inválido fazendo `mapItem` lançar) agora resolve `DataError` genérico (`docs/CONTRACTS-MINIJOOMLA.md` §5), sem detalhe de transporte na mensagem, com o erro original preservado só em `.cause`; `app.repositories.*` cru continua propagando o erro original intacto, necessário para o Marco D (ETag/412); um 404 e headers reais (HTTPS/CSP/cache) foram confirmados contra o tenant real em 01/11/2026 (§11); **só timeout e indisponibilidade reais do tenant permanecem fora de alcance, de propósito** — sem forma segura de simular isso contra a infraestrutura real |
| ETag/conflito | SPMIDDLE | escrita futura | **validado em 31/10/2026** contra o tenant real (Marco D, §3): `createRepository.update/delete` exige ETag exato; conflito confirmado com HTTP 412/`concurrency-conflict`; exercitado apenas em lista de teste sintética, não em escrita editorial de produção |
| Segurança de escrita/CSRF | integração e host | qualquer mutação | fora da fase 1 |
| Preview e pacote de publicação | operação autorizada | Marco C | **concluído em 01/11/2026** — leitura/escrita de teste validadas (§3); publicação real de conteúdo/UI na própria página concluída e validada com evidência visual (§9) |
| Dados editoriais reais | responsável do domínio | validação futura | proibidos nesta fase |

### 4.1 Mapeamento de domínio (o que o adapter faz)

O adapter converte o modelo/origem do SPMIDDLE para o domínio MINIJOOMLA:

- `Article`, `Category`, `Tag`, `Menu` (tipos neutros);
- normalização de datas (aceitar `Date` ou ISO compatível com `new Date()`);
- paginação no formato fixo `Page`;
- ausência como `null` em leituras singulares.

> Importante: o mapeamento deve **descartar** campos que não fazem parte do
> domínio MINIJOOMLA e nunca repassar DTOs/URLs/ETags para a UI.

## 5. Critérios de aceite do plano

- [x] Trocar `FakeAdapter` por um adapter de contrato não exige mudar
  componentes, módulos ou templates.
- [x] Nenhum import de SPMIDDLE aparece em UI, template, módulo ou componente.
- [x] Os testes unitários rodam sem rede, credenciais, cookies ou SharePoint.
- [x] Mapeamentos rejeitam dados inválidos e não deixam escapar DTOs, URLs,
  ETags ou erros de transporte para a apresentação. Evidência: `createMapper.mapItem`
  (SPMIDDLE `data-core`) só copia campos de domínio declarados no mapeamento,
  descartando qualquer campo SharePoint não mapeado; `createRepository.findMany/findById`
  anexam a ETag como propriedade não enumerável (nunca presente em `JSON`/view
  model); `spmiddle-adapter.js` (inalterado) já tinha teste cobrindo descarte de
  campo de transporte (`tests/spmiddle-adapter.test.js`, "listCategories... não
  possui campo de transporte"), agora também exercitado fim a fim contra
  repositories reais em `tests/spmiddle-integration.test.js` e, em 31/10/2026,
  contra o tenant real (§3, Marco C). Validação de escrita (`mapCreate`/
  `mapUpdate` rejeitam campo desconhecido/obrigatório ausente) é testada no
  próprio SPMIDDLE; o MINIJOOMLA exercitou escrita sintética e descartável
  contra uma lista de teste em 31/10/2026 (§3, Marco D), não escrita
  editorial de produção.
- [x] Paginação, datas, ausência, falhas e limites têm comportamento documentado
  e testes de contrato.
- [ ] O plano de leitura em `Preview.aspx` só é executado após autorização e
  validação de produção; `Default.aspx` permanece fora desta etapa.
- [ ] Qualquer escrita futura tem contrato separado, proteção CSRF, validação,
  sanitização, idempotência e rollback demonstrado.
- [x] Não existem segredos ou dados pessoais em fixtures, logs, documentação ou
  configuração versionada.

## 6. Rollback e isolamento

### Antes de conexão

O rollback é simplesmente manter a composição `FakeAdapter`. O build/teste local
deve continuar funcionando sem o pacote ou configuração do SPMIDDLE.

### Após integração de leitura em Preview

1. desativar a composição do adapter remoto e selecionar o fake;
2. restaurar o pacote anterior por versão imutável, sem sobrescrever artefato;
3. confirmar que nenhum componente passou a depender do adapter remoto;
4. revisar logs por tokens, cookies, URLs internas ou dados indevidos;
5. executar testes locais, de contrato e `git diff --check`;
6. registrar a evidência da reversão sem publicar dados ou credenciais.

Se houver operação mutável no futuro, o rollback da aplicação não desfaz
automaticamente uma transação SharePoint. A reversibilidade da escrita deverá
ser definida pelo contrato do SPMIDDLE antes do aceite, com idempotência,
compensação ou procedimento operacional específico.

## 7. Não objetivos explícitos

- não embutir REST, Microsoft Graph ou SDK SharePoint no MINIJOOMLA;
- não fazer descoberta automática de listas, schemas ou endpoints;
- não copiar contratos de `mse-platform` ou de sites específicos;
- não usar `Preview.aspx` como atalho para desenvolver contra SharePoint;
- não introduzir ACL, grupos ou autorização editorial nesta integração;
- não transformar o fake em um servidor ou em uma simulação de produção.

## 8. Apêndice — achados de compatibilidade de tenant (provisionamento real, 31/10/2026)

> Registrado para quem for provisionar listas de **produção** depois. Os dois
> achados abaixo não são bugs do MINIJOOMLA nem do SPMIDDLE: são
> incompatibilidades reais e específicas entre o pacote `sharepoint-provisioning`
> do SPMIDDLE e o tenant do SharePoint usado nesta validação (Microsoft 365,
> versão de API vigente em 31/10/2026). A lógica de schema→ações do SPMIDDLE
> está correta; apenas o formato exato do corpo de requisição precisou de
> ajuste para este tenant.

1. **`__metadata` em corpos POST.** Este tenant rejeita a propriedade
   `__metadata` em corpos de requisição POST quando o cabeçalho é
   `Accept: application/json;odata=nometadata` — o único modo usado pelo
   transporte `createSharePointRestClient` do SPMIDDLE. As ações de
   criação de lista/campo do `createProvisioningManager`
   (`packages/sharepoint-provisioning/src/provisioning.js`) incluem
   `__metadata` nesses corpos. Diagnóstico confirmado: o mesmo corpo sem
   `__metadata`, com os mesmos cabeçalhos, retorna HTTP 201 com sucesso; com
   `__metadata`, retorna HTTP 400 "The property '__metadata' does not exist
   on type 'SP.List'" (ou `SP.Field`).
2. **`Choices` no POST inicial de campos `Choice`.** Campos do tipo `Choice`
   (usados em `State`/`Published`) não podem ser criados com a propriedade
   `Choices` já no corpo do POST inicial neste tenant ("The property
   'Choices' does not exist on type 'SP.Field'"). Solução funcional
   confirmada: criar o campo `Choice` sem `Choices`, depois atualizar via
   `MERGE` (`X-HTTP-Method: MERGE`) com `Choices` como **array simples**
   (não `{ results: [...] }` — isso falha com "'StartObject' node ...
   'StartArray' node was expected") e `If-Match: *` (ETag wildcard,
   aceitável aqui porque é definição de schema, não dado editorial).

Esses dois ajustes foram aplicados apenas no formato do corpo da requisição
de provisionamento usada nesta validação, nunca no pacote compartilhado do
SPMIDDLE. A criação de índice (`create-index`) continua fora do escopo
suportado pelo `createProvisioningManager` para este tenant/versão (já
marcada como `supported: false` pelo próprio pacote) e foi registrada como
ação pulada (`status: "skipped", reason: "unsupported-rest-operation"`), não
como erro.

## 9. Apêndice — incidentes reais da publicação na página real (01/11/2026)

> Registrado para quem for publicar nesta ou em outra página real depois.
> Nenhum destes incidentes foi causado pelo bootstrap em si — todos só se
> tornaram visíveis ao publicar contra o SharePoint real, nunca apareceram
> na suíte local (69 testes, sem rede/navegador real).

### 9.1 Auto-start de módulo sobrescrevendo a página real

`src/index.js` tinha `if (typeof document !== 'undefined')
createApplication();` ao final do arquivo — pensado só para
`examples/index.html`, uma página HTML dedicada e isolada. Qualquer
navegador real que importasse esse módulo, por qualquer motivo (inclusive o
bootstrap de publicação, que só queria a função `createApplication`, não
uma instância automática), disparava esse auto-start contra o `document`
REAL da página com o `FakeAdapter` padrão — sobrescrevendo toda a página
SharePoint (chrome, navegação, outros web parts) com conteúdo fictício de
demonstração. Confirmado e contido ao vivo contra
`/teams/SAPScripting/SitePages/MiniJoomla.aspx` (consultar o histórico da
sessão para os scripts de contenção de emergência usados).

**Correção:** a linha de auto-start foi removida de `src/index.js`;
`examples/index.html` passou a chamar `createApplication()` explicitamente
via `<script type="module">` inline. Os 69 testes locais continuam verdes
sem alteração, pois rodam em Node sem `document` global — o auto-start
nunca era exercitado por eles. Lição: um efeito colateral de nível de
módulo pensado para um único consumidor local não é seguro assim que o
módulo passa a ser importável por qualquer código externo (como um
bootstrap de publicação).

### 9.2 Rota `home` sem guarda contra categoria ausente

A rota `home` em `src/index.js` chamava `renderCategory(result, ...)` sem
checar se `result` era `null` — diferente da rota `category`, que já tinha
essa guarda via ternário. Isso funcionava sempre no `FakeAdapter` de
demonstração (a categoria `noticias` sempre existe ali), mas lançava
`TypeError` dentro de `renderCategory` (`Cannot read properties of null`)
contra as listas de teste reais, vazias — capturado silenciosamente pelo
`catch` genérico do `onNavigate` como "Não foi possível carregar".

**Correção:** a mesma guarda condicional já usada pela rota `category` foi
aplicada à rota `home`, substituindo o erro genérico por um estado vazio
acessível ("Nenhum conteúdo publicado ainda", `role="status"`). Um novo
teste de regressão foi adicionado em `tests/core.test.js` ("application
renders an accessible empty state on the home route when the configured
category is missing, instead of throwing") — os testes existentes já
usavam `getCategory: async () => null` na rota `home`, mas nenhum verificava
o conteúdo final renderizado, só o estado de loading/busy, então o defeito
passava despercebido.

### 9.3 Cache de CDN por URL completa presa em revisão antiga

O SiteAssets do SharePoint associa uma revisão de publicação distinta a
cada *combinação exata de caminho+query string já vista* em uma URL
(`cache-control: public, max-age=86400`), não ao conteúdo atual do arquivo.
Um esquema de cache-busting mantido manualmente (`?v=1`, `?v=2`, `?v=3`...)
ficou preso servindo uma revisão intermediária — publicada entre as
correções 9.1 e 9.2 — porque aquela query string específica já tinha sido
cacheada pelo CDN antes da correção mais nova ser enviada; incrementar o
número manualmente não ajudava se o incremento não acontecesse em
exatamente todo upload daquele arquivo.

**Correção:** o bootstrap e o loader clássico passaram a usar `import()`
dinâmico com `?t=${Date.now()}` — um valor que nunca é reutilizado entre
publicações, eliminando a classe de problema por completo (ao custo de que
cada carregamento de página busca uma cópia nova em vez de aproveitar o
cache do navegador; aceitável nesta frente de validação técnica).

### 9.4 Harness de diagnóstico reutilizável

As dezenas de sondas Python/Node descartáveis usadas para diagnosticar os
três incidentes acima foram substituídas por um único módulo reutilizável,
`tmp/mj_harness.py` (snapshot de saúde da página, leitura/escrita genérica
de `CanvasContent1` com codificação correta, execução de expressão JS
arbitrária na sessão autenticada). Ele também corrigiu um bug de
diagnóstico real que distorceu a investigação por um tempo: sua função de
anexar sessão originalmente delegava para o `open_or_attach()` compartilhado
do FIORI-AUTO, que sempre tenta `browser.open` primeiro — e isso **navega**
mesmo quando a sessão já existe para aquela URL (não lança erro, só
reaproveita o `sessionId` após renavegar), reiniciando silenciosamente o
ciclo de vida do app a cada chamada supostamente "somente leitura". A
correção usa só `fiori.listSessions`/`fiori.attachSession` para anexar sem
perturbar a página, com uma função `fresh_session()` separada e explícita
para os casos em que um reload real é intencional.

## 10. Tradução de erro de transporte→domínio (01/11/2026)

> Fecha a lacuna registrada em §4 ("o adapter ainda propaga erros sem
> tradução para erro de domínio") desde o Marco B. Trabalho puramente
> local — nenhuma ação contra o SharePoint real foi necessária ou
> executada para esta seção.

### 10.1 O que foi implementado

`src/libraries/minijoomla/infrastructure/spmiddle-error-translation.js` (`withErrorTranslation`)
envolve um repositório (`findMany`/`findById`) e traduz qualquer falha para
`DataError` (`src/libraries/minijoomla/core/contracts.js`), preservando o erro original somente
em `.cause`, nunca na mensagem exibível. `src/libraries/minijoomla/composition/createMiniJoomlaSharePointApp.js`
aplica esse wrapper aos quatro repositories (`articles`/`categories`/
`tags`/`menu`) antes de injetá-los em `createSPMiddleAdapter` — o adapter
em si (`src/libraries/minijoomla/infrastructure/spmiddle-adapter.js`) permanece **inalterado**,
preservando o teste que já fixava sua propagação de erro por referência
(`tests/spmiddle-adapter.test.js`, "transport detail must remain outside
the domain result", que usa um repositório fixture direto, fora desta
composição).

### 10.2 Por que só leitura, nunca escrita

`app.repositories.*` (retornado cru por `createMiniJoomlaSharePointApp`,
sem o wrapper) continua propagando o erro original intacto. Isso é
deliberado: a evidência real de escrita do Marco D
(`docs/CHECKLIST-CONCLUSAO-MINIJOOMLA.md` §8.1) depende de inspecionar
`error.status === 412` e `error.code === 'concurrency-conflict'` no erro
original do SPMIDDLE para detectar conflito de ETag. Traduzir esse erro
para `DataError` destruiria essa informação. Por isso o wrapper só envolve
`findMany`/`findById` (o caminho de leitura usado pelo adapter), nunca
`create`/`update`/`delete`.

### 10.3 Por que um único tipo (`DataError`), não `NotFoundError`

"Não encontrado" (regra 2 de `docs/CONTRACTS-MINIJOOMLA.md`) já é expresso
por `null`, resolvido depois de uma leitura de transporte **bem-sucedida**
filtrada por alias/tag em memória (`allArticles(...).find(...)` dentro do
adapter). Um erro de transporte (por exemplo, a lista foi renomeada e a
própria chamada REST falha com HTTP 404) é uma falha de
configuração/ambiente, não "este alias não existe" — tratá-lo como
`NotFoundError` esconderia um problema de ambiente atrás de uma mensagem
que parece dizer "conteúdo não existe".

### 10.4 Evidência

`tests/spmiddle-error-translation.test.js` (2 verificações, unitário,
isolado do resto da composição): traduz uma falha de transporte simulada
(`SharePointRestError`-like, com `status`/`code`/mensagem de transporte)
para `DataError` sem detalhe de transporte na mensagem, com `.cause`
preenchida; confirma que `create`/`update`/`delete` **não** são
envolvidos; confirma que um `DataError` já traduzido não é embrulhado de
novo (sem cadeia de `cause` aninhada entre camadas).

`tests/spmiddle-integration.test.js` (teste adicional, "falha de transporte
real (503) chega como DataError sem detalhe via adapter, preservando o
erro original em repositories cru"): usa o mesmo transporte fake em
memória do restante da suíte, mas injeta uma falha real de 503 na rota de
itens da lista de artigos; confirma que `app.content.article(...)` e
`app.adapter.listArticles()` (caminho do adapter) resolvem `DataError` sem
o texto "503" na mensagem, com `.cause` igual ao erro original; confirma
que `app.repositories.articles.findMany(...)` (caminho cru) continua
propagando o erro original exato, por referência.

`tests/spmiddle-integration.test.js` (teste adicional, "item realmente
malformado (mapItem real lança) chega como DataError via adapter, sem
código de tradução dedicado"): fecha o item restante de §4 ("comportamento
para resposta incompleta, inválida ou indisponível"). Em vez de simular o
erro manualmente, um item genuinamente malformado (`null`) é inserido
diretamente no transporte em memória; isso faz `createMapper.mapItem()`
**real** do SPMIDDLE lançar seu próprio `TypeError` ("item deve ser um
objeto."), sem nenhum erro forjado pelo teste. Confirma que a mesma
tradução de `withErrorTranslation` já cobre esse caso — nenhuma
distinção de código nova foi necessária entre "falha de transporte" e
"resposta malformada"; ambas chegam ao adapter como o mesmo `DataError`
genérico, e o repositório cru continua vendo o `TypeError` original.

Nenhuma destas verificações faz requisição de rede real — o "transporte"
continua sendo o mesmo double em memória já usado pelo resto de
`tests/spmiddle-integration.test.js`.

## 11. Verificação de robustez contra 404/indisponibilidade reais (01/11/2026)

> Única seção desta frente que exigiu ação real (somente leitura) contra o
> tenant, confirmada previamente com o usuário antes de executar: nenhuma
> escrita, nenhum provisionamento, nenhuma publicação.

### 11.1 Headers reais confirmados (HTTPS/CSP/MIME/cache)

Via sessão FIORI-AUTO isolada (RPC 47177, perfil `minijoomla`), um `fetch`
autenticado contra a própria página e contra um asset já publicado em
`RELEASE_BASE` confirmou:

- página (`SitePages/MiniJoomla.aspx`): `https:`, `Content-Type: text/html`,
  `Strict-Transport-Security: max-age=31536000`, `X-Content-Type-Options:
  nosniff`, `Cache-Control: private`, `Content-Security-Policy` restrita
  por allowlist de domínios Microsoft + `nonce`/`sha256` +
  `script-src 'unsafe-eval'` (necessário para o `import()` dinâmico do
  bootstrap).
- asset publicado (`.../releases/0.1.0/app/bootstrap/minijoomla-sapscripting-bootstrap.js`):
  `Content-Type: application/javascript`, `Cache-Control: public,
  max-age=86400` (confirma, com headers reais, o comportamento de CDN já
  inferido empiricamente no incidente 9.3), `ETag` real presente.
- um arquivo inexistente no mesmo `RELEASE_BASE` responde **HTTP 404 puro**
  (`"404 NOT FOUND"`, sem stack trace nem caminho de servidor).

### 11.2 Achado real: `bootstrap()` sem tratamento de erro nem diagnóstico

O 404 real acima expôs um defeito que não tinha sido exercitado antes: o
`bootstrap()` publicado em `minijoomla-sapscripting-bootstrap.js` não tinha
nenhum `try/catch` em torno de `waitForRootContainer()`/
`loadDependencies()`/`createApplication(...)`. Qualquer falha ali (um
404/indisponibilidade real de um dos três `import()` de
`loadDependencies()`) virava uma **rejeição de promessa não tratada**, sem
nenhuma mensagem visível na página e sem nenhum sinal de diagnóstico.
Adicionalmente, os marcadores de `sessionStorage` que
`tmp/mj_harness.py`/`SNAPSHOT_JS` já esperavam havia tempo
(`__mjBootstrapStarted`, `__mjBootstrapDone`, `__mjBootstrapError`,
`__mjLastError`, `__mjLastRejection`) nunca eram escritos por este arquivo
— todo snapshot os lia como `null`, cego a qualquer falha real de
carregamento.

**Correção (aplicada em `tmp/release-stage/0.1.0/app/bootstrap/minijoomla-sapscripting-bootstrap.js`
e **republicada no SharePoint real em 01/11/2026** — ver §11.3):**
`try/catch` em `bootstrap()`, `markBootstrap(...)` em início/sucesso/erro,
e listeners de `error`/`unhandledrejection` na `window` para capturar
qualquer falha não prevista pelo próprio `try/catch`. Em falha, uma
mensagem acessível (`role="alert"`, "não foi possível carregar o conteúdo
agora") é inserida no contêiner dedicado, nunca no `document.body` real.

### 11.3 Evidência: validação local da correção, depois republicação e validação real

Primeiro validada **localmente, sem nenhuma ação contra o tenant**:
servidor HTTP local servindo a raiz do projeto; uma página de teste com o
mesmo `[data-minijoomla-root]` e um loader equivalente ao real (mesmo
padrão de `import()` dinâmico com cache-busting); uma cópia de teste do
bootstrap com um dos três imports de `loadDependencies()` deliberadamente
apontando para um arquivo inexistente, para forçar o mesmo 404 real já
confirmado em §11.1 — sem simular/forjar o erro em JavaScript, deixando o
`fetch` dinâmico do `import()` falhar de verdade contra o servidor local.

- **Antes da correção** (comportamento documentado, não re-testado
  diretamente — já coberto pela ausência total de marcadores/mensagem):
  rejeição de promessa silenciosa.
- **Depois da correção (local):** confirmado via FIORI-AUTO (mesma sessão
  isolada, só contra o servidor local de teste, aba restaurada à página
  real do SharePoint ao final) que o contêiner passa a mostrar
  `<p role="alert">MINIJOOMLA: não foi possível carregar o conteúdo
  agora. Tente novamente mais tarde.</p>`, e que
  `sessionStorage.__mjBootstrapError` captura a causa real
  (`"Failed to fetch dynamically imported module: .../index-arquivo-que-nao-existe-de-verdade.js?t=..."`),
  sem vazar nenhum detalhe sensível — só o fato de que um módulo
  específico não pôde ser carregado. O caminho feliz (nenhuma falha) foi
  revalidado na mesma sessão, confirmando que `__mjBootstrapStarted`/
  `__mjBootstrapDone` agora são escritos corretamente (antes, nenhum dos
  dois era).

**Republicação real (01/11/2026, autorizada explicitamente pelo
usuário):** o arquivo corrigido (13.901 bytes) sobrescreveu, via
`dev-probe/sp_upload_local_files.py --overwrite`, apenas
`.../releases/0.1.0/app/bootstrap/minijoomla-sapscripting-bootstrap.js`
no `RELEASE_BASE` real — nenhum outro arquivo da release foi tocado.
Verificado por `--verify-target` (SHA-256 + tamanho, `failures=0`) logo
após o upload. Validado de ponta a ponta com um reload real e completo da
página (`fresh_session`/`fresh-snapshot` do harness, não apenas leitura de
uma sessão já aberta): chrome do SharePoint intacto, widget renderizado
corretamente dentro do contêiner dedicado mostrando o estado esperado para
as 4 listas de teste vazias, e — a prova direta de que a correção está
ativa — `sessionStorage.__mjBootstrapStarted`/`__mjBootstrapDone` agora
preenchidos com timestamps reais a cada reload (antes desta correção, os
dois sempre resolviam `null`, mesmo em carregamento bem-sucedido).
`bootstrapError`/`lastError`/`lastRejection` permaneceram `null` em
reloads sucessivos, confirmando ausência de regressão no caminho feliz.

### 11.4 O que continua fora do alcance, de propósito

**Timeout e indisponibilidade reais do tenant** não foram exercitados.
Diferente de um 404 (que é só pedir um arquivo inexistente, sem efeito
colateral), simular timeout/indisponibilidade contra a infraestrutura real
da Microsoft exigiria manipular rede/DNS/latência de forma que está fora
do escopo desta validação — não há um jeito seguro de forçar essa condição
sem tocar algo além do que esta frente controla. Registrado como
**limitação permanente** desta validação técnica, não como pendência ativa
a ser "ainda feita".

## 12. Painel administrativo — dois achados reais do tenant (01/11/2026)

> Encontrados durante a validação Marco D-equivalente do painel
> administrativo (CRUD de extensões/instâncias de módulo/configuração do
> site) e durante a população real das listas de teste com o dataset
> "Blog Sample Data" do Joomla — ambos descobertos pela primeira vez
> porque nenhum trabalho anterior tinha escrito de verdade contra o
> tenant exercitando esses dois caminhos específicos (releitura de etag de
> uma linha única; gravação do campo `Author`).

### 12.1 `createRepository.findMany()` nunca anexa ETag

**Achado:** `createRepository.findMany()` do SPMIDDLE (`data-core`) nunca
anexa `etag` aos itens retornados — só `findById`/`create`/`update` passam
pela função `result()` que define essa propriedade (ver
`packages/data-core/src/repository.js`). Qualquer código que tente reusar
`list()[i].etag` para um `update`/`delete` subsequente recebe `undefined`.

**Onde isso importava de verdade:** `admin-service.js` → `siteConfig.get()`
localiza a linha única de configuração via `findMany()` (não há outro jeito
de descobrir o id sem já conhecê-lo) — a implementação original
devolvia o item de `findMany()` diretamente, então qualquer chamador que
depois tentasse `siteConfig.save(novosValores, { etag: config.etag })`
recebia um `etag` `undefined`, rejeitado por
`ValidationError('etag é obrigatório...')`. O restante do painel
(`createDomainCrud.update/remove`, e `src/administrator/components/com_minijoomla/app.js` desde a correção de
concorrência já documentada) já relia via `get(id)`/`findById` antes de
editar, então não sofria o mesmo problema — só a rota de configuração de
site (linha única) usava `findMany()` como fonte do próprio registro
editável.

**Correção:** `siteConfig.get()` agora usa `findMany()` apenas para achar o
`id` da linha única e relê via `findById(id)` antes de devolver, garantindo
um `etag` real. Sem rede/E2E para provar isso seria impossível perceber:
o fake de teste (`tests/admin-service.test.js`) copiava `etag` em
`findMany()` por acidente (`{ ...item }` incluía o campo), mascarando o
comportamento real do SPMIDDLE — corrigido para omitir `etag` em
`findMany()`, igual ao pacote real, e todos os testes existentes
continuaram verdes (nenhum outro caminho dependia do bug).

### 12.2 Campo customizado `Author` colide com o campo de sistema nativo

**Achado:** toda lista do SharePoint já tem um campo de sistema nativo de
nome interno `Author` ("Created By", tipo `User`, não texto). Ao
provisionar o campo customizado declarado em `spmiddle-schemas.js`/
`spmiddle-test-schemas.js` como `internalName: 'Author'` (tipo `Text`), o
SharePoint aceita a criação (HTTP 201) mas resolve a colisão de nome
silenciosamente, renomeando o `InternalName` real do campo customizado
para `Author0` — mantendo o rótulo exibido (`Title` do campo) como
"Author". Isso é o mesmo fenômeno já documentado para o campo `Title`
(também renomeado para `Title0`), só que com uma consequência diferente:
o campo nativo `Title` aceita texto livre, então o campo órfão `Title0`
simplesmente nunca é lido/escrito e não causa erro; o campo nativo
`Author` **não** aceita uma string (é um campo de pessoa/navegação), então
qualquer tentativa de gravar um texto nele falha com HTTP 400:

```json
{"odata.error":{"code":"-1, Microsoft.SharePoint.Client.InvalidClientQueryException",
"message":{"value":"A 'PrimitiveValue' node with non-null value was found when
trying to read the value of a navigation property; however, a 'StartArray' node,
a 'StartObject' node, or a 'PrimitiveValue' node with null value was expected."}}}
```

**Por que isso nunca foi detectado antes:** nenhum teste local anterior
escreve contra um transporte real do SharePoint (o double em memória de
`tests/spmiddle-integration.test.js` não reproduz a lógica de resolução de
nomes do SharePoint real); e nenhuma escrita real anterior (Marco D,
31/10/2026) preenchia o campo `author` do artigo sintético — o primeiro
artigo real com `author` preenchido só aconteceu ao popular o dataset
"Blog Sample Data" do Joomla nesta sessão.

**Correção:** `ARTICLE_MAPPING.author` em `src/libraries/minijoomla/infrastructure/
spmiddle-repositories.js` agora aponta para `'Author0'` em vez de
`'Author'`. O **schema** continua declarando `internalName: 'Author'`
(é o que de fato precisa ser enviado no POST de criação do campo — o
tenant sempre vai renomeá-lo para `Author0` de novo em qualquer lista
nova, incluindo a futura lista de produção `MiniJoomlaArticles`, ainda não
provisionada); só o **mapeamento de leitura/escrita** do repositório muda.
Confirmado por um `POST` de diagnóstico isolado (bypass do
`createRepository`, direto no transporte REST) que reproduziu o HTTP 400
com `Author` e o HTTP 201 com `Author0`; depois confirmado de ponta a
ponta com a população real completa do dataset e uma releitura via
`content.adapter` mostrando `author: "Joomla"` corretamente em cada
artigo.

**Implicação para a lista de produção ainda não provisionada:** quando
`MiniJoomlaArticles` for provisionada futuramente (§7, ainda pendente),
ela sofrerá exatamente a mesma colisão/renomeação — o mapeamento já
corrigido cobre esse caso automaticamente, sem exigir nenhuma ação adicional
no momento do provisionamento real.

## 13. Publicação real do painel administrativo em `Administrator.aspx` (01/11/2026)

> Extensão pós-fase-1, pedida explicitamente pelo usuário: painel
> administrativo acessível por uma página própria do SharePoint
> (`Administrator.aspx`), separada do site público (`MiniJoomla.aspx`).
> Decisão explícita do usuário, registrada na conversa desta frente: um
> hash tipo `#administrator` na mesma página pública **não** cria nenhuma
> barreira real de acesso (o navegador já recebe o pacote inteiro antes de
> decidir o que o hash significa) — por isso a solução correta é uma
> página separada, cujo controle de acesso (permissão própria do
> SharePoint na página, restrita à conta do usuário) é responsabilidade
> de outra etapa, fora do escopo de código desta seção.

### 13.1 Dois achados reais de publicação, encontrados durante este deploy

**Achado 1 — pacote público já publicado estava defasado.** A pasta
`releases/0.1.0/app/` publicada desde o Marco C/D original nunca foi
atualizada para acompanhar o `src/` atual: faltavam `components/archive.js`,
`core/format.js`, `infrastructure/spmiddle-error-translation.js`,
`modules/dynamic-modules.js`, `plugins/manager.js`, e 11 outros arquivos já
publicados estavam com conteúdo antigo (sem a tradução de erro, sem o
`mod_articles_archive`, sem a API de plugins). Resolvido reconciliando
programaticamente a árvore de dependências (`tmp/resolve-public-manifest.mjs`/
`tmp/resolve-src-manifest.mjs`, resolução transitiva de `import`, nunca uma
lista editada à mão) e ressincronizando com `tmp/sync-release-stage-app.mjs`
— esse script copia cada arquivo do `src/` atual para `release-stage/0.1.0/app/`,
reescrevendo automaticamente o especificador de import do SPMIDDLE do
caminho de desenvolvimento (`../../../SPMIDDLE/packages/...`) para o
caminho relativo real do `vendor/spmiddle/...` já publicado, calculado pela
profundidade de cada arquivo — nunca por edição manual (uma primeira
tentativa manual já tinha introduzido esse exato bug, detectado pelo
validador estrutural abaixo antes de qualquer ação real).

**Achado 2 — cache HTTP do navegador pode servir conteúdo obsoleto para
qualquer import estático sem cache-busting, não só os 3 módulos diretos do
bootstrap.** O bootstrap já cache-busta (`?t=Date.now()`) os 3 módulos que
ele importa diretamente via `import()` dinâmico, mas os 43 `import ...
from '...'` estáticos espalhados pelo resto da árvore (toda a cadeia
transitiva) sempre apontavam para a mesma URL exata, sem query string —
isso já estava documentado como "limitação residual aceita" em §11, mas o
alcance real só ficou claro agora: um navegador real que já tivesse
visitado a página antes de um novo deploy manteria a versão antiga de
*qualquer* desses 43 arquivos por até 24h (`Cache-Control: public,
max-age=86400`, sem revalidação), mesmo após reloads reais repetidos.
Confirmado em produção: a mesma sessão de navegador usada ao longo desta
frente já tinha cacheado uma versão antiga de `modules/content-modules.js`
(sem `articlesArchiveModule`, de uma publicação anterior a §3), o que
quebrou o site público (`MINIJOOMLA: não foi possível carregar o conteúdo
agora`) assim que o pacote foi atualizado para incluir o módulo de
arquivo.

**Correção:** `tmp/apply-cache-bust-to-staged-imports.mjs` reescreve, nas
cópias **publicadas** (nunca em `src/`), todo especificador `import ...
from '<relativo>'` e `import('<relativo>')` com string literal (não toca
template literals que já calculam `${bust}` dinamicamente, como os 3 do
bootstrap) para incluir `?t=<timestamp único desta publicação>`. Validado
localmente antes de qualquer ação real (servidor HTTP local, confirmado
que todas as 30+ requisições resolvem). Depois de publicado, confirmado em
produção que o site público voltou a carregar corretamente.

### 13.2 Achado real não totalmente explicado: Service Worker do SharePoint com cache próprio por URL exata

Durante a validação da publicação do admin, uma chamada real a
`createMiniJoomlaSharePointApp` — importada via uma URL cache-busted que
já tinha sido usada antes numa sonda de diagnóstico contra o mesmo tenant
— devolveu, de forma reproduzível, um resultado incorreto: só 4 dos 7
domínios de dados esperados (`articles`/`categories`/`tags`/`menu`, faltando
`extensions`/`moduleInstances`/`siteConfig`), apesar de (a) o código-fonte
servido sob essa URL exata estar confirmado correto byte a byte, (b) a
mesma função chamada isoladamente com os mesmos 7 domínios funcionar
corretamente, e (c) o mesmo módulo de schemas, importado diretamente com a
mesma query string, também devolver os 7 domínios corretamente. A falha só
se manifestava na composição completa (`createMiniJoomlaSharePointApp`)
montada a partir daquela URL específica, nunca isolando cada peça.

O site tem um Service Worker real ativo
(`https://petrobrasbr.sharepoint.com/_layouts/15/odspserviceworkerproxy.aspx`,
`scope` cobrindo todo `https://petrobrasbr.sharepoint.com/`), confirmado
via `navigator.serviceWorker.controller`, com múltiplas entradas de
`Cache Storage` (`caches.keys()`) contendo URLs de `SiteAssets/minijoomla/`
por query string exata — incluindo a URL problemática. Não foi possível
confirmar com certeza absoluta que o Service Worker (código proprietário
da Microsoft, sem acesso ao código-fonte) é a causa exata do
comportamento, mas a correlação é forte: o problema só ocorreu para uma
URL específica já requisitada antes por uma sonda de diagnóstico, nunca
para uma URL nova.

**Mitigação aplicada (pragmática, não uma correção da causa raiz
subjacente):** gerar sempre um `BUILD_STAMP` novo (baseado em `Date.now()`
no momento da publicação) para o cache-busting de §13.1, e nunca reaproveitar
manualmente um valor de query string já usado numa sonda de diagnóstico
anterior contra o mesmo tenant. Depois de reenviar os arquivos com um
`BUILD_STAMP` nunca antes solicitado, o painel administrativo passou a
funcionar corretamente de forma reproduzível em múltiplos reloads reais.
Registrado como **achado real, mitigado mas não totalmente explicado** —
qualquer trabalho futuro que publique novamente deve continuar gerando um
`BUILD_STAMP` novo a cada deploy real, nunca reaproveitar um antigo.

### 13.3 Evidência real de validação (01/11/2026)

- `Administrator.aspx` criada pelo usuário (cópia de `MiniJoomla.aspx`,
  mesma estrutura de web part Modern Script Editor), `CanvasContent1`
  editada só nesta página (nunca em `MiniJoomla.aspx`) via
  `tmp/mj_admin_harness.py` (wrapper fino sobre `tmp/mj_harness.py`,
  reaproveitando todas as funções já validadas, só trocando `PAGE_URL`).
- Confirmado por `write-canvas` sem `--apply` antes de qualquer escrita
  real: exatamente 2 ocorrências do snippet antigo (idêntico ao
  extraído literalmente da página via JavaScript real, nunca
  reconstruído de memória) — `script`/`scriptCode` do web part.
- Publicado com `--apply --comment "Liga painel administrativo do
  MINIJOOMLA (admin-bootstrap)"`: `updateResult.updated: true`,
  `publishResult.published: true`.
- Reload real completo confirmou o painel de controle real mostrando as
  contagens reais do dataset populado em §8.3: **11 artigos, 4
  categorias, 4 tags, 7 menus, 0 extensões, 0 instâncias de módulo**.
- Navegação real confirmada: listagem de artigos reais (`About`,
  `Working on Your Site`, ...) com link de edição correto; formulário de
  edição de um artigo real (`#/articles/5`) carrega os valores reais
  (`title="About"`, `alias="about"`); tela de extensões mostra estado
  vazio acessível correto; tela de configuração do site renderiza o
  formulário completo.
- Confirmado por reload real de `MiniJoomla.aspx` (depois da publicação)
  que o site público continua funcionando sem regressão: menu real
  (Blog/Help/Joomla/Typography/Busca/Arquivo), sem erro de bootstrap.

### 13.4 O que ainda não foi feito, de propósito

- **Descoberta de extensões** não está habilitada nesta publicação
  (`extensionsFileClientFactory` omitida no bootstrap do admin) — a aba
  "Extensões" mostra a mensagem informativa correta em vez de
  listar/descobrir manifestos novos; incluir isso exigiria publicar
  também o pacote `sharepoint-files` do SPMIDDLE (ainda não publicado) e
  uma pasta `extensions/` dedicada no `RELEASE_BASE`.
- **Controle de acesso à página `Administrator.aspx`** (restringir
  quem pode abri-la a uma única conta, via permissão própria do
  SharePoint na página) foi explicitamente adiado pelo usuário para a
  etapa do "site definitivo" — não implementado nesta sessão.
- **Permissão de escrita das 7 listas** (`TesteMiniJoomla*`) continua
  herdada do site (`HasUniqueRoleAssignments: false`), confirmado por
  leitura somente-leitura durante esta sessão — qualquer "SAP Scripting
  Member"/"Visitor" do site de teste já tem a mesma permissão de
  leitura/escrita que tinha antes da existência do painel administrativo;
  isso não foi alterado nem avaliado como ação pendente (fora de escopo
  desta sessão, por decisão do usuário).

## 14. Rework visual do painel administrativo (Joomla Atum) — publicação real (01/11/2026)

> Extensão do painel administrativo descrito em §12/§13: reconstrução da
> casca visual (header/sidebar/toolbar), seletores relacionais, busca e
> paginação em listagens, confirmação de exclusão e abas na configuração
> do site — todos modelados na estrutura/vocabulário visual real do
> `administrator/` do Joomla (template Atum), nunca cópia literal de
> PHP/SCSS, sempre dentro da paleta Petrobras obrigatória
> (`web-devs/docs/IDENTIDADE-PETROBRAS.md`). Validado localmente (testes
> automatizados + navegador real contra um harness com dados de amostra)
> antes de qualquer publicação, depois publicado e revalidado contra o
> tenant real.

### 14.1 O que foi adicionado

- Casca visual própria (`src/administrator/components/com_minijoomla/render-shell.js`, `src/administrator/components/com_minijoomla/icons.js`):
  header fixo com marca + ícone hambúrguer + sidebar com ícones SVG
  inline + toolbar sticky com breadcrumb/título/ações.
- Seletores relacionais em formulários (`field-schemas.js`): categoria de
  artigo, pai de categoria/menu e extensão de instância de módulo agora
  são `<select>` reais alimentados por `adminService[relation].list()`,
  nunca um ID numérico cru; tags de artigo virou multiselect;
  `excludeSelf` impede um registro de ser pai de si mesmo.
- Confirmação de exclusão (`window.confirm` com mensagem específica do
  domínio) antes de qualquer `remove()` real.
- Busca (`?q=`) e paginação (20 itens/página) nas listagens, filtrando
  contra o `adminService` real — nunca no cliente.
- Abas ARIA (`tablist`/`tab`/`tabpanel`) na configuração do site,
  agrupando `SITE_CONFIG_FIELDS` por `tab` — só ativado quando pelo menos
  um campo declara `tab`; formulários sem abas continuam planos.

### 14.2 Achado real de publicação: `<link>` do CSS com versão fixa, nunca incrementada

Diferente dos bootstraps JS (público e admin), que já se cache-bustam
sozinhos via `import('...${Date.now()}')` dentro do próprio módulo, o
`<link rel="stylesheet" href="...admin.scoped.css?v=1">` escrito
diretamente no `CanvasContent1` usa uma query string **fixa**, nunca
incrementada entre publicações. Depois de reenviar um `admin.scoped.css`
com conteúdo novo (header azul-escuro, sidebar verde, badges, abas) para
a mesma URL+`?v=1`, um reload real mostrou o painel funcionando
corretamente (JS novo, `bootstrapDone` com timestamp real), mas com o
CSS **antigo** ainda aplicado (`cache-control: public, max-age=86400`,
confirmado via `document.styleSheets` que as regras carregadas eram as
do CSS anterior, sem `.admin-header`/`.admin-sidebar`/badges).

**Correção:** incrementado manualmente o `?v=1` → `?v=2` no
`CanvasContent1` de `Administrator.aspx` (único trecho editado,
`tmp/mj_admin_harness.py write-canvas`, dry-run sem `--apply` confirmando
exatamente 2 ocorrências antes de qualquer escrita real). Revalidado por
reload real: `document.styleSheets` passou a expor as 30 regras do CSS
novo, `getComputedStyle(header).backgroundColor` resolvendo para
`rgb(0, 49, 76)` (`--admin-blue-deep`, a cor real do header novo).

Diferente do cache-busting de §13.1/§13.2 (que já cobre todo import JS,
estático ou dinâmico), este `<link>` de CSS é escrito manualmente no
canvas e não passa por nenhum script de reescrita automática — qualquer
publicação futura que troque o CONTEÚDO de `admin.scoped.css` (ou
`default.scoped.css` do site público, que tem a mesma limitação) precisa
lembrar de incrementar manualmente essa query string no canvas, já que
nada hoje faz isso automaticamente.

### 14.3 Evidência real de validação (01/11/2026)

- `tmp/sync-release-stage-app.mjs` atualizado para incluir os 2 arquivos
  novos (`admin/icons.js`, `admin/render-shell.js`) na lista de arquivos
  sincronizados — divergência real encontrada antes de qualquer upload
  (a lista antiga não os conhecia).
- `tmp/build-scoped-css.mjs` reexecutado para regenerar
  `admin.scoped.css` (13.651 bytes, 30 regras `[data-minijoomla-admin-root]`).
- `tmp/apply-cache-bust-to-staged-imports.mjs` reexecutado com um
  `BUILD_STAMP` novo (nunca reaproveitado de uma sonda anterior, por
  disciplina já registrada em §13.2); `tmp/validate-staged-imports.mjs`
  confirmou os 46 arquivos estagiados com todo import relativo
  resolvendo antes de qualquer ação real.
- Upload real (`dev-probe/sp_upload_local_files.py --overwrite`): 3
  arquivos em `admin/` (CSS + 2 bootstraps) e 38 em `app/` (toda a árvore
  de dependências, incluindo os 2 arquivos novos). `--verify-target`
  (SHA-256 + bytes) confirmou `failures=0` após uma segunda passada (a
  primeira passada reportou 6-1 falhas transitórias que resolveram sós
  numa reverificação imediata — mesmo padrão de propagação/latência real
  do tenant já observado antes, não um erro do upload).
- Reload real completo de `Administrator.aspx` confirmou, depois da
  correção de §14.2: painel de controle com o header azul-escuro/sidebar
  verde/contagens reais corretas (11/4/4/7/0/0); listagem real de
  Artigos com busca e badges "Destaque"(amarelo)/"Publicado"(verde)
  sobre os 11 artigos reais; formulário de edição do artigo real `About`
  (`#/articles/5`) com o campo "Categoria" resolvido como `<select>` real
  mostrando "Help" (a categoria real do artigo, não um ID).
- Confirmado por reload real de `MiniJoomla.aspx` que o site público
  permanece sem regressão (menu real, módulos com dados reais nas 4
  seções); o estado "Nenhum conteúdo publicado ainda." na área principal
  é comportamento pré-existente e correto (a rota `home` sempre busca a
  categoria `noticias`, que nunca existiu no dataset real — não foi
  tocado nesta sessão, documentado desde §9.2/checklist).

## 15. Reversão de decisão: paleta real do Joomla no painel administrativo, não a Petrobras (01/11/2026)

> Decisão explícita do usuário, contradizendo a premissa registrada em
> §14: "o MINIJOOMLA tem que ser implementado para oferecer uma
> interface o mais próximo possível do JOOMLA original. Inclusive as
> cores, tipos de letras etc devem ser preservados conforme o
> original. [...] A customização do layout para se adequar à identidade
> Petrobras será feita no template do site [público]". A pasta
> `web-devs/JOOMLA/` (checkout completo do Joomla real) existe
> justamente para ser consultada como fonte de verdade visual, incluindo
> reaproveitamento de ideias de ícones/imagens — nunca uma aproximação
> de paleta corporativa no painel administrativo.

### 15.1 O que estava errado na primeira versão (§14)

Comparado à estrutura/paleta real do template Atum
(`web-devs/JOOMLA/administrator/templates/atum/`, SCSS fonte em
`media_source/templates/administrator/atum/scss/`), a primeira versão
tinha inventado um vocabulário visual próprio sem correspondência real:

- **Header e sidebar em cores DIFERENTES** (azul-marinho Petrobras no
  header, verde Petrobras sólido na sidebar) — o Atum real usa uma
  ÚNICA cor-base (`$base-color`/`$darkblue: #132f53`, `hue: hsl(214,
  63%, 20%)`) em luminosidades diferentes para header/sidebar, nunca
  dois blocos de cor "colados".
- **Borda amarela decorativa no header** — não existe no Atum real,
  invenção própria.
- **Toolbar e cabeçalho de tabela com fundo escuro sólido** — o Atum
  real usa fundo claro/branco (`.subhead`/`.table thead`), com cor só
  no texto/link.
- **Badges de estado como "pills" grandes sólidos coloridos** — o Atum
  real usa indicadores pequenos e discretos (`PublishedButton`/
  `FeaturedButton`: ícone + cor de texto sutil sobre fundo quase
  branco, nunca um bloco de cor predominante).
- **Botões de ação sólidos coloridos** — o Atum real usa fundo claro
  com borda sutil e cor só no ícone/texto; a cor só assume o fundo
  inteiro no `:hover`/`:focus` (ver `_toolbar.scss` `.btn`).
- **Paleta usada era a Petrobras** (`#008542`/`#FDC82F`/`#006298`,
  nunca o vermelho real `#c52827` do Joomla) — decisão agora revertida
  explicitamente: a paleta correta para ESTE painel é a REAL do Atum.

### 15.2 O que foi reconstruído

- `src/media/templates/administrator/atum/css/template.css`: reescrito do zero com as cores reais do Atum
  (`--atum-dark-blue: #001b4c`, `--atum-base: #132f53`,
  `--atum-link: #2a69b7`, `--atum-success: #457d54`,
  `--atum-warning: #ffb514`, `--atum-danger: #c52827` — incluindo o
  vermelho real, que é explicitamente permitido aqui por decisão do
  usuário, mesmo contrariando a regra geral de `IDENTIDADE-PETROBRAS.md`
  que proíbe vermelho fora deste painel administrativo). Header e
  sidebar compartilham a mesma família de azul-marinho; toolbar/tabela
  com fundo claro; botões com cor só até o hover; tipografia `Roboto`
  (a mesma do Atum real,
  `media_source/.../scss/template.scss` importa `roboto-fontface`),
  nunca Arial como "oficial" aqui.
- `src/administrator/components/com_minijoomla/icons.js`: reescrito com SVGs próprios reconstruindo a
  MESMA silhueta dos ícones Font Awesome 6 reais usados pelo Atum
  (`icon-home`/`icon-file-alt`/`icon-folder`/`icon-tags`/`icon-list`/
  `icon-puzzle-piece`/`icon-wrench`/`icon-save`/`icon-check`/
  `icon-ban`/`icon-star`/`icon-trash`/`icon-pen-to-square` — ver
  `administrator/components/com_menus/presets/default.xml` e
  `libraries/src/Toolbar/CoreButtonsTrait.php` para o mapeamento nome
  → ícone real), nunca a biblioteca Font Awesome vendorizada
  (evita a dependência de licença/peso externo, mantendo a mesma
  identidade visual). Ícone de marca no header é uma composição
  giratória própria (nunca o desenho exato das peças do logo real
  `Joomla!`, que é marca registrada), preservando "MINIJOOMLA" como
  wordmark.
- `src/administrator/components/com_minijoomla/render-list.js`: badges de estado agora pequenos com ícone
  (`admin-badge-published`/`-draft`/`-archived`/`-featured`, nunca um
  "pill" sólido grande); `featured:false` mostra a estrela vazia
  (nunca célula vazia nem texto "false"); link "Editar"/"+ Novo" com
  ícone, estilo botão com borda em vez de bloco sólido.
- `src/administrator/components/com_minijoomla/render-form.js`: botão de confirmação usa ícone de
  disquete ("Salvar", cor verde `--atum-success`) e de X ("Cancelar",
  cor azul `--atum-link`), mesma classe `fetchButtonClass` real do
  Joomla (`StandardButton::fetchButtonClass`: `new`/`save`/`apply`/
  `publish` → verde; `cancel`/`trash`/`delete`/`unpublish` → vermelho;
  demais → azul).
- `src/administrator/components/com_minijoomla/app.js`: botão "Excluir" com ícone de lixeira (vermelho);
  botão "Registrar" (descoberta de extensões) com ícone de "+" (verde).

### 15.3 Validação local (navegador real, antes de qualquer publicação)

116 testes automatizados continuaram passando sem nenhuma alteração de
asserção além do HTML esperado (ícones inline nos badges/botões); 46
arquivos sintaticamente limpos. Validado visualmente via FIORI-AUTO
contra `examples/admin.html` (harness local, sem rede): painel de
controle, listagem de artigos (busca + badges), formulário de edição
(seletor de categoria real, botões Salvar/Cancelar/Excluir com as cores
corretas), configuração do site (abas), e o responsivo mobile (375px) —
todos visualmente alinhados à estrutura/paleta real do Atum.

### 15.4 Republicação real em `Administrator.aspx` (01/11/2026)

Mesma disciplina já estabelecida: `tmp/sync-release-stage-app.mjs` →
`tmp/apply-cache-bust-to-staged-imports.mjs` (novo `BUILD_STAMP`, nunca
reaproveitado) → `tmp/validate-staged-imports.mjs` (46 arquivos, todo
import relativo resolvendo) → upload real
(`dev-probe/sp_upload_local_files.py --overwrite`: 3 arquivos em
`admin/` + 38 em `app/`) → `--verify-target` (SHA-256 + bytes,
`failures=0` após 1-2 reverificações — mesma propagação transitória já
documentada, não um erro do upload) → `tmp/release-stage/0.1.0/app`
revertido ao estado sem cache-bust via `git checkout --`, para nunca
deixar o bust de uma publicação específica contaminando o commit
seguinte.

**Achado real repetido de §14.2, confirmado como padrão estrutural, não
um incidente isolado**: o `<link>` do CSS no `CanvasContent1` ainda
estava em `?v=2` (valor definido na publicação de §14) — mesmo com o
arquivo de origem já atualizado para o CSS novo (§15), um reload real
mostrou `admin.scoped.css?v=2` carregado com
`getComputedStyle(header).backgroundColor` resolvendo para
`rgb(0, 49, 76)` (a cor ANTIGA, `#00314c`). Corrigido incrementando
`?v=2` → `?v=3` via `tmp/mj_admin_harness.py write-canvas` (dry-run
confirmando 2 ocorrências exatas antes de qualquer escrita real,
depois `--apply` numa única chamada que já publica).  Revalidado por
reload real: `admin.scoped.css?v=3` carregado,
`getComputedStyle(header).backgroundColor` agora resolvendo para
`rgb(19, 47, 83)` (`#132f53`, a cor REAL do Atum, `--atum-base`).

**Conclusão prática para qualquer publicação futura que troque o
CONTEÚDO de `admin.scoped.css` ou `default.scoped.css`**: sempre
incrementar manualmente a query string do `<link>` no `CanvasContent1`
correspondente — isso nunca é automático, diferente dos bootstraps JS.

**Validação real completa pós-republicação**: reload real de
`Administrator.aspx` mostrou o painel de controle com o visual correto
do Atum (header/sidebar `#132f53`, contagens reais 11/4/4/7/0/0);
listagem real de 11 Artigos com badges corretos (estrela amarela
"Destaque", check verde "Publicado") e botões "+ Novo"/"Editar" com
ícone e borda (nunca mais blocos sólidos). Reload real de
`MiniJoomla.aspx` confirmou o site público sem regressão
(`bootstrapError: null`, menu real intacto).

## 16. Correção estrutural: sidebar em árvore, cpanel agrupado e ícones de estado circulares (02/11/2026)

### 16.1 Achado real: §15 corrigiu cor/tipografia, mas não a ESTRUTURA

O usuário comparou o painel administrativo do MINIJOOMLA com o painel
real de um site Joomla 6.2.0 que ele administra (capturas de tela
reais do `administrator/index.php`), e encontrou 3 divergências
estruturais que §15 não tinha corrigido (§15 só trocou cor/tipografia,
mantendo a ESTRUTURA da versão anterior):

1. **Badges de estado com texto visível** (`✓ Publicado`) — o Atum real
   nunca mostra texto ao lado do indicador de estado; é só um ÍCONE
   CIRCULAR (confirmado em
   `media_source/.../atum/scss/blocks/_icons.scss`, `.tbody-icon`:
   círculo de 26px, `border: 2px solid var(--border)`, cor cinza
   (`$gray-400`) quando inativo, cor real do estado
   (`$icon-success`/`var(--featured-icon-color)`) quando ativo).
2. **Sidebar como lista plana** — todo domínio (Artigos, Categorias,
   Tags, Menus, Módulos, Extensões, Configuração) no mesmo nível. O
   Atum real é uma ÁRVORE DE 2 NÍVEIS: cada seção de nível 1
   ("Conteúdo", "Menus", "Componentes", "Sistema") é um item
   `has-arrow` que expande/colapsa (`.mm-collapse`/`.mm-show`) para
   revelar os itens de nível 2 recuados — confirmado em
   `administrator/modules/mod_menu/tmpl/default_submenu.php` e no
   preset real `administrator/components/com_menus/presets/
   default.xml`/`system.xml`. Só "Painel de controle" é um item solto
   sem filhos (mesmo papel do item raiz `index.php` do preset real).
3. **Painel de controle (cpanel) como lista ícone-esquerda/texto-direita**
   — o com_cpanel real usa cards ÍCONE-ACIMA/TEXTO-ABAIXO dentro de uma
   caixa com borda (`.quickicon`/`.card`), AGRUPADOS sob um título de
   seção por módulo `mod_quickicon` real ("Site"/"Sistema" — ver
   `installation/sql/mysql/base.sql` linhas 654/655:
   `header_icon":"icon-desktop"` para o módulo "Site",
   `"icon-wrench"` para "System").

### 16.2 Achado adicional durante a investigação: `com_tags` não está no menu real

`administrator/components/com_menus/presets/default.xml` não tem
NENHUMA entrada para `com_tags` (confirmado por busca: o único
`<menu>` de `com_tags` é `tags.xml` → `<menu
link="option=com_tags">com_tags</menu>`, sem entrada em `mod_menu`) —
isso bate exatamente com a ausência de "Tags" na sidebar do site real
do usuário. Por isso "Tags" entra no grupo genérico "Componentes"
(equivalente ao `type="container"` real, `dashboard="components"`),
nunca em "Conteúdo" — replicando a divergência real, não inventando
uma posição própria.

### 16.3 O que foi reconstruído

- `src/administrator/components/com_minijoomla/render-shell.js`: reescrito para receber `sidebarGroups`
  (`[{ key, label, icon, items?: [...] }]`) em vez de `sidebarItems`
  plano. Um grupo sem `items` renderiza como item solto (sem seta);
  com `items`, renderiza `<a class="has-arrow" data-admin-sidebar-group
  aria-expanded>` + `<ul class="mm-collapse">` dos filhos — mesmo
  vocabulário real (`has-arrow`/`mm-collapse`/`mm-show`/`mm-active`),
  HTML/CSS próprios. O grupo que contém a rota atual nasce expandido.
- `src/administrator/components/com_minijoomla/app.js`: `SIDEBAR_GROUPS` com a árvore real
  (Painel de controle solto; Conteúdo→Artigos/Categorias;
  Menus→Todos os itens; Componentes→Tags/Módulos/Extensões;
  Sistema→Configuração). `renderOverviewPage` reescrito para agrupar
  os cards do painel de controle em `<section class="admin-overview-group">`
  por "Site"/"Sistema", seguindo a classificação REAL de
  `mod_quickicon/src/Helper/QuickIconHelper.php` (`'group' =>
  'MOD_QUICKICON_SITE'` para Article/Category/Tags/Menu Item/Module/
  Plugin Manager; só `com_config`/`com_checkin`/`com_cache` são
  `MOD_QUICKICON_SYSTEM`) — por isso Módulos/Extensões ficam em "Site"
  junto com o resto do conteúdo, nunca em "Sistema". Nova função
  `bindSidebarGroups()` liga o clique de expansão/colapso de cada
  grupo, religada a cada navegação (mesmo padrão de
  `bindSidebarToggle`/`bindTabHandlers`).
- `src/administrator/components/com_minijoomla/render-list.js`: badges com texto (`admin-badge-*`)
  substituídos por `.admin-state-icon` — ícone circular sem texto
  visível (`<span class="visually-hidden">` preserva o rótulo só para
  leitor de tela). `is-active` (verde `--atum-success`) para
  publicado/habilitado; `is-featured` (âmbar `--atum-featured:
  #c78800`, a MESMA cor `$featured` do `_variables.scss` real, nunca
  confundida com o verde de sucesso) para destaque; sem classe (cinza
  `--atum-gray-400`) para inativo.
- `src/administrator/components/com_minijoomla/icons.js`: `desktopIcon()` (cabeçalho "Site",
  `icon-desktop` real) e `chevronIcon()` (seta de expansão,
  `icon-angle-right` real, gira 90° via CSS quando expandido) — já
  existiam de uma investigação anterior nesta mesma frente, confirmados
  corretos e reutilizados.
- `src/media/templates/administrator/atum/css/template.css`: nova variável `--atum-featured: #c78800`
  (cor real `$featured` do Atum, distinta de `--atum-success`); seção
  `.admin-sidebar-list .has-arrow`/`.mm-collapse`/`.mm-show`/
  `.item.parent.mm-active` para a árvore; `.admin-overview-group`
  (título de seção com ícone) e `.admin-overview` reescrito para
  `flex-direction: column` (ícone acima, texto abaixo) com cards de
  altura mínima fixa; `.admin-state-icon` (círculo 26px, mesma medida
  real do `.tbody-icon`) substituindo `.admin-badge-*`; regra
  `forced-colors` atualizada do seletor antigo para o novo.

### 16.4 Validação local (antes de qualquer publicação)

116 testes automatizados atualizados e passando (`tests/admin-render.test.js`
e `tests/admin-app.test.js`: asserções de badge→ícone-circular e de
`<br>` removido do cpanel); 46 arquivos sintaticamente limpos
(`node scripts/check-syntax.js`). Validado ao vivo via FIORI-AUTO contra
`examples/admin.html` (harness local, sem rede, servido por
`python -m http.server 8786`), usando `browser.evaluate` (não
`browser.screenshot`/`setViewport`, que devolveram `E_PAGE_NOT_FOUND`
para esta sessão específica — achado de ferramental, não do código em
teste; inspeção estrutural via DOM/`getComputedStyle` foi suficiente e
mais precisa que um screenshot para validar estrutura):

- Sidebar: 5 itens de nível 1 (`Painel de controle` sem seta;
  `Conteúdo` 2 filhos; `Menus` 1 filho; `Componentes` 3 filhos;
  `Sistema` 1 filho), todos `aria-expanded="false"` até o clique;
  clicar no grupo "Componentes" resultou em `aria-expanded="true"` e
  `mm-show` aplicado ao `<ul>` de filhos — confirmado via DOM real.
- Painel de controle: `flexDirection: "column"` confirmado via
  `getComputedStyle` no link do card; 2 seções (`"Site"`, `"Sistema"`)
  com os itens esperados (`Site`: Artigos/Categorias/Tags/Menus/
  Módulos/Extensões; `Sistema`: só Configuração).
- Listagem de Artigos: 6 ícones de estado capturados, todos com
  `width: 26px; height: 26px` (círculo real), nenhum com texto visível
  fora do `.visually-hidden`; cores computadas confirmadas via
  `getComputedStyle`:
  `rgb(69, 125, 84)` (`#457d54`, sucesso) para publicado,
  `rgb(199, 136, 0)` (`#c78800`, featured) para destaque,
  `rgb(205, 205, 205)` (`#cdcdcd`, gray-400) para inativo.

Nenhuma publicação real feita ainda nesta rodada — aguardando
confirmação explícita do usuário antes de republicar
`Administrator.aspx` (mesma disciplina de permissão já seguida em
todo o restante deste projeto).

### 16.5 Republicação real em `Administrator.aspx` (02/11/2026)

Autorizada explicitamente pelo usuário. Mesma disciplina já
estabelecida: commit do código (`3a1f7ff`) →
`tmp/sync-release-stage-app.mjs` → `tmp/build-scoped-css.mjs` →
`tmp/apply-cache-bust-to-staged-imports.mjs` (novo `BUILD_STAMP`) →
`tmp/validate-staged-imports.mjs` (48 arquivos, todo import relativo
resolvendo) → `?v=3` → `?v=4` no `<link>` do CSS via
`tmp/mj_admin_harness.py write-canvas` (dry-run confirmando 2
ocorrências exatas, depois `--apply` numa única chamada que já
publica) → upload real
(`dev-probe/sp_upload_local_files.py --overwrite`: 3 arquivos em
`admin/` + 38 em `app/`) → `tmp/release-stage/0.1.0/app` e
`.../admin` revertidos ao estado sem cache-bust via `git checkout --`.

**Incidente real durante o upload, encontrado e sem dano**: os dois
comandos de `sp_upload_local_files.py` foram chamados com
`--site-url` apontando só para a raiz do site
(`.../teams/SAPScripting`), não para a página completa. Como
`open_or_attach()` chama `browser.open` com essa URL quando nenhuma
sessão compatível já está aberta, a aba que estava em
`Administrator.aspx` foi renavegada (terminando, por um motivo
externo a este script, em outra aba/site — `tecnologiasdigitais`).
**Isso não corrompeu nem afetou o upload real**: o upload em si usa
`fetch` dentro da página anexada contra `site_rel` (calculado a partir
do `--site-url`, nunca da URL de navegação atual), então os dois
uploads completaram corretamente independente de qual URL a aba
mostrava no momento. Corrigido reabrindo `Administrator.aspx`
explicitamente (`browser.open` com a URL completa da página) antes de
qualquer validação — prática a repetir em publicações futuras: sempre
passar a URL completa da página (nunca só a raiz do site) em todo
`--site-url`/`browser.open`, mesmo quando o efeito real (upload via
REST) não depende da navegação da aba.

**Validação real completa pós-republicação** (via `browser.evaluate`
contra a sessão real, não screenshot — mesma limitação de ferramental
já registrada em §16.4 para esta sessão específica):
- Sidebar real com 5 grupos (`Painel de controle`, `Conteúdo`,
  `Menus`, `Componentes`, `Sistema`).
- `admin.scoped.css?v=4` carregado;
  `getComputedStyle(header).backgroundColor` = `rgb(19, 47, 83)`
  (`#132f53`, correto).
- Painel de controle com as 2 seções reais (`Site`, `Sistema`).
- Listagem de Artigos com 22 ícones de estado reais (11 artigos × 2
  colunas), todos com 26px de diâmetro.
- `bootstrapError: null`.
- Reload real de `MiniJoomla.aspx` (site público) confirmou nenhuma
  regressão: `bootstrapError: null`, menu real intacto
  (`Início`/`Blog`/`Help`/`Joomla`/`Typography`/`Busca`/`Arquivo`).

## 17. Supervisão geral: dois bugs visuais reais corrigidos e editor de texto rico real (TinyMCE) introduzido (02/11/2026)

### 17.1 Dois bugs visuais reais encontrados em supervisão

Numa revisão geral do painel (sem o usuário apontar um sintoma
específico de antemão — o próprio usuário sinalizou "o menu do painel
e o conteúdo das tabelas ainda estão precisando de ajustes"), uma
captura real contra `examples/admin.html` revelou dois defeitos de
CSS reais, nenhum dos dois pego pelos 116 testes automatizados (os
testes verificam HTML gerado, não CSS computado — a mesma lacuna já
é um risco conhecido de testes só-de-string):

1. **`.visually-hidden` nunca foi definido em `src/media/templates/administrator/atum/css/template.css`**
   — só existe em `src/media/templates/site/cassiopeia/css/template.css` (site público, nunca
   carregado dentro do painel admin). O texto reservado a leitor de
   tela de cada `.admin-state-icon` (ex.: "Publicado", "Sem destaque")
   aparecia sobreposto visualmente ao ícone, em vez de escondido.
   Corrigido adicionando a mesma definição real (WCAG/Bootstrap) já
   usada em `default.css` diretamente em `admin.css`.
2. **Links de nível 2 da sidebar (dentro de `.mm-collapse`) caíam no
   azul padrão do navegador** (`rgb(0,0,238)`, link não estilizado)
   em vez de branco — a regra `.admin-sidebar-list>.item>a` usava
   combinador de filho DIRETO, que nunca alcança um `<a>` mais
   profundo na árvore (dentro de um grupo expansível). Corrigido
   removendo o `>` (agora `.admin-sidebar-list a`), aplicando a cor
   branca a QUALQUER link da sidebar, nível 1 ou 2.

Ambos confirmados corrigidos por captura de tela real
(`tmp/visual-evidence/admin-check1.png` com o bug,
`admin-check2-fixed.png` sem) e por `getComputedStyle` ao vivo via
FIORI-AUTO contra o harness local.

### 17.2 Editor de texto rico real (TinyMCE), prioridade alta reportada pelo usuário

Achado real reportado pelo usuário em supervisão: os campos de texto
que o site público trata como HTML (`fulltext` de Artigos e
`customHtmlBody` da configuração do site) eram só `<textarea>` cru —
o usuário ficava obrigado a digitar HTML na mão, sem nenhum recurso
de negrito/itálico/listas, o que invalidaria o uso prático do painel
por quem edita conteúdo. Decisão do usuário, explicitamente pedida:
vendorizar o TinyMCE self-hosted real (não um editor próprio nem uma
biblioteca alternativa como Quill) — o mesmo editor que o Joomla real
usa (`plugins/editors/tinymce`).

**Licença confirmada antes de vendorizar**: `tinymce@7.9.1` via
unpkg, `license.md` real do pacote = `GNU General Public License
Version 2 or later` — a MESMA licença que o próprio
`plg_editors_tinymce` do Joomla já declara (`tinymce.xml`,
`<author>Tiny Technologies, Inc</author>`), sem nenhuma exigência de
API key em tempo de execução para a opção `license_key: 'gpl'`
(confirmado lendo o `tinymce.min.js` real: a opção é aceita
nativamente pelo core).

**Risco de CSP identificado e evitado**: o tenant real tem
Content-Security-Policy restrita por allowlist de domínios
(`script-src` — ver §10.1), então um `<script src="https://cdn...">`
apontando para um CDN externo (unpkg/jsdelivr/tiny.cloud) muito
provavelmente seria bloqueado em produção. Por isso os arquivos reais
foram baixados (via `fetch` dentro de uma sessão FIORI-AUTO real, que
tem saída de rede — a ferramenta `webfetch` deste ambiente não
conseguiu nenhuma saída de rede externa no momento, achado de
ferramental registrado para referência futura) e vendorizados em
`src/media/vendor/tinymce/`, para serem publicados como qualquer
outro arquivo estático do pacote (mesmo padrão do `vendor/spmiddle/`
já existente).

**Árvore vendorizada minimal, não a distribuição completa**: só os
arquivos que o preset "simple" real do `plg_editors_tinymce`
realmente usa (`ToolbarPresets.php`: bold/underline/strikethrough,
undo/redo, bullist/numlist, pastetext) — core (`tinymce.min.js`),
tema `silver`, modelo `dom`, ícones `default`, skin `oxide` (UI +
conteúdo) e o único plugin necessário (`lists`, de onde vêm
bullist/numlist). Total ~1.24 MB, contra ~9 MB da distribuição
completa (todos os 29 plugins + todos os skins/temas). `readmore` e
`jxtdbuttons` do preset real (específicos de `com_content`/botões
próprios do Joomla) foram omitidos de propósito — sem equivalente no
MINIJOOMLA, nunca substituídos por um botão inventado.

**Campos elegíveis decididos por varredura real, não por suposição**:
antes de aplicar o tipo `richtext` a qualquer campo, foi feita uma
varredura de todo `src/**/*.js` por `sanitizeHtml(` fora de
`tests`/`security` — confirmando que SÓ dois campos são tratados como
HTML real pelo site público:
- `article.fulltext` (`src/components/com_content/tmpl/article/default.js`, `renderArticle`).
- `customHtmlModule.settings.html`
  (`src/libraries/minijoomla/modules/content-runtime.js`), vindo de
  `config.customHtml.html` (`siteConfig.customHtmlBody` no painel).

Todo outro campo de texto (`introtext`, `description` de categoria,
`siteDescription`) é tratado como TEXTO PURO (`escapeHtml`, nunca
`sanitizeHtml`) pelo site público — um primeiro rascunho desta
implementação errou ao atribuir `richtext` também a esses três
campos, corrigido antes de qualquer publicação real. Dar um editor
rico a um campo tratado como texto puro faria o usuário formatar algo
que o site exibiria como tags HTML literais escapadas na tela — um
contrato quebrado nunca documentado como aceitável.

**O que foi criado/alterado**:
- `src/media/vendor/tinymce/`: árvore vendorizada (9 arquivos, ver
  acima), nunca modificada manualmente — cópia literal dos arquivos
  reais baixados.
- `src/administrator/components/com_minijoomla/editor.js` (novo): `loadTinyMceCore(vendorBaseUrl)`
  (carrega o core uma única vez por página, configurando
  `window.tinyMCEPreInit.base`/`suffix` ANTES do script carregar —
  confirmado no `tinymce.min.js` real que o próprio bootstrap lê isso
  de `window.tinymce||window.tinyMCEPreInit` para resolver os
  sub-recursos tema/modelo/ícones/skin/plugin, nunca a partir da URL
  do script em si) e `attachRichTextEditor(elementId, {
  vendorBaseUrl })` (monta uma instância real sobre o `<textarea>`
  identificado, sincroniza o valor de volta ao `<textarea>` em
  `change input undo redo SetContent`, devolve `{ destroy() }`).
- `src/administrator/components/com_minijoomla/field-schemas.js`: novo `type: 'richtext'` em
  `ARTICLE_FIELDS.fulltext` e `SITE_CONFIG_FIELDS.customHtmlBody`.
- `src/administrator/components/com_minijoomla/render-form.js`: `type: 'richtext'` renderiza
  exatamente como `'textarea'`, só adicionando o atributo
  `data-admin-richtext` — nenhuma mudança de contrato de dados
  (`readAdminFormValues` continua lendo `.value`, igual qualquer
  textarea).
- `src/administrator/components/com_minijoomla/app.js`: nova opção `richTextEditorFactory` em
  `createAdminApplication` (injetável, mesmo princípio de
  `transportFactory`); `bindRichTextEditors()` destrói toda instância
  da navegação anterior ANTES de montar as novas (mesmo motivo de
  `bindFormHandlers`/`bindTabHandlers` precisarem religar a cada
  `onNavigate`, que substitui `documentRef.body.innerHTML` por
  completo).

### 17.3 Segundo bug real encontrado e corrigido: editor dentro de uma aba oculta

Validação visual ao vivo contra a configuração do site (aba "HTML
personalizado", onde vive `customHtmlBody`) revelou um segundo bug
real: essa aba nasce `hidden` (só a primeira aba, "Site", começa
visível); o TinyMCE criado sobre um `<textarea>` já dentro de um
painel oculto mede o espaço disponível NO MOMENTO EXATO da criação
(0×0, por estar `display:none`) e NUNCA se recalcula sozinho depois —
revelar a aba de novo não resolve, o editor fica permanentemente sem
altura/invisível. Confirmado por `getComputedStyle`/
`getBoundingClientRect` reais: `{x:0,y:0,width:0,height:0}` antes da
correção.

**Correção**: `bindRichTextEditors()` agora separa, no momento do
bind, os elementos `data-admin-richtext` que já estão visíveis dos
que estão dentro de um painel `[data-admin-tab-panel][hidden]` —
só os primeiros são inicializados imediatamente; os segundos entram
em `pendingRichTextElementIds` (um estado novo do app). Uma nova
responsabilidade de `bindTabHandlers()` (`mountPendingRichTextEditorsInPanel`)
monta, no exato momento em que o usuário revela aquela aba pelo
clique (quando o DOM já tem dimensões reais), qualquer editor
pendente cujo elemento esteja dentro do painel revelado.

**Validação real pós-correção**: `getBoundingClientRect()` do editor
revelado = `{x:308, y:341, width:640, height:400}` (dimensões reais,
não mais 0×0); screenshot real confirmou a toolbar e área de edição
visíveis (`tmp/visual-evidence/editor-customhtml-fixed.png`); teste
de digitação real (`editor.execCommand('Italic')`) aplicou `<em>`
real e sincronizou com o `<textarea>` subjacente.

### 17.4 Validação completa

- 11 testes de `tests/admin-render.test.js` (novo #13: campo
  `richtext` renderiza como textarea com `data-admin-richtext`, lido
  exatamente como textarea simples) e 12 de
  `tests/admin-app.test.js` (novo #9: `richTextEditorFactory` chamado
  uma vez por campo visível, instância da navegação anterior
  destruída antes da próxima montar; novo #10: campo dentro de uma
  aba que nasce oculta nunca é inicializado antes de a aba ser
  revelada, reproduzindo o bug real de §17.3 com um fake
  `documentRef`/`closest()` sem DOM real) — todos passando.
- 52 arquivos sintaticamente limpos (`node scripts/check-syntax.js`).
- Validado ao vivo via FIORI-AUTO contra `examples/admin.html`
  (atualizado para passar `richTextEditorFactory: (elementId) =>
  attachRichTextEditor(elementId, { vendorBaseUrl:
  '../src/administrator/components/com_minijoomla/vendor/tinymce' })`): negrito real aplicado e
  sincronizado em `fulltext` de um Artigo
  (`tmp/visual-evidence/editor-check1.png`); itálico real aplicado e
  sincronizado em `customHtmlBody` depois da correção de §17.3.
- Nenhuma publicação real feita ainda nesta rodada — aguardando
  confirmação explícita do usuário, mesma disciplina de permissão já
  seguida em todo o restante deste projeto.

### 17.5 Republicação real em `Administrator.aspx` (02/11/2026)

Autorizada explicitamente pelo usuário ("prossiga sem parar, até o
fim"). Commit do código (`9737c79`) → `tmp/sync-release-stage-app.mjs`
(nova entrada `admin/editor.js` adicionada à lista de arquivos
sincronizados) → cópia da árvore vendorizada
(`src/media/vendor/tinymce/` → `tmp/release-stage/0.1.0/vendor/tinymce/`)
→ bootstrap do admin reescrito para carregar `attachRichTextEditor`
e injetar `richTextEditorFactory` (URL do vendor:
`/teams/SAPScripting/SiteAssets/minijoomla/releases/0.1.0/vendor/tinymce`,
nunca um CDN externo) → `tmp/build-scoped-css.mjs` →
`tmp/apply-cache-bust-to-staged-imports.mjs` → `?v=4` → `?v=5` no
`<link>` do CSS (dry-run confirmando 2 ocorrências, depois
`--apply`) → upload real (`dev-probe/sp_upload_local_files.py
--overwrite`: 3 arquivos em `admin/`, 39 em `app/` — incluindo o novo
`editor.js` —, 9 em `vendor/tinymce/`, total 51) →
`--verify-target` (SHA-256 + bytes; `admin/` e `vendor/tinymce/`
`failures=0` de primeira; `app/` reportou 1 falha transitória em
`render-form.js`, resolvida sós numa reverificação imediata — mesmo
padrão de propagação/latência real já documentado em publicações
anteriores) → `tmp/release-stage/0.1.0` revertido e resincronizado
ao estado sem cache-bust, depois adicionado ao controle de versão
como evidência de publicação (mesmo padrão de commits anteriores
desta frente).

**Lição de §16.5 aplicada corretamente esta vez**: todo
`browser.navigate`/`browser.open` usado nesta publicação passou a
URL COMPLETA de `Administrator.aspx` (nunca só a raiz do site) —
nenhum desvio de aba ocorreu.

**Incidente real encontrado e corrigido durante a própria
validação**: mesmo com `?v=5` publicado corretamente e o conteúdo do
CSS já correto no servidor (confirmado por `fetch` direto com um
parâmetro de cache-busting extra), um reload comum da página
continuou servindo o CSS ANTIGO para a URL exata `?v=5` — o
navegador já tinha cacheado essa URL exata antes do upload re-subir
o conteúdo novo (mesma janela de corrida entre "query string
incrementada" e "conteúdo do arquivo propagado" já documentada como
risco, nunca antes observada se materializar). Corrigido
incrementando mais uma vez, para `?v=6` — reload subsequente
confirmou o CSS correto (ver abaixo). Lição adicional: **confirmar o
conteúdo real do CSS carregado via inspeção de `document.styleSheets`
(seletores reais das regras) sempre depois de QUALQUER republicação
de CSS, mesmo quando o upload e o `--verify-target` já reportaram
sucesso** — o sucesso do upload/verify garante que o arquivo no
servidor está correto, nunca que o navegador já o carregou.

**Validação real completa pós-republicação** (`?v=6`, via
`browser.evaluate` contra a sessão real):
- `document.styleSheets` da folha `admin.scoped.css?v=6` carregada:
  regra `[data-minijoomla-admin-root] .visually-hidden` presente
  (bug 1 corrigido); regra do link de sidebar sem o combinador `>`
  (`[data-minijoomla-admin-root] .admin-sidebar-list a`, bug 2
  corrigido); `getComputedStyle` do link de nível 2 =
  `rgb(255, 255, 255)` (branco real).
- `tinymce.get()` retornou `['admin-field-articles-fulltext']` ao
  editar um Artigo real; `editor.execCommand('Bold')` aplicou
  `<strong>` real, sincronizado com o `<textarea>` subjacente;
  screenshot real confirmou a toolbar e o texto selecionado em
  destaque (`tmp/visual-evidence/editor-live-republish.png`).
- Editor dentro da aba oculta (`customHtmlBody`, "HTML
  personalizado") confirmado com dimensões reais
  (`{width: 640, height: 400}`, nunca 0×0) ao revelar a aba —
  correção de §17.3 validada também em produção
  (`tmp/visual-evidence/editor-customhtml-live-republish.png`).
- Reload real de `MiniJoomla.aspx` (site público) confirmou nenhuma
  regressão: `bootstrapError: null`, menu real intacto.

### 17.6 Bug real corrigido: preset de toolbar errado aplicado ao admin (TinyMCE "simplificado demais", 02/11/2026)

Usuário reportou que o TinyMCE do painel administrativo parecia
"simplificado demais" comparado ao Joomla real (poucos botões,
nenhum menu, sem tabela/imagem/código/mídia). Investigação confirmou
a causa raiz contra o código-fonte real do Joomla
(`web-devs/JOOMLA`, nunca editado, só lido como referência):

- `plugins/editors/tinymce/src/PluginTraits/ToolbarPresets.php`
  define 3 presets: `simple` (bold/underline/strikethrough,
  undo/redo, bullist/numlist, pastetext — sem menu), `medium`
  (conjunto intermediário, com menu) e `advanced` (toolbar completo,
  com menu, ver lista abaixo).
- `plugins/editors/tinymce/src/PluginTraits/DisplayTrait.php` (linha
  ~294) escolhe o preset POR GRUPO DE USUÁRIO: `switch (true) { case
  isset($ugroups[4]) || isset($ugroups[7]) || isset($ugroups[8]):
  $preset = $presets['advanced']; ... case isset($ugroups[2]) ||
  isset($ugroups[6]): $preset = $presets['medium']; ... default:
  $preset = $presets['simple']; }` — grupos Administrador/Super
  Usuário (ids 4/7/8) recebem `advanced`; Registrado/Gerente (ids
  2/6) recebem `medium`; todo o resto (público, sem sessão ou grupo
  Público) recebe `simple`.

A implementação original desta frente (§17.2) implementou SÓ o
preset `simple` e o aplicou tanto para uso público hipotético quanto
para o admin — raciocínio errado, porque quem abre o painel
administrativo do MINIJOOMLA sempre desempenha o papel de
Administrador/Super Usuário, nunca o papel público. O preset correto
para o admin é `advanced`.

**Correção**: `src/administrator/components/com_minijoomla/editor.js` agora monta o preset `advanced`
real, reproduzindo botão a botão o array `toolbar1` de
`ToolbarPresets.php` e o array `menu` (`edit insert view format
table tools help`). Cinco botões do array real foram excluídos
deliberadamente (nunca substituídos por um botão inventado, mesmo
princípio já documentado para `jxtdbuttons` no preset `simple`
anterior):
- `jtemplate` — insere templates de conteúdo Joomla; não existe
  conceito de "template de conteúdo" no MINIJOOMLA.
- `jxtdbuttons` — botões de extensão de outros componentes Joomla
  (inserir módulo/artigo/contato via com_modules/com_fields etc.);
  nenhum desses componentes existe no MINIJOOMLA.
- `abbr`/`abbr_remove` — plugin de abreviação PRÓPRIO do Joomla
  (`plg_editors_tinymce.abbr`, script Joomla carregado separadamente
  em `DisplayTrait.php`, linha ~419), não um plugin TinyMCE padrão
  disponível no pacote `tinymce` do npm.
- `language` — seletor de idioma de trechos, recurso de multilíngue
  do Joomla (`com_languages`), fora de escopo do MINIJOOMLA.

`readmore` permanece no toolbar, mas com a MESMA lógica já existente
desde §17.2: nunca faz parte do preset base, só é concatenado ao
final do toolbar quando `readMoreButton: true` (exclusivo de
`ARTICLE_FIELDS.articletext`) — continua sendo um botão de
EDITOR-XTD real registrado manualmente via
`editor.ui.registry.addButton`, nunca um plugin TinyMCE vendorizado.

Cada botão restante foi mapeado ao plugin TinyMCE que realmente
precisa, usando `plugins/editors/tinymce/src/PluginTraits/
KnownButtons.php` como fonte (campo `'plugin' => '...'`); botões sem
esse campo (bold/italic/underline/strikethrough, alinhamentos,
undo/redo, bullist/numlist em si, cut/copy/paste, etc.) são nativos
do core ou do plugin `lists` já vendorizado. O menu `help` exige o
plugin `help` (`DisplayTrait.php`, linha ~315: `in_array('help',
$menubar)` força `$plugins[] = 'help'`); `ltr`/`rtl` exigem o plugin
`directionality`, não um plugin próprio.

Não foi criado um terceiro preset `medium`: não existe, hoje, nenhum
consumidor Registrado/Gerente do painel administrativo do
MINIJOOMLA — só Administrador/Super Usuário monta esta tela.
`TOOLBAR_SIMPLE`/`PLUGINS_SIMPLE` foram removidas de `editor.js`
(confirmado por varredura: nenhum outro arquivo as referenciava).

**Árvore vendorizada ampliada** (`src/media/vendor/tinymce/`, mesma
versão `tinymce@7.9.1` já vendorizada, mesmos caminhos relativos já
usados por `plugins/lists/plugin.min.js`), com os plugins novos que
o preset `advanced` passa a exigir:
`plugins/link/plugin.min.js`, `plugins/image/plugin.min.js`,
`plugins/table/plugin.min.js`, `plugins/code/plugin.min.js`,
`plugins/charmap/plugin.min.js`, `plugins/emoticons/plugin.min.js`
(com os sub-recursos `plugins/emoticons/js/emojis.min.js` e
`plugins/emoticons/js/emojiimages.min.js`, resolvidos pelo próprio
TinyMCE a partir do `baseURL`, sem lógica extra em `editor.js`),
`plugins/media/plugin.min.js`, `plugins/searchreplace/plugin.min.js`,
`plugins/fullscreen/plugin.min.js`,
`plugins/visualchars/plugin.min.js`,
`plugins/visualblocks/plugin.min.js`,
`plugins/nonbreaking/plugin.min.js`,
`plugins/codesample/plugin.min.js`,
`plugins/insertdatetime/plugin.min.js`,
`plugins/accordion/plugin.min.js`, `plugins/anchor/plugin.min.js`,
`plugins/directionality/plugin.min.js`,
`plugins/preview/plugin.min.js`, `plugins/help/plugin.min.js` —
dezoito plugins novos, mais `lists` (já existente), totalizando
`plugins: 'lists link image table code charmap emoticons media
searchreplace fullscreen visualchars visualblocks nonbreaking
codesample insertdatetime accordion anchor directionality preview
help'` em `editor.js`. A árvore deixou de ser "minimal" (nota de
§17.2, "~1.24 MB" já está obsoleta) — agora reflete fielmente o que
o preset `advanced` real do Joomla carrega para Administrador/Super
Usuário, não uma seleção reduzida por engano.

**Validação**: `node scripts/check-syntax.js` (54 arquivos) e `node
tests/run-tests.js` (todos os testes existentes, incluindo
`admin-render`/`admin-app`) seguem passando sem alteração de
comportamento de contrato de dados (`data-admin-richtext`,
`data-admin-readmore`, leitura/escrita de `.value` por
`readAdminFormValues`) — só a configuração interna do TinyMCE
(toolbar/menu/plugins) mudou.

**Republicação real e validação pós-queda de energia**: os 21
arquivos novos foram baixados via `fetch` dentro de uma sessão
FIORI-AUTO real e isolada (própria desta sessão, nunca compartilhada
com a instância já em uso por outra LLM concorrente — ver lição
operacional registrada no início de §17.6.1 abaixo), vendorizados em
`src/media/vendor/tinymce/` e republicados em
`releases/0.1.0/{app,admin,vendor/tinymce}` e
`releases/0.1.3/{app,admin,vendor}` (a pasta que a página real
efetivamente carrega — ver §17.5). Durante a publicação desta
correção houve uma queda de energia real; a reavaliação pós-queda
confirmou, sem reexecutar nenhum passo: processo do FioriAgent desta
sessão e sua sessão de página ainda vivos; nenhum arquivo local
truncado/corrompido (30 arquivos vendorizados, nenhum com 0 bytes);
`node scripts/check-syntax.js`/`node tests/run-tests.js` seguem
passando; `--verify-target` (SHA-256 + bytes) limpo em ambas as
pastas publicadas; validação visual ao vivo repetida confirmou
`bootstrapError: null` no site público e no admin, com o menu
`Edit/Insert/View/Format/Table/Tools/Help` e 20 grupos de toolbar
reais presentes no artigo 8. Conclusão: conteúdo já publicado no
SharePoint (server-side) não é afetado por uma queda de energia
local — só o processo de publicação em si precisa, nesse caso, ser
reconfirmado, nunca reexecutado de forma automática sem essa
reconfirmação.

**Lição operacional confirmada nesta correção**: ao delegar trabalho
pesado de rede/DOM que depende de um navegador real, prefira dividir
o trabalho entre um agente que só edita código/testes/documentação
(sem acesso a rede/DOM) e a própria sessão corrente para qualquer
parte que dependa de uma sessão de navegador real — nunca delegue a
um subagente algo que exija abrir/anexar uma instância de navegador,
porque subagentes não têm acesso à sessão FIORI-AUTO já isolada da
sessão corrente, e abrir uma nova por conta própria arriscaria
colidir com outra instância já em uso por outra LLM concorrente no
mesmo ambiente (incidente real já ocorrido nesta mesma frente, antes
desta correção — ver §17.5).

### 17.7 Bug real corrigido: botão "⋯" (mostrar/ocultar linhas extras do toolbar) ausente

Usuário reportou, após a correção do preset `advanced` (§17.6), que
o botão "⋯" real do Joomla (ícone de 3 pontos, tooltip "Exibir ou
ocultar itens adicionais da barra de ferramentas") — que recolhe as
linhas extras do toolbar atrás de um único botão, expandindo-as ao
clicar — não aparecia no MINIJOOMLA, mesmo com todos os botões reais
do preset `advanced` já presentes.

**Causa raiz confirmada**: `attachRichTextEditor` configurava
`toolbar_mode: 'wrap'`, não `'sliding'` (o
`default="sliding"` real do campo `toolbar_mode` em
`web-devs/JOOMLA/plugins/editors/tinymce/forms/setoptions.xml`,
linha ~59). São dois modos de layout do TinyMCE genuinamente
diferentes, não uma variação cosmética: `'wrap'` sempre quebra todo
botão que não cabe em novas linhas, todas permanentemente visíveis,
sem nenhum botão de recolher; `'sliding'` mantém só a primeira linha
visível por padrão e introduz o botão real `overflow-button`
(`aria-label="Reveal or hide additional toolbar items"`) ao final
dela, que alterna a visibilidade das linhas seguintes.

**Correção**: `toolbar_mode: 'wrap'` → `'sliding'` em
`attachRichTextEditor` (`src/administrator/components/com_minijoomla/editor.js`). Nenhuma outra opção
mudou.

**Validação ao vivo**: republicado em `releases/0.1.0` e
`releases/0.1.3`; confirmado no artigo 8 de
`Administrator.aspx` — botão `[data-mce-name="overflow-button"]`
presente ao final da primeira linha do toolbar
(`aria-expanded="false"` inicialmente); um clique real
(`element.click()`) alterna para `aria-expanded="true"` e revela as
3 linhas adicionais do toolbar (estilos de parágrafo/fonte/tamanho,
busca, listas, indentação, link, imagem, código, cor, tela cheia,
tabela, sub/sobrescrito, caracteres especiais, emoji, vídeo, linha
horizontal, cortar/copiar/colar, impressão, visualizar, código-fonte,
data/hora, remover formatação, "Leia mais") — confirmado por
screenshot real, idêntico ao comportamento do Joomla 6.2.0 oficial
mostrado pelo usuário.

### 17.8 Bug real corrigido: imagem inserida no TinyMCE aparecia como quadrado quebrado no artigo publicado

Usuário reportou, após as correções de §17.6/§17.7, que uma imagem
inserida no editor do artigo 8 ("About your home page") e salva
aparecia como um pequeno quadrado quebrado no artigo publicado em
`MiniJoomla.aspx`, nunca a imagem em si.

**Causa raiz confirmada**: sem nenhum destino de upload configurado,
o TinyMCE insere qualquer imagem colada/arrastada como `<img
src="data:image/png;base64,...">` (data URI inline) — confirmado
consultando diretamente a lista real `MiniJoomlaArticles` (campo
`Introtext` do artigo 8 continha exatamente esse `data:` URI).
`src/libraries/minijoomla/security/sanitize.js` (`safeUrl`) bloqueia `data:` DE PROPÓSITO
(vetor real de XSS: um `data:` poderia carregar HTML/SVG malicioso
disfarçado de imagem) — não era um bug do sanitizador, e nunca devia
ser "corrigido" afrouxando essa regra. O único caminho real e seguro
era dar ao TinyMCE um destino de upload real, equivalente ao
`com_media` do Joomla real, para que a imagem exista como arquivo de
verdade, referenciada por uma URL normal.

**Implementação**:
- `src/libraries/minijoomla/application/media-upload-service.js` (novo):
  `createMediaUploadService(fileClient)` — `uploadImage({ content,
  mimeType })` envia os bytes reais da imagem via
  `createSharePointFileClient` (pacote `sharepoint-files` do
  SPMIDDLE, já vendorizado em `vendor/spmiddle/sharepoint-files/`) e
  devolve a `ServerRelativeUrl` real do arquivo. Nome de arquivo
  sempre gerado (`img-<timestamp>-<contador>.<extensão>`), nunca
  reaproveitado do upload original; extensão derivada do MIME type
  real (`image/png`, `image/jpeg`, `image/gif`, `image/webp`), nunca
  de um nome de arquivo informado pelo usuário.
- `src/libraries/minijoomla/composition/createMiniJoomlaAdminApp.js`: nova opção
  `mediaFileClientFactory` (mesmo padrão já existente de
  `extensionsFileClientFactory`) — monta `media` via
  `createMediaUploadService`, `null` quando omitida.
- `src/administrator/components/com_minijoomla/editor.js`: nova opção `uploadImage` em
  `attachRichTextEditor`, habilita `images_upload_handler` real do
  TinyMCE (lê `blobInfo.blob()`, converte para `ArrayBuffer`, chama
  `uploadImage`, devolve a URL real). Sem `uploadImage`, o botão de
  imagem continua visível (preset "advanced") mas uma tentativa de
  inserir imagem falha com uma mensagem clara do próprio TinyMCE,
  nunca insere silenciosamente um `data:` URI.
- `tmp/release-stage/*/admin/bootstrap/minijoomla-sapscripting-admin-bootstrap.js`:
  `mediaFileClientFactory` real, apontando `libraryPath` para a
  biblioteca-base `SiteAssets/minijoomla` (pasta `uploads` já criada
  manualmente neste tenant); `uploadImage` repassado ao
  `richTextEditorFactory`.

**Segundo bug real encontrado durante a validação desta correção**:
a URL absoluta devolvida por `uploadImage`
(`/teams/.../uploads/...`) era reescrita pelo próprio TinyMCE para um
caminho RELATIVO à página atual (`relative_urls: true` é o padrão do
TinyMCE) — por exemplo `../SiteAssets/.../uploads/...`, resolvendo
certo só enquanto vista a partir de `Administrator.aspx`. O artigo
publicado é renderizado em `MiniJoomla.aspx` (página diferente), onde
esse `../` relativo apontaria para um caminho totalmente errado.
Corrigido com `relative_urls: false` em `attachRichTextEditor` — o
TinyMCE agora preserva sempre o caminho absoluto a partir da raiz do
site, tanto para imagens novas quanto para resolver (ao reabrir) um
`src` relativo já salvo por engano antes desta correção.

**Terceiro bug real encontrado durante a validação**: a primeira
tentativa de configurar `mediaFileClientFactory` apontou
`libraryPath` já para `.../uploads` (a subpasta em si), enquanto
`media-upload-service.js` também informa `folderPath: 'uploads'` em
cada chamada — `createSharePointFileClient` monta
`libraryPath/folderPath`, duplicando o segmento e resultando num 404
real contra `.../uploads/uploads`, confirmado ao testar o upload
real pela primeira vez. Corrigido apontando `libraryPath` para a
biblioteca-base (`SiteAssets/minijoomla`), deixando `folderPath`
resolver a subpasta real.

**Validação ao vivo, de ponta a ponta**: (1) upload real confirmado —
`images_upload_handler` chamado com um PNG real gerou um arquivo de
verdade em `SiteAssets/minijoomla/uploads/`, HTTP 200,
`content-type: image/png`; (2) o artigo 8 já publicado com o `data:`
URI quebrado foi reaberto no editor (o próprio TinyMCE fez o
auto-upload da imagem `data:` já existente ao carregar, convertendo
para a URL real do arquivo) e salvo pelo fluxo real do painel
("Salvar"); (3) confirmado na lista `MiniJoomlaArticles` que
`Introtext` passou a conter a URL absoluta real, sem `data:` URI;
(4) confirmado no site público (`MiniJoomla.aspx#/article/about-your-home-page`)
que a imagem carrega de fato (`img.complete === true`,
`img.naturalWidth === 1649`) e renderiza visualmente — screenshot
real confirma a captura de tela originalmente inserida pelo usuário
agora visível no artigo publicado. `node tests/run-tests.js` segue
passando (3 testes novos em `tests/media-upload-service.test.js`,
nenhuma regressão).

# MINIJOOMLA — CONTRATOS

## Como ler: evidência local × produção (sem DEV/HML)

- **Este workspace opera somente em produção.**
- **Local** = testes Node, composições com transporte fake, validação estrutural/contratual. Local **não prova** permissões/dados reais, headers completos, cache/CDN, nem acessibilidade integral.
- **Produção** = tenant corporativo real. Quando citado “validado em produção” aqui, significa **evidência histórica delimitada**, incluindo casos em que foram usadas **listas de teste dedicadas dentro do próprio tenant** (não listas finais de produção), sem implicar autorização para repetir operações.

---

<a id="minijoomla--contrato-v1-congelado-dos-adapters-de-conteúdo"></a>
## Contrato v1 (congelado) dos adapters de conteúdo

**Status:** congelado (Marco A do plano de integração com SPMIDDLE).

**Verificação executável (local):** `tests/adapter-contract.test.js` (`runContentAdapterContract`).

### Objetivo

- Congelar **ports e formas** consumidos por `ContentService` e UI.
- Permitir múltiplos adapters (ex.: fake e SPMIDDLE) sem mudança em componentes.
- Evolução é **aditiva**, com versão explícita + atualização da suíte de contrato.

<a id="extensão-de-consultas--06112026"></a>
### Extensão de consultas

Regras de resolução (sem mudar schema):

- **Precedência:** rota explícita válida → valor salvo → padrão.
- `listLimit` vale para listas de **categoria** e **arquivo**; `blog/home/tags` preservam o limite de `blogSettings/pageSize`.
- `orderBy` salvo aplica-se também aos blogs quando a rota não fornece ordenação.
- Defaults resolvidos do formulário **não contam como gravados**; a persistência (`componentParamsJson`) conserva a proveniência (inclusive ausência).

- `resultsLimit` e limites equivalentes seguem o mesmo princípio (rota válida → salvo → padrão); não materializar defaults de formulário como gravação.
- `metaDescription`/`metaKeywords` do artigo são **dados públicos preservados** (inclusive para related-items), mas **não constituem SEO no host** (SEO integrado ao host segue fora do escopo).

<a id="plugins-administrativos--contrato-minimo"></a>
<a id="consolidação-nativa--plugins-e-sample-data"></a>
### Plugins e evolução administrativa

O contrato de captura, registro e persistência está em
[Plugins: captura, registro e persistência](#plugins-captura-registro-e-persistência).
O runtime administrativo é opt-in e **não é sandbox**: código aprovado executa
no import. Somente grupo `content`, eventos administrativos de save e
`adminLifecycle: true` no código exportado entram nesse runtime.
Ausência deliberada do repositório de extensões mantém composição parcial sem
plugins; catálogo configurado ilegível/corrupto bloqueia save, não vira vazio.
A integração preserva `beforeSave/afterSave` legados e manager injetado.
Sample Data tem fluxo separado em [Instalação](INSTALACAO.md); XML tem
planejador puro e executor separados, com ETags/diário/gates, mas UI pendente.

<a id="regras-v1-resumo"></a>
### Regras v1 (resumo operacional)

1. **`ref` é sempre `string`**.
2. Leitura singular do **port de conteúdo** retorna **`null`** para item não encontrado. Repositórios raw e falhas de transporte não compartilham essa regra.
3. Páginas paginadas têm forma fixa: `{ items, total, page, pageSize, pages }`.
4. Listas não paginadas retornam array (`[]` quando vazio).
5. Vocabulário de erro: `NotFoundError`, `ValidationError`, `DataError`.
   - “Não encontrado” continua sendo `null`.
   - Falha de transporte deve chegar como `DataError` com `.cause` (mensagem segura).
6. Datas aceitam string ISO ou `Date`.
7. `pageSize` é limitado a **1–50**.

<a id="etags-concorrência-e-readback"></a>
### ETags, concorrência e readback

- Escritas exigem **ETag específico** (IF-MATCH); conflito 412 não altera dados.
- `MERGE` pode responder 204 sem body: **readback obrigatório** antes da próxima escrita.
- `.etag` é **não enumerável** (não contar com spread/JSON para capturá-lo).
- ETag de coleção/header **não** é ETag de cada item; não inferir.

<a id="schemas-entidades-e-limites"></a>
### Schemas, entidades e limites

`schemaVersion` é metadado da declaração, **não** coluna gravada. A referência
única de verificação e provisionamento está em
[Persistência SharePoint e schemas](#persistência-sharepoint-e-schemas):
idempotência de criação não implica compatibilidade integral nem rollback.

<a id="procedimento-de-reversão-seguro"></a>
### Reversão segura

Ver [Recuperação sem destruir concorrência](#recuperação-sem-destruir-concorrência)
para snapshots privados, coordenação de escritores, ETag fresco e reversão
seletiva. Não há garantia de transação atômica nem restauração por recriação.

---

<a id="minijoomla--integração-com-spmiddle-local-e-caminho-para-remoto"></a>
## Integração com SPMIDDLE (local e caminho para produção)

### Fronteira

- UI permanece agnóstica a SPMIDDLE/REST/auth/ETag.

- Na leitura pelos adapters, falhas de transporte tornam-se `DataError` com mensagem segura e `.cause` para diagnóstico. Isso não redefine o contrato das escritas dos repositórios raw: preservar status/código original, especialmente `412`/`concurrency-conflict`. Um 404 de lista no transporte não equivale ao `null` de item inexistente no adapter.

### Marcos A→D (resumo)

- **A:** congelar contrato v1 + suíte de conformidade.
- **B:** adapter SPMIDDLE isolado + composição local com pacotes SPMIDDLE (sem rede).
- **C:** leitura remota autorizada (sem escrita editorial).
- **D:** operações mutáveis com ETag/concorrência, somente com gates explícitos.

### Produção: listas dedicadas dentro do tenant (não listas finais)

Evidência histórica de integração remota foi feita contra **SharePoint real** no tenant corporativo, porém usando **listas de teste dedicadas** (estruturalmente idênticas ao schema alvo) — isso valida a cadeia schema→transporte→repo→adapter, mas **não prova** listas finais de produção nem autoriza novas conexões.

### Limitações do tenant

- Não relaxar CSP/TLS/proxy para “fazer preview funcionar”. Para publicação e rollback, seguir a recuperação seletiva abaixo.
- **Listas por título:** `getByTitle('Site Pages')` pode retornar 404 apesar de existir; resolver por **GUID**/BaseTemplate (ex.: 119) evita armadilha.
- **Campo `Author`:** pode colidir com campo de sistema (`User`); usar internal name explícito/estratégia documentada (ex.: `Author0` textual) e não “adaptar silenciosamente”.
- Cache por URL exata (CDN/service worker) pode prender revisão antiga; versionamento/paths devem ser tratados como contrato operacional.

---

<a id="compatibilidade-com-spmiddle-020"></a>
## Compatibilidade com SPMIDDLE 0.2.0

- Conclusão histórica: **nenhum ajuste obrigatório** identificado para o painel MINIJOOMLA 0.8.0 publicado.
- Bump de versão raiz SPMIDDLE **não** substitui automaticamente módulos vendorizados no MINIJOOMLA.
- Ajuste futuro só se houver adoção explícita do layout `Contained/FullBleed`, com montagem/cleanup compatíveis e revalidação de CSP/MIME/zoom.

---

<a id="evolução-xml--contratos-e-gates-aprovados"></a>
## Evolução XML — contratos e gates

> Perfis de módulos/plugins/templates e executor estão implementados localmente;
> isso não fecha UI da migração nem aceite de cada operação no host. Templates
> continuam register-only, sem upgrade/rollback.

### Adoção de módulos externos (gates mínimos)

- Aceite individual por módulo.
- Scan sem executar JS; registro desabilitado por padrão.
- Pacote imutável, inventário fechado, upgrade/rollback com ETags/snapshots.

### Perfis implementados (plugins/templates)

- Identidade explícita e coerente com client/raiz.
- Allowlist de eventos; XML não executa JS.
- Descobrir/registrar não seleciona default nem sobrescreve estilos/configuração salva.

### Migração assistida JSON → XML

- Prévia pura (sem rede/imports/escrita) → revisão humana → executor com IF-MATCH + diário durável + retomada idempotente.
- Sem janela multi-sessão/guardas reais, não prometer migração atômica.

---

<a id="highlights--contrato-real-e-próximo-aceite-individual"></a>
## Highlights — contrato e aceite individual

A adoção e os limites por módulo estão em [Extensões](EXTENSOES.md).

### Contrato efetivo da origem

- Parâmetros: `title`, `layout` (`horizontal|vertical|auto`), `items`.
- Item: `{ title, description?, url? }` (minúsculo, exato).
- Sem imagens, fetch, carrossel nem binding: recebe lista pronta em settings.

### Gates que precisam permanecer explícitos

- **URL:** `safeUrl` exige hardening; não assumir que HTML escapado é política de destino.
- **Auto layout:** `auto` depende de `width` no contexto; instância gerenciada não fornece `width` hoje.
- **CSS:** divergência de classes na origem exige correções versionadas/pacotes imutáveis com evidência no host.
- **Estados:** `loading/empty/error` existem em chamada direta, mas não são persistidos por `state` em settings na instância gerenciada.

### Cuidados de adoção

- Fechar cada correção do módulo antes do próximo.
- Preservar ETags/snapshots; não reordenar/mexer em instâncias existentes fora do escopo do módulo.

## Conteúdo, datas e consultas

- `core/date-window.js` classifica a janela como `active`, `scheduled`, `expired` ou `invalid`. Limites `undefined`, `null` e `''` são abertos; início inclusivo e término exclusivo. Datas/clock inválidos, intervalos invertidos ou de duração zero não ativam conteúdo. Aceitar `Date` não implica parser ISO estrito; `now: null` representa epoch. Resolver um único instante por chamada: `options.now` → clock injetado → atual.
- Destaque inativo não despublica artigo. Fake exige `published === true` e `featured === true`; decoder SharePoint considera publicado somente `undefined`, `true`, `1`, `'1'`, `'Published'`, `'published'`, `'Publicado'`, `'publicado'`; destaque somente `true`, `1`, `'1'`. `null`, vazio, `'true'`, caixa/espaçamento distintos não ativam. O objeto público SharePoint não expõe `state` nem as datas de destaque.
- Indicadores administrativos devem ter texto/`visually-hidden`/`title`, não só cor, e não são controles interativos. Usar um clock por render; navegação reavalia, não existe promessa de timer periódico.
- Port `listArticles` usa busca `exact` por padrão; `ContentService` usa `all`. `all` exige todos os termos, `any` algum e `exact` frase contígua. Normalização NFC e whitespace, sem interpretar termos como regex. Aliases de rota `orderBy`, `dir`, `searchPhrases` preservam links; não viram campos arbitrários do port. Precedência rota válida → salvo → padrão, sem persistir defaults apenas apresentados no formulário.
- Menu usa `id`/`parentId`. Adapter SharePoint remove itens não publicados e seus descendentes; mantém órfãos e limita ciclos para não travar a travessia.

## Plugins: captura, registro e persistência

- `captureSaveOperation` captura handlers e parâmetros de `beforeSave` e `afterSave` antes da operação; lifecycle é serializado. Guarda síncrona é verificada antes de persistir; valor inválido ou Promise de guarda customizada é recusado. Observer recebe cópias e seu retorno não altera o snapshot; falha de observer/readback não mascara o resultado primário do save.
- `pluginManager` explicitamente injetado tem precedência, inclusive `null`. Abandonar a tela impede novos efeitos, não desfaz uma escrita iniciada. `MERGE 204/null` é resultado válido; readback não é snapshot atômico nem transação multi-sessão.
- Parâmetros consideram propriedades próprias; `undefined` aplica defaults, chaves desconhecidas (inclusive `__proto__`) são dados. Validar tanto `manifest.group` quanto `folder`; ausência/`null`/vazio pode usar fallback `content`, mas tipo inválido e whitespace não equivalem a ausência. Grupo normalizado segue `/^[a-z][a-z0-9_-]{0,39}$/`; consumidores pinados recusam nomes herdados como `constructor` e `toString`.
- Scan lê `manifestJson` UTF-8 original sem reserializar nem importar entrypoint; identidade vem do nome do arquivo. Entry inválida não é acionável. Nova gravação preserva campos desconhecidos, não promete preservar whitespace/bytes JSON. Registro nasce desabilitado, não cria instâncias nem executa backfill. Grupo de tipo de módulo e pasta de plugin são domínios distintos.
- Contador de módulos corresponde às instâncias salvas, incluindo não publicadas/lixeira; não é número de tipos/posições. Extensões registradas têm contador separado.

## Imagens e HTML de autoria

- Persistir HTML do autor exatamente; sanitização é da saída pública, não um rewrite silencioso do conteúdo salvo. Sanitização de estilo é restrita a imagem: `float` left/right/none, largura 0–4000px e margens 0–200px, no máximo duas casas decimais. Recusar porcentagens, `calc`, `var`, `!important`, eventos, URLs `data:`/`blob:`. Export `sanitizeImageMargins` mantém compatibilidade.
- Concluir `uploadImages` antes de salvar. Upload gera URL normal no destino autorizado; não liberar data URI para contornar falha do uploader. Não fazer backfill automático de artigos antigos.

## Persistência SharePoint e schemas

Infraestrutura fica em schemas/data-sources/repositórios/composição `createMiniJoomlaSharePointApp`; `createApplication` padrão usa fake. UI não deve conhecer REST, autenticação ou ETag.

| Domínio | Schema | Campos/restrições adicionais relevantes |
| --- | --- | --- |
| articles | 1 | Campos editoriais opcionais e janelas de publicação/destaque |
| categories, tags, menu | 1 | Identidades e relações dos respectivos contratos |
| extensions | 2 | `Ordering`, `Folder`, `ParamsJson`, `ManifestJson` |
| moduleInstances | 2 | `ShowTitle`, `PublishUp`, `PublishDown`, `Trashed`, `Assignment`, `AssignmentJson`, `Note` |
| siteConfig | 2 | `Offline`, `OfflineMessage`, SEO legado, `HomeView`, `HomeCategory`, `TemplateStylesJson`, `ComponentParamsJson` |
| templates | 1 | Styles, posições e entrypoint; envelope de metadados em [Templates](TEMPLATES.md) |

- Repositórios raw expõem `create`, `findById`, `findMany`, `update`, `delete`. Mapper recusa campos desconhecidos/`id`/required inválidos, mas não substitui validator de tipos, enums e relações. Patch parcial: omissão preserva, `null` limpa quando permitido.
- `siteConfig.get/save` lê/upserta a **primeira linha**, sem presumir id 1 nem impor unicidade. Não existe delete administrativo.
- Em schemas v2 sobre listas antigas, defaults omitidos podem funcionar sem coluna; novo valor não default exige coluna e falha 400 sem aplicar parcialmente o patch. SEO legado continua legível/raw; save administrativo preserva, mas recusa alteração desses campos. Isso não implementa SEO no host.
- `inspect`/`verify` são leitura. `apply` exige autorização efetiva já conferida, reinspeciona e cria somente ausentes; Choice usa `SP.FieldChoice`. Falha parcial guarda resultados para retomada; não há remoção/downgrade/rollback de schema.
- `verify().compatible` compara nomes e índices, não tipos reais, Required, Choice/defaults. `supported: false` em índices é limitação explícita. `apply` completo com itens skipped e verify false não prova compatibilidade integral.

## Recuperação sem destruir concorrência

- Antes de escrita, capturar privadamente ids, relações, valores e ETags; inventário de tipos/Choice/índices/ACL e ponteiro publicado do host. Coordenar escritores e delimitar efeito autorizado.
- Preferir restaurar consumer/ponteiro e manter colunas aditivas, ou retomar `apply` autorizado. Reverter somente campos efetivamente alterados, com ETag fresco; conflito de terceiros interrompe a reversão e requer conciliação. Exclusão/recriação de linha não restaura id, versões, auditoria e relações originais.
- Publicação/Publish não é promessa de operação atômica; preservar canvas e ETag frescos, artefatos imutáveis e rollback seletivo.

## Compatibilidade e lições aprendidas

- Um rebaseline histórico SPMIDDLE 0.2.9 regrediu o suporte JSON exigido pelo catálogo real; houve rollback para 0.2.7. A composição fake não detectou isso. A correção 0.2.10 restaurou JSON/`valueType`/`maxLength`/bounds/defaults profundos, recusando accessors/`toJSON`, e compatibilidade de URLs relativas/hash, textarea JSON e `step: any`. Ao adotar outra versão, validar o catálogo real e o conjunto vendorizado; não confiar apenas no bump de versão ou testes fake.
- Atribuição legada `All` pode virar `all`; rota sem alias de categoria pode virar `only` por rota. Rota + categoria em AND não equivale a tokens OR e não deve ser convertida automaticamente. Aplicar/restaurar conversão só no formulário até save com ETag, preservando campos desconhecidos/JSON bruto quando não transformados.

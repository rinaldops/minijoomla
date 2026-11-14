# Extensoes Joomla no MiniJoomla

> Guia temático de administração, módulos/plugins, XML, migração e adoção.
> Direitos/avisos: [Proveniência](PROVENIENCIA.md) e
> [avisos legais](THIRD-PARTY-NOTICES.md). Metadados/posições/parâmetros
> ficam em [Templates](TEMPLATES.md).

## Visao geral e status atual

**Implementado (aceites delimitados):** perfil `joomla-xml-v1` para modulos, plugins e templates
(parser XML compartilhado `joomla-manifest.js`); executor de migracao assistida
(`extension-migration-executor.js`, 7 gates); administracao integrada ao runtime
publico (atribuicao/escopo/plugins/estilos/offline); piloto `camap.mod_camap_corpmessage`
e tres modulos CAMAP externos (`editorial`, `highlights`, `topsections`) adotados
individualmente em producao real (releases 0.13.0–0.15.0).

**Nao implementado / pendente:** UI de painel conectada ao executor de migracao;
sete dos dez modulos CAMAP externos continuam apenas preparados/ensaiados, nao
adotados (`hero`, `home`, `recursos`, `showcase`, `documentation` ensaiados;
`videoteca`, `forum` nem isso); SEO global do host (`metaDescription`/`metaKeywords`/
`robots`/`sitenamePagetitles`) recusa mudancas; componentes externos, idiomas e
instalacao via ZIP continuam fora do perfil. `rightsApproved`/`publicationApproved`/
`sourceLicensePresent` permanecem `false` em todos os planos de adocao — nenhuma
aprovacao legal foi concedida pela documentacao tecnica.

Isto e compatibilidade de estrutura/fluxo com o Joomla classico, nao compatibilidade
binaria com extensoes PHP. Novos tipos de extensao exigem contratos proprios.

## Contrato XML modulos (joomla-xml-v1)

Perfil `joomla-xml-v1` descobre modulos JavaScript de site por
`modules/mod_nome/mod_nome.xml`. O XML e a fonte dos parametros do painel; nao e
necessario manter manifesto JSON de descoberta paralelo. Modulo, habilitacao e
instancia sao etapas distintas (como no Joomla classico).

```xml
<?xml version="1.0" encoding="utf-8"?>
<extension type="module" client="site" method="upgrade">
  <name>Mensagem</name>
  <version>1.0.0</version>
  <files>
    <filename module="mod_mensagem">mod_mensagem.js</filename>
  </files>
  <media destination="mod_mensagem" folder="media">
    <filename>css/mensagem.css</filename>
  </media>
  <config><fields name="params"><fieldset name="basic">
    <field name="message" type="textarea" label="Mensagem" default="" />
  </fieldset></fields></config>
</extension>
```

O entrypoint exporta o contrato JS existente (`default` com `render`). Arquivos de
`files` ficam na pasta instalada do modulo; os de `media` em `media/<destination>/`.
Imports/dependencias precisam estar no pacote aprovado; descobrir nao copia nem
importa JS.

| Recurso | Suporte |
| --- | --- |
| XML UTF-8, comentarios, CDATA, escapes | Parser real compartilhado Node/browser |
| Configuracao (text/textarea/number/list/radio) | Normalizados; radio 0/1 -> booleano |
| JSON estruturado | `mj:type="json"` + `mj:valueType="array\|object"` |
| Chave legada | `mj:key` preserva; sem alias usa `mod_nome` |
| Descoberta JSON anterior | Preservada; conflito XML/JSON mostrado, sem escolha silenciosa |
| Atualizacao/reversao | Revisoes XML aprovadas, ETag capturado, instancias validadas |
| Remocao | Bloqueada com instancias existentes; nao apaga arquivos do pacote |
| PHP, SQL, scriptfile, DTD | Recusados — sem interpretador/instalador |
| Campos customizados, required/multiple, filtros, showon | Recusados (comportamento nao implementado) |

## Perfis adicionais plugins e templates

Mesmo parser compartilhado (`joomla-manifest.js`), sem segundo motor de scan.

**Plugins:** convencao `plugins/<group>/<nome>/<nome>.xml`; `group` validado contra
os seis grupos suportados (`content`, `system`, `search`, `editors`, `user`,
`extension`); identidade `plugin:<group>::<nome>`. `joomla-discovery.js` varre
`plugins/<group>/` como pastas opcionais (ausencia nao falha o scan inteiro).
Parametros ficam em `paramsJson` da propria linha de extensao — nao ha instancias
separadas (diferente de modulo). Instalacao/atualizacao/reversao seguem o mesmo
contrato por ETag/revisao do perfil de modulos, incluindo aliases nativos
reservados (`emailcloak`/`pagebreak`/`loadmodule`/`pagenavigation`).

**Templates:** convencao `templates/<nome>/templateDetails.xml` (site) ou
`administrator/templates/<nome>/templateDetails.xml` (admin). `<positions>` e
obrigatorio e reaproveita a mesma validacao do mecanismo de template instalado via
JSON (ver [TEMPLATES.md](TEMPLATES.md) para o contrato completo de manifesto/
Gap A/B/runtime). Nomes de pasta aceitam hifen (`camap-v3`), diferente de
modulo/plugin. Builtins (`default`/`cassiopeia`) sao aliases nativos reservados e
nunca sao candidatos de descoberta (`camap` foi removido do nucleo em 11/11/2026).
O instalador de template e **register-only** (sem upgrade/rollback — gate futuro,
nao lacuna silenciosa), usando o mesmo `admin.templates.create()` do fluxo de
descoberta JSON existente.

## Migracao assistida (executor)

`extension-migration-executor.js` aplica, sobre uma previa pura
(`extension-migration-plan.js`, inalterada), **sete gates formais**:

1. Confirmacao explicita obrigatoria (`confirm: true`).
2. Revalidacao contra leituras frescas (ETag exato) de extensao e todas as
   instancias antes de escrever — nunca confia no snapshot antigo da previa.
3. Diario durável (`journalStore`) com snapshot de reversao antes de qualquer
   escrita e marcador `pending` antes de cada escrita individual, so limpo apos
   confirmacao/releitura do ETag novo.
4. Sequencia estrita: extensao primeiro, depois cada instancia em ordem.
5. Retomada sem repetir uma escrita ja confirmada (falha parcial marca `status:
   'partial'` e retoma do proximo item).
6. Rollback manual que so le o snapshot de reversao do proprio diario (nunca
   deriva de nova previa) e e rejeitado (`blocked`/`instance-changed`/
   `extension-changed`) se qualquer linha mudou desde a migracao — nunca
   sobrescreve edicao concorrente.
7. Abandono de tela (`isCurrent`) interrompe antes de qualquer nova escrita.

Escrita da extensao usa `repositories.extensions.update` direto (nao
`admin.extensions.update`, que recusa mudar `entryPointUrl` por design — mesma
excecao que o installer usa para upgrade/rollback); instancias usam
`admin.moduleInstances.update` normal.

**Limites documentados (nao lacunas silenciosas):** cobre somente modulos (mesmo
escopo da previa); nenhuma UI de painel consome o executor ainda; sem janela de
manutencao/guarda multi-sessao real.


## Administracao extensoes/modulos/templates

O runtime publico consome estado/atribuicao/agenda de modulos, ordem/parametros/
lifecycle de plugins e estilos/opcoes persistidos. Perfis XML (modulos/plugins/
templates) e executor de migracao assistida existem; **a tela do executor
permanece pendente**. Nao extrapolar contratos locais para aceite remoto.

### Capacidades integradas ao runtime publico

- **Atribuicao/escopo:** `assignment`/`assignmentJson` (`all`/`none`/`only`/
  `except`) tem prioridade sobre o escopo legado quando declarado;
  `trashed`/`publishUp`/`publishDown` excluem a instancia; `showTitle`/
  `moduleClass`/`headerTag`/`headerClass` chegam a apresentacao com allowlist de
  tag segura (`resolveModuleEntries`, `dynamic-modules.js`, `registry.js`,
  `content-runtime.js`).
- **Plugins:** `ensurePluginsRegistered` importa concorrentemente mas **registra
  sequencialmente**, ordenado por `extension.ordering` (desempate por `key`), e
  propaga `paramsJson` como `context.params` a todo handler (`plugins/manager.js`).
- **Estilos/opcoes por componente:** `toSiteConfigOverrides` vive em
  `application/site-config-overrides.js`, usado tanto pelo painel quanto pela
  composicao publica — elimina a divergencia anterior em que so o painel
  calculava `templateParams`/`templateStyleId`/`componentParams`. Cassiopeia
  reutiliza `TEMPLATE_PARAM_DEFINITIONS` real (fonte unica, sem params proprios
  em `template-styles.js`). Opcoes de `content`/`search` (inclusive
  `highlightTerms` com destaque seguro em texto plano) aplicadas a
  `renderArticle`/`renderArticleList`/`renderSearch`.
- **Limites de consulta (listLimit/orderBy/resultsLimit/searchPhrases):**
  `listLimit`/`orderBy` sao declarados em `component-options.js` e consumidos por
  `content-service.js`. Regra de precedencia: **rota valida prevalece sobre valor
  salvo**; limite ausente mantem o `pageSize` historico. Blog conserva capacidade
  leading/intro/links — nao vira lista generica so por compartilhar limites.
  `searchPhrases` e demais aliases de busca sao efetivos nas consultas, mas sao
  parametros de **busca por palavras-chave/paginacao** (`com_finder`), distintos e
  sem relacao com SEO/meta tags do host — nao inferir politica de SEO a partir de
  `searchPhrases`.
- **Offline (gate real):** `siteConfig.offline === true` substitui o conteudo
  principal por `offlineMessage` em qualquer rota, preservando menus/modulos/
  template ao redor (mesmo padrao de `LOAD_ERROR`). **SEO global recusado:** o
  serviço preserva valores existentes de `metaDescription`/`metaKeywords`/
  `robots`/`sitenamePagetitles` e rejeita mudancas — nao e integracao com
  head/SEO do host. Defaults de instalacao (`siteName`, idioma, timezone) sao
  outro contrato, nao SEO.

### Parsing estrito (correcao P0) e tolerancia publica

Leituras/escritas administrativas de `componentParamsJson` e `templateStylesJson`
validam os dados persistidos **antes** de mesclar opcoes/materializar estilos
virtuais: JSON malformado, shape incorreto ou entradas invalidas geram
`ValidationError`, preservando registro completo e ETag. Campo ausente, `null`
JavaScript e string vazia continuam aceitos para registros legados (compat).
**Plugins — mesma rigidez:** `manifestJson` parcial e `paramsJson` passam por
parsing estrito; definicoes/valores invalidos nao viram lista vazia/defaults.
list/get/update/lote rejeitam **antes da escrita**. Salvar preserva desconhecidos
ja persistidos, filtrando desconhecidos novos; estado/ordem sem params preservam
JSON exato. Lote so altera IDs de plugins.

Fora dessa correcao: o **runtime publico ainda tem parsing tolerante** (outros
pontos de carregamento convertem falhas em padroes/listas vazias) — nao
considerar a revisao geral de erros encerrada.

### Rotas administrativas e identidade

- `/extensions`: busca por titulo, filtros tipo/estado, ativacao/desativacao
  persistidas. `/extensions?type=Plugin` e acesso direto a plugins.
- `/moduleInstances`: filtro estado/posicao, instancias com modulo nativo ou
  registrado, posicao, ordem inteira, configuracao JSON, atribuicao por
  rota/categoria. Plugins **nao aparecem** no seletor de modulo.
- `/templates`: catalogo, estado, acao **Tornar padrao** (persiste
  `siteConfig.templateKey`). Padrao atual nao pode ser desabilitado/excluido —
  selecionar outro primeiro.
- `/config`: seletor dos integrados `default`/`cassiopeia` + externos habilitados.
  Integrados nao exigem registro no catalogo.
- Descoberta em `/extensions/discover` e `/templates/discover`: le manifestos ja
  publicados; registro exige confirmacao de origem confiavel. Nao envia
  arquivos, extrai pacotes ou oferece formulario para instalar codigo arbitrario.

Chave, tipo e entrypoint sao identidade do manifesto: exibidos sem edicao.
Remover registro de modulo exige antes remover/reatribuir instancias — nao apaga
arquivos publicados. **Registro nasce desabilitado**; habilitar, criar/configurar
instancia e publicar sao acoes distintas.

### Contrato Folder/group (Plugin) — precedencia e limpeza

Grupo de Plugin e preservado em `ManifestJson`: **`Folder` e navegacao reservada
do SharePoint** e nunca deve ser enviada como propriedade textual no payload.
Contrato distingue tres estados: **Folder legado textual tem precedencia**
(preservado, nao migrado automaticamente); mudanca **incompativel e recusada**
(nao migra silenciosamente); campo **vazio significa ausencia de override**;
**limpeza deliberada usa `manifest.group`** explicitamente. Modules conservam
`group` opaco (nao interpretados como Plugins). Estado/ordem/parametros nao
reserializam manifests existentes; novas inscricoes mantem canonicalizacao JSON;
habilitar plugin registrado altera a mesma linha com ETag, sem criar duplicata.

### Templates — setDefault, singleton e identidade de linha

`admin.siteConfig.get()` devolve a **linha crua** com `id` e `etag`; localiza a
linha por `findMany` e **rele por seu ID real** — nunca presume ID 1 (nao e
singleton por convencao de ID). `siteConfig.toConfigOverrides(record)` converte
`customHtmlTitle/Body` para `customHtml`; chave de template fica em
`templateKey`.

`admin.templates.setDefault(id, { etag, configEtag })` exige **os dois ETags**: o
do template capturado na tela e, havendo configuracao, o `configEtag` dela.
Atualiza somente `templateKey`, preservando os demais campos. **Sem configuracao,
cria a linha singleton** pela convencao ja existente (nao presume que ela ja
existe).

Posicoes de modulo: `topbar`, `below-top`, `menu`, `search`, `banner`,
`breadcrumbs`, `top-a`, `top-b`, `main-top`, `sidebar-left`, `sidebar-right`,
`main-bottom`, `bottom-a`, `bottom-b`, `footer`, mais aliases legados `content`
e `sidebar`. `component` pertence ao template, nao e posicao de instancia.

Templates persistem `positionsJson` (array JSON) e `styles` no envelope
`minijoomla-template-metadata-v1` (ver [TEMPLATES.md](TEMPLATES.md) para
contrato completo do manifesto/Gap A/B). A validação administrativa de CSS aceita caminho relativo ou qualquer
origem HTTPS, nunca `javascript:`/`data:`/credenciais/backslashes. **Entrypoints
sao mais restritos:** so caminho relativo do proprio site, nunca outra origem —
regra unificada entre `admin-service.js` e `extension-discovery-service.js`
(`sameSiteModuleUrl`) para evitar `import()` de codigo externo arbitrario no
navegador do visitante/administrador. O runtime de Templates aplica gate
próprio same-origin; aprovação administrativa de URL não garante sua carga.

### Concorrencia e limites (ETag/findById)

**ETags de `findMany` nao devem ser presumidos confiaveis** em todas as respostas
SPMIDDLE. As listagens relêem registros visiveis por **`findById`** e as acoes
devem usar esses snapshots — nunca um token recem-obtido para sobrescrever
alteracoes alheias. ETag curinga `*` e rejeitado. Nao existe transacao entre
listas de templates e configuracao: verificacoes de referencia/padrao reduzem
inconsistencias, mas nao prometem atomicidade nem unicidade sob criacoes
simultaneas (garantia depende do backend). Mudanca e percebida quando a
composicao publica rele a configuracao ou reinicia — painel nao promete
aplicacao em tempo real em outras abas.

### Raw singleton / falhas de SiteConfig

Falhas de SiteConfig nao inventam template default nas posicoes de modulo;
falhas do catalogo de estilos nao sao ignoradas na visualizacao de posicoes.
Paginas novas mostram alerta generico sem backend/fallback. Apos acao seguida de
falha na recarga, a mensagem orienta verificar o registro antes de repetir — sem
negar escrita ja concluida. Configuracao ausente continua valida; recuperacao
apos restabelecer leitura e coberta na mesma app.

### Artigos em destaque nativo (articles-featured)

16º modulo nativo, distinto de `articles-news`. `renderArticleCard`: imagem de
introducao, alt, legenda, titulo, resumo sanitizado, data e link. Limite
**1 a 50**: filtrar elegibilidade **antes** de `slice`; preparar plugins somente
nos cards selecionados e impedir recursao de `loadmodule`/`loadposition`.
Colisao tardia com chave **Module** existente falha fechada e exige reload
(preserva origem/parametros alheios); colisao de chave **Plugin** nao e o mesmo
contrato. Midia aceita somente strings de URL seguras — rejeita
booleanos/numeros, `mailto`/fragmento isolado/`data`/`blob`/`javascript`/`file`.
Selecionar o modulo no manifest nao registra instancias nem cria conteudo.

### Dependencias corporativas

Falha `runtime_unavailable`/ausencia de SDK nao e revisao executada. Falha de
restore JFrog por caminho de CA bundle inexistente exige verificar o bundle
configurado com suporte autorizado — nunca desativar TLS/proxy/certificados/DLP.


## Raizes de extensoes e capacidade do host

A rota `#/installer/roots` sucede a instalacao. Catalogo em
`<libraryPath>/extensions-host.json` (v1), **separado** de `installation.json`,
respectivos ETags e diario. Registrar exige raiz/revisao imutaveis, hash e
confirmacao explicita; preflight verifica XML/payload/inventario/CSS somente por
leitura. **Limite do host: no maximo 10 raizes totais, incluindo `discover:false`**
— preservar todas as raizes/mapas anteriores, inclusive ocultas; registro nao
autoriza remover raizes, mudar pins, instalar todas as extensoes ou habilita-las
automaticamente. Criar de forma exclusiva ou atualizar com ETag recem-lido,
depois reler; cancelamento e escrita incerta **nao autorizam replay**. Host
generico nao usa fallback JSON legado (hosts legados configurados conservam
compatibilidade explicita). Binding CSS e exato e ordenado por entrypoint/revisao,
inclusive em upgrade/rollback; troca exige reload explicito, nunca hot-swap.

**Invariantes de descoberta/revisao/recuperacao:**

- `mergeExtensionsConfigs` mantem descoberta ativa so para raizes presentes/
  marcadas na **ultima configuracao recebida**, nao para a uniao dos envelopes —
  o envelope final deve declarar todas as origens desejadas e preservar IDs,
  bases, hashes e mapas CSS anteriores.
- Identidade/chave repetida em duas raizes descobertas gera **conflito**, sem
  prioridade automatica de latest; scan incompleto nao aprova instalacao.
- Relocar bytes iguais **nao transfere aprovacao**: `verifyRevision` exige
  `rootId`/`inventoryHash` persistidos, manifesto integro e a revisao anterior
  com vinculos JS/CSS.
- Runtime retém **uma revisao anterior por registro**, nao historico infinito;
  **rollback nao libera slot** (outro membro pode usar a raiz mais nova).
- Trocar base mantendo XML/fingerprint identico nao garante acao Atualizar na
  UI; aprovacao de raiz nao atualiza registro nem instala membros.
- Scanner de descoberta: **500 pastas, 200 candidatos, 60s de deadline,
  profundidade 4**.

**Limitacoes conhecidas:** aliases compartilhados de fixture e inversao dupla de
lista produziram falsos negativos de CSS (isolar fixtures, verificar ordem
efetiva). No SharePoint, instalar requer que `Key` da lista de extensoes seja
realmente **Text, Indexed e EnforceUniqueValues** — a declaracao no schema nao e
prova; o guard consulta a lista real e bloqueia sem essa garantia (nao altera
constraints nem corrige duplicatas automaticamente). `moduleStyles`/
`moduleStyleRevisions` sao mapas aprovados do host, nao parametros de instancia;
o segundo seleciona CSS pelo entrypoint instalado, permitindo reverter sem
aplicar o estilo mais novo.

## Agrupamento XML finito

`scripts/prepare-xml-module-group.js` combina **2 a 7 pacotes individuais
explicitamente selecionados** em uma raiz nova, sem mover raizes instaladas,
configurar o host atual, instalar modulos, restaurar dados ou publicar. O
artefato e proposta imutavel por pin SHA-256 — nao e permissao de instalacao.

**Fluxo:** Desenvolvimento (validar cada pacote/contrato) → Site (preparar raiz
nova NAO INSTALADA) → Analise (`GROUP-PROVENANCE.json`, inventario, avisos,
defaults, ordem CSS, imports) → Validacao (descoberta real, uniao inteira,
revisao anterior retida; direitos/privacidade de cada entrada — um
`rightsApproved:true` antigo nao aprova o agrupamento) → Docs.

**Limites:** 500 arquivos totais / 10 MiB por entrada **e** pelo grupo final;
inventarios/controles lidos ≤ 64 KiB. Sem symlinks/junctions; extras nao
inventariados, caminhos escapados, colisoes case-insensitive falham. XML via
`parseJoomlaManifest` real; `<folder>` aberto ou manifesto/executavel fora do
grafo e recusado. Imports estaticos/dinamicos literais fechados pelo parser
real — relativo exige `./`/`../`; `.helper.js` e bare (recusado mesmo comecando
por ponto). Helper compartilhado so e deduplicado apos comparar bytes crus de
TODAS as entradas — divergencia falha, nao escolhe versao silenciosamente. CSS
via `css-tree`: falham `url()`, `@import`, erros/recovery `Raw`.

**Capacidade combinada com o host:** baseline de 8 raizes deixa 2 slots; 7
pacotes com 2 revisoes individuais exigiriam 22 raizes (nao cabem). Grupos sao
imutaveis — nao anexar membro depois. Teste confirma **8+2=10 aceito; 11
recusado**, sem mutacao dos configs. A verificacao de um membro inclui **todos**
os arquivos da uniao: adulterar um bloqueia os demais.

## Piloto corpmessage — ciclo e aceite

O ciclo exercitou descoberta sem escrita, confirmação nativa por `<dialog>`,
upgrade/rollback com JS/CSS coerentes e recusa de ETag obsoleto sem alteração.
Fechar modal de tela abandonada causava salto de foco: correção local só passou
a integrar release posterior imutável. Não reutilizar contagens/versões antigas
como aprovação atual. Editorial foi o primeiro módulo externo adotado; o
status por módulo está na matriz abaixo.

**Gates de migracao de instalacoes (invariantes ao longo do ciclo):** descoberta
sem imports/escritas; registro nasce desabilitado; habilitar/criar instancia/
publicar sao acoes distintas; atualizar preserva ID/key/settings/atribuicao de
**todas** as instancias; incompatibilidade de parametros ou ETag interrompe a
gravacao (sem migracao automatica de dados); reverter restaura
URL/metadados pelo ETag atual da tela, retendo **uma revisao anterior** (nao
historico infinito); remocao com instancia associada e **sempre recusada**.
SharePoint nao oferece transacao atomica entre extensao e suas instancias — por
isso o ciclo automatico exige o mesmo contrato normalizado de parametros
(nomes/tipos/defaults/limites/opcoes); mudanca de schema exige migracao
assistida, nunca reescrita automatica de JSON legado para XML sem revisao
anterior verificavel.

## Articles-featured nativo

`articles-featured` e modulo generico (nao conteudo/configuracao corporativa),
distinto de `articles-news` (mantem pipeline de lista de titulos legado, sem
uniformizacao). Ver secao "Artigos em destaque nativo" acima para o contrato
completo (limite 1-50, colisao Module/Plugin, midia como string segura). Testes
de teclado/largura/reflow sao provas locais, nao publicacao real.


## Matriz dos 10 modulos CAMAP (adocao delimitada)

Os 10 modulos externos (`editorial`, `highlights`, `topsections`, `hero`, `home`,
`recursos`, `showcase`, `documentation`, `videoteca`, `forum`) tem contrato JS
sincrono e XML preparavel no perfil atual — candidatos a preparacao/aceitacao
delimitada, nunca a exposicao de dados arbitrarios. `rightsApproved`,
`publicationApproved` e `sourceLicensePresent` permanecem `false` em todos os
planos: falta comprovacao legal, sem autorizacao de distribuicao derivada desta
matriz.

### Defeitos comuns de origem (nao corrigidos na fonte CAMAP2)

- **U1 — filtro de URL por prefixo nao e politica de URL.** `safeUrl` em
  `_shared/render.js` testa apenas `/^(#|\/|https:\/\/)/i`. Aceita
  `//host/path`, `/\host/path` (backslash) e HTTPS com credenciais; so recusa
  `javascript:`/`data:`/HTTP puro (fallback `#`). Os campos afetados sao
  `text`/`textarea`/membros de JSON, nao parametros `url` tipados — por isso nao
  recebem `coerceParam(type:'url')` automaticamente.
- **S1 — JSON valido nao garante item renderizavel.** A validacao de JSON
  existente impede getters/`toJSON`/ciclos/protótipos, mas nao exige
  `items[n].title` string nem impede `items:[null]`. Editorial/highlights/
  topsections leem propriedades diretamente (`null` lanca excecao, isolada pelo
  registry com alerta seguro). Documentation/forum/recursos/videoteca tem
  normalizadores que recusam `null`/arrays/escalares como item (reduz crash, nao
  valida URL/booleans/subcampos). Showcase descarta `null`/escalares mas aceita
  arrays sem `title` (acabam descartados, nao e schema de item). Home exige
  `value`/`label` string em stats.
- **V1 — thumbnail de Videoteca em CSS sem protecao.** `renderThumb`/
  `renderCarouselSlide`/`renderRecentList` inserem `thumbnail` em
  `background-image:url('...')` so com `escapeHtml` (sem `safeUrl`/escape CSS).
  Risco de carga de recurso/alteracao de contexto CSS, nao execucao JS
  comprovada.
- **F1 — cor arbitraria em CSS inline no Forum.** `normalizeTopic` nao valida
  cor; interpola em `style="--accent:..."` so com escape HTML — um valor como
  `#006298;background-image:url(...)` mantem delimitadores CSS validos.
- **C1 — CSS legado `data-mse-module`.** `home.css`/`recursos.css`/
  `videoteca.css` definem variaveis em seletores `data-mse-module` legados que
  os renderers atuais nao emitem; cores/variaveis nesses blocos nao sao
  garantidas pelo HTML do pacote isolado (divergencia estatica, nao conclusao
  visual). `moduleClass`/`headerTag`/`headerClass`/`showTitle` pertencem ao
  chrome do runtime — esses renderers nao os consomem (h1/h2 internos fixos).

### Status de adocao por modulo

| Modulo / chave | Status | Observacao |
| --- | --- | --- |
| `camap.mod_camap_editorial` | **Adotado** (0.13.0, release 0.3.0/0.3.1) | Adaptacao segura: hardening de URL + filtro de itens (ver secao Editorial) |
| `camap.mod_camap_highlights` | **Adotado** (0.14.0, `top-a`) | CSS corrigido (`.camap-dt1`→`.camap-highlights`); `auto` sem `width` fica vertical no host gerenciado |
| `camap.mod_camap_topsections` | **Adotado** (0.15.0, `bottom-a`) | CSS com trilha minima `min(14rem,100%)` + `overflow-wrap:anywhere` |
| `mod_hero` | Ensaiado, nao instalado | Adaptacao remove ID fixo, exige HTTPS/server-relative na imagem |
| `mod_home` | Ensaiado, nao instalado | Container queries corrigem overflow em root 180px |
| `mod_recursos` | Ensaiado, nao instalado | UI honesta com `disabled`/`readonly`; grid por container |
| `mod_showcase` | Ensaiado, nao instalado | `sphere` convertido para lista estatica segura (nao animada) |
| `mod_documentation` | Ensaiado, nao instalado | **Exceção de proveniencia:** derivado de Phoca Documentation/Joomla overrides (GPL-2.0-or-later) — nao deduzir MIT do agregador |
| `mod_videoteca` | Nem preparacao segura | V1 sem correcao; thumbnails vazias e gate de entrada |
| `mod_forum` | Nem preparacao segura | F1 sem correcao; cores `#rrggbb` validadas e gate de entrada |

### Capacidade de raizes vs. expansao

`joomla-host-config.js` permite no maximo **10 raizes totais**, incluindo
revisoes retidas com `discover:false`. Onze modulos individuais ja excedem esse
limite; com rollback o problema aumenta. Agrupamento em pacotes finitos (ver
secao Agrupamento XML acima) pode economizar raizes, mas exige preparador/
inventarios/gates proprios — nao instala automaticamente todos os membros nem
expande raizes.

<a id="camap-mod-editorial"></a><a id="camap-mod-highlights"></a><a id="camap-mod-topsections"></a><a id="camap-mod-hero"></a><a id="camap-mod-home"></a><a id="camap-mod-recursos"></a><a id="camap-mod-showcase"></a><a id="camap-mod-documentation"></a>
_Ancoras de compatibilidade: links antigos `#camap-mod-<nome>` apontam para a linha correspondente na tabela "Status de adocao por modulo" acima._
## Preparacao de modulos (contrato/CLI)

`scripts/prepare-module-adoption.js` prepara **um modulo por pacote** a partir
das fontes locais CAMAP2, sem adicionar codigo ao nucleo, ler `dist`, instalar
dependencias ou acessar rede/navegador/tenant. `--module` e obrigatorio;
`all` e recusado na CLI. Catalogo fechado de chaves (`camap.mod_camap_*`) nao
renomeia chaves persistidas.

**Dependencias:** exige `es-module-lexer@1.7.0` e `css-tree@3.1.0` reais — sem
fallback regex ou download automatico; ausencia produz
`ADOPTION_DEPENDENCY_MISSING` **antes de criar saidas**. Alternativa
`--dependencies-root` aponta raiz isolada local (sem sobreposicao com a saida),
resolvendo so os dois imports do gerador em memoria — nenhum fork e
escrito/incluido no pacote.

**Contrato de preparacao (fechamento JS/CSS):**

1. Confere catalogo/API do gerador original (`JOOMLA_MODULES`, `createXml`,
   `prepareJoomlaModules`).
2. Le/verifica inventario original, segue imports/reexports estaticos e
   dinamicos literais recursivamente via `es-module-lexer`; dependencia de
   outro modulo, bare/absolute import, import computado ou arquivo ausente
   **falha**, nunca e omitido silenciosamente.
3. `parseJoomlaManifest` (parser real) confere perfil, chave, versao, arquivos
   declarados e parametros — compara tipos/defaults/enumeracoes/limites/campos
   com o schema original; exige consistencia de defaults nomeados.
4. CSS revalidado individualmente com `css-tree` (recusa `url()`/`@import`).
5. **Limites:** 500 arquivos, 10 MiB, XML/inventario ≤64 KiB, UTF-8 valido,
   hashes SHA-256, sem colisoes de caixa nem links.

**Arquivos individuais gerados:** `modules/<mod>/<mod>.xml` + `.js` wrapper;
`media/<mod>/css/`; `LICENSE*`/`COPYING*` preservadas byte a byte (ausencia →
`sourceLicensePresent:false`); `docs/ADOPTION-NOTICE.md`; `adoption-plan.json`
(flags `migrated`/`publicationApproved`/`rightsApproved`/`tenantModified`/
`hostConfigured`/`currentRecordsModified` sempre `false`);
`MANIFEST-SHA256.json`; `host-config.json` (proposta para **uma** raiz
imutavel). ID proposto: `camap-<mod>-<versao>`.

**Perfis de adaptacao segura (0.3+):** alem da preparacao 0.2.x (sem patch),
existem perfis que geram revisoes novas e imutaveis aplicando patches
allowlisted (hardening de URL, filtro de itens, correcoes de CSS/reflow) em
snapshot privado, mantendo schema/XML e flags/gates operacionais separados. A
sintese canonica por modulo (origem → adaptacao → ciclo) esta na secao "Matriz
dos 10 modulos" acima.

## Editorial CAMAP (detalhe do primeiro modulo adotado)

Chave `camap.mod_camap_editorial`. **Contrato real (origem 0.2.x):** 4
parametros na mesma ordem XML — `title`(text,"Destaques"), `limit`(number,3,
sem bounds XML; `0`→3, negativo→0 itens, teto interno 100), `items`(json array,
`[]`), `catalogTarget`(text,""). Item consumido: `{title,url,summary?}` — so o
primeiro item tem resumo; demais so link; imagens/HTML rico **nao suportados**.
`items:[null]` passa a validacao estrutural e lanca excecao no renderer (isolada
pelo registry com `role="alert"`) — bloqueio de dados nao revisados, nao motivo
para editar a fonte.

**Bloqueio de URL (U1 aplicado):** `safeUrl` aceita `#`/`/`/`https://` e falha
em distinguir `//host` ou backslash de caminho local — ver secao U1 acima para
o detalhe exato. **Adocao ficou bloqueada para exposicao ate adaptacao segura.**

**Adaptacao segura 0.3.x (adotada em 0.13.0):** dois patches allowlisted em
snapshot privado — (1) helper local: HTTPS sem credenciais, fragmentos e
caminhos server-relative seguros, recusa protocolo relativo/backslash/controles/
bypasses codificados; (2) filtro de itens de runtime sem getters, exigindo
`title` string (objetos invalidos nao quebram o render). Chave, 4 parametros,
defaults, labels, XML, CSS e semantica do `limit` preservados — nenhum backend/
imagem/HTML rico/ACL/catalogo dinamico inventado. Revisoes imutaveis 0.3.0/
0.3.1 aprovadas; `0.3.1` descoberta, `0.3.0` retida `discover:false` para
rollback.

Proveniencia: aviso MIT da raiz do agregador copiado integralmente; GPL completa
acompanha as alteracoes proprias (sem atribuir GPL a CAMAP2 inteiro). Detalhe de
licenciamento remetido a [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) /
[Proveniência](PROVENIENCIA.md) — nao duplicado aqui.


## Plano de compatibilidade — arquitetura e decisoes vigentes

O plano original (05/11/2026) tracava I0-I7 para o perfil XML. **Estado atual:**
I1 (manifesto XML modulos/plugins/templates), I3 (descobrir/instalar) e I5
(ciclo de vida upgrade/rollback) estao **implementados e publicados**; I4
(piloto corpmessage) e I6 (aceite em host real) **comprovados no destino de
teste autorizado**; I7 (ampliacao apos aceite) esta **parcial** — 3 dos 10
modulos externos adotados (ver Matriz acima), plugins/templates XML
implementados, mas migracao em massa, UI do executor e demais 7 modulos
continuam pendentes.

**Decisoes de arquitetura mantidas:**

- Raizes separam armazenamento de release (JSON legado) de raizes de pacotes
  XML versionados; cada raiz tem `id`, `baseUrl` server-relative, perfil e
  tipos/clientes permitidos.
- Identidade logica (chave qualificada) prevalece sobre nome de arquivo/titulo
  para deduplicacao entre candidatos XML/JSON.
- `extensions.update` (via admin-service) recusa mudar `entryPointUrl` por
  design — operacao de atualizacao de revisao e um caso de uso **separado**
  com ETag capturado no plano/preview, `If-Match` especifico (nunca wildcard).
- Indice unico declarado no schema (`Key` Text/Indexed/EnforceUniqueValues) nao
  comprova unicidade ativa no SharePoint — o guard consulta o campo real antes
  de instalar; nao altera constraints nem corrige duplicatas automaticamente.

**Decisoes pos-revisao (correcoes aplicadas na execucao real):**

1. Loader de modulos nao pode conservar JS antigo ao aplicar CSS novo — agora
   acompanha URL por registry/chave, reconcilia upgrade/rollback, descarta
   conclusoes assincronas obsoletas.
2. ETag da extensao **nao protege** edicoes de instancias em outra lista —
   mudanca de schema/defaults exige migracao assistida (nao ha transacao
   cross-list).
3. Registros JSON legados **nao sao convertidos silenciosamente** para XML sem
   rollback verificavel — UI informa necessidade de migracao assistida.
4. Declaracao de indice unico no schema **nao e comprovacao** do estado real —
   guard consulta `Key` real e bloqueia a instalacao se ausente a garantia.

**Matriz de testes obrigatoria (grupos, sem repetir contagens):** XML (valido/
malformado/DTD/BOM/profundidade); semantica (tipo/cliente/arquivo ausente/
PHP-only); parametros (list/radio/JSON/limite/prototype keys); diretorios
(paginacao/403/cancelamento); identidade (XML+JSON do mesmo modulo, duas
raizes); instalacao (scan sem escrita, confirma/cancela); runtime (import real,
CSS dedup/cleanup); ciclo de vida (ETag, settings desconhecidos, remocao
bloqueada); pacote (symlink/case collision/LF-CRLF); regressao (JSON legado,
suites sem SPMIDDLE); host real (FIORI-AUTO, releitura independente).

**Rollback e criterios de conclusao:** rollback de implantacao retorna ao
loader/runtime e configuracao de raizes/assets anteriores; pacotes anteriores
permanecem intactos. Se houve escrita de registro, rollback analisa a diferenca
com ETags atuais — sem restauracao massiva ou exclusao automatica. O perfil
JSON permanece disponivel durante e depois de qualquer piloto.

## Migracao de dados reais — licoes e contratos (sem identidades)

Processo de popular um site de teste com conteudo real de origem (listas de
categorias/publicacoes/itens de menu de um runtime legado distinto), em
substituicao a dados ficticios, com acesso **somente leitura** a fonte durante
todo o processo (nenhuma gravacao/alteracao/publicacao na origem) e escrita
exclusiva no site de teste via o mesmo servico administrativo validado
(`createAdminService`) usado pelo admin real — nunca escrita REST artesanal de
baixo nivel.

**Licoes/contratos retidos (generalizados, sem nomes de sites/tenant):**

1. **Mapeamento de schema sem equivalencia 1:1** entre runtime legado e
   MiniJoomla precisa ser deduzido por inspecao de conteudo, nao assumido por
   nome de campo.
2. **Exclusao deliberada de registros de origem** (duplicata exata de conteudo,
   registros de teste evidentes, `EstadoEditorial = Lixeira`) deve ser decidida
   e documentada por item, nunca por heuristica automatica ampla. Titulos
   duplicados **legitimos** (sem indicio de erro) migram como registros
   distintos, com alias sufixado — deduplicacao de conteudo nao e inferencia
   segura sem decisao explicita.
3. **Itens dependentes de filtro sem destino resolvido** (ex.: item de menu que
   dependeria de uma categoria de "destaques" inexistente na origem) ficam
   **pendentes, nao migrados** — nao inventar categoria vazia so para o menu
   apontar a algo.
4. **`HomeCategory`/fallback de categoria-padrao:** se a configuracao do site
   referencia uma categoria-fallback que nao existe entre as categorias
   migradas, a home fica vazia mesmo com conteudo publicado. Corrigir apontando
   explicitamente para uma categoria real existente (ETag real), como unico
   ajuste de configuracao fora dos dominios de conteudo migrados.
5. **`entryPointUrl` precisa do prefixo absoluto do site** (`{webUrl}/...`), nao
   caminho relativo a raiz do dominio — o runtime publico resolve
   `importModule(extension.entryPointUrl)` relativo a raiz do dominio, nao ao
   site. Um `entryPointUrl` sem esse prefixo falha silenciosamente ao importar
   (modulo com defeito nao derruba a navegacao, mas a posicao fica vazia).
   `admin.extensions.update()` recusa alterar esse campo **por design** — nao e
   lacuna a contornar por rotina. Exclusão/recriação não restaura IDs, versões,
   auditoria ou relações e não constitui runbook padrão. Preferir uma revisão
   aprovada com ETag e prevenir o problema gravando o entrypoint corretamente
   desde a criação.
6. **Rotas internas confirmadas** usam `#/...`; converter apenas destinos
   reconhecidos como rota da SPA, com revisão e ETag. Nunca transformar todo
   caminho iniciado por `/`: assets server-relative, páginas do host e URLs
   externas não são rotas internas e devem ser preservados.
7. **Remapeamento de posicoes ao redesenhar template:** quando um template
   remove/renomeia posicoes (redesenho de grid), instancias de modulo ja
   instaladas devem ser remapeadas via `admin.moduleInstances.update(id,
   { position }, { etag })` — alterando **somente** o campo `position`, nunca
   `settingsJson`, preservando configuracao de conteudo intacta.
8. **Importacao de modulos reais como dado de exemplo nao e adocao formal**:
   vincular conteudo de exemplo a artigos/menu reais ja migrados nao substitui
   a correcao de U1/S1 documentada nem declara `rightsApproved`/
   `publicationApproved`. Mitigacao viavel sem corrigir a fonte: todas as `url`
   geradas apontam exclusivamente para rotas internas ja migradas e revisadas,
   nunca para origem externa.
9. **Decisao de nao importar um modulo** por seus defaults carregarem dados
   fixos do runtime de origem sem equivalente real na nova base e uma decisao
   de qualidade de dados legitima, nao uma limitacao tecnica.

Nenhum identificador de tenant, nome de site de producao ou contagem especifica
de registros de uma organizacao real e preservado nesta sintese — os contratos
e licoes acima se aplicam a qualquer migracao equivalente futura.

## Proveniencia e licenciamento (referencia)

Avisos de licenca de terceiros (parsers XML, dependencias do gerador, licencas
herdadas MIT/GPL por modulo CAMAP) ficam em
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). [Proveniência](PROVENIENCIA.md) concentra os contratos e gates de direitos
(`rightsApproved`/`publicationApproved`/`sourceLicensePresent`), sem aprovação
legal implícita.

Metadados/posicoes/parametros de template (manifesto `<key>.manifest.json`, Gap
A posicoes, Gap B parametros de estilo, resolucao em runtime, Cassiopeia) ficam
em [TEMPLATES.md](TEMPLATES.md) — este documento referencia apenas o contrato
de perfil XML de template (`templateDetails.xml`, register-only).

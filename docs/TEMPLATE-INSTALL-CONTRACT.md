# Contrato de template instalado (mecanismo genérico)

> Este documento descreve o **mecanismo**, não um template específico. O
> MINIJOOMLA já nasce com dois templates *builtin* (`default`, `cassiopeia`),
> registrados via `import` estático em `BUILTINS` — esses
> continuam fora deste contrato, sem mudança de comportamento. Este
> documento cobre o caminho paralelo, usado por qualquer template
> **instalado**: nunca editado no código-fonte do MINIJOOMLA, descoberto e
> carregado em tempo de execução via manifesto. Exemplo real de consumidor:
> `camap-v3`, confinado em
> `web-devs/CAMAP-V3/minijoomla-template/` — ver o doc de contrato próprio
> desse pacote (`../../CAMAP-V3/minijoomla-template/docs/CAMAP-V3-TEMPLATE.md`)
> para o que é específico dele. Nada de `camap-v3` é hardcoded aqui.

## Por que dois caminhos

Um site real, depois de copiado para o SharePoint e publicado com os dois
`.aspx` da webpart MSE, ganha aparência própria **só quando** um
administrador instala um template através da tela de extensões do painel
admin — exatamente como instalaria um template Joomla de terceiros. Até
esse momento, o MINIJOOMLA permanece genérico: só os três builtins existem.
O mecanismo abaixo é o que torna essa instalação possível sem exigir que o
template more dentro do código-fonte do MINIJOOMLA.

## 1. Manifesto (`<key>.manifest.json`)

Forma mínima, descoberta por pasta (`createTemplateDiscoveryService.scan()`
em `src/libraries/minijoomla/application/extension-discovery-service.js`)
ou colada manualmente na tela de instalação:

```json
{
  "title": "Nome amigável",
  "version": "0.1.0",
  "entryPointUrl": "./index.js",
  "positions": ["footer", "minha-posicao-custom"],
  "styles": ["./css/template.css"],
  "paramDefinitions": []
}
```

- `title`/`version`/`entryPointUrl` são obrigatórios; `styles`/
  `paramDefinitions` são opcionais (`[]`/`''` quando ausentes).
- `entryPointUrl`/cada entrada de `styles` passam por `sameSiteModuleUrl()`/
  `assetUrl()` (`application/extension-input.js`): caminho relativo ou URL
  HTTPS **do próprio site** — nunca outra origem, nunca `javascript:`/
  `data:`. Mesma regra para descoberta por pasta e para instalação manual;
  não existe caminho mais frouxo entre os dois.
- `positions`: ver seção 2.
- `paramDefinitions`: ver seção 3.

Quando descoberto por pasta, `entryPointUrl`/`styles` são relativos ao
próprio manifesto (`discoveredFrom`). Quando instalado manualmente, o
administrador informa o caminho same-site real onde os arquivos do pacote
foram publicados — essa publicação é responsabilidade do processo de
instalação, nunca do MINIJOOMLA buscar em um repositório de projeto em
produção.

## 2. Posições — validação aberta (Gap A)

`application/extension-input.js` expõe duas coisas:

- `STRUCTURAL_TEMPLATE_POSITIONS` — lista fechada, reservada aos builtins e
  usada como piso mínimo por qualquer template (`topbar`, `menu`, `footer`,
  `component`, etc.). O alias legado `TEMPLATE_POSITIONS` mantém
  compatibilidade.
- `isWellFormedPositionName(value)` — verificação **só de forma**
  (`/^[a-z][a-z0-9-]{1,40}$/`), sem pertencimento a enumeração nenhuma.

`templatePositions()` aceita uma posição se ela está na lista estrutural
**ou** passa em `isWellFormedPositionName`; a função aceita lista densa de
1..100 nomes, elimina duplicados e não executa getters/hooks. Isso permite
que um template instalado declare posições semânticas próprias (`hero`,
`menu-principal`, `minha-faixa-custom`, ...) sem exigir uma edição do
MINIJOOMLA a cada posição nova — mudança estritamente aditiva: nada que já
era aceito deixou de ser. `component` é metadata do template, nunca uma
posição atribuível a módulo, em nenhum dos dois caminhos.

Duas consequências em runtime:

- **Dropdown de posição do formulário de instância de módulo**
  (`application/admin-extensions-service.js`'s `modulePositions()`): não é
  mais uma constante congelada — é calculada como a união de
  `STRUCTURAL_TEMPLATE_POSITIONS` (menos `component`) com as `positions` de
  **todos** os templates já registrados no catálogo (`templateCatalog()`),
  inclusive templates desabilitados. Um template instalado passa a
  contribuir suas próprias posições ao formulário automaticamente. Uma
  posição customizada sem declaração atual (nome bem-formado não é
  aprovação sozinho) é rejeitada na criação, nunca substituída
  silenciosamente por uma posição estrutural; na edição, uma posição
  existente fora do catálogo permanece selecionada e identificada —
  renomear não a troca silenciosamente, e duplicar é nova criação, exigindo
  declaração atual.
- **Roteamento de módulo por posição** (`modules/dynamic-modules.js`'s
  `resolveModuleEntries(moduleInstances, scope, now, activeTemplatePositions)`):
  o 4º parâmetro, opcional, é o array de posições do template **ativo**
  quando ele é um template instalado (lido de `row.positionsJson` pelo call
  site em `src/libraries/minijoomla/index.js`, via `selectedTemplate.positions`
  devolvido por `template-runtime.js`'s `resolve()`). Um módulo atribuído a
  uma dessas posições é roteado para ela em vez de cair no fallback
  `sidebar`. Builtins (sem linha de catálogo) continuam cobertos só por
  `TEMPLATE_MODULE_POSITIONS`, comportamento inalterado quando o parâmetro é
  omitido. O runtime relê a metadata antes do `import()`, recusa corrupção e
  entrega somente as posições do template ativo, mantendo fallback legado
  para posições desconhecidas.

Assets de templates instalados (entrypoint e CSS) devem pertencer à mesma
origem/protocolo do host; credenciais, URL externa/traversal e getter não
iniciam import de código. Nenhuma nova coluna é necessária para posições;
não registrar, habilitar ou selecionar template automaticamente — usar as
ações administrativas explícitas.

## 3. Parâmetros de estilo declarados (Gap B)

`paramDefinitions` no manifesto segue a mesma forma de
`application/declared-params.js`'s `PARAM_TYPES` (`text`/`textarea`/
`number`/`checkbox`/`select`/`color`/`url`/`json`, cada um com `name`,
`type`, `label`, `default`, etc.).

**Decisão de persistência:** o schema `MiniJoomlaTemplates` não provisiona
uma coluna física dedicada a `paramDefinitions`. As definições e o CSS
compartilham o campo `Styles` existente, dentro de um envelope JSON
versionado `minijoomla-template-metadata-v1` (`application/template-metadata.js`'s
`readTemplateMetadata()`/`packTemplateMetadata()`): `{ format, styles,
paramDefinitions, ...metadata futura preservada }`. Arrays/paths CSS
legados (formato anterior, sem envelope) continuam legíveis — `styles`
sem metadata não exige migração. O parser comum limita o envelope a 64 KiB,
a lista de CSS a 50 itens e os parâmetros aos tipos/limites já existentes
do contrato declarado; getters/hooks e formatos inválidos não viram
definições vazias, e `format` herdado não pode disparar execução de getter.

Caminho de persistência/leitura:

- `extension-discovery-service.js`'s `createTemplateDiscoveryService.scan()`
  lê e valida `paramDefinitions` via `normalizeParamDefinitions()` (mesma
  função já usada para Module/Plugin).
- `admin-service.js`'s `normalizeTemplateInput()` aceita `paramDefinitions`
  (ou o alias de entrada `paramDefinitionsJson`, sem campo físico
  correspondente — `Object.hasOwn(row, 'paramDefinitionsJson')` é sempre
  `false` nos registros persistidos) e grava tudo dentro de `styles` via
  `packTemplateMetadata()`. Salvar só a declaração (sem tocar `styles`)
  preserva o CSS e qualquer metadata futura já presente; salvar só `styles`
  preserva as definições já declaradas. Um patch explícito de parâmetro
  normaliza seu valor sem reserializar/coagir listas textuais não
  relacionadas — editar um estilo nunca reescreve metadata ou parâmetros de
  outro estilo.
- `application/template-styles.js`'s
  `templateParamDefinitions(templateKey, installedDefinitions)` ganhou um
  2º parâmetro opcional: quando o chamador já tem a linha de catálogo em
  mãos (lida via `paramDefinitionsByKey(catalog)` em
  `admin-extensions-service.js`), repassa as definições já normalizadas —
  usadas em vez do mapa estático `DEFINITIONS` (reservado aos 3 builtins).
  CSS é extraído do envelope para todos os templates, mas definições
  builtin continuam prevalecendo sobre metadata externa. Mudança aditiva,
  função permanece síncrona; `validateTemplateStyles()` e
  `effectiveTemplateStyles()` também ganharam o parâmetro opcional
  `definitionsByKey`, threaded pelos mesmos call sites.
- A composição pública carrega `templateStylesJson` bruto e usa a fonte
  exata dos estilos/valores salvos (não recomputa defaults por cima do que
  já foi persistido); defaults estáticos dos templates integrados continuam
  authoritative. Templates sem declarações continuam legados.

Manifestações e registro manual preservam confirmação explícita: o
instalador manual registra o template desabilitado, sem selecionar um
default.

## 4. Resolução em runtime (`template-runtime.js`)

`resolve()` diferencia builtin (`BUILTINS[key]`, `import` estático) de
template instalado (linha de catálogo sem entrada em `BUILTINS`):

```js
const url = assetUrl(row.entryPointUrl, base, '.js');
const module = await importModule(url); // import() dinâmico, same-site
const render = module.renderShell ?? module.default;
if (typeof render !== 'function') throw new TypeError('Template deve exportar renderShell ou uma função default.');
```

**Contrato obrigatório do pacote instalado:** o módulo apontado por
`entryPointUrl` deve exportar `renderShell` (preferido) ou `default` — uma
função pura que recebe `{ config, menus, breadcrumbs, content, modules,
busy }` e devolve HTML. Qualquer outro nome de exportação não é encontrado
pelo runtime e cai no shell de erro genérico do host. Posições próprias
alimentam `modules`; parâmetros declarados/defaults/estilo selecionado
chegam por `config.templateParams`, mantendo desconhecidos próprios. O
renderer deve escapar dados textuais e consumir o HTML preparado pelos
componentes conforme seu contrato. Opcionalmente, o módulo pode exportar
`bindShell(root)` para comportamento client-side (skip-link, menu mobile,
etc.) — quando ausente, o template funciona sem JavaScript (progressive
enhancement, mesmo princípio dos builtins); quando declarado, deve ser uma
função, pode devolver uma função de cleanup chamada antes de substituir o
shell e no stop, sem executar novamente o bind de uma navegação obsoleta.
Não é contrato PHP. Assets relativos são resolvidos contra
`documentRef.baseURI` (ou `import.meta.url` como fallback), **não contra o
manifesto** — use URLs explícitas aprovadas para pacotes publicados, sem
prometer resolução por manifesto sem implementação.

`resolve()` também devolve `positions` (posições declaradas pelo template
ativo, lidas de `row.positionsJson`) e `definitions` (lidas do envelope de
`styles` via `readTemplateMetadata()`) — usado pelo call site de
`src/libraries/minijoomla/index.js` para o roteamento de módulos descrito
na seção 2 e para os parâmetros de estilo da seção 3.

## 5. Preview local (`scripts/serve-local.js --extra-root`)

Durante o desenvolvimento de um template instalado fora do MINIJOOMLA, a
flag CLI repetível `--extra-root <prefixo>=<caminho>` monta uma raiz
estática adicional sob um prefixo:

```sh
node scripts/serve-local.js --extra-root pkg/camap-v3=../CAMAP-V3/minijoomla-template
```

`createLocalDemoServer({ root, extraRoots })` aceita um mapa
`prefixo → raiz absoluta`. Uma requisição cujo caminho começa com
`/<prefixo>/` é resolvida contra aquela raiz extra, reaproveitando
exatamente a mesma lógica de containment check e rejeição de symlink/
traversal já usada para a raiz principal — sem exceção de segurança. Sem
nenhuma `--extra-root`, o comportamento é idêntico ao anterior (só
`/src|examples|tests` da própria pasta do MINIJOOMLA).

`examples/demo-repositories.js` pode semear uma linha de catálogo
apontando `entryPointUrl`/`styles` para `/<prefixo>/...`, exercitando de
verdade o caminho de `import()` dinâmico (não um builtin mascarado).

**Esta flag é opt-in e só para desenvolvimento local.** Não existe (e não
deve existir) equivalente em produção — lá, o pacote é publicado como
arquivo real no mesmo site (biblioteca de ativos do SharePoint, por
exemplo), nunca lido de um repositório de projeto fora do site publicado.

### Preview local: seleção por catálogo em `examples/index.html`

`examples/index.html`'s `previewTemplate` aceita `?template=<chave>` para
os dois builtins (`default`/`cassiopeia`) **ou** qualquer chave
habilitada já existente no catálogo local de templates (por exemplo, um
template instalado via `serve-local.js --extra-root`, documentado em
[LOCAL-DEMO.md](LOCAL-DEMO.md)). Chave desconhecida ou desabilitada é
rejeitada com o mesmo erro genérico; a seleção pela query nunca grava
`templateKey` no storage de demonstração nem ativa/registra o template como
padrão. Sem query, a demo continua usando o template salvo normalmente.

Validado por `scripts/test-standalone-examples.js`: cria um registro
habilitado no catálogo em memória, seleciona-o pela query, confirma
ausência de escrita adicional no storage e recusa a mesma chave após
desabilitá-la. Nenhum seed/template CAMAP-V3 foi incorporado; é preview
puramente local, sem publicação.

## 6. Fluxo real de instalação (produção)

1. O MINIJOOMLA (genérico, só os 3 builtins) é copiado para o site
   SharePoint de destino e publicado via os dois `.aspx` da webpart MSE.
2. Os arquivos do pacote do template (código + CSS + manifesto) são
   publicados separadamente, num caminho same-site acessível — passo de
   publicação do **pacote**, distinto do deploy do MINIJOOMLA.
3. No painel admin, o administrador usa a tela de instalação/descoberta de
   templates (`/installer` ou `/templates/discover`) para registrar o
   manifesto — só então o template passa a existir para aquele site.
4. A partir daí, o template aparece no catálogo
   (`application/admin-extensions-service.js`'s `templateCatalog()`), pode
   ser selecionado como template ativo do site e ganha uma entrada na tela
   de Estilos de template, com os campos de `paramDefinitions` carregados
   dinamicamente no formulário.

## 7. O que este mecanismo garante e o que não garante

- Garante: zero edição do MINIJOOMLA por posição/parâmetro novo de um
  template instalado; validação de entrypoint/estilo tão rigorosa quanto a
  dos builtins (mesma origem same-site, mesmas regras de sanitização);
  nenhuma regressão nos três builtins (testes cobrindo-os continuam
  passando sem alteração); preservação de metadata futura desconhecida no
  envelope de `styles` através de updates sucessivos.
- Não garante: aceite visual (isso é FIORI-AUTO, por template, fora deste
  contrato); publicação/cópia dos arquivos do pacote para o site de destino
  (responsabilidade do processo de instalação); suporte a formatos de
  manifesto incompatíveis com `declared-params.js`'s `PARAM_TYPES`; XML de
  templates/plugins, que continua pendente em contrato próprio
  ([CONTRATOS-EVOLUCAO-XML.md](CONTRATOS-EVOLUCAO-XML.md)).

## Cobertura de teste

`tests/installed-template-positions.test.js` e
`tests/installed-template-params.test.js`/`installed-template-params-admin.test.js`
cobrem o mecanismo com fixtures sintéticas (`custom-hero`/`installed`), não
`camap-v3` — estes arquivos testam o **mecanismo**, não um consumidor
específico. Cobertura: formato de `isWellFormedPositionName`, aceitação
mista estrutural/declarada em `templatePositions()`, roteamento de módulo
via `resolveModuleEntries()` com/sem o 4º parâmetro, precedência de
`templateParamDefinitions()` quando definições instaladas são fornecidas,
parser/envelope de `styles` (limites de bytes/itens, ausência de coluna
física para `paramDefinitionsJson`), preservação de metadata futura e
isolamento entre estilos ao salvar. Teste local e ensaio isolado SharePoint
estão também detalhados em
[CICLO-TEMPLATES-POSICOES.md](CICLO-TEMPLATES-POSICOES.md) e
[CICLO-TEMPLATES-PARAMETROS.md](CICLO-TEMPLATES-PARAMETROS.md); o ensaio usa
catálogo e persistência em memória — não é instalação real do template nas
listas aceitas, nem deploy do núcleo, nem aceite integral de
acessibilidade/distribuição.

## Fechamento — Iteração 7 (mecanismo genérico, exercitado com `camap-v3`)

Publicação real contra o site de teste dedicado (`Comunidades-de-interesse-191`,
nunca `camap-agp` de produção), com autorização explícita do usuário para a
etapa de `publishPages()` sem `--prepare-only`. Três correções genéricas
surgiram ao exercitar o mecanismo de ponta a ponta com um consumidor real
(`camap-v3`) — nenhuma delas é específica desse template:

1. **`scripts/deploy-sharepoint.mjs`'s `publishPages()`: `getbytitle('Site
   Pages')` responde 404 de forma consistente neste tenant**, mesmo a lista
   existindo (confirmado: `GetList(url)` e `$filter=Title eq '...'`
   funcionam contra a mesma lista — peculiaridade real do SharePoint, não um
   bug do script). Localizar a página por `web/lists(guid'<Id>')` (via
   `$filter=BaseTemplate eq 119`) evita `getbytitle` por completo.
2. **Nome do `.aspx` público nunca hardcodado**: `publishPages()` ganhou a
   flag `--public-page NomeReal.aspx` (default `'MiniJoomla.aspx'`) — quem
   decide o nome real da página pública é quem a criou no site de destino
   (`CAMAP-V3.aspx`, no site de teste usado); o MINIJOOMLA não assume nome
   de site/template nenhum.
3. **Gap B estava incompleto nesta iteração**: `admin-service.js`'s
   `normalizeTemplateInput()` já produzia `paramDefinitionsJson`, mas nem
   `spmiddle-schemas.js` nem `spmiddle-repositories.js` declaravam o campo —
   qualquer template instalado com `paramDefinitions` falhava silenciosamente
   ao registrar ("Não foi possível registrar o template."). Corrigido
   adicionando `ParamDefinitionsJson` (`MultilineText`) ao schema
   `MiniJoomlaTemplates` e `paramDefinitionsJson: 'ParamDefinitionsJson'` ao
   `TEMPLATE_MAPPING`, aditivo (nenhum registro existente é afetado). A
   reconciliação subsequente com a candidata step2 (seção 3 acima) substituiu
   o destino final dessa escrita pelo envelope em `styles` — o campo
   `ParamDefinitionsJson` permanece no schema/mapper como aceito na entrada,
   mas nenhum registro persiste valor físico nele.

Sequência real executada e confirmada via FIORI-AUTO: pacote `camap-v3`
0.6.0 publicado em `SiteAssets/minijoomla/templates/camap-v3/0.6.0/`
(SHA-256 por arquivo) → MINIJOOMLA publicado como release `0.1.4` (fix do
Gap B) via `publishPages()` real em `CAMAP-V3.aspx` e `Administrator.aspx`
→ registro via `/templates/discover` no painel admin → confirmado na tela
Templates (`CAMAP V3`, chave `camap-v3`, versão `0.6.0`, habilitado) e via
leitura direta da lista `MiniJoomlaTemplates` (14 posições,
`ParamDefinitionsJson` persistido corretamente nessa iteração). Nenhuma
referência a `camap-v3` permanece hardcoded em `web-devs/MINIJOOMLA/src/`
(grep confirmado vazio fora de comentários/docs do mecanismo).

Teste real complementar da seleção por catálogo (seção 5): o mesmo grafo de
módulos (`src/`, `examples/`) foi publicado numa pasta de prova nova e
isolada no SharePoint, fora das releases aceitas, e exercitado numa página
administrativa real via FIORI-AUTO (iframe dedicado, sem `<script>` inline —
CSP do SharePoint bloqueia scripts inline mesmo dentro de um iframe filho; o
entrypoint usa `<script type="module" src>` externo com cache-buster).
Confirmadas as seis condições do contrato: chave desconhecida rejeitada,
chave habilitada selecionada (`data-template="cassiopeia"`), nenhuma escrita
extra no storage ao selecionar, chave desabilitada rejeitada como
desconhecida, e fallback ao template salvo preservado. Os **48
registros/ETags de dados, o hash do host 0.16.1 e o canvas das duas páginas
aceitas permaneceram idênticos**; apenas a versão numérica do arquivo da
página administrativa avançou sem alteração de conteúdo, consistente com
leitura/sessão do SharePoint, não uma escrita de conteúdo. Sem
instalação/registro persistente de extensão.

Validação do incremento de parâmetros declarados (seção 3), reconciliado
posteriormente sobre a candidata step2 sem substituir a principal: reteste
final no SharePoint cobriu campos text/number/select da declaração, aba
Avançado, edição e submit por teclado; runtime mostra texto, número e opção
salvos, reflow 320/768/900. Um estilo não relacionado conservou
`futureStyle`, número string, chaves desconhecidas e ausência do default
novo. Iframe removido e navegador próprio encerrado. **48 registros/ETags,
duas páginas e hash do host ativos conferidos e iguais antes/depois**, zero
writes nas listas/páginas. Reteste final aprovado: `npm test` terminou com
**118 suítes aprovadas, zero skips/falhas**; parse-only conferiu **349
JS/MJS**; contributor selecionou **441 caminhos exatos**, com
inventário/hashes determinísticos e gates de containment/CLI preservados. A
reauditoria independente confirmou os achados corrigidos e executou testes
focais e assertions de preservação, sem P1 remanescente no recorte.

Este resultado fecha o incremento funcional com o ciclo exigido; não fecha
automaticamente a integração de todo o delta da principal ou os gates
listados na seção 7. Ensaio isolado SharePoint não é instalação real de um
template no catálogo, deploy do núcleo, XML de templates/plugins, prontidão
pública ou acessibilidade integral.

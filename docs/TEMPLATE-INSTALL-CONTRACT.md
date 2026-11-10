# Contrato de template instalado (mecanismo genérico)

> Este documento descreve o **mecanismo**, não um template específico. O
> MINIJOOMLA já nasce com três templates *builtin* (`default`, `cassiopeia`,
> `camap`), registrados via `import` estático em `BUILTINS` — esses
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
  `component`, etc.).
- `isWellFormedPositionName(value)` — verificação **só de forma**
  (`/^[a-z][a-z0-9-]{1,40}$/`), sem pertencimento a enumeração nenhuma.

`templatePositions()` aceita uma posição se ela está na lista estrutural
**ou** passa em `isWellFormedPositionName`. Isso permite que um template
instalado declare posições semânticas próprias (`hero`, `menu-principal`,
`minha-faixa-custom`, ...) sem exigir uma edição do MINIJOOMLA a cada
posição nova — mudança estritamente aditiva: nada que já era aceito deixou
de ser.

Duas consequências em runtime:

- **Dropdown de posição do formulário de instância de módulo**
  (`application/admin-extensions-service.js`'s `modulePositions()`): não é
  mais uma constante congelada — é calculada como a união de
  `STRUCTURAL_TEMPLATE_POSITIONS` com as `positions` de **todos** os
  templates já registrados no catálogo (`templateCatalog()`). Um template
  instalado passa a contribuir suas próprias posições ao formulário
  automaticamente.
- **Roteamento de módulo por posição** (`modules/dynamic-modules.js`'s
  `resolveModuleEntries(moduleInstances, scope, now, activeTemplatePositions)`):
  o 4º parâmetro, opcional, é o array de posições do template **ativo**
  quando ele é um template instalado (lido de `row.positionsJson` pelo call
  site em `src/libraries/minijoomla/index.js`, via `selectedTemplate.positions`
  devolvido por `template-runtime.js`'s `resolve()`). Um módulo atribuído a
  uma dessas posições é roteado para ela em vez de cair no fallback
  `sidebar`. Builtins (sem linha de catálogo) continuam cobertos só por
  `TEMPLATE_MODULE_POSITIONS`, comportamento inalterado quando o parâmetro é
  omitido.

## 3. Parâmetros de estilo declarados (Gap B)

`paramDefinitions` no manifesto segue a mesma forma de
`application/declared-params.js`'s `PARAM_TYPES` (`text`/`textarea`/
`number`/`checkbox`/`select`/`color`/`url`/`json`, cada um com `name`,
`type`, `label`, `default`, etc.). Caminho de persistência/leitura:

- `extension-discovery-service.js`'s `createTemplateDiscoveryService.scan()`
  lê e valida `paramDefinitions` via `normalizeParamDefinitions()` (mesma
  função já usada para Module/Plugin).
- `admin-service.js`'s `normalizeTemplateInput()` persiste
  `paramDefinitionsJson` (mesmo padrão de `positionsJson`/`styles`:
  opcional, `[]` quando ausente).
- `application/template-styles.js`'s
  `templateParamDefinitions(templateKey, installedDefinitions)` ganhou um
  2º parâmetro opcional: quando o chamador já tem a linha de catálogo em
  mãos (lida via `paramDefinitionsByKey(catalog)` em
  `admin-extensions-service.js`), repassa as definições já normalizadas —
  usadas em vez do mapa estático `DEFINITIONS` (reservado aos 3 builtins).
  Mudança aditiva, função permanece síncrona; `validateTemplateStyles()` e
  `effectiveTemplateStyles()` também ganharam o parâmetro opcional
  `definitionsByKey`, threaded pelos mesmos call sites.

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
pelo runtime e cai no shell de erro genérico do host. Opcionalmente, o
módulo pode exportar `bindShell(root)` para comportamento client-side
(skip-link, menu mobile, etc.) — quando ausente, o template funciona sem
JavaScript (progressive enhancement, mesmo princípio dos builtins).

`resolve()` também devolve `positions` (posições declaradas pelo template
ativo, lidas de `row.positionsJson`) — usado pelo call site de
`src/libraries/minijoomla/index.js` para o roteamento de módulos descrito
na seção 2.

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
`examples/index.html`'s `previewTemplate` aceita qualquer chave que seja
builtin real **ou** que já exista como linha no catálogo semeado — uma
chave totalmente desconhecida continua rejeitada.

**Esta flag é opt-in e só para desenvolvimento local.** Não existe (e não
deve existir) equivalente em produção — lá, o pacote é publicado como
arquivo real no mesmo site (biblioteca de ativos do SharePoint, por
exemplo), nunca lido de um repositório de projeto fora do site publicado.

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
  passando sem alteração).
- Não garante: aceite visual (isso é FIORI-AUTO, por template, fora deste
  contrato); publicação/cópia dos arquivos do pacote para o site de destino
  (responsabilidade do processo de instalação); suporte a formatos de
  manifesto incompatíveis com `declared-params.js`'s `PARAM_TYPES`.

## Cobertura de teste

`tests/installed-template-positions.test.js` cobre o mecanismo com uma
fixture sintética (`custom-hero`), não `camap-v3` — este arquivo testa o
**mecanismo**, não um consumidor específico. Cobertura: formato de
`isWellFormedPositionName`, aceitação mista estrutural/declarada em
`templatePositions()`, roteamento de módulo via `resolveModuleEntries()`
com/sem o 4º parâmetro, e precedência de `templateParamDefinitions()`
quando definições instaladas são fornecidas.

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
3. **Gap B estava incompleto**: `admin-service.js`'s `normalizeTemplateInput()`
   já produzia `paramDefinitionsJson`, mas nem `spmiddle-schemas.js` nem
   `spmiddle-repositories.js` declaravam o campo — qualquer template
   instalado com `paramDefinitions` falhava silenciosamente ao registrar
   ("Não foi possível registrar o template."). Corrigido adicionando
   `ParamDefinitionsJson` (`MultilineText`) ao schema `MiniJoomlaTemplates` e
   `paramDefinitionsJson: 'ParamDefinitionsJson'` ao `TEMPLATE_MAPPING`.
   Aditivo: nenhum registro existente é afetado.

Sequência real executada e confirmada via FIORI-AUTO: pacote `camap-v3`
0.6.0 publicado em `SiteAssets/minijoomla/templates/camap-v3/0.6.0/`
(SHA-256 por arquivo) → MINIJOOMLA publicado como release `0.1.4` (fix do
Gap B) via `publishPages()` real em `CAMAP-V3.aspx` e `Administrator.aspx`
→ registro via `/templates/discover` no painel admin → confirmado na tela
Templates (`CAMAP V3`, chave `camap-v3`, versão `0.6.0`, habilitado) e via
leitura direta da lista `MiniJoomlaTemplates` (14 posições,
`ParamDefinitionsJson` persistido corretamente). Nenhuma referência a
`camap-v3` permanece hardcoded em `web-devs/MINIJOOMLA/src/` (grep
confirmado vazio fora de comentários/docs do mecanismo).

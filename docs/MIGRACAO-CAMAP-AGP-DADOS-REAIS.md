# Migração de dados reais de camap-agp para o site de teste (2026-11-11)

## Contexto

Pedido do usuário: popular o site de teste MINIJOOMLA
(`Comunidades-de-interesse-191`, template `camap-v3`) com conteúdo real do
site de produção `https://petrobrasbr.sharepoint.com/teams/camap-agp`
("vamos usar os dados reais como exemplo"), em vez de dados fictícios. O
acesso a `camap-agp` foi **somente leitura** durante todo o processo —
nenhuma gravação, alteração ou publicação ocorreu nesse site em nenhum
momento. A gravação ocorreu exclusivamente no site de teste.

Plano detalhado (mapeamentos, decisões de qualidade de dados, exclusões):
`C:\Users\EAQU\.claude-hub-ai\plans\declarative-discovering-wozniak.md`
(histórico da sessão; resumo executivo abaixo).

## Fonte

`camap-agp` roda sobre o runtime legado `mse-platform`, com listas próprias
(`MSE Categorias`, `MSE Publicacoes`, `MSE Itens de menu`) sem equivalência
1:1 de nomes de campo com o MINIJOOMLA — o mapeamento foi deduzido por
inspeção de conteúdo, conforme alertado pelo usuário.

## Destino

Site de teste `Comunidades-de-interesse-191`, listas
`MiniJoomlaCategories`, `MiniJoomlaArticles`, `MiniJoomlaMenu` (vazias antes
da migração). Escrita feita via `createAdminService` (mesma validação do
admin real) contra repositórios SPMIDDLE reais, roteados pela sessão
FioriAgent já autenticada — nenhum script REST artesanal de baixo nível.
Script de instalação (descartável, não versionado):
`web-devs/MINIJOOMLA/tmp/install-camap-agp-migration.mjs` +
`tmp/camap-agp-migration-data.mjs` (dados/transformação).

## Resultado

- **11 categorias** criadas (todas as de origem).
- **22 artigos** criados, de 27 publicações de origem. **5 excluídos**
  deliberadamente:
  - `Id 20`: duplicata exata de conteúdo do `Id 16` ("Plano Ostensivo de
    Iniciativas da CAMAP-AGP").
  - `Id 24`, `25`, `26`: registros de teste (`Title: "Teste"`, campos
    vazios).
  - `Id 6`: `EstadoEditorial = Lixeira`.
  - (Os 2 títulos duplicados reais restantes — "Quem somos?" ids 4/27 —
    migraram como artigos distintos, com aliases `quem-somos`/`quem-somos-2`;
    nenhuma deduplicação de conteúdo foi tentada, por não ser uma inferência
    segura.)
- **7 itens de menu** criados: Início, Quem somos, Nossa estrutura, Serviços
  e processos, Docs e padrões, Contatos, Agenda e eventos. **2 pendentes**
  (não migrados, sem destino resolvido): "Destaques" e "Em foco" — ambos
  dependiam de um filtro de artigos em destaque sem categoria correspondente
  nos dados reais; não foi inventada uma categoria vazia só para o menu
  apontar a algo. O item de origem `Component: "administrator"` também não
  migrou (console admin do mse-platform, sem equivalente).
- Distribuição de artigos por categoria migrada: `institucional` (14),
  `boletim` (4), `conhecimento` (1), `servicos-e-processos` (1),
  `docs-e-padroes` (1), 1 artigo sem categoria resolvida (`CategoriaTexto`
  não encontrado entre as categorias migradas).

## Correção aplicada: página inicial vazia

Após a instalação, a página pública (`CAMAP-V3.aspx`) mostrava "Nenhum
conteúdo publicado ainda." na aba Início, mesmo com 22 artigos publicados.
Causa: `MiniJoomlaSiteConfig.HomeCategory` estava `null` (resíduo da
Iteração 7 do template, antes de haver qualquer categoria real), e
`content-service.js`'s `home()` usa o fallback `'noticias'`, que não existe
entre as categorias migradas. Corrigido definindo
`HomeCategory: 'institucional'` (categoria com mais artigos migrados) via
`admin.siteConfig.save(...)`, com etag real — único ajuste de configuração
feito fora dos 3 domínios de conteúdo (categorias/artigos/menu), necessário
para a página inicial renderizar conteúdo real. Verificado via leitura REST
e nova captura de tela pública: o "Nenhum conteúdo publicado ainda."
desapareceu e um artigo real ("Contatos") passou a ser exibido.

## Verificação

- Leitura REST pós-instalação confirmou os valores esperados em todas as
  linhas criadas (títulos, aliases, `categoryId`, `path` do menu).
- FIORI-AUTO: captura de tela de `.../SitePages/CAMAP-V3.aspx` confirmou o
  menu público com os 7 itens migrados, na ordem correta, e a aba Início
  exibindo conteúdo real após a correção de `HomeCategory`.
- `node tests/run-tests.js`: suíte completa (79 suítes) executada sem
  regressão após a migração de dados e após a correção de `HomeCategory`.
- `git status --short`: nenhum arquivo de código-fonte versionado foi
  alterado por esta migração — apenas dados no site de teste e scripts
  descartáveis em `tmp/` (não versionados).
- Confirmado por revisão de todas as chamadas desta sessão: nenhuma
  requisição `POST`/`MERGE`/`DELETE` foi emitida contra `camap-agp` — apenas
  `GET`.

## Fora de escopo (não migrado)

- `MSE Modules`, `MSE Modules by menu item`, `MSEConfiguracoes`, `MSE
  Template Styles`, `MSE Extensions` — sem domínio MiniJoomla equivalente
  direto.
- Imagens (`ImagemUrl`/`ImagemAlt`, hospedadas em
  `agencia.petrobras.com.br`) — preservadas apenas como texto/URL dentro do
  corpo migrado quando aplicável; nenhuma mídia foi baixada ou
  re-hospedada.
- Tags — vazias na origem, nada a migrar.

## Importação dos 4 módulos reais CAMAP (`mod_camap_*`) — 2026-11-11

Pedido do usuário: confirmar que `web-devs/CAMAP2/extensions/camap/`
contém módulos (`mod_camap_corpmessage`, `mod_camap_editorial`,
`mod_camap_highlights`, `mod_camap_topsections`) produzidos para o
contrato do MINIJOOMLA e, caso verdadeiro, importá-los no site de teste.
**Confirmado**: os 4 têm `manifest.json` (`type: "Module"`,
`entryPointUrl`, `positions`, `styles`) e `module.js` exportando
`{ name, settings, settingsSchema, render({ settings, state }) }` —
exatamente o contrato de `src/libraries/minijoomla/modules/registry.js`.
Essa confirmação explica a pergunta anterior do usuário sobre "Módulos do
Site" aparecer vazio: a migração de conteúdo (categorias/artigos/menu,
acima) nunca cobriu módulos; `MiniJoomlaModuleInstances` tinha 0 linhas.

**Dados de exemplo, não adoção formal.** O usuário optou explicitamente
(via decisão registrada na sessão) por vincular o conteúdo de exemplo aos
artigos/menu **reais** já migrados de camap-agp, em vez de dados
neutros/fictícios. Esta importação é dado de teste no site de teste — não
é a "adoção" formal no núcleo descrita em `docs/MODULE-ADOPTION.md`/
`docs/MATRIZ-ADOPTION-MODULOS.md`: nenhuma correção das falhas documentadas
U1 (`safeUrl` em `_shared/render.js` aceita URLs protocol-relative/
backslash-origin) ou S1 (itens sem validação de schema por item) foi
feita, e nenhum flag `rightsApproved`/`publicationApproved` foi declarado.
Os `.js`/CSS foram copiados **byte a byte**, sem edição, de
`web-devs/CAMAP2/extensions/camap/`. Mitigação adotada: todas as `url`
geradas apontam exclusivamente para rotas internas já migradas e revisadas
(`/article/<alias>`, `/category/<alias>?layout=list`), nunca para origem
externa.

### Arquivos publicados

8 arquivos (4× `module.js` + 4× CSS + `_shared/render.js`, dependência
comum), via upload REST idêntico ao padrão de `scripts/deploy-sharepoint.mjs`,
em `{webUrl}/SiteAssets/minijoomla/extensions/camap/`:

- `mod_camap_corpmessage/module.js` + `mc.css`
- `mod_camap_editorial/module.js` + `db.css`
- `mod_camap_highlights/module.js` + `highlights.css`
- `mod_camap_topsections/module.js` + `sd.css`
- `_shared/render.js`

### Registro (`MiniJoomlaExtensions`/`MiniJoomlaModuleInstances`)

4 extensões + 4 instâncias registradas via `createAdminService` (mesma
validação do admin real), mapeadas para as posições module-content-only do
template ativo `camap-v3` (não as posições antigas `home-a..home-e`
declaradas nos manifests originais, que pertencem ao template `camap`
legado, não instalado neste site):

| Módulo | Posição `camap-v3` | Conteúdo de exemplo (vinculado ao real) |
| --- | --- | --- |
| `mod_camap_corpmessage` | `agenda-avisos` | Resumo do artigo "Missão CAMAP-AGP" |
| `mod_camap_editorial` | `destaques` | 3 artigos reais de `institucional` |
| `mod_camap_highlights` | `destaques` | 3 artigos reais de `boletim` |
| `mod_camap_topsections` | `links-uteis` | Os 6 itens de menu reais migrados (exceto Início) |

Script (descartável, não versionado): `tmp/install-camap-modules.mjs`.

### Bug encontrado e corrigido: `EntryPointUrl` sem prefixo `{webUrl}`

A primeira execução gravou `EntryPointUrl` como
`/SiteAssets/minijoomla/extensions/camap/<módulo>/module.js` — caminho
**sem** o prefixo `{webUrl}` (`/teams/Comunidades-de-interesse-191`). O
arquivo publicado estava correto e acessível em
`{webUrl}/SiteAssets/.../module.js` (HTTP 200), mas o runtime público
(`modules/dynamic-modules.js`'s `ensureModuleRegistered` →
`importModule(extension.entryPointUrl)`) resolve esse caminho relativo à
raiz do domínio (`https://petrobrasbr.sharepoint.com/SiteAssets/...`), que
não existe (404) — diferente do template `camap-v3`, cuja linha em
`MiniJoomlaTemplates` já armazena o `EntryPointUrl` corretamente
prefixado. O `import()` falhava silenciosamente (tratado como falha de
carregamento isolada, por design — um módulo com defeito não derruba a
navegação), e as 3 posições module-content-only (`destaques`,
`agenda-avisos`, `links-uteis`) ficavam vazias mesmo com dado e posição
corretos — confirmado por inspeção de DOM (`data-template-region`
presente, `textContent` vazio) antes da correção.

`admin.extensions.update()` recusa alterar `entryPointUrl` de um registro
existente (campo "do manifesto registrado", por design —
`admin-service.js`, `extensions.update`). Correção aplicada via
`tmp/fix-entrypoint-urls.mjs`: remover as 4 instâncias (libera a trava
"não remova extensão referenciada"), remover e recriar as 4 extensões com
`entryPointUrl` corrigido (mesma `key`/`type`/`folder`), recriar as 4
instâncias com os mesmos `position`/`settingsJson`/`enabled` capturados
antes da remoção — tudo via `admin.extensions`/`admin.moduleInstances`
(create/remove validados), nunca escrita REST manual nos campos
protegidos. `tmp/install-camap-modules.mjs` também foi corrigido
(`entryPointUrl: `${webUrl}/SiteAssets/...`` em vez de sem o prefixo) para
que uma reexecução futura (ex.: em outro site de teste) não repita o bug.

### Segundo bug encontrado e corrigido: links internos em formato de PATH, não de rota (hash)

Após a correção acima, os módulos renderizavam, mas os links internos
(ex. "Mapeamento de Processos PCI", "Contatos", "Quem somos") apontavam
para `https://petrobrasbr.sharepoint.com/article/<alias>` — a raiz do
domínio — em vez de
`https://.../SitePages/CAMAP-V3.aspx#/article/<alias>` (reportado pelo
usuário). Causa: o `settingsJson` de `mod_camap_editorial` e
`mod_camap_topsections` foi montado com valores de PATH absoluto
(`/article/<alias>`, `/category/<alias>?layout=list`), mas o MINIJOOMLA é
uma SPA de rota por **hash** (`src/libraries/minijoomla/core/router.js`'s
`link()`, usado por TODOS os outros links internos do app — menu,
breadcrumbs, cards de artigo — sempre produz `#/...`). `safeUrl()` em
`_shared/render.js` (CAMAP2) aceita qualquer valor começando com `#`, `/`
ou `https://` como "seguro", sem normalizar para o formato de rota da
SPA — por isso o valor passou a validação sem indicar o problema; o
navegador resolveu o `href="/article/..."` contra a raiz do domínio, não
contra a página+hash atual.

Corrigido via `tmp/fix-module-link-format.mjs`: reescreveu, dentro do
`settingsJson` já persistido, cada `items[].url`/`catalogTarget` que
começava com `/` para `#/...` (preservando valores já corretos ou
externos), usando `admin.moduleInstances.update()` (validado, com ETag) —
nenhuma mudança de conteúdo, apenas o prefixo de rota. `mod_camap_highlights`
e `mod_camap_corpmessage` não têm campo de URL; não precisaram de ajuste.

### Verificação

- Leitura REST pós-correção: as 4 `MiniJoomlaExtensions` com
  `EntryPointUrl` prefixado por `{webUrl}`; as 4 `MiniJoomlaModuleInstances`
  com `position`/`settingsJson` idênticos aos originais, exceto os `url`
  internos de editorial/topsections agora em formato `#/...`.
- Fetch direto do navegador confirmou HTTP 200 nos 8 arquivos publicados.
- FIORI-AUTO: recarga completa da página pública
  (`.../SitePages/CAMAP-V3.aspx`) e inspeção de
  `[data-template-region]` confirmaram `destaques` (editorial + highlights),
  `agenda-avisos` (corpmessage) e `links-uteis` (topsections) renderizando
  conteúdo real; nenhum `[role="alert"]` de erro de módulo; captura de
  tela confirma "Destaques institucionais" e "Boletins recentes" visíveis
  na Home.
- Inspeção de `href`/`href` resolvido de cada `<a>` dentro das 3 posições
  confirmou que todos os links agora resolvem para
  `.../SitePages/CAMAP-V3.aspx#/article/<alias>` ou
  `.../CAMAP-V3.aspx#/category/<alias>?layout=list` — nunca para a raiz
  do domínio.
- `node tests/run-tests.js`: suíte completa sem regressão (ver resultado
  consolidado na sessão; as únicas falhas reportadas são as 2
  pré-existentes do installer Joomla, não relacionadas).
- Nenhum arquivo-fonte de `CAMAP2` foi alterado (cópia byte a byte); nenhuma
  escrita ocorreu em `camap-agp`.

## Importação de mais 4 módulos reais CAMAP (`mod_camap_*`) — 2026-11-11

Pedido do usuário: importar "os outros 5" módulos `mod_camap_*`, depois
restrito explicitamente a apenas os de prefixo `mod_camap_*`
("ATENÇÃO: somente os módulos mod_camap*"), excluindo `mod_forum` e
`mod_videoteca`. Dos 5 candidatos (`mod_camap_hero`, `mod_camap_home`,
`mod_camap_recursos`, `mod_camap_showcase`, `mod_camap_documentation`), o
usuário decidiu (via `AskUserQuestion`):

- **`mod_camap_hero`**: importar mesmo mapeando para a posição nativa
  `hero` do `camap-v3`, sabendo do efeito de hero "aninhado" (ver caveat
  abaixo).
- **`mod_camap_home`**: **não importar** nesta rodada — seus `defaults`
  trazem estatísticas fixas do mse-platform sem equivalente real em
  camap-agp (ex. "17 ENCONTROS REALIZADOS").

Escopo final: **4 módulos** — `mod_camap_hero`, `mod_camap_recursos`,
`mod_camap_showcase`, `mod_camap_documentation`. Mesmo enquadramento da
importação anterior: dado de teste no site de teste, vinculado a conteúdo
real já migrado de camap-agp, cópia byte a byte, nenhuma correção de
U1/S1, nenhum flag de direitos declarado, somente leitura em `camap-agp`.

### Arquivos publicados

8 arquivos (4× `module.js` + 4× CSS) em
`{webUrl}/SiteAssets/minijoomla/extensions/camap/` (reaproveitando
`_shared/render.js`, já publicado na importação anterior):

- `mod_camap_hero/module.js` + `hero.css`
- `mod_camap_recursos/module.js` + `recursos.css`
- `mod_camap_showcase/module.js` + `showcase.css`
- `mod_camap_documentation/module.js` + `documentation.css`

### Registro (`MiniJoomlaExtensions`/`MiniJoomlaModuleInstances`)

4 extensões + 4 instâncias, mapeadas para posições do `camap-v3` não
usadas pelos 4 primeiros módulos:

| Módulo | Posição `camap-v3` | Conteúdo de exemplo (vinculado ao real) |
| --- | --- | --- |
| `mod_camap_hero` | `hero` | missão (artigo "Missão CAMAP-AGP") + CTAs "Quem somos"/"Contatos" |
| `mod_camap_recursos` | `main-bottom` | links reais das 5 categorias migradas (chips de categoria) |
| `mod_camap_showcase` | `sidebar-left` | artigos reais de `boletim`/`conhecimento`, modo lista |
| `mod_camap_documentation` | `sidebar-right` | as 5 categorias reais como índice, cada uma com seus artigos |

Script (descartável, não versionado): `tmp/install-camap-modules-2.mjs`.
Diferente da importação anterior: o `EntryPointUrl` já foi gravado com o
prefixo `{webUrl}` desde a criação, e todas as URLs internas já nasceram
em formato de rota hash (`#/article/...`, `#/category/...?layout=list`) —
os dois bugs da importação anterior não se repetiram, por construção.

### Caveat conhecido: hero "aninhado"

`mod_camap_hero` renderiza sua própria seção `<section class="camap-hero">`
completa (título/mission/CTAs). A posição `hero` do `camap-v3`
(`web-devs/CAMAP-V3/minijoomla-template/index.js`'s `hero()`) só injeta o
conteúdo do módulo dentro da área de **mídia** da faixa nativa
(`camap-v3-template__hero-media`), nunca substituindo o masthead/
kicker/título/lead/CTA do template, que continuam fixos pelos parâmetros
do template (hoje com placeholder neutro, por pendência de direitos de
imagem). O resultado visual é uma seção hero do módulo aninhada dentro da
mídia do hero nativo — decisão explícita do usuário, registrada aqui como
efeito esperado, não como bug a corrigir.

### Verificação

- Leitura REST pós-instalação: 4 novas `MiniJoomlaExtensions` (ids 9–12,
  `EntryPointUrl` já prefixado) e 4 novas `MiniJoomlaModuleInstances`
  (ids 9–12, posições `hero`/`main-bottom`/`sidebar-left`/`sidebar-right`).
- FIORI-AUTO: recarga completa da página pública e inspeção de
  `[data-template-region]` confirmou as 4 posições com conteúdo
  (`textContent` não vazio) e sem `[role="alert"]` de erro de módulo.
- Inspeção de todos os `<a href>` resolvidos dentro das 4 novas posições
  confirmou resolução correta para `.../CAMAP-V3.aspx#/article/<alias>`
  ou `.../CAMAP-V3.aspx#/category/<alias>?layout=list` desde a primeira
  carga — nenhuma URL para a raiz do domínio.
- `node tests/run-tests.js`: 122 suítes passaram; 1 falha
  (`runner.test.js`, sobre `extension-migration-executor.test.js` não
  registrado) é pré-existente e não relacionada a este trabalho —
  arquivo untracked de uma frente distinta, já presente antes desta
  importação (`git status --short` confirma que nenhum arquivo de
  `CAMAP2` foi alterado por esta tarefa).
- Nenhuma escrita em `camap-agp`; nenhum arquivo-fonte de `CAMAP2`
  alterado (cópia byte a byte).

### Fora de escopo (não migrado)

- `mod_camap_home` (decisão do usuário).
- `mod_forum`, `mod_videoteca` (fora do filtro `mod_camap_*`).
- Qualquer correção de U1/S1, qualquer flag de direitos/adoção formal.

## Remapeamento de posições — Iteração 8 do template `camap-v3` (11/11/2026)

O redesenho estrutural do grid do template `camap-v3` (ver
`CAMAP-V3/minijoomla-template/docs/CAMAP-V3-TEMPLATE.md`, "Fechamento —
Iteração 8") removeu as posições `missao`/`gerencias`/`destaques`/
`agenda-avisos`/`links-uteis` e renomeou `sidebar-left`/`sidebar-right`
para `sidebar-left-top`/`sidebar-right-down` (como parte do novo grid
3×2: `sidebar-left-top`/`sidebar-right-top`/`sidebar-left-down`/
`sidebar-right-down`). As 8 instâncias de módulo `mod_camap_*` já
instaladas neste site de teste (seção acima) foram remapeadas via
`admin.moduleInstances.update(id, { position }, { etag })` — nenhum
`settingsJson` foi alterado, só o campo `position`:

| Módulo | Posição anterior | Nova posição |
| --- | --- | --- |
| `mod_camap_corpmessage` | `agenda-avisos` (removida) | `main-bottom` |
| `mod_camap_editorial` | `destaques` (removida) | `main-top` |
| `mod_camap_highlights` | `destaques` (removida) | `sidebar-right-top` |
| `mod_camap_topsections` | `links-uteis` (removida) | `footer` |
| `mod_camap_hero` | `hero` | `hero` (sem mudança) |
| `mod_camap_recursos` | `main-bottom` | `main-bottom` (sem mudança) |
| `mod_camap_showcase` | `sidebar-left` (renomeada) | `sidebar-left-top` |
| `mod_camap_documentation` | `sidebar-right` (renomeada) | `sidebar-right-down` |

Confirmado por FIORI-AUTO que as 8 instâncias renderizam nas novas
posições (não em fallback `sidebar` genérico). Nenhuma pendência desta
seção foi alterada por esse remapeamento — continua dado de teste, não
adoção formal no núcleo.

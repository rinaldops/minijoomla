# MINIJOOMLA — runbook da release MSE 0.1.0

## Publicação limpa rinaldops 0.4.x — 05/11/2026

Alvo: `https://rinaldops.sharepoint.com/sites/camap-agp`, instalação limpa;
releases imutáveis em `SiteAssets/minijoomla/releases/<versão>/`.

**Fluxo** (`scripts/deploy-sharepoint.mjs`): provisionar, montar o estágio, enviar
arquivos, contar arquivos no servidor, verificar SHA-256, MERGE do canvas com ETag
e Publish.

**Rollback:** restaurar o canvas a partir de `tmp/deploy/<versão>/rollback-*.html`
ou republicar apontando para o ponteiro de uma release anterior (imutável).

**Incidentes reais:**

1. `browser.evaluate` retorna `ok:true` com dados vazios quando a promise da
   página é rejeitada, o que gerou um relatório falso de "verificado". O script
   agora devolve falhas como dados e conta os arquivos no servidor.
2. O primeiro deploy falhou porque um placeholder foi substituído em um
   comentário e o real ficou sem substituir.

## Publicação 0.2.1 verificada — 03/11/2026

- Snapshot `39ec4b0` commitado/enviado; `b731dec` preexistente incluído conforme
  autorização. Pacote all novo `tmp/sol-publish-0.2.1-39ec4b0` + host separado
  `tmp/sol-host-0.2.1`; 106+6 arquivos enviados sem overwrite. SHA256/tamanho
  remoto dos 112: zero divergências, MIME JS/CSS/JSON/HTML apropriados.
- Manifesto SHA256 `379869bef9d2d212d5149870aae4515d82d15fe68c92402229342274b05c5e21`;
  host manifesto `c0f37692f8eadd4224b43fac03443e6db3879b4e72a5d48ba374fbe22b4e817c`.
- Páginas completas da seção de preparação abaixo publicadas por MERGE com
  ETag/guard e Publish HTTP 200. SharePoint normalizou HTML do canvas; igualdade
  canônica/decodificada comprovada, inclusive propriedades de outros webparts.
  Painel já concluído não foi regravado na retomada do site. Level=1 e sem
  checkout, versões de arquivo painel 9.0/site 20.0.
- Reload nativo: somente 0.2.1, site CAMAP com CSS carregados, painel institucional,
  sem alertas na raiz/chrome intacto. TinyMCE artigo 13 inicializado, três abas,
  Advanced com campos vertical/horizontal; artigo Joomla público com imagem
  carregada e sem data/blob. Conferências somente leitura, sem salvar conteúdo.
- CSS administrativo host conferido pelo parser CSS nativo (189 regras) e
  teste de elemento fora do escopo inalterado, incluindo `:is()`/media.
- Backup anterior `tmp/sol-publication-backup-0.2.1.json`, relatório
  `tmp/sol-final-release-report.json`; 0.2.0 preservada. Rollback preparado,
  não executado. Não houve alterações de schema/dados. Zoom real 200/400,
  forced-colors/movimento reduzido reais e equivalência visual integral ainda
  não são aceites concluídos.

## Preparação da rodada 0.2.1 — 03/11/2026

Usuário autorizou adequar cores e publicar site/painel com o editor atual.
Reinspeção autenticada confirmou 0.2.0 existente, 0.2.1 ausente, permissões
atuais e SiteConfig vazio. Não há provisionamento nem escrita de dados nesta
publicação. Escopo: pasta nova imutável
`https://petrobrasbr.sharepoint.com/teams/SAPScripting/SiteAssets/minijoomla/releases/0.2.1/`
e somente o webpart MINIJOOMLA nas páginas completas:

- `https://petrobrasbr.sharepoint.com/teams/SAPScripting/SitePages/Administrator.aspx`;
- `https://petrobrasbr.sharepoint.com/teams/SAPScripting/SitePages/MiniJoomla.aspx`.

Sequência: congelar/revalidar fontes → commit/push autorizados → staging all
fresco sob tmp → host 0.2.1 com CSS administrativo escopado (preservando vírgulas
internas de `:is()` e recursão media) → backup/inspect canvas → upload sem overwrite
→ SHA256/tamanho/MIME → MERGE com ETag e comparação contra backup → Publish
→ comparação de webparts/snippets decodificados e reload real. Não reutilizar
assets/loader/host de 0.2.0 ou sobrescrever seu pacote.

Rollback é preparado pelo par de canvases/host 0.2.0 preservados, não testado
destrutivamente. Toda restauração deverá comparar edição concorrente e usar
ETag vigente; não remover colunas/listas/assets. Aceites reais de zoom,
forced-colors e todos os formulários em tenant não são comprovados pela suíte
local; detalhes no handoff. Esta seção é preparação, não prova de publicação.

## Publicação 0.2.0 verificada — 03/11/2026

Snapshot `09300fa` explicitamente confirmado pelo usuário para site e painel,
sem aguardar outra entrega do editor. Inspeção autenticada em instância própria
FIORI-AUTO confirmou versões 0.1.0–0.1.4 existentes e ausência de 0.2.0.
Estágio novo `tmp/sol-publish-0.2.0-09300fa`: alvo `all`, 105 arquivos SHA256.
Host operacional separado sob `tmp/sol-host-0.2.0`, sem modificar o estágio
reproduzível, com manifesto próprio e imports exclusivamente da release 0.2.0.

Destino dos assets:
`https://petrobrasbr.sharepoint.com/teams/SAPScripting/SiteAssets/minijoomla/releases/0.2.0/`.
Páginas autorizadas: `https://petrobrasbr.sharepoint.com/teams/SAPScripting/SitePages/MiniJoomla.aspx`
e `https://petrobrasbr.sharepoint.com/teams/SAPScripting/SitePages/Administrator.aspx`.
Canvases anteriores guardados localmente em `tmp/sol-publication-backup.json`,
sem cookies/tokens. A troca usa MERGE com ETag vigente, preserva os demais
webparts e publica via API de arquivo; rollback restaura os canvases completos,
sem remover releases ou alterar listas.

Resultado: 106 arquivos do pacote (105 no manifesto + o próprio manifesto)
e 6 arquivos do host enviados sem sobrescrita; SHA256/tamanho verificados
remotamente para todos os 112 arquivos, zero divergências. JavaScript servido
como `application/javascript`, CSS como `text/css`; licença Markdown como
`application/octet-stream`, sem impacto no carregamento. Ambas as páginas
publicadas com HTTP 200. SharePoint normalizou a codificação HTML do canvas:
comparação decodificada confirmou `script`/`scriptCode` iguais aos snippets e
propriedades dos demais webparts preservadas.

Reload real FIORI-AUTO confirmou painel com “Painel de controle”, site CAMAP,
CSS nativos carregados, chrome SharePoint preservado, nenhuma mensagem de erro
na raiz e somente assets 0.2.0. Espera `networkidle` do site excedeu o timeout;
inspeção posterior confirmou montagem completa, sem atribuir o timeout a falha
de publicação. Lista SiteConfig estava vazia na leitura prévia; host mantém
CAMAP como default sem criar registro e passa todas as listas existentes à
composição pública para consumir configurações futuras. Transporte SPMIDDLE
usa webUrl server-relative por contrato, enquanto navegação/inspeção usa URLs
completas. Rollback preparado e backup preservado, mas não executado; zoom,
alto contraste e validação ampla de permissões continuam pendentes. Artigo
“Joomla” reaberto no público com imagem carregada e sem URI `data:`; formulário
do artigo 13 no painel abriu iframe TinyMCE inicializado, usando somente assets
0.2.0 e sem alertas. Nenhum artigo foi salvo/alterado para essas verificações.

**Versão:** `0.1.0`  
**Tipo:** distribuição de código-fonte ES modules  
**Estado:** publicação técnica real concluída e validada em 01/11/2026 na página de teste `PREVIEW_PAGE` (teste técnico controlado, não piloto com usuários reais nem conteúdo editorial real).  
**Última validação local:** 31/10/2026  
**SHA-256 do ZIP local:** `65D9AE0092192D1702FADAEA72F210E2B26CF30138538BD6BEBF4AFA34BC51CE`

## Conteúdo da release

A release inclui o código independente do MINIJOOMLA, seus testes, documentação e exemplo local. Não inclui `.git`, `node_modules`, credenciais, cookies, tokens ou dados editoriais corporativos.

Inclui:

- `package.json`, `README.md` e prompt do projeto;
- `src/`;
- `tests/`;
- `scripts/`;
- `examples/`;
- `docs/`;
- `theme/` e `host-adapters/` quando a integração MSE for necessária.

## Validação local obrigatória

Executar a partir da raiz do projeto:

```powershell
node tests/run-tests.js
node scripts/check-syntax.js
git diff --check
node scripts/release-check.js
```

Evidência desta preparação:

- suíte completa aprovada;
- contrato comum: 9 verificações aprovadas;
- adapter SPMIDDLE local: 24 verificações aprovadas;
- sintaxe: 20 arquivos JavaScript aprovados;
- `git diff --check`: sem erros.
- `node scripts/release-check.js`: estrutura, versão e configuração de release aprovados.

## Artefato local histórico

O ZIP e o hash acima são registros da preparação histórica 0.1.0, não um
procedimento atual. O antigo uso da pasta temporária global e sua remoção
recursiva foram substituídos: novos artefatos temporários devem ficar
exclusivamente em `MINIJOOMLA\tmp`, sem sobrescrever saídas existentes.
Para um pacote atual, siga a seção de estágio reproduzível abaixo. Um artefato
local não deve ser publicado sem confirmar destino e autorização aplicável.

## Configuração corporativa necessária

Confirmados em 31/10/2026 pelo usuário, para a frente de validação técnica
desta Parte 2 (site de teste técnico corporativo autorizado, não há página
de produção separada para o MINIJOOMLA hoje):

```text
WEB_URL=https://petrobrasbr.sharepoint.com/teams/SAPScripting
RELEASE_BASE=/teams/SAPScripting/SiteAssets/minijoomla/releases/0.1.0/
PREVIEW_PAGE=SitePages/MiniJoomla.aspx
PRODUCTION_PAGE=(não existe página de produção separada; PREVIEW_PAGE cumpre esse papel nesta frente)
```

Nota de contexto: `MiniJoomla.aspx` já estava publicado com uma cópia de
teste do MSE (não pertence ao projeto HH-web); o usuário autorizou
explicitamente a sobrescrita do `CanvasContent1` dessa página para esta
validação.

## Sequência autorizada de integração

1. Inspecionar o destino em modo somente leitura.
2. Confirmar schemas, allowlists, CSP, MIME, cache e permissões.
3. Executar `inspect → plan → apply → verify` somente para provisionamento aprovado.
4. Publicar a release em pasta imutável `MSE 0.1.0`.
5. Validar primeiro o `Preview.aspx`.
6. Validar leitura, erros, indisponibilidade e rollback.
7. Executar escrita controlada somente com contrato, CSRF, idempotência e concorrência definidos.
8. Avaliar a página de produção somente após o aceite integral do Preview.

## Rollback

- preservar a release anterior;
- alterar a composição para o artefato anterior ou para `FakeAdapter`;
- não sobrescrever pastas imutáveis;
- executar novamente testes locais e `git diff --check`;
- registrar a reversão sem coletar tokens, cookies ou dados pessoais.

## Pendências não mascaradas pela release local

- timeout, retry, cancelamento e tradução de erros remotos;
- schemas e allowlists específicos do ambiente corporativo;
- zoom 200%/400% e `forced-colors` efetivos;
- destino corporativo e páginas autorizadas;
- provisionamento, migração e publicação reais.

Nota (01/11/2026): leitura real (Marco C), escrita controlada e sintética
com ETag (Marco D) e a publicação de conteúdo/UI na própria página
(`PREVIEW_PAGE`) foram validadas contra o tenant real descrito acima — a
publicação usa as 4 listas de teste dedicadas (`TesteMiniJoomla*`), não
listas de produção, e passou por reload real + evidência visual em
320/768/1366/1920px. Três incidentes reais foram encontrados e corrigidos
durante a publicação (efeito colateral de módulo sobrescrevendo a página,
rota sem guarda contra categoria ausente, cache de CDN preso em revisão
antiga) — detalhes completos em `docs/INTEGRATION-SPMIDDLE.md` §9 e
`docs/CHECKLIST-CONCLUSAO-MINIJOOMLA.md` §6.2. Zoom 200/400% e
`forced-colors` continuam fora do escopo desta validação (lacuna de
ferramental documentada, não de implementação).

## Estágio reproduzível do código atual (03/11/2026)

Esta seção é aditiva: os comandos/artefatos acima registram a release
histórica 0.1.0, não o procedimento atual de empacotamento. Para preparar
uma nova distribuição **somente local**, a partir da raiz MINIJOOMLA:

```powershell
node scripts\stage-release.js --version 0.2.0 --output tmp\release-pipeline-local-0.2.0
node tests\release-stage.test.js
git diff --check
```

`0.2.0` é apenas versão de ensaio local, **não reserva nem indicação de
disponibilidade remota**. A leitura remota do coordenador confirmou que
0.1.0, 0.1.1, 0.1.2, 0.1.3 e 0.1.4 já existem. Nenhuma delas deve ser
sobrescrita. O comando não acessa rede, publica, commita ou altera fontes.
Exige destino novo estritamente sob `MINIJOOMLA\tmp`, rejeita sobrescrita,
versão inválida, links/junctions e dependências fora das raízes autorizadas.
Um `--output tmp\...` relativo sempre é resolvido a partir de MINIJOOMLA,
inclusive quando o comando é invocado da raiz VSTO; nunca cria `VSTO\tmp`.

O escopo padrão é `--target all`: pacote público/administrativo integral,
com validação estrita do editor. Para distribuição independente somente
da página pública:

```powershell
node scripts\stage-release.js --version 0.2.0 --target site --output tmp\release-pipeline-site-0.2.0
```

`site` parte exclusivamente de `src/index.js` e
`src/libraries/minijoomla/composition/mountMiniJoomlaSite.js`, seguindo seus imports locais,
CSS nativos declarados pelo runtime e recursos transitivos. Não lê/copia
`src/admin`, TinyMCE nem a composição administrativa; uma dependência
pública nesses módulos administrativos causa erro. Mantém SPMIDDLE
necessário ao site, snippet com placeholders, SHA256 e fechamento estrutural.
`manifest.json`/`entrypoints.json` declaram `target: "site"` e não expõem
entradas do painel/editor. Aprovar esse pacote **não** aprova nem publica o
administrador; não é fallback silencioso se o pacote `all` falhar.

O estágio contém `app/` com as fontes atuais, CSS transitivo de templates,
módulos nativos e TinyMCE local com licença/skins/plugins; os imports de
SPMIDDLE são reescritos para `vendor/spmiddle/`, com fechamento recursivo
dos arquivos locais referenciados. Inclui `sharepoint-files` para as
factories injetadas do painel. Não copia `examples`, configurações do host,
dados editoriais, scripts temporários ou releases antigas. Arquivos de
configuração/dados fora da allowlist de recursos da árvore `src` causam
erro, não inclusão silenciosa.
Os recursos calculados do editor também são conferidos: tema, modelo,
ícones, skins, plugins do preset e dependências conhecidas de emoticons/help
(incluindo o fallback inglês de navegação por teclado).

Confirmado no TinyMCE vendorizado 7.9.1: em
`src/media/vendor/tinymce/plugins/help/plugin.min.js`, a função `A(e,t)`
chama `tinymce.Resource.load` com `${e}/js/i18n/keynav/${t}.js`; `w(e)`
usa o idioma corrente e faz fallback para `en`. O plugin chama `w(t)`
no evento `init` e também aguarda `w(e)` ao montar a aba de navegação.
Portanto `plugins/help/js/i18n/keynav/en.js` é dependência real, não um
import inferido de comentário/string de documentação. Um teste executa o
plugin real em VM isolada, com loader falso, e observa os caminhos de
idioma/fallback sem navegador nem rede.
`help_accessibility: false` não elimina essa dependência: segundo a
[documentação oficial da versão 7](https://www.tiny.cloud/docs/tinymce/7/help/#help_accessibility),
essa opção somente oculta o atalho no status bar. O código de
`themes/silver/theme.min.js` confirma isso; o plugin help não consulta a
opção antes de carregar os recursos. Nenhuma configuração do editor é
alterada por este pipeline.

`manifest.json` registra versão, tamanho e SHA256 de **cada outro arquivo**
incluído, ordenados por caminho, sem timestamps nem caminhos da máquina.
O manifesto não contém hash de si próprio. Fontes idênticas produzem os
mesmos bytes, inclusive `entrypoints.json` e `loader.js`. O grafo final de
imports ES estáticos, reexports, imports dinâmicos literais, `new URL`
literal e recursos CSS é validado antes da escrita: nenhum caminho relativo
pode sair do estágio e nenhuma dependência pode faltar. Os CSS nativos
declarados no runtime também devem existir. Mudança de fonte durante a
leitura interrompe o estágio; aguardar a integração estabilizar e repetir
em destino novo.

### Host injection e prevenção de mistura de versões

Não reutilizar loaders/bootstraps de `tmp\release-stage`. A leitura real
do coordenador encontrou o público com loader/CSS 0.1.3 mas bootstrap e
JavaScript 0.1.0; o administrador ainda carregava assets 0.1.0. O novo
`loader.js` é gerado do zero, importa apenas `./app/...` da própria árvore
e rejeita referências hardcoded `releases/X.Y.Z/` no JavaScript empacotado.
Não injeta bootstrap de uma versão anterior nem cria bootstrap com dados
corporativos.

O host importa o **novo** `loader.js` e chama
`loadRelease({ start: ({ version, releaseBase, modules }) => ... })`.
`modules` expõe os namespaces público, composição do site, composição
SharePoint, montagem independente, painel e composição administrativa disponíveis.
O callback é obrigatório: injeta DOM, `webUrl`, listas e factories de
transporte/arquivos a partir da configuração operacional, não do pacote.
Resolver CSS/admin/TinyMCE contra **esse mesmo** `releaseBase`; os caminhos
de entrada e do editor estão em `entrypoints.json`. O runtime público
resolve seus CSS nativos contra `import.meta.url`. Manter o par
loader/configuração do host coerente e imutável; rollback troca esse par
inteiro, nunca somente CSS.

Como alternativa pública pronta para o MSE, o estágio inclui a cópia
inalterada de `host-adapters/modern-script-editor/site-snippet.html`,
exclusivamente com placeholders. Preenchê-los no host autorizado, não nas
fontes nem no estágio reprodutível. O snippet importa
`__RELEASE_BASE__/app/composition/mountMiniJoomlaSite.js`, que monta o site
no contêiner dedicado sem substituir o `body` do SharePoint. Não serve
para o painel administrativo.

Extensões/plugins/templates externos descobertos em listas e URLs
calculadas/injetadas pelo host não são dados de build e não são copiados:
precisam de distribuição imutável e validação próprias. Apenas os dois
pontos nativos de `import(url)` para essa injeção são aceitos; outros
imports calculados não verificáveis causam erro. Esta validação é
estrutural/offline, não certifica MIME, CSP, cache, permissões nem montagem
visual/autenticação no tenant. A escolha de versão/destino e qualquer
publicação continuam operações separadas e autorizadas.

# Administração de extensões, módulos e templates

## Estado da integração — 03/11/2026 (atualizado nesta sessão)

Além do núcleo descrito abaixo, a frente local acrescentou `#/plugins`,
`#/templates/styles`, `#/templates/positions`, `#/options` e `#/installer`,
e ampliou as telas de módulos e configuração. Nesta sessão, as lacunas de
integração runtime abaixo (P0 do
[plano de continuidade](PLANO-CONTINUIDADE-MINIJOOMLA.md), seção 1) foram
fechadas com testes locais (`node:assert/strict`, sem DOM real) — **ainda
falta revalidação em navegador real via FIORI-AUTO e publicação autorizada**
antes de declarar prontidão para produção.

| Capacidade | Estado comprovado | Pendência |
| --- | --- | --- |
| Ativar/desativar instância ou extensão; posição, ordem, settings e escopo legado | Consumidos pelo runtime e cobertos pela suíte local | Revalidar a interface final em DOM real |
| Atribuição `all`/`none`/`only`/`except`, janelas de publicação, lixeira e título/classes de módulo | **Integrado ao runtime público** (`resolveModuleEntries`, `src/libraries/minijoomla/modules/dynamic-modules.js`): `assignment`/`assignmentJson` tem prioridade sobre o escopo legado quando declarado; `trashed`/`publishUp`/`publishDown` excluem a instância; `showTitle`/`moduleClass`/`headerTag`/`headerClass` chegam à apresentação (`src/libraries/minijoomla/modules/registry.js`, `src/libraries/minijoomla/modules/content-runtime.js`), com allowlist de tag segura. Testes em `tests/module-runtime.test.js` | Revalidar em DOM real via FIORI-AUTO |
| Grupo, ordem e parâmetros de plugin | **Integrado**: `ensurePluginsRegistered` (`src/libraries/minijoomla/modules/dynamic-modules.js`) agora importa concorrentemente mas REGISTRA sequencialmente, ordenado por `extension.ordering` (desempate por `key`), e propaga `paramsJson` como `context.params` em todo handler (`src/libraries/minijoomla/plugins/manager.js`). Testes em `tests/module-runtime.test.js` | Revalidar em DOM real via FIORI-AUTO |
| Estilos salvos e parâmetros por componente | **Integrado**: `toSiteConfigOverrides` extraído para `src/libraries/minijoomla/application/site-config-overrides.js` e agora usado também pela composição pública (`createMiniJoomlaSiteApplication.js`), não só pelo painel; Cassiopeia reaproveita `TEMPLATE_PARAM_DEFINITIONS` real (`logoFile`/`brand` select); CAMAP ganhou `CAMAP_PARAM_DEFINITIONS` alinhada a `resolveCamapParams` (sem a opção inválida `gray`). Opções por componente (`content`/`search`, inclusive `highlightTerms` com destaque seguro baseado em texto plano) aplicadas a `renderArticle`/`renderArticleList`/`renderSearch` em `components/com_content/tmpl/article/default.js` e `components/com_finder/tmpl/search/default.js`. Testes em `tests/site-config-overrides.test.js`, `tests/component-options-runtime.test.js` | `bandTones` do CAMAP e `listLimit`/`orderBy` ficam fora do formulário simples/do componente de apresentação — documentados como lacuna conhecida; revalidar em DOM real |
| Home por categoria/destaques | Consumida pelo serviço público e coberta por testes | Verificar persistência real após a migração de schema |
| Offline (gate real) | **Integrado**: `siteConfig.offline === true` substitui o conteúdo principal por uma mensagem de manutenção (`offlineMessage`) em qualquer rota, preservando menus/módulos/template ao redor — mesmo padrão de `LOAD_ERROR` (`src/index.js`). Testes em `tests/offline-gate.test.js` | Metadados globais (SEO/robots/sitenamePagetitles/título/idioma do host) continuam deliberadamente fora de escopo — decisão de contrato de host pendente |
| Registro por manifesto | Validação e registro inicialmente desabilitado em testes locais | Validar origem, efeitos e implantação; não é upload ou instalador de pacotes |

O helper de overrides de configuração (antes `toSiteConfigOverrides` dentro
de `admin-service.js`) agora vive em `src/libraries/minijoomla/application/site-config-overrides.js`
e é importado tanto pelo painel quanto pela composição pública — eliminando
a divergência anterior em que só o painel calculava `templateParams`/
`templateStyleId`/`componentParams`. O Cassiopeia não declara mais
`CASSIOPEIA_PARAMS` próprios em `template-styles.js`; reutiliza
`TEMPLATE_PARAM_DEFINITIONS` de `src/templates/cassiopeia/index.js` (fonte única).
O CAMAP ganhou `CAMAP_PARAM_DEFINITIONS` em `src/templates/camap/index.js`,
alinhada à paleta real `ACCENTS` (sem `gray`) e aos parâmetros reais
consumidos por `resolveCamapParams` (`heroKicker`, `heroActionLabel`,
`heroActionUrl`, `pairSections`); `bandTones` (objeto por posição) fica
fora do formulário simples, documentado no próprio código.

**Correção P0 após a auditoria:** leituras e escritas administrativas de
`componentParamsJson` e `templateStylesJson` agora validam os dados persistidos
antes de mesclar opções ou materializar estilos virtuais. JSON malformado,
shape incorreto ou entradas inválidas geram `ValidationError`, preservando o
registro completo e o ETag. As páginas afetadas mostram alerta seguro sem
formulário de padrões nem ações destrutivas. Campo ausente, `null` JavaScript
e string vazia continuam aceitos para registros legados. Regressões de serviços
e aplicação com DOM simulado em `tests/admin-extensions-service.test.js` e
`tests/admin-extensions-app.test.js`. `tests/admin-errors-dom.test.js` executado
por FIORI-AUTO próprio: alertas/bloqueios de mutação em DOM nativo local,
armazenamento sintético intacto. Não é teste de corrupção no tenant.

Falhas SiteConfig não mais inventam template default nas posições de módulo;
falhas do catálogo de estilos não são ignoradas na visualização de posições.
Novas páginas mostram alerta genérico sem backend ou controles de fallback.
Após ação seguida de falha na recarga, a mensagem orienta verificar o registro
antes de repetir, sem negar uma escrita já concluída. Configuração ausente
continua válida; recuperação após restabelecer leitura coberta na mesma app.

O runtime público ainda tem parsing tolerante e outros pontos de carregamento
convertem falhas em padrões/listas vazias; não considerar a revisão geral de
erros encerrada. O
[plano de continuidade](PLANO-CONTINUIDADE-MINIJOOMLA.md) contém a sequência
de integração, compatibilidade e aceite.

**Plugins — integridade administrativa:** `manifestJson` parcial e `paramsJson`
agora passam por parsing estrito; definições e valores inválidos não viram lista
vazia/defaults. list/get/update/lote rejeitam antes da escrita. Campos legados
ausentes/null JavaScript/vazios continuam aceitos. Salvar preserva desconhecidos
já persistidos, filtrando desconhecidos novos; estado/ordem sem params preservam
JSON exato. Lote só altera IDs de plugins. Testes de serviço, DOM simulado e
`runAdminErrorsDomTests(document)` nativo local aprovados, incluindo submit real
com preservação de configuração avançada. CRUD genérico de extensions e runtime
público continuam fora desse endurecimento específico.

## Núcleo anterior e contratos locais

O painel distingue **extensões registradas** (`Module`/`Plugin`), **instâncias de
módulo** e o catálogo separado de **templates**. `/components` descreve os
componentes nativos e suas rotas administrativas; não instala componentes.
As telas devem distinguir capacidades disponíveis das ainda não integradas.

- `/extensions`: busca por título, filtros por tipo e estado, ativação e
  desativação persistidas. `/extensions?type=Plugin` é o acesso direto a plugins.
- `/moduleInstances`: filtro por estado/posição, instâncias com módulo nativo ou
  registrado, posição, ordem inteira, configuração JSON e atribuição por
  rota/categoria. Plugins não aparecem no seletor de módulo.
- `/templates`: catálogo, estado e ação **Tornar padrão**, persistindo
  `siteConfig.templateKey`. O padrão atual não pode ser desabilitado/excluído:
  selecione outro primeiro.
- `/config`: seletor dos templates integrados `default`, `cassiopeia`, `camap`
  e dos templates externos habilitados. Integrados não exigem registro no catálogo.
  `templates.available` informa se o repositório foi configurado; quando não foi,
  a configuração ainda permite selecionar/persistir os três integrados e as
  rotas do catálogo mostram indisponibilidade explícita. Erros de um repositório
  configurado não são convertidos em ausência silenciosa.
- Descoberta em `/extensions/discover` e `/templates/discover`: lê manifestos já
  publicados; registro exige confirmação de origem confiável. Não envia arquivos,
  extrai pacotes ou oferece formulário para instalar código arbitrário.

Chave, tipo e entrypoint são identidade do manifesto: exibidos sem edição, com
validação equivalente no serviço. Remover o registro de um módulo exige antes
remover/reatribuir suas instâncias; não apaga arquivos publicados.
Plugins têm estado, metadados e parâmetros persistíveis na nova tela, mas os
parâmetros e a ordem ainda não afetam o pipeline público. Não há ACL, usuários
ou edição de arquivos de template.

## Contratos de dados

Os schemas locais de extensões, instâncias de módulos e configuração foram
ampliados para `schemaVersion: 2`; as colunas correspondentes não foram
provisionadas nem verificadas remotamente nesta frente. Valores padrão omitidos
em algumas gravações não garantem compatibilidade integral com listas antigas.
`extensions.type` continua limitado a `Module`/`Plugin`; templates usam
exclusivamente `MiniJoomlaTemplates`.

`admin.siteConfig.get()` devolve a **linha crua** com `id` e `etag`. Localiza a
linha por `findMany` e relê por seu ID real; não presume ID 1.
`siteConfig.toConfigOverrides(record)` converte `customHtmlTitle/Body` para
`customHtml`. A chave de template é mantida em `templateKey`.

`admin.templates.setDefault(id, { etag, configEtag })` exige o ETag do template
capturado na tela e, havendo configuração, seu ETag capturado. Atualiza somente
`templateKey`, preservando os demais campos. Sem configuração, cria a linha
singleton pela convenção já existente.

`settings` das instâncias é um objeto JSON serializável, persistido em
`settingsJson`; arrays, números não finitos e JSON malformado são rejeitados.
Exemplos: `{"limit":3}` para `articles-latest`,
`{"limit":3,"category":"noticias"}` para `articles-category` e
`{"title":"Aviso","html":"<p>Texto</p>"}` para `custom-html`.
O módulo nativo `search` também está disponível no seletor e aceita instâncias
na posição `search`, sem precisar de registro em extensões.
Escopo `Route` exige rota; alias de categoria somente se aplica à rota `category`.
Escopo `All` exige limpar rota e categoria.

Posições de módulo: `topbar`, `below-top`, `menu`, `search`, `banner`,
`breadcrumbs`, `top-a`, `top-b`, `main-top`, `sidebar-left`, `sidebar-right`,
`main-bottom`, `bottom-a`, `bottom-b`, `footer`, além dos aliases legados
`content` e `sidebar`. `component` pertence ao template, não é uma posição de
instância de módulo.

Templates persistem `positionsJson` como array JSON de posições suportadas e
`styles` como array JSON de URLs; o formato legado de uma URL CSS é aceito e
normalizado ao salvar. CSS aceita caminhos relativos ou qualquer origem
HTTPS, nunca `javascript:`, `data:`, URLs com credenciais ou caminhos com
backslashes. Entrypoints (código executável de Module/Plugin/Template) são
mais restritos: só caminho relativo do próprio site, nunca outra origem —
corrigido nesta rodada para que `admin-service.js` (create/update direto) e
a descoberta por pasta (`extension-discovery-service.js`) usem a mesma
regra já aplicada pelo instalador manual (`sameSiteModuleUrl`, antes só em
`parseExtensionManifest`); um entrypoint de outra origem seria código
externo arbitrário `import()`ado no navegador do visitante/administrador.
Descoberta valida esses contratos antes de oferecer registro, sem importar
ou executar os arquivos.

## Concorrência e limites

ETags de `findMany` não devem ser presumidos confiáveis em todas as respostas
SPMIDDLE. As listagens relêem registros visíveis por `findById` e as ações
devem usar esses snapshots, nunca um token recém-obtido para sobrescrever
alterações alheias. ETag curinga `*` é rejeitado. Revalidar mensagens de erro,
paginação e proteção contra cliques repetidos em todas as novas telas.

Não existe transação entre as listas de templates e configuração. As verificações
de referências e padrão reduzem inconsistências, mas não prometem atomicidade
entre listas nem unicidade sob criações simultâneas; isso requer garantia do
backend. A mudança é percebida quando a composição pública relê a configuração
ou é reiniciada; o painel não promete aplicação em tempo real em outras abas.

## Referência e validação

Estrutura comparada com os formulários locais originais Joomla de `com_modules`,
`com_plugins` e `com_templates`: estado, instâncias/posição/ordem, configurações e
distinção do estilo padrão. A implementação JavaScript/HTML/CSS é própria; não
copia código nem ativos do Joomla. Recursos sem backend correspondente foram
deliberadamente excluídos.

`tests/admin-management.test.js` cobre persistência, ETags obsoletos, padrão,
validação, filtros hash, módulos nativos e componentes. Os testes
`admin-extensions-service.test.js` e `admin-extensions-app.test.js` cobrem os
serviços novos e formulários em DOM simulado; ambos estão registrados em
`tests/run-tests.js`. Eles não comprovam que os parâmetros persistidos alteram
o runtime público ou que as novas telas funcionam em navegador real.

`tests/admin-management-dom.test.js` exporta `runAdminManagementDomTests(document)`
para execução no navegador autorizado via FIORI-AUTO. Usa elementos DOM nativos,
`HTMLElement.click()`, `{body: root}` e os repositórios demonstrativos reais com
armazenamento sintético isolado, sem alterar o `localStorage` da página. Aguarda
persistência e rerender assíncronos. O atributo
`data-admin-managed-bound="true"` identifica ações cujo listener já foi instalado.
Este teste não é executado pelo runner Node sem DOM.

O executor corporativo foi invocado por `hub_agents.run_agent` com `ToolPolicy`
de escrita restrita ao serviço, consentimento contextual e validação do destino
HTTPS `api.petrobras.com.br` em PROD. Retornou `runtime_unavailable`, sem chamadas
ao modelo, por ausência de `openai-agents` no runtime solicitado. O restore
via feed JFrog falhou porque o CA bundle corporativo configurado não existe.
Não foram alterados TLS, proxy, certificados, `.env` ou configuração do Hub.
O revisor somente leitura também foi invocado com modelo alternado permitido,
retornando o mesmo bloqueio e zero chamadas. A primeira implementação foi
testada localmente; a expansão posterior permanece parcial, conforme a matriz
acima. Revisão pelo modelo corporativo e validação autenticada das novas
alterações no SharePoint permanecem pendentes.

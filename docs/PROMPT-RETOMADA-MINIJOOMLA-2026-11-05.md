# Retomada do MINIJOOMLA — 05/11/2026

## Escopo e regras para retomar após reiniciar

- Trabalhar na worktree principal `C:\PROJETOS\VSTO\web-devs`, branch `main`;
  projeto `MINIJOOMLA/`. A antiga restrição à worktree02 foi substituída pelo
  merge autorizado `d927a3f`. Worktrees 01/02 removidas posteriormente a pedido
  expresso do usuário, após conferência e preservação dos resíduos (ver abaixo).
- Ler primeiro `C:\PROJETOS\VSTO\AGENTS.md`, `CLAUDE.md`, `AI_CONTEXT.md`, as
  instruções da worktree e `MINIJOOMLA/PROMPT-DESENVOLVIMENTO-MINIJOOMLA.md`.
- Objetivo: recriar conceitos, estrutura e comportamento Joomla em JavaScript
  sobre SharePoint, sem ACL. Referência somente leitura: `web-devs/JOOMLA`;
  não copiar implementação PHP ou ativos.
- Branches `worktree/web-devs-01` (`be6cc46`) e `worktree/web-devs-02` (`d927a3f`)
  foram preservadas como snapshots, ambas contidas em main; as pastas não existem
  mais. Não excluir branches nem recriar worktrees automaticamente. Usuário
  autorizou testes/commit/push/merge em main, não inclusão de alterações CAMAP2
  alheias nem publicação de nova release por inferência.
- A outra frente `origin/feat/camap-modules-minijoomla` tem alterações não
  integradas (module-styles/CAMAP). Avaliar com o usuário no merge final.
- Ambiente fora da Petrobras: sem VPN/hub-ai/JFrog, usar registries públicos.
- Priorizar agentes econômicos: usuário liberou GPT-6 Luna/low e também
  Claude Haiku/Sonnet 5 pessoais. Descobrir IDs reais no catálogo; nunca usar
  hub corporativo ou alegar que um modelo foi usado quando não estava disponível.
  As duas delegações desta retomada usaram `openai/gpt-6-luna#low` e concluíram.
  Quotas anteriores eram limites da conta, não ausência do modelo.
- Usuário já autorizou retomar após o reboot. Continuar
  Desenvolvimento > Revisão > Testes > Análise, sem prometer paridade
  integral ou aceites não executados.
### Integração das frentes (worktrees 01/02/03)

- `worktree/web-devs-01` já era ancestral de `main`. A frente XML foi mergeada
  em `main` (`f105ae9`) com a publicação 0.6.0 registrada. Esta frente mergeou
  `origin/main` e resolveu os dois conflitos: `README.md` (texto da 0.6.0
  mantido) e `app.js`.
- Resolução de `app.js`: ficou a **estrutura extraída** (`com_config`,
  `com_installer`, `com_templates`) e as **funcionalidades XML** da outra frente
  foram portadas para dentro de `com_installer/src/Controller/discover.js` e
  `tmpl/discover/default.js` — `scanReport`, `report.issues`/`complete`,
  rótulos Atualizar/Reverter versão, linha de versão/origem e as chamadas
  `installer.install/upgrade/rollback` com o ETag capturado na renderização.
  Preservados os guards desta frente: snapshot da descoberta (nunca o dataset
  do DOM) e bloqueio de callbacks de tela abandonada.
- Evidências: `tmp/compare-admin-discovery-xml-html.mjs` (9 cenários idênticos
  ao `origin/main`), `tests/admin-discovery-registration.test.js`
  (`xmlCandidateTests`: install/upgrade/rollback, instalador ausente sem
  escrita, busca interrompida), 65 suítes/0 falhas, 227 JS, contributor 287.
- A partir daqui o trabalho segue na worktree principal, em `main`.

### Retirada autorizada das worktrees 01/02

- Confirmados os dois HEADs como ancestrais de origin/main e worktree01 limpa,
  sem arquivos ignorados locais; seis diretórios de gitlinks estavam vazios.
  A revisão histórica tinha mapping JOOMLA incompleto em .gitmodules. O Git
  recusou remoção normal por haver submódulos; `worktree remove --force` foi usado
  somente após essas verificações e autorização explícita do usuário.
- Worktree02 já estava inválida para o Git (sem .git local), mas continha 318
  arquivos de projeto mais tmp. Nenhum path de fonte faltava na principal;
  140 eram iguais e 178 diferentes, compatíveis com a cópia histórica.
  Todo o diretório residual foi movido dentro do mesmo volume, sem descartar
  arquivos, para `MINIJOOMLA/tmp/worktree-retirement/20261105-231148/worktree02-residual/`.
  Conferência posterior: 318 fontes, 4.930.148 bytes e tmp preservado.
- Windows bloqueava a movimentação por três Edge órfãos de testes locais
  admin-layout. Confirmados perfis exatos, agente-pai ausente e relatórios de
  execução já falhada/zero larguras. Encerradas somente essas três árvores;
  sessões pessoais/corporativas não foram controladas.
- Cadastro obsoleto da 02 removido por prune, após dry-run que apontou somente
  essa entrada. `git worktree list` agora mostra apenas main. As duas branches
  locais/remotas não foram excluídas. Evidências ignoradas: audit-before-removal.json
  e orphan-layout-cleanup.json em `tmp/worktree-retirement/20261105-231148/`.
- O arquivo preservado contém tmp/perfis e não deve ser versionado, publicado,
  copiado para outra pessoa nem tratado como distribuição. O encerramento dos
  processos não comprova correção do runner nativo ou aceite de layout.

### Fechamento reduzido — navegação e callbacks administrativos

- Esta rodada estabiliza os recursos existentes; não inicia componentes Joomla
  ausentes nem refatorações novas de arquitetura para buscar paridade integral.
  O corte de escopo não transforma testes locais em aceite do produto inteiro.
- App passa a criar os coordenadores de conteúdo/extensões por render com
  `isCurrent` ligado ao navigationId. Chamadores diretos mantêm compatibilidade
  por default `() => true`; o host real sempre fornece o guard por navegação.
- Guards na admissão de formulário/ações/filtros/select-all e antes dos efeitos
  de status/navegação: callbacks de tela abandonada ou após stop não iniciam
  novas gravações e respostas tardias não recarregam nem notificam outra tela.
  Gestão genérica de extensões/templates e upload do editor também recebem a
  mesma proteção. ETags continuam sendo os capturados, sem releitura oportunista.
- Revalidar após confirmar exclusão e após ler arrayBuffer, antes de iniciar
  upload. Requisição já iniciada pode concluir; não há cancelamento/rollback
  implícito nem trava entre sessões. A seleção e a conversão legada continuam
  funcionando enquanto a tela é atual. Guard de duplo submit permanece.
- Testes ampliados nas três suítes existentes: admin-extension-forms-view,
  admin-joomla-content e admin-management. Integração usa app real com doubles
  locais; inclui navigate/stop, promessa de escrita resolvida/rejeitada, falha
  parcial em lote, file-read e confirmação. Não são cliques nativos nem tenant.
- Contraprova `tmp/check-obsolete-page-baseline.mjs`: app de `5a0b3d2` inicia uma
  gravação pelo form antigo após navegar; app corrigido inicia zero no mesmo
  cenário. Revisão independente sem regressão demonstrável; três focais passaram.
- Regressão completa: 72 passed/0 skipped/0 failed, sintaxe de 244 JS; inventário
  contributor permanece 304 arquivos. HTML idêntico em 19 cenários ao checkpoint
  `d927a3f`. Logs: `tmp/final-lifecycle-tests.log`, `tmp/final-lifecycle-release.log`
  e `tmp/final-lifecycle-contributor.log`. Sem nova publicação; versão documentada
  permanece 0.6.0, não revalidada nesta rodada.

- **Histórico de coordenação, antes do merge:** outra equipe estava executando
  `docs/PLANO-COMPATIBILIDADE-EXTENSOES-JOOMLA.md` em nova worktree. Não modificar
  descoberta/instalação, parser/manifestos, runtime/assets de extensões,
  transporte SPMIDDLE, composição/host ou seus schemas nesta frente sem
  sinalizar previamente ao usuário para coordenação. Congelar também alterações
  profundas de `app.js`, staging e registro compartilhado de testes. O commit
  local `123bfab` já extraiu os controllers de descoberta antes desse aviso;
  foi sinalizado ao usuário como checkpoint a considerar na integração.

## Estado vigente confirmado

- Publicação mais recente documentada: **0.6.0**, runtime `e869f3c`, 202 arquivos,
  pacote piloto XML corpmessage 0.1.1 pronto para Registrar. Ler
  `PUBLICACAO-JOOMLA-XML-0.6.0.md` antes de qualquer nova operação remota. As
  integrações de `main` posteriores àquela fonte ainda não estão no tenant.
- Checkpoint anterior desta frente: `808bdd5` (listagens de módulos/plugins/
  estilos/posições), já enviado a main. O bloco de 0.5.1 abaixo é histórico.
- Commit-base: `9feebf9` (`refactor(tree): mover fontes e release para a arvore Joomla`).
- Checkpoint pré-reboot: `bc86676` (layouts compartilhados, editor e save hooks).
- Fonte publicada atual: `32435a8` (manifestos nativos e diagnóstico do runner),
  enviada a `origin/worktree/web-devs-02` com autorização explícita do usuário.
- Release ativa **0.5.1** nas duas páginas autorizadas: 187 arquivos enviados,
  releitura independente dos 187 SHA-256 com zero divergências, JS/CSS com MIME
  correto. Manifesto de estágio declara 183; mais manifest.json e três arquivos
  host totalizam 187. Sem mudança de esquema (`--skip-provision`).
- Smoke final no host: público/painel/editor de artigo TinyMCE montados, raiz
  única, loader 0.5.1 efetivo e zero falhas HTTP de recursos da release detectadas.
  REST confirmou ambas publicadas (Level=1), canvas com loader 0.5.1 e sem loader
  0.5.0. Sem gravação editorial, teste de concorrência ou aceite nativo/assistivo.
- Incidente transitório: primeiro reload público recebeu 503 em
  `libraries/minijoomla/application/template-styles.js`. Recarga eliminou falha;
  smoke final das três rotas passou. `networkidle` também excedeu espera com
  navegação já concluída; preferir `domcontentloaded` mais espera da raiz.
- Evidências locais: `tmp/deploy-0.5.1.log`,
  `tmp/deploy/0.5.1/independent-verification.json`, `smoke-first-attempt.json`,
  `smoke.json`, `rollback-MiniJoomla.aspx.html` e `rollback-Administrator.aspx.html`.
  Rollback é canvas anterior; reler ETag/canvas atuais e restaurar somente o MSE
  desejado com MERGE específico e Publish. Nunca sobrescrever assets 0.5.0/0.5.1.
- Instância de publicação própria: RPC 47175/debug 9225, perfil ignorado
  `MINIJOOMLA/tmp/publish-0.5.1-profile`. Não copiar/versionar perfil nem sessão.
  O perfil habitual rinaldops/RPC 47173 estava ocupado e não foi controlado.
- Release **0.5.0** publicada por `rinaldops` em duas páginas, com 180 arquivos
  e hashes verificados duas vezes. No host foi feito smoke test de carregamento;
  não houve E2E de escrita nessa publicação.
- O commit moveu fontes e release para a árvore de topo Joomla (`libraries/`,
  `administrator/`, `components/`, `media/`, `modules/`, `plugins/`, `templates/`),
  removendo o prefixo `app/`. Isso **não** concluiu a separação administrativa
  por `com_*`: o painel ainda está concentrado em
  `administrator/components/com_minijoomla/`.
- Baseline publicado: 53 suítes, 188 arquivos verificados por sintaxe,
  244 arquivos totais na seleção contributor (não são todos JS).
- Rodada local após 0.5.0: seis layouts compartilhados em
  `src/layouts/joomla/content/{tags,info_block,links,intro_image,full_image}.js`
  e `src/layouts/joomla/pagination/links.js`, com APIs/HTML preservados.
- Editor administrativo de artigo agora em
  `src/administrator/components/com_content/tmpl/article/edit.js`; antigo
  `com_minijoomla/render-article-form.js` reexporta a função para compatibilidade.
  Demais páginas administrativas ainda precisam de separação por componente.
- Hooks de gravação ligados ao CRUD real de artigos por **injeção opt-in** de
  `pluginManager` em `createAdminService(repositories, { pluginManager })` ou
  `createMiniJoomlaAdminApp({ pluginManager, ... })`. beforeSave recebe valores
  normalizados, pode transformar/vetar, e a saída é validada novamente. Abrange
  criar/editar/duplicar/lote, preservando ETag capturado. afterSave é observacional
  e recebe cópia com ETag, sem mascarar gravação concluída.
- O host publicado NÃO injeta gerenciador administrativo de plugins. Não há
  carregamento automático de plugins persistidos neste incremento; o runtime
  público e suas linhas `native:<key>` permanecem independentes.
- Estágio `all` local validado nesta rodada: 183 arquivos, fechamento de imports,
  hashes determinísticos e smoke do loader. Não é publicação remota.
- Retomada pós-reboot: `npm test` **55 passed, 0 skipped, 0 failed**;
  `npm run check` **197 JS**; workflow contributor **254 arquivos**, execução
  isolada **46 passed, 9 skipped, 0 failed** (skips só sem o irmão SPMIDDLE).
  Logs: `tmp/resume-final-tests.log` (inclui estágio/contributor) e
  `tmp/resume-current-contributor.log` (execução dedicada anterior).
- Geração dos 15 manifestos XML de módulos nativos em
  `scripts/module-manifests.js`, baseada em `NATIVE_MODULE_PACKAGES` no catálogo.
  O estágio gera antes dos hashes para `all`/`site`/`core`, somente para módulos
  incluídos no grafo. `custom-html` continua a chave persistida de `mod_custom`;
  menu/breadcrumbs não foram acrescentados à seleção administrativa de tipos.
  Os XML fonte são descritores de compatibilidade, não autoridade da release.
  Fonte dos demais manifestos e contrato de terceiros permanecem inalterados.
- Estágios verificados: `core` 114 arquivos, `site` 116 e `all` 183. Os 15 XML
  gerados no core também foram lidos por parser XML independente da stdlib Python
  em `tmp/resume-manifest-xml-preflight` (somente local, não reserva de versão).
- Revisões independentes GPT de hooks/layouts e da geração de manifestos não
  encontraram defeitos demonstráveis no escopo focalizado. A execução completa
  dos testes foi feita pelo coordenador; o timeout do revisor não é aprovação.
- Runner local melhorado: rejeições de `browser.evaluate` capturadas na página,
  categorias sanitizadas e cleanup por etapa. `powershell.exe` existe, mas não
  estava no PATH do processo; agora usa caminho absoluto em SystemRoot, assim
  como taskkill. Não instalar/recompilar nada para resolver esse erro.
- Execução nativa pós-correção bloqueou em **ownership-or-process**, antes dos
  testes: perfil próprio encontrado (16 processos), raiz filha do agente
  confirmada, porém zero listeners devolvidos pelo inventário do Windows.
  Contraprova com `net.createServer` em loopback também teve zero resultados em
  Get-NetTCPConnection e netstat enquanto `server.listening` era true. Causa da
  divergência não confirmada; não enfraquecer o gate de posse para contorná-la.
  `tmp/admin-layout-xZaA95/report.json`: zero larguras executadas, cleanup dos
  processos próprios aprovado. Não declarar aceite nativo, visual ou assistivo.
  O `cleanupFailed` histórico não foi reproduzido no mesmo fluxo até o fim;
  as novas etapas apenas tornam o próximo diagnóstico verificável.
- A 0.5.0 teve somente validação de carregamento no host, não prova de escrita
  editorial end-to-end.

## Lacunas e limites a manter explícitos

### Checkpoint local `ae59d51` — separação administrativa

- `com_content/src/Model/article.js` concentra composição do leia-mais,
  conversão de datas locais e patch de opções/imagens/links, preservando chaves
  desconhecidas e datas inalteradas (inclusive segundos/milissegundos). Data
  inválida editada recebe ValidationError contextual; ETag continua no chamador.
- Tabelas reais em `com_content/tmpl/articles/default.js` e
  `com_media/tmpl/media/default.js`. `content-pages.js` mantém consulta, ações e
  captura dos ETags, usando os novos renderizadores sem mudar HTML/seletores.
- `com_menus/src/Model/menu-item.js` concentra tipos, parsing/composição de path,
  valores de formulário e preservação exata de paths customizados. O antigo
  `com_minijoomla/menu-types.js` é reexport da API existente.
- Três suítes novas e regressão de ação concorrente na tabela: **58 passed,
  0 skipped, 0 failed**; sintaxe de **204 JS**. Contributor **261 arquivos**,
  execução isolada confirmada **49 passed/9 skipped/0 failed**, ver log dedicado.
- Comparação offline de HTML com fonte publicada `1965790` passou **12 casos**
  de artigos/categorias/tags/mídia e filtros; helper
  `tmp/compare-admin-component-html.mjs`. Modelos/views passaram em UTC,
  America/Sao_Paulo e Asia/Tokyo; teste de data não depende do fuso do autor.
- Revisão independente GPT não encontrou erros demonstráveis nos arquivos
  alterados. Detector mecânico das duas views não reportou achados, mas isso
  não é aceite nativo, visual ou assistivo. Sem execução de navegador/tenant
  nesta rodada; **0.5.1 permanece ativa**.
- Logs: `tmp/admin-split-tests.log`, `tmp/admin-split-release.log` e
  `tmp/admin-split-contributor.log`. Estágios locais: core **117**, site **116**,
  all **187 arquivos declarados** (não são os 187 uploads da release 0.5.1).
- Continuar extraindo responsabilidades efetivas, não criar arquivos vazios ou
  wrappers para simular paridade. Roteamento, bindings, schemas de formulário e
  várias telas ainda estão em `com_minijoomla`; esta rodada não conclui o admin.

### Nova rodada local — configuração e descoberta

- View real de configuração em `com_config/tmpl/application/default.js`, usando
  o shell/sidebar completos do app. Leitura de controles, ETag capturado,
  sincronização/cleanup do editor e salvamento permanecem no binding central.
  Teste render-submit garante conflito com ETag antigo e preservação de campos
  ausentes/disabled/readonly, sem refrescar o ETag ao enviar.
- `com_installer/src/Controller/discover.js` e `com_templates/src/Controller/discover.js`
  são responsáveis por consultar o catálogo/manifestos e devolver `{ html, bind }`.
  Views em `com_installer/tmpl/discover/default.js` e
  `com_templates/tmpl/discover/default.js`. App delega com guard da navegação atual.
- Antes, o cadastro de templates confiava nos atributos do botão e não invalidava
  handlers antigos. Agora ambos os controladores capturam cópias dos metadados
  e só cadastram a entrada válida ligada ao botão. DOM ou objetos de scan alterados
  não substituem o snapshot. Extensão fica disabled; template continua enabled
  após confirmação explícita, sem setDefault/upload/execução de código.
- Guard antes/depois da confirmação e após a escrita: navegar ou parar impede
  novos cadastros pelo handler antigo, prompts, reload e mensagens em outra tela.
  Uma escrita já iniciada pode concluir; não há promessa de cancelamento/rollback.
  Botão pendente não reenvia cadastro. Erros de consulta de templates têm fallback
  seguro/retry, sem revelar detalhes internos e sem modificar catálogo.
- **61 passed/0 skipped/0 failed**, **212 JS**, contributor **269 arquivos** com
  workflow isolado **52 passed/9 skipped/0 failed** (skips somente sem SPMIDDLE).
  Estágios: core **122**, site **116**, all **192 arquivos declarados**; fixture
  local de release não reserva nem publica versão no SharePoint.
- HTML completo com shell/sidebar idêntico em **11 cenários** frente a `ae59d51`,
  helper `tmp/compare-admin-discovery-html.mjs`. Revisão independente GPT sem
  achados demonstráveis no escopo; testes focais do revisor também passaram.
  Detector mecânico das três views sem achados; não equivale a aceite assistivo.
- Logs: `tmp/admin-discovery-split-tests.log`, `tmp/admin-discovery-split-release.log`,
  `tmp/admin-discovery-split-contributor.log`. Sem navegador/escrita remota nesta
  rodada; SharePoint continua **0.5.1**. Commit apenas local, sem push/merge/deploy.
### Rodada local — categorias e tags

- `com_categories/tmpl/categories/default.js` e `com_tags/tmpl/tags/default.js`
  são views puras (linhas já carregadas → HTML). `content-pages.js` segue dono
  de filtros, seleção, ações em lote, ETag e shell. A duplicação pequena entre
  as duas tabelas é intencional: espelha a separação real de componentes do
  Joomla, em vez de um módulo "shared" inventado.
- Evidência: `tmp/compare-admin-taxonomy-html.mjs` compara com `bc060af` em 8
  cenários (vazio, árvore, lixeira, contagens zeradas, hostis) — HTML idêntico.
  Local antes da integração: 62 suítes, 215 JS, contributor 272 arquivos.
### Rodada local — módulos, plugins e estilos de template

- Views puras novas: `com_modules/tmpl/modules/default.js`,
  `com_modules/tmpl/positions/default.js`, `com_plugins/tmpl/plugins/default.js`
  e `com_templates/tmpl/styles/default.js`. `extension-pages.js` continua dono do
  roteamento, filtros, paginação, ações em lote, ETag e dos formulários de edição
  (módulo, plugin, estilo, opções e instalador ainda estão lá).
- Há um ciclo de import proposital: as views de módulos e plugins importam
  `selectionCell`/`selectAllCell`/`stateIcon`/`assignmentSummary` de
  `extension-pages.js`, que importa as views. Funciona porque o uso é dentro do
  corpo das funções; não mover esses helpers sem rodar a suíte.
- Evidência: `tmp/compare-admin-extension-html.mjs` compara `/moduleInstances`,
  `/plugins` e `/templates/styles` com `d927a3f` em 7 cenários (vazios, lixeira,
  tipo desconhecido, posição órfã, plugin virtual, estilo padrão/home/virtual) —
  HTML idêntico; a pré-visualização de posições foi conferida à parte.
  Local: 68 suítes/0 falhas, 234 JS, contributor 294, release 133/118/209.

### Retomada — formulários e gerenciamento por componente

- A rodada interrompida deixou seis views e três testes sem integração completa.
  Concluída a ligação real de `com_modules/tmpl/module/edit.js` e
  `tmpl/select/default.js`, `com_plugins/tmpl/plugin/edit.js`,
  `com_templates/tmpl/style/edit.js`, `com_config/tmpl/components/default.js` e
  `com_installer/tmpl/manage/default.js`. A última contém tabela de registros e
  formulário JSON legado; não substitui nem modifica o serviço de descoberta XML.
- Helpers existentes `paramFields`, `tabs`, `formActions` e rótulos de atribuição
  são exports compatíveis de `extension-pages.js`; todas as chamadas ocorrem
  dentro das funções, preservando o ciclo ESM existente sem leitura antecipada.
  Não duplicar esses helpers. Ainda falta separar controllers/bindings e o
  formulário de configuração usado por `configPage`; não declarar admin completo.
- Mantidos IDs, classes, ARIA, enums, strings e URLs, datas de agendamento,
  regras de conversão legada e ETags capturados. Nada de provisionamento,
  mudança de schemas, instalação remota, dependência nova ou escrita editorial.
- Quatro suítes novas: `admin-module-form-view`, `admin-extension-forms-view`,
  `admin-component-options-view`, `admin-installer-view`. Módulo/catalogo testados
  por agente GPT econômico; revisão independente dos formulários sem achados
  demonstráveis, com testes focais de compatibilidade/layout/atribuição legada.
- `tmp/compare-admin-extension-html.mjs`: **19 cenários** de listas, catálogo,
  formulário novo/existente/legado, plugin sem params, estilo e opções disponíveis/
  indisponíveis e gerenciador com HTML idêntico a `d927a3f`.
- Validação local: **72 suítes/0 skips/0 falhas**, **244 JS**; contributor
  **304 arquivos**, isolado **63 passes/9 skips esperados/0 falhas**. Estágios
  core/site/all: **143/118/215** declarados. Logs `tmp/admin-forms-tests.log`,
  `tmp/admin-forms-contributor.log`, `tmp/admin-forms-release.log`.
- Detector mecânico das seis views: zero achados, em `tmp/admin-forms-detector.json`.
  Não equivale a navegador/teclado/zoom/leitor de tela; esses aceites não executados.
- Mudanças paralelas em `CAMAP2` (README, package/lock, preparador, fontes XML/JS,
  docs, teste joomla-sources e sync-joomla-sources) permanecem com a outra equipe;
  não incluir em commit desta frente. Reconfirmar HEAD/índice antes de commitar.
- Já estamos em main: não criar um merge vazio nem integrar branches alheias só
  para satisfazer a palavra merge. Conferir upstream, enviar apenas este incremento
  validado, depois atualizar o ponteiro do superprojeto sem incluir trabalho alheio.

### Submissões pendentes — melhoria funcional após extrair as views

- Checkpoint das views salvo em `e073d7e`. No passo seguinte, `bindSubmit`
  interno a `createExtensionPages` impede reenvio pendente por binding de form;
  flag definida antes de aguardar o save, liberada em finally. Aplicado a novo/
  editar módulo, plugin, estilo, opções disponíveis, instalação JSON e lote de
  módulos. Busca e opções indisponíveis não passam pelo guard de escrita.
- Não cancela requisições já iniciadas nem trava múltiplas janelas/usuários;
  também não é proteção geral de navegação/stop. ETag e regras de unicidade do
  servidor continuam necessários, sem refrescar snapshot para tentar vencer conflito.
- Testes de integração são doubles locais de form/eventos, não cliques ou
  gravações de navegador/SharePoint. Sem mudança de HTML, schemas ou serviços XML.
- Contraprova `tmp/check-submit-baseline.mjs`: a mesma suíte aplicada a `e073d7e`
  confirma duas chamadas de update para dois submits pendentes; com o guard passa
  com uma. Cobertura: módulo novo/editar/lote, plugin, estilo, opções disponíveis/
  indisponíveis e instalação; falha seguida de retry, ETags capturados e uma só
  navegação ao concluir. Não houve escrita persistente ou comunicação de rede.
- Revisão independente do guard sem regressão demonstrável. O primeiro teste
  entregue pelo agente precisava de ajuste no double (faltava `batch` no serviço
  de módulos para a rota ser atendida); corrigido sem afrouxar o código de produção
  nem os asserts. Suíte focal executada via CLI e pela função exportada.
- Logs finais: `tmp/admin-submit-tests.log`, `tmp/admin-submit-contributor.log`,
  `tmp/admin-submit-release.log`; mesmo inventário de **72 suítes, 244 JS e 304
  arquivos contributor**. Não confundir aprovação local com nova publicação.
- Fila anterior de divisão: módulos/plugins/estilos/opções ainda em `extension-pages.js`,
  formulários e bindings genéricos em `app.js`/`field-schemas.js`, categorias/tags
  em `content-pages.js`. A parte de extensões está suspensa nesta frente durante
  a execução paralela do plano XML; coordenar antes de retomá-la. Evitar wrappers
  vazios e manter os entrypoints legados.
- Surgiu como trabalho paralelo `docs/PLANO-COMPATIBILIDADE-EXTENSOES-JOOMLA.md`
  (análise/proposta). Foi preservado sem edição e não faz parte deste commit;
  reconciliar responsabilidades antes de implementar a descoberta por XML ali proposta.

### Rodada independente — verificador editorial e imagens

- Somente `article-accessibility.js`, `media-upload-service.js` e suas suítes
  existentes receberam mudanças de código. Não foram alterados `app.js`,
  controllers/scanner/manifestos, runtime de extensões, transporte/host/schema,
  staging nem registro de testes. O plano paralelo permaneceu sem edição e fora
  do commit desta frente; não interferir na worktree da equipe responsável.
- Verificador puro: novos `heading-empty` e `duplicate-id` (warning) e
  `link-generic-text` (notice), preservando os IDs/severidades antigos e o shape
  do resultado. Ignora comentários/blocos completos de script/style; normaliza
  entidades numéricas/espaços, alternativas de imagens e nomes ARIA/title.
  IDs são comparados como valores exatos decodificados, com um aviso por valor
  repetido. Não interpreta árvore de acessibilidade/CSS/aria-labelledby nem
  certifica WCAG/i18n; não executa HTML, modifica o texto ou bloqueia salvar.
- Upload: guard nativo de ArrayBuffer (aceita outro realm, rejeita tag forjada),
  vistas locais Uint8Array preservando offset/byteLength, rejeição de zero bytes
  e acima de 10 MiB antes do fileClient. MIME usa chave própria da allowlist e
  é enviado canônico em minúsculas. Confirmar URL server-relative sem esquema,
  origem externa, barra invertida ou controles. Não decodifica o formato real.
- Regressão comprovada contra `123bfab` com cliente em memória: vazio, acima do
  limite, tag forjada e MIME herdado chegavam a `uploadFile`. Isso não demonstra
  que o SharePoint os persistia; o cliente/servidor podia rejeitá-los depois.
  Evidência: `tmp/media-validation-baseline.jsonl` e falha esperada pré-correção
  em `tmp/media-validation-before.log`. Novos testes rejeitam antes do transporte.
- Erro/URL inválida após upload pode significar arquivo já enviado: nenhum retry
  automático, exclusão ou rollback inferido. Erros do transporte são preservados.
  API, nomes de arquivo, pasta uploads e overwrite=false continuam os mesmos;
  listagem/paginação/remoção do serviço não mudaram. Não tocar nelas sem coordenar.
- Guard de execução direta de `tests/media-upload-service.test.js` corrigido com
  pathToFileURL: `node tests/media-upload-service.test.js` agora executa realmente
  no Windows. Uma execução antiga sem saída não era evidência de aprovação.
- Revisão de mídia sem defeitos demonstráveis no código inspecionado. A revisão
  editorial apontou cobertura de entidades; contraprovas confirmaram as já
  suportadas e acrescentaram aliases como ThinSpace/zwnj, respeitando nomes
  case-sensitive. Foram conferidos os 24 aliases HTML de espaço/caractere de
  junção com a tabela da stdlib Python, sem adicionar parser ou dependência ao
  runtime. Entidades fora do subconjunto conhecido continuam texto literal.
- Logs finais desta rodada: `tmp/editorial-media-tests.log`,
  `tmp/editorial-media-contributor.log`, `tmp/editorial-media-release.log`.
  Nenhuma nova suíte/arquivo de distribuição ou dependência foi acrescentada;
  baseline confirmada: **61 passed/0 skipped/0 failed**, **212 JS**, contributor
  **269 arquivos**. Estágios core/site/all: **122/116/192** arquivos declarados.
  Sem navegador, escrita remota, push, merge ou publicação;
  SharePoint segue na 0.5.1.

### Pendências gerais

1. Separação administrativa completa por diretórios `com_*` ainda pendente.
2. Geração XML de módulos concluída; manifestos dos demais tipos ainda estáticos.
3. Funcionalidades Joomla ausentes incluem i18n, `com_contact`, `com_banners`,
   `com_newsfeeds`, `com_fields`, `com_workflow`, partes de `com_finder`,
   `com_redirect`, versões/check-in e módulos sem contrato/dados correspondentes.
4. Zoom/reflow efetivos, `forced-colors`, `reduced-motion` e leitor de tela não
   têm aceite real. Não declarar aprovados por inspeção de CSS/DOM.
5. Conectar plugins administrativos persistidos/lifecycle ao host somente após
   definir comportamento seguro; hooks por injeção local não equivalem a isso.
6. Direitos, privacidade, proveniência e prontidão para distribuição pública
   seguem sujeitos aos gates de `OPEN-SOURCE-READINESS.md` e
   `THIRD-PARTY-NOTICES.md`.

## Navegador e publicação após o reboot

- Destino autorizado: `https://rinaldops.sharepoint.com/sites/camap-agp`;
  páginas `SitePages/MiniJoomla.aspx` e `SitePages/Administrator.aspx`. Nunca
  acessar/publicar no tenant `petrobrasbr` nesta frente.
- Toda automação de navegador deve usar FIORI-AUTO. Ler a diretriz
  `web-devs-worktree02/docs/DIRETRIZ-FIORI-AUTO-OBRIGATORIA.md` antes de agir.
  Cada sessão deve iniciar sua própria instância/porta/perfil, sem controlar
  outra LLM. Os sessionIds anteriores não valem após reboot.
- Binário .NET 9 existente: `app-devs/FIORI-AUTO/fiori-agent/FioriAgent.exe`.
  Não recompilar para uso normal. Perfil pessoal anteriormente autenticado:
  `%LOCALAPPDATA%/FioriAgent/profiles/rinaldops`; verificar posse/instâncias antes
  de usá-lo. Parâmetros históricos: `--port 47173 --debug-port 9222
  --user-data-dir <perfil> --visible`; escolher portas próprias livres.
- `browser.evaluate` pode devolver sucesso com `{}`/`null` em rejeição. Capturar
  erros dentro do JS avaliado e devolvê-los como dados. Não afirmar execução sem
  verificar retorno. Repetir screenshot em timeout antes de culpar o site.
- Deploy (Git Bash): `MSYS_NO_PATHCONV=1 node scripts/deploy-sharepoint.mjs
  --version X.Y.Z --web /sites/camap-agp --session <novo-id> --rpc <porta>
  [--skip-provision]`. Usar versão nova imutável. Omitir skip-provision se mudar
  schema; esta rodada não altera schema. Não sobrescrever 0.5.0.
- Rollbacks do canvas da publicação 0.5.0 estão em
  `tmp/deploy/0.5.0/rollback-*.html`. Hash check independente somente leitura:
  `node tmp/rin/verify.mjs <versão> <sessionId>`; conferir porta utilizada pelo
  helper antes de executá-lo.

## Próxima sequência

1. Conferir commit/working tree e rodar `npm test`, `npm run check`,
   `node tests/release-stage.test.js`, `node tests/contributor-stage.test.js`.
   Testes verdes são locais, não prova de escrita real.
2. Resolver a divergência do inventário de listeners do runner nativo, mantendo
   prova de posse. Repetir fixture local e todas etapas de cleanup com instância
   FIORI-AUTO própria; não usar tenant para esse teste.
3. Continuar divisão do admin por `com_*`, geração dos demais manifestos a partir
   dos catálogos e integração administrativa dos hooks. Não mudar o contrato de
   terceiros `SiteAssets/minijoomla/extensions/<key>.manifest.json` sem perguntar:
   há 11 módulos CAMAP corporativos consumidores desse contrato.
4. 0.5.1 já publicada; antes de outra publicação repetir no tenant
   escrita/ETag/editor/mídia/lote/lixeira e correções de visibilidade de
   categoria/tag, pageSize do blog, plugins em cartões e item de menu ativo.
5. Documentar evidências reais de zoom 200/400%, forced-colors, reduced-motion e
   leitor de tela quando executáveis. Não substituir por zoom CSS.

## Armadilhas e avisos preservados

- Registros SPMIDDLE são congelados; `etag` é não enumerável. Spread perde ETag.
  `findMany` não fornece ETag utilizável, usar snapshot de `findById` para edição.
- Campos SharePoint nunca gravados chegam como `null`; testes fake podem ocultar
  essas diferenças. Preservar campos desconhecidos e concorrência otimista.
- Sem reescrita de histórico nem descarte de alterações alheias. Temporários em
  `MINIJOOMLA/tmp/`, sem perfis/tokens/segredos em arquivos versionados.
- Sanitizador anterior à 0.4.1 tem XSS real. Releases corporativas antigas não
  foram alteradas; avisar o usuário se discutir a frente corporativa.
- README/checklist contêm evidência histórica datada. O estado 0.5.0 confirma
  carregamento e árvore publicada, não solução inteira concluída.

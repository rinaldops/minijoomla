# Handoff operacional — MINIJOOMLA

## Retomada após restart — estado local — 04/11/2026

- O servidor reiniciou e notificou cancelamento de agentes/previews históricos.
  **Não repetir uploads/MERGE/Publish da0.2.4**, nem reiniciar todas as instâncias
  antigas. A publicação já estava concluída; esta retomada não acessou tenant,
  não navegou o browser corporativo e não reconfirmou seu estado após restart.
  O estado final Artigos descrito abaixo é evidência anterior, não observação atual.
- Implementado comando permanente `npm run test:admin-layout -- --agent
  '<caminho-local>\FioriAgent.exe'`, documentado em
  [ADMIN-LAYOUT-TESTS.md](ADMIN-LAYOUT-TESTS.md). Executa teste nativo/local em sete
  larguras, não em npm test, com dados somente em memória, títulos/rotas/cards/
  ações/short row/nome longo/contador longo e contraprovas obrigatórias de CSS.
  Legenda de ação passou a ser obrigatória; texto ausente não aprova geometria.
- Cada invocação cria servidor loopback somente leitura, child FioriAgent,
  RPC/CDP/perfil únicos em tmp e prova propriedade por PID parent/profile/listener
  antes de viewport/evaluate. Usa agent.startSession (não browser.open) para não
  navegar uma aba reutilizada. Cleanup independente de falha CIM, aborto de RPCs
  por SIGINT/SIGTERM e recuperação limitada ao perfil criado; nunca mata Edge
  globalmente. Execução final passou sete larguras e cleanup conforme
  `tmp/admin-layout-2ExsuV/report.json`, sem mutações editoriais ou TinyMCE.
- Revisões independentes encontraram riscos de reuso/cleanup e guard MIT fraco;
  corrigidos antes da conclusão. Gate nativo não aceita falso sucesso/contraprova
  ausente nem transforma erro do agente em skip. Falhas intermediárias da tentativa
  blank-session foram locais, registradas como falha, sem touching SharePoint.
- Revisão offline classificou os três candidatos core: comentário de exemplo no
  editor, identidade default consumida no CAMAP JS e referência de fonte no CSS.
  Não são todos endpoint/segredo; isso **não** autoriza publicar identidade/config
  nem resolver o histórico. Os três achados/gate permanecem intactos.
- TinyMCE:32/32 arquivos vendor correspondem por hash ao pacote .tgz local, sem
  comprovar origem upstream/fonte correspondente. O subset não inclui o original
  notices.txt; DOMPurify/PrismJS/prism-themes exigem revisão de avisos/licenças.
  Nenhum vendor/runtime alterado, baixado ou redistribuído nesta retomada.
- Corrigido `scripts/stage-release.js`: integrações preservam LICENSE/GPL/avisos
  MINIJOOMLA e, havendo fontes SPMIDDLE, `vendor/spmiddle/LICENSE` original byte a
  byte. Texto MIT/copyright/concessão/disclaimer completos validados normalizados;
  falta/truncamento/junction bloqueiam estágio antes da saída. Testes core48 /
  site54 / all109 passaram, hashes/loaders/determinismo mantidos. Não substituir
  snapshots publicados/estágios anteriores; não é aprovação legal/pública.
- Final36 suítes passaram,0 skipped/failed com integração instalada. Standalone
  real isolado27 passed/8 skipped exclui só runner recursivo; contratos do comando
  nativo testados sem abrir browser em npm test. Sintaxe126 JS e diff check passaram.
- Tudo novo permanece local/uncommitted/unpushed; fontes públicas Cassiopeia não
  publicadas. Não reescrever história nem remover243 temporários rastreados.
  Pendências seguintes: aceite visual/zoom/mídias/leitor de tela, estados efetivos
  de publicação/destaque, fonte/proveniência/licenças terceiros e seleção/história.

## Estado vigente — incremento administrativo0.2.4 — 04/11/2026

- Usuário reiterou **“publique e prossiga para os próximos passos”**. Publicado
  incremento imutável **0.2.4**, adicionando títulos-links/cabeçalhos de linha e
  nomes acessíveis de edição por registro. Página administrativa somente;
  site público e outras webparts preservados. Sem novo commit/push.
- Não é uma release completa: três scripts novos (bootstrap/admin app/renderer),
  com imports de serviços/editor explicitamente fixados ao snapshot0.2.1.
  CSS continua0.2.3. Fonte app histórica conferida byte a byte antes do repin;
  só renderer novo é working-tree. Não republicar/minificar TinyMCE nesta rodada.
- Pacote `tmp/sol-admin-0.2.4/`: quatro arquivos incluindo manifesto. Ausência
  remota confirmada; upload oficial FIORI-AUTO sem overwrite, verificação remota
  de4 novos arquivos zero falhas, MIME application/javascript/application/json.
  Hash/tamanho/MIME de **20 assets (4 novos+16 dependências históricas)** verificados
  antes da escrita. Manifesto declara working-tree/base runtime/CSS/rollback.
- Canvas alterado somente no script src da única webpart administrativa. Backup
  privado, baseline/ETag/CheckOut/Level/public canvas conferidos; IF-MATCH exato no
  MERGE. Releitura após escrita, comparação decodificada e baseline/ETag novamente
  antes de Publish; marcador de intenção impede retry cego após escrita parcial.
  Publish200, canvas e estado publicado confirmados. API Publish não oferece
  transação atômica entre read e publish; comparação posterior permanece necessária.
- Revisão independente sem blocker no baseline. Contraprova `data-src` mostrou
  parser permissivo inicial, corrigido para atributo src real antes do apply;
  quatro controles negativos offline passaram. Novas leituras/marker também
  incorporados antes do apply para diminuir risco concorrente.
- Recarga real: uma montagem, marker0.2.4, só os três scripts incrementais novos,
  demais JS0.2.1, CSS0.2.3 preservado e renderer novo carregado, sem prévia.
- Matriz **publicada**320/768/769/900/1366/1920/2560px passou:11 ações/11 cards,
  títulos em th[scope=row], mesmo href/rótulo título/Editar, rota abrindo registro
  correspondente sem alterar dados, fixture multi-ação/nome longo e cleanup.
  Editor/reflow passou nas mesmas sete larguras. Funcional17 checks por largura
  em320/1366px passou; error/rejection/CSP zero na janela observada desses checks.
  Sem salvar, upload ou excluir conteúdo editorial real; não certificar console
  integral ou permissões de escrita a partir dos testes somente leitura.
- Rollback futuro: repontar **somente script src** para0.2.1/host/admin.js usando
  canvas/ETag vigente; manter CSS0.2.3 e todas as versões. Não restaurar backup
  integral nem fazer rollback automático. Base histórica/hash verificados.
- Evidências privadas: `tmp/sol-admin-0.2.4-backup.json`,
  `tmp/sol-admin-0.2.4-postwrite.json`, `tmp/sol-admin-0.2.4-apply.json`,
  `tmp/sol-admin-0.2.4-verification.json`, `tmp/sol-admin-0.2.4-loaded-result.json`,
  `tmp/sol-admin-0.2.4-layout-matrix.json`, `tmp/sol-admin-0.2.4-editor-matrix.json`,
  `tmp/sol-admin-0.2.4-functional-320.json`, `tmp/sol-admin-0.2.4-functional-1366.json`.
  Não distribuir tmp, backups/identificadores ou configs do host.
- FIORI-AUTO próprio RPC47242/profile externo foi reaberto após agente encerrado.
  Ao testar demo local, RPC confundiu contexto/ponteiros durante retorno; alvo foi
  novamente recarregado/conferido, sem escrever página. **Estado final Artigos,
  1366px, uma montagem, incremento0.2.4/CSS0.2.3, sem prévia/guard** conforme
  `tmp/sol-admin-0.2.4-cleanup-final.json` e `tmp/sol-admin-0.2.4-loaded-final.json`.
  Servidor demo próprio parado; não fechar navegador enquanto usuário utiliza.

### Próximos passos locais concluídos

- `src/media/templates/site/cassiopeia/css/template.css` neutralizado para direção Cassiopeia azul/bordô,
  gradiente, superfícies neutras, fonte sistema/Roboto instalado. Default.js só
  ajusta rótulos de cores/fonte; valores/defaults/parsing persistidos iguais.
  Layout/menus/15 posições/margens de imagem preservados. CAMAP opcional intacto.
  **Não publicado no site público** nem incluído no incremento administrativo.
- FIORI-AUTO local em320/768/1366/1920px: paleta/fontes/header, foco skip sem
  alterar hash, menu móvel/Escape, laterais/fluid e margens12/16px passaram.
  Demo CAMAP confirmou tokens intactos e ausência de vazamento Cassiopeia.
  Evidências `tmp/sol-public-cassiopeia-matrix.json`,
  `tmp/sol-public-camap-preserved.json`. Sem leitura visual integral/zoom real,
  cores forçadas reais ou leitor de tela; smoke DOM não é aceite da aparência.
- Novo auditor `scripts/audit-distribution.js`, integrado ao runner. Manifest-only
  core em tmp, containment/noLinks/hardlinks/schema/tamanhos/SHA-256, limites de
  saída e valores encontrados não transcritos. Nenhuma redaction/whitelist/rede
  ou decisão de distribuição. Testes sintéticos passaram,2 junction checks e3
  symlinks limitados por permissão Windows explicitamente omitidos.
- Novo core em `tmp/sol-core-next-20261104b/`:48 arquivos/477.051 bytes;
  integridade aprovada, **3 candidatos em3 arquivos** (editor/camap.js caminhos,
  camap.css contexto). Default.js/CSS já sem candidatos nas assinaturas. Gate1
  ainda bloqueia distribuição; não remover/mascarar sem revisar propósito.
  Contagem Git confirmou243 tmp rastreados; nenhuma exclusão/reescrita feita.
- Final35 suítes passaram com middleware instalado,0 skipped/failed; standalone
  isolado26 passed/8 skipped exclui somente runner recursivo. Staging core/site/all
  passou e sintaxe124 JS aprovada; revisão independente CSS/auditor sem novo blocker.
  Guias PUBLIC-TEMPLATE/DISTRIBUTION-AUDIT/CASSIOPEIA/readiness atualizados.
- Pendências: visual integral/admin público, zoom/mídias/leitor de tela, publicação
  pública separada, vigência de estados, fontes correspondentes/proveniência de
  TinyMCE, MIT nas releases com SPMIDDLE, candidatos editor/CAMAP e histórico.
  Sem ACL própria, CMS multiusuário/Joomla-PHP equivalente ou distribuição pronta.

## Histórico até a publicação CSS0.2.3

## Estado vigente — publicação 0.2.3 e próximos passos — 04/11/2026

### Publicado após “publique e prossiga para os próximos passos”

- **CSS administrativo 0.2.3 publicado**, exclusivamente na webpart MINIJOOMLA
  de `Administrator.aspx`. Runtime/editor/bootstrap continuam 0.2.1/39ec4b0;
  site público, outras webparts, adapters/theme e versões anteriores intactos.
- Corrige legendas de ações quebradas letra a letra, SVG/contêiner dos quickicons
  em 2rem, contador na faixa do ícone, título abaixo e preenchimento do card.
  Inclui as correções anteriores de tipografia/menu/status/container query.
- Pasta imutável nova `0.2.3/host`, dois arquivos; ausência remota conferida antes
  do upload oficial FIORI-AUTO, sem overwrite. Verificação remota: dois arquivos,
  zero falhas, MIME `text/css` e `application/json`.
- CSS: **30.731 bytes**, SHA-256
  `ee60841dcf0432c5212b407618ce967bb53b8cf0de0b56a8f083f4eaba6be104`.
  Manifesto declara fonte working-tree e runtime 0.2.1; não representa commit
  do código novo nem release completa ou distribuição independente.
- Backup privado, releitura de baseline e IF-MATCH exato protegeram o patch;
  exclusivamente href CSS trocado, canvas público/outros webparts preservados.
  Publish retornou200; estado publicado e conteúdo decodificado verificados.
- Recarga real confirmou uma montagem, CSS 0.2.3 HTTP200/hash/MIME corretos,
  cache `public, max-age=86400` e JS exclusivamente 0.2.1, sem prévia CSS.
- Matrizes nativas **do publicado**: 320/768/769/900/1366/1920/2560px.
  Ações/cards reais e fixture de múltiplas ações/contador/nome longo passaram;
  reflow/editor também passou nas sete larguras. Contraprova anterior em 0.2.2
  permanece válida para mostrar que os testes detectam o defeito.
- Funcional reexecutado em **320 e 1366px**: 17 checks por largura passaram,
  incluindo rotas, três abas, ArrowRight, TinyMCE, Advanced/espaçamento de imagens,
  cancelamento e cleanup. Sem salvar/upload/exclusão de conteúdo editorial.
  Sob guard somente leitura: uma rejeição em320px, nenhuma em1366px; zero eventos
  error/CSP na janela observada. Não certificar console integralmente limpo.
- Rollback **0.2.2** permanece intacto, 29.766 bytes/hash histórico confirmado.
  Para rollback futuro, repontar somente seu href usando canvas/ETag vigente;
  não restaurar backup integral, apagar pasta ou sobrescrever versão publicada.
- Evidências privadas: `tmp/sol-css-release-0.2.3-backup.json`,
  `tmp/sol-css-release-0.2.3-verification.json`,
  `tmp/sol-css-0.2.3-layout-matrix.json`, `tmp/sol-css-0.2.3-editor-matrix.json`,
  `tmp/sol-css-0.2.3-loaded.json`, `tmp/sol-css-0.2.3-assets-result.json`,
  `tmp/sol-css-0.2.3-functional-final-mobile.json` e
  `tmp/sol-css-0.2.3-functional-final-desktop.json`. Não distribuir tmp.
- Na limpeza, FIORI-AUTO perdeu o contexto após fechar apenas a aba local.
  Reiniciada somente a instância própria RPC47242, preservando perfil externo;
  página autenticada/recarregada e funcional desktop reexecutado. **Navegador
  deixado aberto em Artigos, 1366px, CSS0.2.3, uma montagem, sem prévia/guard**,
  conforme `tmp/sol-css-0.2.3-final-cleanup.json`. Não fechar enquanto usuário usa.

### Próximos passos implementados localmente, sem publicação de runtime

- `src/administrator/components/com_minijoomla/render-list.js`: título agora é link de edição em `th scope=row`;
  link do título e botão Editar compartilham rota segura e nome acessível específico.
  Título/aria-label escapados, fallback para título vazio e wrapper CSS da tabela.
  Sem alteração de editor, serviço/persistência ou lifecycle.
- Testes de renderer/sanitização e fixtures DOM ampliados. Prévia temporária de
  duas linhas sintéticas no host, usando CSS publicado0.2.3, passou em320/1366px;
  nunca substituiu/salvou os registros reais. Demo local nativa confirmou rota
  abrindo formulário do registro correto, layout/cards e fixture multi-ação.
  Evidências `tmp/sol-title-native-*.json` e `tmp/sol-next-local-smoke-*.json`.
  **Produção ainda não tem os novos links**, pois JS permanece0.2.1.
- Runner usa manifesto/imports dinâmicos: oito suítes explicitamente opcionais
  somente quando SPMIDDLE está ausente. Checkout parcial e falhas de import/
  assertion/exports continuam falhando com saída1. Núcleo executado em cópia
  isolada real sem mover ou modificar o projeto irmão.
- Novo staging `--target core`: fechamento de fontes públicas/admin/CSS locais,
  48 arquivos incluindo licenças/manifesto/loader, sem SPMIDDLE/SharePoint/TinyMCE.
  Imutabilidade/containment/links/imports ausentes continuam bloqueantes.
  Não é CMS implantável nem aceitação de direitos/distribuição. `all`/`site`
  preservam requisitos e testes anteriores; detalhes em [RELEASE-CORE.md](RELEASE-CORE.md).
- `release:check` agora é gate estrutural offline portátil, baseado em semver
  e licença própria, sem runbook corporativo/versão0.1.0 obrigatórios.
  Resultado explicita `publicationApproved:false`; digest é só estrutural.
- Servidor demo `scripts/serve-local.js`: somente GET/HEAD, loopback, MIME explícito,
  no-store/nosniff; bloqueia tmp/dot/privados aninhados, traversal e links/junctions.
  Revisão independente encontrou lacuna inicial de caminhos aninhados, corrigida;
  regressão de junction usa arquivo JS permitido, não falso passe por MIME JSON.
  Servidor de teste temporário encerrado; não é segurança para exposição em rede.
- [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) e
  [BACKLOG.md](BACKLOG.md) adicionados com dados genéricos, execução e limites,
  sem prometer paridade Joomla/PHP, ACL própria ou canal privado inexistente.
- Validação final: **34 suítes passaram**, zero skipped/failed com integração
  instalada; standalone isolado25 passaram/8 skipped, excluindo somente o próprio
  teste runner para evitar recursão. Staging core/site/all passou; sintaxe de
  **123 JS** e diff check passaram. Auditoria delimitada não encontrou alterações
  em caminhos proibidos nem padrões de segredo novos; não é auditoria de história.
- **Sem commit/push**, relocação, reescrita de história ou remoção de rastreados.
  Trabalho alheio do agregador/irmãos preservado. Todos os novos fontes/docs/tests
  continuam locais; só o CSS0.2.3 foi publicado neste pedido.
- Pendências: release administrativa de runtime para links, neutralização do
  template público em mudança separada, fonte correspondente/proveniência de
  terceiros, dados rastreados/histórico, indicadores de vigência, aceite visual
  integral, zoom/mídias reais e leitor de tela. Testes geométricos não significam
  equivalência integral Joomla/Atum ou aceite do usuário.

## Histórico das rodadas anteriores

## Nova reclamação: Painel de controle / Artigos — após CSS 0.2.2

- Usuário rejeitou novamente a apresentação e informou que deixou o navegador
  na página certa. Inspeção da instância própria RPC 47242 confirmou a rota
  `#/articles`, uma montagem e CSS publicado **0.2.2**. Nenhuma interpretação
  da imagem anexada ou comparação visual integral foi realizada pelo modelo.
- **Defeito concreto da listagem:** `.admin-col-action` usa largura de 1%,
  mas `.admin-btn` permitia quebra em qualquer letra e limitava sua largura a
  100%. Na largura 1366px, “Editar” ficava com 65,4 × 158,8px e a linha tinha
  187,8px, inclusive em títulos curtos. Não era conteúdo longo nem CSS antigo.
- Correção local exclusiva das ações da tabela: `max-width:none`,
  `white-space:nowrap`, `overflow-wrap:normal`. Na prévia real, botão passou
  a 97,6 × 39,2px e linha a 68,2px. As demais ações podem aumentar a largura
  rolável da tabela, mas não quebram seu rótulo letra a letra. Não impor altura
  máxima às linhas: títulos realmente longos continuam podendo quebrar.
- **Cards:** contêiner do ícone tinha 28px, mas SVG seguia em 16px. Referência
  Joomla quickicons usa 2rem. Correção local amplia SVG e contêiner para 2rem,
  coloca contador ao lado do ícone via grid, nome em linha seguinte com 1rem
  e negrito. Link usa flex:1 em item flex, não height:100%; grade parte de
  12rem e respeita largura disponível. Sem mudança de JS/DOM/runtime.
- `tests/admin-layout-dom.test.js` adiciona aceitação nativa para altura de
  controle relativa à fonte, legenda de ação em uma linha e dentro do botão,
  contenção célula/root, tamanho real do SVG, link preenchendo card, contador
  na faixa do ícone e dentro do link. Fixture sintética contém título curto,
  três ações, contador longo e nome longo. Tabela de fixture usa min-width
  36rem para distinguir o defeito de quebras legítimas por falta de espaço.
- Prévia CSS escopada completa, com folha publicada desativada temporariamente,
  passou matriz 320/768/769/900/1366/1920/2560px: 11 ações e 11 cards reais
  por largura, além da fixture. Mesma matriz de reflow do editor continuou
  passando. Testes executados por RPC FIORI-AUTO, sem escrita editorial.
- Contraprova: ativar a folha publicada 0.2.2 e desativar a prévia **faz os
  novos testes falharem** por legenda/altura do botão e dimensão/faixa dos
  cards; reativar correção passa. Não confundir os antigos checks de overflow
  com proteção desse defeito. Nenhum estilo externo mudou na comparação.
- Foco de teclado real ativado com `fiori.pressKey(Tab)`; cores computadas
  de ícone/rótulo e contador passaram. Falha inicial de focus() era modalidade
  de entrada do navegador, não regressão CSS. Alto contraste/mídia real e
  zoom real continuam sem validação. Console integral limpo não certificado.
- Suíte Node, staging, sintaxe de 120 JS e diff check passaram. Nova suíte DOM
  não integra automaticamente o runner Node; foi executada nativamente nesta
  revisão. Revisão independente aprovou cascata/reflow e recomendou cobertura
  ampliada de métricas, incorporada antes da última matriz.
- Evidências privadas: `tmp/sol-cards-user-current.json`,
  `tmp/sol-cards-action-preview-result.json`, `tmp/sol-cards-layout-matrix.json`,
  `tmp/sol-cards-negative-result.json`, `tmp/sol-cards-hover-result.json`,
  `tmp/sol-cards-editor-matrix.json` e
  `tmp/sol-cards-articles-corrected-preview.png`. Não distribuir evidências.
- Limite estrutural ainda identificado: títulos de artigo são texto simples,
  não links de edição/cabeçalhos de linha como no Joomla. Corrigir isso exige
  DOM/JS, não cabe na mesma atualização CSS-only. Indicadores de vigência
  pendente/expirada também não foram acrescentados nesta correção.
- **Não houve nova publicação, upload, commit ou push nesta revisão.**
  Local possui correções posteriores ao CSS 0.2.2; produção permanece 0.2.2.
  Prévia/guard retirados, folha publicada restaurada e navegador deixado na
  rota Artigos para o usuário. Não fechar a instância enquanto ele a usa.

## Publicação autorizada: CSS administrativo 0.2.2 — 03/11/2026

- Usuário autorizou explicitamente **“publique”** após o diagnóstico direto.
  Publicado somente o CSS administrativo novo em pasta imutável 0.2.2/host,
  com manifesto incremental. Não é release completa do runtime nem distribuição
  pública open source. Editor/JS/bootstrap/site público continuam 0.2.1/39ec4b0.
- Pacote: `tmp/sol-host-0.2.2/admin.scoped.css` e `release-manifest.json`.
  CSS 29.766 bytes, SHA-256
  `6fe5f3f691edd8e15f6a2a49ce4f90aef5c4d653b8ddd44c367e6fc1b8ec9868`.
  Metadados declaram fonte working-tree, sem fingir um commit do código novo.
  Upload oficial FIORI-AUTO sem overwrite, verificação remota dos dois arquivos
  sem falha (MIME text/css e application/json). Rollback CSS 0.2.1 segue intacto,
  com 28.928 bytes e hash histórico confirmado antes do repontamento.
- Destino administrativo foi o mesmo indicado pelo usuário; instância própria
  RPC 47242/CDP 9342/perfil exclusivo externo. Reinício apenas do agente próprio
  foi necessário após encerramento do browser; autenticação válida preservada.
  Página publicada e sem checkout verificada; nova pasta ausente confirmada
  por HTTP404 ou Exists=false (REST pode retornar200 para pasta inexistente).
- Backup privado dos canvases e ETags em
  `tmp/sol-css-release-0.2.2-backup.json`. Patch mudou exclusivamente o href
  do CSS em script/scriptCode da única webpart administrativa. Runtime src,
  outras propriedades/webparts e canvas público preservados. Releitura prévia,
  IF-MATCH exato e baseline impediram sobrescrita de edição concorrente.
  Publish retornou200; canvas decodificado e estado publicado verificados.
- Recarga real confirmou CSS 0.2.2 servido HTTP 200/hash correto, uma montagem,
  header #132f53, sidebar HSL 214/40/20, workspace #f0f4fb, fonte 16px/24px.
  Nenhuma prévia ativa. Recursos JS permanecem exclusivamente 0.2.1.
- Matriz **do publicado**, não de injeção: 320/768/769/900/1366/1920/2560px.
  Sem overflow do root/editor esmagado, sem efeito de estilo externo, status
  vazio invisível, menu abaixo do próprio header e dentro da largura do root,
  último link de menu expandido acessível. Editor a 769px tem 362px. A seção
  SharePoint continua limitando o painel a 1204px em telas largas, sem alteração
  de ancestrais. Parser nativo aceitou 193 seletores escopados e uma container query.
- Funcional no publicado em 320/1366px: 17 checks por largura passaram; rotas,
  três abas, ArrowRight, TinyMCE, diálogo Advanced/Vertical/Horizontal space,
  cancelamento e cleanup. Sem upload real, criação/salvamento/exclusão de itens.
  Guard de métodos de rede retirado no fim; houve uma rejeição de promise sob
  o guard e zero eventos error/CSP na janela observada. Não declarar console
  integralmente limpo ou permissões de escrita aceitas por esses testes.
- Suíte Node, staging, sintaxe de 119 JS e diff check passaram. Revisão independente
  aprovou compatibilidade CSS-only/DOM 0.2.1, escopo @container e escrita seletiva.
  Evidências privadas: `tmp/sol-css-release-0.2.2-verification.json`,
  `tmp/sol-css-release-postmatrix.json`, `tmp/sol-css-release-loaded.json`,
  `tmp/sol-css-release-functional-320.json` e `tmp/sol-css-release-functional-1366.json`.
  Captura `tmp/sol-css-release-published.png` não interpretada pelo modelo.
- Limites: sem aceite visual integral, zoom real, mídia real forced-colors/
  reduced-motion ou leitor de tela. A publicação foi autorizada com os limites
  já comunicados; não convertê-los em evidência de aceite.
- Rollback futuro: repontar **somente o href CSS anterior**, usando canvas/ETag
  vigente; não restaurar cegamente o backup integral, apagar versões ou fazer
  rollback automático. Nenhum rollback executado. Sem commit/push; alterações
  de projetos irmãos e regras compartilhadas preservadas.

## Diagnóstico no host real e correções locais — 03/11/2026

- Usuário rejeitou o resultado anterior e pediu verificações diretamente na
  página administrativa já indicada na sessão. A afirmação de que o painel
  havia voltado ao Joomla não valia para o publicado, nem constituía aceite
  integral da apresentação. **Naquele momento a publicação estava pendente;
  a autorização e a publicação subsequentes estão registradas acima.**
- FIORI-AUTO próprio RPC 47242/CDP 9342, perfil exclusivo fora do repositório:
  acesso autenticado à página esperada, uma montagem. CSS servido é o snapshot
  0.2.1/39ec4b0, 28.928 bytes, HTTP 200, MIME text/css, cache max-age=86400.
  SHA-256 coincidiu com o artefato histórico: não é o CSS Atum local.
  Sidebar branca, seleção verde, bordas azuis e fonte anterior confirmadas.
- Layout real: root limitado a 1204px em viewport 1920px, seção hospedeira com
  max-width 1236px. Em 320px, root 241px e editor 217px. Não alterar ancestrais
  SharePoint nem mascarar essa limitação com overflow global. Full-width requer
  decisão própria de composição; continua pendente.
- Prévia somente na instância do agente: escopo `[data-minijoomla-admin-root]`,
  folha publicada temporariamente desabilitada para evitar híbrido de tokens.
  Substituição correta da folha é necessária: simplesmente acrescentar CSS
  não escopado deixa seletores/tokens antigos prevalecerem.
- Achados corrigidos em `src/media/templates/administrator/atum/css/template.css`: menu móvel antes fixed/top54px
  invadia o chrome acima do painel (painel y160); agora absolute no `.admin-body`,
  começa abaixo da altura real do header e respeita a largura do painel.
  Fonte/entrelinha da `.admin-shell` explícitas (1rem/1.5; 16px/24px neste host).
  Status vazio não tem fundo de erro, margem ou altura. Container query de 50rem
  quebra colunas do artigo conforme conteúdo disponível. Em 769px, editor
  estava esmagado a 26px apesar de não haver overflow; passou a 362px.
- Matriz real da prévia corrigida: 320/768/769/900/1366/1920/2560px, sem overflow
  do root, sem editor esmagado, menu dentro do painel e último link acessível,
  sem mudança de estilos externos. Parser nativo: 193 seletores escopados e uma
  CSSContainerRule. Scoping temporário atualizado para reconhecer @container;
  não usar o transformer legado com split(',') nem publicar CSS sem esse suporte.
- Navegação real por artigos/categorias/módulos/plugins/configuração; formulário
  novo sem preenchimento/submissão; três abas e ArrowRight; TinyMCE, aba Advanced,
  Vertical/Horizontal space, cancelamento do diálogo e cleanup passaram.
  Não testar upload/save/delete reais nesta rodada. Nenhum item foi criado.
- Guard temporário bloqueou métodos de fetch/XHR diferentes de GET/HEAD/OPTIONS,
  inclusive serviços POST do host. Zero eventos error/CSP durante a janela
  observada; ocorreram duas rejeições de promise não classificadas, portanto
  **não certificar console integralmente limpo** sob esse guard. Não houve
  captura inicial de console, teste real de permissões de escrita ou zoom real.
- Suíte Node e staging passaram; sintaxe 119 JS aprovada. Evidências locais
  privadas em `tmp/sol-live-final-matrix.json`, `tmp/sol-live-final-functional.json`,
  `tmp/sol-live-final-css.json` e `tmp/sol-live-cleanup-result.json`.
  Capturas antes/prévia retidas somente em tmp; modelo não interpreta imagens.
  Nenhuma equivalência visual integral ou aceite do usuário foi obtido.
- Prévia e guard removidos; folha publicada restaurada e cores antigas conferidas
  novamente. Sem salvar página, upload, commit, push ou publicação. Site público,
  adapters/theme e snapshot imutável 0.2.1 intactos. Próxima publicação precisa
  de versão nova e autorização; não substituir o snapshot histórico.

## Painel Joomla/Atum restaurado localmente — 03/11/2026

- Usuário corrigiu `web-devs/AGENTS.md`: MINIJOOMLA está explicitamente fora
  da identidade Petrobras obrigatória. Projeto permanece na pasta atual.
  Alteração compartilhada do usuário preservada, sem edição por esta rodada.
- `src/media/templates/administrator/atum/css/template.css`: paleta histórica Atum (header #132f53, sidebar HSL
  azul 20%, hover 35%, atual 30%, submenu 16%, fundo #f0f4fb, links #2a69b7,
  success #457d54, danger #c52827/#f3d4d4 e featured #c78800). Roboto preferida
  somente quando instalada, com fallback de sistema; sem fontes externas.
- Preservados reflow/min-width, abas/painéis hidden, sidebar móvel invisível
  quando fechada, foco sólido, reduced-motion e forced-colors. Danger/card
  preenchidos no foco têm outline branco; featured usa fundo branco para
  contraste >=3:1 mesmo no hover da tabela. Texto de erro permanece gray900.
- Divergências deliberadas da referência: contorno funcional/pictograma neutro
  gray600 para contraste, cantos retos nas raízes/cards, círculo somente em
  indicadores internos. Header e submenu seguem a reconstrução histórica
  MINIJOOMLA, não equivalência literal do Atum local. Nenhum CSS vendor alterado.
- Suíte Node completa, sintaxe de 119 JS, `test:release-stage`, gate histórico
  `release:check` e diff check passaram. Revisão independente de referências
  confirmou paleta e levou a preservar foco de danger/card e fundo do featured.
- FIORI-AUTO próprio RPC 47241/CDP 9341/perfil isolado: editor/upload aguardado,
  imagem/margens 12/16px/ETag, módulos/atribuições/agenda/lote passaram com dados
  sintéticos. Painel/lista/três abas sem overflow em 320/768/1366/1920px; foco
  menu atual/normal, cards, campos, primary/success/danger/ghost verificado.
  Parser nativo aceitou 190 regras escopadas; elemento externo intacto.
  Evidência `tmp/sol-atum-native-result.json` e `tmp/sol-atum-overview.png`.
- Captura não interpretada (sessão sem entrada visual). Zoom real 200/400,
  mídia real alto contraste/movimento reduzido, leitor de tela e equivalência
  integral não foram aceitos. Site público e editor/runtime/adapters/theme
  intactos. Sem commit/push/publicação/escrita no tenant; 0.2.1/39ec4b0 preservada.
- Bloqueio visual anterior encerrado; pendências OSS de dependências, terceiros
  e privacidade continuam em [OPEN-SOURCE-READINESS.md](OPEN-SOURCE-READINESS.md).

## Direção corrigida: distribuição independente open source — 03/11/2026

- Usuário rejeitou também a alternativa Atum com paleta Petrobras. MINIJOOMLA
  não é uma aplicação corporativa: quer apresentação padrão Joomla, conclusão
  prioritária para colaboração em repositório público e temas corporativos
  apenas no futuro. A nota de ajuste local abaixo é histórica, não aceite atual.
- README passou a distinguir esse objetivo da publicação corporativa anterior.
  Critérios e bloqueios em [OPEN-SOURCE-READINESS.md](OPEN-SOURCE-READINESS.md).
- Auditoria local: Git do agregador, 400 arquivos rastreados no projeto e 243
  em tmp, candidatos a referências corporativas também em código/testes.
  Não expor o Git atual nem copiar releases/evidências para a distribuição.
- Bloqueio visual naquele momento era a regra de identidade da árvore;
  posteriormente resolvido pelo usuário com exceção explícita de MINIJOOMLA.
  Ver rodadas acima para alterações locais e limites de validação. Snapshot
  remoto histórico 0.2.1/39ec4b0 permanece inalterado.
- Decisão posterior: manter a pasta atual; usuário informa remoto público e
  escolhe GPL-2.0-or-later. Licença própria, texto integral, metadado e avisos de
  terceiros adicionados. Git atual usa origin `rinaldops/web-devs`; visibilidade
  não comprovada (CLI indisponível/consulta HTTPS bloqueada por certificado,
  sem contorno). Revisão independente confirmou dependência externa SPMIDDLE
  em clone/suíte/staging e obrigações de distribuição ainda pendentes.

## Ajuste local do painel inspirado no Atum — 03/11/2026

- Após o pedido de retorno ao Joomla, usuário aceitou aproximar a hierarquia
  Atum mantendo a paleta permitida. Não é restauração literal das cores Joomla.
  Somente `src/media/templates/administrator/atum/css/template.css` e seus testes foram ajustados; site público,
  editor/runtime, adapters e releases existentes permaneceram intactos.
- Header/sidebar compartilham azul `#006298`; menu normal branco sobre azul,
  atual/hover azul sobre branco. Cards mantêm branco; ações claras usam cor
  no pictograma, com texto preto e inversão legível no hover/foco.
- Exceções reutilizadas de `web-devs/docs/IDENTIDADE-PETROBRAS.md` §2:
  `#E3E9ED` somente em bordas de 1px, `#F2F7FA` somente no hover de linhas.
  Campos mantêm contorno funcional azul; ação destrutiva conserva indicação
  laranja em repouso, texto preto e fundo branco. Testes validam usos efetivos,
  contraste, foco e não apenas presença na lista de cores.
- Suíte Node, sintaxe (119 JS), `test:release-stage`, `release:check` histórico
  e diff check passaram. Revisão independente levou à preservação do contorno
  acessível dos campos e da indicação laranja normal.
- FIORI-AUTO próprio, RPC 47240/CDP 9340/perfil local isolado: aceites nativos
  editor/upload aguardado/imagem/ETag/módulos/atribuições/agenda/lote passaram
  com armazenamento sintético; Advanced e margens 12/16px salvas/reabertas.
  Painel/lista/três abas sem overflow em 320/768/1366/1920px; foco contrastante
  no menu normal/atual, cards, campos e salvar. CSS escopado parseado nativamente
  (193 regras), elemento externo intacto. Evidências `tmp/sol-panel-*.json`.
- Sem commit, push, publicação ou escrita no tenant nesta rodada. Produção
  continua **0.2.1 / 39ec4b0**. Qualquer publicação futura exige versão nova
  imutável e escopo exclusivamente administrativo. Zoom real, mídia real de
  alto contraste/movimento reduzido, leitor de tela e equivalência visual
  integral não foram revalidados; inspeção DOM não substitui esses aceites.

## Release 0.2.1 publicada e verificada — 03/11/2026

- Snapshot `39ec4b0` enviado a `web-devs/main`, incluindo apenas MINIJOOMLA;
  checkpoint preexistente `b731dec` incluído no push conforme autorizado.
  HH-web, referências Joomla e alterações do agregador/raiz preservadas.
- Pacote all fresco em `tmp/sol-publish-0.2.1-39ec4b0` (106 arquivos incluindo
  manifesto), host separado em `tmp/sol-host-0.2.1` (6 arquivos). SHA256/tamanho
  remoto: 112 conferidos, zero divergências. 0.2.0/anteriores intactas.
- Publicadas Administrator.aspx e MiniJoomla.aspx, somente o webpart MINIJOOMLA;
  backup em `tmp/sol-publication-backup-0.2.1.json`. ETags/guards de concorrência
  usados. Normalização HTML SharePoint interrompeu comparação literal após
  painel; reconciliação decodificada comprovou igualdade e retomou só o site,
  sem regravar painel nem ignorar edição de terceiros. Demais webparts intactos.
- Metadata após publicação: ambas Level=1, CheckOutType=2; versões de arquivo
  9.0 (painel) e 20.0 (site). Reload apresentou apenas assets 0.2.1, painel
  "Painel de controle"/azul institucional, site CAMAP/CSS carregados, sem alertas
  de raiz e chrome SharePoint preservado. CSS host escopado validado pelo parser
  nativo: 189 regras, sem seletor fora do escopo e sem afetar elemento externo.
- Artigo 13 reaberto em leitura: TinyMCE inicializado, três abas e Advanced
  com Vertical/Horizontal space. Artigo público Joomla/imagem carregado, sem
  URI inline. Nenhum artigo/lista/schema foi escrito para essas verificações.
- Manifesto SHA256: `379869bef9d2d212d5149870aae4515d82d15fe68c92402229342274b05c5e21`.
  Host manifesto: `c0f37692f8eadd4224b43fac03443e6db3879b4e72a5d48ba374fbe22b4e817c`.
  Relatório local em `tmp/sol-final-release-report.json`; rollback preparado
  pelo par 0.2.0/canvases, não executado destrutivamente. Aceites incompletos
  de zoom/forced-colors/leitor de tela/visual integral permanecem explícitos.

## Rodada integrada final — 03/11/2026

- Decisões da sessão: usar editor atual de `main`, incluir checkpoint preexistente
  `b731dec` no push sem alterar conteúdo, adequar cores e publicar site/painel.
  Frentes independentes tiveram arquivos exclusivos e revisão somente leitura.
- P0: resultados de listas inválidos não são vazio; parsing administrativo de
  módulos/atribuições/posições/catálogos estrito. Legado e chaves desconhecidas
  existentes preservados; opções tags/SEO sem consumidor desabilitadas.
- Editor: Conteúdo → Opções → Publicação; sete opções individuais efetivas,
  autoria/alias/idioma/agenda de destaque e categoria por título real. Metadados
  indisponíveis somente leitura; JSON desconhecido e datas intactas preservados.
  Relatório local de acessibilidade sem upload; teclado e lifecycle protegidos.
- TinyMCE: `image_advtab` estava no default falso. Agora a janela Advanced mostra
  Vertical/Horizontal space. Sanitizador público conserva somente margens px
  0–200; 12/16 px foram salvos, reabertos e conferidos por estilo computado.
- Plugins: refresh por assinatura key/url/params/order, cache compartilhado,
  lifecycle serializado e latest-wins, snapshots profundamente congelados.
  `stop()` invalida imports pendentes. Hooks sem resolução não têm timeout;
  código novo exige URL versionado, não reuso do mesmo URL/cache.
- Revisão independente corrigida: finalize simultâneo por disable/stop agora
  compartilha uma operação por ciclo; módulos omitem datas intactas sem perder
  segundos/milissegundos (testes UTC/São Paulo/Nova York); FakeAdapter e SPMIDDLE
  concordam em agenda de destaque e limites exatos, sem mutar armazenamento.
- Regressão integrada final: Node passou até os contratos das oito entidades;
  sintaxe 119 arquivos, `test:release-stage`, `release:check` histórico e diff
  check aprovados. Testes nativos editor/módulos/margens/erros/gestão repetidos
  após integração; imagem pública da fixture carregou (`naturalWidth > 0`).
  Plugin sintético no mesmo DOM recebeu A→B→disable→enable na busca e lifecycle
  esperado com um import. Nenhuma escrita editorial remota nesses aceites.
- Atum/Cassiopeia adequados à identidade Petrobras sem modificar vendor TinyMCE;
  CAMAP preserva estrutura e corrige foco/overflow/menu. As 14 capturas Joomla
  foram lidas por OCR local, não houve interpretação visual pixel a pixel.
- DOM nativo local, FIORI-AUTO próprio: criação/edição/readmore/upload aguardado,
  imagem carregada, reabertura/ETag, módulo/chrome/atribuição/agenda/lote/remoção;
  abas Arrow/Home/End/Tab/Shift+Tab e menu Enter/Escape/skip com foco.
  Matriz de templates nas quatro larguras, laterais vazias/preenchidas, um h1
  e sem overflow; ambas as paletas Cassiopeia verificadas. Dados/transportes
  desses testes são sintéticos, não escrita remota.
- Schema: oito cenários e dezenove cenários de entidades cobrem os oito domínios,
  contratos anteriores/atuais, idempotência, parcial/retomada/ETag/undo local.
  Não há rollback de schema; verify não prova tipos e índices podem ficar pendentes.
- Aceites não concluídos: zoom real 200/400, forced-colors/movimento reduzido
  em mídia real, leitores de tela, equivalência visual integral e todos os
  formulários com escrita no tenant. Zoom CSS não é usado como aceite real.
- Destino reinspecionado em leitura: SAPScripting, permissões atuais presentes,
  SiteConfig vazio, 0.2.0 existente e 0.2.1 ausente. Nenhum schema/dado remoto
  foi alterado nesta rodada. A preparação foi concluída depois como 0.2.1;
  ver nota de publicação acima e runbook para resultado verificado.

As seções abaixo são fotografias históricas, não pendências reabertas quando
esta nota registra uma correção comprovada.

## Integridade dos parâmetros de plugins — 03/11/2026

- `10d2f07` já estava sincronizado antes desta retomada; nenhuma alteração
  alheia de HH-web/hub-ai/raiz VSTO foi incluída.
- Auditoria independente reproduziu `paramsJson` corrompido convertido em
  defaults, manifesto/definições inválidos ocultados e perda de chaves avançadas
  ao salvar campos declarados. Plugin view agora usa parsing administrativo
  estrito e valida definições/valores sem fallback silencioso. Manifesto parcial
  continua válido; não substituir por parser de instalação que exige identidade.
- list/get/update e lote rejeitam corrupção antes de gravar; lote valida ainda
  que o ID seja plugin, sem alterar módulos por esse namespace. Registros legados
  com campo ausente/null JavaScript/vazio continuam compatíveis. Runtime público
  tolerante e CRUD genérico de extensions não foram endurecidos nesta rodada.
- Salvar parâmetros preserva chaves não declaradas JÁ armazenadas e objetos
  aninhados; desconhecidos novos recebidos continuam filtrados. Sem params,
  estado/ordem/lote preservam JSON exato. ETags capturados continuam obrigatórios.
- Matriz Node cobre sintaxe/shape/definições/valores inválidos, snapshots completos,
  ETags obsoletos, compatibilidade e preservação. DOM simulado bloqueia formulários
  de padrões. FIORI-AUTO próprio executou 20 verificações em DOM nativo local,
  incluindo clique submit que preserva advanced, com armazenamento sintético.
- Suíte completa, sintaxe (113 JS), staging e release:check histórico aprovados.
  SharePoint segue release 0.2.0/snapshot 09300fa, sem publicação/mutação remota.
  Continuar revisão de outros parsers, controles sem consumidor e aceites amplos.

## Continuidade após push de 58b0143 — 03/11/2026

- `58b0143` enviado a `web-devs/main` a pedido do usuário. Release SharePoint
  continua 0.2.0/snapshot `09300fa`; nenhuma republicação nesta rodada.
- P0: posições de módulo não convertem mais falha de leitura SiteConfig em
  template default; tela de posições não ignora falhas do catálogo de estilos.
  Configuração realmente ausente mantém compatibilidade; template explícito
  não exige a leitura da configuração global.
- Novas páginas de extensões mostram alerta genérico seguro para falha de
  carregamento, sem detalhes do backend nem controles de fallback. A mensagem
  recomenda conferir o registro antes de repetir uma ação, pois uma escrita
  anterior pode ter concluído antes da recarga falhar. Revisão independente
  identificou essa nuance e ela foi corrigida/testada, incluindo recuperação
  da mesma aplicação após restaurar o repositório.
- `tests/admin-errors-dom.test.js` exporta `runAdminErrorsDomTests(document)`;
  11 cenários executados por FIORI-AUTO próprio em DOM nativo local: opções e
  estilos corrompidos, mutações bloqueadas e indisponibilidade de SiteConfig/
  templates. Armazenamento sintético isolado intacto; sem tenant/escrita real.
- Integração agora remove TODAS as cinco instâncias demo via trash → ETags
  relidos → delete, reabre armazenamento e recompõe o público com coleção
  vazia: defaults não reaparecem, conteúdo/menu/breadcrumb permanecem. Ausência
  real de getModuleInstances ainda habilita fallback legado. Aceite de remoção
  em tenant e demais parâmetros visuais permanece separado.
- Suíte Node completa, sintaxe (113 JS), release:check histórico e staging
  aprovados. Persistência/publicação em tenant não é inferida desses testes.

## Release 0.2.0 publicada — 03/11/2026

- Usuário autorizou publicação e confirmou snapshot `09300fa`, dispensando
  espera por entrega independente do editor para esta release. Nenhum arquivo
  do editor foi alterado. Destinos e evidências no
  [runbook](RELEASE-MSE-0.1.0.md#publicação-020-verificada--03112026).
- Publicados 106 arquivos do pacote + 6 do host novo; verificação SHA256 de
  todos os 112 sem divergências. Canvases de site/painel atualizados/publicados,
  propriedades não relacionadas preservadas, reload confirmou apenas 0.2.0.
- Site CAMAP/CSS carregados e painel operacional com chrome SharePoint intacto.
  Artigo Joomla/imagem e abertura do TinyMCE verificados sem escrita editorial.
  SiteConfig vazio: CAMAP mantido como default injetado, sem criar configuração.
- Backup/rollback local preparado; reversão não executada. Não sobrescrever
  0.2.0: desenvolvimento retomado após publicação exige nova release futura.
  Zoom/alto contraste/permissões amplas e testes de todas as operações ainda
  não estão concluídos. Recuperação de paginação fora do intervalo é a próxima
  correção local em andamento, não parte da release 0.2.0 publicada.
- Correção pós-publicação concluída localmente: página além do intervalo
  apresenta mensagem específica e links de recuperação para primeira/última,
  preservando query, filtros de arquivo e basePath pelo callback já existente.
  Sem clamp, redirecionamento automático ou consulta adicional implícita.
  Testes de categoria/SPMIDDLE, busca com caracteres especiais, arquivo,
  escaping, vazios e imutabilidade aprovados. FIORI-AUTO local confirmou
  mensagem em page=999 e clique nativo que retorna a page=1 com dois artigos.
  Suíte completa/sintaxe/release check/release-stage aprovados após integração.

## Auditoria P0 recebida e tratada — 03/11/2026

- Relatório de Claude Sonnet 5 recebido após `506906f`: confirmou a correção
  da busca e reproduziu sobrescrita silenciosa de JSON corrompido em opções
  de componentes e estilos. Essa auditoria já não está pendente; a nota abaixo
  preserva o estado no momento do checkpoint anterior.
- Parsing estrito opt-in no admin; leitura pública tolerante preservada.
  Leitura de opções/lista de estilos e todas as mutações correspondentes
  rejeitam corrupção com `ValidationError`, antes de qualquer gravação.
- As páginas afetadas exibem alerta seguro sem formulário de padrões. O
  catch amplo de `/options/<key>` que escondia falhas como 404 foi removido;
  componentes desconhecidos ainda têm 404 sem confundir erro de dados.
- Executor auxiliar adicionou regressões de serviço cobrindo corrupção,
  shape incorreto, literal JSON `null`, estilos parcialmente inválidos,
  preservação completa dos repositórios/ETags/lastPatch, campos legados vazios
  e preservação dos demais componentes/estilos em gravações válidas.
  Coordenador acrescentou regressões de apresentação em DOM simulado.
- Sem escrita no tenant, sem alterações no editor e sem publicação.
  Validação nativa dos novos alertas e tratamento dos outros fallbacks do
  runtime/carregamento permanecem pendentes.
- Revisão independente encontrou coerção pré-validação de `home: "true"`
  em estilos. Corrigido: `home` presente deve ser booleano antes de mapear;
  ausência continua compatível com legado. A matriz de rejeições agora inclui
  esse caso em todas as operações, além de opções com shape/valor inválido.
- Suíte completa, sintaxe, release check e release-stage aprovados;
  checkpoint local desta correção, sem push/publicação.

## Retomada verificada — 03/11/2026, GPT-6.1 Sol

Esta nota complementa, sem apagar, as fotografias históricas abaixo.

- Base conferida: `web-devs/main` em `cc80145`; MINIJOOMLA sem alterações
  pendentes antes desta rodada. Alterações alheias em `HH-web`, `hub-ai` e
  no agregador VSTO foram inventariadas e preservadas. Não havia arquivos
  não rastreados visíveis no inventário Git de `web-devs`.
- Reexecutados e aprovados: `npm test`, `npm run check` (112 arquivos JS),
  `npm run release:check` e `npm run test:release-stage` (105 arquivos na
  fixture completa e 50 no site). O contrato de release histórico e o staging
  local não comprovam publicação do código atual.
- Paralelismo: Claude Sonnet 5 revisa P0 somente leitura; GPT-5.2 Petrobras
  implementa cobertura pública exclusivamente em `tests/site-runtime.test.js`;
  coordenador integra/revisa e mantém documentação. Sem worktree adicional
  porque não há frentes concorrentes de escrita nos mesmos arquivos.
- FIORI-AUTO próprio, perfil exclusivo sob `tmp`, origem HTTP local sem cache:
  `tests/admin-management-dom.test.js` passou em DOM nativo (clique de template
  padrão, ativação de plugin, conflito ETag e armazenamento sintético isolado).
  `history.back()`/`history.forward()` nativos também restauraram as views
  públicas e removeram a view anterior, com dados fake locais.
- Formulário atual de módulo exercitado por clique/seleção nativos:
  aba Avançado → `headerTag=p` → Salvar e fechar → releitura do armazenamento
  sintético → navegação pública. O título de “Artigos recentes” apareceu como
  `<p>`, comprovando o caminho UI/persistência/runtime para a opção acrescentada
  em `cc80145`. Não implica aceite dos demais parâmetros nem do tenant.
- Na prova de histórico nativo, esperar qualquer `onAfterRender` provocou uma
  falsa falha: `popstate` e `hashchange` podem gerar mais de uma navegação.
  A espera foi corrigida para exigir a view esperada antes de validar;
  não foi necessário alterar o produto por esse problema do harness.
- Inventário público contra fontes locais Joomla registrado em
  [JOOMLA-EQUIVALENCE.md](JOOMLA-EQUIVALENCE.md#inventário-de-continuidade--03112026).
  Não equivale a aceite visual, novos contratos aprovados ou validação no tenant.
- Corrigido o shape das opções na rota de busca, além da propagação dos links
  de artigos com `basePath` e do fuso. Regressão de admin → ETag → releitura →
  HTML público adicionada em `tests/component-options-runtime.test.js`.
  A prova nativa revelou ainda que `examples/index.html` não resolvia
  `ComponentParamsJson`/estilos: agora reutiliza `toSiteConfigOverrides`.
  Desmarcar “Destacar termos encontrados” no formulário real, salvar e navegar
  à demonstração pública deixou zero `<mark>` no resultado esperado, com o
  valor `false` relido no armazenamento sintético. Antes havia um `<mark>`.
  Reativar a opção pelo mesmo formulário restaurou um `<mark>` na busca.
- Cobertura delegada/revisada: back e forward no mesmo harness; paginação
  determinística com primeira/última página, zero/negativa e categoria vazia.
  Página fora do intervalo continua mostrando vazio sem links de recuperação;
  esse resultado é caracterização do estado atual, não fechamento da UX.
- Editor, loaders, staging publicado e destinos remotos não foram alterados
  nesta rodada. A frente independente do editor não foi presumida encerrada.
- Validação final: suíte Node completa aprovada (191 linhas `ok`, não uma
  contagem de casos), sintaxe de 112 arquivos, release check, release-stage e
  diff check de MINIJOOMLA aprovados. GPT-5.2 Petrobras revisou a correção da
  busca e a conversão da demo sem bloqueios; observações de manutenção do
  teste foram incorporadas com fixture própria e asserções separadas.
  O relatório da auditoria P0 de Claude Sonnet 5 ainda não foi recebido;
  não considerar essa revisão concluída. Próximas prioridades: integrar o
  relatório, dados JSON inválidos/controles sem consumidor, recuperação de
  paginação fora do intervalo e coordenação da frente do editor.
  Checkpoint local limitado a estes oito arquivos de MINIJOOMLA;
  push e publicação não realizados nesta rodada.

## Situação para transferência — 03/11/2026

**Fase:** desenvolvimento e integração local, ainda com funcionalidades
pendentes. A entrega desta sessão não foi publicada no SharePoint. Para
continuar, use o [plano passo a passo](PLANO-CONTINUIDADE-MINIJOOMLA.md) e o
[prompt para a próxima LLM](PROMPT-CONTINUIDADE-MINIJOOMLA.md).

### Estado de código e coordenação

- MINIJOOMLA pertence ao repositório `C:\PROJETOS\VSTO\web-devs`, branch
  `main`. O checkpoint inicial `a6d809d` não contém todas as alterações
  produzidas em seguida; o encerramento solicitado inclui um commit posterior
  de integração e documentação. Ao assumir, confira `git log`, `git status`
  e os arquivos não rastreados em vez de depender apenas deste hash.
- No início do encerramento, `web-devs` estava 15 commits à frente de
  `origin/main`, com alterações adicionais de MINIJOOMLA. `HH-web`, `hub-ai`
  e arquivos temporários preexistentes na raiz apresentam alterações alheias:
  preservá-los e não incluí-los no commit desta frente. A raiz VSTO referencia
  `web-devs` como submódulo; confira seu ponteiro após a sincronização.
- A agente da expansão administrativa foi cancelada sem relatório final.
  Seus arquivos foram preservados e testados, mas o trabalho é **parcial**:
  a existência de campos e telas não prova sua aplicação no site.
- No encerramento, os agentes subordinados desta coordenação estavam ociosos;
  não havia processos de preview ou FIORI-AUTO próprios escutando nas portas
  utilizadas. Isso não interfere na outra LLM independente do editor.
- Outra LLM trabalha no editor de artigos. No inventário desta cópia não foi
  encontrado `docs\PLANO-EDITOR-ARTIGOS-JOOMLA-LIKE.md`; confirme com ela a
  worktree e o documento, sem recriá-lo ou sobrescrever sua implementação.
  Duas traduções `keynav` do TinyMCE foram adicionadas como dependências de
  empacotamento; a lógica do editor não foi alterada por esta coordenação.

### Trabalho realizado

- **Administração:** filtros, ações persistidas, catálogo nativo e escolha de
  template com ETag; foram acrescentadas telas/serviços locais de catálogo de
  módulos, duplicação, lote, lixeira, atribuições, plugins, estilos, opções
  globais e registro por manifesto. Os testes novos cobrem serviços e DOM
  simulado. Não há instalador arbitrário, execução de PHP ou ACL própria.
- **Integração ainda necessária:** atribuições e agendamento de módulos,
  apresentação do título/classes, ordem/parâmetros dos plugins, estilos
  persistidos, opções de componentes, offline e metadados ainda não estão
  conectados de ponta a ponta. Há divergências entre alguns parâmetros
  declarados no painel e os aceitos pelos templates. Veja a matriz e os
  cuidados de dados em [ADMINISTRATION-EXTENSIONS.md](ADMINISTRATION-EXTENSIONS.md)
  e no plano.
- **Schemas:** campos novos foram declarados nos schemas v2 de extensões,
  instâncias e configuração. Nenhuma migração remota desta frente foi aplicada
  ou validada. A omissão de defaults em gravações não comprova compatibilidade
  completa com listas antigas; a migração também deve preservar escopos
  legados de módulos.
- **Cassiopeia e CAMAP:** shells próprios responsivos, posições nomeadas,
  aliases legados, parâmetros diretos e limpeza de listeners. O CAMAP recebeu
  grade e faixas próprias e correção de coluna vazia indesejada. Os contratos
  estão em [CASSIOPEIA.md](CASSIOPEIA.md) e
  [CAMAP-TEMPLATE.md](CAMAP-TEMPLATE.md); ainda falta aceite visual completo
  contra os modelos e integração dos estilos salvos.
- **Runtime público:** página inicial por categoria ou por destaques, com
  paginação e padrão anterior preservado; posições de módulos, busca nativa
  e registros dinâmicos. `src\modules\mod_menu\tmpl\default.js` implementa árvore,
  ordenação, estados, controles acessíveis e limpeza; o adapter SPMIDDLE
  preserva IDs e pais para que a hierarquia seja possível.
- **Host:** `mountMiniJoomlaSite` monta em contêiner dedicado e preserva o
  corpo, o título e o idioma do host. O snippet Modern Script Editor passou
  a usar essa composição; sua montagem no MSE real ainda não foi validada.
- **Release local:** `scripts\stage-release.js` verifica fechamento de
  imports/CSS, versão explícita, destino inédito dentro de `tmp`, SHA-256 e
  alterações concorrentes das fontes. Há modo completo e modo exclusivo do
  site; o segundo não aprova o painel. O pacote completo inclui recursos
  TinyMCE e suas licenças. Os arquivos `en.js` e `pt_BR.js` de `keynav` foram
  comparados por SHA-256 com a cópia local do pacote `tinymce@7.9.1` e são
  idênticos. O teste comprova que o plugin help procura o fallback inglês no
  init. Detalhes no [runbook](RELEASE-MSE-0.1.0.md).

### Evidências e limites

- Em 03/11, `npm test` passou, com 167 linhas `ok` reportadas, incluindo
  `admin-extensions-service.test.js` e `admin-extensions-app.test.js` no runner.
  Este último usa DOM simulado; não equivale à validação em navegador real.
- `npm run check` passou para 106 arquivos JavaScript; `npm run release:check`
  passou para o contrato histórico 0.1.0; `npm run test:release-stage` passou
  com fechamento de 104 arquivos no pacote completo e 45 no exclusivo do site.
  O estágio de teste `0.2.0` é local e não reserva versão remota.
- Uma rodada anterior com FIORI-AUTO e dados sintéticos verificou Cassiopeia
  e CAMAP em 320/768/1366/1920 px, sem overflow horizontal, com um `h1`,
  skip link, menu móvel, submenu e Escape/foco. Cinco rotas administrativas
  foram verificadas em 320/1366 px, além de uma regressão DOM nativa com ETag.
  A rodada precedeu as últimas mudanças administrativas: repeti-la para as
  novas telas. Zoom 200%/400%, alto contraste e aceite visual completo não
  foram comprovados.
- A leitura autenticada foi somente de inspeção. Observou-se o site público
  com loader/CSS `0.1.3` e bootstrap/grafo JS `0.1.0`; o painel usava
  `0.1.0`. As pastas `0.1.0` a `0.1.4` existiam na data da consulta. Não
  sobrescrever versões nem supor que uma posterior esteja livre.
- Não houve upload, alteração de listas/canvas nem publicação desta frente.
  O staging offline não certifica MIME, CSP, cache, permissões nem integração
  autenticada. Planeje rollback trocando o conjunto coerente de loader,
  configuração e assets, e não apenas o CSS.
- O `hub-ai` foi tentado, mas o SDK `agents` estava ausente e o restore no
  feed corporativo falhou por CA bundle configurado inexistente. Nenhum
  controle TLS/proxy foi alterado. As implementações usaram agentes disponíveis
  na sessão; não houve chamada remota bem-sucedida ao modelo pelo Hub.

### Lições para não repetir

1. Cache de módulos ES em preview local gerou uma falsa falha: usar uma origem
   isolada sem cache e confirmar a versão do grafo carregado.
2. O `id` ausente no adapter tornava o menu hierárquico plano; verificar
   contrato completo, não somente `parentId`.
3. ETag deve ser o capturado ao abrir/listar o registro, não um token recém
   obtido para sobrescrever uma edição concorrente.
4. Os métodos `sharepoint.getPageCanvas`, `sharepoint.updatePageCanvas` e
   `sharepoint.publishPage` não existem no dispatch do FioriAgent. Para
   eventual publicação autorizada, seguir o fluxo comprovado citado no plano.

> As seções seguintes são histórico de momentos anteriores. Alegações de
> sincronização, publicação, versões e limitações ali registradas valem apenas
> para suas respectivas datas; em caso de conflito, prevalece esta fotografia.

## Histórico — atualização local inicial de 03/11/2026

Esta atualização complementa o histórico abaixo; não declara publicação remota.

- Administração: filtros por tipo/estado/posição, ações persistidas de ativação
  de extensões e módulos, catálogo de componentes nativos e gestão de templates.
  O template padrão usa `siteConfig.templateKey` com ETag, inclusive quando o
  catálogo opcional de templates não foi configurado.
- Cassiopeia e CAMAP: shells próprios responsivos, 15 posições de módulos,
  aliases legados preservados e bindings com limpeza de listeners.
- Runtime público: todas as posições efetivamente renderizadas; plugins
  descobertos disponíveis antes dos filtros de conteúdo, com
  desativação/reativação; limites individuais dos módulos respeitados e busca
  nativa posicionável, integrada ao router.
- `createMiniJoomlaSiteApplication` conecta a configuração e os repositories
  opcionais ao runtime; exemplos público/admin compartilham somente dados
  sintéticos persistidos no navegador, com ETags monotônicas.
- A frente do editor de artigos não foi alterada por esta coordenação.
- Nenhum snapshot em `tmp/release-stage` foi sobrescrito e nenhuma publicação
  SharePoint foi executada. A nova composição ainda requer configuração das
  listas e distribuição dos arquivos no host de produção autorizado.

O uso solicitado do Hub foi tentado pelos agentes. O SDK `agents` está ausente;
o restore pelo JFrog foi bloqueado por um caminho inexistente para o bundle CA
corporativo. Nenhuma chamada remota foi concluída e TLS/proxy não foram
alterados. A implementação foi realizada pelos agentes disponíveis na sessão.

Limites permanecem explícitos: não há instalador arbitrário, ACL/usuários,
execução de PHP, transação entre listas ou equivalência integral ao Joomla.

### Verificação local desta atualização

- Suíte JavaScript completa, verificação de sintaxe e `release:check` aprovados.
- FIORI-AUTO: cinco rotas administrativas em 320/1366 px; Cassiopeia e CAMAP
  em 320/768/1366/1920 px, sem overflow horizontal e com skip links funcionais.
- Cliques nativos comprovaram persistência do template padrão, ativação de
  plugin com efeito no artigo público e remoção pública de módulo desativado.
- Regressão DOM isolada comprovou ações, conflito ETag e armazenamento isolado.
  Busca real retornou o artigo esperado; menu móvel abriu e fechou com Escape,
  devolvendo o foco ao controle.
- O preview usa origem local isolada sem cache. A avaliação JavaScript do
  FIORI-AUTO foi feita sem `await` no nível superior; ações assíncronas foram
  verificadas em leituras subsequentes, evitando falsos negativos do harness.

## Histórico — handoff de 02/11/2026

**Data:** 02/11/2026
**Repositório:** `C:\PROJETOS\VSTO\web-devs\MINIJOOMLA`
**Branch:** `main`
**Último commit publicado:** `9737c79 feat(minijoomla): corrige 2 bugs visuais reais e introduz editor TinyMCE real`
**Remoto:** `main` sincronizada com `origin/main` até o commit acima; sem alterações locais pendentes conhecidas desta frente no momento deste handoff, exceto o commit de evidência de publicação real (`tmp/release-stage/0.1.0/...`) ainda a ser feito ao final desta sessão.

> Este documento foi atualizado para o handoff atual. Não usar commits
> antigos (`fb0dd2d`, `89e86ec`, `797255b`, `50c54ee`) como referência do
> estado presente — além da Parte 2 original (validação real contra
> `/teams/SAPScripting`), já foram concluídos e publicados: o painel
> administrativo completo (`src/administrator/components/com_minijoomla/`), publicado em
> `SitePages/Administrator.aspx` (página separada da pública
> `MiniJoomla.aspx`); um rework visual completo do painel para a
> estrutura/paleta REAL do template Atum do Joomla (não a identidade
> Petrobras — essa fica reservada ao template do site público); uma
> correção estrutural adicional (sidebar em árvore, cpanel agrupado,
> ícones de estado circulares); e, nesta mesma sessão, a correção de
> dois bugs visuais reais adicionais e a introdução de um editor de
> texto rico real (TinyMCE) — tudo já comitado e **republicado e
> revalidado no tenant real** (`Administrator.aspx`, CSS `?v=6`). Não
> repita provisionamento/leitura/escrita remota sem motivo novo.

## 1. Objetivo

Este documento permite que outra LLM assuma o desenvolvimento sem depender do
histórico da conversa. O objetivo é desenvolver o MINIJOOMLA como camada
JavaScript Joomla-like, modular e independente de SharePoint, SPMIDDLE e
`mse-platform`, usando adapters injetáveis e fake adapter local.

## 2. Estado atual

### Entregue

- Shell responsivo com identidade Petrobras, header, menu, breadcrumbs,
  conteúdo, sidebar, footer, skip link e foco em `main#main-content`.
- Router com home, artigo, categoria, busca, **arquivo** (`#/archive`) e 404;
  hash routing, `hashchange`, `popstate`, `basePath`, query strings e
  proteção contra prefixos semelhantes.
- Lifecycle idempotente `start()`/`stop()`, loading imediato, `aria-busy`,
  proteção contra navegações obsoletas e hooks isolados; `start()`/`stop()`
  agora também disparam `plugins.init()`/`plugins.finalize()` (ver API de
  plugins abaixo) sem alterar o registro síncrono dos listeners do router.
- Fake adapter sem rede para artigos, categorias, menus e tags, com publicação,
  expiração, busca, paginação, ordenação segura, desempate determinístico,
  limite de tags populares, filtro por ano/mês (`listArchive`/
  `listArticles({year, month})`) e cópias defensivas.
- Content service com páginas normalizadas, tolerância a adapters parciais ou
  ausentes, e os métodos `archive`/`archiveMonths` para a rota de arquivo.
- Módulos de menu, breadcrumbs, artigos recentes, artigos por categoria,
  artigos relacionados por tags, tags populares, destaques (`mod_articles_news`,
  via filtro `featured` em `listArticles`), **arquivo** (`mod_articles_archive`,
  `src/libraries/minijoomla/modules/content-runtime.js` função `articlesArchiveModule`) e **HTML
  personalizado** (`mod_custom`, `customHtmlModule`, configurado via
  `config.customHtml` em `src/libraries/minijoomla/core/config.js`, reaproveitando `sanitizeHtml`);
  registry com posições, ordem, habilitação, validação e isolamento.
- **API de plugins** (`src/libraries/minijoomla/plugins/manager.js`, `createPluginManager`):
  registro declarativo (`register({ name, events })`, nunca uma
  string/script avaliado), `onContentPrepare` (filtro de texto de artigo),
  `onSearchPrepare` (filtro do termo de busca), `onAppInit`/`onAppFinalize`
  (ciclo de vida da aplicação). `createApplication` aceita `plugins: []`;
  um handler que lança erro não interrompe a cadeia nem a renderização.
- Views tolerantes a view models esparsos.
- Sanitização de HTML e URLs, incluindo bloqueio de esquemas executáveis,
  protocol-relative URLs, credenciais e caracteres de controle.
- Configuração normalizada (`basePath`, `pageSize` 1–50, `customHtml`,
  defaults e timezone).
- EventBus com validação de listener e unsubscribe.
- Busca acessível, paginação, tags, loading/empty/error/404.
- Documentação de equivalência Joomla, aceite local e integração futura.
- Marco A de `docs/INTEGRATION-SPMIDDLE.md` concluído: contrato de leitura dos
  adapters de conteúdo congelado em `docs/CONTRACTS-MINIJOOMLA.md` e verificado
  por suíte de conformidade reutilizável (`tests/adapter-contract.test.js`),
  executada com sucesso contra o `FakeAdapter` de referência.
- Adapter SPMIDDLE local em `src/libraries/minijoomla/infrastructure/spmiddle-adapter.js`, baseado em
  repositories injetados, sem rede e sem import de SharePoint na camada visual
  — já inclui o mesmo filtro de arquivo (`listArchive`/`year`/`month`) do
  `FakeAdapter`, mantendo os dois adapters com contrato idêntico.
- Testes do adapter SPMIDDLE em `tests/spmiddle-adapter.test.js`, incluindo
  mapeamento, visibilidade, paginação, tags, menus, arquivo, `now` por
  chamada e erros.
- Integração local real com os pacotes do SPMIDDLE (sem rede, sem alterar
  `spmiddle-adapter.js`): schemas próprios do MINIJOOMLA em
  `src/libraries/minijoomla/infrastructure/spmiddle-schemas.js` (`defineListSchema`), registro de
  data sources em `src/libraries/minijoomla/infrastructure/spmiddle-data-sources.js`
  (`createDataSourceRegistry`), repositories reais em
  `src/libraries/minijoomla/infrastructure/spmiddle-repositories.js` (`createMapper`+
  `createRepository`) e composição em
  `src/libraries/minijoomla/composition/createMiniJoomlaSharePointApp.js`, que injeta esses
  repositories reais em `createSPMiddleAdapter` sem modificá-lo. Validado por
  `tests/spmiddle-integration.test.js` com um transporte fake em memória
  (mesmo contrato `request()` do transporte REST real), cobrindo
  schema→registry→repository→adapter→content service e o fluxo
  `inspect→apply→verify` do `createProvisioningManager` contra o schema
  `MiniJoomlaArticles`. `createApplication` continua usando `createFakeAdapter()`
  por padrão; a nova composição é aditiva.
- **Parte 2 concluída e publicada (01/11/2026):** leitura real (Marco C) e
  escrita controlada e sintética com ETag (Marco D, incluindo conflito
  HTTP 412 confirmado) validadas contra o site de teste técnico corporativo
  autorizado `https://petrobrasbr.sharepoint.com/teams/SAPScripting`, usando
  4 listas de teste dedicadas (`TesteMiniJoomla*`). O pacote estático real
  (MINIJOOMLA + módulos SPMIDDLE necessários) foi publicado em
  `/teams/SAPScripting/SiteAssets/minijoomla/releases/0.1.0/` e ligado à
  página `SitePages/MiniJoomla.aspx` via Modern Script Editor existente
  (nunca sobrescrevendo o `.aspx`), validado com reload real e evidência
  visual em 320/768/1366/1920px. Três incidentes reais foram encontrados e
  corrigidos durante essa publicação (efeito colateral de módulo
  sobrescrevendo a página, rota `home` sem guarda contra categoria ausente,
  cache de CDN preso em revisão antiga) — detalhes completos em
  `docs/INTEGRATION-SPMIDDLE.md` §9 e `docs/CHECKLIST-CONCLUSAO-MINIJOOMLA.md`
  §6.2/§8.1. Zoom 200/400% e `forced-colors` continuam fora do escopo
  (lacuna de ferramental documentada, não de implementação).
- Runbook e checklist de release em `docs/RELEASE-MSE-0.1.0.md` e
  `docs/CHECKLIST-CONCLUSAO-MINIJOOMLA.md`.
- Harness de diagnóstico/publicação reutilizável em `tmp/mj_harness.py`
  (snapshot de saúde da página real, leitura/escrita genérica de
  `CanvasContent1`, execução de expressão JS na sessão autenticada) e
  scripts de provisionamento/Marco C-D em `tmp/mj-provision-*.mjs`,
  `tmp/mj-marco-c-read.mjs`, `tmp/mj-marco-d-write.mjs`.
- **Painel administrativo completo** (`src/administrator/components/com_minijoomla/`), extensão pós-fase-1
  pedida explicitamente pelo usuário: app separado (próprio
  `documentRef`/router, nunca compartilha página com `src/index.js`),
  cobrindo a estrutura do `administrator/` real do Joomla **exceto ACL**
  (`com_content`/`com_categories`/`com_tags`/`com_menus`/`com_config`/
  `com_modules` equivalentes; nunca `com_users` nem `com_installer`
  upload/execução de código). CRUD validado por forma
  (`src/libraries/minijoomla/application/admin-service.js`), descoberta de extensão por
  varredura de pasta convencional (`extension-discovery-service.js`,
  equivalente ao Discover real, nunca upload), carregamento dinâmico de
  módulo/plugin (`src/libraries/minijoomla/modules/dynamic-modules.js`, estritamente
  aditivo), seletores relacionais em formulários (categoria/extensão
  como `<select>` real, tags como multiselect), confirmação de
  exclusão, busca/paginação em listagens, abas ARIA na configuração do
  site. Publicado e validado contra o tenant real em
  `SitePages/Administrator.aspx` (página separada da pública
  `MiniJoomla.aspx`, criada pelo usuário — um hash na mesma página
  pública não cria barreira real de acesso). Três schemas novos
  (`MiniJoomlaExtensions`/`MiniJoomlaModuleInstances`/
  `MiniJoomlaSiteConfig`) provisionados nas 7 listas reais de teste de
  `/teams/SAPScripting`. Dois achados reais de tenant encontrados e
  corrigidos (`findMany()` do SPMIDDLE nunca anexa ETag; colisão do
  campo customizado `Author` com o campo nativo "Created By",
  renomeado para `Author0` pelo próprio SharePoint) — detalhes em
  `docs/INTEGRATION-SPMIDDLE.md` §12.
- **Rework visual do painel administrativo para a estrutura/paleta REAL
  do template Atum do Joomla** (02/11/2026, decisão explícita do
  usuário — nunca a identidade Petrobras, que fica reservada ao
  template do site público): header e sidebar compartilham a mesma
  família de azul-marinho real (`#132f53`), toolbar/tabela com fundo
  claro, badges de estado pequenos com ícone (nunca "pills" sólidos),
  botões com cor só até o hover, incluindo o vermelho real `#c52827`
  para exclusão/erro — única exceção documentada à paleta Petrobras,
  restrita a este painel. Ícones SVG próprios (`src/administrator/components/com_minijoomla/icons.js`)
  reconstroem a mesma silhueta dos ícones Font Awesome 6 reais do Atum,
  sem vendorizar a biblioteca. Publicado e revalidado contra o tenant
  real; achado real repetido documentado: o `<link>` do CSS no
  `CanvasContent1` usa query string fixa, nunca incrementada
  automaticamente — exige incremento manual (`?v=N`) a cada publicação
  que troque o conteúdo do CSS. Detalhes completos em
  `docs/INTEGRATION-SPMIDDLE.md` §13–§15 e
  `docs/CHECKLIST-CONCLUSAO-MINIJOOMLA.md` §8.2–§8.6.
- **Correção estrutural do painel** (02/11/2026, achado real do
  usuário comparando com capturas de tela de um Joomla 6.2.0 real):
  sidebar reescrita como árvore de 2 níveis (`has-arrow`/
  `mm-collapse`/`mm-show`, igual ao `mod_menu` real, com "Tags" em
  "Componentes" replicando a ausência real de `com_tags` no preset de
  menu real); painel de controle reescrito como cards
  ícone-acima/texto-abaixo agrupados em "Site"/"Sistema"
  (`QuickIconHelper.php` real); badges de estado com texto
  substituídos por ícones circulares sem texto visível
  (`.admin-state-icon`, 26px, mesma medida do `.tbody-icon` real).
  Publicado e revalidado contra o tenant real (`?v=4` no CSS).
  Detalhes completos em `docs/INTEGRATION-SPMIDDLE.md` §16 e
  `docs/CHECKLIST-CONCLUSAO-MINIJOOMLA.md` §8.7.
- **Dois bugs visuais reais corrigidos e editor de texto rico real
  (TinyMCE) introduzido** (02/11/2026, supervisão geral do usuário —
  "o menu e o conteúdo das tabelas ainda estão precisando de ajustes",
  seguido de prioridade alta explícita sobre a falta de editor de
  texto formatado): `.visually-hidden` nunca definido em `admin.css`
  (texto de leitor de tela sobreposto aos ícones de estado); links de
  nível 2 da sidebar sem cor branca por um combinador CSS de filho
  direto incompleto — ambos corrigidos. TinyMCE 7.9.1 self-hosted real
  vendorizado em `src/media/vendor/tinymce/` (licença
  GPL-2.0-or-later confirmada, a mesma do `plg_editors_tinymce` do
  Joomla real; árvore minimal ~1.24 MB, preset "simple" real) nos
  dois únicos campos que o site público trata como HTML real
  (`fulltext` de Artigos, `customHtmlBody` da configuração) —
  confirmado por varredura de todo `sanitizeHtml(` no código, nunca
  em `introtext`/`description`/`siteDescription` (texto puro).
  Terceiro bug real encontrado e corrigido durante a própria
  validação: um editor dentro de uma aba que nasce oculta media 0×0 e
  nunca se recalculava — corrigido adiando sua inicialização até a
  aba ser revelada. **Comitado e republicado/revalidado no tenant
  real** (CSS `?v=6`, 51 arquivos publicados). Detalhes completos em
  `docs/INTEGRATION-SPMIDDLE.md` §17 e
  `docs/CHECKLIST-CONCLUSAO-MINIJOOMLA.md` §8.8.

### Baseline

Executar no diretório do projeto:

```powershell
npm test
npm run check
git diff --check
```

Última evidência local (02/11/2026): **119 verificações aprovadas no
total** via `node tests/run-tests.js` (inclui `core.test.js`,
`static-ui.test.js`, a suíte de conformidade, o adapter SPMIDDLE, a
integração local real, a tradução de erro de transporte, e as suítes
do painel administrativo — `admin-service`, `extension-discovery-service`,
`dynamic-modules`, `admin-render` com 11 testes,
`admin-app` com 12 testes); sintaxe de **52 arquivos
JavaScript** aprovada e `git diff --check` sem erros nos arquivos do
MINIJOOMLA (só avisos de CRLF/LF).

Comandos equivalentes, caso `npm.ps1` seja bloqueado pelo PowerShell:

```powershell
node tests/run-tests.js
node scripts/check-syntax.js
git diff --check
```

### Estado Git conhecido no handoff

`main` sincronizada com `origin/main` até o commit `9737c79`, mais um
commit adicional de evidência de publicação real (`tmp/release-stage/`)
a ser feito ao final desta sessão. Alterações em submódulos do
repositório agregador (`HH-web`, `PCI`, `SPMIDDLE`, `hub-ai`,
`CAMAP2`) pertencem a outras frentes e não devem ser tocadas. Não
executar `reset --hard`, `checkout --` ou limpeza ampla. Revisar
sempre:

```powershell
git status --branch --short
git diff --stat
git ls-files --others --exclude-standard
```

Arquivos principais desta frente:

```text
docs/CHECKLIST-CONCLUSAO-MINIJOOMLA.md
docs/CONTRACTS-MINIJOOMLA.md
docs/INTEGRATION-SPMIDDLE.md
docs/JOOMLA-EQUIVALENCE.md
docs/RELEASE-MSE-0.1.0.md
src/libraries/minijoomla/core/format.js
src/components/archive.js
src/libraries/minijoomla/plugins/manager.js
src/libraries/minijoomla/infrastructure/fake-adapter.js
src/libraries/minijoomla/infrastructure/spmiddle-adapter.js
src/libraries/minijoomla/infrastructure/spmiddle-schemas.js
src/libraries/minijoomla/infrastructure/spmiddle-data-sources.js
src/libraries/minijoomla/infrastructure/spmiddle-repositories.js
src/libraries/minijoomla/composition/createMiniJoomlaSharePointApp.js
src/libraries/minijoomla/composition/createMiniJoomlaAdminApp.js
src/libraries/minijoomla/modules/content-runtime.js
src/libraries/minijoomla/modules/dynamic-modules.js
src/index.js
src/administrator/components/com_minijoomla/app.js
src/administrator/components/com_minijoomla/field-schemas.js
src/administrator/components/com_minijoomla/render-shell.js
src/administrator/components/com_minijoomla/render-list.js
src/administrator/components/com_minijoomla/render-form.js
src/administrator/components/com_minijoomla/icons.js
src/media/templates/administrator/atum/css/template.css
src/administrator/components/com_minijoomla/editor.js
src/media/vendor/tinymce/
src/libraries/minijoomla/application/admin-service.js
src/libraries/minijoomla/application/extension-discovery-service.js
examples/admin.html
tests/core.test.js
tests/spmiddle-adapter.test.js
tests/spmiddle-integration.test.js
tests/admin-app.test.js
tests/admin-render.test.js
tmp/mj_harness.py
tmp/mj_admin_harness.py
```

### Navegador

Foram validados com instâncias isoladas próprias do FIORI-AUTO: cinco rotas,
320/768/1366/1920 px, foco, idioma, títulos, busca, 404, overflow e links
internos sem `javascript:`/`data:` — e, na Parte 2, a própria página real
`SitePages/MiniJoomla.aspx` nos mesmos quatro breakpoints (ver
`tmp/visual-evidence/`).

O servidor local para teste é:

```text
http://127.0.0.1:8782/examples/index.html
```

Ele pode parar entre sessões. Verificar antes de informar disponibilidade:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8782/examples/index.html
```

Iniciar, se necessário:

```powershell
python -m http.server 8782 --bind 127.0.0.1
```

As três novas capacidades (`#/archive`/`mod_articles_archive`, HTML
personalizado, API de plugins) foram validadas no navegador real via
FIORI-AUTO em 01/11/2026 (instância isolada RPC 47177/perfil `minijoomla`,
reaproveitada sem tocar na aba já aberta de `SitePages/MiniJoomla.aspx`,
restaurada ao final sem nenhuma escrita remota): rota `#/archive` lista os
meses corretamente e filtra por `?year=&month=`; `customHtmlModule` escapa o
título e remove `<script>`/atributos de evento inline mantendo tags
permitidas (`<strong>`); `onContentPrepare`/`onSearchPrepare` transformam
`introtext` e o termo de busca de ponta a ponta. Evidência visual em
320/768/1366/1920px salva em `tmp/visual-evidence-local/` (arquivo, arquivo
filtrado, HTML personalizado + plugins). O arquivo HTML ad hoc usado para
exercitar `config.customHtml`/`plugins` foi removido após a captura — não é
parte permanente de `examples/`.

## 3. Pendências reais

Não declarar como concluídos sem evidência: zoom efetivo de 200%/400%,
`forced-colors`/alto contraste efetivo (lacuna de ferramental do FIORI-AUTO,
documentada em `tmp/mj-visual-evidence.py`), e provisionamento/escrita em
listas de **produção** (distintas das listas de **teste** já validadas na
Parte 2). A inspeção visual real das três capacidades mais recentes
(`#/archive`, HTML personalizado, plugins) foi concluída em 01/11/2026 (ver
§2 "Navegador").

Pendências específicas do painel administrativo, deixadas deliberadamente
sem resolução nesta frente:

- **Controle de acesso a `Administrator.aspx`** (restringir a uma única
  conta via permissão própria do SharePoint na página) — explicitamente
  adiado pelo usuário para a etapa do "site definitivo". Não revisitar
  sem o usuário levantar o assunto de novo.
- **Descoberta de extensões não habilitada na publicação real** —
  `extensionsFileClientFactory` omitida no bootstrap do admin; a aba
  "Extensões" mostra a mensagem informativa correta em vez de listar
  manifestos novos. Habilitar exigiria publicar também o pacote
  `sharepoint-files` do SPMIDDLE (ainda não publicado) e uma pasta
  `extensions/` dedicada no `RELEASE_BASE`.
- **Permissão de escrita das 7 listas reais** (`TesteMiniJoomla*`)
  continua herdada do site (`HasUniqueRoleAssignments: false`) — não
  alterada nem avaliada como ação pendente, por decisão explícita do
  usuário.

Também revisar em `docs/JOOMLA-EQUIVALENCE.md` §4: indexação avançada
(ranking/relevância de busca), feed, edição, upload e ACL continuam fora da
fase 1 — não foram implementados nem estão implicitamente cobertos pela API
de plugins. O contrato final de ports, `Result`, erros e convenção de `ref`
já está congelado em `docs/CONTRACTS-MINIJOOMLA.md`. Timeout e retry remoto
são delegados ao transporte do SPMIDDLE (`createSharePointRestClient`) e não
precisam de reimplementação própria; tradução de erro de transporte para
erro de domínio já concluída (`src/libraries/minijoomla/infrastructure/spmiddle-error-translation.js`,
ver `docs/INTEGRATION-SPMIDDLE.md` §10).
Não inventar escopo ou comportamento de produção para fechar essas lacunas.

## 4. Fronteiras e decisões obrigatórias

O MINIJOOMLA não importa nem conhece SharePoint, REST, Graph, SPMIDDLE,
`mse-platform`, listas `mse*`, cookies, tokens, ETags ou URLs internas.

```text
dados → adapter/ports → casos de uso → view models → componentes → template
```

Fake adapter e adapter SPMIDDLE com repositories reais, ambos sem ACL,
dados editoriais permanentes ou alterações em `Default.aspx`. A escrita já
validada (Marco D) foi exclusivamente sintética e contra uma lista de
**teste** (`TesteMiniJoomlaArtigos`), nunca produção — não a trate como
precedente para escrita editorial real sem nova autorização e contrato
próprio (ver `docs/CHECKLIST-CONCLUSAO-MINIJOOMLA.md` §8).

O plano em `docs/INTEGRATION-SPMIDDLE.md` tem Marco A (contratos, concluído),
Marco B (adapter de leitura isolado, concluído), Marco C (leitura remota,
concluída contra listas de teste) e Marco D (escrita, concluída de forma
sintética contra lista de teste). Produção real (schemas/listas de
produção, conteúdo editorial, `Default.aspx`) continua exigindo autorização
operacional explícita e não deve ser inferida deste handoff.

## 5. Regras do workspace

Ler antes de trabalhar:

```text
C:\PROJETOS\VSTO\AGENTS.md
C:\PROJETOS\VSTO\AI_CONTEXT.md
C:\PROJETOS\VSTO\web-devs\AGENTS.md
C:\PROJETOS\VSTO\web-devs\AI_CONTEXT.md
C:\PROJETOS\VSTO\web-devs\_docs\IDENTIDADE-PETROBRAS.md
C:\PROJETOS\VSTO\web-devs\_docs\DIRETRIZ-FIORI-AUTO-OBRIGATORIA.md
```

Preservar alterações de terceiros; não usar `git reset --hard`, `git checkout
--` ou exclusões amplas; não versionar segredos; não contornar TLS/proxy/DLP;
usar feeds JFrog para restore/install; executar `git diff --check`; manter o
histórico de cada projeto; não confundir o status do agregador com o do projeto.

### Arquivos de outra frente

Preservar estes caminhos não rastreados:

```text
docs/PLANO-MINIJOOMLA.md
host-adapters/
theme/
```

Não apagar, mover, adicionar ou reformatar sem instrução da frente responsável.

## 6. Coordenação por LLMs e agentes

O coordenador define escopo, integra commits e responde pelo aceite. Delegar
somente frentes independentes com ganho real; não permitir escritas concorrentes
no mesmo arquivo.

### Modelos obrigatoriamente distintos

Coordenador, executores e revisor devem usar modelos diferentes. Arranjo
possível:

- coordenador/revisor: `hub-opencode-openai/gpt-5.6-luna` ou
  `hub-opencode-anthropic/claude-sonnet-5`;
- executores: `hub-opencode-openai/gpt-5-2-petrobras` ou
  `hub-opencode-anthropic/claude-haiku-4-5`;
- quando houver revisor, ele deve usar LLM diferente do executor.

#### Disponibilidade homologada

Somente os quatro modelos abaixo devem ser selecionados nesta continuidade:

Assim, as opções homologadas relevantes são:

```text
hub-opencode-openai/gpt-5.6-luna
hub-opencode-openai/gpt-5-2-petrobras
hub-opencode-anthropic/claude-sonnet-5
hub-opencode-anthropic/claude-haiku-4-5
```

O coordenador deve verificar a disponibilidade real antes de delegar. Se forem
necessários três papéis simultâneos (coordenador, executor e revisor), usar
variantes/modelos GPT e Claude Sonnet distintos quando a plataforma permitir;
caso não seja possível manter três identificadores distintos, não simular a
separação: registrar a limitação e executar somente a coordenação/revisão que
estiver efetivamente disponível.

Se o Hub rejeitar uma delegação, registrar a indisponibilidade; nunca declarar
uma revisão ou execução que não ocorreu.

Se um modelo não estiver disponível no catálogo atual, registrar a
indisponibilidade e não simular uma revisão que não ocorreu.

### Worktrees e commits

1. Verificar status e alterações alheias.
2. Criar worktree para cada frente que possa conflitar:

   ```text
   tools.opencode.worktree_create({ name: "minijoomla-<frente>" })
   ```

3. Cada executor altera somente seus arquivos e cria commit pequeno.
4. Rodar testes relevantes e `git diff --check` antes do commit.
5. Coordenador revisa e integra sem reescrever histórico.
6. Revisor executa suíte completa após integração.
7. Não remover worktree modificada sem confirmação explícita.

Divisão sugerida: contratos/ports; módulos Joomla restantes; acessibilidade e
visual; revisão read-only. Executores nunca usam o modelo do coordenador nem do
revisor.

## 7. Continuidade operacional

1. Ler este documento, `README.md`, `PROMPT-DESENVOLVIMENTO-MINIJOOMLA.md`,
   `docs/JOOMLA-EQUIVALENCE.md`, `docs/ACCEPTANCE-CHECKLIST.md`,
   `docs/CONTRACTS-MINIJOOMLA.md`, `docs/INTEGRATION-SPMIDDLE.md`,
   `docs/RELEASE-MSE-0.1.0.md` e `docs/CHECKLIST-CONCLUSAO-MINIJOOMLA.md`.
2. Executar baseline:

   ```powershell
   Set-Location C:\PROJETOS\VSTO\web-devs\MINIJOOMLA
   git status --branch --short
   git log -5 --oneline
    node tests/run-tests.js
    node scripts/check-syntax.js
   git diff --check
   ```

3. Escolher uma lacuna, documentando escopo, arquivos, contrato, testes,
   evidência e rollback antes de implementar.
4. Alterações de UI/rota/CSS exigem nova validação pelo FIORI-AUTO.
5. Não fazer ações externas sem confirmar `WEB_URL`, `RELEASE_BASE`, página
   de validação e página de publicação; não inferir destino a partir de outro
   projeto.

Para navegador, usar obrigatoriamente o binário publicado .NET 9 em
`app-devs/FIORI-AUTO/fiori-agent-src/FioriAgent/bin/Release/net9.0/win-x64/publish/FioriAgent.exe`,
com RPC, CDP e `--user-data-dir` próprios. Não usar Selenium, Playwright direto,
CDP avulso ou navegador genérico.

## 8. Critérios de conclusão

Concluir a fase local somente quando capacidades incluídas tiverem implementação
e teste, lacunas estiverem explícitas, `npm test`, `npm run check` e
`git diff --check` passarem, documentação refletir os fatos e a validação
navegável for repetida após alterações de UI. O aceite local não equivale a
prontidão para SharePoint ou produção.

## 9. Rollback

Rollback desta frente (três capacidades Joomla locais) é local e reversível:

```powershell
git log --oneline
git revert <commit-da-frente>
npm test
npm run check
git diff --check
```

Nunca usar reset destrutivo e nunca apagar os caminhos não rastreados da outra
frente. Rollback da Parte 2 (publicação real em `/teams/SAPScripting`) é
diferente: preservar a release anterior, alterar a composição para o
artefato anterior ou para `FakeAdapter`, nunca sobrescrever pastas imutáveis
do `SiteAssets`, e seguir o procedimento específico já documentado em
`docs/RELEASE-MSE-0.1.0.md` (seção "Rollback"). Qualquer nova publicação ou
provisionamento de lista de **produção** exige autorização operacional
explícita e procedimento próprio do SPMIDDLE/host autorizado — não inferir
do que já foi feito contra as listas de **teste**.

## 10. Referências canônicas

- `README.md`
- `PROMPT-DESENVOLVIMENTO-MINIJOOMLA.md`
- `docs/JOOMLA-EQUIVALENCE.md`
- `docs/ACCEPTANCE-CHECKLIST.md`
- `docs/INTEGRATION-SPMIDDLE.md`
- `docs/CONTRACTS-MINIJOOMLA.md`
- `src/index.js`
- `src/libraries/minijoomla/core/router.js`, `config.js`, `events.js`, `format.js`
- `src/libraries/minijoomla/application/content-service.js`
- `src/libraries/minijoomla/infrastructure/fake-adapter.js`
- `src/libraries/minijoomla/security/sanitize.js`
- `src/libraries/minijoomla/plugins/manager.js`
- `src/components/archive.js`
- `src/libraries/minijoomla/modules/content-runtime.js`
- `tests/core.test.js` e `tests/static-ui.test.js`
- `tests/adapter-contract.test.js`, `tests/spmiddle-adapter.test.js` e
  `tests/spmiddle-integration.test.js`
- `src/libraries/minijoomla/infrastructure/spmiddle-schemas.js`, `spmiddle-data-sources.js`,
  `spmiddle-repositories.js`, `spmiddle-error-translation.js`
- `src/libraries/minijoomla/composition/createMiniJoomlaSharePointApp.js`,
  `createMiniJoomlaAdminApp.js`
- `src/administrator/components/com_minijoomla/app.js`, `field-schemas.js`, `render-shell.js`,
  `render-list.js`, `render-form.js`, `icons.js`, `admin.css`,
  `editor.js`
- `src/media/vendor/tinymce/` (TinyMCE 7.9.1 self-hosted, licença
  GPL-2.0-or-later — nunca modificar manualmente, só re-baixar a
  mesma árvore minimal se precisar trocar de versão)
- `src/libraries/minijoomla/application/admin-service.js`,
  `extension-discovery-service.js`
- `tests/admin-app.test.js`, `tests/admin-render.test.js`
- `examples/admin.html` (harness local, agora passa
  `richTextEditorFactory` apontando para `src/administrator/components/com_minijoomla/vendor/tinymce`)
- `docs/RELEASE-MSE-0.1.0.md`
- `tmp/mj_harness.py`, `tmp/mj_admin_harness.py` e
  `tmp/mj-visual-evidence.py`
- `web-devs/JOOMLA/administrator/templates/atum/` (referência
  estrutural/visual real do painel administrativo — nunca copiar
  literalmente PHP/SCSS)
- `app-devs/FIORI-AUTO/README.md` e `docs/api-rpc.md`
- `web-devs/docs/DIRETRIZ-FIORI-AUTO-OBRIGATORIA.md`

# MINIJOOMLA — checklist de conclusão

**Atualizado em:** 05/11/2026 — núcleo em estabilização; separação administrativa, integração de plugins e aceites finais ainda pendentes. Evidências de 01/11 abaixo são históricas.
**Escopo:** acompanhamento da conclusão do MINIJOOMLA, desde a fase local até a integração autorizada com SPMIDDLE/SharePoint.  
**Regra:** marcar um item somente quando houver implementação e evidência registrada. A conclusão da fase local não autoriza publicação em SharePoint.

## Estado atual — 05/11/2026

- Release ativa documentada **0.6.0**, runtime `e869f3c`, **202 arquivos**;
  pacote piloto corpmessage 0.1.1 disponível para Registrar. Ver
  `PUBLICACAO-JOOMLA-XML-0.6.0.md` para evidências/rollback da outra equipe.
  Aceite real instalar/habilitar/instanciar/atualizar/reverter continua pendente;
  esta rodada não acessou o tenant nem publicou os novos formulários.
- Histórico **0.5.1**, fonte `32435a8`, publicada com autorização do usuário
  em `MiniJoomla.aspx` e `Administrator.aspx`: **187 arquivos**, upload e
  releitura independente sem divergências de SHA-256, MIME JS/CSS validado.
  Reload do público/painel/editor TinyMCE aprovado no smoke final, sem falhas
  de recursos. Houve 503 inicial no público, resolvido com recarga. Não houve
  E2E de escrita editorial nem aceite nativo/assistivo nesta publicação.
  Esquema e dados editoriais não alterados; canvas anterior salvo para rollback.
- Release 0.5.0 publicada por `rinaldops` em duas páginas: 180 arquivos, hashes
  verificados duas vezes. Host teve smoke test de carregamento; escrita
  end-to-end não foi testada nessa publicação.
- Commit `9feebf9` moveu fontes e release para a árvore Joomla na raiz, sem
  prefixo `app/`. A separação do painel em diretórios `administrator/components/com_*`
  permanece incompleta; hoje há `com_minijoomla`.
- Incremento agora publicado na 0.5.1: seis layouts compartilhados em
  `src/layouts/joomla/` e editor de artigo em `com_content/tmpl/article/edit.js`,
  mantendo reexport no caminho anterior.
- Save hooks por injeção opt-in ligados ao CRUD de artigos; beforeSave
  transforma/veta e afterSave é observacional. Testes cobrem criar/editar,
  duplicar/lote, veto, falha de persistência, isolamento e ETags não enumeráveis.
  O host ainda não carrega plugins administrativos persistidos.
- Os 15 XML de módulos nativos agora são gerados no estágio a partir do catálogo
  administrativo, incluindo defaults/limites/opções e versão da release.
  Manifestos de plugins/templates continuam estáticos; descoberta de terceiros
  não foi alterada.
- Incremento local posterior à 0.5.1: modelo editorial e tabela de artigos
  separados em `com_content`; tabela de arquivos em `com_media`; modelo de menu
  em `com_menus`, mantendo a API antiga por reexport. Controllers/bindings e os
  demais componentes ainda não estão inteiramente separados.
- Nova rodada local: configuração em `com_config`, descoberta/cadastro em
  `com_installer` e `com_templates`. Metadados vêm do snapshot da descoberta,
  não dos atributos do botão; navegação/stop invalidam callbacks antigos.
  Cadastro em andamento não pode ser desfeito, mas sua conclusão obsoleta não
  recarrega nem escreve mensagens na tela nova. Nenhum contrato JSON alterado.
- Verificação local após integrar as frentes e separar módulos/plugins/estilos:
  **72 suítes/0 skips/0 falhas**, sintaxe de **244 JS**, seleção contributor de
  **304 arquivos**; estágios core/site/all com **143/118/215** arquivos declarados.
  Formulários de módulo, plugin, estilo e opções, catálogo de tipos e tela de
  gerenciamento extraídos para views reais dos componentes; 19 cenários com
  HTML idêntico ao checkpoint `d927a3f`. Bindings, ETag e submissão mantidos.
  Reenvios do mesmo formulário durante a gravação agora são ignorados, com
  liberação no finally para permitir retry após erro. Não altera o ETag nem
  substitui a concorrência otimista do servidor.
  Proteção de navegação ampliada: callbacks antigos após navegar/stop não
  iniciam escrita, e respostas tardias não recarregam/reportam na tela nova.
  Confirmação de exclusão e leitura assíncrona de arquivos são revalidadas antes
  da mutação; gravações já iniciadas podem concluir normalmente.
  Tabelas de módulos, plugins e estilos e a pré-visualização de posições saíram
  de `extension-pages.js` com HTML idêntico em 8 cenários.
  Descoberta XML (scanReport, instalar/atualizar/reverter) reconciliada dentro
  do controller extraído: HTML idêntico ao `origin/main` em 9 cenários.
  Listagens de categorias e tags extraídas para `com_categories`/`com_tags`:
  HTML idêntico ao checkpoint `bc060af` em 8 cenários, incluindo lista vazia,
  árvore indentada, lixeira, contagens zeradas e valores hostis escapados.
  HTML idêntico em 12 casos anteriores com fonte publicada e em 11 novos
  cenários de configuração/descoberta com o checkpoint `ae59d51`.
  Modelos/views passaram também em UTC, São Paulo e Tóquio; teste de ação da
  tabela confirma recusa de ETag desatualizado sem sobrescrita nem falso sucesso.
- Configuração: ETag capturado preservado; controles ausentes/disabled/readonly
  não sobrescrevem valores. Descoberta de templates: testes de metadados
  adulterados, confirmação, duplo clique, erros de leitura/cadastro, navegação e
  stop; falhas de consulta agora apresentam mensagem segura com possibilidade de retry.
- Mídia, melhoria local independente: conteúdo vazio, acima de 10 MiB, objeto
  com tag ArrayBuffer forjada ou MIME herdado do protótipo não chega ao transporte.
  Subarrays/DataViews de outro realm mantêm apenas seus bytes e MIME canônico;
  URL inválida na confirmação é reportada sem repetir um upload já iniciado.
- Verificação editorial ampliada: títulos vazios e IDs duplicados geram avisos;
  links com nomes genéricos geram informação. Entidades numéricas/brancas,
  alternativas de imagens, ARIA e IDs exatos têm contraprovas. Comentários e
  blocos completos de script/style não viram conteúdo analisado. Sem escrita,
  rede, execução de HTML ou bloqueio de salvamento; não é aceite assistivo.
- Compatibilidade XML e estrutura administrativa integradas em `d927a3f`;
  trabalho atual em main. Alterações CAMAP2 locais pertencem à outra equipe.
  Mudanças profundas nos contratos compartilhados exigem sinalização prévia.
- Worktrees 01/02 removidas a pedido do usuário; snapshots em branches
  preservados, resíduos históricos da 02 arquivados no tmp ignorado da principal.
  Conferência de Git/arquivos não substitui aceite de navegador ou publicação.
- Revisão independente GPT sem achados demonstráveis no escopo inspecionado.
  Essa rodada não publicou nem alterou dados remotos; a release documentada
  permanece na 0.6.0 (não revalidada nesta rodada).
- Runner nativo: diagnóstico sanitizado por etapa, captura de rejeições na página
  e ferramentas Windows com caminho absoluto. Execução local bloqueada na prova
  de posse do listener; cleanup dos processos próprios passou. Não há aceite
  nativo de layout nesta rodada (ver detalhes no prompt de retomada).
- Permanecem pendentes: geração dos demais manifestos, funcionalidades Joomla
  ainda ausentes, aceites reais de zoom/
  reflow, `forced-colors`, `reduced-motion` e leitor de tela; integração dos
  plugins administrativos persistidos ao host e conclusão da validação nativa.
- A publicação alterou somente assets novos e os dois canvas autorizados; não
  alterou dados editoriais. Consulte
  `PROMPT-RETOMADA-MINIJOOMLA-2026-11-05.md`
  para o resumo de continuidade e `OPEN-SOURCE-READINESS.md` para gates de
  distribuição.

## Como usar

- `[ ]` pendente;
- `[x]` concluído com evidência;
- `[~]` em andamento ou parcialmente concluído;
- registrar o commit, teste ou evidência ao lado do item quando ele for concluído;
- não executar provisionamento, leitura remota ou publicação sem autorização explícita para o destino correto.

## 1. Recuperação e baseline do projeto

- [x] Reconciliar o `HANDOFF-DESENVOLVIMENTO.md` com o histórico Git atualmente disponível. — Reconciliado em 01/11/2026: referências ao commit `797255b` (não mais `fb0dd2d`/`89e86ec`), seção de rollback e navegador atualizadas para refletir a Parte 2 já concluída.
- [x] Confirmar branch, remoto, ponteiro de `origin/main` e existência de commits não publicados. — `main` sincronizada com `origin/main` em `797255b`, sem commits locais não publicados; há apenas alterações no working tree (não commitadas) desta sessão, listadas via `git status --branch --short`.
- [x] Inspecionar alterações do repositório agregador sem apagar ou reverter trabalho de terceiros. — `git status --short` confirma alterações em `../HH-web`, `../PCI`, `../SPMIDDLE`, `../hub-ai` pertencentes a outras frentes; nenhuma foi tocada, apagada ou revertida por este trabalho.
- [x] Executar a suíte local equivalente a `npm test` (`node tests/run-tests.js`): 106 verificações aprovadas em 01/11/2026 (68 em `core.test.js`; 2 em `static-ui.test.js` — inclui a nova verificação de acessibilidade/CSS responsivo do painel administrativo; 9 de conformidade; 27 do adapter SPMiddle; 5 de integração local real schema→registry→repository→adapter→content service; 2 da suíte isolada de tradução de erro; mais a extensão do painel administrativo desta sessão: 4 de `admin-service`, 3 de `extension-discovery-service`, 3 de `dynamic-modules`, 3 de `admin-render`, 7 de `admin-app`; sem rede em nenhum destes).
- [x] Executar a verificação de sintaxe equivalente a `npm run check` (`node scripts/check-syntax.js`): 44 arquivos aprovados em 01/11/2026 (novos desta sessão: `src/administrator/components/com_minijoomla/*.js`, `src/libraries/minijoomla/application/admin-service.js`, `src/libraries/minijoomla/application/extension-discovery-service.js`, `src/libraries/minijoomla/composition/createMiniJoomlaAdminApp.js`, `src/libraries/minijoomla/modules/dynamic-modules.js`, `src/libraries/minijoomla/infrastructure/spmiddle-test-schemas.js`, e os 5 arquivos de teste correspondentes).
- [x] Executar `git diff --check`: aprovado em 01/11/2026 (somente warnings de CRLF/LF).
- [x] Confirmar que o working tree contém somente alterações intencionais da entrega. — Confirmado: `docs/*`, `src/*`, `tests/*` modificados/criados são todos desta frente; `tmp/visual-evidence-local/` é evidência real gerada nesta sessão.
- [x] Atualizar este arquivo após cada marco concluído. — Mantido atualizado ao longo desta sessão (§2, §3, §3.1, "Critérios finais de conclusão").
- [x] Atualizar o handoff operacional com o estado real do código, testes, arquivos locais e regras de continuidade.
- [x] Criar runbook local da release `MSE 0.1.0` em `docs/RELEASE-MSE-0.1.0.md`, sem destino corporativo presumido.
- [x] Gerar artefato local `C:\Users\EAQU\AppData\Local\Temp\opencode\minijoomla-0.1.0.zip` (72.679 bytes); SHA-256 registrado no log da sessão.
- [x] Criar e executar `node scripts/release-check.js` para validar versão `0.1.0`, estrutura e placeholders corporativos sem inferir destino.

## 2. Aceite visual e acessibilidade local

- [x] Validar rotas principais em 320, 768, 1366 e 1920 px.
- [x] Validar navegação por teclado, skip link, `Tab`, `Shift+Tab`, busca e foco pós-navegação.
- [x] Validar landmarks, idioma, títulos, `aria-current`, `aria-live` e `aria-busy`.
- [x] Validar ausência de overflow horizontal nas larguras locais já cobertas.
- [ ] Validar zoom efetivo de 200%.
- [ ] Validar zoom efetivo de 400%.
- [ ] Validar reflow equivalente a 320 CSS px em zoom.
- [ ] Validar alto contraste/`forced-colors` em navegador.
- [x] Repetir a validação local após a última alteração de UI, se houver alteração visual. — Repetida em 01/11/2026 para as três capacidades novas (`#/archive`, HTML personalizado, plugins); ver §3.1.
- [x] Registrar evidências finais do aceite visual local. — Capturas em `tmp/visual-evidence-local/` e detalhamento em `docs/ACCEPTANCE-CHECKLIST.md` ("Evidência local parcial — FIORI-AUTO"); zoom 200/400% e `forced-colors` seguem fora do escopo coberto (ferramental do FIORI-AUTO não os emula nesta versão).

## 3. Completar capacidades Joomla-like opcionais da fase local

- [x] Decidir formalmente se `mod_articles_archive` permanece no escopo desta entrega. — Decisão: sim, já estava listado como "Escopo funcional mínimo" obrigatório em `PROMPT-DESENVOLVIMENTO-MINIJOOMLA.md` (seção "Módulos oficiais equivalentes"), não como item opcional sujeito a nova decisão.
- [x] Se permanecer no escopo, implementar `mod_articles_archive`. — `src/modules/mod_articles_archive/`, `src/libraries/minijoomla/infrastructure/fake-adapter.js`/`spmiddle-adapter.js` (`listArchive`, filtro `year`/`month` em `listArticles`), `src/components/com_content/tmpl/archive/default.js` (`renderArchive`), `src/libraries/minijoomla/core/format.js` (`formatMonthYear`), rota `#/archive` em `src/index.js`.
- [x] Testar loading, vazio, erro, ordenação temporal e escaping de `mod_articles_archive`. — `tests/core.test.js` ("archive module exposes loading, empty and ready states...", "fake adapter groups archived articles by year/month...", "application renders the archive route...", "application archive sidebar module tolerates an adapter without listArchive"); `tests/spmiddle-adapter.test.js` (mesmo agrupamento validado contra o adapter SPMIDDLE).
- [x] Decidir formalmente se o módulo de HTML personalizado permanece no escopo. — Decisão: sim, mesmo fundamento do item acima.
- [x] Se permanecer no escopo, implementar HTML personalizado sanitizado, sem scripts. — `src/libraries/minijoomla/modules/content-runtime.js` (`customHtmlModule`), configurado via `config.customHtml` (`src/libraries/minijoomla/core/config.js`), reaproveitando `sanitizeHtml` (`src/libraries/minijoomla/security/sanitize.js`) já usado por `renderArticle` — nunca uma fronteira de segurança nova ou paralela.
- [x] Decidir formalmente se a API de plugins permanece no escopo desta entrega. — Decisão: sim, mesmo fundamento do item acima.
- [x] Se permanecer no escopo, implementar plugins opt-in, declarativos e testáveis. — `src/libraries/minijoomla/plugins/manager.js` (`createPluginManager`); `register()` rejeita qualquer `events.<nome>` que não seja uma função, nunca executa string/configuração como script; `createApplication` aceita `plugins: []` (array vazio por padrão — nenhuma mudança de comportamento sem registro explícito).
- [x] Cobrir eventos de preparação/renderização de conteúdo e filtros de texto/links. — `onContentPrepare` (filtro de `introtext`/`fulltext` do artigo antes da sanitização final — também cobre filtro de link dentro do corpo, já que são HTML no mesmo texto) e `onSearchPrepare` (filtro do termo de busca, ponto de extensão de indexação/busca do prompt); `onAppInit`/`onAppFinalize` cobrem inicialização/finalização da aplicação. Testes: `tests/core.test.js` ("plugin manager chains onContentPrepare filters...", "plugin manager exposes a search-query filter pipeline...", "plugin manager broadcasts init/finalize...", "application applies a registered plugin to article introtext/fulltext...", "application invokes plugin init/finalize exactly once per start/stop...").
- [x] Manter busca avançada/indexação, feed, edição, upload e ACL explicitamente fora do escopo, salvo nova aprovação. — Nenhum dos itens acima foi implementado nem está implicitamente coberto pela API de plugins; seguem listados como lacuna em `docs/JOOMLA-EQUIVALENCE.md` §4.

### 3.1 Evidência visual real das três capacidades — navegador real (01/11/2026)

> Instância isolada do FIORI-AUTO já existente desta frente (`RPC 47177`,
> perfil `minijoomla`), reaproveitada sem tocar na aba
> `SitePages/MiniJoomla.aspx` real já aberta nela (deixada intocada durante
> toda a verificação, restaurada ao final por navegação simples, sem
> nenhuma escrita remota). Alvo: `examples/index.html` servido localmente
> (`http://127.0.0.1:8782`), não o SharePoint real — esta é validação local,
> não uma nova publicação.

- [x] `#/archive` sem filtro lista todos os meses no módulo de sidebar
  (`module-articles-archive`): "Fevereiro de 2026 (1)" e "Janeiro de 2026
  (1)", ambos como links funcionais; `main#main-content` mostra os dois
  artigos de exemplo com suas datas.
- [x] `#/archive?year=2026&month=1` filtra corretamente: título "Janeiro de
  2026", corpo mostra somente o artigo de janeiro (exclui o de fevereiro),
  foco confirmado em `#main-content` após a navegação.
- [x] Um documento ad hoc (criado só para este teste, removido depois)
  configurado com `config.customHtml = { title: '<Aviso>', html: '<p
  onclick="x()">Texto <strong>seguro</strong>.</p><script>alert(1)</script>'
  }` renderizou `module-custom-html` com o título escapado
  (`&lt;Aviso&gt;`) e o HTML sanitizado: sem `onclick`, sem `<script>`,
  preservando `<strong>` — confirma que `customHtmlModule` usa a mesma
  fronteira `sanitizeHtml` já usada por `renderArticle`, não um sanitizador
  próprio/paralelo.
- [x] O mesmo documento registrou um plugin de teste
  (`onContentPrepare`/`onSearchPrepare`); a navegação para
  `#/article/boas-vindas` mostrou o `introtext` em maiúsculas
  ("UMA CAMADA JOOMLA-LIKE PEQUENA E INDEPENDENTE."), e a navegação para
  `#/search?q=%20ENERGIA%20` preencheu o campo de busca com `energia`
  (trim + lowercase aplicados pelo plugin antes da renderização).
- [x] Evidência visual (320/768/1366/1920 px) capturada para os três
  cenários e salva em `tmp/visual-evidence-local/` (`archive-list-*px.png`,
  `archive-filtered-*px.png`, `custom-html-plugins-*px.png`) — 12 capturas
  no total, revisadas e confirmadas visualmente (identidade Petrobras
  preservada, layout responsivo correto, nenhum vestígio do HTML malicioso
  de teste).
- [x] Aba restaurada à página real do SharePoint (`SitePages/MiniJoomla.aspx`)
  ao final, confirmada por leitura de `document.title`/`location.href`;
  nenhuma escrita remota ocorreu durante esta verificação.
- [ ] Zoom 200/400% e `forced-colors` para estas três capacidades — mesma
  lacuna de ferramental já registrada para o restante do projeto (§2);
  não re-executada aqui por não haver método novo disponível no FIORI-AUTO.

## 4. Decisões e contrato do adapter SPMIDDLE

**Política local de visibilidade (fase local):**

- Artigos: visíveis quando `published/state` indica publicado e a janela `[publishUp, publishDown)` contém `now`.
  - `publishUp` ausente/vazio => visível imediatamente.
  - `publishDown` ausente/vazio => sem expiração.
- Categorias: sem campo de estado/published no contrato atual; tratadas como metadados de navegação.
  - Categoria inexistente => a rota de categoria permanece como 404 (service retorna `null`).
- Tags: no contrato atual, listas de tags são derivadas de artigos visíveis (FakeAdapter) ou do repositório de tags (SPMiddle), mas módulos/páginas sempre devem ser tolerantes a vazio.

- [x] Manter congelado o contrato de leitura v1 em `docs/CONTRACTS-MINIJOOMLA.md`.
- [x] Definir timeout do adapter remoto. — Delegado ao transporte do SPMIDDLE (`createSharePointRestClient`): `fetchImpl`/timeout de rede permanecem responsabilidade do host/transportFactory injetado; o adapter e os repositories do MINIJOOMLA não impõem timeout adicional.
- [x] Definir política de retry e quais erros são transitórios. — Delegado ao transporte do SPMIDDLE: GET com 429/503 faz retry com backoff/`Retry-After` (até `maxRetries`); escritas (POST/MERGE/DELETE) nunca são repetidas automaticamente. O MINIJOOMLA não reimplementa essa política.
- [x] Definir cancelamento de requisições. — Não suportado nesta fase pelo transporte REST do SPMIDDLE consumido (sem `AbortSignal` explícito no contrato atual); registrado como lacuna conhecida, não como decisão pendente.
- [x] Definir tradução de erros de transporte para erros de domínio. — Implementado em 01/11/2026: `src/libraries/minijoomla/infrastructure/spmiddle-error-translation.js` (`withErrorTranslation`) traduz qualquer falha de transporte para `DataError` genérico, sem detalhe de transporte na mensagem, preservando o erro original em `.cause`; aplicado aos repositories de leitura em `src/libraries/minijoomla/composition/createMiniJoomlaSharePointApp.js` sem alterar `createSPMiddleAdapter`. Ver `docs/INTEGRATION-SPMIDDLE.md` §10 para a decisão completa (por que só leitura, por que um único tipo de erro).
- [x] Definir comportamento para resposta incompleta, inválida ou indisponível além do que `onNavigate` (`src/index.js`) já absorve genericamente. — Confirmado em 01/11/2026 que a tradução de erro de transporte (item acima) já cobre este caso sem código dedicado: um item genuinamente malformado inserido no transporte em memória faz o `createMapper.mapItem()` real do SPMIDDLE lançar seu próprio `TypeError`, capturado por `withErrorTranslation` e traduzido para o mesmo `DataError` genérico — nenhuma distinção de código nova foi necessária entre "falha de transporte" e "resposta malformada". Ver teste "item realmente malformado..." em `tests/spmiddle-integration.test.js`.
- [x] Definir schemas específicos das listas necessárias. — `src/libraries/minijoomla/infrastructure/spmiddle-schemas.js`: `MiniJoomlaArticles`, `MiniJoomlaCategories`, `MiniJoomlaTags`, `MiniJoomlaMenu`, via `defineListSchema` do SPMIDDLE (puro, sem rede). Nomes lógicos próprios do MINIJOOMLA — não reaproveitam `MSEContent`/`MSECategories` de outro consumidor.
- [x] Definir allowlists de campos. — `createDataSourceRegistry` (`src/libraries/minijoomla/infrastructure/spmiddle-data-sources.js`) exige `allowedWebUrls` fechado por composição; nenhuma URL/lista é aceita fora do que o chamador declarar explicitamente.
- [x] Definir mapeamento de artigos, categorias, tags e menus. — `src/libraries/minijoomla/infrastructure/spmiddle-repositories.js` (`ARTICLE_MAPPING`/`CATEGORY_MAPPING`/`TAG_MAPPING`/`MENU_MAPPING`), alinhado aos nomes de domínio já usados por `DEFAULT_FIELDS` em `spmiddle-adapter.js`. Achado real confirmado em 01/11/2026 contra o tenant: o campo customizado `Author` colide com o campo de sistema nativo "Created By" do SharePoint; `ARTICLE_MAPPING.author` aponta para `'Author0'` (o nome real resultante), não `'Author'` (o que o schema declara) — ver `docs/INTEGRATION-SPMIDDLE.md` §12.2.
- [x] Definir conversão de `State` oficial Joomla para o shape interno esperado. — Schema usa `Choice` (`Published`/`Draft`/`Archived` para artigos; `Published`/`Draft` para menu); a função `published()` em `spmiddle-adapter.js` (inalterada) já aceita essas e outras variantes textuais/numéricas.
- [x] Definir estratégia de datas, timezone, ordenação e paginação remota. — Datas como `DateTime` (ISO); timezone/ordenação/paginação continuam responsabilidade do `createSPMiddleAdapter` existente (inalterado) e do `ContentService`, agora alimentados por repositories reais via `createRepository`/`findMany`.
- [x] Registrar essas decisões antes da implementação do Marco B. — Registradas nesta seção e em `docs/INTEGRATION-SPMIDDLE.md` (§4).


## 5. Marco B — implementação do adapter SPMIDDLE

- [x] Criar adapter em módulo de infraestrutura separado: `src/libraries/minijoomla/infrastructure/spmiddle-adapter.js` recebe repositories por injeção e foi validado localmente sem rede em 31/10/2026.
- [x] Receber dependências por injeção, sem chamada de rede e sem import direto do SPMIDDLE.
- [x] Evitar imports do SPMIDDLE em componentes, módulos e templates; a composição permanece baseada em adapter injetável.
- [x] Mapear DTOs para os contratos neutros do MINIJOOMLA: artigos, categorias, tags e menus possuem mapeamento configurável; testes locais cobrem itens produzidos por mapper-like, estados, datas, tags e descarte de campos extras.
- [x] Descartar campos de transporte, URLs internas, ETags e metadados desnecessários; os testes confirmam que campos extras não entram no domínio.
- [x] Aplicar allowlists e limites definidos pelo SPMIDDLE. — `createDataSourceRegistry` (allowlist de `webUrl`) + `createRepository.findMany` (bounded `maxPages`/`maxItems`, já exercitado pelo adapter existente) compõem a cadeia real usada por `createMiniJoomlaSharePointApp`.
- [x] Implementar leitura de artigos.
- [x] Implementar leitura/listagem de categorias.
- [x] Implementar leitura de tags e artigos por tag.
- [x] Implementar leitura de menus.
- [x] Implementar tratamento de ausência como `null`/array vazio conforme contrato.
- [x] Implementar tradução segura de erros. — Implementado em 01/11/2026 (ver §4 e `docs/INTEGRATION-SPMIDDLE.md` §10): `withErrorTranslation` envolve os repositories de leitura antes de injetá-los no adapter, traduzindo qualquer falha de transporte para `DataError`; `createSPMiddleAdapter` em si permanece inalterado.
- [x] Criar testes unitários com respostas sanitizadas/fakes, sem rede: 24 verificações em `tests/spmiddle-adapter.test.js`, incluindo paginação, categoria/tag/similar, `now`, estados, mapper-like e propagação segura de falhas.
- [x] Executar `tests/adapter-contract.test.js` contra o adapter SPMIDDLE: 9 verificações aprovadas dentro da suíte do adapter em 31/10/2026.
- [x] Demonstrar que a troca de `FakeAdapter` por `SPMiddleAdapter` não altera componentes ou templates. — `src/libraries/minijoomla/infrastructure/spmiddle-adapter.js` não foi alterado para suportar os pacotes reais do SPMIDDLE; apenas uma nova composição (`src/libraries/minijoomla/composition/createMiniJoomlaSharePointApp.js`) e novos repositories/schemas/data-sources foram adicionados.
- [x] Executar integração local real do pacote SPMIDDLE (sem rede, com transporte fake em memória): `tests/spmiddle-integration.test.js` (3 verificações: schema→registry→repository→adapter→content service; `runContentAdapterContract` contra a composição real; `createProvisioningManager.inspect/apply/verify` contra o schema `MiniJoomlaArticles`), encadeado em `tests/run-tests.js`. 31/10/2026.
- [x] Documentar rollback para retornar à composição com `FakeAdapter`. — `createApplication` (`src/index.js`) continua usando `createFakeAdapter()` por padrão; `createMiniJoomlaSharePointApp` é um caminho aditivo e opcional, nunca o default.


## 6. Marco C — leitura autorizada no Preview

> Só iniciar após o aceite local, o Marco B e autorização operacional explícita.

- [x] Confirmar destino SharePoint correto e autorização da sessão. — Confirmado em 31/10/2026: site de teste técnico corporativo autorizado `https://petrobrasbr.sharepoint.com/teams/SAPScripting`, sessão FIORI-AUTO isolada (RPC 47177, perfil `minijoomla`), SSO automático sem login manual. Ver evidência completa em 6.1.
- [x] Confirmar que a primeira superfície é `Preview.aspx`. — Decisão já registrada em `docs/RELEASE-MSE-0.1.0.md`: não existe uma superfície `Preview.aspx` separada nesta frente; `PREVIEW_PAGE` (`SitePages/MiniJoomla.aspx`) cumpre esse papel, confirmado pelo usuário em 31/10/2026. Não há uma segunda página a confirmar.
- [x] Validar HTTPS, certificado, CSP, MIME, cache e permissões. — Confirmado em 01/11/2026 contra o tenant real (sessão FIORI-AUTO isolada, leitura via `fetch` autenticado, sem escrita): a página responde HTTPS (`location.protocol === 'https:'`), com `Strict-Transport-Security: max-age=31536000`, `Content-Security-Policy` restrita por allowlist de domínios + nonce/hash (`script-src`), `X-Content-Type-Options: nosniff`, `Cache-Control: private` (não cacheada publicamente, correto para página autenticada). Um asset já publicado em `RELEASE_BASE` responde `Content-Type: application/javascript`, `Cache-Control: public, max-age=86400` (confirma o comportamento de CDN já documentado no incidente 9.3) e ETag real. Ver §10.1 de `docs/INTEGRATION-SPMIDDLE.md`.
- [x] Validar autenticação/sessão fornecida pelo host, sem credenciais no MINIJOOMLA. — Sessão FIORI-AUTO com SSO automático; nenhuma credencial é mantida pelo código MINIJOOMLA. Ver 6.1.
- [x] Validar schemas e allowlists no ambiente autorizado. — Validado via provisionamento real (`inspect → apply → verify`) das 4 listas de teste; ver 6.1.
- [x] Publicar somente artefato versionado e imutável, após aprovação. — A pasta de release `releases/0.1.0/` nunca foi sobrescrita/apagada em bloco; a correção do bootstrap (ver §11 de `docs/INTEGRATION-SPMIDDLE.md`) foi republicada em 01/11/2026 substituindo apenas o arquivo corrigido (`app/bootstrap/minijoomla-sapscripting-bootstrap.js`, 13.901 bytes), verificado por SHA-256 (`--verify-target`, `failures=0`) — nenhum outro arquivo da release foi tocado.
- [x] Validar leitura de artigos, categorias, tags e menus. — Validado contra o tenant real usando 4 listas de teste dedicadas (ainda não pela própria superfície `Preview.aspx`); ver evidência completa em 6.1.
- [~] Validar 404, timeout, resposta incompleta e indisponibilidade. — Parcial, concluído em 01/11/2026: um 404 real contra um arquivo inexistente em `RELEASE_BASE` foi confirmado (HTTP 404 puro, sem vazar stack/caminho de servidor); isso revelou um defeito real no bootstrap publicado (ver §11 de `docs/INTEGRATION-SPMIDDLE.md`), corrigido, validado localmente e republicado no SharePoint real (validado com reload real da página). **Timeout e indisponibilidade reais do tenant continuam não exercitados** — não há forma segura de simular isso contra a infraestrutura real sem risco; registrado como limitação permanente desta validação, não como pendência ativa.
- [x] Validar que nenhum segredo, cookie, token ou dado pessoal aparece em código/log/evidência. — Verificado em 01/11/2026: busca por padrões (`FedAuth`, `rtFa=`, `client_secret`, `Bearer `) em todo o projeto (código, docs, scripts, evidências `tmp/`, exceto binários de imagem) não encontrou nenhuma ocorrência.
- [x] Executar inspeção visual no SharePoint correto com FIORI-AUTO. — Já executado em 01/11/2026 (ver §6.1, 4 capturas em `tmp/visual-evidence/`).
- [x] Registrar evidências de aceite e rollback. — Rollback documentado em `docs/RELEASE-MSE-0.1.0.md` ("Rollback"); evidências de aceite em 6.1/6.2/§10.
- [x] Não alterar `Default.aspx` nesta etapa. — Confirmado: nenhuma ação desta ou de sessões anteriores tocou `Default.aspx`; todas as escritas foram em `CanvasContent1` de `SitePages/MiniJoomla.aspx` via REST, nunca no arquivo `.aspx` em si.

### 6.1 Evidência real de leitura — Parte 2 (31/10/2026)

> Validação técnica autorizada contra o site de teste corporativo
> `https://petrobrasbr.sharepoint.com/teams/SAPScripting`, via sessão
> FIORI-AUTO isolada (RPC 47177, perfil `minijoomla`), com SSO automático.
> Esta evidência valida a cadeia real de leitura (schema→transporte REST→
> repository→adapter→content service) contra o SharePoint real, usando 4
> listas de teste dedicadas — **não** é, ainda, leitura através da própria
> página `Preview.aspx`/`SitePages/MiniJoomla.aspx`, cuja publicação de
> conteúdo/UI permanece pendente (outra frente de trabalho).

- [x] Provisionar as 4 listas de teste (`TesteMiniJoomlaArtigos`,
  `TesteMiniJoomlaCategorias`, `TesteMiniJoomlaTags`, `TesteMiniJoomlaMenu`,
  definidas em `src/libraries/minijoomla/infrastructure/spmiddle-test-schemas.js`, estruturalmente
  idênticas aos schemas de produção) via `inspect → apply → verify` real do
  `createProvisioningManager` (`packages/sharepoint-provisioning`). `inspect()`
  inicial confirmou as 4 listas ausentes (`missing: true`); `apply()` criou as
  4 listas e todos os campos; `verify()` final confirmou sucesso. IDs reais:
  `TesteMiniJoomlaArtigos` `82902a74-621d-4efd-9616-3be0ccd11a6f`,
  `TesteMiniJoomlaCategorias` `41390948-1e47-40eb-bc57-baeb31c7056a`,
  `TesteMiniJoomlaTags` `e8b46b3c-2f8c-4270-b407-6eeb32a89e86`,
  `TesteMiniJoomlaMenu` `3a4f3ea8-b7d6-4cc6-9ae7-2c429c7b788a` — todas com 0
  itens no estado final, sem resíduo. A única pendência estrutural é a
  criação de índice (`create-index`), já marcada como `supported: false`/
  `skipped` pelo próprio `createProvisioningManager` (limite conhecido do
  SPMIDDLE, não uma falha nova). Dois achados de compatibilidade de tenant
  necessários para o `apply()` funcionar estão documentados em
  `docs/INTEGRATION-SPMIDDLE.md` (apêndice §8).
- [x] Montar a composição real completa (`createMiniJoomlaSharePointApp` →
  `createMiniJoomlaDataSources` → `createMiniJoomlaSPMiddleRepositories` →
  `createSPMiddleAdapter` inalterado → `createContentService`) apontando para
  `webUrl=/teams/SAPScripting` e as 4 listas de teste acima.
- [x] Validar leitura real de artigos, categorias, tags e menus contra o
  tenant real: `content.search(...)`, `content.category(...)`,
  `adapter.listArticles(...)`, `adapter.listCategories()`,
  `adapter.listTags()`, `adapter.listMenus()` executados com sucesso,
  retornando páginas/listas vazias bem formadas (consistente com as listas
  estarem vazias), sem nenhum erro.
- [x] Validar a leitura através da própria superfície `Preview.aspx`/
  `SitePages/MiniJoomla.aspx` (publicação de conteúdo/UI na página). —
  Publicado em 01/11/2026: pacote estático real (`src/`, `theme/` do
  MINIJOOMLA + módulos reais do SPMIDDLE necessários) enviado para
  `RELEASE_BASE` e ligado via Modern Script Editor existente (edição de
  `CanvasContent1`, nunca do `.aspx`); carregamento feito por um script
  clássico (`import()` dinâmico) porque um `<script type="module">` direto
  em `CanvasContent1` nunca é re-executado após reload por este Script
  Editor web part (achado real, documentado no bootstrap publicado).
  Validado de ponta a ponta com um reload real e completo da página
  (`fresh_session`/`fresh-snapshot` do harness, não apenas leitura dentro
  de uma sessão já carregada): chrome do SharePoint intacto, widget
  renderizado dentro do contêiner dedicado `[data-minijoomla-root]`, estado
  final estável mostrando "Nenhum artigo recente"/"Nenhum destaque
  disponível"/"Nenhuma tag disponível"/"Nenhum conteúdo publicado ainda"
  (correto para as 4 listas de teste vazias). Ver §6.2 para os dois
  incidentes reais encontrados e corrigidos durante esta publicação.
- [ ] Validar 404, timeout, resposta incompleta e indisponibilidade contra o
  ambiente real (não exercitado nesta evidência de 31/10/2026 — ver §6
  principal e §11 de `docs/INTEGRATION-SPMIDDLE.md` para a validação real
  de 404/resposta inválida feita em 01/11/2026).
- [x] Capturar evidência visual (320/768/1366/1920 px) contra o ambiente
  real. — 4 capturas reais salvas em `tmp/visual-evidence/{320,768,1366,1920}px.png`,
  após aguardar o widget sair do estado "Carregando…" (ver incidente 3 em
  §6.2). Todas mostram o widget renderizado corretamente dentro do chrome
  real do SharePoint, com o layout responsivo esperado (coluna única até
  768px, duas colunas a partir de 1366px). Zoom 200/400% e `forced-colors`
  permanecem fora do escopo desta primeira versão — nenhum método RPC do
  FioriAgent documentado em `docs/api-rpc.md` emula isso hoje
  (`capture_zoom_and_forced_colors()` em `tmp/mj-visual-evidence.py` lança
  `NotImplementedError` explícito em vez de forjar um resultado).

### 6.2 Incidentes reais encontrados e corrigidos durante a publicação (01/11/2026)

Três defeitos reais foram encontrados e corrigidos durante a publicação —
nenhum foi causado pelo bootstrap em si, mas só se tornaram visíveis ao
publicar contra o SharePoint real:

1. **Efeito colateral de nível de módulo sobrescrevendo a página real.**
   `src/index.js` tinha `if (typeof document !== 'undefined')
   createApplication();` ao final do arquivo, pensado só para
   `examples/index.html`. Qualquer navegador real que importasse esse
   módulo — inclusive o bootstrap, que só queria a função
   `createApplication` — disparava esse auto-start contra o `document`
   REAL da página com o `FakeAdapter` padrão, sobrescrevendo toda a página
   SharePoint (chrome, navegação) com conteúdo fictício. Confirmado e
   contido ao vivo contra a página real; corrigido removendo a linha de
   `src/index.js` (69 testes locais continuam verdes, pois rodam em Node
   sem `document`) e ajustando `examples/index.html` para chamar
   `createApplication()` explicitamente.
2. **Rota `home` sem guarda contra categoria ausente.** `src/index.js`
   chamava `renderCategory(result, ...)` sem checar `result` para a rota
   `home` (diferente da rota `category`, que já tinha essa guarda),
   assumindo implicitamente que a categoria `noticias` sempre existe — o
   que é verdade no `FakeAdapter` de demonstração, mas não nas listas de
   teste reais (vazias). Isso lançava `TypeError` dentro de `renderCategory`,
   capturado pelo `catch` genérico como "Não foi possível carregar".
   Corrigido com a mesma guarda condicional já usada pela rota `category`,
   mais um novo teste de regressão em `tests/core.test.js` ("application
   renders an accessible empty state on the home route when the configured
   category is missing, instead of throwing") — gap de cobertura real, já
   que os testes existentes cobriam `getCategory: async () => null` na
   rota `home` sem checar o conteúdo final renderizado.
3. **Cache de CDN por URL completa presa em revisão antiga.** O SiteAssets
   do SharePoint cria uma revisão de publicação distinta por cada *query
   string diferente já vista* em uma URL (`cache-control: public,
   max-age=86400`), não por conteúdo. Um esquema de cache-busting manual
   (`?v=1`, `?v=2`...) ficou preso servindo uma revisão intermediária
   (entre as correções 1 e 2) porque aquela query string específica já
   tinha sido cacheada antes da correção mais nova ser publicada.
   Corrigido trocando para `import()` dinâmico com `?t=Date.now()` (nunca
   reutilizado) no bootstrap e no loader clássico.

Ferramental consolidado: as ~45 sondas descartáveis usadas para diagnosticar
isso foram substituídas por um único harness reutilizável,
`tmp/mj_harness.py` (snapshot de saúde da página, leitura/escrita genérica
de `CanvasContent1`, execução de expressão JS arbitrária), que também
corrigiu um bug de diagnóstico real: `attach_session()` originalmente
delegava para o `open_or_attach()` compartilhado do FIORI-AUTO, que sempre
tenta `browser.open` primeiro — e isso navega mesmo quando a sessão já
existe, reiniciando silenciosamente o ciclo de vida do app a cada leitura
"somente leitura". Corrigido para usar só `fiori.listSessions` +
`fiori.attachSession` nessa função, com uma função `fresh_session()`
separada e explícita para os casos em que um reload real é intencional.

**Bloqueio de integração:** `WEB_URL`, `RELEASE_BASE` e `PREVIEW_PAGE` foram
informados e confirmados em 31/10/2026 (ver `docs/RELEASE-MSE-0.1.0.md`);
`PRODUCTION_PAGE` não existe separadamente nesta frente. A validação técnica
real de leitura (6.1), de escrita controlada e sintética (8.1) e de
publicação na própria página com evidência visual (6.1/6.2) já ocorreram
contra esse destino autorizado, usando listas de teste dedicadas e conteúdo
de demonstração claramente marcado como teste — não conteúdo editorial
real, não piloto com usuários reais.

## 7. Provisionamento e dados reais

- [ ] Revisar e aprovar schemas das listas `MSE*` necessárias.
- [ ] Executar provisionamento somente pelo fluxo autorizado `inspect → plan → apply → verify`.
- [ ] Verificar listas, campos, tipos, relacionamentos e allowlists.
- [ ] Definir plano de migração para `MSEContent`.
- [ ] Definir mapeamento de categorias, tags, aliases, datas, estados e HTML.
- [ ] Definir tratamento de duplicidades, órfãos e registros inválidos.
- [ ] Definir idempotência e rollback da migração.
- [ ] Executar migração somente após aprovação operacional.
- [ ] Validar dados migrados por amostragem e contagens.
- [ ] Registrar evidência sem expor dados corporativos desnecessários.

## 8. Escrita e produção — somente se posteriormente aprovada

- [ ] Decidir se operações mutáveis fazem parte do produto.
- [ ] Criar contrato separado para `create`/`update`/`delete`.
- [ ] Implementar validação e sanitização de entradas.
- [ ] Implementar proteção CSRF.
- [ ] Implementar idempotência.
- [x] Definir concorrência e ETags. — Validado com escrita controlada e sintética contra o tenant real; ver evidência completa em 8.1. `createRepository.update/delete` do SPMIDDLE exige ETag exato (concorrência otimista).
- [x] Definir erros acionáveis para conflitos. — Confirmado HTTP 412 / `error.code === 'concurrency-conflict'` com ETag deliberadamente errada; ver 8.1.
- [x] Demonstrar rollback/compensação de transações. — Demonstrado por exclusão do item de teste e releitura vazia; ver 8.1 (escopo: escrita sintética em lista de teste, não transação de produção).
- [x] Obter autorização específica antes de qualquer escrita. — Escrita realizada apenas contra lista de teste dedicada (`TesteMiniJoomlaArtigos`), dentro do site de teste técnico corporativo autorizado; ver 8.1.
- [ ] Avaliar `Default.aspx` somente depois do aceite integral de `Preview.aspx`.

### 8.1 Evidência real de escrita controlada e sintética — Marco D, Parte 2 (31/10/2026)

> Escrita exclusivamente sintética e descartável, contra a lista de teste
> `TesteMiniJoomlaArtigos` (não produção), usando `app.repositories.articles`
> (repositório real do `data-core` do SPMIDDLE, não um atalho REST manual).
> Esta evidência valida o comportamento de concorrência otimista e o ciclo
> completo de escrita, mas **não** autoriza escrita editorial de produção,
> que continua pendente de contrato próprio (itens não marcados acima).

1. `create({ title: '[TESTE MINIJOOMLA] artigo descartável Marco D', alias: 'teste-minijoomla-marco-d' })`
   → sucesso, item criado com ETag real.
2. Releitura (`findById`) confirmou o mesmo ETag retornado pelo `create` —
   round-trip real confirmado.
3. Teste de conflito: `update(id, { title: 'alteração indevida' }, { etag: '"999999999"' })`
   (ETag deliberadamente errada) → **HTTP 412 confirmado**
   (`error.status === 412`, `error.code === 'concurrency-conflict'`), o
   comportamento de concorrência otimista esperado e documentado pelo
   transporte do SPMIDDLE.
4. `update(id, { title: '[TESTE MINIJOOMLA] artigo atualizado Marco D' }, { etag: <etag correto> })`
   → sucesso (SharePoint retorna HTTP 204 sem corpo para `MERGE`; confirmado
   por releitura, que mostrou o título atualizado).
5. `delete(id, { etag: <etag mais recente> })` → sucesso.
6. Releitura de todos os itens da lista após a exclusão → **0 itens**
   (`findMany` retornou lista vazia), confirmando ausência de resíduo.

Conclusão: ciclo completo `create → reread → conflito de ETag (412) → update
correto → delete → releitura vazia` executado com sucesso contra o tenant
real, usando exclusivamente os pacotes reais do SPMIDDLE (nenhuma lógica de
REST duplicada fora deles, à exceção dos dois ajustes de compatibilidade de
tenant documentados em `docs/INTEGRATION-SPMIDDLE.md` §8, aplicados apenas no
corpo da requisição de provisionamento, nunca no pacote compartilhado do
SPMIDDLE nem nesta escrita de item).

### 8.2 Painel administrativo — implementação e validação real (01/11/2026)

> Extensão do escopo original, pedida explicitamente pelo usuário após a
> conclusão do Marco D: painel administrativo completo (estrutura do
> Joomla admin exceto ACL), com descoberta de extensões (módulos/plugins)
> e instâncias de módulo multi-escopo. Referência de comportamento:
> `web-devs/JOOMLA/administrator/` real (conceito, nunca código PHP
> literal) — nunca `mse-platform`. Modelado e implementado como app
> separado (`src/administrator/components/com_minijoomla/`), nunca compartilhando página/router com o app
> público.

**Implementação (local, testada antes de qualquer ação real):**

- 3 schemas novos (`MiniJoomlaExtensions`, `MiniJoomlaModuleInstances`,
  `MiniJoomlaSiteConfig`) em `src/libraries/minijoomla/infrastructure/spmiddle-schemas.js`,
  variantes de teste em `spmiddle-test-schemas.js`.
- `src/libraries/minijoomla/application/admin-service.js`: CRUD validado por forma para
  artigos/categorias/tags/menu/extensões/instâncias de módulo, mais upsert
  de linha única para configuração do site.
- `src/libraries/minijoomla/application/extension-discovery-service.js`: descoberta por
  varredura de pasta convencional (`extensions/`), equivalente à tela
  "Discover" real do Joomla — nunca upload/execução de código
  (`com_installer` real foi explicitamente rejeitado como padrão a seguir).
- `src/libraries/minijoomla/modules/dynamic-modules.js`: carregamento dinâmico de módulo/plugin
  por `import()` com resolução de escopo (rota + alias de categoria
  opcional), estritamente aditivo a `src/index.js` (zero `import()` extra
  quando as novas opções são omitidas).
- `src/administrator/components/com_minijoomla/` (app, formulários, listas, CSS): interface administrativa
  cobrindo overview, artigos, categorias, tags, menu, instâncias de
  módulo e extensões/descoberta, mais configuração do site.
- 169 verificações locais (unitárias + integração) aprovadas antes de
  qualquer ação real, incluindo um teste de regressão para um bug de
  concorrência real encontrado nesta sessão: o formulário de edição
  originalmente relia o ETag no momento do *submit* em vez do ETag
  capturado no momento em que o registro foi carregado para edição,
  desarmando silenciosamente a concorrência otimista.

**Dois achados reais de tenant, encontrados só durante a validação real
(nunca exercitados por nenhum teste/transporte fake anterior) — detalhados
em `docs/INTEGRATION-SPMIDDLE.md` §12:**

1. `createRepository.findMany()` do SPMIDDLE nunca anexa `etag` aos itens
   (só `findById`/`create`/`update` fazem isso); `siteConfig.get()`
   dependia incorretamente do etag de `findMany()` — corrigido para
   relêr via `findById` antes de devolver.
2. O campo customizado `Author` (artigos) colide com o campo de sistema
   nativo "Created By" do SharePoint (mesmo nome interno, tipo
   incompatível); o SharePoint resolve a colisão renomeando o campo
   customizado para `Author0` em tempo de provisionamento — o mapeamento
   do repositório apontava para o nome errado (`Author`), causando
   HTTP 400 em qualquer escrita de artigo com autor preenchido. Corrigido
   apontando o mapeamento para `Author0`; o schema continua declarando
   `Author` (é o que precisa ser enviado na criação do campo).

**Provisionamento real das 3 listas de teste novas** (`TesteMiniJoomlaExtensions`,
`TesteMiniJoomlaModuleInstances`, `TesteMiniJoomlaSiteConfig`), mesmo fluxo
`inspect → apply → verify` já usado para as 4 listas originais: `inspect()`
inicial confirmou as 3 ausentes; `apply()` criou as 3 listas e todos os 24
campos (só o índice de `TesteMiniJoomlaExtensions.Key` ficou
`skipped`/`unsupported-rest-operation`, mesma limitação de tenant já
conhecida); `verify()` final confirmou 0 ações pendentes em
`moduleInstances`/`siteConfig` e 1 ação pendente (o índice não suportado)
em `extensions`. IDs reais: `TesteMiniJoomlaExtensions`
`f548f7a6-80df-4d7a-9575-38345c59326c`, `TesteMiniJoomlaModuleInstances`
`9d7e6223-e57f-413f-966b-5781c09ac240`, `TesteMiniJoomlaSiteConfig`
`a49255fe-de27-4853-834b-82a583c6e764`.

**Validação Marco D-equivalente contra o tenant real**, via
`createMiniJoomlaAdminApp` (nunca um atalho REST manual), para as 3 listas
novas:

- **extensions:** `create` → conflito de ETag deliberado (HTTP 412
  confirmado) → `update` com ETag correto → `remove` → releitura vazia
  (0 itens, sem resíduo).
- **moduleInstances:** `create` (confirmando serialização de `settings` em
  `settingsJson`) → conflito de ETag (412 confirmado) → `remove` →
  releitura vazia.
- **siteConfig:** `save` (cria a linha única) → conflito de ETag (412
  confirmado) → `save` com ETag correto (atualiza) → exclusão direta via
  `app.repositories.siteConfig.delete` (não há `remove` exposto pelo
  `admin-service` para configuração, por ser upsert de linha única) →
  releitura `null` confirmada.

**Validação de leitura ponta a ponta via `content.adapter`** (mesmo
caminho que o app público usaria), confirmando que o dataset chega
corretamente formatado ao domínio: categorias com `alias` correto,
artigos filtrados por categoria/featured com `author`/`tags` corretos,
tags populares com contagem correta, menu ordenado, e o artigo de
tipografia com o HTML completo (2749 caracteres, sem truncamento).

### 8.3 Dataset real "Blog Sample Data" do Joomla populado nas 4 listas de teste originais (01/11/2026)

> Extraído de `web-devs/JOOMLA/plugins/sampledata/blog/src/Extension/Blog.php`
> e `web-devs/JOOMLA/administrator/language/en-GB/plg_sampledata_blog.ini`
> (fonte de verdade real do Joomla, parseado programaticamente — nunca
> transcrito manualmente, para preservar HTML/aspas escapadas com
> fidelidade). Escrito via `createMiniJoomlaAdminApp`/`admin-service`
> (mesmo serviço que o painel administrativo usaria), nunca um atalho REST
> manual, nas 4 listas de teste já existentes (`TesteMiniJoomlaArtigos`,
> `TesteMiniJoomlaCategorias`, `TesteMiniJoomlaTags`, `TesteMiniJoomlaMenu`)
> — não listas novas.

- **4 tags:** Millions, Worldwide, Love, Joomla 6 (nomes reais do Joomla).
- **4 categorias:** Blog, Help, Joomla, Typography (nomes/estrutura reais
  do Joomla; sem hierarquia de pai, igual ao original).
- **11 artigos** com título/introtext/fulltext reais do Joomla ("About",
  "Working on Your Site", "Welcome to your blog", "About your home page",
  "Your Modules", "Your Template", "Millions", "Love", "Joomla", "Workflows",
  "Typography"), `author: "Joomla"`, categorizados exatamente como o
  original (4 artigos featured na categoria Blog, com as 4 tags
  associadas; os demais sem tags, distribuídos entre Help/Joomla/Typography),
  datas de publicação sequenciais em 2026 (o Joomla original usa a data de
  instalação, não documentada como texto fixo).
- **7 itens de menu**, cobrindo as rotas reais do MINIJOOMLA (`/`,
  `/category/<alias>` × 3, `/article/typography`, `/search`, `/archive`)
  com os rótulos originais do Joomla onde aplicável — adaptado porque o
  menu original do Joomla referencia `com_users`/administrator/workflow,
  que não existem nesta aplicação (sem ACL, sem workflow).
- **Adaptações documentadas** (não silenciosas): ACL, workflow, campos
  personalizados e biblioteca de mídia do Joomla original foram omitidos
  por estarem fora do escopo do MINIJOOMLA; apenas título, introtext,
  fulltext, categoria, destaque, tags e autor foram migrados.

Validado por releitura real via `content.adapter` (ver §8.2, último
parágrafo) — não apenas confirmação de escrita.

### 8.4 Publicação real do painel administrativo em `Administrator.aspx` (01/11/2026)

> Decisão explícita do usuário: o painel não ficaria acessível via hash na
> mesma página pública (`#administrator` em `MiniJoomla.aspx`), porque
> isso não cria nenhuma barreira real de acesso — o navegador já recebe o
> pacote inteiro antes de decidir o que o hash significa. Solução: página
> separada (`Administrator.aspx`, criada pelo usuário como cópia de
> `MiniJoomla.aspx`), cujo controle de acesso (restrição a uma única
> conta) fica para a etapa do "site definitivo", fora do escopo desta
> publicação.

- **Pacote público reconciliado**: a pasta já publicada
  (`releases/0.1.0/app/`) estava defasada em relação ao `src/` atual
  (faltavam 5 arquivos, 11 outros com conteúdo antigo). Resolvido
  programaticamente (resolução transitiva real de `import`, nunca lista
  manual) e republicado — 0 regressão confirmada no site público por
  reload real.
- **Dois achados reais de publicação**, detalhados em
  `docs/INTEGRATION-SPMIDDLE.md` §13: (1) cache HTTP do navegador pode
  reter uma versão antiga de qualquer um dos 43 imports estáticos sem
  cache-busting, não só os 3 do bootstrap — corrigido aplicando
  cache-busting a todos eles nas cópias publicadas; (2) um Service Worker
  real do SharePoint manteve um resultado incorreto para uma URL
  cache-busted já usada antes numa sonda de diagnóstico — mitigado
  gerando sempre um `BUILD_STAMP` novo, nunca reaproveitado.
- **Bootstrap/loader dedicados do admin** (`admin/bootstrap/
  minijoomla-sapscripting-admin-bootstrap.js`/`-admin-loader.js`),
  publicados em `releases/0.1.0/admin/`, isolados do bootstrap público
  (contêiner `[data-minijoomla-admin-root]` e CSS escopado próprios,
  `admin.scoped.css`), apontando para as 7 listas reais já provisionadas.
- **Validação real completa**: `CanvasContent1` de `Administrator.aspx`
  editada (só essa página) via `tmp/mj_admin_harness.py`, confirmando 2
  ocorrências exatas antes de aplicar; publicado com sucesso. Reload real
  mostrou o painel de controle com as contagens reais do dataset de §8.3
  (11 artigos, 4 categorias, 4 tags, 7 menus, 0 extensões, 0 instâncias);
  navegação real confirmada para listagem/edição de artigo real,
  extensões (estado vazio) e configuração do site. `MiniJoomla.aspx`
  confirmada sem regressão por reload real após a publicação.

### 8.5 Rework visual do painel administrativo (estilo Joomla Atum) — publicado e validado (01/11/2026)

> Casca visual (header/sidebar/toolbar), seletores relacionais em
> formulários, confirmação de exclusão, busca/paginação em listagens e
> abas na configuração do site — modelados na estrutura/vocabulário
> visual real do `administrator/` do Joomla (nunca cópia literal de
> PHP/SCSS), dentro da paleta Petrobras obrigatória. Validado localmente
> (116 testes + navegador real contra harness com dados de amostra)
> antes de publicar; depois publicado e revalidado contra o tenant real.

- **Achado real de publicação**, detalhado em
  `docs/INTEGRATION-SPMIDDLE.md` §14.2: o `<link>` do CSS escrito no
  `CanvasContent1` usa uma query string fixa (`?v=1`, nunca incrementada
  automaticamente), diferente dos bootstraps JS que já se cache-bustam
  sozinhos — corrigido incrementando manualmente para `?v=2` após
  publicar o CSS novo, revalidado por reload real (`document.styleSheets`
  passou a expor as 30 regras novas, `background-color` real do header
  resolvendo para `--admin-blue-deep`).
- **Validação real completa**: painel de controle real com o novo
  visual (header azul-escuro, sidebar verde, contagens reais corretas);
  listagem real de Artigos com busca e badges "Destaque"/"Publicado"
  sobre os 11 artigos reais; formulário de edição do artigo real `About`
  com o campo "Categoria" resolvido como `<select>` real mostrando "Help"
  (a categoria real do artigo, nunca um ID). `MiniJoomla.aspx` confirmado
  sem regressão (estado "Nenhum conteúdo publicado ainda." na home é
  comportamento pré-existente e correto, não desta publicação).

### 8.6 Reversão de decisão: paleta real do Joomla no admin, não a Petrobras (01/11/2026)

> Decisão explícita do usuário: §8.5 usava a paleta/estrutura Petrobras
> por engano — a instrução correta é "o MINIJOOMLA tem que oferecer uma
> interface o mais próximo possível do JOOMLA original. Inclusive as
> cores, tipos de letras etc devem ser preservados [...] a customização
> para a identidade Petrobras será feita no template do site [público]".
> Detalhe completo em `docs/INTEGRATION-SPMIDDLE.md` §15.

- `src/media/templates/administrator/atum/css/template.css` e `src/administrator/components/com_minijoomla/icons.js` reescritos com as cores
  e silhuetas de ícone REAIS do template Atum (consultado em
  `web-devs/JOOMLA/`), incluindo o azul-marinho real (`#001b4c`/
  `#132f53`) e o vermelho real (`#c52827`) para exclusão/erro —
  nunca mais a aproximação Petrobras. Header e sidebar compartilham a
  mesma família de cor (como o Atum real), toolbar/tabela com fundo
  claro, botões/badges discretos com cor só até o hover.
- Validado localmente (116 testes + navegador real); **publicado e
  revalidado no tenant real** (`Administrator.aspx`). Achado real
  repetido de §8.4: o `<link>` do CSS tinha versão fixa (`?v=2`,
  herdada da publicação anterior) — corrigido incrementando para
  `?v=3` (detalhe completo em `docs/INTEGRATION-SPMIDDLE.md` §15.4).
  Reload real confirmou header/sidebar na cor correta (`#132f53`),
  11 artigos reais com badges/botões no padrão Atum real;
  `MiniJoomla.aspx` confirmado sem regressão.

### 8.7 Correção estrutural: sidebar em árvore, cpanel agrupado, ícones de estado circulares (02/11/2026)

> Achado real do usuário: comparando com capturas de tela reais do
> painel administrativo de um site Joomla 6.2.0 que ele administra, a
> ESTRUTURA do painel (não só a cor, já corrigida em §8.6) ainda estava
> distante do original. Detalhe completo em
> `docs/INTEGRATION-SPMIDDLE.md` §16.

- Sidebar reescrita como árvore de 2 níveis (`has-arrow`/
  `mm-collapse`/`mm-show`, igual ao `mod_menu` real), substituindo a
  lista plana anterior; "Tags" posicionada em "Componentes" (nunca em
  "Conteúdo"), replicando a ausência real de `com_tags` no preset de
  menu real do Joomla.
- Painel de controle reescrito como cards ícone-acima/texto-abaixo
  agrupados em seções "Site"/"Sistema", seguindo a classificação real
  de `QuickIconHelper.php` (Módulos/Extensões em "Site", só
  Configuração em "Sistema").
- Badges de estado com texto (`✓ Publicado`) substituídos por ícones
  circulares sem texto visível (`.admin-state-icon`, 26px, mesma medida
  do `.tbody-icon` real), com nova cor `--atum-featured: #c78800` para
  destaque (distinta do verde de sucesso).
- Validado localmente (116 testes + inspeção DOM/`getComputedStyle` ao
  vivo via FIORI-AUTO contra `examples/admin.html`); **republicado e
  revalidado no tenant real** (`Administrator.aspx`) em 02/11/2026.
  Achado real durante a publicação (sem dano): dois comandos de
  upload usaram `--site-url` só com a raiz do site, renavegando a aba
  sem afetar o upload REST em si — corrigido reabrindo a página
  completa antes de validar; detalhe completo em
  `docs/INTEGRATION-SPMIDDLE.md` §16.5. Reload real confirmou sidebar
  em árvore, cpanel agrupado, 22 ícones de estado reais (26px) e
  `MiniJoomla.aspx` sem regressão.

### 8.8 Supervisão geral: dois bugs visuais reais corrigidos e editor de texto rico real (TinyMCE) (02/11/2026)

> Usuário sinalizou "o menu do painel e o conteúdo das tabelas ainda
> estão precisando de ajustes" e, em seguida, apontou prioridade alta
> explícita: campos de texto do admin não ofereciam nenhum recurso de
> formatação (negrito/itálico/listas), obrigando a digitar HTML cru —
> "sem um editor adequado, o usuário não conseguirá editar os
> artigos, invalidando completamente todo o esforço". Detalhe
> completo em `docs/INTEGRATION-SPMIDDLE.md` §17.

- Dois bugs visuais reais encontrados em supervisão (nenhum pego
  pelos 116 testes automatizados, que verificam HTML gerado, não CSS
  computado): `.visually-hidden` nunca definido em `admin.css`
  (texto de leitor de tela sobreposto aos ícones de estado); links de
  nível 2 da sidebar caindo no azul padrão do navegador por um
  combinador CSS de filho direto que nunca os alcançava. Ambos
  corrigidos e confirmados por captura de tela real e
  `getComputedStyle` ao vivo.
- Editor de texto rico real (TinyMCE 7.9.1 self-hosted, licença
  GPL-2.0-or-later confirmada — a mesma já usada pelo
  `plg_editors_tinymce` do Joomla real) vendorizado em
  `src/media/vendor/tinymce/` (árvore minimal de ~1.24 MB, só os
  arquivos que o preset "simple" real usa, nunca os ~9 MB da
  distribuição completa). Aplicado só aos dois campos que o site
  público trata como HTML real (`fulltext` de Artigos,
  `customHtmlBody` da configuração) — confirmado por varredura de
  todo `sanitizeHtml(` no código; `introtext`/`description`/
  `siteDescription` continuam texto puro, correspondendo
  exatamente ao que o site público já fazia com eles antes desta
  mudança.
- Segundo bug real encontrado e corrigido durante a própria
  validação: um editor dentro de uma aba que nasce oculta
  (`customHtmlBody`, aba "HTML personalizado") media 0×0 e nunca se
  recalculava ao revelar a aba depois — corrigido adiando a
  inicialização desse editor até o momento exato em que a aba é
  revelada pelo clique.
- 23 testes automatizados novos/atualizados (11 em
  `admin-render.test.js`, 12 em `admin-app.test.js`, incluindo um
  teste dedicado que reproduz o bug da aba oculta sem DOM real); 52
  arquivos sintaticamente limpos. Validado ao vivo via FIORI-AUTO
  contra `examples/admin.html`: negrito/itálico reais aplicados e
  sincronizados com o `<textarea>` subjacente, em ambos os campos.
  **Republicado e revalidado no tenant real** (`Administrator.aspx`)
  em 02/11/2026 — 51 arquivos publicados (3 admin + 39 app + 9
  vendor/tinymce), `?v=6` no CSS após um incidente real de cache
  (reload serviu CSS antigo mesmo com `?v=5` já publicado com
  conteúdo correto; corrigido incrementando de novo). Reload real
  confirmou ambos os bugs corrigidos, negrito real aplicado em um
  Artigo, editor dentro da aba oculta com dimensões reais (640×400)
  e `MiniJoomla.aspx` sem regressão. Detalhe completo em
  `docs/INTEGRATION-SPMIDDLE.md` §17.5.

## Critérios finais de conclusão

> Os itens abaixo cobrem a fase local (1) e a Parte 2 já autorizada e
> validada (Marco C/D contra listas de **teste** em `/teams/SAPScripting`),
> incluindo o painel administrativo completo (§8.2/§8.3) adicionado nesta
> sessão. Não cobrem provisionamento/escrita em listas de **produção** (§7)
> nem os itens explicitamente pendentes de §6/§8 (404/timeout/
> indisponibilidade reais, tradução de erro de transporte) — esses
> continuam exigindo autorização e trabalho próprios, não inferidos deste
> checklist.

- [x] Todos os itens obrigatórios da fase local (1) e das três capacidades Joomla-like de §3 estão implementados e testados; itens de produção (§7) e sub-itens não autorizados de §6/§8 permanecem `[ ]` à parte, por decisão, não por esquecimento.
- [x] `node tests/run-tests.js` ou `npm.cmd test` passa. — 106 verificações aprovadas em 01/11/2026 (inclui as 20 novas do painel administrativo).
- [x] `node scripts/check-syntax.js` ou `npm.cmd run check` passa. — 44 arquivos aprovados em 01/11/2026.
- [x] `git diff --check` passa. — aprovado em 01/11/2026 (somente warnings de CRLF/LF).
- [x] Documentação e checklist refletem o estado real. — Este arquivo e `docs/INTEGRATION-SPMIDDLE.md` (§12) atualizados em 01/11/2026 com o painel administrativo, os dois achados reais de tenant e a população do dataset Joomla.
- [x] Working tree contém somente alterações intencionais. — Confirmado via `git status --short`: apenas arquivos desta frente dentro de `MINIJOOMLA/`; alterações em outros projetos do repositório agregador (`PCI/`, `HH-web`, `SPMIDDLE`, `hub-ai`) pertencem a outras frentes e não foram tocadas por este trabalho.
- [x] Há evidência de validação navegável após alterações de UI. — §3.1 (navegador real, 01/11/2026) e §6.1/§6.2 (SharePoint real, Parte 2); `static-ui.test.js` cobre acessibilidade/CSS responsivo do painel administrativo (verificação local, sem navegador real).
- [x] Há rollback documentado e demonstrado para a composição aplicável. — `createApplication` (`src/index.js`) continua usando `createFakeAdapter()` por padrão; `createMiniJoomlaSharePointApp`/`createMiniJoomlaAdminApp` são aditivos e opcionais (§5/§8.2); rollback de publicação real documentado em `docs/RELEASE-MSE-0.1.0.md` e `docs/HANDOFF-DESENVOLVIMENTO.md` §9.
- [x] A integração SharePoint, se realizada, foi autorizada e validada no destino correto. — `https://petrobrasbr.sharepoint.com/teams/SAPScripting` (site de teste técnico corporativo autorizado), listas `TesteMiniJoomla*` (incluindo as 3 novas de §8.2), publicação real em `SitePages/MiniJoomla.aspx` via Modern Script Editor (§6.1/§6.2/§8.1/§8.2/§8.3). O painel administrativo (`src/administrator/components/com_minijoomla/`) foi publicado como superfície navegável própria em `SitePages/Administrator.aspx`, validado por reload real (§8.4); o controle de acesso a essa página fica para a etapa do site definitivo, por decisão explícita do usuário.

## Itens explicitamente fora do escopo atual

- ACL própria do MINIJOOMLA;
- autenticação própria, sessões, usuários e permissões editoriais;
- cópia do Joomla real ou de projetos corporativos específicos;
- publicação em SharePoint sem autorização;
- escrita editorial antes de contrato aprovado;
- `Default.aspx` antes do aceite do `Preview.aspx`;
- dados editoriais permanentes durante a fase local.

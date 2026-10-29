# Handoff operacional — MINIJOOMLA

**Data:** 29/10/2026  
**Repositório:** `C:\PROJETOS\VSTO\web-devs\MINIJOOMLA`  
**Branch:** `main`  
**Último commit:** `0dcebf6 fix: tolerate partial content adapters`  
**Remoto:** `origin/main` sincronizado no momento deste handoff.

## 1. Objetivo

Este documento permite que outra LLM assuma o desenvolvimento sem depender do
histórico da conversa. O objetivo é desenvolver o MINIJOOMLA como camada
JavaScript Joomla-like, modular e independente de SharePoint, SPMIDDLE e
`mse-platform`, usando adapters injetáveis e fake adapter local.

## 2. Estado atual

### Entregue

- Shell responsivo com identidade Petrobras, header, menu, breadcrumbs,
  conteúdo, sidebar, footer, skip link e foco em `main#main-content`.
- Router com home, artigo, categoria, busca e 404; hash routing, `hashchange`,
  `popstate`, `basePath`, query strings e proteção contra prefixos semelhantes.
- Lifecycle idempotente `start()`/`stop()`, loading imediato, `aria-busy`,
  proteção contra navegações obsoletas e hooks isolados.
- Fake adapter sem rede para artigos, categorias, menus e tags, com publicação,
  expiração, busca, paginação, ordenação segura, desempate determinístico,
  limite de tags populares e cópias defensivas.
- Content service com páginas normalizadas e tolerância a adapters parciais ou
  ausentes.
- Módulos de menu, breadcrumbs, artigos recentes, artigos por categoria e tags
  populares; registry com posições, ordem, habilitação, validação e isolamento.
- Views tolerantes a view models esparsos.
- Sanitização de HTML e URLs, incluindo bloqueio de esquemas executáveis,
  protocol-relative URLs, credenciais e caracteres de controle.
- Configuração normalizada (`basePath`, `pageSize` 1–50, defaults e timezone).
- EventBus com validação de listener e unsubscribe.
- Busca acessível, paginação, tags, loading/empty/error/404.
- Documentação de equivalência Joomla, aceite local e integração futura.

### Baseline

Executar no diretório do projeto:

```powershell
npm test
npm run check
git diff --check
```

No último ciclo: **34 testes aprovados**, sintaxe de **17 arquivos JavaScript**
aprovada e `git diff --check` aprovado.

### Navegador

Foram validados com instâncias isoladas próprias do FIORI-AUTO: cinco rotas,
320/768/1366/1920 px, foco, idioma, títulos, busca, 404, overflow e links
internos sem `javascript:`/`data:`.

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

## 3. Pendências reais

Não declarar como concluídos sem evidência: zoom efetivo de 200%/400%,
`forced-colors`/alto contraste efetivo, inspeção visual do SharePoint correto e
integração real com SPMIDDLE.

Também revisar em `docs/JOOMLA-EQUIVALENCE.md`: `mod_articles_archive`,
`mod_tags_similar`, HTML personalizado, plugins completos, indexação avançada e
o contrato final de ports, `Result`, erros, timeout, retry e convenção de `ref`.
Não inventar escopo ou comportamento de produção para fechar essas lacunas.

## 4. Fronteiras e decisões obrigatórias

O MINIJOOMLA não importa nem conhece SharePoint, REST, Graph, SPMIDDLE,
`mse-platform`, listas `mse*`, cookies, tokens, ETags ou URLs internas.

```text
dados → adapter/ports → casos de uso → view models → componentes → template
```

Na fase local: somente fake adapter, sem rede, ACL, escrita, dados editoriais
permanentes ou alterações em `Preview.aspx`/`Default.aspx`.

O plano futuro está em `docs/INTEGRATION-SPMIDDLE.md`: Marco A congela ports;
Marco B implementa adapter de leitura isolado; Marco C é leitura autorizada em
`Preview.aspx`; Marco D trata escrita somente com contrato separado, CSRF,
idempotência, concorrência, ETag e rollback. Não avançar para C/D por inferência.

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

- coordenador: `hub-ai/gpt-5.6-luna`;
- executores: `hub-ai/gpt-5-2-petrobras`;
- revisor: `hub-ai/claude-sonnet-5`.

#### Disponibilidade homologada

Para este workspace, somente os modelos GPT e Claude Sonnet estão homologados
para execução por agentes. Os demais modelos que eventualmente apareçam no
catálogo do provider `hub-ai` — incluindo DeepSeek, Kimi e Claude Haiku — ainda
não devem ser selecionados, pois não estão homologados.

Assim, as opções homologadas relevantes são:

```text
hub-ai/gpt-5.6-luna
hub-ai/gpt-5-2-petrobras
hub-ai/claude-sonnet-5
```

O coordenador deve verificar a disponibilidade real antes de delegar. Se forem
necessários três papéis simultâneos (coordenador, executor e revisor), usar
variantes/modelos GPT e Claude Sonnet distintos quando a plataforma permitir;
caso não seja possível manter três identificadores distintos, não simular a
separação: registrar a limitação e executar somente a coordenação/revisão que
estiver efetivamente disponível.

Se o Hub rejeitar uma delegação, registrar a indisponibilidade; nunca declarar
uma revisão ou execução que não ocorreu.

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
   `docs/JOOMLA-EQUIVALENCE.md`, `docs/ACCEPTANCE-CHECKLIST.md` e
   `docs/INTEGRATION-SPMIDDLE.md`.
2. Executar baseline:

   ```powershell
   Set-Location C:\PROJETOS\VSTO\web-devs\MINIJOOMLA
   git status --branch --short
   git log -5 --oneline
   npm test
   npm run check
   git diff --check
   ```

3. Escolher uma lacuna, documentando escopo, arquivos, contrato, testes,
   evidência e rollback antes de implementar.
4. Alterações de UI/rota/CSS exigem nova validação pelo FIORI-AUTO.

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

Antes da integração remota, rollback é local e reversível:

```powershell
git log --oneline
git revert <commit-da-frente>
npm test
npm run check
git diff --check
```

Nunca usar reset destrutivo e nunca apagar os caminhos não rastreados da outra
frente. Integração futura exige versão imutável, composição novamente com
`FakeAdapter` e procedimento específico do SPMIDDLE/host autorizado.

## 10. Referências canônicas

- `README.md`
- `PROMPT-DESENVOLVIMENTO-MINIJOOMLA.md`
- `docs/JOOMLA-EQUIVALENCE.md`
- `docs/ACCEPTANCE-CHECKLIST.md`
- `docs/INTEGRATION-SPMIDDLE.md`
- `src/index.js`
- `src/core/router.js`, `config.js`, `events.js`
- `src/application/content-service.js`
- `src/infrastructure/fake-adapter.js`
- `src/security/sanitize.js`
- `tests/core.test.js` e `tests/static-ui.test.js`
- `app-devs/FIORI-AUTO/README.md` e `docs/api-rpc.md`
- `web-devs/_docs/DIRETRIZ-FIORI-AUTO-OBRIGATORIA.md`

# Testes nativos locais do painel

O comando separado abaixo executa `tests/admin-layout-dom.test.js` no Edge via
**FIORI-AUTO** e exercita teclado nativo, sem acessar SharePoint ou depender de SPMIDDLE. `npm test` testa
os contratos do runner, mas não abre navegador nem converte esses contratos em
aceite visual.

## Executar

Pré-requisitos: Windows, Edge e o `FioriAgent.exe` pré-compilado .NET 9, versão
0.3.3, fornecido separadamente pelo FIORI-AUTO. Não recompilar ou instalar outro
controlador para rodar este fluxo. Caminho local explícito, sem UNC:

```powershell
npm run test:admin-layout -- --agent '<caminho-local-do-FIORI-AUTO>\fiori-agent\FioriAgent.exe'
```

O script não baixa nem distribui o agente. Não há caminho corporativo embutido,
URL de tenant, opção de attach ou modo que ignore uma largura com falha.

## Isolamento e encerramento

- Servidor HTTP somente leitura em `127.0.0.1`, porta dinâmica; não serve tmp.
- Processo FioriAgent próprio, portas RPC/CDP distintas e perfil único em
  `tmp/admin-layout-<id>/profile`. Nunca usa o perfil do usuário ou outra LLM.
- Aguarda o banner do processo criado; mantém a reserva CDP até o início da
  sessão. Usa `agent.startSession`, **não `browser.open`**, porque o último
  navega uma aba reutilizada antes de permitir conferir sua propriedade.
- Confere por metadados do Windows que o Edge tem esse perfil, foi criado pelo
  PID do agente e é o proprietário da porta. Nenhuma avaliação é permitida antes
  disso; se a porta for tomada por outra instância, recusa continuar. Os métodos
   de controle passam apenas pelo FIORI-AUTO; não usa CDP ou Playwright avulso.
- Teclas somente por `fiori.pressKey`, com `sessionId` explícito dessa sessão
  própria, sem selector ou sessão implícita. Allowlist restrita a **Tab/Enter/Escape**;
  confere a origem/página loopback imediatamente antes de cada tecla. Não permite
  click/fill/attach via RPC nem usa `dispatchEvent` para simular teclado.
- Encerramento idempotente de aplicação/sessão; recuperação restrita a processos
  com esse perfil único caso a RPC falhe. Nunca encerra globalmente Edge ou
  FioriAgent. Confere a ausência de processos do perfil ao terminar.
- SIGINT/SIGTERM controláveis abortam RPCs pendentes e os checkpoints restantes,
  e acionam o encerramento. Encerramento forçado do servidor/SO pode impedir
  `finally`; **não** reanexar automaticamente após restart. Em caso de sobra,
  verificar propriedade do perfil/processo antes de uma recuperação manual.
- Mantém perfil/evidências em tmp, sem exclusão automática. Não versionar ou
  distribuir esses artefatos; o relatório não inclui ponteiro de sessão, URL de
  autenticação, raw stdout/stderr ou command lines de processos.

## Cobertura e resultado

Sete larguras: **320/768/769/900/1366/1920/2560px**. Em dados demonstrativos
somente em memória, verifica:

- montagem única, contenção do painel e geometria de ações/cards;
- título como link em cabeçalho de linha e nome de edição contextualizado;
- rota para o formulário do registro correto, sem salvar/excluir;
- legenda de ação obrigatória e indivisível, short-title e múltiplas ações;
- SVG 2rem, contador junto ao ícone, label abaixo, nome longo e contador longo;
- contraprovas sintéticas do CSS antigo de ações e SVG; ambas devem ser
  detectadas e a fixture deve voltar a passar depois da remoção do override;
- ausência de mutação dos artigos e remoção das fixtures.
- fixture de publicação/destaque ativo, futuro, encerrado e inválido; estrela
  cheia somente com publicação e destaque vigentes, SVGs 12px e labels ocultos
  coincidentes com `title`, preservação dos registros e rolagem restrita à tabela.

### Teclado nativo obrigatório

Em **todas as sete larguras**, a fixture prepara a listagem e dá foco apenas ao
controle imediatamente anterior ao primeiro título (botão Buscar). Um **Tab real**
deve alcançar o título; **Enter real** deve ativar seu link/hash e abrir o
formulário do registro correspondente, conferindo rota, título e alias. A fixture
aguarda a renderização assíncrona; não navega em nome da tecla.

Em **320/768px**, prepara foco no toggle móvel fechado: **Enter** abre e atualiza
`aria-expanded`; dois **Tabs** atravessam a marca e alcançam um link dentro da
sidebar. **Escape** desse link deve fechar a sidebar, definir `aria-expanded=false`
e devolver foco ao toggle. Isso exercita os handlers existentes de
`src/administrator/components/com_minijoomla/app.js`, sem alterá-los. Em **769px ou mais**, o caso móvel é
explicitamente não aplicável; o caso de título continua obrigatório.

Os observadores exigem `event.isTrusted`, alvo, ordem e quantidade de teclas,
além do foco/DOM resultantes. As contraprovas recebem teclas igualmente reais:

- inspeção sem enviar tecla deve rejeitar a ausência;
- título com `tabindex=-1` deve falhar no alcance por Tab;
- ativação Enter do título bloqueada deve falhar na abertura do formulário;
- Escape bloqueado deve falhar no fechamento do menu;
- retorno de foco do toggle suprimido deve falhar no foco, mesmo fechando o menu.

Todos os overrides/listeners negativos são removidos ao preparar o próximo caso,
terminar o teclado ou encerrar a suíte. Submits são interceptados e contados;
tentativas de create/update/delete são bloqueadas e contadas. **Qualquer submit,
tentativa de escrita ou alteração do snapshot de qualquer repositório em memória
reprova o aceite.** Nenhum dado de tenant/persistência/editor rico participa.

O relatório contém `keyboard` obrigatório por largura, com checks positivos e
negativos nomeados. Relatórios antigos de layout sem esse grupo **não** satisfazem
o novo aceite; CLI, versão 0.3.3 do agente e as sete larguras foram preservadas.
`tests/admin-layout-runner.test.js` verifica também a orquestração/contrato com
fixtures de transporte Node, falhas/ausências de resultados e encerramento em
falha. Essas fixtures não são evidência de input nativo.

Reexecução local em **04/11/2026**, a partir da base de agendamentos `4fda211`:
**sete larguras aprovadas**, inclusive teclado real, contraprovas e fixture de
agendamento, com encerramento dos processos próprios confirmado pelo runner.
Evidência final local: `tmp/admin-layout-SjRHMq/report.json`, não versionada;
nenhuma falha de cleanup. A rodada inicial aprovou **37 suítes Node, 0 skips,
0 falhas**; a reexecução final, já incluindo uma suíte de descoberta adicionada
por outra frente, aprovou **38 suítes, 0 skips, 0 falhas**. `npm run check`
aprovou 129 arquivos JavaScript na reexecução final. Isso não aprova distribuição
ou publicação. Nenhuma alteração de runtime, CSS Atum ou página publicada nesta
frente de teclado.

Reexecução durante o incremento de metadados de descoberta em **04/11/2026**:
sete larguras voltaram a passar pelo mesmo runner nativo, sem alterações no
runtime administrativo ou CSS desta suíte. Evidência local preservada em
`tmp/admin-layout-CO0noZ/report.json`, não versionada. Os novos testes de scan e
registro também passaram na rodada completa de **38 suítes Node**, incluindo
672 contraprovas de nomes reservados; isso não transforma a suíte de teclado
em validação de gravação ou descoberta real no tenant.

Semântica e limites de atualização: [contrato de agendamentos](CONTRACTS-MINIJOOMLA.md#62-agendamentos-de-artigo-e-indicadores-administrativos).

Grava `tmp/admin-layout-<id>/report.json`, em pasta exclusiva por invocação, e
retorna saída não zero para falha de preparação, RPC, qualquer largura,
contraprova ou encerramento. Erro do ambiente não é skip de layout.

**Não verifica:** TinyMCE, uploads, persistência real, zoom real, cores forçadas,
leitor de tela, comparação pixel a pixel com Atum ou aceite visual integral.
Não publica, aprova release, faz commit/push ou toca a página pública.

O servidor também permite abrir `/tests/admin-layout.html` para inspeção manual
local. `window.minijoomlaLayoutReady` resolve para uma suíte com `run()`/`stop()`
e preparação/assertions `prepareKeyboard()`/`inspectKeyboard()`/`finishKeyboard()`.
`run()` sozinho inspeciona layout/rota, **não** comprova teclado: o comando nativo
coordena as teclas e valida ambos. No workspace, a abertura/inspeção deve continuar
usando FIORI-AUTO próprio.

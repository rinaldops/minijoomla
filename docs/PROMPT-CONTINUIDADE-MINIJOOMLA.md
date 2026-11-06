> **Atualização de retomada — 03/11/2026:** rodada integrada publicada como
> 0.2.1/snapshot `39ec4b0`, site e painel verificados. As notas abaixo descrevem
> a fila histórica inicial; não reabrir implementações já comprovadas nem
> presumir outra LLM ativa no editor. Comece pela tabela reconciliada do plano
> e pela nota 0.2.1 do handoff. Prioridades restantes são aceites reais de
> zoom/forced-colors/leitor de tela, comparação visual e operações em tenant
> autorizadas; sem ACL/Schema.org/histórico ou rollback destrutivo presumidos.

Você assume a coordenação geral e a execução do MINIJOOMLA em
`C:\PROJETOS\VSTO\web-devs\MINIJOOMLA`. Sua missão é concluir as melhorias
pendentes conforme o
[plano detalhado](PLANO-CONTINUIDADE-MINIJOOMLA.md), usando o
[handoff](HANDOFF-DESENVOLVIMENTO.md) como fotografia inicial, não como
substituto de verificar o estado atual.

## Objetivo do produto

O MINIJOOMLA é um CMS JavaScript modular, com adapters de dados substituíveis,
administração própria e integração SharePoint/SPMIDDLE. Aproxime suas funções,
convenções e layouts do [Joomla local](../../JOOMLA/) sem copiar código ou
ativos protegidos. Priorize:

1. Painel funcional de componentes, módulos, plugins e templates, com
   persistência, concorrência e efeito comprovado no site.
2. Cassiopeia visual e estruturalmente próximo do Joomla original.
3. CAMAP próximo do modelo `mse-platform` + CAMAP-AGP e coerente com a
   [identidade Petrobras](../../docs/IDENTIDADE-PETROBRAS.md).

Não prometa equivalência integral, ACL própria, administração de usuários,
execução de PHP, transações entre listas ou instalação de pacotes arbitrários
sem backend e requisito reais.

## Primeiro contexto e coordenação

1. Leia `C:\PROJETOS\VSTO\AGENTS.md`, `CLAUDE.md`, `AI_CONTEXT.md`, o catálogo
   `skills\README.md`, as instruções de `web-devs` e as instruções específicas
   existentes do projeto. Consulte o plano e os documentos de administração,
   templates e release nele referenciados. Tratamentos antigos no handoff e em
   runbooks são históricos, não estado atual.
2. Confira `git status`, diff, branch, arquivos não rastreados e dependências
   nos repositórios envolvidos. MINIJOOMLA está no repositório `web-devs`;
   o checkpoint `a6d809d` não contém todas as alterações locais. Preserve
   mudanças alheias, inclusive `HH-web` e `hub-ai`; não limpe o workspace nem
   reescreva histórico para facilitar a integração.
3. Há outra LLM na frente do editor de artigos. Coordene com ela antes de
   modificar seus arquivos, congelar o pacote completo ou alterar loaders.
   O usuário mencionou `docs\PLANO-EDITOR-ARTIGOS-JOOMLA-LIKE.md`; ele não
   apareceu nesta cópia em 03/11/2026. Procure a origem com a responsável,
   sem recriá-lo ou presumir que o trabalho foi descartado.
4. Trabalhe automaticamente dentro do escopo autorizado, sem pedir permissão
   por etapa. Delegue frentes independentes com arquivos exclusivos e aceite
   claro; integre, revise e teste as entregas. O usuário solicitou `hub-ai`
   quando possível: use suas ferramentas e modelos realmente disponíveis,
   somente no limite corporativo autorizado e sem enviar segredos ou código
   sensível a sistemas externos. Nesta sessão o SDK `agents` estava ausente
   e o restore foi bloqueado por CA bundle configurado inexistente; não
   desabilite TLS, proxy, certificados, Netskope ou DLP para contornar isso.
5. Crie temporários e perfis apenas em `tmp` no nível mais próximo do projeto.
   Worktrees devem ser irmãs do projeto e chamar-se
   `MINIJOOMLA-worktree01`, `MINIJOOMLA-worktree02` etc. Verifique a relação
   com o repositório agregador antes de criá-las. Nunca apague dados ou
   alterações de outra frente para resolver conflitos.

## Situação técnica a tratar primeiro

- A frente administrativa adicionou telas e serviços para parâmetros, estilos,
  atribuição de módulos e opções de componentes, mas foi interrompida. Os testes
  locais de serviço e DOM simulado passaram; vários campos ainda não chegam
  ao runtime público. Não os declare funcionais nem mantenha mensagens de
  sucesso enganosas. Siga a seção P0 do plano.
- O runtime já suporta seleção de template, 15 posições, módulos habilitados,
  menu hierárquico e página inicial por categoria ou destaques. Preserve esses
  comportamentos e teste a cadeia completa entre painel, persistência e site.
- O schema local v2 adiciona campos às listas de extensões, módulos e
  configuração; migração/compatibilidade das listas existentes ainda requerem
  inspeção e validação. Preservar escopo legado e ETags; não provisionar ou
  modificar dados remotos sem destino, efeitos e autorização verificados.
- A leitura remota anterior encontrou mistura de versões: no site público,
  loader/CSS `0.1.3` com bootstrap/JS `0.1.0`; na administração, `0.1.0`.
  Releases `0.1.0` a `0.1.4` já existiam na data da inspeção. Não sobrescreva
  essas pastas nem suponha que uma versão posterior esteja livre.
- `scripts\stage-release.js` prepara distribuição local reproduzível e
  imutável sob `tmp`; `--target site` não valida o painel. Congele fontes,
  concilie o editor e use uma saída nova. O recurso de teclado do TinyMCE
  incluído no estado local corresponde ao pacote 7.9.1; preserve sua licença.

## Ambiente, segurança e validação

- O workspace opera somente em produção. Confira a autorização e o destino
  antes de cada operação externa, sem inventar ambientes ou repetir uma
  autorização já concedida. O site solicitado é `MiniJoomla.aspx` e o painel
  é `Administrator.aspx`, no site SharePoint registrado no runbook. Não
  publique, migre ou sobrescreva conteúdo fora do escopo autorizado.
- Não registre cookies, tokens, certificados, dados pessoais ou perfis em
  código, documentação pública, Git ou evidências compartilhadas. Use feeds
  corporativos quando necessários e permita que erros reais apareçam.
- Para qualquer navegador, inclusive páginas locais, leia a
  [diretriz FIORI-AUTO](../../docs/DIRETRIZ-FIORI-AUTO-OBRIGATORIA.md) e use
  sua própria instância do `FioriAgent.exe` pré-compilado em .NET 9, com
  portas e perfil próprios. Não assuma sessão de outro agente nem substitua
  o FIORI-AUTO por automação direta. Evite cache antigo nos testes de ES modules.
- Faça testes automatizados e funcionais proporcionais ao risco, inclusive
  fluxo real de persistência, estados de erro, ETag, acessibilidade e layout.
  Execute `npm test`, `npm run check`, `npm run release:check`,
  `npm run test:release-stage` e `git -C .. diff --check -- MINIJOOMLA`
  a partir da raiz do projeto; acrescente testes específicos para mudanças.
- A publicação, caso autorizada, exige release imutável coerente, verificação
  real de site e painel, MIME/CSP/cache/permissões e rollback reproduzível.
  O estágio local e `release:check` não provam publicação. Não use métodos
  de canvas inexistentes no FioriAgent; siga o runbook.
- Commit, push e publicação são operações separadas; não generalize uma
  autorização antiga de outra tarefa. Preserve o histórico e os apontadores
  dos agregadores conforme as regras do workspace.

Prossiga continuamente com as tarefas independentes e suas integrações. Pare
apenas diante de decisão de negócio indispensável, bloqueio efetivo ou fim do
escopo; documente o que foi realmente feito, testes, limitações, bloqueios e
próximos passos. Não declare prontidão por tela isolada ou teste falso.

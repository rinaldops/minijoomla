# Instalação genérica — continuidade após instalar

## Desenvolvimento prioritário e preservação

Segunda rodada do bootstrap genérico, sem desenvolvimento de módulos específicos
do TD e sem retirar CAMAP antes do template definitivo externo. Não provisionar
o site aceito para testar uma primeira instalação: ele contém dados e aprovações
que precisam ser preservados. O destino vazio real ainda precisa ser definido.

O primeiro incremento validou engine/port e UI em memória, mas não executou o
host copiado com as composições reais. Esta rodada verifica o pacote exato offline
e a continuidade dos ajustes iniciais no painel/site.

## Falhas identificadas → correção

- Configuração operacional `initialSite` chegava à composição, mas o serviço
  administrativo não a usava. A tela de configuração vazia mostrava defaults da
  demo (`category/noticias`) e perdia os valores escolhidos ao salvar. Uma primeira
  gravação parcial de estilos/opções também podia criar uma linha sem esses ajustes.
- Overrides com propriedades ausentes apagavam defaults operacionais; categoria
  vazia explícita de home featured era descartada. Ausência agora não é override;
  strings vazias explicitamente salvas continuam distintas de ausência.
- URLs diretas do host em web raiz não podem começar com `//_api`; normalização
  aplicada ao current-user e recycle, sem alterar credenciais ou origem.
- Pacote deve explicar seus entrypoints genéricos e inventariar recursos do host
  que não são imports (CSS/base do editor). Novo `installation-entrypoints.json`
  declara layout, snippets, configuração operacional e defaults, com publicação
  não aprovada e sem infraestrutura/amostra/extensões instaladas pelo builder.

Defaults são metadados separados de `siteConfig.get()`: este continua `null`
quando a lista está vazia. Não criar linhas no mount nem tornar Sample Data
automático. Somente a primeira ação explícita de salvar cria a configuração
nativa com os ajustes iniciais. Depois, valores persistidos/ETags e JSON do
administrador têm precedência; a configuração operacional inicial não é regravada.

## Teste → análise → validação → documentação

Em execução: roundtrip do host real do stage, composições reais e REST simulado;
testes negativos de primeira gravação parcial, recarga e legados. Isso verifica
contratos, não navegador, tenant ou MSE. Teste de teclado/reflow da configuração
usa FIORI-AUTO próprio com repositórios em memória e nenhum write remoto.

Gate separado: cópia fiel em destino SharePoint vazio autorizado, duas páginas
MSE, instalação real pelo painel, reload, Sample Data opcional e recuperação.
Não promover prova offline ou UI em memória a aceite no SharePoint.

## Resultados após análise e retestes

- Revisão independente reproduziu as falhas de primeira configuração completa,
  primeira opção de componente e primeiro estilo. Depois das correções, os três
  caminhos montam a home vazia com nome/fuso/página iniciais e Cassiopeia. Registros
  persistidos continuam authoritative e os domínios permanecem vazios até ação.
- O host staged revelou ainda a normalização da registry (`/` → `''`) nas
  factories. O host reconverte o web raiz para `/` antes de construir o REST client
  e adapta o transporte do Files sem editar SPMIDDLE. URLs emitidas seguem `/_api`,
  não `//_api`. Caminhos seguros com ponto também não quebram o wrapper de mídia.
- `scripts/test-generic-installation-host.js`: **oito grupos de contrato offline**
  carregam os módulos reais do pacote imutável, com URLs HTTPS e imports limitados
  ao inventário. Formulário real exige confirmação; engine cria listas vazias e
  arquivo de configuração; admin/site/media/reload e primeira configuração passam
  em subsite e web raiz. REST, documento e formulário são contratos simulados;
  isso não prova DOM, editor rico, CSP ou comportamento real do SharePoint.
- FIORI-AUTO próprio: tela da configuração mostra valores iniciais sem criar
  linha; Enter nativo salva a primeira configuração. Recriação da app administrativa
  com a mesma persistência e abertura pública conservam Cassiopeia/home vazia.
  Reflow 320/768/1366 passou. **Repositórios em memória**, zero writes remotos;
  não é reload de página SharePoint. Browser próprio e servidor foram encerrados.
- A primeira regressão integrada reprovou o teste antigo de upload que exigia o
  contador global exatamente 1. Assertion agora confere o nome gerado seguro e a
  URL confirmada pelo upload, preservando o teste real de persistência das imagens.
  Reteste focal e regressão completa passaram: **109 suítes, zero skips/falhas**;
  parse-only **333 JS/MJS**. Contributor: **418 caminhos exatos**, hashes/seleção
  determinísticos e gates de inventário/contenção aprovados.

Commit/push deste incremento autorizados pelo usuário após os resultados acima,
somente na branch `feat/joomla-finalization-step2`. Referência anterior `619a37d`;
mensagem do checkpoint: `feat: generalize initial installation and preserve empty-site settings`.
Não houve deploy/publicação ou mudanças no site aceito.
O teste real precisa de **destino vazio específico**;
não inferir que qualquer site com acesso serve para criar oito listas canônicas.
Configuração de raízes de extensão após instalar e XML de plugins/templates são
lacunas seguintes, não recursos já encerrados por estes testes.

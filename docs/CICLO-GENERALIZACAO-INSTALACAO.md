# Generalização — instalação inicial Joomla-like

## Desenvolvimento prioritário

O fluxo do produto deixa de depender do deploy para oferecer a primeira tela:
uma release copiável e duas páginas MSE devem abrir o instalador do CMS antes
da composição persistida. Site Cassiopeia/painel Atum; nenhum módulo TD ou
template corporativo instalado como default. Templates CAMAP atuais permanecem
referência transitória até o CAMAP-V3 externo estar pronto.

Implementação local desta rodada:

- `application/installation-service.js`: plano estável, confirmação e diário;
  criação-only das oito listas, nenhum registro editorial/template/módulo;
  retomada somente por prefixo com recibos exatos, nunca replay de intenção incerta.
- `infrastructure/sharepoint-installation.js`: types/required/defaults/choices/
  índices/unicidade reais verificados, `Author0`, sem `Folder` reservado;
  configuração operacional exclusiva em arquivo, preservação de listas existentes.
- `installation/template.js`: tela independente do dashboard, confirmação clara,
  estados de ausência/parcial/incompatível, progresso e guardas de navegação.
- Host genérico resolve contexto do site/biblioteca e configura mounts somente
  depois da inspeção instalada; configuração explícita anterior segue compatível.
- `scripts/stage-generic-installation.js`: pacote offline copiável com host,
  dois snippets e bootstrap inventariados, sem acesso ao tenant.

## Análise → correção antes de teste no site

A revisão independente encontrou e orientou três correções: cancelamento deve
alcançar POST/MERGE internos e o dispatch após request digest; configuração de
deploy precisa de marcador único; um público instalado deve montar sem exigir
journal gravável. O journal ausente ainda bloqueia novas instalações; corrupção
ou intenção pendente nunca vira ausência. A biblioteca e a release devem ser a
mesma base, não um fallback para instalação de outro pacote.

O formulário exige o plano que acabou de inspecionar e reusa ajustes da retomada.
Configuração operacional contém `initialSite` com home featured/categoria vazia,
sem criar linha de SiteConfig. Isso mantém os domínios vazios para o Sample Data
opcional pós-instalação, sem afrouxar guards de conteúdo. Configuração salva pelo
administrador posteriormente continua protegida contra sobrescrita de amostra.

## Validação atual e gates pendentes

Testes locais do engine/port/UI/contexto/pacote em andamento; falhas de integração
de mocks `get/set` versus `read/write` foram corrigidas explicitamente, sem
alterar a API para esconder erro. Não é instalação inicial aprovada no tenant.

Reauditoria confirmou correções de cancelamento/dispatch, marcador único e
inspeção instalada sem journal. Apontou erro na transição após instalar: a UI
desativava sua tela antes de abrir o aplicativo e silenciava falha de montagem.
Agora apresenta alerta explícito na raiz dedicada, sem habilitar reinstalação
nem apagar o diário. Teste adversarial dessa transição passou.

Regressão integrada inicial reprovou contributor e seu child por um constraint
antigo que excluía todo `host-adapters`. A seleção agora admite **somente quatro
arquivos genéricos revisados** (host, contexto e dois snippets), mantendo arquivos
operacionais/runbooks fora. Suíte contributor focal passou; não remover checks
de inventário ou permitir configuração arbitrária pelo nome da pasta.

## Teste de UI no navegador → análise

Prova via FIORI-AUTO próprio em página loopback: tela inicial sem listas e sem
write espontâneo, reflow 320/768/1366, confirmação com Space e submissão com
Enter nativo. Engine completou oito listas/configuração com recibos, default
Cassiopeia e home featured sem categoria; nenhum conteúdo ou template externo.
**Ports e persistência em memória**, nove writes locais, zero writes remotos.
Essa prova não é provisionamento real nem aceite do bootstrap nas duas páginas
SharePoint. Navegador próprio e servidor loopback encerrados; fontes existentes
do site aceito permaneceram fora de escrita.

Focais: engine dez grupos; port 23 casos, inclusive SPMIDDLE real com fetch
simulado no dispatch após digest; UI/contexto/pacote e transição adversarial
passaram. Nova regressão integrada deve terminar com seleção estável antes de
declarar esse incremento local consolidado.

Antes de promover: regressão integrada, negativo de cancelamento interno/digest,
teste do pacote exato nas páginas usando repositórios/transporte isolados, teclado
e cleanup. Instalação real de infraestrutura exige destino vazio específico
autorizado; não usar o site aceito para reinstalar/criar listas ou publicar páginas.
Seguir Desenvolvimento → Teste no site → Análise → Validação → Documentação,
voltando às correções/retestes quando necessário.

## Validação e documentação do incremento local

Depois das correções, `npm test` completo terminou com **106 suítes aprovadas,
zero skips e falhas**. Checker parse-only conferiu **328 JS/MJS**. Contributor
selecionou 410 caminhos exatos, incluindo os quatro bootstrap genéricos; bytes e
inventário determinísticos conferidos, sem inclusão de conteúdo operacional TD.
Todos os imports/recursos literais do host no novo pacote são inventariados.

Este resultado fecha desenvolvimento/teste/análise/validação **local** do primeiro
incremento; o teste de UI em navegador foi em memória. **Não houve instalação real
no SharePoint nem publicação do pacote.** Teste do pacote exato sob MSE e
provisionamento/recuperação em destino vazio específico continuam próximos gates.
Também ficam pendentes configuração de raízes/extensões após instalação, XML
plugins/templates e migrações assistidas. CAMAP continua referência temporária,
não default de primeira instalação. Trabalho local ainda sem novo commit/push.

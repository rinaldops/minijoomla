# Raízes de extensões — configuração pós-instalação

## Checkpoint e escopo

Primeira instalação/continuidade commitadas e enviadas em `765e174`, branch
`feat/joomla-finalization-step2`, após 109 suítes aprovadas e UI em memória.
`main` e worktrees não foram modificadas pelo push. Este é o próximo incremento,
sem deploy, instalação de extensões TD ou retirada antecipada de templates CAMAP.

## Desenvolvimento

- Configurar raízes somente depois do CMS instalado, pela rota `#/installer/roots`.
- Arquivo separado `<libraryPath>/extensions-host.json`; não alterar
  `installation.json`, seu ETag ou o journal de instalação.
- Reutilizar o normalizador de raízes/mapas existente. Cada adição exige uma
  única raiz imutável, hash de inventário explicitamente informado e confirmação;
  conferência readonly de XML/inventário/payloads e vínculos CSS antes de gravar.
- Preservar todas as raízes anteriores e mapas por revisão, inclusive
  `discover:false`, contando todas no limite de dez. Não oferecer remoção;
  participação na descoberta não é habilitação de código.
- Criação exclusiva; atualização condicionada ao ETag capturado, confirmação por
  readback. Cancelamento deve chegar ao dispatch depois do digest. Escrita incerta
  não autoriza repetição automática.
- Genérico não faz fallback para descoberta JSON legada. Hosts preconfigurados
  conservam sua configuração/integradores anteriores. Reload explícito recompõe
  site/admin com as novas aprovações; não há hot-swap implícito.
- Descritores verificados no instalador genérico precisam de vínculo CSS exato
  por entrypoint, usando o guard já existente, também em upgrade/rollback.

## Gates de validação em andamento

Testes de engine/port/UI: corrupção/ausência/403, ETag obsoleto, adição idempotente,
limite incluindo retidas, bases externas, alteração de pin antigo, CSS de revisão
divergente, cancelamento e readback incerto. Pacote exato deve montar sem overlay
e carregar aprovações válidas sem tocar conteúdo, configuração inicial ou journal.
UI com teclado/reflow deve ser exercitada via FIORI-AUTO próprio, em memória.

Esta entrega não implementa XML de plugins/templates, upload ZIP, direitos/ACL ou
publicação. XML de módulos continua o perfil atual; aprovar uma raiz não autoriza
instalar todos os módulos encontrados. Aceite SharePoint real exige destino
específico autorizado e segue pendente.

## Análise e retestes desta implementação

O engine e o port usam `minijoomla-extensions-host-v1`; divergência transitória
de formato encontrada durante integração foi corrigida antes do pacote final.
Revisão independente confirmou preservação dos recibos, ausência de fallback
legado no host genérico e guard CSS também para revisões anteriores.

Foram corrigidos e retestados: comparação de CSS como conjunto (agora ordem
exata usando o guard comum), cancelamento não encaminhado às leituras/verificação
e resposta binária ausente na fixture HTTP do overlay existente. Negativo de
CSS inicialmente não reprovou porque a fixture compartilhava a mesma lista nos
dois mapas e a invertia duas vezes; teste passa a inverter uma única vez.

Focais aprovados: **12 grupos do engine**, **15 grupos core/local do port**, UI
com confirmação/ETag/navegação/duplicação e host exato staged com overlay ausente
ou aprovado, subsite/raiz, conteúdo/configuração/journal preservados. A suíte de
host integração também executa o cliente REST SPMIDDLE real com fetch em memória:
criação exclusiva, override PUT/If-Match exato e cancelamento depois do digest.

UI via FIORI-AUTO próprio em loopback: Space/Enter para confirmar aprovação de
uma raiz e ocultá-la da descoberta. Reflow 320/768/1366, dois writes em memória,
uma raiz conservada e **zero extensões registradas**. O verifier do pacote nessa
prova de UI foi simulado; verificação de XML/payloads pertence aos testes do port.
Nenhum write remoto. Navegador próprio e servidor encerrados.

Regressão integrada do incremento aprovada: **112 suítes, zero skips/falhas**;
checker parse-only **339 JS/MJS**, contributor **426 caminhos exatos** com
inventário/hashes determinísticos e gates preservados. Desenvolvimento posterior
ao checkpoint `765e174` permanece separado, sem push automático por estes testes.

**Checkpoint Git solicitado posteriormente:** commit/push deste incremento
autorizados pelo usuário na branch step2, mensagem
`feat: configure approved extension roots from the administrator`.
Também foi solicitada a avaliação do merge/retirada; essa autorização não elimina
os gates de reconciliação/preservação da principal nem o aceite SharePoint pendente.

### Retomada

Use `#/installer/roots`, informe o `host-config.json` de uma única raiz já copiada,
confirme a aprovação e aguarde o resultado. Reabra a rota para obter novo ETag;
recarregue a página para recompor o discovery com a nova configuração. Listas de
conteúdo e templates não são modificadas por essa ação. Nunca alterar um pin/base
de raiz já aprovada: nova revisão requer novo ID e base, mantendo a anterior.
O perfil XML vigente é de módulos; plugins/templates XML continuam pendentes.

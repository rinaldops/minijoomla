# Ciclo — parâmetros declarados de estilos de templates instalados

## Desenvolvimento

Incremento posterior às posições, sobre a candidata step2 sem substituir a
principal. User mantém ciclo Desenvolvimento → Teste no site → Análise →
correções/reteste → Validação → Documentação. Videoteca/Forum permanecem fora
do núcleo; templates CAMAP são referências temporárias, CAMAP-V3 externo.

Decisão de persistência: o schema atual não possui `ParamDefinitionsJson`.
Usado o campo **Templates.Styles já existente**, com envelope JSON versionado
`minijoomla-template-metadata-v1`: `styles` e `paramDefinitions`, além de
metadata futura conservada. Arrays/paths CSS legados continuam legíveis.
Nenhuma coluna criada, migração ou alteração de infraestrutura/site realizada.

Parser comum limita metadata a 64 KiB, CSS a 50 itens e parâmetros aos tipos/
limites do contrato declarado existente. Getters/hooks/formatos inválidos não
viram definições vazias. Manifestações e registro manual preservam confirmação;
instalador manual registra desabilitado, sem selecionar um default.

Administração entrega definições aos formulários de estilos e valida valores
tipados. Patches normalizam só os campos editados. Runtime usa o template
selecionado e a fonte exata dos estilos salvos; defaults estáticos dos templates
integrados continuam authoritative. Templates sem declarações continuam legados.

Nova captura privada da principal: **67 arquivos / 997.546 bytes**, hashes
conferidos, originais fora de escrita. Reconciliação continua incremental;
não foi feito merge nem excluída worktree.

## Teste no site → Análise → correção → reteste

FIORI-AUTO próprio na página SharePoint autorizada, em iframe temporário com
ES modules em SiteAssets. Templates e persistência em memória, não as listas
aceitas. Provas em revisões novas, sem sobrescrever assets anteriores.

Achados de análise corrigidos antes do aceite:

1. A composição pública não carregava `templateStylesJson` bruto; o runtime
   recomputava defaults e perdia valores/style ID salvos. A fonte exata agora
   atravessa os overrides, com regressão de composição SPMIDDLE real em memória.
2. Envelope válido quebrava registros de templates integrados. CSS é extraído
   para todos; definições builtin continuam prevalecendo sobre metadata externa.
3. Objetos/listas não obedeciam ao limite de bytes e um `format` herdado podia
   executar getter. Limites aplicados a dados inertes e propriedade own obrigatória.
4. Salvar estilo A reescrevia o B: removia metadata futura, convertia parâmetros
   e materializava defaults ausentes. Leitura conserva os dados; validação de
   listas textuais não reserializa/coage; somente PATCH explícito de parâmetro
   normaliza seu valor. Negativo confirma preservação do outro estilo completo.
5. Regressão detectou `paramDefinitions:undefined` no registrar legado e erro
   textual antigo esperando só array CSS. O registrar omite campo ausente e o
   teste mantém recusa de metadata inválida no novo formato, sem ignorar falhas.

Primeiro envio de prova excedeu timeout e ficou parcial, sem aprovação. Provas
seguintes reduziram o recorte de assets de teste (sem middleware/editor não usados
pelos repositories em memória), mantendo package target distinto de release host.
Final: **208 payloads + manifesto**, hashes readback conferidos em lotes.

Montagem inicial em JSON do SharePoint demorou/não montou documento normal; usada
prova de iframe com documento same-origin e módulo externo. Teclado precisa abrir
a aba Avançado antes de editar campos; nenhum clique/eval de submit substitui o
teste nativo. Isso não requer afrouxar CSP ou alterar a página salva.

Reteste final SharePoint: campos text/number/select da declaração, aba Avançado,
edição e submit por teclado; runtime mostra texto, número e opção salvos, reflow
320/768/900. Um estilo não relacionado conservou `futureStyle`, número string,
chaves desconhecidas e ausência do default novo. Iframe removido e navegador
próprio encerrado. **48 registros/ETags, duas páginas e hash do host ativos
conferidos e iguais antes/depois**, zero writes nas listas/páginas.

## Validação e documentação

Focais aprovados: parser/envelope, tipos de parâmetros, administração/formulário,
registro, runtime e composição/repositórios SPMIDDLE reais com transporte em
memória. Schema e mapper seguem oito campos de Templates; não enviam propriedade
de coluna inexistente. Guards de ETag/preservação/corrupção continuam ativos.

Regressão integrada em reteste após correções. O CLI do contributor excedeu
30 segundos dentro da cópia standalone, sem falha de inventário identificada;
orçamento limitado ampliado para 120 segundos, sem remover checks de bytes,
seleção, hashes ou containment. Os passes funcionais não ocultam essa falha;
suite completa precisou ser retestada antes de fechar.

**Reteste final aprovado:** `npm test` terminou com **118 suítes aprovadas,
zero skips/falhas**. Parse-only conferiu **349 JS/MJS**; contributor selecionou
**441 caminhos exatos**, com inventário/hashes determinísticos e gates de
containment/CLI preservados. A reauditoria independente confirmou os quatro
achados corrigidos e executou testes focais e assertions de preservação, sem
P1 remanescente no recorte. Links documentais relativos foram verificados.

Este resultado fecha o incremento funcional com o ciclo exigido; não fecha
automaticamente integração de todo o delta da principal ou os gates abaixo.
Ensaio isolado SharePoint não é
instalação real de um template no catálogo, deploy do núcleo, XML de templates/
plugins, prontidão pública ou acessibilidade integral.

**Checkpoint solicitado posteriormente:** commit/push dos incrementos de posições
e parâmetros autorizados nesta branch step2, base `420bb07`; mensagem
`feat: reconcile installed template positions and declared style parameters`.
O próximo ciclo avança somente sobre esses resultados registrados; não implica
merge da principal, retirada de worktrees ou publicação de release no site.

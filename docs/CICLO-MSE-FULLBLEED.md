# Ciclo — integração FullBleed do MSE/SPMIDDLE

## Checkpoint e Desenvolvimento

Destaque nativo enviado em `e70067e`, remoto step2 conferido. Usuário introduziu
FullBleed no host MSE/SPMIDDLE. Fonte oficial local `6327853`, SPMIDDLE limpo;
`host-adapters/modern-script-editor/layout.js` é a autoridade da largura. Não
duplicar expansão com `100vw`/margens negativas no CMS.

Snippets genéricos usam wrapper `data-spmiddle-host` separado da raiz site/admin,
com `data-spmiddle-layout="FullBleed"`. O publicador pode escolher `Contained`.
Bootstrap externo clássico funciona sem module inline. Bridge espera CSS exato
da release, importa o módulo oficial e monta o CMS filho. Assets oficiais são
copiados com bytes/hash inventariados no pacote; algoritmo upstream não editado.

FullBleed expande até a caixa cliente útil do host, limitada à viewport. Não é
fullscreen, não esconde navegação/cabeçalho e **não remove max-width/padding
interno de Cassiopeia/Atum**. Não trocar parâmetros persistidos para forçar isso.
Hosts sem wrapper conservam montagem legada. Deploy antigo entrega o bridge
mas permanece contido: não muda canvas/snippet operacional automaticamente.

## Teste no site → Análise → correção → reteste

Revisão independente encontrou: auto-bootstrap oficial media antes da espera
de CSS; primeiro marcador global podia escolher folha de outra release;
readiness sem deadline. Corrigido import direto do `layout.js` oficial **após
CSS**, sem auto-bootstrap concorrente, URL exata dentre folhas habilitadas e
prontidão limitada. Descarte idempotente e cleanup de falha no `onInstalled`.

O pacote conserva o entrypoint clássico upstream por inventário/proveniência,
mas o snippet MINIJOOMLA não o executa em paralelo. Ele auto-inicializa wrappers
sem gate CSS; não usar dois controladores para a mesma instância. O loader do
CMS importa host.js, e só o bridge dispara a função oficial depois do CSS.

Prova FIORI-AUTO na página SharePoint autorizada: **seis arquivos + manifesto**,
hashes conferidos, dois wrappers temporários com shells publicados Cassiopeia/
Atum. Nenhum router/repository/data load da prova. Contained → FullBleed →
Contained por Enter; resize da mesma instância em 768/1366/1920 e descarte.
Margens acompanharam a caixa cliente útil; root original permaneceu intacto.
Elementos/CSS próprios removidos, navegador próprio encerrado. **48 registros/
ETags, duas páginas e hash do host iguais antes/depois**, zero writes de listas/
páginas. Assets de prova são a única escrita remota.

Esse ensaio temporário na página **não é ativação persistida na webpart MSE**,
substituição das páginas aceitas ou aceite integral de UI/editor/zoom/acessibilidade.
Limitações internas dos templates continuam escolhas separadas do publicador.

## Validação e documentação

Focais: bridge core/local cobre CSS/API, legado, wrapper separado, URL exata,
timeout/dispose; pacote confere três assets oficiais byte-exact. Host staged real
executa admin/site em web raiz com wrapper/algoritmo oficial, sem writes ou
reinstalação e cleanup por pagehide. Fixture VM precisou de timers e múltiplos
listeners pagehide; corrigida sem remover assertions de descarte/preservação.

**Validação final:** regressão completa **121 suítes aprovadas, zero skips/falhas**;
parse-only **356 JS/MJS**; contributor **453 caminhos exatos**, hashes/inventário
e gates mantidos. Reauditoria confirmou os três bloqueios corrigidos e executou
a suíte focal do bridge novamente; sem novo P1/P2 no recorte. Links conferidos.

Commit/push e publicação deste incremento autorizados posteriormente pelo
usuário, somente nesta branch e páginas MINIJOOMLA já definidas. Mensagem do
checkpoint: `feat: integrate publisher-controlled MSE FullBleed with guarded bootstrap`.
Publicação exige nova release imutável, configuração/ETags preservados e rollback;
não provisionar/reinstalar nem publicar conteúdo em rascunho por inferência.
Demais deltas da principal e XML continuam na fila com ciclo próprio.

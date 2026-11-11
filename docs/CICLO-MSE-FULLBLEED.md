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

## FullBleed real publicado via scripts/deploy-sharepoint.mjs (11/11/2026)

`scripts/deploy-sharepoint.mjs` não copiava `host/spmiddle-layout/` (só
`scripts/stage-generic-installation.js`, para o pacote offline copiável,
fazia isso) — qualquer publicação real com este script ficava presa ao
snippet legado sem wrapper, mesmo que o usuário solicitasse FullBleed. Dois
ajustes mínimos:

1. `buildStage()` agora também copia `layout.js`/`layout.css`/
   `spmiddle-mse-host.js` do SPMIDDLE (`../SPMIDDLE/host-adapters/modern-script-editor/`)
   para `host/spmiddle-layout/` na release, byte-for-byte — mesmos três
   arquivos que o empacotador genérico já inventariava, sem duplicar o
   algoritmo de layout em nenhum lugar novo.
2. Nova flag `--mse-layout FullBleed|Contained` (opcional; omitida preserva
   o snippet legado sem wrapper, sem mudança de comportamento para quem não
   pedir). Quando usada, `publishPages()` grava o script publicado com
   `<link data-minijoomla-mse-layout>` + `<div data-spmiddle-host data-spmiddle-instance="..." data-spmiddle-layout="...">`
   envolvendo a raiz do CMS, igual aos snippets de referência
   (`host-adapters/modern-script-editor/*-installation-snippet.html`).

Publicado e validado contra o mesmo site de teste real
(`Comunidades-de-interesse-192`): release imutável nova `0.17.1` (263
arquivos, incluindo os três do SPMIDDLE), ambas as páginas (`Default.aspx`/
`Administrator.aspx`) republicadas com `--mse-layout FullBleed`. Confirmado
via inspeção programática real: `host.className === 'spmiddle-mse-host--full-bleed'`,
`data-spmiddle-layout="FullBleed"`, margens calculadas dinamicamente
(`--spmiddle-host-margin-left/-right`) em ambas as páginas; screenshot real
confirma o site ocupando a largura útil do host em vez da coluna estreita
anterior. As oito listas MiniJoomla* permaneceram com exatamente as mesmas
contagens de antes (11/4/4/8/7/1/4/1) — nenhum dado foi tocado por essa
publicação de layout.

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

**Publicação posterior executada:** `20feabc` enviado; release operacional
0.16.0 com CONFIG completo preservado ativa nas duas páginas. Preflight corrente
mostrou ambas publicadas, sem checkout; estado conservado. 48 dados/ETags
preservados, geometria real/navigation readonly conferidas. ETags de páginas
mudaram pela atualização autorizada. [Relatório e limites](PUBLICACAO-FULLBLEED-0.16.0.md).

# Publicação operacional — 0.16.0 FullBleed

## Commit e autorização

Integração FullBleed commitada e enviada em `20feabc`
(`feat: integrate publisher-controlled MSE FullBleed with guarded bootstrap`),
branch step2. Publicação solicitada explicitamente pelo usuário. Este ciclo
atualiza assets e os snippets das duas páginas MINIJOOMLA autorizadas; não
provisiona listas, reinstala Sample Data, instala extensões ou muda settings.

## Prévia → análise → ativação → validação

Snapshot fresco comprovou 48 registros/ETags, oito mapas de listas e oito
raízes aprovadas. Configuração operacional inteira do host 0.15.0 foi preservada,
incluindo revisões CSS, Sample Data e chaves adicionais. Host pré-configurado
não entra no instalador inicial nem grava seus arquivos de configuração.

As duas páginas estavam **publicadas/sem checkout**, diferentemente do checkpoint
histórico de rascunho público. Foi preservado o estado corrente após releituras
de identidade/canvas/ETags e estado dos arquivos. Esse estado novo não foi
fabricado por restauração de um snapshot anterior. A MSE pública já continha
FullBleed, administração ainda sem wrapper; apenas o snippet identificado foi
substituído, sem alterar demais propriedades/controles.

Release nova imutável **0.16.0**, 264 payloads + manifesto (265 arquivos enviados).
Readback integral de payloads conferiu bytes/SHA-256/MIME. Nenhuma release anterior
sobrescrita. Target all operacional inclui os incrementos anteriores de núcleo,
templates e destaque; não descrever a atualização como somente três assets CSS.

Antes da ativação, host CONFIG-injetado montou em duas prévias isoladas, contra
as listas reais, sem data writes. O deploy antigo não foi executado: ele possui
provisioning/merge de Choice/publicação automática incompatíveis com este gate.
Foi usado envio exclusivo de assets e plano privado de patch da MSE, com cópia
de canvas/settings e ETags para eventual rollback antes de qualquer gravação.

Primeiro MERGE público concluiu, mas readback byte-exact falhou pela reserialização
de canvas do SharePoint. A execução parou. Releitura/comparação estrutural confirmou
snippet planejado na pública e admin ainda intacto; continuada somente a etapa
faltante com novos ETags, sem repetir MERGE concluído. Publicação retomou o estado
publicado anterior de cada página após checagens imediatamente antes do Publish.
Publicação de arquivo não é transação atômica com o item/ETag; conflitos teriam
interrompido sem rollback automático de edições concorrentes.

## Resultado no site real

- As duas páginas referenciam a release 0.16.0, com um root/loader por página.
- FullBleed opera no wrapper oficial, sem dois auto-bootstrap concorrentes.
- Site Cassiopeia/admin Atum montam sem alertas em 768/1366/1920; resize mantém
  bordas na caixa cliente útil do SharePoint. Navegação/cabeçalho do host não são
  ocultados; limites internos dos templates continuam preservados.
- Navegação readonly em Artigos, Configuração, Estilos e Plugins passou.
- Em 320, documento sem overflow horizontal e menu administrativo abriu por Enter.
- **48 registros de dados e seus ETags exatamente preservados**. ETags/versões das
  páginas mudaram deliberadamente pela atualização; não afirmar que são iguais.
- Ambas páginas publicadas/sem checkout no final, como observado no preflight.
- Nenhum save/upload editorial, provisioning, extensão/raiz nova, Sample Data ou
  rollback de conteúdo executado. Acessibilidade integral/zoom/editor permanecem
  gates separados. Navegador próprio usado por FIORI-AUTO.

## Desenvolvimento seguinte

Novo `scripts/stage-operational-upgrade.js` reproduz o empacotamento offline com
CONFIG exportado privadamente, sem inventar roots/pins nem acionar publicação.
Chaves JSON desconhecidas são preservadas; input data-only limitado, campos
de contexto/IDs validados; inventário host recalculado depois de injetar CONFIG.
Teste SPMIDDLE integrado de staging verifica CONFIG/pins/dados futuros e hashes,
sem writes externos. Esse tooling posterior não altera a release 0.16.0 publicada.

### Análise, correções e reteste do empacotador

A revisão identificou leitura através de ancestor junction e mudança de semântica
de `__proto__` ao inserir JSON como objeto literal JavaScript. Corrigidas antes de
fechar o tooling: `lstat` em todos os ancestors/`realpath`, arquivo regular/handle,
leitura limitada a 256 KiB e UTF-8 estrito; CONFIG agora inicia por `JSON.parse`
de string escapada. A contenção cobre links/junctions estáticos, **não promete
resistência a corrida de atacante sobre a árvore local**.

Os testes executam só a expressão de configuração, nunca o host de navegador,
verificando propriedade própria `__proto__`, strings com markup/Unicode/`$&`,
sem hooks, chaves futuras inclusive no mapa de listas, `discover:false`, revisões,
ordem/duplicatas CSS, limites, junction e duas saídas determinísticas. Normalização
é usada para validar, não para reescrever o objeto exportado.

Pacote real gerado com a configuração operacional foi enviado exclusivamente a
uma **nova pasta de prova**, 264 payloads + manifesto. Readback integral de hashes/
bytes/MIME passou. Site/admin montaram em duas prévias isoladas dentro do site real,
com dados existentes; iframes removidos. Snapshot completo antes/depois comprovou
os **48 registros/ETags, ambas páginas e hash do host ativo intactos**. Não houve
nova ativação MSE, provisionamento ou instalação. Sessão FIORI-AUTO própria encerrada.

Na conferência de evidências, o helper histórico ainda verificava o host 0.15.0.
Corrigida a referência para o ativo **0.16.0** e repetidas as duas prévias e os
snapshots antes/depois; preservação integral novamente aprovada. Recibos antigos
conservados sem promovê-los a prova do novo host.

Reauditoria: nenhum P1/P2 concreto no recorte. Validação integrada com Node
`v24.18.0`: **122 suítes / 0 skips / 0 falhas**, syntax **358 JS/MJS** (parse-only),
contributor **456 caminhos** com hashes/determinismo/contenção. Não é aceite de
editor/save/upload, zoom integral, XML de plugins/templates ou primeira instalação
em destino vazio. Próximo trabalho segue a fila canônica, sem desenvolver TD ou
alterar main concorrente.

Rollback autorizado futuro usa a configuração/canvas preservados em recibos
privados e ETags **relidos**, nunca restore massivo enquanto outro editor trabalha.
Release 0.15.0 e assets aprovados continuam disponíveis. Não ampliar gates para
distribuição pública ou presumir merge/retirada de worktrees por esta publicação.

# Documentation — ciclo isolado de desenvolvimento e teste no site

Base `40f151a`, branch `feat/joomla-finalization-step2`, início 09/11/2026.
Referência relida: 48 registros, Cassiopeia/três estilos, host 0.15.0 e oito raízes.
Sem instalar Documentation, configurar novas raízes ou modificar listas/páginas.

## Desenvolvimento → teste da origem → análise

Módulo de apresentação com views `categories`/`category`. Categorias, artigos,
tags e paginação são fornecidos por settings; sem Phoca/Joomla PHP, consultas
automáticas ou datasource novo. Preservar os 24 campos/defaults/limites originais
e os parâmetros salvos desconhecidos, inclusive itens desabilitados/inválidos.

Teste temporário real no site, fonte/CSS originais, seis níveis de categorias e
texto sem espaços, 180/320/768/900 px: categorias scroll 3166 px e título 2516 px;
view de categoria scroll 2536 px. Grid mínimo 16rem, texto não quebrável e recuos
aninhados requerem reflow por contêiner, sem cortar conteúdo para esconder erro.

Contraprova local de CSS no site passou ambas views nas quatro larguras: root
scroll igual à largura, nenhum Range excedente no conjunto observado. Isso
orienta o patch, não é aprovação dos bytes finais ou acessibilidade integral.
Em espaço estreito, subcartões perdem padding/bordas internas acumuladas e
listas aninhadas perdem recuo, conservando os textos e hierarquia de dados.

## Retorno ao desenvolvimento

Três fontes fixados: helper de URL, renderer de dados próprios/inertes e CSS.
URLs inseguras produzem conteúdo não-link ou omissão de controle de paginação;
mídia insegura omitida sem src vazio/#/data/blob. Preservar alt decorativo vazio.
Arrays/números/flags não devem invocar getters ou coerção; normalização derivada
nunca regrava JSON. Tree com IDs duplicados deve falhar conservadoramente; ciclos
precisam ser excluídos também na seleção ativa, não apenas escondidos das raízes.
Manter ramo válido independente e comportamento declarado para pais ausentes.

Gerador local pinado/XML canônico com 24 parâmetros e notices completos. Origem
Phoca/Joomla/adaptações exige review escopado: MIT da raiz não é clearance global
do vendor ou de todo componente PHP. Fontes externas e pacotes anteriores intactos.
Carregar provas finais somente após auditoria; testar público/admin, navegação,
paginação, profundidade/dados inválidos, teclado, formulário em memória e cleanup.
Evidências privadas ignoradas em `tmp/documentation-cycle/` e
`tmp/documentation-adapt-agent-*`; não concluir adoção/distribuição global.

## Profundidade → contraprova → nova correção

O primeiro reflow aprovado em seis níveis não bastou para o limite de vinte.
Ensaio de vinte níveis revelou links de subcategorias com largura zero na view
category a 180/320/768 px. Recuo de listas e padding acumulado foram limitados
somente nos descendentes do módulo; reteste passou ambas views nas quatro larguras.

Ainda assim, três raízes simultâneas com vinte níveis cada (60 categorias)
reprovaram cards aninhados em 768/900 px: os cartões internos eram estreitos mesmo
com o contêiner externo largo. Limitar a query apenas pela raiz não alcançava
esse caso. Nova regra scoped remove padding/bordas acumuladas dos subcartões
em qualquer largura, mantendo linha lateral fina e todos os textos. Contraprova
pública final passou ambas views × 180/320/768/900, sem Range excedente e com
os 60 cards. Isso continua diagnóstico, não aceite de pacote final.

Revisão preliminar também encontrou divergência entre CSS produzido e pin do
finalizer durante edição. Deve ser corrigida e a versão declarada estável antes
de preparar os pacotes imutáveis; não substituir hash recebido do caller nem
enfraquecer o confronto exato para aceitar o staging.

## Proveniência upstream — gate concreto separado

Os três arquivos locais e o MIT do agregador corresponderam ao commit histórico
de referência, mas isso não comprova titularidade do derivado Phoca/Joomla.
As referências locais originais têm copyright Open Source Matters e licença
GPL-2.0-or-later nas views PHP; o CSS identifica Open Source Matters e Jan Pavelka,
com GNU/GPL e referência a LICENSE.php. Não inferir MIT para o upstream apenas
porque a cópia agregadora tem MIT.

Antes de carregar o pacote Documentation, mapear a atribuição/licença aplicável
ao JS/CSS derivado e preservar os notices e materiais de fonte correspondentes.
O fechamento anterior de 13 arquivos/avisos escopados não é prova de cumprimento
dessas obrigações novas. Clearance global de distribuição continua fora deste
ensaio; esse gate específico não deve ser ocultado nas flags globais false.
Enquanto não resolvido, pacotes de Documentation devem permanecer locais.

## Consulta sobre worktrees — sem exclusão

O usuário perguntou sobre as duas worktrees. `MINIJOOMLA-worktree02` é ativa neste
ciclo, com arquivos novos ainda em desenvolvimento. `MINIJOOMLA-worktree01` está
limpa/push sincronizado, mas seus arquivos privados em tmp ainda são usados por
testes operacionais; preservar esses materiais e remover as dependências antes
de considerar exclusão. A principal conserva trabalho antigo não commitado.
Nenhuma worktree, arquivo alheio ou recibo foi removido por essa consulta.

## Preparação local estabilizada — publicação bloqueada

26 testes portáveis e 27 com build/audit passaram. CSS final corresponde
byte-a-byte à contraprova aprovada e ao pin independente: 7298 bytes,
`062b19ac80d014ba2bc2d95313333d227a1af8f21f07d5c60afa5ec39cbff22e`.
Renderer: 22948 bytes, `a79ee923b8152e1a3563e7baaee98d70356e8d76611c38877e62b7e48cbdf7b9`.
XML canônico com 24 campos, 53 negativos de Map, guardas de Buffer/descritores,
duplicatas/ciclos e 60 cards válidos passaram. A diferença transitória de pins
durante edição foi corrigida; não se relaxou a validação do finalizer.

| Versão privada neutra | SHA-256 do inventário |
| --- | --- |
| 0.3.0 | `085162880e95a7b378c186e8f40c2cec0a01aba70dab9e25721a29cf8db7ba5f` |
| 0.3.1 | `2835ba4e36bfee25503201b67d9cba02feb01f775da5753c004c423bb15bcad3` |

Fechamento local: cinco runtime, 11 payloads/13 arquivos; 56 fontes de snapshot
e 175 dependências. Avisos MIT agregador/GPL autoral completos e flags false;
`upstreamRightsReviewRequired:true` explícito. Auditoria técnica não remove
o gate de atribuição/fonte GPL do material derivado Phoca/Joomla.

Integração local ao runner/contributor declara todas as dependências necessárias,
sem omitir falhas ou copiar pacotes privados. **Nenhum pacote Documentation
enviado ao site, nenhum módulo instalado e nenhuma raiz configurada.** A revisão
upstream interrompida foi retomada somente leitura; não se declara sua conclusão
sem resultado. Formulário/navegação/teclado e JS/CSS finais ainda não passaram pelo
aceite do site; as contraprovas CSS são anteriores e separadas.

Não publicar o novo código/fixtures ou pacotes como material liberado antes de
mapear notices/copyright/licença/fonte correspondente desse derivado. Conservar
o trabalho local pendente, completar o gate upstream e então retomar Teste no
site → Análise → Validação → Documentação antes de iniciar Videoteca.

## Revisão final independente e lacunas de retomada

Revisão final somente leitura confirmou 26/26 portáveis, as duas auditorias
aguardadas e reconstrução exata dos 26 arquivos locais. Confrontou todos os 56
registros de snapshot e as 175 dependências. Divergência inicial de pins resolvida.
Isso encerra o gate técnico **local**, não o ciclo completo de aceite no site.

Lacunas específicas antes de envio/distribuição:

1. Mapear trechos/arquivos de origem ao JS/CSS selecionado e materializar as
   atribuições aplicáveis. Referências identificam Open Source Matters (2006,
   2009 e 2010 nos layouts) e Open Source Matters/Jan Pavelka no CSS; os notices
   atuais não incorporam essas atribuições específicas do upstream.
2. Os layouts declaram GPL versão 2 ou posterior; o CSS declara GNU/GPL com
   referência a LICENSE.php sem versão expressa. Vincular o CSS à origem/texto
   aplicável; a cópia local não contém os LICENSE.php/LICENSE.txt citados.
3. Vincular a licença ao material efetivamente derivado, não só às mudanças
   novas. GPL completo já preservado não amplia automaticamente o escopo
   `authored adaptation changes only` nem autoriza classificar upstream como MIT.
4. Fechar o mapa hash-pinned das fontes/preferred form/transformação da adaptação.
   Snapshot atual não contém referências PHP/phoca; selecionar somente as
   necessárias, sem copiar diretório inteiro, SVG não utilizado ou arquivo swap.

Novo notice/fonte exige revisão explícita do fechamento e dos hashes; manter
os pacotes locais atuais imutáveis. Nenhum upload, registro, enable ou expansão
de raízes foi realizado. A revisão interrompida foi retomada e concluída; o
resultado continuou bloqueado no gate upstream, não por indisponibilidade técnica.

## Regressão e último estado observado — não aceite do site

Regressão integrada local: **93 suítes aprovadas, zero skips/falhas**, incluindo
Documentation e contributor; checker 274 JS. Child standalone: 81 locais/11
skips esperados. Nenhuma alteração no núcleo, grafo externo ou listas por este
ciclo. A seleção runner/contributor foi declarada explicitamente, sem ocultar
falhas. Esses resultados não resolvem atribuição/licença/fonte upstream.

As primeiras releituras de preservação e host passaram: 48 registros/ETags e
oito raízes íntegros. A releitura mais recente, porém, capturou **uma edição de
artigo** (title/alias/introtext e metadados/ETag) e a página pública em **rascunho
sem checkout**; administrador publicado. São **47/48 registros exatos** nesse
snapshot final, não preservação integral até o término. A página ainda referencia
0.15.0, e o canvas lido antes permanecia inalterado. Não atribuir autoria/aceite
ou reclassificar automaticamente essa edição como baseline novo.

Preservar o possível trabalho do usuário: nenhum rollback de artigo, publicação
da página ou nova captura para apagar a diferença foi realizado. Além do gate
upstream, retomar aceite final exige referência reconciliada caso essas mudanças
persistam. Recibos privados mantêm cronologia de leituras aprovadas e diagnóstico
final, sem transformar `success` de consulta em aprovação de preservação.
Nesse checkpoint, nenhum commit/push do novo código/fixtures derivado havia
sido realizado; o trabalho estava local, sem vinculação final de atribuições/
licença correspondente. O escopo seguro do commit/push posterior está abaixo.

## Checkpoint Git autorizado — não liberação operacional

Após receber o estado e os bloqueios, o usuário solicitou explicitamente
**commit/push**. A conferência final identificou cópias comprimidas integrais do
JS/CSS original nos fixtures; o envio desses arquivos também é publicação do
material cujo gate upstream continua aberto. A autorização geral de Git não
resolve atribuições, licença ou fontes correspondentes de terceiros.

Registrar somente os cinco documentos desta etapa em
`feat/joomla-finalization-step2`: `README.md`, esta continuidade do ciclo,
`ADAPTACAO-DOCUMENTATION-SEGURA.md`, `MATRIZ-ADOPTION-MODULOS.md` e
`PLANO-CONTINUIDADE-MINIJOOMLA.md`. Preservar localmente, fora deste commit,
`scripts/prepare-documentation-adaptation.js`,
`tests/documentation-adaptation.test.js` e as integrações em
`scripts/stage-contributor.js`, `tests/run-tests.js` e `tests/runner.test.js`.
Os comandos e exports documentados da adaptação dependem desses arquivos locais;
o checkout remoto deste checkpoint não contém a implementação Documentation.

Não levar pacotes, recibos, snapshots, ETags ou arquivos de `tmp/` ao remoto.
Nenhuma alteração alheia da principal ou da worktree01 entra neste commit.
Regressão pré-commit com os arquivos locais preservados: `npm test` terminou com
93 suítes aprovadas, zero skips/falhas; `npm run check` verificou 274 JS. Esses
resultados não devem ser atribuídos a um checkout remoto somente documental.

Esse envio é um checkpoint documental com pendências declaradas,
não uma release pronta, autorização de instalação ou conclusão da revisão
Phoca/Joomla. Atribuições/licença/fonte upstream e aceite de pacote final no site
continuam bloqueados. Não alterar as flags falsas para aparentar aprovação.
Manter a edição de artigo e o rascunho observados, sem rollback ou publicação
automática. As duas worktrees permanecem disponíveis e não são excluídas.

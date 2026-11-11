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

## Retomada — referência editorial explicitamente reconciliada

Após o checkpoint documental `30362f1`, o usuário solicitou a continuidade do
ciclo Desenvolvimento → Teste no site → Análise → Validação → Documentação.
A nova leitura encontrou seis artigos editados, 48 registros presentes e a
página pública ainda em rascunho sem checkout; administrador publicado. Ambas
as páginas continuam referenciando 0.15.0. O usuário confirmou **“Sim, preservar
como referência”**: o estado editorial atual passa a ser a referência explícita
para comparação antes/depois, sem restaurar artigos ou publicar a página.

A leitura inicial do novo recibo revelou um problema de serialização local:
o retorno da avaliação repetia os mesmos objetos em `lists.items` e
`changed.after`; o serializador do FioriAgent omitiu referências repetidas na
primeira posição. Os seis objetos completos e ETags estavam preservados em
`changed.after`. O recibo corrigido foi criado em arquivo novo, sem escrita
remota, e a construção do diagnóstico passou a clonar as referências repetidas.
Releitura confirmou 48/48 linhas exatas contra a referência autorizada, contagens,
canvas e estados das duas páginas. O host manteve oito raízes aprovadas.
Isso não apaga as diferenças históricas nem atribui autoria às alterações.

Provas e recibos desta retomada ficam privados em
`tmp/documentation-resume-cycle/`; os anteriores são preservados. A etapa atual
fecha o vínculo de licença upstream e prepara um novo perfil de pacote com
notices/fontes explícitos, sem sobrescrever os pacotes privados 0.3.x.

### Análise upstream da retomada — vínculo identificado, pacote ainda pendente

A revisão somente leitura identificou as referências locais byte a byte no
asset oficial Phoca Documentation 6.0.0. O mesmo snapshot de arquivos está no
commit upstream `f2386b6b935c82f0fa0d94881c144ef1d91af0f9`, cujo `LICENSE` declara
**GNU General Public License version 2 or later**. Esse vínculo fornece a versão
GPL que o header isolado do CSS não explicitava. Os notices de OSM/Jan Pavelka
continuam obrigatórios; não se deduz MIT do derivado a partir do agregador.

Atenção: a tag Git `6.0.0` observada não aponta à árvore que reproduz o ZIP de
release. Fontes correspondentes devem usar o commit/bytes efetivamente
confrontados, não um source archive presumidamente equivalente por ter a mesma
versão. O ZIP oficial também não contém os LICENSE.php/LICENSE.txt citados nos
headers; a ligação deve ser materializada com a declaração daquele snapshot e
o texto GPL completo. Não copiar o arquivo swap encontrado na referência.

O desenvolvimento prepara um perfil **0.4.0/0.4.1** separado, com mapa de
derivação, notices e fontes/rebuild offline inventariados. Identificar licença
upstream não equivale a aprovar automaticamente conformidade do pacote final,
cadeia autoral dos ícones ou distribuição global. Ainda não houve upload dos
novos pacotes nesta retomada. Regressão do estado local anterior: 93/93 suítes;
o teste do novo perfil é uma etapa distinta.

### Desenvolvimento do fechamento com fontes — candidato 0.4.x

Novo packager `scripts/prepare-documentation-source-package.js` e teste
`tests/documentation-source-package.test.js` produzidos localmente, com mapa
de escopos de licença, 11 referências upstream selecionadas, notices específicos,
cinco cópias de runtime em preferred source e launcher offline com fechamento
estático exato. Os dois candidatos neutros têm 54 arquivos/52 payloads. O builder
não chama os builders amplos legados nem copia originais de outros módulos ou
dependências npm; os scripts de suporte transitivos são declarados e pinados.
Os 24 campos/defaults/constraints e algoritmos do overlay histórico permanecem;
somente comentários de notices e versão XML mudam no runtime.

Integração explícita ao runner/contributor/checkout isolado adicionada localmente.
Teste portável do novo perfil: quatro grupos aprovados. A revisão independente
do pacote e de seu mapa concreto de derivação está em andamento; os checks
autodeclarados do candidato não são seu resultado. Candidatos para as bases de
prova do site também foram criados em destinos novos, diferindo dos neutros apenas
em ADAPTATION/adoption-plan/inventário/host-config por causa da base explícita.
Uma busca limitada de padrões sensíveis não encontrou ocorrências; não é um
aceite global de privacidade. **Nenhum candidato 0.4.x enviado ao site ainda.**

Detalhes locais: [proveniência e fontes](PROVENIENCIA-DOCUMENTATION.md).

Regressão integrada após essa integração: **94 suítes aprovadas, zero skips ou
falhas**, incluindo o novo perfil portável e o checkout isolado do runner.
Reconsulta direta do LICENSE upstream foi tentada; Node recusou a cadeia TLS
(`SELF_SIGNED_CERT_IN_CHAIN`) e a ferramenta web também falhou no transporte.
Nenhum bypass de certificado, proxy ou controle corporativo foi usado. Essa
tentativa não se soma como nova evidência HTTP; mantém-se a declaração/hash da
revisão upstream prévia e o gate de revisão independente do pacote.

### Análise independente → retorno ao desenvolvimento

A revisão independente confirmou o fechamento 0.4.x, o XML completo contra
exports reais do runtime, as cinco cópias preferred, reconstrução exata de todos
os 54 arquivos e recusa de 54 adulterações por versão, mesmo com inventários
recalculados. Não identificou blocker de integridade ou rebuild offline.

Entretanto, `LICENSE-LINKAGE.json` só lista referências e escopos; não relaciona
cada trecho PHP/XML/CSS às funções/campos/seletores do port e suas divergências.
Isso **bloqueia o gate composto SOURCE/NOTICE**, apesar de subchecks estreitos
como vínculo de licença e materialização de fontes terem passado. O LICENSE
histórico copiado também aponta a caminhos relativos não resolvidos dentro da
subárvore fonte; o texto original deve permanecer intacto, com resolução
documental adequada em novo pacote.

Retorno ao desenvolvimento em **0.5.0/0.5.1**, com mapa canônico inventariado,
checagem de cobertura/linhas/hashes e diferenças explícitas: defaults e JSON
são locais, cartões recursivos não traduzem literalmente as listas PHP,
paginação é pré-computada e não implementa ACL/publicação/eventos Joomla.
Wrapper, XML, suporte de build e ícones precisam de escopos explícitos no mapa.
As 0.4.x permanecem locais e imutáveis, **sem upload**, juntamente com 0.3.x.
O teste no site continua pendente até auditar o novo fechamento.

Reconsulta adicional do LICENSE pelo `Invoke-WebRequest` com a confiança TLS
padrão do Windows passou: HTTP 200, 83 bytes, SHA-256
`b8b2c2a80dbc38eb6b7c27ea374a5c0ead24449524671a65722f4ef4ade5c670`.
Nenhuma validação de certificado foi desabilitada. Essa leitura confirma o
literal materializado; as falhas anteriores de Node/web permanecem registradas
e não são tratadas como leituras aprovadas.

### Nova correção materializada — 0.5.x local

O novo perfil inclui `docs/DERIVATION-MAP.json` canônico, inventariado e
reconstruído: 24 campos, 23 funções, 67 ocorrências de seletores e 13 executáveis
de suporte/launcher com caminhos, ranges, anchors e hashes. Distingue referências
upstream, defaults/interface próprios, adaptações de segurança/reflow e comparação
de ícones. A licença histórica do projeto permanece byte-exata; seus links
relativos são resolvidos por duplicata GPL e ponte third-party escopada.

Os finais neutros 0.5.0/0.5.1 têm 57 arquivos/55 payloads. Testes locais do perfil
reportaram quatro grupos portáveis e 16 com build explícito; rebuild de todos
os 57 arquivos passou nas duas versões. A conferência do coordenador dos
candidatos com base de site passou e recusou individualmente 57 adulterações
por versão. JS/CSS/helper são iguais a 0.4.x, inclusive seus comentários; XML
muda somente versão. Pacotes de 0.3.x/0.4.x permanecem intactos e locais.

Os candidatos de site ainda aguardam reauditoria independente do gate composto.
Receber metadados `checks:passed` não substitui essa reauditoria. Não houve upload,
instalação, mudança de raiz ou escrita de registros nesta preparação.

### Reauditoria independente → gate técnico específico aprovado

Reauditoria 0.5.x confirmou 561 referências por mapa, 24 campos, 23 funções,
67 ocorrências CSS e 13 executáveis; 114 adulterações individuais e 20 alterações
semânticas do mapa, com rehash, recusadas. Rebuild independente de cada final:
57/57 arquivos idênticos. A lacuna de derivação 0.4.x foi resolvida; gate técnico
individual SOURCE/NOTICE passou, sem opinião jurídica ou clearance global.

Ressalva textual não bloqueante: o fragmento `canonicalXML` afirma erroneamente
uma diferença de ordem entre XML e schema JS perto de `showNoArticles`. A ordem
é igual e o confronto completo passou. A frase não muda schema, runtime ou
integridade; fica registrada para correção em eventual versão nova, nunca por
edição dos pacotes imutáveis. Os candidatos com base do site foram conferidos
separadamente pelo finalizer trusted; JS/CSS e mapa são iguais aos finais neutros.
O envio seguinte é exclusivamente para pastas de prova isolada, sem adoção,
novas raízes persistidas ou publicação de páginas.

### Regressão estabilizada antes do aceite no site

A execução integrada durante atualização de documentação terminou em 93 suítes
aprovadas e uma falha de contributor staging: `PROVENIENCIA-DOCUMENTATION.md`
foi atualizado pelo coordenador entre duas capturas que o teste exige idênticas.
Não era evidência de pacote runtime divergente nem motivo para recalcular a
aprovação de arquivos arbitrários. O arquivo foi mantido estável, a suíte
específica foi repetida e passou; nova regressão integrada terminou em **94
suítes aprovadas, zero skips/falhas**. Nenhuma assertiva ou verificação de hashes
foi relaxada. Durante regressões que capturam a seleção completa, não editar
arquivos selecionados em paralelo.

Checker: 275 arquivos JS aprovados. O ensaio final no site está separado dessas
validações locais; permanece pendente até receber e analisar seus recibos.

### Teste dos pacotes finais no site — resultados parciais

0.5.0 e 0.5.1 carregadas em pastas novas de prova: **57 arquivos por versão,
114 no total**, sem overwrite. Download/readback de todos os bytes passou.
Inventários dessas bases de prova, distintos das bases neutras:

| Versão de prova | SHA-256 do inventário |
| --- | --- |
| 0.5.0 | `22e359367f225050f84c5e33f9852fc1e224356dbe20884f2faa0553ac5b4aef` |
| 0.5.1 | `0919e7d66cdae9ed0b8b4e68d315f3037ac87fd7767d8a076186038113c7e668` |

Preflight testou duas raízes **somente em memória**, respeitando o orçamento
8+2=10, sem alterar o host. Discovery recusou CSS, fonte/closure e notice
adulterados, leituras incompletas e identidade duplicada; nenhuma escrita.

As duas versões passaram no administrador: views categories/category em
180/320/768/900 px, três raízes de vinte níveis/60 cartões válidos, textos
longos, ranges e largura positiva; módulos sem overflow. Viewport
320/700/701/900/1366 também passou. Dados inseguros/cíclicos/duplicados, estados,
flags, imagem existente e paginação pré-computada foram exercitados.
Formulário real, com repositórios isolados em memória: uma gravação, zero writes
remotos, chaves futuras preservadas; ETag obsoleto e limites/tipos inválidos
recusados. Não é gravação editorial ou instalação no tenant.

Estes são resultados parciais: continuidade de teclado, ensaios públicos,
navegação, cleanup e preservação final ainda precisam concluir e ser analisados.

### Teste público → análise da falha → reteste

Ambas as versões passaram também no público, nas duas views e raízes
180/320/768/900; viewport 320/700/701/1366 passou. As sequências de Tab/Shift+Tab
e Enter passaram no admin e no primeiro público. A navegação real pelo link
Documentation abriu um artigo atual do site com Enter nativo.

A sequência completa, porém, **não foi aprovada nessa execução**: no segundo
teclado público, as ações/foco passaram, mas a comparação do DOM original falhou.
O script anterior de navegação restaurava `location.hash` sem aguardar a
recomposição da rota; o próximo teclado capturava seu snapshot imediatamente.
Esse limite do teste é uma hipótese causal sustentada pelo fluxo do runner, não
uma autorização para ignorar alterações de host ou recalcular sua baseline.
O recibo reprovado permanece intacto.

O runner privado foi corrigido para exigir conteúdo público renderizado e
estabilizado antes da captura. Na primeira correção, o retorno exigia hash e DOM
byte-exato restaurados; essa precondição foi reprovada e substituída pelo comparador
delimitado descrito adiante, com intervalo observado sem mutações. A assertiva de
preservação no teclado continua exigindo DOM e rota inalterados; não foi removida.
Reteste das duas versões públicas iniciado, sem repetir upload, modificar
pacotes/renderer, escrever registros ou publicar a página. Depois do reteste,
cleanup e preservação final são novamente obrigatórios.

O primeiro reteste passou o teclado público, mas reprovou a igualdade absoluta
de DOM após a navegação real. Diagnóstico privado comparou HTML de mesmo tamanho
e identificou a primeira diferença no contador de IDs de submenu gerados pelo
runtime (`mj-menu-<sequência>-sub-<n>`). Retornar à rota recompõe o menu com uma
nova sequência; a igualdade byte-exata após navegação é uma precondição incorreta
do teste, diferente da igualdade sem navegação exigida durante o teclado.

O comparador de retorno foi delimitado a esse caso: renumera somente IDs desse
padrão em alvos `data-menu-tree-submenu`, exigindo IDs únicos e exatamente um
controle `data-menu-tree-toggle` associado. Todos os demais textos, atributos,
classes, links e estrutura continuam iguais; hash de rota e estabilização também
são obrigatórios. Seis contraprovas passaram, recusando texto/atributo/ID alheio
alterado, duplicata e ARIA quebrada. Não normalizar dados, ETags, canvas ou conteúdo
para apagar diferenças reais. O teclado sem navegação conserva sua assertiva de
DOM e rota exatos. Novo reteste iniciado com recibos novos, sem sobrescrever as
falhas nem editar pacotes imutáveis.

Outra tentativa encontrou o retorno de rota correto, mas um marcador temporário
`data-fui-focus-visible` no `main-content` focado. Diagnóstico confirmou elemento
ativo MAIN/`main-content`; ao executar blur do foco transitório, o marcador
desapareceu sem remover atributos manualmente. O runner agora observa o foco de
retorno e o encerra antes de comparar DOM em repouso. O comparador não ignora
esse atributo nem outros atributos arbitrários; só a sequência de IDs de menu
continua normalizada, com contraprovas. Retestes reprovados ficam preservados,
e uma nova sequência das duas versões confirma navegação, teclado e cleanup
antes de qualquer conclusão de aceite.

Revisão independente dos scripts de prova pediu limitar melhor o comparador:
o primeiro reserializava via DOMParser e normalizava também o índice `sub-N`.
Novo comparador usa DOMParser **somente para validar associações**, exige
toggle/submenu na mesma árvore e pai, e compara o **HTML raw**, substituindo
somente o contador externo por árvore. O índice de submenu, espaços, conteúdo
fora do body e todos os demais bytes são preservados; colisões e referências
incompletas são recusadas. Contraprovas adicionais cobrem múltiplas árvores,
índice alterado, colisão canônica e material de head/whitespace. Os comparadores
anteriores e seus recibos continuam históricos, não o critério final vigente.

Fechamento final exige releitura do asset/config do host e das oito raízes
aprovadas, além de registros/ETags/canvas/estado de páginas. A revisão não
autoriza inferir esse resultado de constantes no agregado. O desenvolvimento
de Videoteca permanece posterior ao reteste e documentação desse fechamento.

### Reteste passou — conferência final ampliada em andamento

Nova sequência das duas versões passou: 25 checks de teclado por versão,
Enter nativo abriu o artigo atual, hash e conteúdo de retorno foram restabelecidos
com o comparador raw delimitado, IDs/ARIA verificados e foco de `main-content`
observado/encerrado por blur. Teste profundo complementar confirmou 60 cartões
e 19 descendentes de categoria nas quatro larguras. Limpeza registrou zero
raízes/styles temporários; releitura final confirmou 48 linhas/ETags intactos,
canvas preservados, público rascunho e administrador publicado.

Antes de registrar aceite definitivo, uma conferência ampliada executa novas
contraprovas do comparador estrito, profundidade nas duas versões/páginas,
cleanup explícito público/admin e releitura do host/raízes. Não repetir uploads
nem converter esse reteste em adoção ou publicação. Os recibos reprovados
anteriores continuam guardados para cronologia e causa da correção.

Guardas finais do runner privado: snapshot/comparação exige que o contêiner
original permaneça conectado e seja a raiz pública/admin atualmente montada.
A liberação de foco é restrita ao MAIN/`main-content` observado; foco em outro
elemento do host reprova, não é neutralizado. A prova de retorno valida conteúdo
em repouso após blur deliberado, não restauração do foco anterior, listeners ou
todo estado JS. O comparador raw se aplica à string innerHTML capturada pelo
browser com serialização nativa, não a HTML arbitrário. Profundidade pública
aguarda host estabilizado e os recibos identificam versão/página explicitamente.

A releitura de host final comprova configuração no asset da release 0.15.0 e
oito raízes, não hash esperado de todos os bytes de host.js ou da release inteira.
O agregado deve derivar a release/raízes dessa evidência, conservar a cadeia do
consentimento/baseline corrigida e não anunciar igualdade integral de assets
históricos sem confronto específico. Nenhum dessas guardas altera fontes ou
pacotes Documentation publicados para prova.

## Validação e documentação — ciclo isolado 0.5.x concluído

A conferência final e as guardas adicionais passaram. Os recibos consolidados
registram 510 checks de render/layout, 50 casos de layout da matriz principal,
mais 32 casos profundos adicionais nas duas versões/páginas (60 cartões e 19
descendentes preservados). Quatro provas de teclado passaram: Tab/Shift+Tab
contínuos, Enter nativo, links/nonlinks e conteúdo estático sem tab stops
inventados. Duas navegações reais abriram artigo atual e retornaram à rota,
validando identidade do contêiner, HTML raw salvo contador externo dos IDs de
menu, índice de submenu e ARIA. Foco MAIN esperado foi observado e encerrado
por blur; não é promessa de restauração de foco nem acessibilidade integral.

Formulário isolado em memória manteve os 24 campos, uma gravação e zero writes
remotos; ETags obsoletos/tipos/limites inválidos foram recusados e JSON futuro
preservado. Upload/readback: 114 arquivos exatos; discovery negativo e 13
contraprovas do comparador estrito passaram. Pacotes continuam canônicos.

Referência explicitamente autorizada: **48/48 registros/ETags** e canvas
preservados, seis edições editoriais reconhecidas conservadas. Público segue
Level 2/rascunho, administrador Level 1/publicado; ambos sem checkout e usando
0.15.0. A configuração publicada e oito raízes foram relidas; quatro módulos
instalados anteriores permanecem verificados. Não se promete hash integral de
todos os assets da release, porque esse confronto não foi o escopo da leitura.

Limpeza público/admin passou com zero raízes/styles/globais de prova; navegador
FIORI-AUTO próprio encerrado. 92 arquivos originais CAMAP do snapshot permanecem
intactos. Agregado privado vincula 49 recibos e cadeia do consentimento/referência,
preservando todos os recibos reprovados anteriores. Regressão integrada: **94
suítes aprovadas, zero skips/falhas**; checker 275 JS e build explícito 16 grupos.

**Documentation não foi instalado nem ganhou raiz persistida.** O gate técnico
de fonte/notices e o ensaio isolado passaram, não a revisão jurídica/global,
distribuição pública, acessibilidade integral ou equivalência Joomla/PHP/ACL.
Mantém-se a ressalva textual do mapa de ordem XML/schema (ordens reais iguais),
para correção em eventual versão nova sem tocar pacotes imutáveis. Próximo ciclo:
**Videoteca**, desenvolvimento individual, sem adoção em lote ou consumo de raízes.
Nenhum novo commit/push foi realizado por esta retomada.

### Separação posterior dos produtos

O início suspenso de Videoteca/Forum foi transferido para TD; esses módulos
não pertencem à instalação genérica MINIJOOMLA. O antigo “próximo ciclo” desta
cronologia não é fila vigente. Templates CAMAP permanecem somente referência
temporária do template externo CAMAP-V3, com retirada após sua conclusão.

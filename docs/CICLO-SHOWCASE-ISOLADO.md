# Showcase — ciclo isolado de desenvolvimento e teste no site

> **Resultado — 0.5.x em ensaio isolado:** cinco modos retestados no público/admin
> após duas correções de teclado. Tab contínuo, retorno por Shift+Tab, Enter e
> coleções mistas/não-link passaram. Sphere é a lista estática escolhida pelo usuário.
> **Showcase não instalado**; 0.15.0/Cassiopeia, três estilos, oito raízes e todos
> os 48 registros/ETags preservados. Próximo ciclo isolado: Documentation.
> Isso não é aceitação assistiva integral, adoção ou distribuição pública.

Base `bb5fe42`, branch `feat/joomla-finalization-step2`, iniciado em 09/11/2026.
48 registros, oito raízes, 0.15.0/Cassiopeia e três estilos salvos são a referência
reconciliada. Sem instalação, nova raiz aprovada ou mudança de registros/páginas.

## Desenvolvimento → teste da origem → análise

Oito campos originais: title, introText, mode, items, columns,
carouselItemMinWidth, sphereSize, timelineLabel. Cinco modos declarados:
list, carousel, masonry, sphere e timeline. Preservar defaults/limites e JSON
desconhecido; normalização só para renderizar. Nenhum datasource/backend novo.

Ensaio real read-only em root temporário de 180/320/768/900 px, fonte/CSS originais
e quatro itens neutros: título scroll 1890 px, intro scroll 6634 px. Timeline
também extrapola textos; cartões cortam conteúdo por overflow hidden. Masonry
tem spans de altura fixos e fluxo denso, incompatíveis com texto variável longo.
Carousel tem scroll horizontal CSS intencional; confirmar alcance do último item
por teclado, não chamá-lo de carrossel com controles JS inexistentes.

Sphere tem quatro links fora de sua área nas quatro larguras, raio calculado
por pixels fixos apesar da redução visual e rotação contínua sem pausa. O usuário
decidiu explicitamente **lista estática segura**: conservar o parâmetro sphere,
mas apresentar os links em fluxo normal, sem rotação ou simulação de nuvem 3D.
Não inventar novo parâmetro ou alegar fidelidade geométrica ao Joomla/PHP.

## Retorno ao desenvolvimento

Snapshot novo com três patches fixados: helper URL, renderer próprio/inerto
(sem getters/coerção, mídia insegura omitida, conteúdo sem URL continua não-link)
e CSS de reflow/local. Imagens só HTTPS/server-relative válidas, nunca data/blob,
fragmento ou src vazio. Preservar alt vazio decorativo explícito, oito contratos
XML/defaults/constraints. Sphere recebe somente o desvio autorizado; masonry
adaptativo pode mudar alturas para preservar texto, com diferença documentada.

Só carregar pacotes finais imutáveis após auditoria. Testar todos os modos nas
duas páginas, texto/imagem/estados, ranges individuais sem clipping, carousel
por Tab/Enter/scroll, formulário em memória/ETags e cleanup. Corrigir/retestar
antes de validar/documentar. Aceitação assistiva integral e adoção no host pendentes.
Evidências/capturas/URLs/ETags ficam ignoradas em `tmp/showcase-cycle/` e
`tmp/showcase-adapt-agent-*`; nenhuma permissão jurídica global inferida.

## Desenvolvimento da lista estática → contraprova

Modo sphere preservado nos oito campos/XML, mas renderer agora usa lista
ordenada de títulos com links/nonlinks seguros, sem geometria/rotação/3D.
`sphereSize` controla somente largura limitada ao contêiner. Esse desvio foi
escolhido explicitamente pelo usuário, não simulado como implementação 3D.
Masonry passa a fluxo por linha com alturas adaptativas; o parâmetro size continua
salvo/classificado, mas os spans fixos deixaram de recortar conteúdo. Carousel
continua trilha de scroll nativa, com cartões limitados à largura disponível.

Contraprova real temporária com renderer/CSS pinados passou os cinco modos ×
180/320/768/900 px: sem clipping observado; sphere sem links fora da área ou
animação. Horizontal scroll só na trilha carousel é intencional. Não confundir
essa contraprova com os bytes finais carregados ou acesso por teclado já aceito.
23 portáveis/24 com build/audit locais passaram; oito campos/defaults/limites,
arrays inertes, Map/Buffer e três fontes/56 snapshot/175 dependências verificados.
Revisão preliminar coincidiu com atualização dos arquivos; pediu reexecução
estável da auditoria antes do upload, sem promover snapshot anterior a aprovação.

## Teste dos bytes finais 0.3.x → análise de teclado

Pacotes completos do coordenador carregados em dois destinos imutáveis, 26
arquivos relidos por bytes/hash/MIME. Pins dos inventários:
`ba6f9538332b801ac34bf694579d88af1dbbb54b4072df159ba07a6253d7397c` e
`eb37e2ac5a174f29832b9d6e89b3a72a4f2d0c1df7bb24188603d88ed6b89eeb`.
Auditoria independente confirmou schema/notices/closure/23 portáveis. Scanner
em memória e negativos de CSS adulterado/duplicidade/leitura incompleta passaram,
sem nova aprovação de raiz ou gravação nas listas.

Ambas páginas/das duas revisões passaram em list/carousel/masonry/sphere/timeline,
180/320/768/900 px e doze viewports adicionais. Ranges, alturas de textos/imagens,
estado, omissão de mídia/link inseguro e esfera estática passaram. Formulário
real com oito params, select/Enter em memória, unknown JSON e recusas de ETag/
limite numérico passaram (uma escrita memória/zero remotas). Setup herdado tinha
asserção para fields de outro módulo: falhou sem writes; fixture própria corrigida
e repetida com recibo novo, sem alterar o contrato.

**Gate de Tab reprovou carousel:** o segundo link recebeu foco, mas ficou em
left 410/right 688 contra trilha 113–433 em root 320 px. Espera por render e
frames não o trouxe à vista. Enter trusted ativou a URL correta, sem provar
visibilidade; não chamar essa interação de aceite completo. Sphere Tab/Enter
passou. Remoção de snap isolada não corrigiu. Algumas contraprovas não injetavam
CSS extra no nível efetivo de execução da fixture e não contam como prova do CSS.

Contraprova efetiva passou com `track:focus-within` em fluxo vertical, colunas
de uma faixa e sem snap; último link ficou entre 118–428 na trilha 113–433.
Fora de foco mantém a rolagem horizontal. Incorporar desvio de foco declarado
em **0.4.0/0.4.1**, conservar 0.3.x/tools antigos e repetir os bytes finais.
Sem listeners, autoplay ou controles JS inventados. 92 suites locais passaram
antes da correção; esse resultado não aprova automaticamente o próximo CSS.

Baseline relido ao final do primeiro ensaio: 48 registros/ETags íntegros,
oito raízes/0.15.0 e duas páginas publicadas, três estilos/Cassiopeia conservados.
Não houve instalação do Showcase ou reforma dos templates padrões.

## Desenvolvimento da correção de foco

Tooling fechado nas novas versões 0.4.0/0.4.1, sem alterar 0.3.x imutáveis.
A trilha recebe `tabindex="0"` literal para que conteúdo sem links também possa
receber foco; CSS `:focus-within` empilha os cartões em fluxo vertical e retira
snap somente enquanto a trilha/descendentes têm foco. Fora disso continua
horizontal. Vale também para foco por mouse; não declarar exclusividade de teclado.
`carouselItemMinWidth` continua salvo e controla somente a apresentação sem foco.
Sphere permanece lista estática autorizada, sem rotação/3D. Sem listeners ou
controles extras. Schema/defaults, imagens e texto editorial inalterados.

Revisão provisória corrente passou **25 portáveis**, confirmou diferença mínima
de tabindex + regra CSS exata e pediu conclusão documental/auditoria dos novos
bytes. Gate final continua pendente de native Tab entrando na trilha, cada link
visível, all-nonlink, saída/retorno de foco e Enter sobre o pacote final.

Preparação estável nova: **25 portáveis / 26 com build/audit** passaram. Code/CSS
continuam limitados a três fontes, cinco runtime/11 payloads/13 arquivos, 56
fontes de snapshot e 175 arquivos de dependências. Pacotes de ensaio do coordenador:

| Versão | SHA-256 do inventário |
| --- | --- |
| 0.4.0 | `da987f0d37048793ab5cef6c22dc11b8e41b5c278b2481eaa4b5ad75e1831296` |
| 0.4.1 | `1826e0cc3670ac046ac936cecb4471288933212f70ccc5ed8f55282649f6bf39` |

Bases privadas geram pins próprios, diferentes dos builds neutros do agente.
Flags de direitos/publicação/instalação seguem falsas; carga autorizada de prova
e aceitação no site ficam em recibos separados. Não aprovar/distribuir vendor
inteiro por corresponder ao MIT do grafo pequeno examinado.

## Novo teste nativo → refinamento do foco

0.4.x passou nas matrizes visuais e no foco direto do último link, inclusive
coleções não-link. Entretanto, a sequência contínua (uma entrada por seletor,
depois teclas sem reposicionar foco) revelou: sentinel → trilha → controles
do SharePoint, sem visitar os quatro links internos. Não aceitar testes que
reposicionam foco por seletor como prova de sequência inteira.

Contraprova retirando tabindex da trilha que possui links passou: sentinel →
Item 0 → Item 1 → Item 2 → Item 3, todos visíveis em fluxo vertical com foco;
ao sair, a trilha retorna horizontal. Refinar runtime para tabindex=0 apenas
quando todos os cartões não possuem URL válida. Coleções mistas usam os links
como entrada, exibindo também os cartões não-link durante foco. Não adicionar
listeners ou alterar parâmetros salvos. Gerar **0.5.0/0.5.1** em novas pastas,
conservar .3/.4 e repetir sequência contínua/native Enter/Shift+Tab e matriz
dos cinco modos. Aceitação assistiva integral continua separada.

Build final estável: **26 portáveis / 27 com build/audit**, mantendo cinco
runtime/11 payloads/13 arquivos, 56 fontes e 175 dependências. Única diferença
de runtime desde 0.4.x é a condição de tabindex; CSS/helper iguais. Ferramentas
legadas e os 52 arquivos de quatro versões anteriores mantidos intactos.

| Versão do coordenador | SHA-256 do inventário |
| --- | --- |
| 0.5.0 | `2629011c9875a9d650d0d32fdf7d6907f4a2949ab13eababdf331e697493cd69` |
| 0.5.1 | `47665e926cd5f4fa5216f1221e4bc8be6aeef4e7eb803d09a97b1afca38af454` |

O novo pacote não reinterpreta .3/.4 com pins novos; geração/auditoria atual
aceita somente .5. Flags de host/publicação/direitos permanecem false. Testar
estes bytes exatos antes do aceite isolado final, sem nova raiz publicada.

## Teste dos pacotes 0.5.x → análise → validação final

Auditoria independente estabilizada confirmou **26 portáveis**, reconstrução
byte-a-byte dos 26 arquivos finais, XML canônico integral e os oito campos/
defaults/limites. CSS e helper seguem os mesmos bytes de 0.4.x; renderer muda
somente pela condição de tabindex. Novos pacotes carregados com overwrite false,
26 arquivos relidos por hashes/bytes/MIME. As 52 provas antigas de .3/.4 e
ferramentas correspondentes ficaram intactas. Não reutilizar a raiz antiga para
absorver a correção ou mudar seu inventário publicado.

Scanner em memória verificou 0.5.1 e revisão retida 0.5.0; composição de prova
8+2 não gravou host-config. Negativos de CSS adulterado, conflitos de duplicidade
e leitura incompleta passaram, com zero writes/imports de entrypoint. Todas
as raízes Showcase são assets de ensaio, **não aprovações persistidas**.

As duas versões passaram novamente, em público/admin, nos cinco modos ×
**180/320/768/900 px**, com title/introText/description/category/extraInfo longos.
Ranges individuais dos elementos de texto verificados couberam no próprio
retângulo; alturas dos cartões/body/timeline não esconderam conteúdo. Imagens
existentes da amostra foram somente lidas em list/carousel/masonry/timeline,
com alt escapado e sem corte observado. Nenhuma imagem nova incorporada ao pacote.
Sphere mantém somente títulos, como a lista autorizada; não anuncia imagens ou
descriptions extras nesse modo. Mídia perigosa omitida, URL insegura preserva
cartão sem link, getters não executados; loading/empty/error e itens vazios passaram.

Viewports públicos **320/640/641/980/981/1366 px** e administrativos
**320/640/641/900/981/1366 px** passaram nos cinco modos. A matriz adicional
usou **0.5.0** (12 viewports/60 combinações), não as duas versões;
as duas revisões foram cobertas na matriz principal de 80 combinações.
Scroll horizontal da
trilha carousel sem foco continua intencional; o módulo/página não ganham
overflow externo. O teste rolou a trilha até o último cartão para confirmar
alcance nativo, separado dos testes de foco. Colunas ainda recebem as regras
originais de viewport 640/980 e a regra de contêiner ≤400; não declarar precisão
pixel-exact ou efeito ilimitado de `columns` sobre todos os breakpoints.

**Gate contínuo de teclado aprovado:** com quatro links, o ensaio colocou foco
somente no botão anterior e depois enviou Tab sem seletores intermediários:
Item 0 → Item 1 → Item 2 → Item 3 → botão posterior. Cada link foi o esperado e
ficou inteiramente dentro da largura da trilha em fluxo por linha. Ao sair,
voltou o fluxo horizontal. Shift+Tab voltou ao último link visível; Enter gerou
clique isTrusted no destino correto. A fixture cancelou navegação para preservar
o contexto da página, não simulou evento de teclado.

Coleção mista (dois links/dois cartões não-link) passou a sequência equivalente,
retorno e Enter; não adicionou tab stop no contêiner. Coleções inteiramente
não-link de dois/quatro cartões receberam foco na trilha e mostraram os cartões
em fluxo vertical. No ensaio de dois, o Tab seguinte saiu ao botão posterior,
restaurando o fluxo horizontal. Foco direto de último link/Enter em carousel e
sphere também passou em 180/320/900 px. Esses testes complementam, não substituem,
a sequência contínua que havia falhado em .4. Nenhuma asserção foi enfraquecida.

**Formulário real em memória**, com os oito params editados por FIORI-AUTO:
select/Enter reais gravaram uma vez em memória; zero writes nas listas. Unknown
JSON conservado, ETag antiga e limite numérico original recusados. Renderer
consumiu os valores relidos em timeline. App removido, HTML do painel original
intacto. Não é cadastro/instância de Showcase no SharePoint ou ciclo de instalação.

Controle de foco da trilha segue CSS, inclusive quando foco vem por mouse.
`carouselItemMinWidth` continua armazenado, mas durante foco a apresentação é
vertical; sphereSize é largura da lista estática. Masonry abandonou spans fixos/
fluxo denso para não cortar texto, sem prometer packing masonry pixel-exact.
Reflow condicionado ao foco pode mudar altura/posição: limitação explícita, não
carrossel JS com botões anterior/próximo/autoplay. Zoom real, screen reader,
forced-colors e validação assistiva integral permanecem abertos, além do lifecycle
real das futuras instalações. Browsers sem container queries não recebem o ajuste
estreito. HTML de datetime arbitrário é escapado, não certificado como data válida.

## Preservação → documentação → próximo desenvolvimento

Releitura integral final preservou **48 registros e ETags** desde o baseline
reconciliado: Cassiopeia ativa, os três estilos salvos conservados. Host.js/canvas
das duas páginas intactos, oito raízes e 0.15.0, ambas publicadas/sem checkout.
Editor TinyMCE/abas/cleanup, quatro plugins, imagens/menu e Sample Data bloqueado
passaram na navegação da verificação. 166/115 assets observados sem HTTP >=400;
não é monitoramento integral nem aprovação de save/upload editorial pendentes.
Root/CSS/apps temporários próprios foram removidos; estilo do host intacto.

Regressão final do código estabilizado: **92 suítes aprovadas, zero skips/falhas**;
checker **273 JS**. Child standalone: 80 locais/11 skips esperados. Showcase tem
26 casos portáveis e 27 incluindo build/audit; o novo export foi integrado ao
runner e à seleção explícita contributor sem dependências implícitas.
Recibo agregado final verificou hashes de **42 recibos aprovados**. Reauditoria
reconstruiu os dois pacotes .5 sem alterar bytes. 92 arquivos originais CAMAP2
e provas legadas preservados. Uma repetição de auditoria antiga encontrou nome
de recibo existente e não o sobrescreveu; não configura escrita remota ou rollback.
Releitura adicional dos 48 registros/ETags e marcador público de Cassiopeia
passaram: **44 recibos** no agregado de fechamento, navegador próprio encerrado.
Build local final 27/27 passou em novo diretório, sem alterar pacotes congelados.
Reexecução de fechamento teve um timeout de 30 s no subprocesso CLI do contributor;
essa rodada não foi contada como aprovação. A suíte contributor isolada passou
depois, com os mesmos guards/timeout e sem alterações nos testes. Regressão
integrada repetida com arquivos estáveis: **92 aprovadas, zero skips/falhas**,
incluindo contributor, sem relaxar limites ou transformar o timeout em skip.

**Showcase não instalado/registrado/habilitado** nas listas, sem roots novas
aprovadas. 78 assets de seis versões Showcase ficaram em pastas de ensaio
imutáveis. .3/.4 conservam integridade histórica, mas falharam nos respectivos
gates de teclado; não promover esses recibos a aprovação da última versão.
Evidências privadas em `tmp/showcase-cycle/`, `tmp/showcase-focus-cycle/` e
`tmp/showcase-tab-cycle/`, pacotes/snapshots em `tmp/showcase-adapt-agent-*`.
Não versionar URLs/ETags/cookies ou dados pessoais desses recibos.

**Próximo ciclo isolado: Documentation**, após este fechamento. Restam os ciclos
de Documentation, Videoteca e Forum antes de congelar os inputs reais do grupo;
os **sete módulos continuam pendentes de adoção persistida**. O teto de dez roots
não foi ampliado, e duas revisões não garantem capacidade para correções futuras.
XML plugins/templates, migrações assistidas, aceites editoriais/assistivos e
clearance amplo de distribuição permanecem separados. Principal antiga mantida
sem descarte/merge indiscriminado; não reinstalar Sample Data no site povoado.

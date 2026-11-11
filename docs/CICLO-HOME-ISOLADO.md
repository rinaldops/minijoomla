# Home — ciclo isolado de desenvolvimento e teste no site

> **Resultado — 09/11/2026:** Home 0.4.0/0.4.1 passou no ensaio isolado público e
> administrativo, após corrigir e retestar o defeito público de 180 px de 0.3.x.
> **Home não instalado**; 0.15.0, oito raízes e os 48 registros/ETags preservados.
> 90 suítes aprovadas, zero skips/falhas. Próximo ciclo isolado: Recursos.
> Este fechamento não aprova o grupo definitivo ou distribuição pública.

Base `8297280`, branch `feat/joomla-finalization-step2`, iniciado em 08/11/2026.
Release aceita 0.15.0, oito raízes e 48 registros; não instalar Home ou aprovar roots
durante o ensaio. Mantém o ciclo Desenvolvimento → Teste no site → Análise →
Validação → Documentação, retornando ao desenvolvimento para corrigir descobertas.

## Desenvolvimento e primeira análise no site

Contrato original com oito campos: eyebrow, title, primaryHighlight,
secondaryHighlight, description, primaryAction, secondaryAction, stats. Limites
originais das cinco strings: 80/180/80/80/400. Ações usam `href`, não `target`.
Stats são texto explícito estático, no máximo oito elementos no renderer; sem
backend, cálculo ou contador vivo. SecondaryHighlight não é consumido pela origem.

Ensaio original em root temporário de 320 px/viewport 921 px: fundo ausente,
cor de texto herdada escura, variável de amarelo ausente e dois IDs globais iguais.
Root recorta por overflow hidden: título interno com scroll 6989 px não constitui
reflow aprovado, ainda que o viewport não role. Mapeamento do seletor antigo à
raiz real restaurou a paleta/fundo; textos e stats precisam correção limitada.

Contraprova com quebra de palavras e grid bounded: título passou a 246 px.
Decorativos transformados ainda geravam scroll interno excedente; tratar clipping
só na camada aria-hidden, não ocultar texto editorial para mascarar overflow.
Sem ativar classe de floater/animação ausente, theme Lite ou novo destaque secundário.

## Retorno ao desenvolvimento e gates

Snapshot novo: helper de URLs estritas, renderer com dados próprios inertes/sem
IDs fixos, CSS com variáveis restritas à raiz real e reflow de ações/stats.
Preservar schema/defaults/unknown JSON, textos/avisos MIT e GPL completos, grafo
runtime fechado. Não sobrescrever fontes externas/pacotes anteriores.

Testar duas revisões com JS/CSS reais em root temporário, larguras/teclado,
estados e formulário em memória. Só após auditoria independente carregar arquivos
de ensaio novos; eles não serão registrados no host publicado ou nas listas.
Pacotes privados/recibos ficam em `tmp/home-cycle/` e `tmp/home-adapt-agent-*`.
Clearance global, distribuição pública, adoção no site e acessibilidade integral
não são consequências deste ensaio.

## Revisão → novo desenvolvimento do finalizador

Os primeiros 18 casos portáveis e o build/audit de duas revisões passaram.
Revisão independente também confirmou XML byte-a-byte do gerador original,
grafo CSS delimitado e proveniência local de três arquivos no commit de origem.
Encontrou, porém, hooks em Maps recebidos pelas APIs exportadas: getters de
size/has/get e iteradores sobrescritos podiam executar código antes da validação.
O CLI usa Maps nativos sem hooks; não é demonstração de pacote gerado inseguro,
mas invalida promessa universal de não executar callbacks dessas entradas.

Correção solicitada: exigir Map nativo exato/sem propriedades próprias e usar
intrínsecos capturados, recusando subclasses/hooks com zero execuções. Voltar a
validar pacotes congelados e regressão após fontes estáveis; não sobrescrever
inventários/arquivos para absorver hardening somente de tooling.

A primeira regressão completa terminou com 89 suites aprovadas/uma falha de
comparação contributor, coincidindo com edição dos testes pelo agente da
correção. Não se alterou a asserção para esconder drift; rodada não contada como
aprovação e será repetida somente depois do encerramento das escritas de código.

Hardening implementado: Map exato, sem propriedades próprias; brand/size,
lookups, entries e next usam intrínsecos capturados. **51 entradas negativas**
com zero callbacks/getters. **19/19** portáveis e **20/20** incluindo reauditoria
das revisões congeladas, sem mudar seus bytes. Hero manteve **17/17** testes;
helpers compartilhados somente exportados de forma aditiva, sem mudar comportamento.

Pacotes de ensaio congelados para os próximos testes:

| Revisão | SHA-256 do inventário |
| --- | --- |
| 0.3.0 | `08424e45bc3d0bb97626eb9db4ed4946a9a96c9e725d96624ed038263d9d93ed` |
| 0.3.1 | `2d4333bdff66d0c8670204036d223941f8a0f0815f4d4243ce9178cf4d26d3b1` |

Cada versão tem cinco runtime, 11 payloads inventariados e 13 arquivos ao todo,
incluindo MIT/GPL integrais. Flags globais de publicação/direitos ficam falsas.
Recibo operacional do coordenador distingue carga de arquivos de ensaio autorizada
de adoção, aprovação de raiz e liberação pública; não embutir dados do site nos
metadados genéricos nem promover o recibo a clearance global.

Ensaio de origem/correções temporárias não substitui import/render final do pacote
no site. O checkpoint inicial foi anterior à carga; sua evolução está abaixo.

## Contratos que não são funcionalidades novas

- `primaryAction`/`secondaryAction`: `{}` ou propriedades omitidas conservam
  mescla histórica com defaults; overrides inválidos explícitos devem omitir a
  ação, não restaurar destino recusado. Defaults `#discussions`/`#videos` são
  fragmentos herdados, não prova de backend de fórum/vídeo ou navegação válida.
- `stats`: array vazio e não-array legado usam os quatro defaults originais;
  lista válida inspeciona primeiros oito, sem coerção de value/label. Testes usam
  valores neutros explícitos, não apresentam números herdados como fatos do site.
- `secondaryHighlight`: continua armazenado/declarado mas não usado; destaque
  primário conserva a primeira ocorrência local pt-BR, sem introduzir alias.
- Nome acessível literal precisa de título significativo; título explicitamente
  vazio não recebe palavra/label inventada. h1 original não é chrome/headerTag
  do host nem prova de hierarquia correta na composição definitiva.
- CSS Lite ainda depende de attrs não encaminhados pelo host; mobile background
  da origem é anterior à regra principal, portanto não anunciar variante de
  fundo mobile nova. Floaters não recebem classe para ativar animação ausente.
- Encerramento remove somente root/CSS/apps próprios. Cookies/perfil de navegador,
  listas, releases e trabalho de outras equipes não são limpos/restaurados.

As oito raízes/revisões atuais foram relidas/inventariadas, com quatro extensões
instaladas verificadas e zero writes. O arquivo do host publicado e canvas das
duas páginas corresponderam ao baseline; provas temporárias não aprovam roots.

## Retomada, teste no site e descoberta pública — 09/11/2026

Carga de 0.3.0 interrompida na ferramenta. Releitura de todo o diretório encontrou
seis arquivos byte-identicamente corretos e sete ausentes, sem arquivo estranho.
Retomada limitada aos ausentes, revalidando estado antes de writes e usando
`overwrite=false`. Primeiro probe de ausência retornou 404: nenhuma criação de
arquivo, interrupção e análise; correção considerou 404 somente como ausência do
arquivo exato. Segunda continuação criou os sete ausentes e releu os 13 completos.
0.3.1 carregada nova; **26 arquivos** relidos com bytes/hash/MIME. Não instalados,
sem roots publicados ou writes de listas. Não generalizar esta recuperação manual
a replay automático de installs/transações.

0.3.0/0.3.1 passaram no painel isolado em 180/320/768/900 px, textos longos,
paleta e estados. Formulário real com oito campos e repositórios de memória:
Enter gravou uma vez somente em memória, future preservado, ETag antiga e
title de 181 chars recusados. Tab/Enter reais passaram nas ações; navegação
cancelada pela fixture. Seis viewports 320/700/760/761/900/1366 passaram no painel,
com dois tracks ≤760 e quatro acima. Root/CSS removidos, estilo do host intacto.

Releitura dos 48 itens/ETags preservada. Primeira verificação pública antecipou
a conclusão da renderização ao encontrar h1 do template: conteúdo/imagens/menu
ainda não carregados. Inspeção posterior confirmou os elementos; espera corrigida
pelos módulos esperados. Uma rodada passou mas não gravou recibo porque o nome
anterior já existia; não sobrescrito. Nova leitura com recibo próprio passou nas
duas páginas, 166/115 assets e sem erro HTTP observado nessa janela.

**Análise adicional obrigatória:** o ensaio isolado na página pública reprovou
`stats-bounded-180`. No viewport de 1366 px, o padding original ficou maior que
no admin; cada track de quatro colunas tinha ~15,56 px. Um glifo de stats não
coube, embora overflow hidden do root impedisse scroll de página. Não reduzir
a asserção nem chamar recorte de reflow válido. 320/768/900 passaram.

**Volta ao desenvolvimento:** usar container inline-size na raiz e queries de
largura de conteúdo: ≤320 px dois tracks, ≤180 px um track; preservar os demais
estilos/defaults. Contraprova temporária pública passou a 180/320/768/900 px
(stats scroll == largura). Esta contraprova não é pacote aprovado. Criar 0.4.0/
0.4.1 em novos destinos de ensaio, mantendo 0.3.x imutáveis; repetir público e
admin com os bytes finais, formulário, teclado e limpeza antes de fechar.

Regressão estável após hardening Map passou em **90 suites, zero skips/falhas**,
child 78 locais/11 skips esperados. Nova alteração CSS exige nova regressão;
esse resultado não aprova automaticamente as futuras revisões 0.4.x.

Revisão de snapshot da correção confirmou somente a troca do seletor e append
CSS delimitado, ordem viewport → query dois tracks → query um track, sem clipping
editorial adicional. Encontrou documentação intermediária ainda em 0.3.x e pediu
atualização antes de liberar o gate. Os testes finais do coordenador devem medir
**cada valor e label de stats**, além do scroll da grade/root; não basta o root
continuar recortado. Ferramentas antigas ficaram preservadas em tmp para reproduzir
0.3.x; a ferramenta corrente não deve aceitar esses pacotes como a correção nova.

## Desenvolvimento da correção por contêiner

Builder corrente fechado em 0.4.0/0.4.1. Conserva os dois hashes de helper/
renderer, XML/defaults/limites originais e avisos integrais. Só o CSS adaptado
recebe container inline-size e duas queries, mantendo a alteração total em três
fontes fixados. Nova versão não instala ou amplia a capacidade do host.
**20 portáveis / 21 com audit** passaram; 51 inputs Map negativos e guardas de
Buffer mantidos. Perfil não é sandbox contra Proxies/globals modificados.

| Pacote de ensaio do coordenador | SHA-256 do inventário |
| --- | --- |
| 0.4.0 | `f5d2291fb6268bb65b525f23f0b015547f8c3d3b916de65746318b97a1a5f443` |
| 0.4.1 | `d9208b2044196443daabbc087b1264f9d58d609cd8b2074d17eab4d849991c8a` |

Os pins acima são específicos das bases/destinos operacionais do coordenador;
não são os inventários dos builds locais neutros do agente. Auditoria reconstrói
todos os payloads finais, sem regravar arquivos. Gate de site permanece separado.

## Teste final no site → análise → validação

Revisão independente dos **26 arquivos finais** confirmou os pins do coordenador,
XML canônico, CSS AST exato, 56 fontes de snapshot e notices integrais. Confirmou
também os 26 arquivos 0.3.x e tooling histórico preservados. Gate de pacote somente;
sem claim de browser por revisão local. Carga autorizada só em pastas novas de
ensaio, sem overwrite, registro ou aprovação persistida de raiz.

No site, ambos os pacotes 0.4.x foram relidos por bytes/hash/MIME e descobertos
em memória: 0.4.1 candidata, 0.4.0 retida. Composição de prova 8+2 não gravou o
host. São **duas raízes temporárias de ensaio**, não novas aprovações publicadas.
0.3.x permanece histórica/não adotada; nunca foi reclassificada como correção.

Import/render/CSS externos reais passaram nas duas páginas e nas duas versões,
com **180/320/768/900 px** e títulos/descrições/ações/stats sem espaços. Medidas de
cada `b` e retângulos `Range` de cada label dentro de sua célula passaram, além
das asserções originais de root/grade. A paleta original/restauração de variáveis,
escaping, estados loading/empty/error e omissão de ação inválida passaram. Nenhum
getter do cenário malformado foi executado. Duas instâncias sem IDs fixos.

**Contraprova definitiva do defeito:** no público, viewport 1366 px/root 180 px,
conteúdo útil 70,72 px, um track ~70,75 px e conteúdo íntegro; 320 px recebe dois
tracks ~101,16 px; 768/900 px conservam quatro tracks. Não se reduziu padding/
fonte para disfarçar falha nem se relaxou a asserção que havia reprovado 0.3.x.
Layout responde à largura útil do módulo, além do breakpoint de viewport.

Viewports administrativos **320/700/760/761/900/1366 px** e públicos
**320/760/761/1366 px** confirmaram a combinação das regras. Acima de 760 px,
quatro colunas só onde content-box >320; abaixo, regra original de duas mantida,
podendo chegar a uma quando content-box ≤180. CSS container queries comprovadas
neste Edge; browsers sem esse recurso não recebem o ajuste estreito. Zoom real,
forced-colors, screen reader e aceitação assistiva integral seguem pendentes.

Formulário real novamente na 0.4.0, com **repositórios de memória**, oito campos
editados via FIORI-AUTO: Enter gravou uma vez só em memória, future preservado,
ETag antiga e título de 181 chars recusados sem segunda escrita. Renderer real
consumiu settings relidos. Não é aceitação de CRUD SharePoint/instalação de Home.
Tab real percorreu as duas ações; Enter gerou clique isTrusted no destino interno,
com navegação cancelada pela fixture. Outline nativo auto/1 px observado, sem
anunciar novo design de foco/aceitação integral. App/root descartados; HTML do
painel original conservado. Root/CSS finais removidos, estilos do host intactos.

## Validação de preservação → documentação → próximo desenvolvimento

Nova regressão após correção: **90 suítes aprovadas, zero skips/falhas**, 20
casos Home portáveis; child standalone 78 locais/11 skips esperados. Checker
**271 JS**. Recibos privados finais agregados: **29**, todos success e hash
verificados; reauditoria reconstruindo os dois pacotes atuais passou novamente.
Inventários 0.3.x e 92 arquivos originais externos permanecem inalterados.

Releitura dos **48 registros e ETags** correspondeu ao baseline inteiro. Snapshot
final confirmou 48 itens e ambas páginas publicadas/sem checkout; host.js e
canvas das duas páginas byte-identicamente preservados, com oito raízes aprovadas.
Não há extensão/instância Home no tenant. 0.15.0 permanece a release ativa,
Atum/Cassiopeia e configuração de Sample Data preservados. Editor/abas/cleanup,
quatro plugins, imagens e menu originais passaram nas páginas relidas; 166/115
assets na janela observada sem HTTP >=400. Não transformar isso em monitoramento
histórico integral ou aprovação de editor/upload/acessibilidade pendentes.

Evidências brutas/configurações/ETags permanecem ignoradas em `tmp/home-cycle/`
e `tmp/home-container-cycle/`, com snapshots/pacotes em `tmp/home-adapt-agent-*`.
52 arquivos de prova de quatro versões Home ficaram no destino como assets de
ensaio, **nenhuma raiz/instância instalada**. Manter versões imutáveis disponíveis;
não usar arquivos de prova para fabricar capacidade ou clearance global.

**Próximo ciclo: Recursos isolado**, somente após este fechamento. Hero e Home
foram adaptados/testados, mas os **sete módulos continuam pendentes de adoção**.
Formar grupo finito exige resolver os cinco outros inputs individualmente antes
de congelar, além dos gates posteriores de lifecycle dos sete módulos e teto
de dez raízes. XML plugins/templates e migrações assistidas seguem separados;
não reinstalar Sample Data, limpar listas, mover roots ou elevar limites para
contornar capacidade. Nenhum merge/descarte do trabalho antigo da principal.

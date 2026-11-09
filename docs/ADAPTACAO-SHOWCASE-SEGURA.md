# Showcase: adaptação offline fechada — sphere estático e foco condicional no carousel

> **Validação posterior do coordenador:** 0.5.x passou no ensaio público/admin,
> incluindo Tab contínuo/Shift+Tab/Enter, coleções mistas/não-link e os cinco modos.
> Showcase não instalado; 0.15.0/Cassiopeia, três estilos, oito raízes/48 itens
> preservados. [Ciclo completo e limites](CICLO-SHOWCASE-ISOLADO.md). O histórico
> técnico abaixo separa testes de preparação dos recibos reais posteriores.

## Resultado e limite desta etapa

O perfil novo de `mod_showcase` / `camap.mod_showcase` prepara somente versões
`0.5.0` e `0.5.1` em diretórios **novos** `tmp/showcase-adapt-agent-*`.
Versões imutáveis `0.3.x/0.4.x` são recusadas pelo perfil atual e exigem as ferramentas
históricas preservadas.
Não instala, não configura host, não escreve registros, não altera tenant,
não publica e não transforma autorização técnica em autorização jurídica.

**26 testes portáteis e 1 teste local passaram** em
`node tests/showcase-adaptation.test.js --local-build`. O teste local produziu:

| Versão | Diretório novo | SHA-256 do inventário |
|---|---|---|
| 0.5.0 | `tmp/showcase-adapt-agent-tests-VsI1KW/0.5.0` | `2c58ba8f71832c52c08edd09ebbc494b5fe5f13a1d83c2f89971b134292ed9f6` |
| 0.5.1 | `tmp/showcase-adapt-agent-tests-VsI1KW/0.5.1` | `a13af8cd2dcb70ce347970c4e1f4bcb3e01381170512faff504dc10bb7f28163` |

As provas privadas iniciais em `tmp/showcase-adapt-agent-tests-3nW9t8/` não foram
sobrescritas. Elas conservam a apresentação original de sphere e **não são as
saídas finais da escolha estática**. Não foram enviadas/instaladas por este
agente. O finalizer/auditor atual aceita somente o overlay estático com correção
de foco condicional `0.5.x` fixado; as
provas antigas exigem a ferramenta/evidência correspondente para revalidação.
Uma conferência somente leitura confirmou os hashes originais dos dois
inventários antigos e de todos os seus onze payloads, sem alteração.

Antes de modificar o perfil atual, os **três arquivos de ferramentas/docs
`0.3.x` e os 26 arquivos dos dois pacotes siteproof** foram copiados
byte-a-byte para `tmp/showcase-adapt-agent-legacy-tooling/`, com recibo
`LEGACY-RECEIPT.json`. Os pacotes siteproof originais permanecem intactos:

| Versão congelada | Diretório original preservado | SHA-256 inventário |
|---|---|---|
| 0.3.0 | `tmp/showcase-adapt-agent-siteproof-030` | `ba6f9538332b801ac34bf694579d88af1dbbb54b4072df159ba07a6253d7397c` |
| 0.3.1 | `tmp/showcase-adapt-agent-siteproof-031` | `eb37e2ac5a174f29832b9d6e89b3a72a4f2d0c1df7bb24188603d88ed6b89eeb` |

O coordenador informou que esses 26 assets já foram carregados no site para
prova, **sem configurar raiz ou instalar**. Congelamento preserva integridade,
não concede aprovação de acessibilidade ao carousel `0.3.x`. Não se deve usar
o gerador novo para regravar essas versões.
Após gerar/auditar `0.4.x`, uma conferência somente leitura confirmou os três
hashes de ferramentas arquivadas e igualdade byte-a-byte dos 26 arquivos
originais siteproof com as cópias legadas.

Antes da revisão condicional `0.5.x`, as **três ferramentas/docs `0.4.x` e os
26 arquivos de seus dois pacotes siteproof** também foram preservados em nova
pasta `tmp/showcase-adapt-agent-focus04-tooling/`, sem sobrescrever o arquivo
legado `0.3.x`. `LEGACY-RECEIPT.json` registra hashes completos e origens:

| Versão congelada | Diretório original preservado | SHA-256 inventário |
|---|---|---|
| 0.4.0 | `tmp/showcase-adapt-agent-siteproof-040` | `da987f0d37048793ab5cef6c22dc11b8e41b5c278b2481eaa4b5ad75e1831296` |
| 0.4.1 | `tmp/showcase-adapt-agent-siteproof-041` | `1826e0cc3670ac046ac936cecb4471288933212f70ccc5ed8f55282649f6bf39` |

Esses assets foram reportados como carregados para prova pelo coordenador,
não aprovados nem instalados. Integridade e foco direto aprovados **não
aprovam a sequência Tab contínua**, que falhou em `0.4.x` (abaixo).
Após a geração/auditoria `0.5.x`, conferência somente leitura verificou os
hashes dos três arquivos de cada conjunto legado e igualdade byte-a-byte dos
52 arquivos siteproof `0.3.x/0.4.x` originais com suas cópias, sem alterações.

Cada pacote contém **5 arquivos runtime, 11 payloads inventariados e 13 arquivos
totais**, incluindo os dois controles. A geração isolada conservou snapshot
de **56 fontes** dos onze módulos e fechamento de **175 arquivos de
dependências locais**. Exatamente três fontes mudam no snapshot e exatamente
um módulo é selecionado para o pacote final. As três fontes ficam fixadas por
hash e tamanho, incluindo a variante BOM/LF e a variante local BOM/final CRLF.

Esta etapa **não executou navegador, rede, instalação, suite npm completa ou
commit**. O coordenador reportou provas reais de `0.3.x/0.4.x` (detalhes abaixo), mas
elas não aprovam automaticamente os bytes novos `0.5.x`. Os novos pacotes são
provas de preparação corrigida, **não pacotes aprovados para instalação**.
O coordenador mantém separadas prova original → análise → correção visual →
validação no site → documentação final. As raízes e registros atuais não são
editados por estas ferramentas; o baseline **8 raízes / 48 entradas** permanece
responsabilidade da conferência do coordenador, não foi recontado neste teste.

## Escolha explícita do usuário: «Lista estática segura»

O CSS original de sphere tem raio em pixels calculado de `sphereSize`, rótulos
absolutos `white-space:nowrap`, raiz limitada a `max-width:100%` com
`overflow:hidden` e rotação CSS infinita de 24 segundos sem pausa. Em uma raiz
estreita, limitar a largura externa não recalcula o raio. Mesmo em raiz larga,
rótulos extensos e muitas entradas podem se sobrepor. Reduced motion impede
animação apenas quando a preferência está ativa; não equivale a controle de
pausa para todos os usuários.

Depois da prova inicial e da discussão do bloqueio, o usuário escolheu
explicitamente **«Lista estática segura»**. Esta revisão implementa esse
**desvio autorizado de capacidade/apresentação** para todo o modo `sphere`,
não apenas para uma preferência de movimento ou largura estreita:

- `mode='sphere'`, as cinco opções do enum e os oito campos/defaults/limites
  permanecem no XML/schema; nenhum parâmetro novo foi criado.
- O renderer mantém `<ul>`/`<li>` em ordem original com os títulos escapados.
  URL segura gera link; URL inválida/ausente gera `span`, preservando conteúdo.
  O nome da região passa a **«Lista de links»**.
- O renderer não calcula ângulos/raio e não emite estilos por item.
  `sphereSize` conserva default 520, limites 240–900 e arredondamento, mas
  agora controla **somente a largura** da lista, com `max-width:100%` original,
  não diâmetro, raio ou altura de círculo.
- CSS final usa fluxo normal, grid de uma coluna, altura adaptativa,
  `animation:none` incondicional, `transform:none`, overflow visível e rótulos
  com quebra. O frame interno deixa de ser circular (`border-radius:0`);
  nenhum arredondamento estrutural novo foi introduzido.
- As regras originais de rotação/keyframes permanecem como bytes de origem,
  mas o append posterior de mesma especificidade desabilita a animação
  independentemente de `prefers-reduced-motion`. Não há UI de pausa, listeners,
  temporizadores, rotação ou 3D nesta apresentação.

Isso **não preserva a esfera rotativa pixel-exact** e não é apresentado como
simples saneamento de URL. O gate de **decisão** de sphere está resolvido; o
gate de **validação dos bytes novos no site** pelo coordenador permanece separado.

O coordenador também deve verificar alcance por teclado de todos os cartões do
carousel (incluindo o caso com somente conteúdo não-link), rolagem nativa da
trilha, clipping/foco e larguras estreitas. O runtime não acrescenta botões
anterior/próximo nem promete carousel interativo com JavaScript.

## Prova real reportada: foco do carousel `0.3.x` e correção `0.4.x`

O coordenador reportou que as matrizes reais dos cinco modos em quatro larguras
de raiz e doze viewports passaram os checks de ranges/texto/imagens. Sphere
estático também passou teclado. **Carousel não passou visibilidade do último
link focado**, apesar de Tab alcançá-lo e Enter navegar corretamente:

- Em raiz 320px, último link observado em `left=410`, `right=688`, enquanto a
  trilha ocupava `left=113`, `right=433`.
- Esperar 30 frames não mudou o recorte. Enter confiável no destino correto
  **não prova que o conteúdo focado está visível**.
- Contraprova do coordenador com a regra abaixo mostrou fluxo por linha e último
  link `left=118`, `right=428`, dentro da trilha 113–433; Tab/Enter nativos
  passaram nessa contraprova temporária.

```css
.camap-showcase__track:focus-within{grid-auto-flow:row;grid-auto-columns:auto;grid-template-columns:minmax(0,1fr);scroll-snap-type:none}
```

O perfil `0.4.x` acrescenta **exatamente esse único nó CSS final de quatro
declarações**, sem listeners ou controles novos. Fora do foco, conserva a
trilha horizontal/scroll snap e o efeito de `carouselItemMinWidth`. Enquanto
a trilha **ou um descendente** tiver foco, usa uma coluna empilhada em ordem
original. O foco por mouse também pode acionar esse reflow temporário; isso é
um **desvio de apresentação explicitamente documentado**, não um carousel
pixel-exact sob foco. O parâmetro armazenado não muda e controla somente a
apresentação horizontal sem foco.

Na prova `0.4.x`, a trilha recebeu **um `tabindex="0"` fixo**, única alteração de runtime
desde o sphere estático `0.3.x`. Assim, Tab pode acionar `:focus-within` mesmo
com todos os cartões não-link, sem depender de autofoco/rolagem do navegador.
O contexto acessível é a região carousel nomeada já existente; não há novo ID,
label duplicado, botão, configuração ou evento. Não há mudança de fonte,
largura externa, min-height ou saneamento de URLs associada à correção.

As provas reais e contraprovas acima são **reportadas pelo coordenador**, não
executadas por este agente nem simuladas como validação de DOM. Os testes
locais verificam markup, CSS AST, pins, schema e preservação de JSON, **não
substituem teclado real**. Falta ao coordenador testar os pacotes `0.5.0/0.5.1`
exatos por Tab **contínuo**, Enter, foco da trilha com 2/4 cartões inteiramente
não-link, último link totalmente visível, saída de foco/restauração horizontal
e os cinco modos nas matrizes de site. A suite npm completa anteriormente reportada
como 92 aprovações pertence ao perfil anterior, não foi executada aqui para
aprovar `0.5.x`.

## Segunda prova real reportada: sequência Tab `0.4.x` → revisão `0.5.x`

Com `0.4.x`, foco direto no último link passou, mas a navegação contínua
**sentinela → trilha (`tabindex=0`) → Like/Comment** pulou todos os links depois
que o foco da trilha mudou o layout. O ensaio usou teclado nativo e não
seletores para escolher o próximo elemento após a primeira sentinela. Esse
resultado é um bloqueio real, não resolvido pelo teste de foco direto.

A contraprova do coordenador retirando o tab stop da trilha (`tabIndex=-1`
temporário) percorreu **sentinela → Item 0 → Item 1 → Item 2 → Item 3 → Like**,
com os quatro links visíveis no fluxo por linha. O perfil `0.5.x` **não emite
`-1`**: omite completamente `tabindex` quando existe qualquer URL segura entre
os itens já normalizados. Assim, Tab entra diretamente nos links; seu foco
aciona o mesmo `:focus-within` sem CSS adicional.

```js
const focusAttr = items.some(item => !!item.url) ? '' : ' tabindex="0"';
```

Somente um carousel **inteiramente não-link** recebe o atributo literal `0`,
permitindo acionar o reflow e visualizar seus cartões. Coleções mistas
preservam todos os cartões e Tab passa somente pelos links seguros; cartões
não-link ficam visíveis no mesmo fluxo empilhado. O cálculo acontece sobre
array interno/itens derivados já validados, não chama hooks do usuário e
não altera JSON. Não há listener, controle ou campo novo.

O CSS e seu hash LF
`89ca9c910fe1f13ad94c7a1d766899d5ec5b54b240f76ad8f7f967bd0d960292`
ficam **idênticos ao `0.4.x`**. Apenas o renderer muda para foco condicional,
além das versões XML/notices/metadados naturais. Estas contraprovas reportadas
não são aprovação dos pacotes `0.5.x`: falta repetir a sequência contínua com
os bytes finais, sem foco por seletor intermediário, incluindo coleções mistas
e inteiramente não-link, Enter e retorno à apresentação horizontal.

## Escopo e proveniência

Os únicos arquivos novos versionáveis desta tarefa são:

- `scripts/prepare-showcase-adaptation.js`;
- `tests/showcase-adaptation.test.js`;
- `docs/ADAPTACAO-SHOWCASE-SEGURA.md`.

As leituras Git direcionadas compararam os três blobs abaixo a
`124ac3ea1d002fe7dc517a7d03513d1238396dac:CAMAP2/...`, normalizando apenas CRLF/CR
para LF, sem remover BOM. Todos coincidiram:

| Fonte original | SHA-256 local raw | SHA-256 LF histórico |
|---|---|---|
| `extensions/camap/_shared/render.js` | `fd6166e3e3ef13253d4cab93f38d098b1d373548233fea27b727fef42a48795e` | `33a925627f241ae6ed379ddaea89a53acfa24cbe91819aa36c1d0ba08aec5387` |
| `extensions/camap/mod_showcase/module.js` (257 linhas) | `2a04379e0a1e558d21a1149e40de89f0d671642934d9a815b42ce3f839683713` | `83fde093bc26d80b16450dcf9764577add1a2b8a373c0de29bb91a15d75c1f29` |
| `extensions/camap/mod_showcase/showcase.css` (55 linhas) | `0819f852e6ce58c1a0124fb200341a14e1baf7cef8f224178b56825c33bd1863` | `a976d6deb9ebdd30bd062cb1b59affc897f2c8f3e149488c7b073604eb4ebec5` |

O texto integral MIT da raiz agregadora é preservado em
`docs/licenses/CAMAP-ROOT-MIT.txt`; SHA-256 LF
`7e9fc2fab3b2511d64d64c1e0f00fc6a9b920801f3de8e608117ff1000200b7c`.
O texto integral GPL é preservado em `docs/licenses/GPL-2.0.txt`; SHA-256
`189b1af95d661151e054cea10c91b3d754e4de4d3fecfb074c1fb29476f7167b`.
GPL-2.0-or-later cobre **as alterações autorais**, não todo CAMAP ou eventual
código de fornecedor. Evidência MIT cobre a atribuição limitada dos **três
fontes originais conferidos**, não liberação global de direitos. Não foi feita
leitura de todo o vendor para atribuir licença. `globalVendorRightsApproved`,
`vendorLicenseAssigned` e todos os flags de aprovação/modificação externa
continuam `false`.

O XML integral é a saída do **`createXml` local atual fixado** de
`tools/prepare-joomla-modules.js`, não uma alegação de XML histórico no commit
MIT. O hash do gerador e o hash
`ce2a65e93e83d67312589695ebae63621c8c2edc253208e72034ac8d15a2c1e4`
da API de adoção também são verificados. A API é relocada byte-a-byte; o
algoritmo do gerador não é alterado. A comparação integral do XML recusa
qualquer atributo, default, limite, opção ou alias extra, inclusive atributos
descartados pelo parser de manifestos.

## Contrato preservado e validação derivada

Os oito campos completos, na ordem original, não mudam:

| Campo | Tipo / limites originais | Default original |
|---|---|---|
| `title` | string, máximo 120 | `Showcase` |
| `introText` | string, máximo 800 | `''` |
| `mode` | enum `list, carousel, masonry, sphere, timeline` | `list` |
| `items` | array | `[]` |
| `columns` | number, 1–6 | `3` |
| `carouselItemMinWidth` | number, 180–560 | `280` |
| `sphereSize` | number, 240–900 | `520` |
| `timelineLabel` | string, máximo 120 | `Linha do tempo` |

As restrições de string pertencem ao schema/admin. O renderer não trunca
automaticamente JSON antigo nem o regrava para impor limites. Valores
fracionários válidos de `columns` continuam números no schema/admin; somente
o cálculo visual os arredonda para baixo. Valores omitidos conservam defaults.

O saneamento acontece **somente na cópia derivada para renderizar**:

- Contexto e settings exigem objetos próprios plain (prototype padrão ou null)
  e data descriptors; não invocam getters, funções, `toJSON`, `valueOf` ou
  `toString` do chamador. Estado primitivo desconhecido segue as comparações
  originais de `stateMessage`, sem coerção ou nova regra de dispatch.
- Strings explicitamente inválidas de título/intro/label ficam vazias;
  `mode` aceita apenas string válida após trim, senão `list`. Label vazio de
  carousel usa `Showcase`; label falsy de timeline usa o default original.
- Números aceitam número finito ou string decimal estrita com sinal opcional.
  Mantêm clamp original; colunas mantêm floor visual. Null, boolean, vazio,
  hexadecimal, exponencial e não finito usam default, sem o antigo
  `Number(null) → 0`. Isso é uma limitação defensiva declarada para dados
  antigos não numéricos, não migração ou persistência de reparo.
- Arrays são exatos, densos e com comprimento próprio **até 500 antes de
  enumerar descriptors**. Sparse, extras, símbolos e accessors são recusados.
- Cada item próprio plain exige `title` string não-branca após trim. Textos
  opcionais inválidos são omitidos na saída derivada; linhas com accessors,
  funções próprias ou prototype inadequado são conservadoramente omitidas.
- URL inválida/vazia/`#` mantém o cartão como conteúdo **não-link**, não remove
  o cartão. URLs válidas HTTPS, server-relative ou fragmento local usam a
  política `SAFE_URL_SOURCE` exata de Editorial. Bytes válidos são retornados
  intactos e escapados uma vez, sem aceitar URLs com espaços que eram trimados
  permissivamente no normalizador original.
- Imagens exigem HTTPS ou server-relative estrito e **nenhum `#`**; media
  insegura é omitida sem `src=""`, `src="#"`, `data:` ou `blob:`. Alt vazio
  decorativo continua permitido. O item textual continua existindo.
- Categoria/data/extraInfo são strings escapadas. Data arbitrária continua
  aparecendo também em `datetime`, comportamento original de schema livre;
  **não há validação de calendário**. Timeline evita repetir a mesma data em
  metadata. Sphere passa a lista estática de **títulos**, sem prometer imagens,
  descrição ou metadata que o original não renderizava nesse modo.
- Estilos inline são somente colunas 1–6 inteiras, largura arredondada 180–560,
  largura da lista sphere arredondada 240–900. Sphere emite um único estilo de
  largura na raiz interna, sem ângulos/raio ou CSS por item. Dados do item não
  viram CSS arbitrário.
- O original não tinha IDs globais fixos. Nenhum ID foi inventado ou removido
  sob uma falsa alegação de correção de duplicatas.

Esses checks não são sandbox para Proxy, globais já adulterados ou JavaScript
arbitrário. Imports em data URLs usam somente fixture completa validada por
SHA-256. A geração local executa tooling interno confiável com hashes fixados,
jamais um arquivo JS fornecido como metadata pelo chamador.

## CSS autoral: mudanças e desvios declarados

O CSS original completo é mantido; o append é local a `.camap-showcase`:

1. `overflow-wrap:anywhere`, `min-width:0` nos fluxos e container inline-size.
2. Masonry muda de grid dense com spans fixos 16/22/30 × 12px para
   **grid em ordem original com altura adaptativa e `grid-row:auto`**. Classes
   sm/md/lg permanecem no markup, mas deixam de impor essas alturas. Isso
   evita clipping de texto; **não preserva pixel-exact nem promete algoritmo
   masonry completo**.
3. Carousel conserva scroll snap horizontal nativo somente na trilha. O mínimo
   por cartão é limitado a 100% da trilha e recebe padding local. Com foco na
   trilha/descendente, o nó final `:focus-within` empilha cartões e remove snap;
   fora de foco a apresentação horizontal permanece. A trilha recebe
    `tabindex="0"` **somente quando todos os cartões forem não-link**; com qualquer
    link seguro omite o atributo. Não há controles JS novos;
   teclado precisa da prova dos bytes novos no site.
4. Foco usa contorno sólido azul de 3px inset, em vez de alpha .35, evitando
   depender de outline externo que as bordas `overflow:hidden` podem cortar.
5. Container até 400px recebe uma coluna. Acima disso os breakpoints **de
   viewport originais** 980px/640px continuam: em particular 980px força duas
   colunas mesmo se `columns=1`. **Não se afirma que todos os efeitos de
   `columns` foram corrigidos em todas as larguras.**
6. Sphere passa a lista estática **em todas as larguras**, conforme escolha
   explícita: frame com `aspect-ratio:auto`, `overflow:visible`, raio zero e
   border-box; stage estático grid `minmax(0,1fr)`, gap/padding `.5rem` e
   `animation:none`; itens estáticos com transform none/min-width zero;
   rótulos com `white-space:normal`, `max-width:100%`, border-box e quebra.

Raiz estrutural não recebe borda arredondada nova. Cards internos e marcadores
preservam estilos originais; o frame interno de sphere torna-se quadrado,
enquanto os chips de link internos conservam seus raios originais. Isso não
constitui promessa global de tema estrutural. Não há `@import`, imagem CSS ou
requisição externa no append.

## Comandos e validações disponíveis

```powershell
node tests/showcase-adaptation.test.js
node tests/showcase-adaptation.test.js --local-build
node scripts/prepare-showcase-adaptation.js --base /offline/showcase/0.5.0 --output tmp/showcase-adapt-agent-nova-prova --version 0.5.0
node tests/showcase-adaptation.test.js --packages tmp/showcase-adapt-agent-tests-VsI1KW/0.5.0 tmp/showcase-adapt-agent-tests-VsI1KW/0.5.1
```

`--local-build` sempre gera pasta nova; não sobrescreve os exemplos acima. A
auditoria de pacote é somente leitura: verifica hashes/tamanhos, fechamento
exato, XML completo, notices integrais, fonte original, snapshot, metadados e
reconstrução byte-a-byte pelo finalizer; faz descoberta/verificação usando
**file-port local**, sem fetch de rede e sem instalar. Testes cobrem todos os
modos com/sem imagem local de fixture (sem carregar imagem), URLs ofensivas,
arrays de 500/501/enorme sparse, escaping, estilos limitados, estados,
Map/Buffer/hooks, forgery rehash, roundtrip JSON/admin e reprodução das duas
versões. Os dois casos adicionais conferem explicitamente a escolha estática,
ordem/links/nonlinks, largura schema-preservada, ausência de geometria por
item, CSS normal-flow/wrapping e desligamento incondicional da animação, também
com 500 rótulos extensos. Os dois casos de foco adicionais conferem o nó CSS
final exato com quatro propriedades, ausência de JS e o `tabindex="0"`
com 2/4 cartões não-link completos. Um novo caso confere links/mistos sem
tab stop de trilha, nonlinks derivados com `0` e CSS idêntico ao perfil `0.4.x`.
O finalizer também recusa o renderer anterior exato com `0` incondicional,
mesmo quando o inventário adulterado é recalculado com hashes corretos.
A igualdade de HTML nos cinco modos admite
**somente o desvio sphere declarado e o tabindex condicional da trilha carousel**, além
dos checks defensivos para dados inválidos. Teste local valida CSS com parser
real, compara AST integral original+append e confere o único nó final de foco,
snapshot e dependências antes
e depois, e recusa reutilizar fonte já adaptada como original.

## Próximo gate do coordenador

1. Preservar provas/26 assets de cada versão dupla imutável `0.3.x/0.4.x`;
   não confundir layout, foco direto e sequência Tab contínua.
2. Validar a escolha **já autorizada** de sphere estático e alcance de todos
   os links/itens em fluxo; conferir carousel/colunas/foco e qualquer correção
    adicional nos pacotes novos `0.5.x`. Conferir Tab contínuo de links/mistos,
    Tab da trilha inteiramente não-link e restauração horizontal fora do foco.
    Não instalar enquanto houver gate visual/teclado.
3. Usar somente os novos pacotes `0.5.x` fixados; aplicar apenas correções
   adicionais aprovadas e gerar novas provas sem sobrescrever árvores anteriores.
4. Reexecutar testes focalizados e prova no navegador; atualizar esta documentação
   com recibos reais, sem alegar validação não executada.
5. Manter licenciamento, ciclo install/update/rollback, contagens 8/48 e
   publicação como gates distintos autorizados pelo usuário.

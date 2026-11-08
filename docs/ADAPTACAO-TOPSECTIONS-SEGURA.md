# Adaptacao segura de topsections

> **Ciclo posterior do coordenador:** pacote adotado individualmente na 0.15.0,
> revisões/layout/links/teclado conferidos e 46 registros anteriores preservados.
> [Resultado e limites](CICLO-TOPSECTIONS.md). Flags de preparação abaixo não
> substituem os recibos operacionais separados nem licença global do vendor.

Perfil fechado para `camap.mod_camap_topsections`, nas versoes `0.3.0` e
`0.3.1`. Preparacao offline, nao instalacao nem aprovacao de publicacao.

## Escopo e contrato preservado

`scripts/prepare-topsections-adaptation.js` reutiliza os coletores, limites,
escrita exclusiva e fechamento offline exportados pelo builder editorial.
Nao altera scripts existentes, fontes CAMAP, gerador, API, pacotes anteriores
ou registros. Apenas uma nova arvore `tmp/topsections-adapt-agent-*` recebe
escritas. A base deve ser explicita; nao existe perfil configuravel nem entrada
de codigo, patches ou hashes fornecidos pelo chamador.

Exatamente tres fontes recebem patches com anchors SHA-256 completos:

1. `_shared/render.js`: reutiliza `SAFE_URL_SOURCE`; permite fragmentos,
   caminhos server-relative sem `//` e HTTPS sem credenciais. Rejeita espacos,
   controles, barras invertidas e bypasses codificados. Retorna os bytes seguros
   originais; links inseguros usam `#`.
2. `mod_camap_topsections/module.js`: filtra linhas antes do `slice` original.
   Aceita objetos plain com titulo proprio string nao vazio e URL ausente ou
   string. Rejeita linhas com getters, inclusive em campos desconhecidos ou
   simbolicos, sem chamar os getters. A fronteira JSON existente rejeita chaves
   simbolicas; nao ha uma migracao dos dados armazenados.
3. `mod_camap_topsections/sd.css`: troca somente
   `minmax(14rem,1fr)` por `minmax(min(14rem,100%),1fr)` e acrescenta
   `.camap-sd{overflow-wrap:anywhere}.camap-sd li{min-width:0}`.
   Mantem auto-fit, gap, lista, bordas, cores, fontes, seletores originais e
   demais declaracoes. Wrapping inclui o heading por heranca. Nao modifica CSS
   global, tema ou outros modulos.

O terceiro patch responde a duas contraprovas somente leitura comunicadas pelo
coordenador: raiz de 180px com scroll de 224px no CSS original; depois da troca
do grid minimo, titulo de item com 300 caracteres sem quebra produziu scroll
de 3395px. O teste corretivo de wrapping no item reportou scroll de 180px.
A validacao visual da forma final, que cobre tambem headings, pertence ao
coordenador e deve ter recibo separado. Estes resultados nao sao publicacao.

Schema e XML continuam com `title` text/default vazio, `items` JSON-array/default
`[]` e `itemLimit` number/default `6`, nessa ordem e com os labels originais.
Sem bounds novos: zero usa seis, negativos produzem lista vazia, fracionarios
truncam pelo `slice` e nao existe novo maximo. `escapeHtml`, `stateMessage`,
markup e estados sao preservados. Settings desconhecidos proprios e linhas
invalidas permanecem armazenados, inclusive em edicoes administrativas nao
relacionadas. Nao ha backend canonico JS/PHP, imagens ou aliases novos.

## Fechamento e proveniencia

O gerador original precisa dos onze modulos em um snapshot privado interno.
O pacote selecionado entrega exatamente cinco caminhos de runtime:

```text
modules/mod_camap_topsections/mod_camap_topsections.js
modules/mod_camap_topsections/mod_camap_topsections.xml
media/mod_camap_topsections/css/sd.css
libraries/camap/extensions/camap/mod_camap_topsections/module.js
libraries/camap/extensions/camap/_shared/render.js
```

Com planos, avisos e licencas: 11 payloads inventariados e 13 arquivos totais no
checkout local atual, que nao possui notice na raiz CAMAP. Notices de raiz
originais, se presentes, sao retidos verbatim e inventariados adicionalmente.
Nenhum arquivo extra e aceito sob os prefixos do modulo.

`ADAPTATION.json` registra os tres hashes originais/modificados/gerados, BOM,
EOL e tamanhos, o snapshot limitado, o hash real da API e o gerador original.
O finalizador valida caminhos exatos, controles com chaves fechadas, XML pelo
   parser real, schema/defaults/labels, inventario, root imutavel e hashes.
Metadados nao executam getters ou funcoes e possuem budgets de estrutura/bytes.
Overrides de fontes devem ser copias do CAMAP local confiavel; overrides de
dependencias devem ser identicos ao fechamento offline local confiavel.

MIT original: `docs/licenses/CAMAP-ROOT-MIT.txt`, preservado integralmente do
notice local aprovado. Evidencia historica:
`124ac3ea1d002fe7dc517a7d03513d1238396dac`, escopo limitado aos tres caminhos de
fonte acima. Hashes LF foram comparados com os blobs Git desse commit, mantendo
BOM. Isso nao atribui direitos globais a todo o vendor.

GPL-2.0-or-later aplica-se somente ao builder e mudancas autorais; o texto
integral e preservado em `docs/licenses/GPL-2.0.txt` com SHA-256
`189b1af95d661151e054cea10c91b3d754e4de4d3fecfb074c1fb29476f7167b`.
Nao substitui copyright nem relicencia CAMAP inteiro.

Anchors SHA-256 (bytes locais originais / LF historico / gerado final):

| Fonte | Original local | LF historico | Gerado final |
| --- | --- | --- | --- |
| `_shared/render.js` | `fd6166e3e3ef13253d4cab93f38d098b1d373548233fea27b727fef42a48795e` | `33a925627f241ae6ed379ddaea89a53acfa24cbe91819aa36c1d0ba08aec5387` | `e6d967556bb4c36db272c967205977b8a9947fadb093819ce069802c91e29c76` |
| `mod_camap_topsections/module.js` | `035fbbe0e43a92883ecace67ecbf4e1047cb1b7f5a32c2ddcf7276c133b9119b` | `9b6daa23e372a84f0109a0e66a5f04518a904527dba6e2a6ee1c309d3be417db` | `4b73366bdce1bc3c5197ee7e1851fb5f539b33c28569658c0136a8ddba26ba65` |
| `mod_camap_topsections/sd.css` | `6468e2bdc3677d9fe9a25c9ed49ce0fae0c313fbc4899a69765301fd7953686a` | `87a556eec4d8624185fcfc2f570d036b5054b443f12c1bf442493c5add0e103f` | `6502b81074c12d728a22eb000f5267bb71a88c7726143b70e3224e6ebfae1f1b` |

API local aprovada: `scripts/prepare-module-adoption.js`, SHA-256
`ce2a65e93e83d67312589695ebae63621c8c2edc253208e72034ac8d15a2c1e4`.
MIT: original local
`9f855c789f6d1bd404f856ea7c3e7af498e0ee2cc1e842a47ed2559cac09a1a9`,
LF historico `7e9fc2fab3b2511d64d64c1e0f00fc6a9b920801f3de8e608117ff1000200b7c`.

## Validacao focada

```powershell
node --test tests/topsections-adaptation.test.js
node --input-type=module -e "const t = await import('./tests/topsections-adaptation.test.js'); await t.runTopsectionsAdaptationTests();"
node tests/topsections-adaptation.test.js --local-build
```

Modo padrao: 13 testes portaveis, sem checkout CAMAP, dependencias externas,
browser, rede ou escrita. Usa somente o pequeno modulo original com hash
aprovado e literals existentes de helper/MIT lidos como dados. Imports data-URL
executam apenas o grafo conhecido apos validar hashes. Importar a suite nao
agenda `node:test`; `runTopsectionsAdaptationTests()` aguarda casos sequenciais.

`--local-build` e opt-in: 14 testes, duas arvores novas, comparacao CSS AST real
restrita a grid/wrapping/min-width, XML e discovery por file ports, integridade,
proveniencia comparada aos originais locais, refusal de overwrite e verificacao
dos 56 arquivos de fontes e 175 arquivos do fechamento offline. Nenhum install
ou full npm e executado. O audit exportado e
`auditTopsectionsAdaptationPackage(path, version)`; nao executa JS do pacote.

Preparacao explicita em uma nova arvore:

```powershell
node scripts/prepare-topsections-adaptation.js --base /offline/topsections/0.3.0 --version 0.3.0 --output tmp/topsections-adapt-agent-new
```

Dependencias default: `tmp/step2/camap-source`. Outra revisao exige nova arvore e
base imutavel. Nao sobrescrever saidas anteriores nem congelar os artefatos de
diagnostico intermediarios.

## Gates separados

`rightsApproved`, `publicationApproved`, `migrated`, `tenantModified`,
`hostConfigured` e `currentRecordsModified` ficam `false` no plano e proveniencia.
`vendorLicenseAssigned` tambem e `false`. Preparacao pode ocorrer em paralelo;
o coordenador fornece separadamente review independente, contraprova visual
final, lifecycle entre revisoes e eventual decisao de publicacao. Este documento
nao aprova tenant, host, publicacao ou direitos globais.

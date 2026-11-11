# Documentation 0.5.0 / 0.5.1 — mapa de derivação e fonte offline

> **Consolidação posterior:** o suporte de build aprovado foi congelado byte a
> byte em `scripts/documentation-frozen-build/`, com 18 arquivos próprios/avisos
> e regra Git `-text` para preservar CRLF/LF/BOM históricos. O script de entrada
> atual é uma facade que lê essas fontes fixas, nunca versões mutáveis do núcleo.
> Os pacotes finais e seus hashes não mudam; a facade foi retestada em 16 grupos.
> Isso evita que evoluções nativas ou conversão de newline no checkout alterem
> implicitamente a cadeia de reprodução de um ensaio histórico. Código congelado
> não é a aplicação ativa nem autorização de publicar fontes de outros módulos.

Perfil **novo, fechado e exclusivamente local**, criado em 09/11/2026 por
`scripts/prepare-documentation-source-package.js`. O builder 0.3.x, seu runner,
stage-contributor e CAMAP2 não são alterados nem chamados para gerar pacotes.
O perfil atual aceita **somente 0.5.0/0.5.1**. Pacotes 0.3.x/0.4.x existentes
ficam preservados byte a byte; não são reescritos nem aceitos pelo novo finalizer.
`rightsApproved`, `publicationApproved` e `vendorRightsCleared` permanecem
**false**. Não há autorização de instalação, distribuição externa ou operação
do site decorrente destes testes.

## Correspondência upstream selecionada

O review upstream recebido da sessão coordenadora estabeleceu a ligação da
documentação oficial Phoca ao artefato:

- <https://github.com/PhocaCz/PhocaDocumentation/releases/download/6.0.0/phocadocumentation_override_v6.0.0.zip>
- **19.075 bytes**, SHA-256
  `96aa8d209cd1aefe9d08dae8a233d434e282d75759e6b17f51d597344d20555f`.
- As 12 entradas locais correspondem byte a byte ao ZIP; a entrada
  `.documentation.xml.kate-swp` é **excluída**, nunca empacotada.
- As 11 referências selecionadas correspondem também aos blobs de
  `TemplateOverride/` no commit **`f2386b6b935c82f0fa0d94881c144ef1d91af0f9`**.
  O source archive do tag 6 aponta para um commit antigo incorreto e não é usado.

Estas evidências de aquisição foram fornecidas pelo review coordenador; este
gerador não baixa ZIPs nem consulta rede. Tentativas anteriores Node/webfetch
falharam por TLS/transporte. **Evidência adicional do coordenador em 09/11/2026**:
PowerShell `Invoke-WebRequest` GET da URL pinned abaixo retornou **HTTP 200**;
bytes exatos de `RawContentStream`: **83 bytes**, SHA-256 igual ao pin abaixo.
Foi usado o trust store padrão Windows, sem bypass de TLS/certificados. Essa
leitura HTTP bem-sucedida é distinta das falhas históricas e está registrada no
notice/linkage do novo pacote; o gerador offline não a reexecuta.
Materializamos o literal exato revisado, **sem
newline final**, `GNU General Public License version 2 or later; http://www.gnu.org/copyleft/gpl.html`,
e verificamos seu pin independente:
`b8b2c2a80dbc38eb6b7c27ea374a5c0ead24449524671a65722f4ef4ade5c670`.
Origem registrada:
<https://raw.githubusercontent.com/PhocaCz/PhocaDocumentation/f2386b6b935c82f0fa0d94881c144ef1d91af0f9/LICENSE>.

Todos os caminhos abaixo são relativos a `TemplateOverride/` e copiados para
`source/upstream/PhocaDocumentation/TemplateOverride/`:

| Referência | SHA-256 |
| --- | --- |
| `copy_to_TEMPLATES-YOURTEMPLATE/html/com_content/categories/documentation.php` | `76e7fbbd9e20db250749a361c84c5264b2fff737e24eb11b4d069b2623282825` |
| `copy_to_TEMPLATES-YOURTEMPLATE/html/com_content/categories/documentation_items.php` | `353d9793c02320cfb66a5ccf93d21163f06ad48a66bb9fb5d87fed2bc2db0a81` |
| `copy_to_TEMPLATES-YOURTEMPLATE/html/com_content/categories/documentation_subitems.php` | `5725a6f269778fffda87c26e281af4ab8fecde05267fe063e56d9654a360a43f` |
| `copy_to_TEMPLATES-YOURTEMPLATE/html/com_content/category/documentation.php` | `02660c8e398d673853a098cba39122f6fc41d071bace803538c3e8f1134fae9e` |
| `copy_to_TEMPLATES-YOURTEMPLATE/html/com_content/category/documentation_children.php` | `d8d29240434a84e1bd2e803c828a00775cbef128b36ffe20e77162bc0bfb2335` |
| `copy_to_TEMPLATES-YOURTEMPLATE/html/com_content/category/documentation_subitems.php` | `ea4a6bd530ac6f7b2651ba07b099ed117321b240a64c5a0b6427458539a17e36` |
| `copy_to_TEMPLATES-YOURTEMPLATE/html/com_content/categories/documentation.xml` | `aeec8043f5d96163057ebb4ed03bc13eadfe471ebd7cbf717c0ba83b189e5549` |
| `copy_to_TEMPLATES-YOURTEMPLATE/html/com_content/category/documentation.xml` | `f580f58db63cd7f6bf740d096075f24637a6afc0e035b92e7290d471c65905fa` |
| `copy_to_MEDIA/com_phocadocumentation/css/main.css` | `b5ad8c407339f1b34cdfb4878dad2be07c0c1d34dfec7686b2f0a0069d77892d` |
| `copy_to_MEDIA/com_phocadocumentation/images/svg-definitions.svg` | `577c78f358bfdb21c774e8484ea50ab866041449d604a41926585667072b4460` |
| `README.txt` | `d38836c5122f592ec551d710f0c00c8443ee1e67d937e6c4c9089bb9590c099a` |

PHP é **dado**, nunca executado. SVG e README são referência/comparação, não
assets runtime nem instruções executadas. Os SVG inline do port têm geometria
diferente do upstream; isso **não demonstra direitos independentes** sobre ícones.

## Notices e licenças com escopos separados

JS e CSS Documentation conservam o comentário inicial scoped introduzido na 0.4.x:

> Copyright (C) 2006, 2009, 2010 Open Source Matters. All rights reserved.
>
> Copyright (C) Jan Pavelka, www.phoca.cz.

O comentário registra `GPL-2.0-or-later`, port/adaptação em **09/11/2026** e
os caminhos para notice/linkage/texto completo. GPL aplica-se ao **trabalho
derivado Documentation completo**, não somente a patches novos. Headers
originais dos PHP/CSS upstream são preservados, sem inventar novo ownership.
Na versão 0.5.x esses comentários são **idênticos aos da 0.4.x**.

O helper compartilhado conserva um notice separado para a identidade histórica
MIT, Copyright (c) 2026 Rinaldo Paulino de Souza, e para as mudanças de política
estrita de URL sob GPL. O `../LICENSE` histórico é copiado exato para
`docs/licenses/CAMAP-ROOT-MIT.txt`, pin
`9f855c789f6d1bd404f856ea7c3e7af498e0ee2cc1e842a47ed2559cac09a1a9`,
origem histórica `124ac3ea1d002fe7dc517a7d03513d1238396dac`.
Esse MIT **não é a licença upstream e não comprova ownership Phoca/Joomla**.
O texto completo GPL v2 local é copiado byte a byte, pin
`189b1af95d661151e054cea10c91b3d754e4de4d3fecfb074c1fb29476f7167b`.

`docs/LICENSE-LINKAGE.json` associa materiais, notices, escopos e hashes.
O `source/minijoomla/LICENSE.md` pinned **não é editado**. Seus links relativos
resolvem dentro da fonte incluída com duas adições geradas:
`source/minijoomla/docs/licenses/GPL-2.0.txt` (duplicata byte-exata do GPL local)
e `source/minijoomla/docs/THIRD-PARTY-NOTICES.md` (ponte estritamente limitada ao
closure). A ponte preserva os links ISC do parser e aponta para notice/linkage/
mapa do pacote; **não copia nem declara o inventário third-party global**.
`buildSupport` no linkage e `sourceLicenseMapping` no closure refletem esses
caminhos. Suporte estático próprio é GPL; parser mantém ISC; o helper histórico
MIT/mudanças GPL e o port derivado completo GPL permanecem em escopos distintos.
Os checks específicos `upstreamLicenseLinkage` e `selectedSourceMaterialized`
podem passar porque avaliam essa ligação/materialização fechada. Não representam
parecer jurídico, compatibilidade/licenciamento global, certificação de mídia
ou aprovação de publicação.

## Diferenças concretas do pacote legado de 13 arquivos

Novo pacote: **57 arquivos / 55 payloads inventariados**. A diferença líquida
é **+44 arquivos** frente ao legado de 13; **+3** frente a 0.4.x (mapa, duplicata
GPL e ponte de notices), não uma extensão de runtime ou adoção de outros módulos.

- Os mesmos cinco caminhos runtime permanecem: wrapper, XML, JS Documentation,
  helper e CSS. JS/CSS/helper = bytes do overlay 0.3.x normalizado pelo mesmo
  contrato antigo para LF, precedidos **somente** pelos notices específicos.
  Comparação direta contra ambos os finais 0.4.x: runtime byte-idêntico,
  inclusive comentários, exceto `<version>` do XML.
- `documentationAdaptationXml('0.3.0')` permanece a fonte XML canônica. Somente
  `<version>` muda para 0.5.0/0.5.1: os **24 campos ordenados**, defaults,
  constraints, enum e restante do XML não mudam.
- Os oito controles/docs/licenças históricos têm equivalentes no novo pacote;
  metadados deixam de exigir o snapshot de 56 fontes e 175 dependências npm.
  Não são copiados dados/host defaults ou evidências operacionais antigas.
- Novos: três originais intactos; 11 referências upstream; LICENSE upstream;
  cinco cópias preferred do runtime; 18 arquivos em `source/minijoomla/`;
  launcher, README e build closure; notice upstream, linkage e mapa de derivação.
- `source/minijoomla/`: 11 imports estáticos transitivos de suporte, o novo
  packager, declaração ESM mínima, LICENSE do projeto e LICENSE/notices ISC.
  **Não contém fixtures nem os originais CAMAP de outros módulos**.
- A cadeia importada passa por Documentation, Home, Hero e Editorial; seus
  arquivos contêm transformações próprias, defaults/algoritmos auxiliares e
  rotinas de builders legados. Não passam por Recursos e seus builders amplos
  **nunca são chamados**. A presença desses scripts não concede clearance
  global; são suporte estático incidental necessário aos exports reutilizados.
- O bundle ISC `@rgrove/parse-xml` é suporte de build/API, não runtime; LICENSE e
  notices completos locais são incluídos. Não alegamos incluir toda a árvore
  upstream de desenvolvimento desse parser ou recompilar seu bundle no rebuild.

Os pins antigos do overlay continuam independentes:
helper LF `e6d967556bb4c36db272c967205977b8a9947fadb093819ce069802c91e29c76`,
JS `a79ee923b8152e1a3563e7baaee98d70356e8d76611c38877e62b7e48cbdf7b9`,
CSS `062b19ac80d014ba2bc2d95313333d227a1af8f21f07d5c60afa5ec39cbff22e`.

## Mapa materializado e diferenças, não equivalência Joomla

O artefato **gerado dentro de cada pacote** é `docs/DERIVATION-MAP.json`, formato
`minijoomla-documentation-derivation-map-v1`. O arquivo não é um quarto input
do repositório: sua definição canônica está no packager com pin normalizado,
para respeitar o escopo de edição de três arquivos. Build, finalizer e launcher
o reconstroem a partir das fontes incluídas pinned. Está inventariado, ligado
por ADAPTATION/linkage/closure e integra o rebuild byte-exato.

Cada referência registra caminho relativo do pacote, linhas **1-based inclusivas**,
anchors literais, SHA-256 dos **bytes originais completos** e SHA-256 do trecho
UTF-8 **normalizado para LF**, linhas unidas sem newline adicional. Ranges e
anchors são checados contra fontes realmente incluídas; não são texto livre ou
hashes de caller. As linhas runtime já incluem os headers iguais aos da 0.4.x.
O mapa contém os 24 campos em ordem, default/constraints e seus pontos JS/schema/
XML/uso, todas as funções runtime JS/helper, todos os seletores CSS (incluindo
ocorrências repetidas), cinco arquivos runtime/preferred, os 12 fontes executáveis
de suporte mais launcher, imports estáticos resolvidos e relações de licença.

| Alvo runtime JS | Referência selecionada | Diferença relevante |
| --- | --- | --- |
| `renderCategoriesView` 308–331 | `categories/documentation.php` 52–77 | Config/árvore local; sem DB fallback/content.prepare/module lookup |
| `renderCategoryCards` 266–306 | `categories/documentation_items.php` 18–84; `documentation_subitems.php` 16–48 | Cards recursivos em vez de listas ul/li; sem `tmpl_hide_categories`; imagem do card **não** usa `showDescriptionImage` |
| `renderChildrenList` 338–374 | `category/documentation_children.php` 24–80; `documentation_subitems.php` 19–47 | Config local `showSubcatDesc` versus PHP `show_subcat_desc_cat`; counts/descrições em todos os níveis; sem imagem de filho |
| `renderCategoryView` 395–457 | `category/documentation.php` 60–133, 138–184 | Tags string[] não CMS objects/FileLayout; labels/routes locais; sem events/content.prepare |
| artigos 432–444 | `category/documentation.php` 138–171 | Só boolean `published`; **sem ACL/access-view/show_noauth, publish_up/publish_down/state/datas Joomla** |
| `renderPagination` 376–393 | `category/documentation.php` 185–195; XML 340–365 | Objeto host-precomputado, não JPagination; sem controles separados `show_pagination`/`show_pagination_results` |
| normalização 137–259 | adapter original incluído 74–196, 204–239; funções do port original local | Guards próprios, não tradução PHP; duplicatas/ciclos/URLs/budgets explicitados |
| entry 463–479/helper 8–31 | contrato local, port/helper original e overlay pinned | Render síncrono próprio; plugin mencionado é contexto histórico, **não dependência/fonte selecionada** |

`defaults` 52–96, schema 98–131 e XML runtime 15–80 refletem política **local**,
não resolução de `useglobal`. `view`/`title` combinam duas views upstream e
interface própria. `showPageHeading=false`, `pageHeading=Documentação`,
`rootLabel=Categorias`, `rootHref=#documentacao`, `categories=[]`, `pagination={}`
são decisões locais. Campos de descrição/empty/count/title/tags mantêm boolean
defaults explícitos, não defaults CMS equivalentes. `maxLevelCategories/maxLevel`
aceitam números [-1,10] no schema local contra enums upstream [-1,1..5] e
[-1,0..5]. **-1 recursivo local**, limitado pelo `HARD_DEPTH_LIMIT=20` próprio,
difere das condições PHP `>1`. O XML é fixture canônica capturada pelo adapter
antigo (linhas 62–69), **não XML gerado dos PHP/XML upstream**; só versão muda.

CSS: ícones 40–59 ← `main.css` 11–26/46–63/71–77; cards 63–116 ← items
20–36/61–79 e subitems; back 120–134 ← main 65–77/PHP 67–90; listas
166–237 ← main 28–63; pager/responsivo 241–287 são layout próprio com referência
PHP 185–195; append 288–300 ← adapter próprio 198–201. Não é simples rename
de `main.css`. SVG inline JS 37–44 difere da referência SVG 3–20 e **não prova
direitos independentes**. CSS/README mencionam plugin; nenhum fonte de plugin
ou original CAMAP de outros módulos é incluído/selecionado por esse fato.

Alterar default, função, selector, range, anchor, hash, descrição ou relação
de licença do mapa **mesmo rehashing inventory/host-config** falha na comparação
canônica. Isso valida rastreabilidade técnica e integridade, não parecer jurídico
nem equivalência Joomla ou clearance global.

## Reconstrução reproduzível e trust root

```powershell
node scripts/prepare-documentation-source-package.js --version 0.5.0 --base /offline/documentation/0.5.0 --output tmp/documentation-adapt-agent-source-new-050
node scripts/prepare-documentation-source-package.js --version 0.5.1 --base /offline/documentation/0.5.1 --output tmp/documentation-adapt-agent-source-new-051
node tests/documentation-source-package.test.js
node tests/documentation-source-package.test.js --local-build
```

Dentro de um pacote, de qualquer cwd:

```powershell
node source/rebuild.mjs --version 0.5.0 --base /offline/documentation/0.5.0 --output tmp/documentation-adapt-agent-source-rebuilt
```

O rebuild usa **Node >=24, sem npm/rede/PHP/browser**, somente fontes incluídas;
não precisa de CAMAP2 nem repositório MINIJOOMLA irmão. O destino é sempre
novo, irmão do pacote de entrada; o prefixo `tmp/` da interface é mantido,
sem criar output dentro da árvore fonte. CLI só aceita versão/base/output/module
string primitiva, sem getters/hooks/argumentos de evidência ou hashes arbitrários.

Pins independentes fecham originais, referências, licenças e 11 imports
transitivos. O bootstrap checa fontes executáveis **antes de importá-las**.
`source/BUILD-CLOSURE.json` registra **hashes reais de todos os 19 arquivos de
suporte/launcher**. O novo packager possui pin de seu código normalizado,
removendo exclusivamente o literal de seu próprio pin: esse pin é calculado
antes do build, não depende de output/inventário e não gera ciclo de hash.
Seu SHA-256 real também é registrado no closure/inventário. O finalizer
reconstrói todos os bytes esperados dos inputs pinned, sem aceitar o closure
ou inventário do caller como autoridade. Notices e linkage são textos/estruturas
canônicos do gerador trusted, não meros hashes autodeclarados.

Isso não é assinatura digital: troca maliciosa de **toda** a raiz de confiança
exige comparar com finalizer/launcher original confiável ou digest independente
do pacote. Hashes autoinseridos em um pacote inteiramente substituído não
autenticam autoria. Tamper de licença/notice/fonte/linkage/runtime/controle ou
arquivo extra, **mesmo com inventário rehashed**, é recusado pelo finalizer
original e pelo launcher original com fontes intactas.

Inventário exclui ele próprio e host-config para evitar ciclo; host-config fixa
o hash do inventário e ambos são verificados por comparação canônica exata.
Limites: **500 arquivos, 10 MiB totais, 64 KiB inventário**; recusados links
simbólicos, junctions, hardlinks, caminhos inseguros e outputs existentes.
Metadados não incluem timestamps de execução, paths privados ou defaults de
host; somente base/version explícitos mudam bytes. Duas versões diferem apenas
nos dois XML (runtime/preferred), ADAPTATION, adoption-plan, inventário e host-config,
e no mapa por registrar o hash dos XML completos (mesmo ranges sem versão).

`runDocumentationSourcePackageTests()` é exportada e deve ser **awaited** pelo
runner; importar o teste não agenda testes nem lê/escreve filesystem. O modo
default é portável: **quatro grupos**, pins/build sources locais e fixtures
sintéticas próprias, sem `../CAMAP2`, inputs `tmp`, npm ou fontes upstream
embutidas. Não depende deste documento como input. Seu closure executável é o
mesmo dos scripts mais o próprio teste e bibliotecas Node; o contributor deve
incluir esses caminhos exatos e as licenças/notices indicadas no build profile.

`--local-build` é obrigatório para integrar fontes externas aprovadas. São
**16 grupos** no total: byte equality do overlay, contrato XML/24 campos,
render comparativo em Node, reconstrução isolada **de todos os arquivos**,
rebuild isolado **das duas versões**, mapa completo/ranges/anchors/hashes,
links de licença/ponte scoped, rehash malicioso, pre-import rejection,
Map/Buffer/args inertes, limites e links.
Não são testes DOM/browser, UX, direitos globais ou aceite operacional de site.

## Resultados locais desta entrega 0.5.x

> **Reauditoria independente do coordenador:** gate técnico específico de
> fontes/notices passou nos dois finais, sem aprovação jurídica/global.
> Ressalva explicativa: o fragmento `canonicalXML` do mapa afirma incorretamente
> diferença de ordem entre XML e schema JS perto de `showNoArticles`; a ordem é
> igual, conforme confronto completo do XML contra os exports reais. Não altera
> o contrato ou runtime; corrigir o texto em eventual nova versão, preservando
> os pacotes imutáveis. A conferência adicional dos candidatos com base do site
> é separada da revisão dos finais neutros.

- `node tests/documentation-source-package.test.js`: **4 grupos passaram**.
- `node tests/documentation-source-package.test.js --local-build`:
  **16 grupos passaram**, sem skips/falhas; rebuild isolado das duas versões.
- Ambos os finais: **57 arquivos, 55 payloads, 920.790 bytes**;
  inventário **11.117 bytes**. Mapa **361.658 bytes**, cobrindo **24 campos,
  23 funções, 67 ocorrências de seletores, 13 executáveis suporte/launcher**.
- Rebuild por launcher offline para `tmp/documentation-adapt-agent-source-final-rebuilt-050`
  e `tmp/documentation-adapt-agent-source-final-rebuilt-051`: **todos os 57 arquivos
  byte a byte iguais**. Runtime comparado diretamente com os finais 040/041:
  todos os comentários/algoritmos iguais, apenas versão XML substituída.
- Snapshot independente antes/depois: **124 pacotes Documentation 0.3.x/0.4.x,
  7.756 arquivos preservados byte-idênticos**. Nenhuma licença original alterada.

| Versão | Novo output neutro | SHA-256 do inventário |
| --- | --- | --- |
| 0.5.0 | `tmp/documentation-adapt-agent-source-final-050` | `324e604a9519d476fedfcf4f018ae5ba09652767436dcedf4f056edc3ceacb51` |
| 0.5.1 | `tmp/documentation-adapt-agent-source-final-051` | `8e507b59ce37a3c202053bf0ca600ce177bf60fb9e0979bc405f2ae257020660` |

Mapa 0.5.0 SHA-256:
`7ad2d55432bbecfaa780fa9992f8f77734415002bb327079a249435948a80b2b`.
Mapa 0.5.1 SHA-256:
`04f06ef982b5804188be7820360af0b6c24e7db1ff172ffe8b08bfea0c07eefa`.
Packager real incluído:
`1bc06d9ad8f4e07cee22b947bcd2d0da42f32c3d93d21ddc97817e8a30e07ff8`.
Pin normalizado do packager:
`f03d66e8331e4a1ddd58c69f927bb1a71413f10925b25f46a031fa9c7370df64`.
Build closure comum:
`ea35ba428f14e14da22c002e01a970b5c4e5eae250af55b221b2e1c20d3d13ca`.

Resultados locais: `tmp/documentation-source-050-final-results.json`;
snapshot de preservação: `tmp/documentation-source-050-preservation-before.json`.
Nenhuma operação de site, push, upload, navegador, tenant ou rede executada
por esta implementação. Leitura HTTP upstream foi evidência recebida do coordenador.

### Registro histórico preservado: entrega 0.4.x

Os resultados abaixo pertencem à implementação anterior; seus pacotes e
launcher originais continuam intactos e não são regenerados pelo perfil 0.5.x.

- `node tests/documentation-source-package.test.js`: **4 grupos passaram**.
- `node tests/documentation-source-package.test.js --local-build`:
  **14 grupos passaram**, sem skips ou falhas.
- Checkout isolado em `tmp/documentation-upstream/portable-checkout`, somente
  cadeia local e teste, **sem CAMAP2/npm/inputs tmp**: quatro grupos passaram.
- Ambos os outputs finais: **54 arquivos, 52 payloads, 509.374 bytes**;
  inventário **10.597 bytes**. Rebuild por launcher offline das duas versões
  comparou **todos os 54 arquivos byte a byte**, sem diferenças.

| Versão | Novo output neutro | SHA-256 do inventário |
| --- | --- | --- |
| 0.4.0 | `tmp/documentation-adapt-agent-source-final-040` | `ab432e587b8586949c9a77dd9003efeecd15d8a30d9322624d0692b29d3435ab` |
| 0.4.1 | `tmp/documentation-adapt-agent-source-final-041` | `6639498449aacfaa071183d0c31eb7f40d4af925e2f9374ac87ff6dbdf05ad68` |

SHA-256 real do packager incluído:
`d43859e4cae1b36edb13abeef763ad1cbae21a52136e5e78edd56b308faf91ac`.
SHA-256 real do build closure comum:
`23751c6b52f14df6e043a01559724e98ddc5c55ca1d7e9b68874fc008f11668f`.
Resultados detalhados somente locais em
`tmp/documentation-upstream/final-results.json`. Nenhuma operação de site,
commit, push, upload ou navegador foi feita por esta implementação.

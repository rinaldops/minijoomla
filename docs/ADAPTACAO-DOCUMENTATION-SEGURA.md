# Documentation: adaptação local segura

> **Nota de retomada:** este documento registra o perfil privado histórico
> 0.3.x. O ciclo posterior identificou o vínculo GPL upstream e materializou
> 0.5.x com notices/fontes/mapa explícitos, após reprovar o mapa incompleto de
> 0.4.x. [Perfil novo](PROVENIENCIA-DOCUMENTATION.md). Os anteriores não mudaram.
> Testes no site foram retestados; consolidação do aceite final ainda pendente.

> **Estado histórico 0.3.x:** testes/build/auditoria somente locais; nenhum asset
> Documentation carregado no site. Notices/atribuições/fonte upstream Phoca/Joomla
> ainda pendentes, e pacote final/navegação/formulário/teclado não aceitos no site.
> [Ciclo, consulta de worktrees e critérios de retomada](CICLO-DOCUMENTATION-ISOLADO.md).

Perfil isolado de `camap.mod_documentation`, versões **0.3.0 / 0.3.1**. O builder altera apenas uma cópia privada de três fontes, nunca o CAMAP2 original. Não configura raízes do host, não instala extensões, não publica, não acessa rede, navegador ou tenant e não reescreve registros salvos.

## Resultado e limites

- **24 campos originais**, na mesma ordem, com defaults, tipos, opções e restrições preservados.
- **3 patches**: `extensions/camap/_shared/render.js`, `extensions/camap/mod_documentation/module.js` e `extensions/camap/mod_documentation/documentation.css`.
- Fechamento: **5 arquivos de runtime, 11 payloads inventariados, 13 arquivos totais**. O inventário e o `host-config.json` gerado são controles privados do pacote, não mudanças na configuração do projeto.
- Snapshot offline: **56 fontes / 175 arquivos de dependências**. Importação do gerador/API confiáveis relocados não é sandbox; nenhuma instalação de dependências ocorre.
- MiniJoomla **0.15.0**, Cassiopeia, três estilos, 48 registros e oito raízes permanecem fora do escopo de escrita. Sua validação no site pertence ao coordenador.
- `rightsApproved`, `publicationApproved`, `migrated`, `tenantModified`, `hostConfigured` e `currentRecordsModified` permanecem `false`.

## Contrato original preservado

| # | Campo | Tipo e restrições originais | Default |
|---:|---|---|---|
| 1 | `view` | enum `categories`, `category` | `categories` |
| 2 | `title` | string, 160 | `Documentação` |
| 3 | `showPageHeading` | boolean | `false` |
| 4 | `pageHeading` | string, 160 | `Documentação` |
| 5 | `showBaseDescription` | boolean | `true` |
| 6 | `baseDescription` | string, 2000 | `''` |
| 7 | `categories` | array | `[]` |
| 8 | `maxLevelCategories` | number, min -1 / max 10 | `-1` |
| 9 | `showEmptyCategoriesCat` | boolean | `false` |
| 10 | `showSubcatDescCat` | boolean | `true` |
| 11 | `showCatNumArticlesCat` | boolean | `true` |
| 12 | `activeCategoryId` | string, 120 | `''` |
| 13 | `showCategoryTitle` | boolean | `true` |
| 14 | `showDescription` | boolean | `true` |
| 15 | `showDescriptionImage` | boolean | `true` |
| 16 | `showCatTags` | boolean | `true` |
| 17 | `maxLevel` | number, min -1 / max 10 | `-1` |
| 18 | `showEmptyCategories` | boolean | `false` |
| 19 | `showSubcatDesc` | boolean | `false` |
| 20 | `showCatNumArticles` | boolean | `true` |
| 21 | `showNoArticles` | boolean | `true` |
| 22 | `rootLabel` | string, 120 | `Categorias` |
| 23 | `rootHref` | string, 300 | `#documentacao` |
| 24 | `pagination` | object | `{}` |

O XML completo foi capturado do `createXml` do gerador original SHA-pinned, não composto por atributos presumidos. A função `documentationAdaptationXml(version)` valida o hash do fixture completo e substitui apenas o elemento de versão. O teste do builder real compara novamente todos os bytes gerados, além de validar os parâmetros pelo parser existente. Atributos extras, aliases, defaults, opções, tipos e novas restrições são rejeitados mesmo com inventário recalculado.

## Renderização inerte e árvore

Os dados de `context`, `settings`, categorias, artigos e paginação devem ser objetos plain com propriedades próprias de dados. Arrays devem ter protótipo nativo, índices próprios densos e nenhum accessor/símbolo/propriedade extra. Getters, funções, `toString`, `valueOf` e `toJSON` do chamador não são executados. Isso não é proteção contra Proxy ou intrínsecos globais previamente alterados.

Limites fixos de recurso **somente no runtime**, sem novas restrições persistidas:

- Cada array: até **500** posições; o comprimento é examinado **antes** de enumerar descritores.
- Categorias: até 500; artigos agregados de todas as categorias: até **500**.
- Até **10.000** chaves próprias inspecionadas e **1.000.000** unidades UTF-16 de strings consumidas por chamada.
- Profundidade original de renderização: **20**. Valores finitos fracionários de `maxLevel` mantêm o decremento original; não se adiciona truncamento automático dos parâmetros.
- Exceder limites agregados invalida a árvore, sem render parcial arbitrariamente truncado; linhas individualmente inválidas são omitidas. Dados armazenados não mudam.

IDs de dados aceitam strings não vazias após trim ou números primitivos finitos, convertidos explicitamente. `parentId` ausente, `null` ou string em branco indica raiz. Pais ausentes da lista continuam promovendo órfãos a raízes, na ordem original. Título de categoria inválido/vazio usa o ID válido; título de artigo deve ser string não vazia. ID de artigo continua opcional.

**Correção central:** o original criava `Map` com last-writer-wins para IDs duplicados, promovia self-parent a raiz e permitia selecionar por `activeCategoryId` um ciclo escondido da view `categories`. Isso repetia ramos até o teto de profundidade. Agora:

1. IDs duplicados após normalização rejeitam **toda a árvore ambígua**, em ambas as views.
2. Self-cycles, ciclos transitivos e todos os descendentes cuja ancestralidade entra em ciclo são removidos de `byId` **antes** da seleção ativa.
3. Raízes válidas permanecem estáveis. Uma seleção cíclica retorna **“Categoria não encontrada.”**, sem exceção ou ramo repetido.

Artigos com `published` ausente/`undefined` continuam publicados; `true` inclui e `false` exclui. Flags explícitas inválidas, como `null` ou strings, omitem a linha conservadoramente, **não** recebem conversão persistida para false. `numItems` conserva contagens pré-computadas finitas não negativas, inclusive strings decimais estritas, com floor; valores inválidos, ausentes, negativos ou `null` usam a quantidade de artigos normalizados. Não é contador vivo dos artigos publicados. Tags aceitam apenas strings próprias, aparadas e não vazias.

UI strings explícitas inválidas ficam vazias; booleans explícitos só ativam com `true`; propriedades ausentes usam defaults originais. Nenhuma chave desconhecida é migrada/removida. Um teste separado de admin confirma que alterar `enabled` preserva os bytes originais de `settingsJson`, inclusive linhas inválidas e chaves futuras.

## URLs, mídia e navegação visual

Reutiliza-se **exatamente** o `SAFE_URL_SOURCE` do Editorial: fragmentos, caminhos server-relative não protocol-relative e HTTPS sem credenciais, com rejeição de espaços, controles, backslashes e evasões percent-encoded. Não há coerção arbitrária de objetos.

- Hrefs inválidos de categoria/artigo mantêm o texto **sem link**, nunca recebem um anchor de fallback.
- Voltar com href inválido mantém ícone/label em `<span>`, não restaura URL default. O default `#documentacao` só se aplica quando não há override próprio.
- Imagem exige HTTPS/server-relative e **nenhum fragmento**; mídia inválida é inteiramente omitida, sem `src=""`, data URL ou blob.
- Paginação recebe `page` / `totalPages` primitivos finitos ou strings decimais estritas, floored para pelo menos 1 e dentro do intervalo de inteiro seguro; magnitudes fora desse intervalo usam 1, sem objetos ou notação numérica permissiva. Links prev/next inválidos ou `#` não geram anchors; o contador continua independente.
- Categorias, artigos, tags, links e paginação são **pré-computados pelo host**. Não se adicionou Joomla Pagination, PHP, plugin Phoca, fetch, backend, datasource ou conexão automática com parâmetros/componentes.

Exemplo neutro de categoria: `#/category/blog?layout=list`; artigos podem receber `#/article/local`, paginação `/local/prev` / `#/local/next`. Esses destinos ilustram dados passados pelo host, não prometem rotas/backends implementados. Labels históricos, headings h1/h2 e ícones inline originais são preservados; o original não tinha IDs globais nesta extensão e não se reivindica uma correção de IDs.

## CSS: análise → correção → validação

O CSS original tem **277 linhas**, já com raiz correta e paleta local. Não recebe remapeamento legado. Mantém-se cada byte original e adiciona-se apenas o append exportado `DOCUMENTATION_CSS_APPEND`:

- `overflow-wrap:anywhere`, container inline-size e grid com `minmax(min(16rem,100%),1fr)`.
- `min-width:0`, `max-width:100%` e border-box em cartões, títulos/links, listas filhas, descrições e tags.
- Wrap de títulos/artigos/voltar/paginação, pager flex limitado e UL filho com flex-basis 100%.
- Focus azul 3px inset nos links, branco no botão azul de voltar.
- Em container **≤400px**: uma coluna; cartões aninhados sem padding/bordas exceto borda esquerda de 1px; ULs aninhados sem margin-left.
- Depois do container query, relief **em todas as larguras**: ULs aninhados sem margin-left; itens dentro de pelo menos duas listas filhas recebem `padding:.5rem 0` e borda esquerda de 1px `#e3e9ed`. Mantém o ritmo vertical e uma indicação de ancestralidade, mas não acumula padding/recuo horizontal em 20 níveis. Padding externo, fontes, cores e conteúdo permanecem; nenhum texto é escondido ou elidido.
- Por último, **cartões aninhados em todas as larguras** recebem padding 0 e nenhuma borda exceto esquerda de 1px. O container externo pode ser largo enquanto cada coluna de um grid multi-raiz é estreita; o query externo ≤400 não detectava esse caso. Cartões raiz mantêm o padding original. O texto completo de `corrected-deep.css` aprovado pelo coordenador é prefixo byte-exato do append, seguido apenas dessa regra adicional.

O coordenador reportou o original nas duas views com raízes 180/320/768/900 e cadeia de seis níveis: overflow de módulo **3166px** na grade e **2536px** na categoria, entre outros elementos. Seu probe CSS inicial passou oito casos sem overflow de raiz nem texto por Range. A cadeia de **20 níveis** expôs largura zero de links/textos na view `category` em 180/320/768, embora 900 passasse: a correção apenas ≤400 não bastava. A revisão posterior identificou o caso **multi-raiz**: três cadeias de 20 níveis, 60 cartões, em colunas estreitas dentro de módulo largo. `corrected-deep.css` ainda falhava em 768/900 (scroll 810/1029, texto de cartões profundos com largura zero). O append **byte-idêntico a `corrected-final.css`** adiciona relief de cartões aninhados em todas as larguras. Segundo o recibo final do coordenador, **todos os oito casos** das duas views em 180/320/768/900 passam, `moduleScroll == width`, `rangesbad[]`, 60 cartões preservados. O agente **não usou navegador**; esse é recibo reportado pelo coordenador, não uma medição própria ou autorização legal. O teste local confirma AST original + append exato, igualdade byte-exata ao receipt CSS quando disponível, e preservação do HTML das três árvores de 20 níveis. Não se confunde ausência de scrollbar com texto efetivamente visível por Range.

## Proveniência e gate de direitos

Comparação somente leitura de quatro blobs em `124ac3ea1d002fe7dc517a7d03513d1238396dac` confirmou bytes locais normalizados LF iguais para as três fontes e `LICENSE` do agregador. O aviso MIT original completo é copiado verbatim para `docs/licenses/CAMAP-ROOT-MIT.txt`; o GPL completo SHA-pinned do projeto fica em `docs/licenses/GPL-2.0.txt` para **mudanças autorais da adaptação apenas**.

**Isso não prova que todo o material Phoca é MIT.** Os headers originais dizem “Port fiel” / “Port visual” de Phoca. A leitura de `../CAMAP2/PHP/phoca/README.txt` identifica overrides Joomla 4; o header de `copy_to_TEMPLATES-YOURTEMPLATE/html/com_content/categories/documentation.php` atribui Open Source Matters e declara **GPL version 2 or later**. Esses headers são evidência de uma segunda camada de origem, não uma conclusão jurídica inventada sobre todo o pacote.

A revisão independente final confirmou que os pacotes locais ainda não
materializam os copyrights upstream específicos nem seu mapa de derivação.
Layouts identificam OSM 2006/2009/2010; o CSS identifica OSM/Jan Pavelka com
GNU/GPL e referência a LICENSE.php sem versão expressa. A cópia local não traz
os LICENSE.php/LICENSE.txt referidos. Falta vincular o texto/licença aplicável
e as fontes correspondentes ao material selecionado. Conservar o MIT como
evidência histórica, não como licença presumida de todo o derivado. Ver critérios
concretos em [CICLO-DOCUMENTATION-ISOLADO.md](CICLO-DOCUMENTATION-ISOLADO.md).

O header de `copy_to_MEDIA/com_phocadocumentation/css/main.css` também atribui **Open Source Matters / Jan Pavelka** e declara **GNU/GPL**. Não se distribuem PHP, templates Phoca, assets SVG externos ou o diretório de referência. Ainda assim, antes de qualquer distribuição/publicação, a revisão independente deve verificar a derivação efetiva, atribuições, avisos completos e eventual fonte correspondente exigidos para o material Phoca/Joomla selecionado. `upstreamRightsReviewRequired: true` e os gates false tornam essa pendência explícita. MIT do agregador + GPL das mudanças próprias **não** significam clearance global, titularidade presumida dos ícones ou relicenciamento integral do fornecedor. Os pacotes de 13 arquivos aqui são artefatos **locais privados**, não prova concluída de elegibilidade para distribuição. Um eventual fechamento legal diferente exigirá decisão explícita do coordenador; não se amplia a árvore de fontes automaticamente.

## Comandos estáveis e recibos

```powershell
node tests/documentation-adaptation.test.js
node tests/documentation-adaptation.test.js --local-build
node scripts/prepare-documentation-adaptation.js --base /offline/documentation/0.3.0 --output tmp/documentation-adapt-agent-new-030 --version 0.3.0
node scripts/prepare-documentation-adaptation.js --base /offline/documentation/0.3.1 --output tmp/documentation-adapt-agent-new-031 --version 0.3.1
```

Sempre usar destino **novo** `tmp/documentation-adapt-agent-*`; overwrite, junction/symlink, overlap, módulo/versão diferente, callbacks ou hashes configuráveis são recusados. Source/dependency override só é permitido se corresponder à cópia confiável original. Inputs são rechecados antes/depois; as ferramentas existentes são copiadas byte-identical, não editadas.

Exports para integração pelo coordenador:

- `runDocumentationAdaptationTests()` — **26 casos portáveis**, sequenciais e aguardados; não agenda testes ao importar.
- `auditDocumentationAdaptationPackage(directory, version)` — auditoria local read-only, integridade, reconstrução reprodutível e file-port discovery; não executa JS arbitrário do pacote.
- CLI `--local-build` — **27/27** testes no ciclo final deep-relief: os 26 portáveis mais builder real de duas versões, AST CSS, preservação de fontes/deps/API/licenças e recusa de overwrite/override adaptado. Inclui **53 negativos de Map** e guards de Buffer/metadados sem executar hooks.

Pacotes privados estáveis do ciclo:

| Versão | Diretório | SHA-256 do inventário |
|---|---|---|
| 0.3.0 | `tmp/documentation-adapt-agent-tests-ROrDHp/0.3.0` | `085162880e95a7b378c186e8f40c2cec0a01aba70dab9e25721a29cf8db7ba5f` |
| 0.3.1 | `tmp/documentation-adapt-agent-tests-ROrDHp/0.3.1` | `2835ba4e36bfee25503201b67d9cba02feb01f775da5753c004c423bb15bcad3` |

Hashes gerados LF: helper `e6d967556bb4c36db272c967205977b8a9947fadb093819ce069802c91e29c76`; módulo `a79ee923b8152e1a3563e7baaee98d70356e8d76611c38877e62b7e48cbdf7b9` (**22948 bytes**); CSS `062b19ac80d014ba2bc2d95313333d227a1af8f21f07d5c60afa5ec39cbff22e` (**7298 bytes**). Raw/LF/BOM/lengths, três mudanças e snapshots constam em `ADAPTATION.json`. Todos os outputs anteriores, inclusive `tmp/documentation-adapt-agent-tests-gNjEFh`, `tmp/documentation-adapt-agent-tests-F77Lwc` e `tmp/documentation-adapt-agent-tests-wWJHEF`, não foram sobrescritos; são históricos privados anteriores ao fechamento final e **não devem ser usados como candidatos finais**. O último ajuste do módulo exige inteiros seguros para os números de paginação, sem alteração de schema.

```powershell
node tests/documentation-adaptation.test.js --packages tmp/documentation-adapt-agent-tests-ROrDHp/0.3.0 tmp/documentation-adapt-agent-tests-ROrDHp/0.3.1
```

Na frente isolada do builder não houve full npm, commit, instalação, publicação
ou alteração existente. Depois, o coordenador integrou os testes e a regressão
local passou em 93 suítes; o usuário autorizou commit/push do checkpoint de
desenvolvimento. O envio foi restringido à documentação: builder, fixtures com
fontes comprimidas e integração runner/contributor permanecem locais para não
publicar material ainda sem resolução upstream. Os comandos/exports acima
descrevem esse trabalho local, ausente do checkout remoto deste checkpoint.
Recibos de site/lifecycle, atribuições e revisão upstream continuam gates
distintos, não assumidos concluídos por esse envio. Pacotes privados e evidências
operacionais permanecem fora do Git.

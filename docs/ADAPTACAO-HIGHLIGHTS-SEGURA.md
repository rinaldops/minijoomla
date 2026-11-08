# Adaptação segura — CAMAP Highlights

> **Ciclo posterior executado pelo coordenador:** pacotes 0.3.0/0.3.1 publicados,
> Highlights adotado individualmente na 0.14.0, layouts e preservação conferidos.
> [Resultado e limites reais](CICLO-HIGHLIGHTS.md). As flags de preparação abaixo
> permanecem históricas; não representam a aprovação operacional separada.

## Resultado e limites

`scripts/prepare-highlights-adaptation.js` prepara exclusivamente
`camap.mod_camap_highlights`, versões `0.3.0` ou `0.3.1`, em uma pasta **nova**
`tmp/highlights-adapt-*`. É preparação offline, não instalação, aprovação jurídica,
migração, publicação ou validação visual do pacote real.

O perfil é fechado: não recebe funções de patch, código, hashes ou módulos
arbitrários. A política `SAFE_URL_SOURCE` é importada do builder editorial;
coletores limitados, fechamento de dependências, leitura e gravação exclusiva
também são reutilizados por exports aditivos. Nenhuma opção, fixture, metadata,
export existente ou comportamento do editorial foi alterado. As novas listas
exportadas são cópias congeladas, não referências mutáveis às listas privadas.

## Desenvolvimento → teste no site → análise → correção

O coordenador informou duas descobertas em inspeção somente leitura do site:

1. O CSS original usa `.camap-dt1`, mas o renderer original emite
   `.camap-highlights`; o estilo do módulo não alcançava o markup.
2. Apenas renomear as classes ativa o grid, mas o `h2` passa a ocupar a primeira
   célula e desloca os artigos. A correção adicional autorizada limita-se a
   `.camap-highlights--horizontal>h2{grid-column:1/-1}`.

Essas descobertas orientaram o patch CSS abaixo. Os testes desta entrega
verificam bytes, regras e AST real do CSS; **não** representam uma nova sessão de
navegador nem comprovam o ciclo nativo do pacote publicado. O coordenador mantém
a responsabilidade por teste visual, lifecycle, publicação e demais gates.

## Exatamente três patches no snapshot novo

| Fonte | Alteração autorizada |
| --- | --- |
| `extensions/camap/_shared/render.js` | Política estrita de URL já usada pelo editorial, sem cópia divergente |
| `extensions/camap/mod_camap_highlights/module.js` | `_validHighlightsItem` e `.filter(_validHighlightsItem)` antes do `.map` original |
| `extensions/camap/mod_camap_highlights/highlights.css` | Mapear `.camap-dt1` para `.camap-highlights` e acrescentar somente a regra de título de linha completa |

O CSS mantém todas as declarações originais, duas colunas horizontais e o
breakpoint `max-width:700px` com uma coluna. Não altera tema, `body`, identidade
global, cores, espaçamento, bordas ou cantos. O patch preserva BOM e terminações
originais no snapshot; o gerador original normaliza CRLF/CR para LF ao empacotar.

Permanecem iguais: chave, `defaults`, `settingsSchema` versão 1, os três campos
XML `title` (texto, `''`), `layout` (enum, `'auto'`, opções horizontal/vertical/auto)
e `items` (JSON array, `[]`), `escapeHtml`, `stateMessage` e estrutura do renderer.
O único novo export do renderer é `_validHighlightsItem`.

`auto` usa **width do contexto**, não largura inferida do viewport: 0 e 759
resultam em vertical; 760 resulta em horizontal. Sem width fornecido, o default
original é 0 e o resultado é vertical. Não se reescreve o campo exportado/UI para
compensar a ausência desse contexto. O breakpoint CSS de 700px é independente.

## Validação de itens e URLs

- Aceita somente objetos plain próprios (`Object.prototype` ou prototype null).
- `title` deve ser string própria não vazia após trim; o valor não é modificado.
- `description`: ausente, null ou string. `url`: ausente ou string.
- Accessors próprios, inclusive em campos extras e símbolos, rejeitam a linha;
  descriptors são inspecionados sem chamar getters ou coerções dos campos.
- Não sanitiza/regrava JSON persistido; linhas inválidas são ignoradas somente
  no render. Edição administrativa não relacionada preserva settings e chaves
  desconhecidas. Isso não constitui sandbox para proxies hostis.
- URLs aceitas: fragmentos, caminhos server-relative não protocol-relative e
  HTTPS sem credenciais. Rejeita protocolos inseguros, barras invertidas,
  whitespace/control characters e bypasses percent-encoded/multicodificados.
  Preserva os bytes da URL segura; link inseguro vira `#`. URL ausente/vazia
  continua sem link conforme o renderer original.
- Saída mantém texto escapado e links; não introduz imagens, iframe ou backend.

## Evidência original e licenças

Conferência local somente leitura com os blobs Git do agregador no commit
`124ac3ea1d002fe7dc517a7d03513d1238396dac`: módulo, helper, CSS e LICENSE
atuais coincidem com os históricos após **somente** CRLF/CR → LF. BOM é relevante.
Não se usa README, e-mail, URL corporativa ou caminhos absolutos como metadata.

| Fonte original | SHA-256 atual bruto | SHA-256 LF / blob histórico |
| --- | --- | --- |
| highlights `module.js`, 1070 bytes | `b33ce70f8e3a12c422dec6a0540429dd4657d2421ffd3bf0f35a053733a52872` | `64b687c2bb0781652f217992a4df063af65bb549695859d767a27bb5b7ff3af2` |
| highlights `highlights.css`, 252 bytes | `50bb64f94cc5b9ffdf19aba6f84a230aac19eb1723c6ee55e0e9457f82e32e27` | `e9f8bc83be5b485a545c72a93f8417f1c0d58eca3acfbae099ad30923cdb8ab7` |
| `_shared/render.js`, 654 bytes | `fd6166e3e3ef13253d4cab93f38d098b1d373548233fea27b727fef42a48795e` | `33a925627f241ae6ed379ddaea89a53acfa24cbe91819aa36c1d0ba08aec5387` |
| LICENSE MIT do agregador, 1102 bytes | `9f855c789f6d1bd404f856ea7c3e7af498e0ee2cc1e842a47ed2559cac09a1a9` | `7e9fc2fab3b2511d64d64c1e0f00fc6a9b920801f3de8e608117ff1000200b7c` |

| Fonte modificada | SHA-256 snapshot atual | SHA-256 empacotado LF |
| --- | --- | --- |
| `_shared/render.js` | `ab6e32d2105d45cff15b9aa55777675d42b418494f09b114317ae19d945f6002` | `e6d967556bb4c36db272c967205977b8a9947fadb093819ce069802c91e29c76` |
| highlights `module.js` | `d0ce67a265190b20e9b67775dfbc74772d255911939e417a6f69d9d77d91433d` | `92f992b6a9dfbc0c53d638ba48f5474538aed92325a6df9507156ff2cdb4970f` |
| highlights `highlights.css` | `3bb32c33912aff5537763482d8e4296ba9a3963cb690b7ea2e102db96a5363ae` | `47ac128e928debc2460600c9e4aa3fdff5bb9201d1a9fb0d8d0e4661bb5198e8` |

O texto MIT completo e original é conservado verbatim em
`docs/licenses/CAMAP-ROOT-MIT.txt`, com escopo explícito às três fontes históricas.
O texto GPL completo existente em `docs/licenses/GPL-2.0.txt` é conservado
verbatim, SHA-256
`189b1af95d661151e054cea10c91b3d754e4de4d3fecfb074c1fb29476f7167b`.
SPDX `GPL-2.0-or-later` cobre apenas código/alterações autorais desta adaptação,
não atribui licença global ao vendor nem relicencia todo CAMAP.

## Isolamento, inventário e reprodução

O builder lê o snapshot inteiro antes de escrever e confere novamente os bytes
e diretórios originais antes da geração e materialização final. Limites:
500 entradas/arquivos, 10 MiB por coleção/pacote e 64 KiB para inventário.
Recusa symlinks/junctions, tipos não regulares, paths reservados, overlaps e
outputs existentes; arquivos novos usam `flag: 'wx'`. Overrides de origem ficam
sob `tmp` e devem coincidir com o snapshot CAMAP original normalizado; overrides
de dependências devem coincidir byte a byte com o fechamento offline aprovado.

O algoritmo gerador e os sete arquivos da API/imports estáticos são relocados
sem alterar seus bytes. O gerador precisa inventariar os onze módulos dentro do
snapshot privado; o pacote final **não** distribui módulos estrangeiros, mesmo
se corretamente inventariados. O finalizer aceita só os cinco payloads de runtime
selecionados, controles e avisos/licenças autorizados; valida wrapper, XML real,
schema, moduleKeys/moduleStyles, três patches e hashes aprovados de saída.

Na árvore local verificada: **56 fontes**, **175 dependências** no fechamento;
por revisão final, **11 arquivos inventariados + 2 controles = 13 arquivos**.
O inventário é formado em memória e `host-config.json` fixa seu SHA-256. O plano
e `ADAPTATION.json` mantêm `publicationApproved`, `rightsApproved`, `migrated`,
`tenantModified`, `hostConfigured` e `currentRecordsModified` em false.

```powershell
node --test tests/highlights-adaptation.test.js
node tests/highlights-adaptation.test.js --local-build
node --test tests/editorial-adaptation.test.js
node --input-type=module -e "const m=await import('./tests/highlights-adaptation.test.js'); await m.runHighlightsAdaptationTests();"
node scripts/prepare-highlights-adaptation.js --base /offline/highlights/0.3.0 --output tmp/highlights-adapt-new --version 0.3.0
```

A suíte portátil tem **12 casos** (sem checkout externo, parser instalado,
browser ou escrita), com fixtures originais SHA-pinadas antes dos imports via
data URI. `runHighlightsAdaptationTests` executa casos sequenciais e está
integrado ao runner; importar não agenda testes `node:test`.
`--local-build` acrescenta o 13º caso: duas revisões em novas árvores
`tmp/highlights-adapt-agent-tests-*`, parsers reais, audit de discovery/file-port
sem executar JS do pacote, recusa de overwrite e de reutilizar snapshot já
adaptado como origem original, estabilidade do hash e
imutabilidade das fontes. O coordenador gera separadamente destinos finais;
estas árvores locais não devem ser confundidas com publicação.

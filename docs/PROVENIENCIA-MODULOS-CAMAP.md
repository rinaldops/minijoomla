# Proveniência local CAMAP — primeiro editorial

Revisão somente local em 2026-11-07, sobre MINIJOOMLA
`f0c28093467b7efe5f79de67a84fbf071a5ff6ea`. Não publica, instala, altera
CAMAP2 ou concede direitos. Não é parecer jurídico.

## Conclusão delimitada

**Existe licença MIT na raiz real do agregador `../LICENSE`.** A ausência de
`../CAMAP2/LICENSE` não comprova ausência de licença para o código próprio dessa
subárvore. CAMAP2 é uma árvore comum do Git do agregador, não um submódulo nos
commits examinados; também não possui `.git` local. A licença da raiz estava
presente quando os dois arquivos de runtime do editorial foram introduzidos.

Isso oferece base documental para preparar a adoção do **editorial e helper
locais como código sob a declaração MIT do agregador**, limitada aos direitos
do titular desse aviso. Não se declara MIT para todo CAMAP2, nem se certificam
autoria exclusiva, aquisição upstream ou todos os direitos por existir esse
arquivo. O histórico Git registra introdução/manutenção, não prova originalidade.

`CAMAP2/package.json` declara `private: true`, mas não contém campo `license`;
`private` não é uma licença. O README informa preservação de implementações
legadas e não autoriza publicação remota. Nos caminhos raiz/intermediários,
editorial e helper foram conferidos apenas os nomes `LICENSE`, `LICENSE.md`,
`LICENSE.txt`, `COPYING` e `NOTICE`, todos ausentes abaixo de CAMAP2.

## Evidência reproduzível, sem identidades ou conteúdo privado

O agregador estava em `3f49a77db0760ffa7ca3c7d63fdba2f88d015f0a`.
Consulta restrita ao histórico local:

```text
git log --all -- CAMAP2/extensions/camap/mod_camap_editorial/module.js CAMAP2/extensions/camap/_shared/render.js
```

- `124ac3ea1d002fe7dc517a7d03513d1238396dac` (2026-11-02): introduz
  `module.js` e `_shared/render.js`. Ambos correspondem às fontes atuais após
  CRLF/CR → LF, preservando BOM. `git show <commit>:LICENSE` retorna MIT.
- `a71f1f6926912183aec2deda1f9b79891a80e583` (2026-11-04): altera esses dois
  arquivos, incluindo tratamento de URLs/configuração/itens; contém o mesmo
  `LICENSE`. **Não corresponde às fontes atuais**; não foi aplicado nem adotado
  silenciosamente. A existência dessa revisão não corrige o pacote atual.
- `git ls-tree` dos caminhos exatos identifica os blobs originais atuais:
  editorial `a91f75e6bb73959006cdb9722a93076d73ad1a35`, helper
  `7e1f9a068d8ee8f2e236a4650f694fbaa60cfc23`, licença
  `c32140d07487f1113fa2d80873a86f81502606fa`.

Âncoras SHA-256; LF é a normalização de empacotamento, não alteração de origem:

| Arquivo local | Bytes | SHA-256 original | SHA-256 com LF |
| --- | ---: | --- | --- |
| `../LICENSE` | 1102 | `9f855c789f6d1bd404f856ea7c3e7af498e0ee2cc1e842a47ed2559cac09a1a9` | `7e9fc2fab3b2511d64d64c1e0f00fc6a9b920801f3de8e608117ff1000200b7c` |
| `../CAMAP2/extensions/camap/mod_camap_editorial/module.js` | 1577 | `d3aee88f668b7104a40284c3cca83759b11af4dd0d1098f0a4460034e217df7f` | `91e90509b75450299968695f420857771ddac4b0fcd7702b8fc8a65ef80027a5` |
| `../CAMAP2/extensions/camap/_shared/render.js` | 654 | `fd6166e3e3ef13253d4cab93f38d098b1d373548233fea27b727fef42a48795e` | `33a925627f241ae6ed379ddaea89a53acfa24cbe91819aa36c1d0ba08aec5387` |
| `../CAMAP2/extensions/camap/mod_camap_editorial/db.css` | 436 | `1deccd917dc17674d56e9172eb5a55c92a8148f3fb9ce8ce01f69e0e51401fdc` | `137767308e415745d591665bea090a1e58267646155998e71a6310874fd74fda` |

O editorial importa somente esse helper de três linhas. Nenhum dos dois contém
aviso de port ou dependência externa; isso não prova originalidade. O CSS não
importa assets. O wrapper/XML identifica `tools/sync-joomla-sources.js` como
gerador. A orientação do README e do comentário é editar `module.js` e gerar,
não tomar arquivos gerados como fonte preferida independente. Repetição da
verificação focal: `node tmp/camap-provenance-audit.mjs` enquanto existir a cópia
local; o script lê caminhos exatos, calcula hashes e não executa fontes CAMAP2.

## Onde a declaração da raiz não basta

Comentários locais explicitam outras origens: `mod_documentation/module.js:6-9`
declara port de Phoca Documentation/override Joomla;
`mod_showcase/module.js:4` declara port de Digi Showcase;
`mod_forum/module.js:6-8` e `mod_videoteca/module.js:4-6` declaram adaptações de
mse-platform. Não são dependências do grafo mínimo do editorial. Esses avisos
exigem conferência individual de origem, licença, avisos, assets e modificações
antes de adotar tais módulos; nesta revisão não se inspecionaram seus upstreams.
Ausência de comprovação não é conclusão de uso ilícito.

`LICENSE.md` do MINIJOOMLA declara GPL-2.0-or-later apenas para seu código
original e preserva direitos/avisos de terceiros. Não pode ser usada para
atribuir GPL a CAMAP2 inteiro. [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)
registra pendências separadas de proveniência e fonte correspondente/build para
o subconjunto TinyMCE; isso não foi reauditado aqui. Selecionar o editorial sem
esses arquivos não audita nem aprova uma distribuição maior que os inclua.

## Gate para preparação e publicação

- **Preparação local do primeiro módulo:** não bloquear somente pela ausência
  de licença dentro de CAMAP2. Registrar a MIT da raiz e seu escopo limitado,
  manter hashes/fontes preferidas e copiar integralmente o aviso original MIT,
  incluindo copyright, para cópias/porções substanciais distribuídas. O titular
  consta do arquivo original; esta nota não o substitui nem transcreve dados
  pessoais. O CSS e os arquivos gerados têm evidência local, mas não tiveram
  história individual ampliada nesta revisão.
- **Correções novas próprias:** identificá-las como adaptações separadas,
  documentar diferenças e manter o aviso da origem. A GPL-2.0-or-later escolhida
  para código próprio MINIJOOMLA não apaga a MIT da origem nem licencia materiais
  alheios. Vendor permanece inalterado, com seus avisos; nenhuma licença nova foi
  atribuída nesta tarefa.
- **Publicação corporativa com confiança:** esta nota sozinha **não fecha o
  gate**. Conferir o pacote efetivamente selecionado, inclusão do aviso MIT,
  escopo de direitos sobre qualquer material adicional/dados e testes das
  correções de segurança. Os bloqueios técnicos registrados em
  [MODULO-EDITORIAL-XML.md](MODULO-EDITORIAL-XML.md) permanecem para a fonte
  original. Aprovação operacional do destino não equivale a permissão de
  terceiros; tampouco faltas documentais provam ilegalidade. Não há motivo
  documental aqui para impor uma nova licença ou exigir revisão indiscriminada
  de todo CAMAP2 como condição para preparar o grafo próprio mínimo.

O antigo `sourceLicensePresent:false` descreve ausência no local procurado/no
pacote preparado; não deve ser reinterpretado como inexistência da MIT do
agregador. Esta evidência nova não transforma `rightsApproved:false` em aprovação
global nem altera recibos históricos.

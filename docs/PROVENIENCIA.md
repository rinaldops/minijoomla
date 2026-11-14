# Proveniência — MINIJOOMLA

Este documento preserva, em um único lugar, a proveniência técnica e os **gates** necessários para:

1) o perfil **Documentation 0.5.0 / 0.5.1** (cadeia de derivação + rebuild offline com trust roots e pins);
2) a evidência local mínima do **grafo CAMAP (editorial)** quando preparado sob a **MIT da raiz do agregador**.

O objetivo aqui é ser **autossuficiente**: os detalhes abaixo devem permanecer suficientes mesmo se os documentos de origem forem removidos.

> Importante: hashes e byte-equality validam integridade e rastreabilidade técnica do material selecionado; **não** autenticam aquisição upstream nem substituem revisão jurídica. A licença principal do repositório também **não** autoriza automaticamente marcas, fontes tipográficas, ícones e demais assets de terceiros.

---

## Índice

- [1. Documentation 0.5.x — upstream, derivação, frozen-build e rebuild](#documentation-05x)
- [2. CAMAP — evidência local do editorial sob MIT do agregador](#camap-editorial)
- [3. Gates comuns e limites do que NÃO é certificado](#gates)

---

<a id="documentation-05x"></a>
## 1. Documentation 0.5.x — upstream, derivação, frozen-build e rebuild

### 1.1 Escopo do perfil

O perfil **Documentation 0.5.0/0.5.1** é um fechamento local que:

- materializa **referências upstream selecionadas** (PhocaDocumentation) com pins SHA-256;
- preserva notices/licenças com escopos separados (trabalho derivado, helper histórico MIT, parser ISC etc.);
- congela o suporte de build (frozen build support) sob `scripts/documentation-frozen-build/` para impedir mudanças implícitas por evolução do núcleo, checkout ou normalização de newline;
- gera um mapa derivacional `docs/DERIVATION-MAP.json` dentro de cada pacote final, com ranges e hashes;
- permite **rebuild offline** com Node>=24, sem npm/rede/PHP/browser.

As flags de aprovação continuam **false** (ex.: `rightsApproved`, `publicationApproved`, `vendorRightsCleared`).

### 1.2 Upstream selecionado (PhocaDocumentation)

Evidência de correspondência upstream estabelecida para o artefato e commit abaixo:

- Release ZIP (pinned):
  - URL: `https://github.com/PhocaCz/PhocaDocumentation/releases/download/6.0.0/phocadocumentation_override_v6.0.0.zip`
  - Tamanho: **19.075 bytes**
  - SHA-256: `96aa8d209cd1aefe9d08dae8a233d434e282d75759e6b17f51d597344d20555f`

- Commit upstream (TemplateOverride) usado como referência de blobs:
  - `f2386b6b935c82f0fa0d94881c144ef1d91af0f9`

As referências abaixo são relativas a `TemplateOverride/` e materializadas localmente sob:
`source/upstream/PhocaDocumentation/TemplateOverride/`.

| Referência upstream | SHA-256 |
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

Observações de escopo:
- PHP é tratado como **dado** (referência), nunca executado neste build offline.
- SVG/README são referência e comparação; diferenças de geometria no port local **não** provam direitos independentes sobre ícones.

### 1.3 Licença upstream (linkage materializado)

O literal da licença upstream foi materializado **sem newline final** e com pin:

- Origem: `https://raw.githubusercontent.com/PhocaCz/PhocaDocumentation/f2386b6b935c82f0fa0d94881c144ef1d91af0f9/LICENSE`
- Conteúdo literal esperado:
  - `GNU General Public License version 2 or later; http://www.gnu.org/copyleft/gpl.html`
- SHA-256 do literal materializado: `b8b2c2a80dbc38eb6b7c27ea374a5c0ead24449524671a65722f4ef4ade5c670`

### 1.4 Notices e escopos de licença (separação obrigatória)

No perfil Documentation, coexistem escopos distintos:

- **Trabalho derivado Documentation completo:** `GPL-2.0-or-later`.
- **Helper histórico MIT** (identidade/local): MIT (Copyright (c) 2026 Rinaldo Paulino de Souza) em escopo próprio; não é “licença upstream”.
- **Parser `@rgrove/parse-xml` 5.0.0:** ISC, com `LICENSE` e `notices.txt` preservados.

Pins do overlay/runtime (normalização LF usada apenas para empacotamento):
- helper LF: `e6d967556bb4c36db272c967205977b8a9947fadb093819ce069802c91e29c76`
- JS: `a79ee923b8152e1a3563e7baaee98d70356e8d76611c38877e62b7e48cbdf7b9`
- CSS: `062b19ac80d014ba2bc2d95313333d227a1af8f21f07d5c60afa5ec39cbff22e`

Pins do texto GPL v2 local (cópia byte a byte):
- `189b1af95d661151e054cea10c91b3d754e4de4d3fecfb074c1fb29476f7167b`

### 1.5 `DERIVATION-MAP.json` (formato e garantias)

O artefato gerado dentro de cada pacote final é `docs/DERIVATION-MAP.json` (formato `minijoomla-documentation-derivation-map-v1`).

Propriedades duráveis do mapa:
- referencia arquivos incluídos no pacote (caminho relativo),
- registra ranges de linhas **1-based inclusivas**, anchors literais,
- registra SHA-256 dos **bytes completos originais** e SHA-256 do trecho UTF-8 normalizado para LF,
- ranges/anchors são checados contra as fontes realmente incluídas,
- cobre campos XML (24 em ordem), funções runtime, seletores CSS (incluindo repetições), imports estáticos e relações de licença.

Mudança em default/função/selector/range/anchor/hash/relação de licença deve reprovar a comparação canônica prevista pelo finalizer/launcher.

### 1.6 Diferenças relevantes do port (não-equivalência Joomla)

Diferenças concretas preservadas pelo perfil (exemplos duráveis):
- defaults/schema locais não seguem automaticamente `useglobal` do CMS;
- limites de recursão e `HARD_DEPTH_LIMIT=20` local;
- paginação é objeto host-precomputado, não JPagination;
- ausência deliberada de ACL/access-view/show_noauth/publish_up/publish_down/state/datas Joomla no port;
- CSS não é “rename” do upstream: há seletor/layout próprios e referências parciais.

### 1.7 Rebuild offline (sem npm/rede/PHP/browser)

Criar pacote (no repositório MINIJOOMLA):

```powershell
node scripts/prepare-documentation-source-package.js --version 0.5.0 --base /offline/documentation/0.5.0 --output tmp/documentation-adapt-agent-source-new-050
node scripts/prepare-documentation-source-package.js --version 0.5.1 --base /offline/documentation/0.5.1 --output tmp/documentation-adapt-agent-source-new-051
node tests/documentation-source-package.test.js
node tests/documentation-source-package.test.js --local-build
```

Rebuild dentro de um pacote (de qualquer cwd):

```powershell
node source/rebuild.mjs --version 0.5.0 --base /offline/documentation/0.5.0 --output tmp/documentation-adapt-agent-source-rebuilt
```

Regras duráveis do rebuild:
- requer **Node >= 24**, sem npm/rede/PHP/browser;
- destino sempre **novo** (sem overwrite), como irmão do pacote de entrada;
- recusa links (symlink/junction/hardlink) e paths inseguros;
- valida entradas primitivas (version/base/output/module) sem getters/hooks;
- bootstrap checa fontes executáveis **antes de importá-las**.

Limites declarados:
- 500 arquivos, 10 MiB totais, 64 KiB inventário; recusados outputs existentes.

### 1.8 Trust roots, pins e por que isso não é “assinatura digital”

O perfil usa pins independentes para fechar:
- originais, referências upstream, licenças e imports transitivos;
- `BUILD-CLOSURE.json` com hashes reais dos executáveis de suporte/launcher;
- pin normalizado do packager (calculado removendo apenas o literal do próprio pin) antes do build.

Pins principais preservados (0.5.x):
- Packager real incluído: `1bc06d9ad8f4e07cee22b947bcd2d0da42f32c3d93d21ddc97817e8a30e07ff8`
- Pin normalizado do packager: `f03d66e8331e4a1ddd58c69f927bb1a71413f10925b25f46a031fa9c7370df64`
- Build closure comum: `ea35ba428f14e14da22c002e01a970b5c4e5eae250af55b221b2e1c20d3d13ca`
- Mapa 0.5.0: `7ad2d55432bbecfaa780fa9992f8f77734415002bb327079a249435948a80b2b`
- Mapa 0.5.1: `04f06ef982b5804188be7820360af0b6c24e7db1ff172ffe8b08bfea0c07eefa`

Inventários:
- 0.5.0: `324e604a9519d476fedfcf4f018ae5ba09652767436dcedf4f056edc3ceacb51`
- 0.5.1: `8e507b59ce37a3c202053bf0ca600ce177bf60fb9e0979bc405f2ae257020660`

> Importante: isso não é assinatura digital. Um atacante que substitua **toda** a raiz de confiança pode rehashar inventários internos. O modelo aqui é: “o finalizer/launcher original confiável recusa tamper mesmo com inventário rehashed”, mas autenticidade upstream e cadeia de custódia externa permanecem fora do escopo.

### 1.9 Resultados locais do perfil 0.5.x (evidência técnica)

- Outputs finais (ambos): **57 arquivos, 55 payloads, 920.790 bytes**.
- Inventário: **11.117 bytes**.
- Mapa: **361.658 bytes**, cobrindo 24 campos, 23 funções, 67 ocorrências de seletores, 13 executáveis suporte/launcher.

---

<a id="camap-editorial"></a>
## 2. CAMAP — evidência local do editorial sob MIT do agregador

### 2.1 Conclusão delimitada

Existe licença **MIT** na raiz real do agregador (`../LICENSE`) no histórico examinado. Isso fornece base documental mínima para tratar o **grafo mínimo** abaixo como material sob esse aviso MIT, **limitado** aos direitos declarados por esse aviso e ao material efetivamente introduzido sob ele:

- `../CAMAP2/extensions/camap/mod_camap_editorial/module.js`
- `../CAMAP2/extensions/camap/_shared/render.js`
- `../CAMAP2/extensions/camap/mod_camap_editorial/db.css`

Isso **não**:
- atribui MIT a todo CAMAP2;
- comprova originalidade/autoria exclusiva;
- fecha gates de `rightsApproved`/`publicationApproved`.

### 2.2 Evidência reproduzível (somente histórico local)

Contexto do agregador no momento da revisão:
- agregador em `3f49a77db0760ffa7ca3c7d63fdba2f88d015f0a`.

Consulta restrita ao histórico local:

```text
git log --all -- CAMAP2/extensions/camap/mod_camap_editorial/module.js CAMAP2/extensions/camap/_shared/render.js
```

Commits relevantes:
- `124ac3ea1d002fe7dc517a7d03513d1238396dac` (2026-11-02): introduz `module.js` e `_shared/render.js` sob a raiz com MIT.
- `a71f1f6926912183aec2deda1f9b79891a80e583` (2026-11-04): altera os dois arquivos, mas **não corresponde** às fontes atuais examinadas naquela revisão (não “aplicar silenciosamente”).

`git ls-tree` dos caminhos exatos identifica blobs originais (na revisão):
- editorial `a91f75e6bb73959006cdb9722a93076d73ad1a35`
- helper `7e1f9a068d8ee8f2e236a4650f694fbaa60cfc23`
- licença `c32140d07487f1113fa2d80873a86f81502606fa`

### 2.3 Âncoras SHA-256 (original e LF)

Normalização CRLF→LF (preservando BOM onde aplicável) foi usada apenas como convenção de empacotamento/igualdade; não é prova de origem.

| Arquivo | Bytes | SHA-256 original | SHA-256 com LF |
| --- | ---: | --- | --- |
| `../LICENSE` | 1102 | `9f855c789f6d1bd404f856ea7c3e7af498e0ee2cc1e842a47ed2559cac09a1a9` | `7e9fc2fab3b2511d64d64c1e0f00fc6a9b920801f3de8e608117ff1000200b7c` |
| `../CAMAP2/extensions/camap/mod_camap_editorial/module.js` | 1577 | `d3aee88f668b7104a40284c3cca83759b11af4dd0d1098f0a4460034e217df7f` | `91e90509b75450299968695f420857771ddac4b0fcd7702b8fc8a65ef80027a5` |
| `../CAMAP2/extensions/camap/_shared/render.js` | 654 | `fd6166e3e3ef13253d4cab93f38d098b1d373548233fea27b727fef42a48795e` | `33a925627f241ae6ed379ddaea89a53acfa24cbe91819aa36c1d0ba08aec5387` |
| `../CAMAP2/extensions/camap/mod_camap_editorial/db.css` | 436 | `1deccd917dc17674d56e9172eb5a55c92a8148f3fb9ce8ce01f69e0e51401fdc` | `137767308e415745d591665bea090a1e58267646155998e71a6310874fd74fda` |

### 2.4 Onde a MIT da raiz não basta

Outros módulos CAMAP têm avisos de origem upstream (Phoca Documentation, Digi Showcase, mse-platform etc.) e exigem conferência individual de origem/licenças/avisos/assets/modificações antes de qualquer adoção/distribuição. A MIT da raiz não deve ser usada para “absorver” automaticamente esses upstreams.

---

<a id="gates"></a>
## 3. Gates comuns e limites do que NÃO é certificado

- **Aprovação/clearance:** flags de aprovação permanecem **false** até decisão explícita.
- **Frozen/vendor:** tratar bytes vendorizados como imutáveis; não “corrigir” proveniência editando vendor.
- **Links/hardlinks/junctions:** staging/auditoria e rebuild recusam links e hardlinks; evitar qualquer cadeia que permita apontar para fora do escopo.
- **Privacidade/histórico:** zero candidatos em auditoria manifest-only não certifica histórico Git nem ausência de dados sensíveis fora do staging.
- **Marcas/assets/fontes:** licença do projeto não concede direitos de marcas (Joomla/Atum/Cassiopeia) nem de fontes tipográficas/ícones/artefatos de terceiros.

# Adaptação editorial segura — preparação local

## Resultado e limites

`scripts/prepare-editorial-adaptation.js` prepara **somente**
`mod_camap_editorial` em um diretório novo `tmp/editorial-adapt-*`.
Não altera CAMAP2, o núcleo, registros, piloto, pacotes anteriores ou outros
módulos. Não instala, publica, faz chamadas de rede ou inicia navegador.
Versão padrão: `0.3.0`; `0.3.1` exige uma segunda chamada/destino novo.

O builder reutiliza a API de `scripts/prepare-module-adoption.js` e o gerador
original CAMAP. Como essa API define seu próprio diretório temporário a partir
de `import.meta.url`, uma cópia **byte a byte**, junto com seis arquivos de seu
grafo estático, é colocada em um workspace privado. Assim, até seus snapshots
`adoption-agent-snapshot-*` ficam **dentro** de `tmp/editorial-adapt-stage-*`.
Não há fork do algoritmo, alteração no script existente ou parser por regex.
O roteamento em memória dos imports de dependências é o já suportado pela API.

O gerador original precisa preparar os onze módulos para selecionar o editorial.
Por isso o snapshot interno inclui as fontes necessárias de todos eles; o
pacote final contém exclusivamente o grafo mínimo editorial/helper/CSS,
wrapper/XML e avisos. Os demais módulos não são adotados nem distribuídos.

## Overlay restrito

Há exatamente dois arquivos permitidos:

| Fonte | SHA-256 original local |
| --- | --- |
| `extensions/camap/_shared/render.js` | `fd6166e3e3ef13253d4cab93f38d098b1d373548233fea27b727fef42a48795e` |
| `extensions/camap/mod_camap_editorial/module.js` | `d3aee88f668b7104a40284c3cca83759b11af4dd0d1098f0a4460034e217df7f` |

Também são aprovadas as respectivas variantes LF usadas pela fixture anterior:
`33a925627f241ae6ed379ddaea89a53acfa24cbe91819aa36c1d0ba08aec5387` e
`91e90509b75450299968695f420857771ddac4b0fcd7702b8fc8a65ef80027a5`.
Qualquer divergência dos bytes completos ou dos anchors exatos impede o patch.
Não existe parâmetro para aprovar hashes novos automaticamente.

As fontes locais têm BOM UTF-8 e **finais de linha mistos LF/CRLF**. Esses bytes
fora dos anchors permanecem intactos no snapshot. A normalização LF do pacote
é realizada pelo gerador original, não por uma reescrita geral da fonte.

### URLs

O helper adaptado usa `URL` com base fictícia, sem rede, para aceitar somente:

- fragmentos `#`, inclusive rotas locais;
- caminhos server-relative `/...`, nunca `//...`;
- URLs HTTPS absolutas válidas, sem credenciais ou marcador de userinfo.

Rejeita valores não string/vazios, espaços e controles internos ou nas bordas,
qualquer barra invertida, protocolos diferentes, caminhos relativos,
codificações de slash/backslash/controles e escapes percentuais inválidos.
A decodificação serve apenas para rejeição, com no máximo três passagens;
escapes ainda aninhados além do limite são recusados. O retorno seguro conserva
a string original, sem canonicalização ou trim silencioso.
O fallback também é validado uma única vez; se inseguro, retorna `#`.
Links de itens inseguros viram `href="#"`; CTA inseguro ou `#` não é exibido.

Esta é a política **desta adaptação**, não uma alteração nos validadores do
núcleo nem aprovação de todos os consumidores do helper. Embora outros módulos
usem o helper, seus pacotes existentes continuam intactos.

### Itens

O filtro de runtime aceita objeto simples, com título string não branco,
`url` ausente ou string e `summary` ausente, null ou string. Objetos com
accessors são recusados por descritores, sem invocar getters. Arrays, null,
escalares e tipos inválidos são descartados apenas da lista de renderização.
Não é sandbox para Proxies/código arbitrário: os settings persistidos continuam
sendo dados JSON sujeitos às fronteiras administrativas existentes.

O filtro antecede o `slice` original. Sem alterar a semântica histórica:
`limit: 0` usa fallback 3; negativo gera vazio; fração trunca; máximo 100.
`title`, `limit`, `items`, `catalogTarget`, labels, defaults, esquema versão 1,
markup, `escapeHtml`, `stateMessage` e CSS permanecem iguais.
Dados/itens inválidos e chaves desconhecidas **não são removidos do armazenamento**.

## Proveniência e licença delimitadas

A ausência de `CAMAP2/LICENSE` **não** demonstra ausência de licença. A evidência
em [PROVENIENCIA-MODULOS-CAMAP.md](PROVENIENCIA-MODULOS-CAMAP.md) identifica a MIT
da raiz do agregador no commit
`124ac3ea1d002fe7dc517a7d03513d1238396dac`.
Comparação Git local dirigida confirmou editorial/helper **e CSS** com as fontes
atuais após normalização exclusiva de finais de linha, preservando BOM.
O SHA-256 LF do CSS é
`137767308e415745d591665bea090a1e58267646155998e71a6310874fd74fda`.
O builder exige esses anchors e o hash aprovado do gerador original.

O aviso MIT original é lido de `../LICENSE` e copiado **integralmente, sem
reconstrução**, para `docs/licenses/CAMAP-ROOT-MIT.txt` no pacote final.
SHA-256 local: `9f855c789f6d1bd404f856ea7c3e7af498e0ee2cc1e842a47ed2559cac09a1a9`;
SHA-256 LF histórico: `7e9fc2fab3b2511d64d64c1e0f00fc6a9b920801f3de8e608117ff1000200b7c`.
Uma cópia explícita em `tmp/` pode ser passada por `--inherited-license`, mas
continua obrigada a corresponder a esses bytes/hashes. Nenhum outro ancestral
é procurado implicitamente. Não se fabrica LICENSE na raiz do pacote.

`inheritedLicenseSource` registra commit, origem lógica, hash e escopo dos três
arquivos. `sourceLicensePresent:true` significa que o aviso herdado verificado
está presente; `sourceRootLicensePresent:false` registra a ausência específica
na raiz CAMAP2. A MIT não é atribuída indiscriminadamente a toda a árvore.

GPL-2.0-or-later aplica-se ao builder, testes e alterações novas próprias.
O texto completo de `docs/licenses/GPL-2.0.txt` é copiado byte a byte para o
mesmo caminho no pacote, com SHA-256 aprovado
`189b1af95d661151e054cea10c91b3d754e4de4d3fecfb074c1fb29476f7167b`.
`changesLicenseSource` registra caminho/hash e escopo exclusivo das alterações
próprias. O aviso MIT e seu escopo permanecem separados e preservados.
Não apaga a MIT original nem licencia CAMAP2 inteiro. Os avisos separados não
declaram autoria exclusiva, parecer jurídico ou clearance de outros módulos.
`rightsApproved`, `publicationApproved`, `migrated`, `tenantModified`,
`hostConfigured` e `currentRecordsModified` permanecem false. O gate final do
pacote selecionado/material adicional e da operação cabe ao coordenador;
não se bloqueia a preparação apenas por falta de LICENSE dentro de CAMAP2.

## Snapshot, finalização e integridade

- Fonte padrão: CAMAP2 local confiável; override apenas em `tmp/` do worktree.
- Dependências offline padrão: `tmp/step2/camap-source`, separadas da fonte,
  snapshot e destino. Não instala dependências.
- Closure explícita: `es-module-lexer@1.7.0`, `css-tree@3.1.0`,
  `mdn-data@2.12.2` e `source-map-js@1.2.2`, com arquivos necessários selecionados.
- Coletores limitados a 500 arquivos/entradas e 10 MiB cada; sem cópia ampla,
  dist, PHP, dados, testes de módulos ou node_modules do vendor.
- Symlinks/junctions, tipos não regulares, caminhos inseguros, sobreposição e
  destino existente são recusados. Arquivos são escritos com `wx`.
- Bytes lidos e listas de diretório são novamente comparados antes da geração e
  antes de reservar o destino final, incluindo generator/API/deps/aviso MIT.
- A API prepara a versão intermediária sem sobrescrever nada. O builder forma
  os controles finais em memória e grava cada arquivo final uma única vez;
  não modifica pacotes finalizados ou versões anteriores.
- `ADAPTATION.json` guarda inventário de fontes, hashes original → snapshot →
  pacote, duas mudanças, gerador e API, sem caminhos privados absolutos.
- `ADAPTATION.json`, ambos os avisos e MIT fazem parte do inventário SHA-256.
  O texto GPL completo também é payload inventariado.
  O inventário não inclui a si próprio ou `host-config.json`; o config fixa os
  bytes do inventário por `inventoryHash`, conforme o contrato existente.
- O pacote sem LICENSE local tem **11 payloads inventariados / 13 arquivos**:
  cinco runtime/XML/CSS, dois avisos de adoção, dois de adaptação, um MIT,
  um texto GPL completo, mais inventário e config. Não se soma o aviso novo como licença global.

O finalizador exportado valida caminhos antes de aceitar qualquer inventário:
runtime somente em `modules/mod_camap_editorial/`, `media/mod_camap_editorial/`,
`libraries/camap/extensions/camap/mod_camap_editorial/` e o único helper
`libraries/camap/extensions/camap/_shared/render.js`. Fora deles, apenas os
controles/aviso de adoção exatos e LICENSEs originais expressamente listados
na proveniência são aceitos no stage. Os cinco payloads obrigatórios devem
existir; wrapper, CSS e overlay continuam verificados. Hashes válidos não
autorizam payloads de outro módulo, helper extra ou controles arbitrários.
Aviso de adaptação, MIT, GPL e `ADAPTATION.json` são inseridos exclusivamente
pelo finalizador após a validação, e também sujeitos à allowlist final.
O grafo de imports continua validado pelos parsers do preparador original;
não se introduz análise por regex substituta.

Pacotes históricos de 12 arquivos não são sobrescritos ou atualizados. A
auditoria `--packages` agora exige o contrato corrigido de 13 arquivos e
rejeita explicitamente os antigos; o coordenador deve gerar novos destinos.

A reserva final ocorre somente após validação completa em memória. Não é uma
transação multiarquivo do sistema operacional: uma falha de I/O pode deixar um
destino parcial, que **não** será retomado/sobrescrito. Escolha um novo destino.
Stages e tentativas anteriores são conservados para diagnóstico; sua presença
não constitui aprovação. Nunca use uma tentativa anterior como release final.

## Comandos locais

Os caminhos abaixo são neutros, não destino corporativo ou publicação:

```powershell
node --test tests/editorial-adaptation.test.js
node tests/editorial-adaptation.test.js --local-build
node scripts/prepare-editorial-adaptation.js --base /offline/editorial/0.3.0 --output tmp/editorial-adapt-new-030 --version 0.3.0
node scripts/prepare-editorial-adaptation.js --base /offline/editorial/0.3.1 --output tmp/editorial-adapt-new-031 --version 0.3.1
node tests/editorial-adaptation.test.js --packages tmp/editorial-adapt-new-030 tmp/editorial-adapt-new-031
```

O primeiro comando executa **9 testes portáveis**, sem dependências externas,
checkout CAMAP, rede ou escrita. A fixture existente é lida como texto; somente
literais de dados são decodificados, sem eval. O texto GPL completo próprio
também é lido de `docs/licenses/GPL-2.0.txt`. Hashes completos autorizam o
grafo estático conhecido antes do import dos renderers original/adaptado.
Não se duplica o renderer inteiro no novo teste nem se executa a suíte antiga.

`--local-build` é opt-in e acrescenta um décimo teste que cria duas revisões
reais, compara bytes/schema/CSS/aviso MIT, valida inventário e descoberta por
file-port, confirma hash reprodutível e rejeição de sobrescrita.
`--packages` audita exclusivamente os dois pacotes explicitamente fornecidos,
sem executar JavaScript desses pacotes e sem fallback para fixture.

Os testes cobrem bypasses de URL, fallback/CTA, getters e itens inválidos,
escaping/estados/limites, bytes mistos/BOM, esquema original, preservação
administrativa em repositório puro, CLI, payload estrangeiro corretamente
inventariado, runtime obrigatório ausente e evidência GPL inválida. Não representam
evidência de navegador, implantação ou mudança no conjunto de registros atual.

# Adaptação Recursos segura — perfil offline fechado

> **Resultado posterior do coordenador:** referência reconciliada com o usuário,
> Cassiopeia reativada mantendo três estilos. Pacotes 0.4.x passaram no ensaio
> público/admin, ranges individuais, formulário em memória e teclado; Recursos
> não instalado. 0.3.x permanece íntegra mas reprovada na coluna compacta.
> [Resultado e limites](CICLO-RECURSOS-ISOLADO.md). A seção técnica abaixo registra
> os gates do builder; não constitui aprovação de adoção/distribuição global.

O perfil `scripts/prepare-recursos-adaptation.js` prepara **somente
`camap.mod_recursos`, versões `0.4.0` e `0.4.1`**, em uma pasta nova
`tmp/recursos-adapt-agent-*`. Não instala, publica, configura o host ou altera
CAMAP2, tenant, registros, raízes existentes ou a release MINIJOOMLA `0.15.0`.
O contrato do ciclo permanece **48 registros / 8 raízes**; a proposta de uma
raiz no pacote não é uma autorização para mesclá-la ao host.

As versões `0.3.0`/`0.3.1` foram congeladas e não podem ser sobrescritas.
O coordenador informou upload imutável dos 26 arquivos e reteve os recibos
corporativos. A integridade anterior é válida, mas **o layout não foi aprovado**:
na lista compacta, categoria de 180 caracteres em raízes 768/900px consumiu
o track `auto`, deixando título e descrição com largura zero. Este ciclo
não ignora ranges de largura zero nem afrouxa o critério de conteúdo.

Antes da mudança, os três arquivos de tooling e os 26 arquivos dos dois
pacotes locais foram copiados, com recibo SHA-256, para
`tmp/recursos-adapt-agent-legacy-tooling/`. Auditoria histórica `0.3.x` exige
essas ferramentas preservadas; o tooling atual recusa expressamente `0.3.x`.
Nenhum arquivo legado local ou publicado foi alterado. Os hashes locais desse
recibo não substituem os hashes de inventário dos recibos corporativos.

## Fontes e proveniência

São exatamente três patches em uma cópia privada:

| Fonte | SHA-256 original LF, com BOM quando presente |
| --- | --- |
| `extensions/camap/_shared/render.js` | `33a925627f241ae6ed379ddaea89a53acfa24cbe91819aa36c1d0ba08aec5387` |
| `extensions/camap/mod_recursos/module.js` | `5882837be2296b26a2d9f7fcbb12d18a5121b561b22d3f3e5fbdac994c887d26` |
| `extensions/camap/mod_recursos/recursos.css` | `66201e410e91f9992868e54e62c5494c1956261143b23008bd482d3c1d308b77` |

Os bytes locais normalizados foram comparados aos blobs Git do agregador no
commit `124ac3ea1d002fe7dc517a7d03513d1238396dac`. A fonte real é um módulo de
424 linhas e CSS de **760 linhas**, incluindo estilos históricos de summary
que continuam intactos; não se pressupõe uma folha de apenas ~620 linhas.
Também são aceitos somente os hashes exatos dos originais locais com finais
de linha mistos. O gerador normaliza CRLF/CR para LF sem retirar BOM.

O snapshot real contém **56 fontes**, incluindo todos os onze módulos que o
gerador original importa. O fechamento offline das dependências contém
**175 arquivos**. Overrides precisam ser cópias das fontes/dependências locais
confiáveis, nunca caminhos para importar código arbitrário. Coletores rejeitam
junctions/symlinks e revalidam as entradas antes e depois da preparação.

O algoritmo original `tools/prepare-joomla-modules.js` e a API original
`scripts/prepare-module-adoption.js` são relocados byte a byte, não modificados.
Seus pins são do tooling local atual: o gerador não consta daquele commit
histórico, usado aqui somente para a origem dos três fontes e do MIT herdado.
O XML canônico foi obtido da execução desse gerador sobre o snapshot original;
o finalizador compara **todos os bytes**, inclusive atributos, defaults e opções.
Não há XML reconstruído por heurísticas do parser.

## Onze parâmetros preservados

Ordem, defaults e tipos originais:

| Nome | Tipo | Default |
| --- | --- | --- |
| `title` | string | `Explore Mais` |
| `homeLabel` | string | `Hub TD` |
| `homeHref` | string | `#inicio` |
| `search` | string | string vazia |
| `category` | string | `todas` |
| `sort` | enum `curada`, `alfabetica` | `curada` |
| `view` | enum `cartoes`, `compacta` | `cartoes` |
| `showActions` | boolean | `true` |
| `showShortcuts` | boolean | `true` |
| `categories` | array JSON | `[]` |
| `links` | array JSON | `[]` |

Nenhum `maxLength`, mínimo, máximo, alias de parâmetro ou campo novo foi
inventado. O `maxlength="100"` histórico do input refere-se **somente à
prévia visual**: seu valor mostra os primeiros 100 caracteres, enquanto o
filtro e o resumo usam o termo completo dos parâmetros. A validação geral
de params da aplicação possui seu próprio limite de texto; não vira uma
restrição adicional de 100 caracteres no XML.

## Dados derivados na renderização, não saneamento na persistência

Settings, contexto e linhas precisam ser objetos próprios simples
(`Object.prototype` ou `null`). Descritores próprios recusam getters,
funções e símbolos sem executar `toString`, `valueOf` ou `toJSON`. Arrays
precisam ser densos, nativos, sem propriedades adicionais e com até 500
itens. O length próprio é verificado antes de materializar descritores de
todo o array, recusando rapidamente arrays grandes inclusive esparsos.
Objetos Proxy e globais previamente modificados **não** são um sandbox
suportado. As entradas reais vêm de JSON params.

Uma linha precisa de título string não branco e URL string validada diferente
de `#`. Categoria, descrição e chave de ícone precisam ser strings; valores
ausentes/nullish seguem os defaults históricos. Ordem aceita número finito
ou string decimal estrita com sinal opcional, como `2`, `-.5`, `1.`; não
aceita coerção de objeto, espaços, expoente, hexadecimal, `NaN` ou infinito.
`active` e `openInNewWindow`, após precedência nullish, precisam ser booleanos.
Ausência/nullish sem alias mantém `true`; `active:false` exclui a linha.

Aliases históricos de linha são preservados com a mesma precedência nullish,
mas **somente campos próprios**:

`title/Title`, `url/URL`, `category/Categoria`, `description/Descricao`,
`iconKey/IconeChave`, `order/Ordem`, `openInNewWindow/AbrirNovaJanela`,
`active/Ativo`.

O original fazia `Boolean('false') === true`. Agora flags strings recusam a
linha conservadoramente na renderização; isso **não** converte `'false'` em
false salvo nem promete preservar o resultado antigo de entradas inválidas.
Nenhuma linha é reparada, normalizada ou gravada automaticamente.

Categorias configuradas retêm suas strings originais: `.trim()` só verifica
se são não brancas, não renomeia categorias. A categoria da linha mantém o
trim/default `Outros` original. Ordenação curada (categoria, ordem, título),
alfabética `pt-BR`, agrupamento, filtros e contagens continuam os originais.
Strings settings inválidas derivam vazio; enums explicitamente inválidos
derivam `curada`/`cartoes`; flags de exibição explicitamente não booleanas
derivam false. Não há coerção de entradas inválidas.

A mesma `SAFE_URL_SOURCE` já usada no Editorial rejeita protocolos não
permitidos, credenciais, URLs protocol-relative, barras invertidas, controles,
espaços e evasões percent-encoded especificadas. URLs válidas retornam os bytes
originais, escapados uma única vez no HTML. Não se alega recusa de todo Unicode
invisível: U+200B percent-encoded em path é aceito pela política reutilizada,
sem desvio de protocolo/origem observado. Todos os caminhos de cartão, atalho e lista
compacta recebem apenas URLs validadas. Links inseguros são **omitidos**,
nunca transformados em `href="#"`. Breadcrumb inválido produz label escapado
em `<span>`, sem restaurar o default. Nova janela mantém
`rel="noopener noreferrer"`.

Os testes exercitam leitura administrativa, edição explícita e prévia com
arrays JSON completos, inclusive aliases e valores inválidos. Renderizar e
atualizar um campo administrativo não relacionado preserva os bytes de
`settingsJson`; editar params conserva arrays e chaves futuras/`__proto__`
como dados. A normalização derivada do renderer não é usada como payload de
save.

## UI honesta e limites funcionais

O contrato permanece síncrono e estático:

- Todos os botões estáticos e o select têm **`disabled` nativo**, além do
  `aria-disabled="true"` original. Não basta anunciar inatividade enquanto
  controles nativos ainda operam.
- O input tem `readonly` e `aria-readonly="true"`: pode receber foco e permitir
  copiar o termo inicial, não oferece busca interativa. Mudança programática
  do DOM não cria um evento de filtro do módulo.
- A pagebar contém nota `role="note"`: “Filtros e opções de exibição são
  definidos nos parâmetros do módulo; os controles abaixo são uma prévia.”
- Não foram implementados favoritos, sugestões, analytics, AJAX, listeners
  ou backend. `Atalhos mais usados` é a expressão histórica para o primeiro
  link por categoria na ordem curada, **não** uma métrica de utilização.
- Loading e error mantêm suas branches. Sem links válidos: “Nenhum link
  publicado ainda.” Filtro sem resultado: “Nenhum link encontrado”. Estado
  `empty` ou desconhecido não força outra branch: segue a lógica ready como
  a fonte original; estados não string também seguem essa lógica sem coerção.
- O símbolo ↗ da lista compacta continua decorativo mesmo quando
  `openInNewWindow:false`, uma limitação histórica não alterada neste ciclo.
- A fonte original não possui IDs globais; não são inseridos IDs nem se
  reivindica uma correção de IDs duplicados inexistentes.

## CSS local, correção comprovável e gate separado de navegador

Só a primeira lista de seletores wrappers `recursos`/`explore-mais` passa a
`.mse-recursos`, a raiz realmente renderizada. O resto dos bytes originais
permanece, seguido de **16 linhas** exatas de CSS revisadas pelo coordenador
em sua análise local. Não há estilo global, recoloração, mudança de fonte,
padding ou expansão da feature summary.

A correção contém wrapping/min/max-width locais, border-box, breadcrumb e
controles flexíveis, grids com mínimos `min(13rem,100%)`/`min(18rem,100%)`,
select/search dimensionados e um container query no content-box de até
400px. Nesse espaço cartões, atalhos, lista compacta e opções de view
empilham conteúdo. Chips podem quebrar linha, mas o contador não encolhe.
Isso atende raízes estreitas mesmo com viewport largo, onde o padding
original de 56px por lado reduz substancialmente a área útil.

A última linha adiciona somente dois overrides locais:

```css
.mse-recursos__row{grid-template-columns:minmax(0,1fr) fit-content(40%)}
@container(max-width:400px){.mse-recursos__row{grid-template-columns:minmax(0,1fr)}}
```

O `fit-content(40%)` limita o track da categoria, reservando espaço para
título/descrição; o container query repetido **depois** restaura o empilhamento
estreito. Não reduz fonte, trunca dados ou esconde conteúdo. A nova prova do
coordenador em raiz 900px com a mesma categoria longa passou sem bad ranges.
O JavaScript runtime permanece byte-identical ao último `0.3.x`, SHA-256 LF
`4d34ff0852942fab9c24b680fb6bfb395af3e015d36bc6ce02bfc6a71503116d`;
somente CSS runtime e versão XML/política de tooling/metadados mudam.

O coordenador inicialmente informou oito combinações de cartão/compacta e
raízes 180/320/768/900px sem offenders de overflow. A prova final mais rigorosa
de ranges encontrou a falha de largura zero descrita acima; o primeiro
resultado não é aprovação de layout `0.3.x`. Esses retornos orientaram o patch
`0.4.x`; não representam execução de navegador por
este builder/agente. O `overflow:hidden` original da raiz é preservado,
portanto ausência de scroll externo **não comprova** ausência de corte.
Validação final do pacote com controles readonly/disabled, ranges de texto,
contagens, foco e ciclo de vida continua sendo gate do coordenador.

## Fechamento, segurança e licenças

Cada pacote contém **5 arquivos de runtime, 11 payloads inventariados e
13 arquivos totais**. Os dois controles não se auto-inventariam:
`MANIFEST-SHA256.json` e `host-config.json`; este último pinna o hash do
inventário. A raiz proposta é imutável e única. Defaults XML completos,
wrapper, runtime/CSS, estilos por revisão e metadados fechados são verificados.

Map input precisa ser Map nativo exato, branded, sem propriedades próprias,
subclasses ou métodos/getters caller-defined. Buffers precisam ser exatos,
branded e ter somente bytes próprios, sem hooks de tamanho/coerção; os
helpers seguros são reutilizados de Home/Hero. A única edição existente é
o export aditivo de `copyNativeMap` em `scripts/prepare-home-adaptation.js`,
sem alterar comportamento nem bytes de pacotes Home históricos.

O MIT original do `LICENSE` do agregador e o GPL completo das alterações
autoriais são copiados literalmente para:

- `docs/licenses/CAMAP-ROOT-MIT.txt`;
- `docs/licenses/GPL-2.0.txt`.

O MIT tem proveniência histórica limitada às três fontes revisadas;
GPL-2.0-or-later cobre **somente alterações autorais**, não relicencia CAMAP
inteiro. `ADAPTATION.json` registra hashes raw/LF, tamanhos, BOM, EOL,
snapshot, gerador/API, escopo e limites. Não existe aprovação geral de
direitos, privacidade ou distribuição pública.

`publicationApproved`, `rightsApproved`, `migrated`, `tenantModified`,
`hostConfigured` e `currentRecordsModified` permanecem **false** no plano e
na evidência. `vendorLicenseAssigned` também é false. O ciclo isolado/site,
as autorizações e os recibos independentes continuam obrigatórios.

## Comandos e verificação

Sem rede, navegador, instalação npm, full npm suite ou commit:

```powershell
node tests/recursos-adaptation.test.js
node scripts/prepare-recursos-adaptation.js --base /offline/recursos/0.4.0 --output tmp/recursos-adapt-agent-final040 --version 0.4.0
node scripts/prepare-recursos-adaptation.js --base /offline/recursos/0.4.1 --output tmp/recursos-adapt-agent-final041 --version 0.4.1
node tests/recursos-adaptation.test.js --packages tmp/recursos-adapt-agent-final040 tmp/recursos-adapt-agent-final041
node tests/recursos-adaptation.test.js --local-build
```

Saídas precisam ser novas; a repetição com o mesmo destino falha sem
sobrescrever. `--local-build` cria seu próprio diretório novo e verifica
ambas as versões, AST CSS real, file-port de descoberta/verificação,
reconstrução exata de todos os payloads finais e conservação das 56 fontes,
175 dependências, API e licenças. `--packages` é auditoria somente leitura.

`runRecursosAdaptationTests()` exporta **21 casos portáveis**, que armazenam
as fontes completas como dados comprimidos com SHA-256 validado **antes**
de qualquer import de fixture. A auditoria local é separada da fixture
sintética de proveniência; somente ela compara todo o snapshot real.
`auditRecursosAdaptationPackage(directory, version)` retorna contagens/hash
com `browserValidated:false`, `publicationApproved:false` e
`rightsApproved:false`. A integração no runner fica com o coordenador.

O modo local-build/package-audit executa **22 casos** (21 portáveis e um
gate local). As contagens históricas `0.3.x` eram 20 portáveis/21 com gate;
não devem ser confundidas com o tooling atual.

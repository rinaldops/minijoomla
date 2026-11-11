# Agrupamento XML finito — preparação offline

> **Ciclo no site executado pelo coordenador:** dois grupos neutros em revisões
> imutáveis, descoberta/integridade/cancelamento/render temporário aprovados;
> nenhum registro ou configuração do host alterado. [Resultados e limites](CICLO-CAPACIDADE-XML.md).

O novo `scripts/prepare-xml-module-group.js` combina **2 a 7 pacotes individuais
explicitamente selecionados** em uma raiz nova. Não move raízes instaladas,
não configura o host atual, não instala módulos, não restaura dados e não
publica. Os oito roots existentes ficam fora do trabalho deste script.

O artefato é uma proposta imutável por pin SHA-256, não uma permissão de
instalação, uma publicação ou uma proteção de filesystem contra mudanças.

## Desenvolvimento → Site → Análise → Validação → Docs

1. **Desenvolvimento:** validar individualmente cada pacote e seu contrato de
   runtime antes de selecionar seus hashes. O agrupador não executa JavaScript
   de entrada nem substitui essa validação.
2. **Site:** preparar uma raiz nova, ainda NÃO INSTALADA, com base explicitamente
   fornecida pelo coordenador. Nenhuma configuração atual é escrita.
3. **Análise:** conferir `GROUP-PROVENANCE.json`, inventário, avisos/licenças
   preservados, defaults XML, ordem CSS e fechamento de imports.
4. **Validação:** descoberta real dos vários módulos, verificação da união
   inteira e revisão anterior retida. Revisar direitos e privacidade de cada
   entrada selecionada; um campo antigo `rightsApproved:true` não concede
   aprovação ao agrupamento. Não é exigida uma revisão global de todas as
   licenças vendor para esta preparação somente leitura.
5. **Docs:** registrar resultados e somente então avaliar o próximo gate humano.

**Os sete futuros grupos reais NÃO estão prontos por causa desta prova OWN.**
O plano completo continua congelado para instalação até que todos os sete
grupos previstos sejam individualmente revisados e o ciclo serial do usuário
seja concluído. Esta capacidade não autoriza agregação automática do catálogo.

## CLI e plano fechado

```powershell
node scripts/prepare-xml-module-group.js --plan tmp/xml-group-agent-proof-inputs/r1-plan.json --output tmp/xml-group-agent-proof-r1 --deps tmp/step2/camap-source
node scripts/prepare-xml-module-group.js --plan tmp/xml-group-agent-proof-inputs/r2-plan.json --output tmp/xml-group-agent-proof-r2 --deps tmp/step2/camap-source
```

Cada destino deve ser novo. O comando recusa sobrescrita. `--plan` e `--deps`
são caminhos relativos explícitos dentro do `tmp/` deste worktree;
`--output` deve estar em `tmp/xml-group-*`. Não há globs, overrides externos,
instalação npm, fallback regex, rede, browser, tenant ou import do entrypoint
de qualquer pacote selecionado. Sem `--deps`, falha antes de escrever.

Esquema do plano (substituir os hashes pelos pins já aprovados):

```json
{
  "format": "minijoomla-xml-module-group-plan-v1",
  "base": "/sites/example/xml-group-proof/r1",
  "groupId": "capacity-group-0.1.0",
  "version": "0.1.0",
  "packages": [
    {
      "path": "tmp/xml-group-agent-proof-inputs/r1/alpha",
      "inventoryHash": "<SHA-256 exato de MANIFEST-SHA256.json>",
      "module": "mod_capacity_alpha",
      "key": "capacity.mod_capacity_alpha",
      "version": "0.1.0",
      "libraryPrefix": "libraries/capacity/extensions/capacity/mod_capacity_alpha/",
      "sharedPaths": ["libraries/capacity/extensions/capacity/_shared/render.js"]
    },
    {
      "path": "tmp/xml-group-agent-proof-inputs/r1/beta",
      "inventoryHash": "<SHA-256 exato de MANIFEST-SHA256.json>",
      "module": "mod_capacity_beta",
      "key": "capacity.mod_capacity_beta",
      "version": "0.1.0",
      "libraryPrefix": "libraries/capacity/extensions/capacity/mod_capacity_beta/",
      "sharedPaths": ["libraries/capacity/extensions/capacity/_shared/render.js"]
    }
  ]
}
```

`groupId` é um token ASCII e `version` é `X.Y.Z` sem zeros à esquerda.
Identidades e versões individuais permanecem aquelas dos XML originais; a
versão do grupo identifica o novo inventário, não reescreve os módulos.

## Contratos e limites

- Cada entrada e o grupo final: **500 arquivos totais / 10 MiB**; inventários
  e controles lidos: **64 KiB**. O inventário final também tem limite 64 KiB.
- Snapshot completo e limitado, sem links simbólicos/junctions. Extras não
  inventariados, arquivos incompletos, caminhos escapados, nomes Windows
  inseguros, colisões case-insensitive e colisões arquivo/diretório falham.
- XML é lido por `parseJoomlaManifest` real. Element/key/version, requiredFiles,
  defaults/params, mapas de estilos e ordem CSS devem corresponder. `<folder>`
  aberto, outro manifesto ou arquivo executável fora do grafo é recusado.
  O perfil de payload do grafo é XML único + JS/MJS + CSS, sem PHP/SQL/JSON
  executável ou outros formatos implícitos.
- Imports JS estáticos e dinâmicos literais são fechados pelo parser real.
  Relativo exige `./` ou `../`; `.helper.js` é bare e também é recusado.
  Imports bare/absolutos/computed/escapados e dependências de outro módulo
  falham. O specifier deve começar exatamente por `./` ou `../`: `.helper.js`
  é bare mesmo começando por ponto e é recusado em import estático, dinâmico
  literal e re-export. `sharedPaths` é uma lista de arquivos exatos no `_shared` irmão.
- Um helper compartilhado só é deduplicado após verificar os hashes de TODAS
  as entradas e comparar bytes crus. Divergência falha: não escolhe uma versão
  silenciosamente e não altera imports para resolver o conflito.
- CSS usa `css-tree`: falham `url()`, `@import`, erros/recovery `Raw`. Nenhuma
  folha ou ordem de cascade é reescrita.
- `es-module-lexer@1.7.0`, `css-tree@3.1.0`, `mdn-data@2.12.2` e
  `source-map-js@1.2.2` são lidos da closure offline aprovada de
  `tmp/step2/camap-source`. `--deps` alternativo precisa ter essa mesma closure
  byte a byte; versões apenas não bastam. Entrypoints CJS são fixos, não
  escolhidos por metadados de um pacote de entrada. Links/nested node_modules
  capazes de redirecionar resolução são recusados. Nada é instalado.
- `loadXmlGroupParserPorts` **não executa arquivos em `--deps`**. Depois da
  comparação e estabilização, copia somente os **175 arquivos** da closure
  aprovada, byte a byte, para uma pasta nova `tmp/xml-group-parser-stage-*`,
  com um `package.json` raiz privado/commonjs controlado pelo workflow. Só os
  entrypoints CJS fixos dessa cópia são carregados. README/licenças/fontes
  fora da closure não são executados nem precisam ser removidos da entrada.
  Shadows extensionless, addons `.node` e outros extras não entram na cópia;
  por exemplo `require('./base64')` encontra o `base64.js` aprovado, nunca um
  `base64` extra do chamador. Não há regex para extrair `require` de fontes.
  Arquivos/diretórios/bytes da cópia também são conferidos antes da execução
  e no gate final; uma cópia adulterada ou com extras é recusada.
- Esse loader de preparação cria arquivos temporários próprios quando as
  dependencies são aprovadas, inclusive se uma validação posterior de entrada
  falhar. Não é uma API somente leitura de filesystem nem uma sandbox contra
  alteração concorrente por outro processo local. Sem dependencies ou com
  closure não aprovada, a falha precede qualquer escrita. O engine puro e a
  descoberta/site continuam sem escrita; inputs e provas existentes nunca são
  regravados. O stage não integra o inventário/provenance do grupo e não muda
  seus bytes, pins ou flags.
- As entradas, diretórios, plano, GPL e dependencies são conferidos novamente
  antes da reserva exclusiva do destino. Uma falha durante escrita deixa um
  destino parcial não aprovado; não há rollback destrutivo nem sobrescrita.

## Bytes preservados e controles novos

XML, JS e CSS ficam nos mesmos caminhos internos e byte a byte iguais.
Somente o base do descriptor muda naturalmente ao analisar o XML no root novo.
O inventário `minijoomla-joomla-package-v1` contém vários `moduleKeys` e
`moduleStyles` relativos; `host-config.json` contém um root `discover:true`
com CSS e revisões por entrypoint rebased para a base escolhida.

Os controles de cada entrada `MANIFEST-SHA256.json` e `host-config.json` não
são copiados como controles do grupo. Seus pins são registrados. Já
`adoption-plan.json`, `ADAPTATION.json`, LICENSE/COPYING/NOTICE e documentos em
`docs/` são preservados em `docs/group-members/<element>/<caminho-original>`.
Isso evita sobrescrever avisos distintos. Nenhum JS de dependência é movido
para esse namespace. Conteúdo adicional não registrado como documento nem
pertencente ao grafo é recusado, nunca ignorado silenciosamente.

Campos desconhecidos de planos/ADAPTATION originais, inclusive propriedades
JSON próprias chamadas `__proto__`/`constructor`, são preservados como bytes.
A leitura usa propriedades de dados em cópia sem protótipo, não getters,
código ou atribuição de protótipo. O plano de seleção continua com campos
fechados e nomes reservados recusados. Claims originais de direitos/privacidade
não são propagados como aprovação.

`GROUP-PROVENANCE.json` registra nomes relativos, pins originais, mapa
original→agrupado e hashes; não copia conteúdo de source nem dados pessoais.
Todos os flags de instalação, publicação, direitos, privacidade, dados/tenant,
host e alterações ficam `false`. Não inclui URLs corporativas; a base
fornecida pelo chamador aparece apenas nos controles de host/URLs derivados.

O texto completo `docs/licenses/GPL-2.0.txt` do projeto é incluído **inalterado**
com SHA-256 `189b1af95d661151e054cea10c91b3d754e4de4d3fecfb074c1fb29476f7167b`.
GPL-2.0-or-later cobre o workflow autoral e a prova OWN, não concede direitos
sobre material de entrada. Evidência original continua por membro, em bytes.

## Revisões e capacidade do host

Usar o `mergeExtensionsConfigs` existente somente para o par de revisões do
grupo deixa r1 `discover:false` e r2 `discover:true`; `verifyRevision` ainda
verifica r1. O merge marca roots de configurações anteriores como não
descobertos, portanto **não** passar os oito roots existentes como primeira
entrada desse merge para anexar o grupo.

A proposta do coordenador deve copiar explicitamente o array dos oito roots
aprovados e anexar os dois roots do grupo já mergeados, preservando os oito.
O teste confirma **8 + 2 = 10 aceito; 11 recusado**, sem mutação dos configs.
Não há escrita dessa proposta no app config. A verificação de alpha inclui
TODOS os arquivos da união: adulterar beta também bloqueia alpha.

## Prova portable e exports

```powershell
node tests/xml-module-group.test.js
node --input-type=module -e "import {runXmlGroupRealParserProof} from './tests/xml-module-group.test.js'; await runXmlGroupRealParserProof();"
node --input-type=module -e "import {runXmlGroupParserBoundaryTests} from './tests/xml-module-group.test.js'; await runXmlGroupParserBoundaryTests();"
node --input-type=module -e "import {writeXmlGroupProofInputs} from './tests/xml-module-group.test.js'; console.log(await writeXmlGroupProofInputs());"
```

O runner exportado `runXmlModuleGroupTests()` é async/sequencial, sem
`node:test` nem registro automático na suíte existente. A prova principal
usa doubles nomeados com resultados explícitos de parser, não regex artesanal.
Há **47 casos de rejeição do engine**, descoberta/verificação reais, duas
revisões, tamper cruzado, conflitos de roots, limites de entrada/grupo,
preservação de bytes/unknowns e ausência de overwrite/deps implícitas.
A prova real opcional confirma parsers offline, writer exclusivo, estabilidade
das entradas/plano, ordem CSS e recusa de extras. A regressão exportada
`runXmlGroupParserBoundaryTests()` usa os parsers reais para três rejeições de
`.helper.js`, prova que shadows extensionless/addon de uma cópia de `--deps`
não são executados nem copiados, compara todos os bytes agrupados com parsers
sem shadow e recusa metadados não aprovados/tamper do stage. Não altera as
fixtures originais ou os roots de prova imutáveis do coordenador.
Fora do engine, a prova opcional de runtime importa
somente os entrypoints OWN que acabou de materializar e verificar, valida
exports/schema contra XML e usa o loader/registry reais para render em memória
com `render({settings})` e escaping de texto próprio, sem browser ou dados do
app. O grupo OWN tem **27 arquivos
totais, 25 inventariados**, incluindo GPL e provenance.

Exports do script: `buildXmlModuleGroup`, `prepareXmlModuleGroup`,
`parseXmlModuleGroupArgs`, `validateXmlGroupPlan`, `xmlGroupDescriptorMetadata`,
`loadXmlGroupParserPorts`, `xmlGroupHash`, `XML_GROUP_LIMITS` e constantes GPL.
O engine recebe Maps, metadata de descriptor confiável, parsers injetados e
bytes GPL confiáveis. A CLI obtém metadata do XML com pin explícito; não
importa o runtime individual para alegar validação de exports.

`createXmlGroupProofPackages({version})` exportado pelo teste retorna
`{packages: Map, plan, parseImports, validateCss}` com files Maps prontos para
materialização. São somente dois módulos novos OWN `mod_capacity_alpha` e
`mod_capacity_beta`, código GPT original com render `render({settings})`, sem
identidades futuras, dados frontend, fontes corporativas ou referências de rede.
`writeXmlGroupProofInputs()` materializa entradas novas em
`tmp/xml-group-agent-proof-inputs/{r1,r2}/{alpha,beta}` e planos com pins reais.
Reexecutá-lo no mesmo destino é recusado. Os dois roots finais continuam
provas NÃO INSTALADAS sob controle do coordenador. Se os roots já foram
construídos/publicados como prova, não os reconstruir ou sobrescrever para
esta correção dos limites do workflow: o agrupamento válido é byte-identical.

### Conferência da correção dos dois limites

A recomposição somente em memória com parsers reais foi comparada contra os
dois roots locais já preparados pelo coordenador, arquivo por arquivo: **27
arquivos / 25 payloads, todos os bytes iguais**, sem escrita nos roots/fixtures.
Os hashes dos inventários permaneceram:

- `1.0.0`: `07a8e15206ea34cd3909663db6f046e86851c408c8ad23b7238b5a7720069ec7`
- `1.0.1`: `e9e8dd9b638aa4874b9fa05267c668b4a7c389a8d55d363fd3fc5dd001affbcd`

Esta comparação local não refez upload, publicação ou prova de site, nem
alterou configuração instalada. Os sete grupos reais continuam no gate humano.

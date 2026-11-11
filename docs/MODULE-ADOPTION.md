# Preparação individual de módulos CAMAP

> **Ferramenta de referência histórica, não instalação genérica:** a preparação
> de módulos CAMAP não é etapa obrigatória para instalar o MINIJOOMLA. Videoteca
> e Forum pertencem ao TD; o catálogo histórico abaixo não autoriza desenvolver
> ou instalar esses módulos no núcleo. O administrador escolhe extensões externas
> somente após instalar o CMS. [Contrato padrão](INSTALACAO-GENERICA-MINIJOOMLA.md).

## Escopo e gate

`scripts/prepare-module-adoption.js` prepara **um módulo por pacote**, a partir
das fontes locais CAMAP2. Não adiciona código CAMAP ao núcleo genérico, não lê
`dist`, não instala dependências, não acessa rede/navegador/tenant e não altera
registros, configurações de host ou pacotes existentes. Os atuais **40 registros
da amostra devem ser preservados** pelo coordenador; preparação offline não é
evidência de contagem ou migração remota.

O piloto é `camap.mod_camap_corpmessage`, nas revisões `0.2.0` e `0.2.1`.
As dez demais extensões ficam **preparadas, não migradas**. Adoção depende de
auditoria/aprovação da raiz e do ciclo do piloto: descoberta somente de dados,
verificação de integridade, instalação explícita, atualização, retenção da
revisão anterior, reversão e confirmação de que os registros/instâncias
existentes não foram descartados. Operações remotas pertencem ao coordenador
e exigem o escopo e a autorização correspondentes.

## Catálogo fechado

O nome `--module` é obrigatório; `all` é recusado na CLI. Chaves persistidas não
são renomeadas:

| Pasta / `--module` | Chave | Gate |
| --- | --- | --- |
| `mod_camap_corpmessage` | `camap.mod_camap_corpmessage` | Piloto |
| `mod_camap_editorial` | `camap.mod_camap_editorial` | Após piloto |
| `mod_camap_highlights` | `camap.mod_camap_highlights` | Após piloto |
| `mod_camap_topsections` | `camap.mod_camap_topsections` | Após piloto |
| `mod_documentation` | `camap.mod_documentation` | Após piloto |
| `mod_forum` | `camap.mod_forum` | Após piloto |
| `mod_hero` | `camap.mod_hero` | Após piloto |
| `mod_home` | `camap.mod_home` | Após piloto |
| `mod_recursos` | `camap.mod_recursos` | Após piloto |
| `mod_showcase` | `camap.mod_showcase` | Após piloto |
| `mod_videoteca` | `camap.mod_videoteca` | Após piloto |

## Uso offline

```powershell
node scripts/prepare-module-adoption.js --module mod_camap_editorial --version 0.2.0 --base /SiteAssets/camap/mod_camap_editorial/0.2.0 --output tmp/adoption-agent-editorial-new --source tmp/step2/camap-source
```

`--base` é apenas o caminho server-relative proposto: não cria recursos nesse
destino. `--output` precisa ser uma pasta **nova** relativa sob `tmp/` deste
checkout/worktree; escapes, links/junctions, nomes Windows reservados e
sobrescrita são recusados. Não reutilize uma pasta de versão publicada.

Por padrão a fonte é `../CAMAP2`. `--source` / API `sourceRoot` aceita somente
essa raiz original ou um snapshot explicitamente confiável sob o `tmp` deste
checkout. Fonte e saída não podem se sobrepor. A API é
`await prepareModuleAdoption({ module, version, base, output, sourceRoot })`.

O gerador original exige `es-module-lexer` e `css-tree`; não existe fallback
regex ou download automático. Ausência de dependências produz
`ADOPTION_DEPENDENCY_MISSING` **antes de criar saídas**. O coordenador pode
restaurar dependências isoladas, com lock e feed aprovados, sem tocar a fonte
CAMAP2. O snapshot `tmp/step2/camap-source` autorizado nesta etapa já contém
essas dependências e o gerador original.

Alternativamente, `--dependencies-root tmp/<dependencias-aprovadas>` / API
`dependenciesRoot` aponta a uma raiz isolada local, sem sobreposição com a
saída. As versões devem coincidir com CAMAP2: `es-module-lexer@1.7.0` e
`css-tree@3.1.0`. Nesse modo somente as rotas dos dois imports do gerador e seu
`import.meta.url` são resolvidas em memória; nenhum fork do gerador é escrito
ou incluído no pacote. Revisão e confiança do código/dependências locais
continuam sendo pré-condições; este processo não é um sandbox para código
arbitrário.

## Contrato de preparação

1. Confere o catálogo/API `JOOMLA_MODULES`, `createXml` e
   `prepareJoomlaModules` do gerador original. Snapshot privado em
   `tmp/adoption-agent-snapshot-*` inclui somente os JS/CSS imediatos das onze
   pastas, `_shared/render.js`, licenças raiz existentes e o marcador ESM.
   Não copia PHP, componentes, testes, configurações corporativas ou `dist`.
2. A seleção original suporta apenas piloto/`all`. Por isso a geração completa
   é **interna ao snapshot**, via `projectRoot`, com saída `tmp/generated` sob
   esse snapshot. Nenhuma escrita ocorre em CAMAP2. O snapshot é evidência
   intermediária, não um pacote para publicar.
3. Lê e verifica o inventário original, depois seleciona o XML e todos os
   arquivos declarados. Segue imports/reexports estáticos e dinâmicos literais
   com `es-module-lexer`, recursivamente. Só aceita a pasta do módulo, sua
   mídia e `_shared/render.js`. Dependência de outro módulo, bare/absolute
   import, import computado, escape ou arquivo ausente falha; não é omitido.
4. `parseJoomlaManifest` usa o parser XML real vendorizado do runtime. Confere
   perfil `joomla-xml-v1`, chave, versão, arquivos declarados e parâmetros.
   Compara tipos, defaults, enumerações, limites e campos com o schema original.
   Exige `default.settings` próprio/plano e defaults nomeados consistentes com
   cada default tipado XML; `field.default` não pode mascarar divergências do
   runtime. Schema no default é opcional, mas deve coincidir quando declarado.
   Arrays/objetos usam `mj:type="json"` e `mj:valueType`; booleanos chegam ao
   runtime como checkbox tipado. DTD/PHP/SQL não são suportados.
5. O gerador valida o grafo completo de CSS; a seleção revalida o CSS individual
   com `css-tree`, recusando `url()` e `@import`. Fontes JS são importadas
   apenas pelo gerador/preparador confiável, depois da validação do grafo; a
   **descoberta XML não importa nem renderiza código**.
6. Confere estabilidade das fontes durante o snapshot. Limites: 500 arquivos,
   10 MiB, XML e inventário de até 64 KiB, UTF-8 válido, hashes SHA-256,
   caminhos sem colisões de caixa e sem links. O pacote final elimina helpers
   não alcançados: não copia indiscriminadamente o pacote completo.

## Arquivos individuais

- `modules/<mod>/<mod>.xml`: manifesto Joomla do perfil suportado.
- `modules/<mod>/<mod>.js`: wrapper original; implementação e dependências
  alcançadas em `libraries/camap/extensions/camap/`.
- `media/<mod>/css/`: CSS declarado pelo XML.
- `LICENSE*` / `COPYING*`: licenças raiz CAMAP2 existentes, preservadas **byte
  por byte**. Ausência aparece em `sourceLicensePresent:false`; não se inventa
  autorização ou aplica a licença do núcleo a fontes externas.
- `docs/ADOPTION-NOTICE.md`: origem e limites da preparação/direitos.
- `adoption-plan.json`: perfil/gate individual; flags `migrated`,
  `publicationApproved`, `rightsApproved`, `tenantModified`, `hostConfigured`
  e `currentRecordsModified` permanecem `false`.
- `MANIFEST-SHA256.json`: inventário completo desses payloads, chave e estilos
  de **um** módulo, compatível com o verificador runtime.
- `host-config.json`: proposta para **uma** raiz imutável, hash dos bytes do
  inventário e estilos indexados por URL de revisão. Inventário e host config
  são arquivos de controle e não inventariam a si próprios; o host fixa o
  hash do inventário. Todos os outros arquivos finais são inventariados.

O ID proposto é `camap-<mod>-<versao>`, distinto para cada revisão. Não
concatenar automaticamente os onze `joomlaDiscoveryRoots`: o runtime aceita
**no máximo dez raízes**, incluindo revisões retidas. Manter a revisão anterior
com `discover:false` permite verificação de rollback sem provocar conflito
de descoberta; alterações reais do host dependem do coordenador e da
capacidade disponível.

## Testes e situação local

```powershell
npm test
```

`runModuleAdoptionTests()` é a entrada exportada integrada ao
runner. A suíte padrão usa fixtures locais e resultados de parser explicitamente
injetados (não implementa parsers alternativos), além do parser XML e serviço
de descoberta reais do núcleo. Não requer CAMAP2/SPMIDDLE, instalações, rede
ou navegador. Cobre onze pacotes sintéticos individuais, duas revisões do
piloto, tipos/defaults JSON e booleanos, dependências transitivas, inventários,
SHA-256, reversão da revisão retida, adulteração, links, escapes e falha offline.

Entradas de integração explícitas em `tests/module-adoption.test.js`:
`prepareOtherAdoptionModules({ sourceRoot, outputPrefix })` prepara somente os
dez não pilotos; `auditLocalAdoptionPackages({ sourceRoot, packages })` audita
pacotes existentes sem reconstruí-los nem importar seus entrypoints.

Nesta etapa os dez pacotes reais `0.2.0` foram preparados em
`tmp/adoption-agent-real-<mod>-0.2.0`, com **sete arquivos inventariados cada**:
cinco arquivos runtime/XML/CSS e dois arquivos de aviso/plano. Os dois pilotos
do coordenador permanecem em `tmp/step2/camap-source/tmp/pilot-0.2.0` e
`pilot-0.2.1`, com oito arquivos inventariados por revisão pelo gerador
original. Não foram reconstruídos nem sobrescritos. A fonte CAMAP2 original
segue sem dependências instaladas; a execução real utiliza apenas o snapshot
autorizado. A auditoria local dos **12 pacotes/revisões** passou: XML real,
closure de JS/CSS com os parsers originais, inventário completo, hashes e
`scanReport`/`verify` reais, sem importar entrypoints. O modo de dependências
isoladas também foi exercitado com sucesso, lendo a fonte original somente
para um pacote adicional de teste editorial sob `tmp/adoption-agent-*`.
Licenças e referências externas dos módulos ainda exigem revisão
antes de distribuição. **Nenhum desses resultados declara migração, validação
em tenant ou aprovação de publicação.**

# Instalação, publicação e recuperação

Guia canônico para preparar o pacote, instalar uma instância vazia, aplicar dados
opcionais e atualizar o host SharePoint. O CMS tem transporte substituível; a
instalação SharePoint é uma composição, não uma dependência do núcleo.
Consulte [contratos](CONTRATOS.md), [extensões](EXTENSOES.md),
[templates](TEMPLATES.md), [desenvolvimento](DESENVOLVIMENTO.md) e
[estado e gates](ESTADO.md) para os assuntos complementares.

## Pré-condições e pacote

A instalação inicial permanece com **aceite real no SharePoint pendente**;
bootstrap/site e relatos históricos não encerram esse gate.
A fonte local está em `package.json`; ela não identifica automaticamente a
release remota. Este workspace opera somente em produção. Uma instalação
isolada continua sendo um destino de produção e precisa estar abrangida pela
autorização da operação. Exemplos abaixo usam `/sites/example`, nunca um tenant
corporativo embutido.

Não usar uma instância aceita ou populada como ensaio de primeira instalação.
Esse aceite exige um destino vazio específico já autorizado, sem apagar dados
ou configurar por engano o site existente para simular uma instalação nova.

O instalador recebe um ZIP pronto e não precisa de Node, Git ou CLI. O mantenedor
precisa de Node e do projeto irmão SPMIDDLE para preparar o pacote completo:

```powershell
node scripts/stage-installation-zip.js --version X.Y.Z
```

O ZIP em `dist/` inclui `LEIA-ME.txt` e
`CODIGO-PARA-COLAR-NAS-PAGINAS.txt`. A alternativa em árvore é:

```powershell
node scripts/stage-generic-installation.js --version X.Y.Z --output tmp/instalacao-nova
```

O estágio de instalação usa `all` mais host/snippets; `core` sozinho não é uma
instalação completa. A árvore contém `site/`, `administrator/`, `media/`,
`vendor/spmiddle/`, `host/` e o inventário `manifest.json`. O arquivo
`installation-entrypoints.json` usa formato `minijoomla-host-installation-v1`,
bootstrap `host/loader.js`, snippets público/administrativo e configuração
`<web>/SiteAssets/minijoomla/installation.json`; os indicadores de criação,
Sample Data, extensões automáticas e aprovação de publicação permanecem falsos. Empacotar não publica, provisiona, instala extensões,
aprova direitos de terceiros ou libera distribuição pública.

Antes de instalar, conferir:

- Site/web, biblioteca, pasta de release e as duas páginas corretas; assets
  server-relative, mesma origem e contenção dentro do web autorizado.
- Permissão de upload/edição de páginas e preflight real de `ManageLists` e
  digest. Ser membro não é uma prova universal dessas permissões.
- Pasta de release nova e imutável, sem sobrescrever arquivos publicados.
- Modern Script Editor aprovado no host e ausência de bootstrap concorrente.
- Leitura/gravação durável do journal para um destino ainda não instalado.

Copiar a árvore completa para SiteAssets. Usar a extração do ZIP somente se o
host oferecer esse recurso; caso contrário, fazer upload aprovado da árvore
completa. Não presumir que toda biblioteca possui uma ação “Extrair”. Criar
páginas `.aspx` pública e administrativa com Modern Script Editor; a raiz DOM,
não o nome da página, determina qual aplicação o loader monta.

## Host, CONFIG e layout

Exemplo público, substituindo as **duas** ocorrências de `__RELEASE_BASE__` pelo
mesmo caminho de release:

```html
<link rel="stylesheet" data-minijoomla-mse-layout href="__RELEASE_BASE__/host/spmiddle-layout/layout.css">
<div data-spmiddle-host data-spmiddle-instance="minijoomla-site" data-spmiddle-layout="FullBleed">
  <div data-minijoomla-site></div>
</div>
<script src="__RELEASE_BASE__/host/loader.js"></script>
```

A página administrativa usa o mesmo loader/release, com as mesmas duas
substituições de `__RELEASE_BASE__`:

```html
<link rel="stylesheet" data-minijoomla-mse-layout href="__RELEASE_BASE__/host/spmiddle-layout/layout.css">
<div data-spmiddle-host data-spmiddle-instance="minijoomla-admin" data-spmiddle-layout="FullBleed">
  <div data-minijoomla-admin-root></div>
</div>
<script src="__RELEASE_BASE__/host/loader.js"></script>
```

`FullBleed` e `Contained` são layouts do adaptador oficial SPMIDDLE. FullBleed
não é fullscreen, ocultação do chrome nem escape CSS `100vw`; o template
continua controlando sua própria largura. O legado sem wrapper pode ser
compatível, mas não deve conduzir a dois bootstraps. Os três assets oficiais do
adaptador devem manter bytes correspondentes à release. O loader aguarda o CSS
habilitado da mesma URL, com deadline, antes de ativar `layout.js`; CSS antigo,
outra URL ou promessa pendente não equivalem a prontidão.

O arquivo `host/host.js` (fonte `host-adapters/modern-script-editor/host.js`),
carregado pelo loader, deve conter exatamente um marcador
`/* MINIJOOMLA_CONFIG */ null` para injeção da configuração. Não usar substituição do primeiro marcador encontrado
nem fallback silencioso quando ele estiver ausente/duplicado. CONFIG deve
preservar web, biblioteca, releaseBase e o contrato de mesma origem. Em web raiz
`/`, a factory normaliza a base de transporte para `''`, evitando `//_api`.
Configuração operacional e evidências privadas não vão para Git ou exemplos.

O painel inspeciona e instala antes de montar a administração. `onInstalled`
só é chamado depois de `installed` validado, sem intenção pendente. Falha de
mount deve produzir alerta, não uma reinstalação automática. Erro em
`onInstalled` não desfaz a instalação nem apaga seu journal. `dispose()` deve ser
idempotente e remover somente listeners, timers e recursos pertencentes à
instância; navegação ou cleanup não autorizam novas escritas.

## Engine e plano de instalação

A engine pura é
`src/libraries/minijoomla/application/installation-service.js`. Ela recebe
port, `journalStore`, locks e preflight confiáveis. `inspect` é somente leitura;
`install` exige `confirm: true`, plano/token da última inspeção **da mesma
instância** e rechecagem das pré-condições. O token identifica uma serialização
operacional: não é credencial, autorização, lock distribuído nem segredo que
deva ser registrado em log público.

API da engine (dependências confiáveis da composição):

```js
const installation = createInstallationService({ port, journalStore, locks, preflight });
const inspection = await installation.inspect({ isCurrent });
const result = await installation.install({
  confirm: true, plan: inspection.plan,
  settings: { siteName: 'Meu site', siteDescription: '', timezone: 'UTC', language: 'pt-BR', pageSize: 10 },
  isCurrent, onProgress, onStage
});
// Reinício é outra ação explícita, com plano fresco; não é retry de pending.
// await installation.reset({ confirm: true, planToken: inspection.plan.token, isCurrent });
```

O envelope de inspeção inclui `status/reason/message/canResume/receiptPending`,
`summary/plan` quando validáveis e `configuration` somente se comprovada.
O plano contém `token/lists/domains/remainingDomains`; `settings` validados
pré-preenchem retomada sem substituir ajustes de uma operação parcial.
`onProgress` acompanha recibos; `onStage` acompanha estágios sem certificar writes.

Estados operacionais:

| Estado | Significado / ação |
| --- | --- |
| `ready` | Destino comprovadamente vazio, dependências e diário utilizáveis; exigir confirmação explícita. |
| `installed` | Recursos/configuração reconhecidos e verificados; não provisionar novamente. |
| `partial` | Há progresso durável; avaliar recibos e recuperação, não repetir o plano inteiro. |
| `blocked` | Recursos alheios, schema/configuração incompatível, destino ocupado ou pendência não conciliada; preservar dados. |
| `unavailable` | Inspeção, permissões, transporte ou diário não permitem concluir com segurança. |

`receiptPending` é intenção cuja conclusão é incerta, não prova de ausência.
Um instalado pode ser reconhecido em modo somente leitura e sem diário. Para
um destino novo, journal gravável é obrigatório. Corrupção, quota ou erro de
leitura não são “arquivo ausente” e não permitem fabricar configuração padrão.

Settings: `siteName` até 200 caracteres; `siteDescription` até 2000 na engine e
infraestrutura, mas **500 na UI atual** (`src/installation/template.js`);
`timezone` validada por Intl, padrão UTC; `language` até 35, padrão `pt-BR`;
`pageSize` inteiro 1–50, padrão 10. Essa diferença de limite é comportamento
atual, não justificativa para modificar o produto nesta curadoria.

Descritores são JSON simples, limitado, sem funções, getters ou hooks
executáveis. Essa validação não constitui sandbox contra objetos Proxy hostis.
Port, store e callbacks são dependências confiáveis da composição.

## Recursos, configuração e zero linhas

Instalação inicial cria **oito listas vazias e o arquivo operacional**, sem
artigos, módulos, extensões, template ou linha em `siteConfig`. Dados
exemplificativos são um fluxo posterior e separado.

| Domínio | Título padrão |
| --- | --- |
| `categories` | `MiniJoomlaCategories` |
| `tags` | `MiniJoomlaTags` |
| `articles` | `MiniJoomlaArticles` |
| `menu` | `MiniJoomlaMenu` |
| `extensions` | `MiniJoomlaExtensions` |
| `templates` | `MiniJoomlaTemplates` |
| `moduleInstances` | `MiniJoomlaModuleInstances` |
| `siteConfig` | `MiniJoomlaSiteConfig` |

A inspeção deve encontrar exatamente um recurso de cada domínio, IDs únicos,
`itemCount` coerente e schema real: nomes internos, tipos, required, choices,
default, índice, unicidade e fingerprint lido do backend. Um nome parecido não
permite adotar lista existente. Caminhos do port devem ser seguros,
server-relative e contidos no web.

`port.inspect()` fornece os oito relatórios completos, mais
`configuration/configurationETag/configurationExists`; `id` é string para lista
existente e null para ausente, `empty === (itemCount === 0)`. Fingerprint estável
até 512 caracteres é obrigatório até na ausência; lista compatível não tem
issues. Envelopes reduzidos/paginados ou domínios duplicados bloqueiam.

`port.provisionList(domain, { expectedAbsent: true, isCurrent })` usa `expectedAbsent` atômico e readback estrito, sem seed/adoption.
`port.verifyList(domain, id)` é somente leitura e comprova IDs, fingerprint, schema e estado vazio.
`port.writeConfiguration(configuration, { expectedAbsent: true, isCurrent })` é write-once com ausência esperada atômica, ETag forte e
readback de igualdade. ETag válido é quoted/forte; não usar wildcard, ETag fraco
ou fabricado. Falha de leitura não equivale a ausência.

O arquivo de formato `minijoomla-installation-v1` tem schema exato:
`webUrl/libraryPath`, `lists` com oito `{listId}`, `initialSite`,
`joomlaDiscoveryRoots/moduleStyles/moduleStyleRevisions` vazios e `state: installed`.
Chaves desconhecidas nesse schema inicial bloqueiam, sem reparar o arquivo.
O arquivo contém os oito IDs. Defaults lógicos
iniciais incluem Cassiopeia, featured, `homeCategory: ''`, `offline: false`,
roots/maps/styles vazios. Eles não são linhas provisionadas: a primeira
salvaguarda explícita da configuração materializa os ajustes. Em save parcial,
propriedade ausente não é override e `''` explícita deve ser preservada.
Configuração persistida e seu ETag têm precedência sobre defaults em memória.
`initialSite` chega tanto ao mount público quanto ao administrativo; defaults
não mudam `siteConfig.get()` null nem criam registros no mount. Salvar conteúdo
próprio pode bloquear Sample Data intencionalmente: aplicar exemplos antes.
Autoria editorial usa `Author0`, não `Author` de sistema; reaproveitar `Title`
nativo, não inventar `Title0`.

## Journal, concorrência e recuperação

O journal de formato `minijoomla-installation-journal-v1` contém
`webUrl/libraryPath/settings/receipts/pending/configurationReceipt`; recibos
identificam `domain/id/fingerprint`, pending identifica `kind: list` com domínio
ou `kind: configuration`, e o recibo final retém `{etag, configuration}`.
O store usa `read()/write(data)`, não aliases get/set; null é ausência, undefined
não é ausência.

A engine limita o diário canônico a 10 mil caracteres; o store suporta até
256 KiB e exige leitura de volta durável e exata. A ordem é **intenção antes da
escrita; recibo depois da verificação**. Se a escrita/remount falhar, conservar
informação suficiente para reconciliação, não limpar por conveniência.

Retomar só é seguro quando existe um **prefixo de listas próprias vazias
comprovado por recibos** e o sufixo está comprovadamente ausente. Uma intenção
pending incerta nunca deve ser repetida automaticamente. Reinspecionar e
reconciliar estado real; não interpretar timeout como ausência.

Reset é explícito, com plano novo. Pode remover apenas listas próprias vazias,
comprovadas por ID/schema/ETag, ou limpar o diário de destino totalmente vazio.
Não remove configuração instalada, conteúdo, listas alheias, assets ou páginas.
Limpeza do diário usa comparação e readback; falhas conservam o journal.
**Excluir itens para driblar retenção legal é proibido.** Teardown completo é
outra operação, com autorização, backups e análise das políticas de retenção;
não é alternativa automática quando o reset seguro bloqueia.

Locks compartilhados só coordenam o mesmo objeto/realm; Web Locks coordenam
abas da mesma origem, não clientes globais/distribuídos. `isCurrent` deve ser
checado antes/depois de awaits e primitivas, inclusive digest. Navegação impede
continuação obsoleta, mas não desfaz escrita já enviada ao transporte.

A UI exibe dez etapas apenas quando comprovadas. Preflight indeterminado,
controle de tempo e cleanup não podem produzir progresso fictício ou chamar o
resultado de instalado antes da leitura final.

Armadilhas SharePoint reutilizáveis:

- Criação OData usa metadata verbose. Um 400 em tentativa `nometadata` pode
  deixar conclusão incerta; não repetir criação sem reconciliação.
- `SP.Field` sem ETag tem exceção estreita para inicializar lista nova própria
  e vazia, seguida de readback. Não generalizar essa exceção para wildcard em
  atualização de recursos instalados.
- Recibo de reciclagem não é backup completo: schemas, anexos, relações e
  assets precisam de estratégia própria.

## Sample Data Joomla

Sample Data é opcional, confirmado separadamente e não pertence ao install.
A fonte Joomla está fixada no commit
`52559589cb6a02c9e2fc48270f92b3aff7b8b7a0`: `Blog.php`, INI en-GB, base MySQL e
JPEG Cassiopeia/banners. Conferir reprodução sem rede:

```powershell
node scripts/generate-joomla-sampledata.js --check
```

O plano contém 40 registros: 11 artigos, quatro categorias, quatro tags, oito
menus, quatro plugins, um template, sete módulos e uma configuração; são 12
JPEG. Criar IDs reais no destino, nunca impor os IDs Joomla. Preservar relações
Blog/Help/Joomla/Typography, a quarta tag filha da terceira e
SampleLayouts → CategoryList/Articles.

Cassiopeia Blog usa quatro leading, quatro intro e zero links. Módulos:
latest/older/archive/tags/related/search/banner. Menu e breadcrumb pertencem ao
shell, sem duplicação. Plugins emailcloak/loadmodule/pagebreak/pagenavigation
mantêm ordem. Styles vazios conservam CSS nativo; rotas PHP são traduzidas para
hash. Isso não implementa execução PHP, ACL ou usuários Joomla.

Mídia deve ser conferida por bytes/SHA-256/MIME/tamanho com cap de streaming,
e preservar créditos NASA/GPL e avisos. Reprodutibilidade não certifica direitos
ou marca; consulte [proveniência](PROVENIENCIA.md).

Fluxo: `mod_sampledata` → plugin blog translator →
`application/sample-data-service`, rota `#/sampledata`. Estados
`ready/installed/blocked/partial/pending/unavailable`: exigir confirmação;
`installed` desabilita aplicação sem adotar recursos; `blocked` preserva
personalização. O journal privado é segregado por origem/site/pacote, até
512 KiB, com readback. Corrupção/quota/indisponibilidade bloqueiam sem apagá-lo.
API não oferece replay de pending, delete, overwrite ou rollback automático.
Web Locks não garantem exclusão global.

`Folder` é reservado no SharePoint: manifests usam `group` em `ManifestJson`.
O erro histórico 400 após progresso parcial não autoriza replay integral do
plano. Conferir IDs, valores, ETags e instantes das datas; criar somente ausentes
com recibos conciliados. `CONFIG.sampleData` preserva releaseBase/mediaBase,
assets anteriores e assinaturas em upgrade, sem defaults corporativos.

Fixtures devem usar o mesmo realm e o campo `images:image_intro`; corrigir
fixtures em vez de afrouxar guards. Timeout lazy não é aceite. Quarenta registros
em memória ou confirmação dupla não são prova de aplicação no tenant. Gates
de migração, executor e acessibilidade permanecem separados.

## Atualização operacional e publicação

A opção `--mse-layout FullBleed|Contained` do script de deploy é explícita;
omiti-la preserva o caminho legado, sem migração silenciosa de layout.

Preparar atualização com configuração privada atual, sem refazer instalação:

```powershell
node scripts/stage-operational-upgrade.js --version X.Y.Z --output tmp/upgrade-novo --configuration tmp/config-operacional-private.json
```

Entrada: JSON UTF-8 regular, no máximo 256 KiB, com checks de contenção/links;
output deve estar ausente. Checks estáticos não prometem proteção TOCTOU contra
atacante local. Input/output operacionais permanecem privados, fora de Git e
da distribuição. O builder não publica, provisiona ou aplica seed.

Preservar CONFIG integral, inclusive campos desconhecidos, `discover: false`,
ordem e duplicação intencional de CSS, pins/revisões/roots e mediaBase. A injeção
usa `JSON.parse` de string escapada, preservando propriedade própria
`__proto__`, não literal de objeto executável.

Runbook de publicação, apenas para destino/efeitos já autorizados:

1. Ler Canvas/CONFIG e inventário frescos; identificar a webpart MSE exata e
   registrar o par coerente loader/configuração que permitirá recuperação.
2. Upload de **nova release**, sem overwrite. Conferir cada payload por bytes,
   SHA-256 e MIME independentes. Se interromper, enviar somente ausentes
   comprovados; não ativar árvore parcial.
3. Fazer preview somente leitura. Preview não é autorização para Publish.
4. Com ETag fresco, alterar somente `script`/`scriptCode` da MSE identificada;
   preservar outras webparts e propriedades. SharePoint pode normalizar texto:
   comparar DOM, atributos e JSON semanticamente, não apenas string bruta.
5. Publicar e verificar cada página conforme o fluxo autorizado. MERGE com
   ETag não prova Publish atômico nem transação entre as duas páginas.
6. Conferir loader/CONFIG/assets reais, contagens e erros do backend. Uma
   chamada `browser.evaluate` com `ok: true`, promessa rejeitada ou dados vazios
   não comprova sucesso: retornar erros/contagens/hashes explicitamente.

Toda abertura/inspeção de navegador corporativo, inclusive local, usa uma
instância própria de FIORI-AUTO e o fluxo browser_probe/RPC do workspace. Não
substituir por Playwright/Selenium direto ou CDP avulso.

## Rollback e limites de aceite

Rollback do host restaura um **par coerente** loader/CONFIG/assets ainda
disponíveis. Não apagar releases. Snapshot antigo não autoriza restaurar
globalmente o Canvas e sobrescrever alterações alheias: reinspecionar,
identificar a MSE e proteger a alteração com ETag fresco.

Recuperação de dados, configuração persistida e extensões é uma frente distinta,
com IDs e ETags atuais. Trocar o loader não reverte mutações do backend nem
constitui rollback integral de todos os domínios. Recibos/journals não são
backup completo nem autorização futura para delete.

Antes de anunciar aceite: verificar instalação realmente vazia, reentrada,
preflight, progresso verdadeiro, pending sem replay, configuração persistida,
releases imutáveis, MIME, host/layout, permissões, acessibilidade e recuperação
no destino abrangido. Testes locais e relatos antigos de publicação não provam
aceite remoto atual. As lacunas permanecem em [VALIDACAO](DESENVOLVIMENTO.md#validacao) e
[ESTADO](ESTADO.md), sem recriar um relatório por release/ciclo.

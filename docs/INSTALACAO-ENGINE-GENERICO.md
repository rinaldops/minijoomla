# Engine genérico de instalação MINIJOOMLA

## Escopo e estado de validação

O engine puro está em
[`src/libraries/minijoomla/application/installation-service.js`](../src/libraries/minijoomla/application/installation-service.js).
Não importa SPMIDDLE, transporte de rede, DOM, host ou templates executáveis.
É uma operação de **criação de infraestrutura**, não uma migração, adoção de
listas existentes, instalação de dados de exemplo ou edição de conteúdo.

Esta entrega foi validada **offline com ports em memória**. Não constitui teste
em tenant, publicação, aprovação de produção nem prova de exclusão distribuída.
Não modifica o bootstrap, painel ou adaptadores. A composição deve montar a
inspeção/instalação **antes** do core que exige as listas já existentes.

## API de aplicação

```js
import { createInstallationService } from './installation-service.js';

const installation = createInstallationService({ port, journalStore, locks });
const inspection = await installation.inspect({ isCurrent });
const result = await installation.install({
  confirm: true,
  plan: inspection.plan, // Alternativa: planToken: inspection.plan.token
  settings: { siteName: 'Meu site' },
  isCurrent,
  onProgress: ({ domain, completed, total }) => { /* renderizar progresso */ }
});
```

`inspect()` não escreve. Retorna `status`, `reason`, `message`, `canResume`,
`receiptPending`, e,
quando conseguiu validar o destino, `summary` e `plan`. `configuration` aparece
somente para uma instalação comprovada. O plano inclui `token`, `lists`,
`domains` e `remainingDomains`. `plan.lists` contém cópias validadas dos oito
relatórios de listas para apresentação segura pela UI. `settings`, quando
presente, contém os cinco ajustes normalizados do journal validado ou da
configuração instalada; deve pré-preencher o formulário de retomada. Não
derivar siteName do usuário nem substituir ajustes de uma operação parcial.
O token é uma serialização canônica limitada de dados
operacionais, não uma credencial, lock ou autorização por si só. É estável para
o mesmo snapshot/journal e deve vir da última inspeção bem-sucedida **da mesma
instância**. Inspeção `installed` não habilita plano de escrita e limpa qualquer
plano anterior. Não registrar tokens em logs públicos: incluem contexto e ajustes.

`install()` exige `confirm === true`, ajustes válidos e plano atual; relê o
destino e compara o token antes de escrever. Não executa callbacks recebidos
em ajustes/pacotes como mapeamentos de ações. Apenas `isCurrent`, `onProgress`
e ports explicitamente confiáveis são executáveis.

| Status | Significado |
| --- | --- |
| `ready` | Oito listas e configuração ausentes; instalação ainda não iniciada. |
| `installed` | Configuração válida e oito listas compatíveis com IDs corretos. Conteúdo posterior pode existir. |
| `partial` | Journal de operação interrompida. `canResume:true` somente com prefixo integralmente comprovado, vazio e sufixo ausente. |
| `blocked` | Listas preexistentes, conflitos, schema/relatório inválido, plano obsoleto, confirmação ausente ou operação local `busy`. |
| `unavailable` | Port/journal ausente, falha operacional de leitura/persistência ou cancelamento de contexto antes de iniciar. |

Uma configuração instalada válida com as oito listas pode ser reconhecida sem
journal (`journalStore` null/undefined), usando somente `port.inspect()` e os
caminhos de contexto. Isso é leitura, não autorização para instalar. Se as
listas/configuração estiverem ausentes sem journal durável, a inspeção retorna
`unavailable`, `reason:'journal-unavailable'`, nunca `ready`. `install()` sempre
exige ports de escrita e journal `read()/write(data)`. Store existente sem
`read`, corrupto ou cuja leitura falha não é tratado como ausência; pendências
legíveis continuam incertas. Journal somente leitura permite reconhecer uma
instalação comprovada, mas não iniciar/retomar escrita.

Após uma falha durante instalação o resultado imediato é conservador
(`canResume:false`). Uma nova `inspect()` decide se os recibos duráveis permitem
retomar. Não há rollback, delete, overwrite ou loop infinito.

`receiptPending:true` significa intenção sem recibo durável, não sucesso.
Inclusive se a leitura do arquivo/configuração estiver indisponível ou
conflitante, um journal validado com intenção mantém `partial`,
`reason:'uncertain-write'` e `canResume:false`. A UI não deve apagar esse estado
ou chamar `onInstalled` após um refresh como se a escrita incerta fosse sucesso.
`onInstalled(state.configuration)` só é apropriado quando o serviço retornar
`status:'installed'`, configuração validada e nenhuma pendência.

### Ajustes permitidos

- `siteName`: obrigatório, texto não vazio, até 200 caracteres; remove espaços
  nas extremidades.
- `siteDescription`: texto até 2.000 caracteres; padrão `''`.
- `timezone`: identificador aceito por `Intl.DateTimeFormat`; padrão `UTC`.
- `language`: tag simples de idioma até 35 caracteres; padrão `pt-BR`.
- `pageSize`: inteiro de 1 a 50; padrão `10`.

Chaves desconhecidas e valores null para campos tipados são recusados, não
silenciosamente descartados. Template, home, paths, callbacks de provisioning,
senhas e URLs arbitrárias não são opções do usuário. Payloads devem ser dados
JSON simples e limitados: sem getters, toJSON, funções, symbols, ciclos,
arrays esparsos ou protótipos exóticos. A inspeção de descriptors não é uma
sandbox contra `Proxy`; objetos executáveis hostis não são uma fronteira de
segurança suportada.

## Contrato dos ports confiáveis

`port.webUrl` e `port.libraryPath` são expostos pelo construtor do port e
definidos pelo contexto do host, não por
ajustes do formulário. Ambos são caminhos server-relative, sem origem, query,
fragmento, percent-encoding, barra invertida ou segmentos `.`/`..`;
`libraryPath` deve estar estritamente dentro de `webUrl`. O web raiz `'/'` é
aceito, por exemplo com `libraryPath:'/SiteAssets/minijoomla'`; cabe ao
adaptador traduzir esse contexto para sua convenção de runtime. Não há URL corporativa
embutida no engine ou em exemplos.

### `port.inspect()`

Retorna dados simples com o envelope **completo**:

```js
{
  lists: [{
    domain: 'categories', title: 'MiniJoomlaCategories',
    id: null, exists: false, compatible: false,
    empty: true, itemCount: 0, issues: [], fingerprint: 'schema-fingerprint'
  } /* os outros sete domínios, exatamente uma vez */],
  configuration: null,
  configurationETag: null,
  configurationExists: false
}
```

| Ordem canônica | Título obrigatório |
| --- | --- |
| `categories` | `MiniJoomlaCategories` |
| `tags` | `MiniJoomlaTags` |
| `articles` | `MiniJoomlaArticles` |
| `menu` | `MiniJoomlaMenu` |
| `extensions` | `MiniJoomlaExtensions` |
| `templates` | `MiniJoomlaTemplates` |
| `moduleInstances` | `MiniJoomlaModuleInstances` |
| `siteConfig` | `MiniJoomlaSiteConfig` |

`id` é string não vazia para lista existente e null para lista ausente. IDs
existentes não podem se repetir. `itemCount` é inteiro não negativo e
`empty === (itemCount === 0)`. `issues` é array limitado de strings; uma lista
compatível não pode reportar issues. `fingerprint` é string não vazia até 512
caracteres. Até a ausência deve ter fingerprint estável do schema esperado.
O engine aceita listas em ordem diferente, mas não ausência de domínios,
duplicatas, títulos diferentes ou relatório reduzido/paginado.

O port deve verificar estritamente nomes internos, tipos, required, choices,
defaults, índices/unique e demais restrições do schema current. O fingerprint
de uma lista existente deve representar **esse schema lido**, não só nomes,
ID, timestamps ou contagem de conteúdo. O engine não importa schemas de
infraestrutura nem substitui a responsabilidade de verificação do port.

Se o arquivo operacional existir, `configurationExists:true`,
`configuration` deve estar no schema abaixo e `configurationETag` deve ser ETag
**forte entre aspas**. Wildcard, ETag fraco, valor vazio e configuração sem
ETag são recusados. Não retornar `configurationExists:false` por erro de
permissão ou leitura; lançar o erro e deixar o engine indisponível.

### `port.provisionList(domain, { expectedAbsent: true, isCurrent })`

Cria **uma lista própria ausente**, com todos os campos, defaults e índices;
faz leitura/verificação estrita antes de retornar:

```js
{ id: 'list-id', fingerprint: 'strict-schema-fingerprint',
  compatible: true, empty: true, itemCount: 0 } // etag opcional
```

Pode incluir `domain`, `title`, `exists:true`, `issues:[]` e `etag`. Não deve
adotar lista surgida entre inspeção e criação. Deve tratar `expectedAbsent`
como precondição real, não sugestão. Se criação/verificação falhar, lançar:
mesmo um código aparentemente preciso não autoriza replay no engine. Não
criar linhas editoriais ou arquivos extras. Operações parciais dentro desse
port permanecem responsabilidade do adaptador e resultam em intenção incerta.
`isCurrent` é o guard original validado da aplicação ou uma função síncrona
que retorna true quando não foi fornecido. O port deve chamá-lo imediatamente
antes de **cada** mutação interna, inclusive depois de awaits de leitura ou
digest; se não retornar exatamente true, deve parar sem novas escritas. Não
inserir um await entre esse guard e a chamada da primitive de mutação.

### `port.verifyList(domain, id)`

Faz leitura estrita por identidade e retorna o mesmo envelope de verificação
acima. Para retomada, o engine exige ID e fingerprint **exatamente iguais**
ao recibo, compatibilidade e lista vazia. Não deve reparar campos, defaults,
índices ou conteúdo durante a leitura.

### `port.writeConfiguration(configuration, { expectedAbsent: true, isCurrent })`

Cria o arquivo operacional uma única vez e retorna
`{ etag: '"strong-etag"', configuration }`. Não sobrescreve arquivo existente,
inclusive em conflito ou resposta incerta. Deve impor ausência atomicamente
na primitive de escrita e retornar os dados efetivamente persistidos. O engine
exige igualdade exata com o enviado e faz novo `port.inspect()` para conferir
configuração, ETag, IDs, fingerprints e listas vazias antes do recibo final.
O mesmo guard `isCurrent` é propagado e deve ser rechecado pelo port após seus
awaits internos e imediatamente antes da primitive de criação do arquivo.

## Arquivo operacional e zero conteúdo inicial

```js
{
  format: 'minijoomla-installation-v1',
  webUrl: '/sites/example',
  libraryPath: '/sites/example/SiteAssets/minijoomla',
  lists: { categories: { listId: 'list-id' } /* oito domínios exatos */ },
  initialSite: {
    siteName: 'Meu site', siteDescription: '', timezone: 'UTC',
    language: 'pt-BR', pageSize: 10, templateKey: 'cassiopeia',
    homeView: 'featured', homeCategory: '', offline: false, offlineMessage: ''
  },
  joomlaDiscoveryRoots: [], moduleStyles: {}, moduleStyleRevisions: {},
  state: 'installed'
}
```

O schema raiz, `lists` e `initialSite` são exatos; chaves desconhecidas são
recusadas sem alterar o arquivo existente. `joomlaDiscoveryRoots` e os dois
mapas de estilos devem estar vazios neste schema de instalação inicial.
Configuração posterior de extensões pertence a outro fluxo explicitamente
autorizado; não é normalizada ou sobrescrita por este engine.

Não se cria linha `siteConfig`, registro de template, módulo, artigo ou
qualquer dado editorial. Assim, as oito listas ficam vazias e o mecanismo de
dados de exemplo existente mantém sua precondição. A composição futura deve
passar `configuration.initialSite` tanto para a configuração pública de
`mountSite` quanto para `createMiniJoomlaAdminApp`/configuração de `mountAdmin`,
aplicando overrides
editoriais existentes posteriormente. Esses defaults não equivalem a registro
editorial nem mudam o guard de dados de exemplo. Depois de personalizar e
salvar linhas pelo painel, a instalação de dados de exemplo pode ser bloqueada
intencionalmente; instalar exemplos antes dessa personalização.

## Journal durável e retomada

`journalStore.read()` retorna null ou dados simples. `journalStore.write(data)`
persiste dados simples, ambos síncronos ou assíncronos. O store deve ser próprio
da instalação/destino, limitado e não conter segredos. O engine limita o
journal a 10.000 caracteres canônicos, lê após cada write e exige igualdade.
O factory de infraestrutura
[`createInstallationJournal`](../src/libraries/minijoomla/infrastructure/installation-journal.js)
usa exatamente `read()/write(data)` síncronos, com persistência JSON privada
limitada a 256 KiB. O limite maior do store não amplia o limite de 10k do
engine e não oferece transação cross-user/browser. Não são necessários aliases
`get/set` ou alteração do factory para integrar o engine.
`undefined`, JSON corrompido, callbacks ou chaves desconhecidas não são null.
Nada disso é apagado, consertado ou sobrescrito automaticamente.

Schema:

```js
{
  format: 'minijoomla-installation-journal-v1',
  webUrl: '/sites/example', libraryPath: '/sites/example/SiteAssets/minijoomla',
  settings: { siteName: 'Meu site', siteDescription: '', timezone: 'UTC',
    language: 'pt-BR', pageSize: 10 },
  receipts: [{ domain: 'categories', id: 'list-id', fingerprint: 'schema-fp' }],
  pending: null, // ou { kind:'list', domain:'tags' } ou { kind:'configuration' }
  configurationReceipt: null // ou { etag:'"strong-etag"', configuration:{...} }
}
```

1. Inspecionar ausência integral e comparar plano confirmado.
2. Persistir journal e intenção antes de cada escrita de port.
3. Reler journal/destino e conferir precondições após persistir intenção.
4. Criar uma lista, receber verificação estrita e persistir recibo `{domain,id,fingerprint}`.
5. Repetir apenas o sufixo de um prefixo com recibos duráveis, IDs/fingerprints
   exatos, listas vazias e nenhum estado estranho no sufixo.
6. Verificar novamente as oito listas, gravar configuração write-once,
   reler/validar configuração e strong ETag, persistir recibo final.

Intenção sem recibo é **incerta e nunca retomável automaticamente**, mesmo se
a lista parecer correta ou todas as listas/configuração estiverem presentes.
O reinício explícito descrito abaixo trata o destino vazio ou listas com recibos
comprovados. Nos demais casos é necessária reconciliação humana/host autorizada.
Não
repetir, adotar ou sobrescrever a primitive incerta. Recibos cuja identidade,
schema, ajustes ou configuração/ETag divergem bloqueiam. Um arquivo instalado
completo e válido pode ser inspecionado sem journal local; se houver journal,
ele precisa corresponder integralmente ao estado comprovado.

## Concorrência e navegação

### Reinício explícito e pré-requisitos (0.17.6)

`createInstallationService({port,journalStore,locks,preflight})` aceita uma
checagem confiável de dependências. `inspect()` verifica os pré-requisitos
antes de oferecer instalar; `install()` os repete antes de persistir o diário.
Instalação já comprovada não executa checagens de escrita ou ManageLists para
leituras normais do CMS. O host genérico verifica o SPMIDDLE vendorizado no ZIP.

`reset({confirm:true,planToken:inspection.plan.token,isCurrent})` não repete
uma criação incerta. Relê o destino e o diário, recusa configuração existente,
conteúdo, schema alterado ou listas sem recibo, e remove apenas listas vazias
cujo ID/fingerprint corresponde ao recibo. Usa o port específico
`removeVerifiedEmptyList(receipt,{confirm:true,isCurrent})` e ETag exata da lista.
Se nada foi criado, limpa apenas o diário local desse destino. `journalStore.clear`
compara o registro esperado antes de limpar e confirma a remoção. Falhas ou
conflitos preservam o diário. A operação é protegida pelo mesmo lock de instalar.

`onStage` é um callback de acompanhamento opcional, separado dos recibos de
`onProgress`: anuncia pré-requisitos, lista atual, configuração final e conclusão.
Não certifica escrita antes do recibo nem altera o plano. A UI usa uma barra de
dez etapas comprovadas, indeterminada durante a checagem inicial, com tempo
decorrido e limpeza dos timers/listeners em todas as saídas.

Há exclusão local `busy` para engines que compartilham **o mesmo objeto**
`journalStore` no mesmo realm JavaScript. Não cobre stores distintos, abas,
processos ou sessões. `locks.withLock(operation)` pode ser injetado por um
host confiável e deve abranger a operação inteira para o mesmo destino;
somente esse provider pode declarar garantias de exclusão distribuída.

Leituras em fronteiras reduzem concorrência lateral, mas não criam transação
global: o port ainda deve impor ausência atomicamente. O engine não obtém
locks globais automaticamente e não se apresenta como sandbox ou proteção
universal contra escritores externos.

`isCurrent()` deve retornar exatamente true enquanto contexto estiver atual;
o engine checa antes/depois dos awaits e imediatamente antes de cada escrita
de port/journal. O engine não introduz await entre seu guard e a chamada de
escrita; além disso, propaga o guard às duas operações de escrita de port para
cobrir fronteiras internas de leitura/digest. Navegação não desfaz escrita já em voo. Se ocorrer depois
da primitive e antes do recibo, a intenção permanece incerta, sem escrita
adicional para limpar ou adotar. `onProgress` recebe apenas dados próprios
após recibo durável da lista; erro/interrupção pode deixar prefixo retomável.

## Testes locais

[`tests/installation-service.test.js`](../tests/installation-service.test.js)
exporta `runInstallationServiceTests()`. Importar não agenda execução; o runner
deve **aguardar** essa função. Comando isolado:

```powershell
node --input-type=module -e "const { runInstallationServiceTests } = await import('./tests/installation-service.test.js'); await runInstallationServiceTests();"
```

Cobertura: ausência integral, plano estável/obsoleto, confirmação, defaults,
zero conteúdo, relatórios completos/duplicados, contexto seguro, dados simples,
getters/toJSON não executados, retomada por prefixo, IDs/fingerprints/restrições,
quota/readback, intenção incerta, arquivo write-once, ETag forte, navegação,
fronteiras de concorrência e dois engines no mesmo objeto de journal.
Inclui instalação válida sem journal, indisponibilidade de instalação ausente
sem journal, stores existentes corrompidos/pendentes e cancelamento honrado
pelo port após awaits internos antes de criar lista ou arquivo operacional.

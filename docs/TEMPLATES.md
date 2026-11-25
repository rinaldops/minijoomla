# MINIJOOMLA — TEMPLATES

## Como ler: evidência local × produção

- **Local** = ensaio offline (Node/fixtures/preview), sem rede, sem publicação; não é “ambiente DEV”.
- **Produção** = tenant corporativo real. Quando citado “validado em produção”, é evidência histórica delimitada (não autorização para repetir operações).

---

<a id="visão-geral"></a>
## Visão geral

MINIJOOMLA suporta:

1. **Templates builtin** (`default`, `cassiopeia`): registrados por `import` estático (`BUILTINS`).
2. **Templates instalados** (externos): registrados por manifesto e carregados em runtime via `import()` dinâmico, com gates de URL/mesma-origem.

### Página inicial somente com módulos (0.17.10)

Em **Configuração global → Página inicial**, desmarque **Exibir componente na
página inicial**. O padrão é marcado (**Sim**). A home deixa de executar/renderizar
o componente de conteúdo e seu breadcrumb automático “Início”: não aparecem o
nome/descrição do site desse componente, artigos, paginação nem “Nenhum artigo
encontrado.”. Artigos, categorias, busca e demais rotas continuam normais; avisos
reais de erro e manutenção não são ocultados.

Os módulos publicados mantêm posições e atribuições. Menus, marca, rodapé e um
módulo de breadcrumbs criado explicitamente são controles separados; a opção não
apaga `siteName`, `siteDescription`, artigos ou parâmetros existentes. Cassiopeia
remove a coluna central quando não há módulos/conteúdo central e mantém um único
landmark `main`, o alvo `main-content` e o link “Pular para o conteúdo”.

A preferência persiste em `ComponentParamsJson` como
`{"home":{"showComponent":false}}`, preservando os demais namespaces e campos,
sem coluna nova ou migração de lista. Salvar **Sim** grava uma preferência capaz de
prevalecer sobre um **Não** inline. Registros sem namespace `home` preservam o
valor inline ou o padrão Sim; JSON legado ilegível mantém os defaults públicos
seguros. Valores inválidos em um namespace `home` declarado são erros de
configuração, não decisões de ocultação automática.

O runtime fornece `componentVisible` ao `renderShell` (padrão `true`; `false`
somente na home modular normal). Templates instalados devem respeitar esse sinal
e manter a região principal acessível para oferecer a mesma remoção de espaço
residual. Os dois builtins utilizam o Cassiopeia e suportam esse contrato.

---

<a id="contrato-de-template-instalado-mecanismo-genérico"></a>
## Contrato de template instalado (mecanismo genérico)

### 1) Manifesto (`<key>.manifest.json`)

Forma mínima:

```json
{
  "title": "Nome amigável",
  "version": "0.1.0",
  "entryPointUrl": "./index.js",
  "positions": ["footer", "minha-posicao-custom"],
  "styles": ["./css/template.css"],
  "paramDefinitions": []
}
```

Regras essenciais:

- `title`/`version`/`entryPointUrl` obrigatórios.
- **Gates administrativos e gates de runtime não são iguais**:
  - Admin: entrypoint relativo `.js`/`.mjs` (sem esquemas absolutos); CSS pode aceitar HTTPS.
  - Runtime: entrypoint **.js** e CSS **.css** restritos à **mesma origem/protocolo do host**, sem traversal/credenciais.
- `discoveredFrom` registra proveniência; **não rebaseia URLs**.
- Runtime resolve URLs contra `documentRef.baseURI` (ou `import.meta.url`), **não contra o manifesto**.

### 2) Posições: declaração aberta com forma bem-definida

- `STRUCTURAL_TEMPLATE_POSITIONS`: lista estrutural mínima (piso).
- `isWellFormedPositionName(value)`: valida forma (`/^[a-z][a-z0-9-]{1,40}$/`).

Regras:

- Posição aceita se estrutural **ou** bem-formada.
- Lista densa 1..100; remove duplicados; não executa getters/hooks.
- `component` é metadata do template, **nunca** posição atribuível a módulo.

Consequências:

- Dropdown de posição no admin = união de posições estruturais (menos `component`) com posições declaradas por templates registrados.
- Posição órfã preexistente: permanece na edição de título; nova criação/duplicação exige catálogo atual.
- Roteamento em runtime: template instalado ativo fornece `activeTemplatePositions` a `resolveModuleEntries(...)`; builtins seguem caminho legado.

### 3) Parâmetros de estilo declarados: persistência e compatibilidade

**Persistência e compatibilidade:**

- Schema físico ainda declara `ParamDefinitionsJson` (histórico); não alegar que nunca existiu.
- Persistência atual usa envelope em `Styles`: `minijoomla-template-metadata-v1` (`{ format, styles, paramDefinitions, ... }`).
- CSS/paths legados (sem envelope) continuam legíveis.

Limites e hardening:

- Envelope: **64 KiB**; lista de CSS: **50** itens.
- Tipos/limites vêm do catálogo declarado (`declared-params.js`, `PARAM_TYPES`).
- Descriptors são dados; **não são sandbox para Proxy**.

PATCH:

- PATCH altera somente o estilo editado; preserva chaves futuras, strings numéricas e metadata de outros estilos.

### 4) Resolução em runtime (`template-runtime.js`)

- Builtin: `BUILTINS[key]` (import estático).
- Instalado: gate de URL + `import()` dinâmico.

Contrato do pacote instalado:

- Exportar `renderShell` (preferido) ou `default` como função.
- Assinatura: `({ config, menus, breadcrumbs, content, modules, busy }) => HTML`.
- Pode exportar `bindShell(root)` para progressive enhancement, retornando cleanup opcional.

### 5) Ensaio offline de template instalado (`scripts/serve-local.js --extra-root`)

- `--extra-root <prefixo>=<caminho>` monta raiz estática extra **apenas para ensaio offline**.
- Mesmas regras de containment/rejeição de traversal/symlink.
- **Não existe equivalente em produção**: em produção, arquivos do pacote precisam estar publicados no site.

### 6) Fluxo real de instalação (produção)

1. Publicar MINIJOOMLA (com builtins).
2. Publicar os arquivos do pacote do template no mesmo site.
3. Registrar manifesto no painel (`/installer` ou `/templates/discover`).
4. Selecionar template ativo e editar estilos.

### 7) Revisão oficial de um template já registrado

O registro inicial continua sendo feito por manifesto. Para uma release
posterior de um template externo já registrado, o caminho oficial é o
`template-revision-service` (não a descoberta novamente e não um PATCH raw
artesanal). A revisão publica primeiro uma pasta imutável/versionada e então
atualiza seletivamente o registro existente, preservando sua identidade e a
configuração do site.

Interface pública:

```js
createTemplateRevisionService({ admin, repositories, files, webUrl })
// -> { prepare, commit, rollback }
```

`prepare({ templateId, candidate, isCurrent })` é somente leitura e exige
`templateId` inteiro. O `candidate` contém obrigatoriamente
`{ baseUrl, manifestPath, inventoryPath, inventoryHash }`; o hash do inventário
é um pin externo ao próprio arquivo. O inventário não precisa conter hash de si
mesmo: não há autorreferência circular. O serviço captura o template e a
configuração do site, incluindo `expectedETag: { template, config }`, e lê
manifesto/inventário/assets por `files` sem importar ou executar o entrypoint.
A preparação só retorna `status: 'ready'` quando:

- a key é a mesma e `positions` e `paramDefinitions` são equivalentes exatos,
  inclusive ordem e campos futuros relevantes;
- entrypoint e styles apontam para a mesma origem/base do host e para a nova
  pasta versionada, sem traversal, credenciais ou esquemas indevidos;
- o manifesto, o entrypoint, cada style e todos os demais arquivos declarados
  estão representados no inventário; cada entrada comprova `path`, `bytes` e
  `sha256`, e o digest externo `inventoryHash` confere; o inventário não
  inclui a si próprio como entrada;
- o snapshot preserva o JSON wire bruto original de `Styles`, inclusive o
  formato legacy de lista CSS, o envelope e metadata futura, e guarda os hashes
  dos assets legacy atuais, sem reserialização destrutiva;
- essa verificação é somente de integridade dos arquivos declarados: não é
  fechamento transitivo nem análise AST de imports JS/CSS.

O retorno `ready` contém `reason: 'ready'`, `plan`,
`snapshot: { template, siteConfig, assets }` e
`expectedETag: { template, config }`. `plan` e o receipt são serializáveis,
mas ficam ligados à instância/sessão do serviço e não constituem journal
durável. Qualquer alteração de identidade, slots, parâmetros, base, bytes ou
hash faz a preparação falhar antes de escrita.

`commit({ plan, confirm: true, expectedETag: { template, config }, isCurrent })`
relê o template e a configuração, revalida manifesto/inventário/bytes e só então
faz **uma** escrita de
`repositories.templates.update(id, { version, entryPointUrl, styles }, { etag: template })`.
Não altera `MiniJoomlaSiteConfig`, posições, parâmetros, enabled, key ou outras
listas. O patch preserva o metadata do envelope `Styles`; não reconstrói nem
descarta chaves futuras. Após a escrita, o readback do registro e de seu novo
ETag é obrigatório, mas `null`, `204`, timeout ou erro depois do dispatch da
escrita permanece `uncertain` e não pode ser repetido automaticamente, mesmo
que um readback pareça favorável. O retorno confirmado é
`{ status: 'committed', plan, committedAt, postUpdateETag, rollback }`.

`rollback({ rollback, confirm: true, expectedETag: { template, config }, isCurrent })`
somente pode restaurar o snapshot de uma revisão própria. Deve reler o registro,
comparar o ETag do commit (`template`), id/key e os bytes/URLs atuais; divergência
bloqueia a operação. O rollback também é um PATCH seletivo exclusivo do
registro, restaurando o wire bruto legacy de `Styles` e sem escrita de SiteConfig.
Nunca usar ETag `*`. Como não existe transação cross-list, `null`, `204`, timeout
ou erro depois do dispatch permanece `uncertain`, sem retry automático, ainda que
um readback posterior pareça favorável; exige leitura/decisão explícita antes de
qualquer ação.

Operações retornam resultados estruturados, sem transformar falhas em sucesso:

| Fase | Sucesso | Bloqueios sem nova escrita |
| --- | --- | --- |
| `prepare` | `ready` | `unavailable`, `validation-failed`, `concurrency-conflict` |
| `commit` | `committed` | `confirmation-required`, `validation-failed`, `concurrency-conflict`, `uncertain` |
| `rollback` | `rolled-back` | `confirmation-required`, `validation-failed`, `concurrency-conflict`, `uncertain` |


#### Retenção operacional da sessão

A sessão mantém no máximo **16 planos/recibos** em estados que ainda podem
participar de I/O (incluindo prepares pendentes e recibos de rollback utilizáveis).
O 17º prepare é `unavailable` **antes** de novas leituras ou downloads; não há
eviction para abrir espaço. Um commit bem-sucedido transforma o plano em recibo
e conserva o slot até o rollback terminar. Estados terminais, inclusive
`uncertain`, liberam o payload operacional e não podem ser reutilizados para
replay; em particular, um rollback utilizável nunca é removido por eviction.

A sessão retém no máximo **128 tokens terminais** para rejeitar replay tardio.
A eviction ocorre somente entre tokens já terminais; nunca remove um rollback
utilizável. Não existe TTL nem journal durável: a retenção é limitada à instância
/sessão viva, e perder a instância perde essa memória de forma deliberada.

`isCurrent` deve interromper antes de qualquer nova escrita. `plan` inválido,
key diferente, posições/paramDefinitions divergentes, inventário incompleto,
entrypoint/style ausente do inventário, path/bytes/sha256 divergente, digest
externo divergente, dependência ausente ou URL fora do containment são falhas
fechadas. Integridade declarada não equivale a fechamento transitivo AST. A revisão altera somente a referência de release (`version`,
`entryPointUrl`, `styles`); ativação do template, publicação e aceite LIVE
continuam passos separados do Main.

### 8) O que garante × o que não garante

Garante:

- Posições e parâmetros declarados sem editar o núcleo.
- Gates de URL/mesma-origem do runtime.
- Preservação de metadata futura no envelope.

Não garante:

- Aceite visual (precisa FIORI-AUTO por template).
- Publicação/cópia dos arquivos do pacote.
- Migração automática via UI XML sem contrato próprio.

---

<a id="cassiopeia-template-público"></a>
## Cassiopeia (template builtin público)

### Estrutura/posições/aliases (resumo)

- Posições: `topbar`, `below-top`, `menu`, `search`, `banner`, `breadcrumbs`, `top-a`, `top-b`, `main-top`, `sidebar-left`, `sidebar-right`, `main-bottom`, `bottom-a`, `bottom-b`, `footer` (+ `component`).
- Aliases: `modules.content` → `main-top`; `modules.sidebar` → `sidebar-right`.

### Parâmetros de estilo (resumo)

- Fontes (ordem): `config.templateParams`, `config.styleParams`, `config.template.params`.
- JSON inválido usa defaults e emite 1 warn com razões, **sem** logar valores.
- Principais: `brand`, `logoFile`, `siteTitle`, `siteDescription`, `colorName`, `useFontScheme`, `fluidContainer`, `stickyHeader`, `backTop`.

### `bindShell` e acessibilidade (resumo)

- Menu mobile + Escape + foco no resize + skip/back-top sem alterar hash do router.

---

<a id="apresentação-pública-independente--estado-publicado"></a>
## Apresentação pública independente (CSS Cassiopeia neutro)

Estado histórico descrito: CSS neutralizado publicado no público 0.2.11.

Preservar explicitamente:

- Não é distribuição oficial do Joomla.
- Não é promessa de equivalência pixel a pixel.
- Sem fontes/ativos externos; seletores escopados.
- Rollback sempre seletivo (reler canvas/ETag → MERGE com ETag → Publish → verificação).

Aceites ainda abertos:

- zoom real 200%/400%, `forced-colors` real, leitor de tela.
- revisão visual integral (conteúdo real, textos longos, menus 3 níveis etc.).

---

<a id="lições-de-ciclo--posições"></a>
<a id="lições-de-ciclo--parâmetros"></a>
## Cuidados operacionais

As regras de posições órfãs, envelope de metadados, limites e PATCH estão no
contrato acima; não há um contrato diferente por ciclo de desenvolvimento.
Além dessas regras:

- Não relaxar CSP para fazer fixture funcionar; visualizador HTML SharePoint
  não equivale ao documento real.
- Upload parcial ou hash conferido não comprova publicação ou aceite no tenant.
- O registro manual permanece desabilitado por padrão; registrar não escolhe
  automaticamente o template ativo nem substitui estilos já salvos.

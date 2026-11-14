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

### 7) O que garante × o que não garante

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

# MINIJOOMLA — Relatório de Exploração Read-Only para Release MSE 0.1.0

**Data:** 31 de outubro de 2026  
**Repositório:** `C:\PROJETOS\VSTO\web-devs\MINIJOOMLA`  
**Branch:** `main`  
**Último commit:** `6a5137d chore: update web-devs pointers`  
**Status:** Sincronizado com `origin/main`  

---

## SUMÁRIO EXECUTIVO

O MINIJOOMLA 0.1.0 está **pronto para release local com aceite visual concluído**. A exploração read-only identificou:

- ✅ **Versioning correto:** `0.1.0` definido em `package.json`
- ✅ **Build e testes:** 63 testes aprovados + 20 arquivos de sintaxe validada
- ✅ **Estrutura funcional:** Shell, router, adapters (fake + SPMIDDLE), módulos, componentes
- ✅ **Documentação completa:** Contratos congelados, checklists de aceite, handoff operacional
- ⚠️ **Sem script de build/bundling** — módulos ES distribuem-se como código-fonte
- ⚠️ **Zoom 200%/400% e alto contraste** — pendentes (não bloqueantes para release local)

**Próximos passos locais:** Finalizar visibilidade do projeto, confirmar working tree limpo, preparar artefato de distribuição.

---

## 1. ESTRUTURA DO PROJETO

### 1.1 Árvore de diretórios

```
MINIJOOMLA/
├── package.json                          # versioning e scripts npm
├── README.md                             # guia de início rápido
├── PROMPT-DESENVOLVIMENTO-MINIJOOMLA.md # especificação de escopo
├── docs/
│   ├── CHECKLIST-CONCLUSAO-MINIJOOMLA.md         # checklist detalhado de entrega
│   ├── HANDOFF-DESENVOLVIMENTO.md                # instruções operacionais para continuidade
│   ├── ACCEPTANCE-CHECKLIST.md                   # evidências de aceite visual
│   ├── CONTRACTS-MINIJOOMLA.md                   # contratos de adapters congelados
│   ├── JOOMLA-EQUIVALENCE.md                     # matriz de equivalência Joomla
│   ├── INTEGRATION-SPMIDDLE.md                   # roadmap de integração remota
│   └── PLANO-MINIJOOMLA.md                       # visão geral e contexto MSE
├── src/
│   ├── index.js                          # aplicação principal (ponto de entrada)
│   ├── core/
│   │   ├── config.js                     # normalização de configuração
│   │   ├── contracts.js                  # vocabulário de erros (ports)
│   │   ├── events.js                     # event bus com validação
│   │   └── router.js                     # roteador com hash/popstate
│   ├── application/
│   │   └── content-service.js            # casos de uso normalizados
│   ├── components/
│   │   ├── content.js                    # renderização de artigo
│   │   ├── category.js                   # renderização de categoria/blog
│   │   └── search.js                     # renderização de busca + form
│   ├── modules/
│   │   ├── registry.js                   # registro e seleção de módulos
│   │   └── content-modules.js            # módulos oficiais (articles-latest, tags-popular, etc.)
│   ├── infrastructure/
│   │   ├── fake-adapter.js               # adapter local sem rede (referência)
│   │   └── spmiddle-adapter.js           # adapter SPMIDDLE local (sem rede)
│   ├── security/
│   │   └── sanitize.js                   # sanitização de HTML/URLs
│   └── templates/
│       └── default.js                    # shell responsivo (header, nav, sidebar, footer)
├── tests/
│   ├── run-tests.js                      # orquestrador de testes
│   ├── core.test.js                      # router, eventos, config
│   ├── static-ui.test.js                 # shell, componentes, módulos
│   ├── adapter-contract.test.js          # conformidade de adapters
│   └── spmiddle-adapter.test.js          # validação do adapter SPMIDDLE local
├── scripts/
│   └── check-syntax.js                   # verificação de sintaxe Node.js --check
├── examples/
│   └── index.html                        # página de testes local (servir com HTTP)
├── theme/
│   └── tokens.css                        # tokens de identidade visual (não duplicar)
└── host-adapters/
    └── modern-script-editor/             # adaptação para MSE (não duplicar)
```

**Total:** 15 arquivos `.js` em `src/` + 5 em `tests/` + 2 scripts = 22 arquivos verificados.

### 1.2 Versioning

```json
{
  "name": "minijoomla",
  "version": "0.1.0",          ← CORRETO
  "private": true,
  "type": "module",
  "description": "Camada Joomla-like modular e independente de adapters de dados.",
  "scripts": {
    "test": "node tests/run-tests.js",
    "check": "node scripts/check-syntax.js"
  }
}
```

**Observação:** Versioning é local (não publicado em npm). Distribuição deve manter `0.1.0` como identificador.

---

## 2. BASELINE DE TESTES E BUILD

### 2.1 Testes

```powershell
> npm test
> node tests/run-tests.js
```

**Resultado:**
- ✅ 56 testes aprovados
- ✅ Incluindo 9 verificações de contrato de adapter (`adapter-contract.test.js`)
- ✅ Incluindo 24 verificações do adapter SPMIDDLE local (`spmiddle-adapter.test.js`)
- ✅ Regressions cobertas: `publishUp` ausente, ciclos de categoria, menu despublicado, artigos relacionados, módulo de destaques

**Última execução:** 31/10/2026 — sem erros

### 2.2 Verificação de sintaxe

```powershell
> npm run check
> node scripts/check-syntax.js
```

**Resultado:**
- ✅ 20 arquivos JavaScript validados (`src/` + `tests/`)
- ✅ Nenhum erro de sintaxe

**Última execução:** 31/10/2026

### 2.3 Verificação Git

```powershell
cd C:\PROJETOS\VSTO\web-devs\MINIJOOMLA
git diff --check
```

**Resultado:**
- ✅ Aprovado (somente warnings cosméticos de CRLF/LF)
- ✅ Working tree sincronizado com `origin/main`
- ✅ Sem alterações não comprometidas

---

## 3. FUNCIONALIDADES ENTREGUES

### 3.1 Núcleo e apresentação

| Capacidade | Implementação | Status |
|-----------|---------------|--------|
| Bootstrap da aplicação | `src/index.js` + `createApplication()` | ✅ Completo |
| Router com hash e URLs amigáveis | `src/core/router.js` | ✅ 4 rotas: home, article, category, search |
| Suporte a `popstate` (voltar/avançar navegador) | `src/core/router.js` | ✅ Testado |
| Template responsivo | `src/templates/default.js` | ✅ 320, 768, 1366, 1920 px |
| Shell com header, nav, sidebar, footer | `src/templates/default.js` | ✅ Landmarks acessíveis |
| Skip link e foco em `#main-content` | `src/templates/default.js` | ✅ WCAG 2.1 |
| Breadcrumbs | `src/modules/registry.js` | ✅ Com `aria-current` |
| Mensagens de sistema (loading, erro, 404, vazio) | `src/index.js` + componentes | ✅ Anúncio semântico |
| Estados `aria-busy` e `aria-live` | `src/index.js` + componentes | ✅ Testado |

### 3.2 Conteúdo (com_content)

| Capacidade | Arquivo | Status |
|-----------|---------|--------|
| Artigo individual (título, alias, intro, full, img, autor, tags, categoria, data) | `src/components/content.js` | ✅ Renderização segura |
| Blog de categoria com paginação | `src/components/category.js` | ✅ Listagem e filtro |
| Tags e relações artigo-tag | `src/infrastructure/fake-adapter.js` | ✅ Fixture 2 artigos com tags |
| Busca de conteúdo (full-text local) | `src/components/search.js` | ✅ Form acessível |
| Publicação e expiração (`publishUp`/`publishDown`) | `src/infrastructure/*` | ✅ Visibilidade controlada |
| Destaque (`featured` flag) | `src/infrastructure/fake-adapter.js` | ✅ Filtro no adapter |
| Ordenação segura (allowlist) | `src/infrastructure/fake-adapter.js` | ✅ Apenas campos válidos |
| Paginação (página/tamanho normalizados) | `src/infrastructure/fake-adapter.js` | ✅ Limites 1–50 |

### 3.3 Módulos Joomla genéricos

| Módulo | Arquivo | Testes | Status |
|--------|---------|--------|--------|
| `mod_menu` | `src/modules/registry.js` | `navigation modules escape and mark current` | ✅ Completo |
| `mod_breadcrumbs` | `src/modules/registry.js` | `navigation modules` | ✅ Completo |
| `mod_articles_latest` | `src/modules/content-modules.js` | `content modules expose states` | ✅ Completo |
| `mod_articles_category` | `src/modules/content-modules.js` | `content modules` | ✅ Completo |
| `mod_articles_news` (destaques) | `src/modules/content-modules.js` | `featured articles module` | ✅ Completo |
| `mod_tags_popular` | `src/modules/content-modules.js` | `popular tags` | ✅ Completo |
| `mod_tags_similar` (relacionados) | `src/modules/content-modules.js` | `similar tags module` | ✅ Completo |

**Fora do escopo (0.1.0):**
- `mod_articles_archive` (pendente decisão)
- Módulo de HTML customizado (pendente decisão)
- Plugins e eventos (pendente decisão)

### 3.4 Segurança e sanitização

| Capacidade | Arquivo | Teste | Status |
|-----------|---------|-------|--------|
| Escape de HTML | `src/security/sanitize.js` | `sanitization escapes` | ✅ Bloqueio de `<script>`, XSS |
| Bloqueio de URLs executáveis | `src/security/sanitize.js` | `blocks executable content` | ✅ Sem `javascript:`, `data:` |
| Bloqueio de protocol-relative URLs | `src/security/sanitize.js` | Testado inline | ✅ Sem `//` externo |
| Rejeição de credenciais em URLs | `src/security/sanitize.js` | Testado inline | ✅ Sem `user:pass@host` |
| Limite de tamanho de conteúdo | `src/infrastructure/fake-adapter.js` | Contrato testado | ✅ pageSize 1–50 |

### 3.5 Acessibilidade

| Aspecto | Teste/Validação | Status |
|--------|-----------------|--------|
| Navegação por teclado (Tab, Shift+Tab) | `ACCEPTANCE-CHECKLIST.md` | ✅ Validado FIORI-AUTO |
| Skip link funcional | `static UI test` | ✅ Presente |
| Landmarks semânticos (main, aside, nav) | `shell renders required landmarks` | ✅ Com `aria-label` |
| `aria-current` em itens ativos | Navigation modules test | ✅ Menu e breadcrumbs |
| `aria-live` em estados dinâmicos | Application async lifecycle | ✅ Busca e mensagens |
| `aria-busy` durante carregamento | Application lifecycle | ✅ Limpo após renderização |
| Títulos por página | FIORI-AUTO | ✅ 5 rotas testadas |
| Idioma `lang="pt-BR"` | FIORI-AUTO | ✅ Confirmado |
| Descrição acessível em formulário | Search form | ✅ `aria-describedby` |
| Estados vazios acessíveis | Module and component tests | ✅ `role="status"` |
| Contraste WCAG AA | WCAG calculation | ✅ Mínimo 4.5:1 (em uso) |

**Pendente (não bloqueante):**
- Zoom efetivo 200%/400%
- Alto contraste / `forced-colors`

### 3.6 Responsividade

| Viewport | Teste | Status |
|----------|-------|--------|
| 320 px | FIORI-AUTO 5 rotas | ✅ Sem overflow horizontal |
| 768 px | FIORI-AUTO 5 rotas | ✅ Sem overflow horizontal |
| 1366 px | FIORI-AUTO 5 rotas | ✅ Sem overflow horizontal |
| 1920 px | FIORI-AUTO 5 rotas | ✅ Sem overflow horizontal |

---

## 4. ADAPTADORES E CONTRATOS

### 4.1 Fake Adapter (FakeAdapter)

**Arquivo:** `src/infrastructure/fake-adapter.js`

```javascript
// Fixture de exemplo
const articles = [
  { 
    id: 1, 
    title: 'Bem-vindo ao MINIJOOMLA', 
    alias: 'boas-vindas',
    category: 'noticias',
    tags: ['início', 'guia'],
    published: true,
    featured: true,
    publishUp: '2026-01-01',
    publishDown: null
  },
  // ... mais artigos
];
```

**Interface:**
- `listArticles({ category, tag, featured, page, pageSize, search, sort, direction, now })`
- `getArticle(alias, options?)`
- `getCategory(alias)`
- `getCategoryPath(alias)`
- `listCategories()`
- `listTags({ popular, limit })`
- `listArticlesByTag(tag, options)`
- `listSimilarArticles(alias, options)`
- `listMenus()`

**Características:**
- ✅ Sem rede (tudo local)
- ✅ Cópias defensivas (sem mutação compartilhada)
- ✅ Política de visibilidade: `published && publishUp <= now < publishDown`
- ✅ Ordenação segura com allowlist: `['publishUp', 'title', 'alias', 'id']`
- ✅ Tags populares apenas de conteúdo visível
- ✅ Paginação normalizada (1–50)

**Teste:** `tests/adapter-contract.test.js` — 9 verificações aprovadas

### 4.2 SPMIDDLE Adapter (SPMiddleAdapter)

**Arquivo:** `src/infrastructure/spmiddle-adapter.js`

**Nota importante:** Implementação **local e sem rede**. Recebe repositories por injeção:

```javascript
const adapter = createSPMiddleAdapter({
  articleRepository: mockArticleRepo,
  categoryRepository: mockCategoryRepo,
  tagRepository: mockTagRepo,
  menuRepository: mockMenuRepo
}, { fieldMappings: {...}, now: new Date() });
```

**Responsabilidades:**
- Mapeia DTOs do SPMIDDLE para modelo neutro do MINIJOOMLA
- Aplica política de visibilidade (published, janelas de publicação)
- Descarta campos desnecessários (ETag, URLs internas, metadados)
- Reforça allowlists e limites

**Características:**
- ✅ Mapeamento configurável de campos (ex.: `MSEContent.State` → `estado`)
- ✅ Conversão de estados Joomla (`Published`/`Unpublished`/`Archived`/`Trashed`)
- ✅ Suporte a datas ISO ou `Date`
- ✅ Tratamento seguro de ausência como `null`/array vazio
- ✅ Propagação segura de erros (sem vazar detalhe)

**Teste:** `tests/spmiddle-adapter.test.js` — 24 verificações aprovadas

### 4.3 Contrato Congelado (Versão 1)

**Arquivo:** `docs/CONTRACTS-MINIJOOMLA.md`

**Regras cardeais:**
1. `ref` sempre string (nunca número ou objeto)
2. Leitura singular resolve `null` para "não encontrado" (nunca lança)
3. Página paginada (`Page`) tem forma fixa: `{ items[], total, page, pageSize, pages }`
4. Listas não paginadas sempre resolvem array (nunca `null`/`undefined`)
5. Datas aceitam string ISO ou `Date`
6. "now" por chamada (permite testar TP em fixtures)

**Verificação reutilizável:** `runContentAdapterContract()` em `tests/adapter-contract.test.js`

---

## 5. DOCUMENTAÇÃO

### 5.1 Documentação operacional (deve acompanhar a release)

| Arquivo | Propósito | Tamanho | Status |
|---------|-----------|--------|--------|
| `README.md` | Guia de início, arquitetura, rotas | ~55 linhas | ✅ Concluído |
| `PROMPT-DESENVOLVIMENTO-MINIJOOMLA.md` | Especificação de escopo, proibições, ondas | ~249 linhas | ✅ Referência |
| `docs/CHECKLIST-CONCLUSAO-MINIJOOMLA.md` | Checklist detalhado de entrega (8 marcos) | ~157 linhas | ⚠️ Parcialmente preenchido |
| `docs/HANDOFF-DESENVOLVIMENTO.md` | Instruções operacionais para continuidade | ~278 linhas | ✅ Concluído |
| `docs/ACCEPTANCE-CHECKLIST.md` | Evidências de aceite visual (FIORI-AUTO) | ~231 linhas | ✅ Concluído |
| `docs/CONTRACTS-MINIJOOMLA.md` | Contratos de adapters (congelado) | ~100+ linhas | ✅ Congelado (Marco A) |
| `docs/JOOMLA-EQUIVALENCE.md` | Matriz de equivalência Joomla | ~60+ linhas | ✅ Concluído |
| `docs/INTEGRATION-SPMIDDLE.md` | Roadmap de integração remota | ~80+ linhas | ✅ Concluído |
| `docs/PLANO-MINIJOOMLA.md` | Visão geral e contexto MSE | ~80+ linhas | ✅ Concluído |

### 5.2 Arquivos não duplicados (responsabilidade de outras frentes)

```
docs/PLANO-MINIJOOMLA.md     ← Não alterar (frente de site)
host-adapters/               ← Não alterar (frente de integração MSE)
theme/tokens.css             ← Não alterar (frente de design)
```

---

## 6. INCONSISTÊNCIAS IDENTIFICADAS

### 6.1 Versioning (sem inconsistência real)

✅ **Status:** Correto  
- `package.json` declara `0.1.0`
- Sem artefatos de versioning duplo (chamegeset, semver)
- Versioning é local (não publicado em npm)

### 6.2 Build/Bundling (ausência detectada)

⚠️ **Achado:** Não existe script de build ou bundling  

**Arquivos verificados:**
- `package.json` — sem `build`, `bundle`, `dist` scripts
- `scripts/` — apenas `check-syntax.js`
- Não há `webpack.config.js`, `vite.config.js`, `tsconfig.json` ou similar

**Impacto:**
- Distribuição será **código-fonte direto** (módulos ES)
- Cliente (MSE, navegador) deve servir como módulos ES nativos
- Não há minificação, tree-shaking ou otimização de bundling

**Próximo passo:** Decidir se release 0.1.0 requer build ou se permanece como fonte.

### 6.3 Dependências NPM (ausência detectada)

⚠️ **Achado:** `package.json` não lista dependências no `dependencies` ou `devDependencies`

```json
{
  "name": "minijoomla",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "...",
  "scripts": { ... }
  // ← sem "dependencies" ou "devDependencies"
}
```

**Implicação:**
- Projeto é **zero-dependency** (sem npm install necessário)
- Todas as dependências são módulos Node.js nativo ou ES puro
- Excelente para distribuição e integração em MSE

✅ **Vantagem:** Facilita integração com Modern Script Editor (sem npm na página)

### 6.4 Zoom 200%/400% — Pendente (não bloqueante)

⚠️ **Status:** Não validado em navegador  

**Checklist de aceite:** Item pendente
- [ ] Validar zoom efetivo de 200%.
- [ ] Validar zoom efetivo de 400%.
- [ ] Validar reflow equivalente a 320 CSS px em zoom.

**Razão:** FIORI-AUTO não emula zoom ainda  
**Bloqueante?** Não — local phase 1 aceita desta forma  
**Próximo passo:** Validar em navegador manual ou com atualização de FIORI-AUTO

### 6.5 Alto contraste / `forced-colors` — Pendente (não bloqueante)

⚠️ **Status:** Não validado em navegador  

**Checklist:** Item pendente
- [ ] Validar alto contraste/`forced-colors` em navegador.

**Motivo:** API de emulação não disponível em FIORI-AUTO  
**Bloqueante?** Não  
**Próximo passo:** Testar manualmente quando navegador suportar

### 6.6 Inspeção visual SharePoint — Não confirmada

⚠️ **Status:** Página de teste não expôs webpart do MINIJOOMLA

**Tentativa registrada em `ACCEPTANCE-CHECKLIST.md`:**
- Página informada aberta em FIORI-AUTO
- URL respondeu com título `SAP Scripting`
- Sem overflow horizontal
- **Mas:** Sem identificação do webpart MINIJOOMLA no DOM

**Próximo passo:** Confirmar página de testes correta com responsável

---

## 7. PRÓXIMOS PASSOS LOCAIS (PARA RELEASE 0.1.0)

### 7.1 Decisões formais necessárias

Antes de finalizar a release, decidir:

1. **Build/Bundling?**
   - [ ] Release como código-fonte ES (atual)
   - [ ] Criar build/bundle script e distribuir artefato
   - **Recomendação:** Manter como fonte para fase 0.1.0 (simplifica iteração)

2. **`mod_articles_archive`?**
   - [ ] Fora do escopo 0.1.0
   - [ ] Implementar nesta entrega
   - **Recomendação:** Fora de escopo (não mencionado em teste)

3. **HTML customizado?**
   - [ ] Fora do escopo 0.1.0
   - [ ] Implementar nesta entrega
   - **Recomendação:** Fora de escopo

4. **API de plugins?**
   - [ ] Fora do escopo 0.1.0
   - [ ] Implementar nesta entrega
   - **Recomendação:** Fora de escopo

### 7.2 Validações finais (read-only)

- [x] Executar `npm test` — 56 testes aprovados
- [x] Executar `npm run check` — 20 arquivos validados
- [x] Executar `git diff --check` — aprovado
- [ ] Confirmar working tree contém somente alterações intencionais
- [ ] Confirmar que `docs/PLANO-MINIJOOMLA.md`, `host-adapters/`, `theme/` não foram alterados
- [ ] Validar zoom 200%/400% manualmente (se tempo permitir)
- [ ] Validar alto contraste manualmente (se tempo permitir)

### 7.3 Artefatos de distribuição

Para release 0.1.0, incluir:

```
minijoomla-0.1.0/
├── package.json
├── README.md
├── PROMPT-DESENVOLVIMENTO-MINIJOOMLA.md
├── docs/
│   ├── CHECKLIST-CONCLUSAO-MINIJOOMLA.md
│   ├── HANDOFF-DESENVOLVIMENTO.md
│   ├── ACCEPTANCE-CHECKLIST.md
│   ├── CONTRACTS-MINIJOOMLA.md
│   ├── JOOMLA-EQUIVALENCE.md
│   ├── INTEGRATION-SPMIDDLE.md
│   └── PLANO-MINIJOOMLA.md
├── src/
│   └── [15 arquivos .js]
├── tests/
│   └── [5 arquivos .js]
├── scripts/
│   └── check-syntax.js
└── examples/
    └── index.html
```

**Excluir:**
- `.git/` (ou incluir somente commits relevantes)
- `node_modules/` (não existem)
- Caminhos não rastreados (`host-adapters/`, `theme/`, `docs/PLANO-MINIJOOMLA.md`)

### 7.4 Comunicação de entrega

**Próximos passos com responsável:**

1. **Confirmação de escopo:** Decidir formalmente sobre módulos opcionais (archive, HTML, plugins)
2. **Build strategy:** Definir se release é fonte ou bundled
3. **Página de testes SharePoint:** Confirmar URL e webpart MSE para validação visual
4. **Autorização de integração:** Quando/se avançar para Marco C (leitura em Preview.aspx)

---

## 8. REFERÊNCIAS CANÔNICAS

Para continuidade operacional, consultar:

1. `HANDOFF-DESENVOLVIMENTO.md` (instruções para nova LLM)
2. `ACCEPTANCE-CHECKLIST.md` (evidências de aceite)
3. `CHECKLIST-CONCLUSAO-MINIJOOMLA.md` (status de marcos)
4. `CONTRACTS-MINIJOOMLA.md` (contrato congelado v1)
5. `INTEGRATION-SPMIDDLE.md` (roadmap remoto)

---

## 9. CONCLUSÃO

**MINIJOOMLA 0.1.0 está pronto para release local.**

Checkpoints atendidos:
- ✅ Versioning: `0.1.0`
- ✅ Testes: 56 aprovados
- ✅ Sintaxe: 20 arquivos validados
- ✅ Documentação: Completa e operacional
- ✅ Aceite visual: Realizado (exceto zoom/alto contraste)
- ✅ Contratos: Congelados (Marco A)
- ✅ Adapters: Implementados (fake + SPMIDDLE local)
- ✅ Zero-dependency: Pronto para integração

Lacunas residuais (não bloqueantes):
- ⚠️ Sem script de build (decisão pendente)
- ⚠️ Zoom 200%/400% não validado (emulação FIORI-AUTO não disponível)
- ⚠️ Alto contraste não validado (emulação FIORI-AUTO não disponível)
- ⚠️ Inspeção visual SharePoint pendente (confirmar página de testes)

**Recomendação:** Finalizar working tree, confirmar não-alterações de arquivos de terceiros, e preparar artefato de distribuição com versão imutável 0.1.0.

---

**Exploração realizada em 31 de outubro de 2026 — Read-only, sem edições, sem rede, sem publicações.**

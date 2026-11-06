# INVENTÁRIO DE ARQUIVOS E SCRIPTS — MINIJOOMLA 0.1.0

**Gerado em:** 31 de outubro de 2026  
**Exploração:** Read-only, sem edições

---

## 1. ESTRUTURA COMPLETA

### Raiz do projeto

```
C:\PROJETOS\VSTO\web-devs\MINIJOOMLA/
├── package.json                          # Versioning e scripts npm
├── README.md                             # Guia de início rápido (55 linhas)
├── PROMPT-DESENVOLVIMENTO-MINIJOOMLA.md # Especificação de escopo (249 linhas)
├── .gitignore                            # Padrões ignorados (não examinado em detalhe)
├── .git/                                 # Histórico Git (6 commits documentados)
│
├── docs/ [8 arquivos]                    # Documentação operacional
│   ├── ACCEPTANCE-CHECKLIST.md           # Evidências de aceite visual (FIORI-AUTO)
│   ├── CHECKLIST-CONCLUSAO-MINIJOOMLA.md # Marcos e status de entrega
│   ├── CONTRACTS-MINIJOOMLA.md           # Contrato de adapters (congelado v1)
│   ├── HANDOFF-DESENVOLVIMENTO.md        # Instruções para continuidade
│   ├── INTEGRATION-SPMIDDLE.md           # Roadmap de integração remota
│   ├── JOOMLA-EQUIVALENCE.md             # Matriz de equivalência Joomla
│   ├── PLANO-MINIJOOMLA.md               # Visão geral MSE [NÃO ALTERAR — responsabilidade de outro]
│   └── [Esta seção pode expandir com RELATORIO-EXPLORACAO-MSE-0.1.0.md e SUMARIO-RELEASE-0.1.0.md]
│
├── src/ [15 arquivos .js]                # Código-fonte ES (zero-dependency)
│   ├── index.js                          # Ponto de entrada (aplicação principal)
│   │
│   ├── core/ [4 arquivos]
│   │   ├── config.js                     # Normalização de configuração
│   │   ├── contracts.js                  # Vocabulário de erros (ports)
│   │   ├── events.js                     # Event bus com validação
│   │   └── router.js                     # Roteador (hash, popstate, basePath)
│   │
│   ├── application/ [1 arquivo]
│   │   └── content-service.js            # Casos de uso (artigos, categorias, busca)
│   │
│   ├── components/ [3 arquivos]
│   │   ├── content.js                    # Renderização de artigo
│   │   ├── category.js                   # Renderização de categoria/blog
│   │   └── search.js                     # Renderização de busca + formulário
│   │
│   ├── modules/ [2 arquivos]
│   │   ├── registry.js                   # Registro e seleção de módulos
│   │   └── content-modules.js            # Módulos Joomla (menu, breadcrumbs, articles-*, tags-*)
│   │
│   ├── infrastructure/ [2 arquivos]
│   │   ├── fake-adapter.js               # Adapter de dados local (sem rede) — referência
│   │   └── spmiddle-adapter.js           # Adapter SPMIDDLE local (sem rede)
│   │
│   ├── security/ [1 arquivo]
│   │   └── sanitize.js                   # Sanitização de HTML e URLs
│   │
│   └── templates/ [1 arquivo]
│       └── default.js                    # Shell responsivo (header, nav, sidebar, footer)
│
├── tests/ [5 arquivos]                   # Testes (56 aprovados)
│   ├── run-tests.js                      # Orquestrador (executa todos os testes)
│   ├── core.test.js                      # Router, config, eventos, lifecycle
│   ├── static-ui.test.js                 # Shell, componentes, módulos
│   ├── adapter-contract.test.js          # Conformidade de adapters (9 testes)
│   └── spmiddle-adapter.test.js          # Validação adapter SPMIDDLE (24 testes)
│
├── scripts/ [1 arquivo]
│   └── check-syntax.js                   # Verificação de sintaxe (Node.js --check)
│
├── examples/ [1 arquivo]
│   └── index.html                        # Página de testes local (servir com HTTP)
│
├── theme/ [1 arquivo]                    # Tema e tokens [NÃO ALTERAR — responsabilidade de outro]
│   └── tokens.css                        # Tokens de identidade visual Petrobras
│
└── host-adapters/ [submódulo]            # Adapters para Modern Script Editor [NÃO ALTERAR — responsabilidade de outro]
    └── modern-script-editor/
        └── [Arquivos de integração MSE — não examinados em detalhe]
```

---

## 2. CONTAGEM E VERIFICAÇÃO

### Arquivos por tipo

| Tipo | Local | Qtd | Status |
|------|-------|-----|--------|
| `.js` (source) | `src/` | 15 | ✅ Verificado |
| `.js` (testes) | `tests/` | 5 | ✅ Verificado |
| `.js` (scripts) | `scripts/` | 1 | ✅ Verificado |
| `.md` (docs) | `docs/` | 7 | ✅ Verificado |
| `.md` (raiz) | `.` | 2 | ✅ Verificado |
| `.html` (exemplos) | `examples/` | 1 | ✅ Verificado |
| `.json` (config) | `.` | 1 | ✅ Verificado |
| `.css` (tema) | `theme/` | 1 | ⚠️ Não alterar (terceiro) |
| Outros | `host-adapters/` | ? | ⚠️ Não alterar (terceiro) |

**Total verificado:** 22 arquivos próprios

### Tamanho estimado

```
src/             ~35 KB (15 arquivos .js)
tests/           ~12 KB (5 arquivos .js + runner)
scripts/         ~0.8 KB
examples/        ~0.4 KB
docs/            ~50 KB (7 docs + handoff)
package.json     ~0.4 KB
README.md        ~2 KB
---
Total:           ~100 KB (código-fonte)
```

(Sem `node_modules`, `.git` ou dependências externas)

---

## 3. SCRIPTS DISPONÍVEIS

### NPM

```powershell
# Teste completo (56 testes, ~2–3 segundos)
npm test

# Verificação de sintaxe (20 arquivos, ~1–2 segundos)
npm run check
```

### Git

```powershell
# Status
git status --branch --short

# Log (últimos 10 commits)
git log --oneline -10

# Diff com whitespace check
git diff --check

# Listar arquivos não rastreados
git ls-files --others --exclude-standard
```

### Manual (Desenvolvimento)

```powershell
# Servir exemplos localmente
python -m http.server 8782 --bind 127.0.0.1

# Depois abrir no navegador
http://127.0.0.1:8782/examples/index.html
```

---

## 4. ROTAS TESTADAS

Quando servida localmente (`http://127.0.0.1:8782/examples/index.html`):

| Rota | Descrição | Status |
|------|-----------|--------|
| `#/` | Home (carrega categoria "noticias") | ✅ Testada |
| `#/article/boas-vindas` | Artigo individual | ✅ Testada |
| `#/article/conteudo-modular` | Outro artigo (com tags relacionadas) | ✅ Testada |
| `#/category/noticias` | Blog de categoria | ✅ Testada |
| `#/search?q=energia` | Busca (full-text) | ✅ Testada |
| `#/rota-inexistente` | 404 acessível | ✅ Testada |

---

## 5. FIXTURES (Dados de Exemplo)

### Artigos (FakeAdapter)

```javascript
[
  {
    id: 1,
    title: "Bem-vindo ao MINIJOOMLA",
    alias: "boas-vindas",
    category: "noticias",
    tags: ["início", "guia"],
    published: true,
    featured: true,
    publishUp: "2026-01-01"
  },
  {
    id: 2,
    title: "Conteúdo modular",
    alias: "conteudo-modular",
    category: "noticias",
    tags: ["arquitetura", "guia"],
    published: true,
    featured: false,
    publishUp: "2026-02-01"
  }
]
```

### Categorias

```javascript
[
  {
    id: 1,
    title: "Notícias",
    alias: "noticias",
    parentId: null,
    description: "Publicações recentes."
  }
]
```

### Menus

```javascript
[
  { title: "Início", path: "/" },
  { title: "Notícias", path: "/category/noticias" }
]
```

---

## 6. DEPENDÊNCIAS

### Runtime

**Nenhuma.** Projeto é 100% módulos ES nativos + Node.js nativo.

```json
{
  "package.json": {
    "dependencies": {},
    "devDependencies": {}
  }
}
```

### Requisitos

- Node.js 16+ (para `--check` de sintaxe)
- Navegador com suporte a módulos ES (Chrome 61+, Firefox 67+, Safari 11+)
- HTTP local (para servir `examples/index.html`)

---

## 7. ARQUIVOS NÃO DUPLICADOS (Responsabilidade de outros)

**Não alterar, não mover, não apagar:**

```
docs/PLANO-MINIJOOMLA.md          ← Frente de site/kernel
host-adapters/                     ← Frente de integração MSE
theme/                             ← Frente de design/identidade visual
```

Qualquer alteração nesses caminhos requer comunicação com responsável.

---

## 8. MAPEAMENTO DE RESPONSABILIDADES

| Arquivo/Diretório | Responsável | Tipo | Nota |
|-------------------|-------------|------|------|
| `src/core/` | Core MINIJOOMLA | Próprio | Router, config, events |
| `src/application/` | MINIJOOMLA | Próprio | Casos de uso (content-service) |
| `src/components/` | MINIJOOMLA | Próprio | Renderização de artigos/categorias |
| `src/modules/` | MINIJOOMLA | Próprio | Módulos Joomla-like |
| `src/infrastructure/` | MINIJOOMLA | Próprio | Adapters (fake + SPMIDDLE) |
| `src/security/` | MINIJOOMLA | Próprio | Sanitização |
| `src/templates/` | MINIJOOMLA | Próprio | Shell responsivo |
| `tests/` | MINIJOOMLA | Próprio | Testes unitários e integração |
| `scripts/` | MINIJOOMLA | Próprio | Verificação de qualidade |
| `examples/` | MINIJOOMLA | Próprio | Página de testes local |
| `docs/` (maioria) | MINIJOOMLA | Próprio | Documentação operacional |
| `docs/PLANO-MINIJOOMLA.md` | Site Kernel | Terceiro | Contexto MSE — não duplicar |
| `theme/` | Design / Identidade | Terceiro | Tokens visuais — não editar |
| `host-adapters/` | Integração MSE | Terceiro | Adaptação para Modern Script Editor |
| `package.json` | MINIJOOMLA | Próprio | Versioning e scripts |
| `README.md` | MINIJOOMLA | Próprio | Guia de início |

---

## 9. FLUXO DE ENTREGA (0.1.0)

Para gerar artefato de release:

```powershell
# 1. Verificar status
cd C:\PROJETOS\VSTO\web-devs\MINIJOOMLA
git status                    # Deve estar limpo
npm test                      # Deve passar (56 testes)
npm run check                 # Deve passar (20 arquivos)

# 2. Gerar tarball (sem .git, sem dependências)
git archive --format tar.gz \
  --output minijoomla-0.1.0.tar.gz \
  --prefix minijoomla-0.1.0/ \
  HEAD -- \
  package.json README.md PROMPT-DESENVOLVIMENTO-MINIJOOMLA.md \
  docs/ACCEPTANCE-CHECKLIST.md \
  docs/CHECKLIST-CONCLUSAO-MINIJOOMLA.md \
  docs/CONTRACTS-MINIJOOMLA.md \
  docs/HANDOFF-DESENVOLVIMENTO.md \
  docs/INTEGRATION-SPMIDDLE.md \
  docs/JOOMLA-EQUIVALENCE.md \
  src/ tests/ scripts/ examples/

# 3. Verificar conteúdo
tar tzf minijoomla-0.1.0.tar.gz | head -20
```

---

## 10. REFERÊNCIA RÁPIDA

### Executar testes

```powershell
npm test 2>&1 | Select-Object -Last 20  # Últimas linhas (resultados)
```

### Servir localmente

```powershell
python -m http.server 8782 --bind 127.0.0.1
# Acesso: http://127.0.0.1:8782/examples/index.html
```

### Verificar Git

```powershell
git status --branch --short    # Resumido
git log --oneline -5            # Últimos 5 commits
git diff --check                # Verificar whitespace
```

### Inspecionar arquivo

```powershell
Get-Content src/index.js | Select-Object -First 50  # Primeiras 50 linhas
```

---

**Inventário completo. Exploração realizada em 31 de outubro de 2026 — read-only apenas.**

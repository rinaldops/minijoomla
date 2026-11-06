# PRÓXIMOS PASSOS LOCAIS — MINIJOOMLA 0.1.0

**Gerado em:** 31 de outubro de 2026  
**Sessão:** Exploração read-only para preparação de release  

---

## 1. VALIDAÇÕES FINAIS (Local, sem alterações)

Execute os comandos abaixo do diretório `C:\PROJETOS\VSTO\web-devs\MINIJOOMLA`:

```powershell
# Verificar status Git
git status --branch --short
git log -5 --oneline

# Baseline de testes
npm test
npm run check
git diff --check

# Confirmar working tree limpo
git status

# Verificar alterações não rastreadas (se houver)
git ls-files --others --exclude-standard
```

**Esperado:**
- ✅ Sem alterações pendentes (`git status` limpo)
- ✅ 56 testes aprovados
- ✅ 20 arquivos verificados
- ✅ Sem warnings de whitespace

---

## 2. DECISÕES FORMAIS NECESSÁRIAS

Antes de considerar a release **finalizada**, requerer aprovação do responsável (coordenador/Marcos) sobre:

### 2.1 Build/Bundling Strategy

**Opção A (Recomendada):** Manter como source ES  
✅ Simples para 0.1.0  
✅ Facilita iteração e debug em navegador  
✅ Zero-dependency (sem npm install)  
✅ Compatível com Modern Script Editor  

**Opção B:** Criar bundle/minify  
- Requer script novo em `package.json`
- Adiciona step de build na pipeline
- Impacto: 20 KB → ~5 KB (gzip)
- ❌ Pode adiar release

**Ação:** Comunicar escolha antes de gerar artefato

### 2.2 Módulos Opcionais da Fase 1

Cada item abaixo está **fora do escopo** por padrão. Decidir se permanece fora ou integra nesta release:

- [ ] `mod_articles_archive` — Arquivo de artigos por período
- [ ] Módulo de HTML customizado — Conteúdo livre sem scripts
- [ ] API de plugins — Sistema de extensão para temas/conteúdo

**Recomendação:** Manter **fora** de 0.1.0 (não mencionados nos testes aprovados)

### 2.3 Página de Testes SharePoint

Status atual: Página informada não expôs webpart MINIJOOMLA (pode estar em URL errada)

**Ação necessária:**
- Confirmar URL correta de teste compartilhada (Preview.aspx ou similar)
- Confirmar que Modern Script Editor foi configurado com MINIJOOMLA 0.1.0
- Autorizar nova inspeção visual (somente read-only, sem alterações)

---

## 3. LACUNAS RESIDUAIS DE VALIDAÇÃO (Não bloqueantes para 0.1.0)

### 3.1 Zoom 200% / 400%

**Status:** Não validado (FIORI-AUTO sem emulação)

**Próximo passo:**
1. Testar manualmente em navegador real (Chrome DevTools: `Ctrl+Shift+J` → zoom)
2. Confirmar sem overflow horizontal em 320 CSS px equivalente
3. Se houver falhas: criar issue de reflow para fase 1.1

**Risco:** Baixo (CSS responsivo foi validado em 4 larguras)

### 3.2 Alto Contraste / `forced-colors`

**Status:** Não validado (emulação não disponível)

**Próximo passo:**
1. Quando FIORI-AUTO suportar: validar `forced-colors: active` em CSS
2. Confirmar que `outline`, `border` e `color` são distinguíveis sem depender de `background-color`
3. Se houver falhas: criar issue de acessibilidade para fase 1.1

**Risco:** Baixo (CSS contém regras de `forced-colors` e `:focus-visible`)

### 3.3 Inspeção Visual Remota (SharePoint/Preview)

**Status:** Página de testes não confirmou webpart

**Próximo passo:**
1. Coordenar com responsável a URL e configuração de MSE correta
2. Validar que MINIJOOMLA está publicado (ou será publicado) no local certo
3. Executar nova exploração read-only quando autorizado
4. **Sem fazer alterações** em Preview.aspx ou Default.aspx

**Risco:** Médio (pode ser acesso/URL incorreto)

---

## 4. PREPARAÇÃO DO ARTEFATO DE DISTRIBUIÇÃO

Quando decisões acima forem confirmadas, gerar release:

```powershell
# No repositório raiz (ou conforme workflow do workspace)
# Substituir <VERSION> por 0.1.0 e <COMMIT> pelo hash do commit

# Opção 1: Criar tarball (sem .git)
git archive --format tar.gz \
  --output minijoomla-0.1.0.tar.gz \
  --prefix minijoomla-0.1.0/ \
  HEAD -- \
  package.json README.md PROMPT-DESENVOLVIMENTO-MINIJOOMLA.md \
  docs/ src/ tests/ scripts/ examples/

# Opção 2: Criar .zip (Windows)
# Manualmente: Select-Object src/, tests/, docs/, package.json, README.md, PROMPT-*, scripts/, examples/ → Compress-Archive
```

**Conteúdo do artefato:**

```
minijoomla-0.1.0/
├── package.json (versionado como 0.1.0)
├── README.md
├── PROMPT-DESENVOLVIMENTO-MINIJOOMLA.md
├── docs/
│   ├── ACCEPTANCE-CHECKLIST.md           (evidências de aceite visual)
│   ├── CHECKLIST-CONCLUSAO-MINIJOOMLA.md (status dos marcos)
│   ├── HANDOFF-DESENVOLVIMENTO.md        (instruções de continuidade)
│   ├── CONTRACTS-MINIJOOMLA.md           (contrato congelado v1)
│   ├── JOOMLA-EQUIVALENCE.md             (matriz de equivalência)
│   ├── INTEGRATION-SPMIDDLE.md           (roadmap de integração remota)
│   └── PLANO-MINIJOOMLA.md               (contexto MSE — não duplicar)
├── src/
│   ├── index.js
│   ├── core/ (config.js, contracts.js, events.js, router.js)
│   ├── application/ (content-service.js)
│   ├── components/ (content.js, category.js, search.js)
│   ├── modules/ (registry.js, content-modules.js)
│   ├── infrastructure/ (fake-adapter.js, spmiddle-adapter.js)
│   ├── security/ (sanitize.js)
│   └── templates/ (default.js)
├── tests/
│   ├── run-tests.js
│   ├── core.test.js
│   ├── static-ui.test.js
│   ├── adapter-contract.test.js
│   └── spmiddle-adapter.test.js
├── scripts/
│   └── check-syntax.js
└── examples/
    └── index.html
```

**NÃO incluir:**
- `.git/` (ou apenas commits relevantes se necessário)
- `node_modules/` (não existem)
- Caminhos de terceiros: `host-adapters/`, `theme/`, `.gitmodules`
- Arquivo de origem `PLANO-MINIJOOMLA.md` (responsabilidade de site-kernel)
- Arquivos sensíveis ou temporários

---

## 5. CHECKLIST PRÉ-ENTREGA

Antes de comunicar "release 0.1.0 pronta":

- [ ] Working tree limpo (`git status` sem alterações)
- [ ] Testes passando (`npm test` — 56 ✅)
- [ ] Sintaxe validada (`npm run check` — 20 ✅)
- [ ] `git diff --check` sem erros
- [ ] Nenhum arquivo de terceiros foi alterado (`host-adapters/`, `theme/`, `docs/PLANO-*`)
- [ ] Decisões formais confirmadas (build strategy, módulos opcionais, página SharePoint)
- [ ] Artefato de distribuição gerado e verificado
- [ ] Hash/commit anotado para referência
- [ ] Documentação reflete estado real (relatorio + sumário gerados)

---

## 6. COMUNICAÇÃO DE ENTREGA

Quando tudo acima estiver concluído, comunicar ao coordenador/responsável:

### Mensagem modelo

```
MINIJOOMLA 0.1.0 — Release pronta para distribuição local

✅ Checklist concluído:
- 56 testes aprovados
- 20 arquivos de sintaxe validados
- Aceite visual local completo (5 rotas, 4 larguras)
- Documentação operacional finalizada
- Zero-dependency, pronto para MSE

⚠️ Lacunas residuais (não bloqueantes):
- Zoom 200%/400%: não emulado em FIORI-AUTO
- Alto contraste: não emulado em FIORI-AUTO
- Inspeção SharePoint: pendente confirmação de página de testes

📦 Artefato: minijoomla-0.1.0.tar.gz / .zip
   Commit: [HASH]
   Documentação: RELATORIO-EXPLORACAO-MSE-0.1.0.md

🔄 Próximos marcos:
- Marco B: Integração remota com SPMIDDLE (Preview.aspx)
- Marco C: Leitura autorizada em SharePoint
- Marco D: Escrita (somente com autorização + contrato CSRF/idempotência)

Responsável deve confirmar:
1. Build strategy (manter source ou bundlear)
2. Página de testes SharePoint (URL e webpart)
3. Aprovação para integração remota (quando aplicável)
```

---

## 7. REFERÊNCIAS PARA CONTINUIDADE

Quando nova LLM asumir o desenvolvimento após 0.1.0:

1. **Leia primeiro:** `docs/HANDOFF-DESENVOLVIMENTO.md`
2. **Entenda o escopo:** `PROMPT-DESENVOLVIMENTO-MINIJOOMLA.md`
3. **Veja matriz de equivalência:** `docs/JOOMLA-EQUIVALENCE.md`
4. **Verifique baseline:** `npm test && npm run check`
5. **Consulte roadmap de integração:** `docs/INTEGRATION-SPMIDDLE.md`

---

## 8. TIMELINE ESPERADA

| Etapa | Prazo | Responsável |
|-------|-------|-------------|
| Validações finais (§1) | Imediato | Executor |
| Decisões formais (§2) | < 1 dia | Coordenador |
| Geração do artefato (§4) | < 30 min | Executor |
| Checklist pré-entrega (§5) | < 30 min | Executor |
| Comunicação (§6) | Imediato | Coordenador |

**Total estimado:** 1 dia útil para release local 0.1.0

---

## 9. CONTATOS E ESCALAÇÃO

Se houver bloqueios:

- **Build strategy indefinida:** Coordenador deve decidir (source vs. bundle)
- **Página SharePoint não encontrada:** Coordenador confirma URL com responsável do site
- **Testes falhando após alterações:** Reverter com `git revert <commit>` e analisar raiz

---

**Documento gerado por exploração read-only em 31 de outubro de 2026.**  
**Nenhuma alteração foi feita ao projeto — apenas leitura e documentação.**

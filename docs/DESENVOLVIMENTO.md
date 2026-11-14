# Desenvolvimento — MINIJOOMLA

Guia de desenvolvimento **offline-first** para contribuir, executar localmente, preparar *staging* reprodutível e rodar gates de integridade/auditoria **sem rede**.

MINIJOOMLA é um núcleo JavaScript inspirado no Joomla. Integrações com SharePoint/REST/ETag e com o projeto irmão **SPMIDDLE** existem, mas devem ocorrer por **adapters e contratos injetáveis** (o núcleo não deve embutir endpoints corporativos).

> Importante: testes verdes, staging e auditoria manifest-only **não** equivalem a aprovação de publicação, direitos de terceiros, privacidade do repositório ou aceite visual/assistivo integral.

---

## Pré-requisitos

- Node.js **LTS mantido** (22 ou superior) + npm.
- Fluxo padrão **não exige** `npm install`, credenciais nem rede.
- O projeto usa ES modules (`"type": "module"`).

---

## Fluxo rápido (sem rede)

```bash
npm test
npm run check
node scripts/serve-local.js
```

---

<a id="testes-locais"></a>
## Testes locais (Node)

```bash
npm test
npm run check
```

- `npm test` executa as suítes declaradas em `tests/run-tests.js`.
- Algumas suítes são integrações opcionais e exigem o irmão `../SPMIDDLE`.
  - **Somente** a ausência do diretório irmão pode virar `SKIP`.
  - Checkout parcial, erro de import/export ou falha de assertion devem falhar (não virar skip).
- `npm run check` faz verificação de sintaxe (parse-only); não substitui testes.

### Limites de validacao da consolidacao documental

Na revisao de 14/11/2026, `npm run check` passou para 364 arquivos JavaScript.
`npm test` registrou 124 suites aprovadas, uma falha e nenhum skip: a suite
`runner.test.js` excedeu o timeout de seu subprocesso standalone
(`spawnSync node ETIMEDOUT`). O runner nao foi alterado nesta consolidacao.
A suite completa permanece pendente de uma execucao sem timeout; nao tratar
esse resultado como aprovacao integral nem alterar o runtime para mascara-lo.
Esses gates locais nao comprovam publicacao ou aceite em SharePoint.

---

<a id="local-demo"></a>
## Demonstração local (loopback, read-only)

Servidor de demonstração local:

```bash
node scripts/serve-local.js
# opcional
node scripts/serve-local.js --port 8081
```

Propriedades do servidor:
- Bind **somente** em `127.0.0.1`.
- Read-only: aceita apenas `GET`/`HEAD`.
- MIME explícito, `X-Content-Type-Options: nosniff` e `Cache-Control: no-store`.
- Serve apenas caminhos sob `src/`, `examples/` e `tests/`.
- Recusa `docs/`, `tmp/`, Git, perfis, segredos, traversal e links (symlink/junction).

URLs:
- Público: `http://127.0.0.1:8080/examples/index.html`
- Admin: `http://127.0.0.1:8080/examples/admin.html`

Check offline dos exemplos standalone (sem browser):

```bash
node scripts/test-standalone-examples.js
# ou
npm run test:standalone-examples
```

Montagens explícitas de pacotes locais (opt-in) — somente para diretórios dedicados confiáveis:

```bash
node scripts/serve-local.js --extra-root "packages/probe=C:\caminho\para\pasta-dedicada"
```

No workspace corporativo, qualquer abertura/inspeção/automação de navegador deve usar **FIORI-AUTO** (diretriz do workspace). Este servidor não publica nem acessa tenant.

---

<a id="staging-core"></a>
## Staging `core` (recorte mínimo, sem SPMIDDLE/TinyMCE)

O target `core` prepara um recorte local reprodutível (fontes + loader + manifesto), **sem** incluir SPMIDDLE e **sem** incluir o runtime TinyMCE.

```bash
npm run release:stage -- --version 0.2.0 --output tmp/core-0.2.0 --target core
```

Regras:
- `--output` deve ser uma subpasta **nova** sob `tmp/` (sem overwrite).
- Falha fechado para imports/arquivos obrigatórios fora do escopo.
- Recusa links (symlink/junction) e escapes de caminho.

Verificar o core:

```bash
npm run test:release-stage
```

---

<a id="staging-contributor"></a>
## Staging `contributor-local` (seleção exata para contribuição)

A seleção `contributor-local` gera um recorte local com **allowlist congelada** e manifesto determinístico SHA-256.

Criar:

```bash
node scripts/stage-contributor.js --output tmp/contributor-local-01
```

Verificar (integridade e inventário, read-only):

```bash
node --input-type=module -e "const s = await import('./scripts/stage-contributor.js'); s.verifyContributorStage({ output: 'tmp/contributor-local-01' });"
```

Propriedades:
- `--output` deve ser **descendente novo** de `tmp/`.
- Sem links (symlink/junction), sem hardlinks, sem UNC/URL, sem traversal.
- Copia bytes **intactos** dos caminhos allowlisted; arquivo ausente reprova.
- Flags `publicationApproved`, `privacyApproved`, `rightsApproved` são sempre **false**.

---

<a id="auditoria-manifest-only"></a>
## Auditoria offline manifest-only (core ou contributor-local)

A auditoria (`scripts/audit-distribution.js`) lê somente um staging (manifest + arquivos declarados) dentro de `tmp/`:

- valida schema e nomes;
- valida integridade (bytes + SHA-256) de **cada arquivo declarado**;
- procura **candidatos** (assinaturas) e retorna relatório sem transcrever valores;
- não usa rede e não invoca Git.

```bash
node scripts/audit-distribution.js --manifest tmp/<stage>/manifest.json
```

Código de saída:
- `0`: integridade ok e **nenhum candidato** nas assinaturas aplicadas (não é aprovação pública).
- `1`: integridade ok, mas existem candidatos (gate técnico bloqueado).
- `2`: uso/caminho/schema/integridade inválidos (sem relatório parcial).

---

<a id="staging-all-site"></a>
## Staging `all`/`site` (pipeline de release local)

O pipeline de staging (`scripts/stage-release.js`) prepara recortes reprodutíveis sob `tmp/`.

- `all` inclui o grafo público + administrativo, incluindo o subconjunto TinyMCE vendorizado.
- `site` prepara somente o recorte da página pública.

Propriedades duráveis do staging:
- Manifesto registra `{path, bytes, sha256}` para **cada arquivo incluído**.
- O manifesto **não contém hash de si próprio** (não é autorreferente).
- O grafo de imports ES (estáticos, reexports, imports dinâmicos literais, `new URL` literal), CSS declarados e assets transitivos é validado antes da escrita; dependência faltante ou fora do escopo causa erro.

### TinyMCE: dependência real do fallback `en`

No subconjunto TinyMCE 7.9.1 vendorizado:
- `plugins/help/plugin.min.js` carrega recursos `keynav/<lang>.js` e faz **fallback para `en`** quando a língua atual não possui arquivo.
- Portanto `plugins/help/js/i18n/keynav/en.js` é dependência real do pacote vendorizado (não um “extra” opcional).
- Existe teste que executa o plugin real em **VM isolada** (sem browser/rede) para observar o carregamento e o fallback.

---

## Regras gerais ao contribuir

- Preservar direção **dados → adapter → casos de uso → view models → UI**.
- Não introduzir execução de JS arbitrário vindo de conteúdo/config.
- Não inserir tokens/cookies/chaves em código, docs ou assets versionados.
- Para mudanças visuais, preservar foco, teclado, reflow, contraste e movimento reduzido; registre o que foi realmente testado.


## Incidentes e regras de integração reutilizáveis

- Não iniciar aplicação como efeito de importar a biblioteca. Um antigo auto-start quando `document` existia substituía a página SharePoint por composição fake ao importar externamente; a demo deve chamar bootstrap explicitamente. Node sem `document` não cobre esse erro.
- Bootstrap deve capturar falha de carga/rejeição e mostrar mensagem segura com `role=alert` no contêiner dedicado, nunca substituir `body`. Diagnóstico deve ser realmente escrito, não apenas planejado. Categoria inicial ausente/`null` produz estado vazio acessível `role=status`; testar conteúdo final, não apenas desaparecimento de busy.
- Attach não deve abrir/navegar silenciosamente uma aba existente. Usar somente sessões da própria instância FIORI-AUTO; reload deliberado é ação separada.
- Upload/hash de CSS não prova aplicação visual: cache por URL exata, CDN/service worker e link pinado podem manter outra revisão. Conferir stylesheet e computed styles; publicar caminhos imutáveis, sem adotar cache-busting por relógio a cada carga como política atual.
- TinyMCE self-hosted 7.9.1 é GPL-2.0-or-later: conservar notices/licenças e bytes upstream; não usar CDN externo para contornar CSP nem tratar licença aberta como aprovação de publicação.
- Editor em aba oculta pode montar em 0×0 e não recalcular. Inicializar ao revelar, destruir antes da próxima montagem/navegação e manter IDs globais únicos, inclusive fixtures e hosts sem editor.
- Toolbar advanced administrativa não é toolbar simples pública. Omitir botões Joomla não suportados em vez de simulá-los. `toolbar_mode: 'sliding'` usa overflow; `wrap` mostra linhas completas. Configurar somente plugins realmente presentes no vendor.
- Upload aceita PNG/JPEG/GIF/WebP, usa nome gerado/MIME real, não confia no nome fornecido. Sem uploader deve falhar claramente, não persistir data URI. `relative_urls: false` conserva URL server-relative entre páginas admin/pública; library-base e pasta uploads não podem resultar em `uploads/uploads`.
- Aguardar `uploadImages` antes do save e preservar HTML autoral. Não copiar como regra atual a afirmação histórica de introtext sempre plain text: `articletext`/readmore divide introtext/fulltext na evolução atual.
- Houve upload/salvar real histórico no tenant; isso não aprova novo incremento, nova escrita ou instalação vazia, nem substitui seus gates de validação.

<a id="validacao"></a>
## Validação e critérios de aceite

Testes locais, staging e auditoria não comprovam publicação, direitos, privacidade
ou aceite visual/assistivo integral. Os comandos Node e auditoria estão nas seções
[Testes locais](#testes-locais) e [Auditoria manifest-only](#auditoria-manifest-only).

<a id="testes-node"></a>
Integrações com SPMIDDLE só podem ser omitidas se o checkout irmão não existir;
checkout parcial, import quebrado ou assertion falha reprovam.

<a id="admin-layout-nativo"></a>
### Teste nativo do layout administrativo (FIORI-AUTO)

Comando dedicado (Windows/Edge + agente FIORI-AUTO pré-compilado):

```powershell
npm run test:admin-layout -- --agent '<caminho-local-do-FIORI-AUTO>\fiori-agent\FioriAgent.exe'
```

Cobertura e regras duráveis:
- 7 larguras: 320/768/769/900/1366/1920/2560.
- Teclado **nativo** obrigatório: Tab/Enter/Escape com `event.isTrusted`.
- Isolamento: servidor loopback, perfil próprio, sessão própria; não acessa SharePoint nem depende de SPMIDDLE.
- Qualquer submit/tentativa de escrita/persistência real reprova.

**Não valida:** TinyMCE real, uploads reais, zoom real 200/400%, forced-colors real, leitor de tela, comparação pixel-a-pixel com Atum.

<a id="aceite-local"></a>
### Aceite local do site (checklist)

O aceite local combina testes/contratos e evidência read-only local quando aplicável.

Cobre, entre outros:
- acessibilidade estrutural (`main`, `aria-live`, foco pós-navegação, estados `loading/error/empty`),
- segurança de URLs (rejeição de controles ASCII, credenciais embutidas, esquemas executáveis, protocol-relative),
- robustez contra view models esparsos (tolerância a campos opcionais/arrays ausentes),
- router determinístico (hash/popstate/basePath/normalização),
- módulos e plugins com comportamento defensivo.

Lacunas residuais declaradas:
- zoom 200%/400%,
- forced-colors/alto contraste real,
- validação visual em SharePoint **somente** quando a página autorizada realmente expõe o conteúdo a validar.

<a id="limites"></a>
### Limites e pendências (não validados)

- Aceite visual/assistivo integral permanece pendente (zoom real, forced-colors, leitor de tela).
- Direitos/proveniência de terceiros permanecem gates independentes (TinyMCE, SPMIDDLE quando incluído, inspiração Joomla/marcas, etc.).
- Revisão de privacidade/histórico Git permanece fora do escopo de staging/auditoria manifest-only.

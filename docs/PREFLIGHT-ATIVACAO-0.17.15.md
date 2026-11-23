# Preflight de ativação segura — MINIJOOMLA 0.17.15

Escopo: apenas o painel administrativo. Nada foi publicado nem ativado nesta rodada.

Esta é a rodada dos **filtros de coluna**. Ela **não altera esquema de lista**
nenhum; por isso o preparo **e** a ativação usam `--skip-provision` (ver §2).

Mecanismo real de ativação (lido em `scripts/deploy-sharepoint.mjs`, não presumido):

- `const assets = '<web>/SiteAssets/minijoomla'` e `const release = '<assets>/releases/<version>'`.
- `publishPages()` edita `CanvasContent1` do item da lista *Site Pages*
  (`BaseTemplate eq 119`) cujo `FileLeafRef` casa com a página publicada, via
  `POST .../items(<id>)` com `X-HTTP-Method: MERGE` + `IF-MATCH: <etag>`, e em
  seguida chama `.../Publish(comment='MINIJOOMLA <version>')` se `Level !== 1`.
  Ou seja: **trocar o pointer de produção = reescrever `CanvasContent1` de
  `MiniJoomla.aspx` e/ou `Administrator.aspx`**; não existe pointer indireto.
- `stage-release.js` copia bytes crus (sem conversão de EOL); `deploy-sharepoint.mjs`
  sobe exatamente esses bytes em base64 e **valida o SHA-256 no readback**, com
  igualdade estrita (exceto `.html`, que aceita apenas um *apêndice* do SharePoint
  se o prefixo remoto reproduzir o hash original).

## 1. Preflight obrigatório ANTES de trocar pointer/página

Nenhuma escrita em página enquanto os passos P1–P4 não passarem. O script já
recusa versão já publicada (`Release <v> já existe; ...`) e já aborta se o guard
de `Key` falhar; os passos abaixo são a verificação *positiva* que faltava
documentar.

| # | Verificação | Como | Falha |
| --- | --- | --- | --- |
| P1 | A release foi realmente gravada e é imutável | `GetFolderByServerRelativePath('<release>')/Exists` | Abortar; não publicar página |
| P2 | **Readback por hash** de todos os arquivos da release | `walk(<release>)` retorna a contagem remota == `files.length`; cada arquivo já teve SHA-256 conferido no `upload()` | Abortar; `Release incompleta no servidor: <n>/<m>` |
| P3 | Entradas obrigatórias presentes | `releases/0.17.15/host/loader.js`, `host/host.js`, `host/admin.scoped.css`, `manifest.json`, `entrypoints.json` | Abortar |
| P4 | Estabilidade da página alvo | Re-ler `CanvasContent1` e o `etag` imediatamente antes do MERGE; `IF-MATCH` sobre o `etag` lido | Abortar; página mudou |
| P5 | Só depois de P1–P4 | `publishPages()` (MERGE + Publish) | — |

### Qual é a página pública deste site

Confirmado **sem acessar o SharePoint**, pelos registros em `CAMAP-V3/tmp`:

- A home real é **`SitePages/Default.aspx`** (*"`Default.aspx` é a página real de
  entrada"*; a SPA monta as rotas 01–08 como rotas de hash sobre ela). A pasta
  *Site Pages* contém `Default.aspx`, `Administrator.aspx` e `Contatos.aspx`.
- **`MiniJoomla.aspx` não existe neste site** — é apenas o default do parâmetro
  `--public-page` no script.
- O estado atual da página pública, **medido pela outra equipe**, é o loader
  `releases/0.17.13/host/loader.js`. Um registro antigo dos artefatos locais
  associava `Default.aspx` (`pageItemId 3`) a `releases/0.17.10/host/loader.js`;
  esse registro está **desatualizado** e não deve ser usado como linha de base.
- A ativação restrita (`--admin-only`) **não altera** a página pública: ela
  permanece com o loader medido. A versão da página pública é informação
  **medida no host**, não derivada destes documentos; confirme-a com o passo
  somente leitura abaixo antes e depois da operação.
- Consequência prática: o nome a passar em `--public-page` neste site seria
  **`Default.aspx`** — mas nesta rodada ele **não deve ser passado**, porque a
  troca do host do site público pertence a outra equipe e não está autorizada.
  Como o alvo é restrito ao painel, a página pública nem é resolvida.

### Comandos exatos (não executar nesta tarefa)

Passo 0 (somente leitura) — registrar qual loader a **página pública** referencia,
antes de qualquer operação. Não escreve nada:

```sh
# Rode no navegador do FioriAgent já autenticado (mesma sessão do deploy).
# Lê o CanvasContent1 de Default.aspx e imprime a URL <release>/host/loader.js
# referenciada. Anote o valor: é a linha de base que o passo 3 vai comparar.
```

Passo 1 — subir e verificar a release, **sem alterar página alguma**:

```sh
node scripts/deploy-sharepoint.mjs --version 0.17.15 \
  --web /teams/camap-agp --session <id> \
  --prepare-only --skip-provision
```

`--prepare-only` executa `upload()` (com o readback por hash e a contagem
remota) e **pula** `publishPages()`. É exatamente o "confirmar que
`releases/0.17.15/` existe e passou no readback" exigido antes de trocar o
pointer. Sem a flag, o mesmo script já valida o readback e a contagem antes de
chamar `publishPages()` — a ordem no código já é a correta
(`await upload(files)` → `if (remote !== files.length) throw` → `publishPages()`).

Passo 1.5 (somente leitura) — provar que os ativos de layout `FullBleed` já
estão **dentro** da release preparada, com hash. `--mse-layout FullBleed` não
inventa o algoritmo: ele só acrescenta o `<div data-spmiddle-host
data-spmiddle-layout="FullBleed">` no snippet **e** exige que
`<release>/host/spmiddle-layout/{layout.js,layout.css,spmiddle-mse-host.js}`
existam no caminho exato. Esses três arquivos são copiados do adaptador real
`SPMIDDLE/host-adapters/modern-script-editor/` durante o *stage*
(`scripts/deploy-sharepoint.mjs:269-275`), então o passo 1 já os subiu; este
passo apenas confirma o hash localmente, sem contato com o host.

```sh
# Hash local dos três ativos que o wrapper FullBleed referencia, calculado no
# stage já preparado. Deve ser idêntico ao hash do adaptador SPMIDDLE de origem.
node -e "const {createHash}=require('node:crypto');const {readFileSync,readdirSync}=require('node:fs');const p='tmp/deploy/0.17.15/stage/host/spmiddle-layout';for(const n of readdirSync(p).sort()){console.log(n, createHash('sha256').update(readFileSync(p+'/'+n)).digest('hex'))}"
```

Registre a saída no aceite junto com os hashes do adaptador de origem
(`SPMIDDLE/host-adapters/modern-script-editor/`). Sem eles o snippet
`FullBleed` carrega uma página sem o wrapper real e o painel volta a ficar
preso na coluna de ~1200px.

Passo 2 — ativar **somente o painel administrativo**, deixando a página pública
intocada:

```sh
node scripts/deploy-sharepoint.mjs --version 0.17.15 \
  --web /teams/camap-agp --session <id> \
  --activate-existing --admin-only --mse-layout FullBleed --skip-provision
```

Não passe `--public-page` aqui: `--admin-only` é exclusivo com
`--public-page`/`--pages` e a combinação é **rejeitada com erro antes de
qualquer contato com o host**. Com `--admin-only` só `Administrator.aspx` entra
em `PAGES`, então o nome da página pública é irrelevante e nem precisa ser
resolvido.

- `--activate-existing` é necessário porque o passo 1 já criou a release: sem
  ele o script recusa (`Release 0.17.15 já existe`) e a ativação jamais
  aconteceria. Ele **não** regrava arquivos: refaz o readback completo por hash
  contra o manifest local e aborta se algo divergir, tudo **antes** da primeira
  escrita em página.
- `--activate-existing` monta o próprio stage em um diretório novo (o passo 1
  deixou `tmp/deploy/0.17.15/stage` ocupado e `stage-release.js` recusa
  sobrescrever). Para retomar explicitamente o stage já preparado, acrescente
  `--stage-dir stage`.
- `--admin-only` (equivalente a `--pages Administrator.aspx`) restringe
  `publishPages()` a `Administrator.aspx`. Nessa execução a página pública
  **não é localizada, lida, escrita, publicada, nem tem rollback gerado** — a
  única página endereçada é `Administrator.aspx`.
- `--admin-only` é **exclusivo**: combiná-lo com `--pages` ou com
  `--public-page` é rejeitado com erro, para que uma ambiguidade nunca publique
  o site público por engano.
- `--mse-layout FullBleed` é o que faz a **única** página escrita
  (`Administrator.aspx`) receber o snippet com
  `<div data-spmiddle-host data-spmiddle-layout="FullBleed">` e o
  `<link rel="stylesheet" data-minijoomla-mse-layout>` para
  `host/spmiddle-layout/layout.css` (`scripts/deploy-sharepoint.mjs:349-350`).
  Sem a flag, o snippet legado **sem wrapper** é preservado — e é exatamente
  esse o sintoma do painel preso na coluna de ~1200px. A flag só é aplicada a
  páginas em `publishPages()`; com `--admin-only`, a página pública não é
  nem localizada. Valores aceitos: apenas `FullBleed` ou `Contained`
  (`scripts/deploy-sharepoint.mjs:98-99`) — qualquer outro aborta com
  `TypeError` **antes** de qualquer contato com o host.
- Sem `--admin-only`/`--pages`, o comportamento é o de sempre (página pública +
  `Administrator.aspx`). Trocar o host do site público pertence a outra frente e
  não é feito aqui.

Passo 3 (somente leitura) — repetir o passo 0 e comparar. A página pública deve
referenciar **o mesmo loader de antes** (`releases/0.17.13/host/loader.js`),
provando que `--admin-only` não a alterou. Se o valor tiver mudado, algo fora do
escopo escreveu na página pública: pare e acione o rollback. Registre os dois
valores lado a lado no aceite.

## 2. `--skip-provision`: por que o preparo E a ativação precisam dele

`provision()` (`scripts/deploy-sharepoint.mjs:148-168`) é uma escrita de
**esquema**, separada das páginas. Ele regrava **sem condição** os `Choices` de
**todos** os campos `Choice` de **todas** as listas MiniJoomla, com
`etag: '*'` (`allowWildcardEtag`), porque `inspect()` só cria campos ausentes e
opções novas de um `Choice` já existente exigem `MERGE` explícito
(`.../fields/getbyinternalnameortitle('<InternalName>')`).

- A **0.17.15 não altera esquema de lista**: é uma rodada de filtros de coluna
  no painel. Seu diff de conteúdo são os módulos do administrador, o serviço de
  leitura e os ativos; nenhuma lista, coluna ou opção de `Choice` muda.
- Portanto **não há nada a provisionar**, e `provision()` seria uma escrita
  destrutiva de configuração: ele **substituiria** os `Choices` atuais das
  listas de produção pelos `Choices` do schema local. Se produção tiver qualquer
  opção que o schema local não tenha, ela seria **perdida**.
- A **0.17.14 foi publicada sem `--skip-provision`**, o que significa que aquele
  `MERGE` de `Choices` já rodou uma vez. Repeti-lo na 0.17.15 ampliaria o risco
  sem qualquer ganho.
- Por isso o passo 1 (preparo) **e** o passo 2 (ativação) levam
  `--skip-provision`. A flag é lida em `scripts/deploy-sharepoint.mjs:384`
  (`if (!flag('skip-provision')) await provision();`) e é a **única** coisa que
  chama `provision()`: com ela, **nenhuma** requisição a `/fields` é emitida.
- Cobertura de teste: `tests/deploy-pages-scope.test.js` afirma que nenhuma
  expressão enviada ao host endereça `/fields`, tanto no preparo quanto na
  ativação (`skip-provision-nao-escreve-esquema`), além dos 11 pontos que já
  passavam a flag.
- Se **qualquer** parte de uma rodada futura precisar mudar esquema de lista, ela
  **não** pode usar `--skip-provision`: pare e escale a decisão em vez de rodar
  `provision()` sobre produção.

## 3. Rollback

`publishPages()` grava, antes da primeira escrita, o estado anterior em
`tmp/deploy/<version>/rollback-<page>.html` com o `CanvasContent1` intacto.
Com `--admin-only`, é gerado **apenas** `rollback-Administrator.aspx.html` (a
página pública não recebe rollback porque não é tocada).

- **Rollback da página:** restaurar o `CanvasContent1` salvo em
  `rollback-<page>.html` pelo mesmo MERGE + Publish. As páginas antigas voltam a
  apontar para `releases/0.17.13/` (painel, e também o estado medido atual da
  página pública).
- **Rollback por pointer (equivalente e preferível):** publicar novamente com
  `--version 0.17.13` — a release 0.17.13 continua no SharePoint e é imutável,
  então basta reapontar a página para ela. Não é preciso reenviar arquivos.
- **Rollback de esquema: não é necessário nesta rodada**, justamente porque
  `--skip-provision` garante que `Choices` de produção não foram tocados.
- As releases não são sobrescritas (o guard de "versão já existe" impede), logo
  a 0.17.13 permanece recuperável. Um backup adicional do canvas de produção
  está em `CAMAP-V3/tmp/default_canvas_before.json`.

## 4. O host permite carregar uma release específica sem trocar o pointer? **Sim.**

Três mecanismos, todos já existentes e comprovados neste projeto:

1. **Publicar somente o painel (precedente real).** `PAGES` deriva de duas
   entradas independentes: a pública (`--public-page`, atributo
   `data-minijoomla-site`) e **`Administrator.aspx`** (atributo
   `data-minijoomla-admin-root`); cada página carrega o próprio
   `CanvasContent1` com a URL `<release>/host/loader.js`. Hoje a página pública
   (`Default.aspx`) e `Administrator.aspx` apontam para **0.17.13** (valor da
   pública medido pela outra equipe). Com `--admin-only` é possível publicar
   `Administrator.aspx` apontando para **0.17.15** sem tocar na página pública,
   que é o comando do passo 2 acima. O aceite visual acontece no painel,
   liberando a ativação do site público só depois da aprovação — e essa troca
   pertence a outra frente.
2. **`--prepare-only`.** Sobe e verifica `releases/0.17.15/` inteira no
   SharePoint sem tocar em nenhuma página. É o passo que garante o artefato
   antes de qualquer troca de pointer.
3. **Página de teste dedicada.** `PAGES` é um mapa; uma página nova (ex.
   `MiniJoomla-teste.aspx`) com `data-minijoomla-site` carrega a release nova
   pelo mesmo caminho, sem qualquer efeito sobre as páginas em uso. O
   `installation-preflight.js` valida que a URL pertence a
   `<libraryPath>/releases/<X.Y.Z>/`, à mesma origem, sem `search`/`hash`, e que
   os módulos/ativos obrigatórios existem — serve de conferência do alvo.

Observação de segurança: `publishPages()` falha explicitamente se a página tiver
mais de um Modern Script Editor (`esperado um Modern Script Editor em ...`), o
que impede apontar por engano uma página alheia.

## Verificações locais desta rodada (sem rede)

- Pacote regerado em `tmp/release-w2-0.17.15` a partir da árvore limpa, com
  `manifest.json` (`algorithm: sha256`, `target: all`) e versão 0.17.15 coerente
  no `manifest.json`, no `entrypoints.json` e no `loader.js`; o `package.json`
  (versão 0.17.15) é a fonte e não é empacotado.
- `node scripts/release-check.js` aprovado (gate estrutural offline).
- Prova de isolamento do pacote: `tmp/prova-sha256-0.17.15.md`.

Nada publicado, nada ativado.
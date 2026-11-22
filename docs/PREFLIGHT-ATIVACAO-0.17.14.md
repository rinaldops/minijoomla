# Preflight de ativação segura — MINIJOOMLA 0.17.14

Escopo: apenas o painel administrativo. Nada foi publicado nem ativado nesta rodada.

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
| P3 | Entradas obrigatórias presentes | `releases/0.17.14/host/loader.js`, `host/host.js`, `host/admin.scoped.css`, `manifest.json`, `entrypoints.json` | Abortar |
| P4 | Estabilidade da página alvo | Re-ler `CanvasContent1` e o `etag` imediatamente antes do MERGE; `IF-MATCH` sobre o `etag` lido | Abortar; página mudou |
| P5 | Só depois de P1–P4 | `publishPages()` (MERGE + Publish) | — |

### Qual é a página pública deste site

Confirmado **sem acessar o SharePoint**, pelos registros em `CAMAP-V3/tmp`:

- A home real é **`SitePages/Default.aspx`** (*"`Default.aspx` é a página real de
  entrada"*; a SPA monta as rotas 01–08 como rotas de hash sobre ela). A pasta
  *Site Pages* contém `Default.aspx`, `Administrator.aspx` e `Contatos.aspx`.
- **`MiniJoomla.aspx` não existe neste site** — é apenas o default do parâmetro
  `--public-page` no script. Hoje `Default.aspx` (`pageItemId 3`) referencia o
  loader `releases/0.17.10/host/loader.js` e `Administrator.aspx`
  (`pageItemId 16`) referencia `releases/0.17.13/host/loader.js`.
- Consequência prática: o nome a passar em `--public-page` neste site é
  **`Default.aspx`**. Se algum comando omitir `--public-page`, o script tentará
  localizar `MiniJoomla.aspx` e falhará em `FileLeafRef` — e, como o alvo agora
  é restrito, **não há risco de escrever em página errada**.

### Comandos exatos (não executar nesta tarefa)

Passo 1 — subir e verificar a release, **sem alterar página alguma**:

```sh
node scripts/deploy-sharepoint.mjs --version 0.17.14 \
  --web /teams/camap-agp --session <id> --public-page Default.aspx \
  --prepare-only
```

`--prepare-only` executa `upload()` (com o readback por hash e a contagem
remota) e **pula** `publishPages()`. É exatamente o "confirmar que
`releases/0.17.14/` existe e passou no readback" exigido antes de trocar o
pointer. Sem a flag, o mesmo script já valida o readback e a contagem antes de
chamar `publishPages()` — a ordem no código já é a correta
(`await upload(files)` → `if (remote !== files.length) throw` → `publishPages()`).

Passo 2 — ativar **somente o painel administrativo**, deixando a página pública
intocada:

```sh
node scripts/deploy-sharepoint.mjs --version 0.17.14 \
  --web /teams/camap-agp --session <id> --public-page Default.aspx \
  --activate-existing --admin-only
```

- `--activate-existing` é necessário porque o passo 1 já criou a release: sem
  ele o script recusa (`Release 0.17.14 já existe`) e a ativação jamais
  aconteceria. Ele **não** regrava arquivos: refaz o readback completo por hash
  contra o manifest local e aborta se algo divergir, tudo **antes** da primeira
  escrita em página.
- `--admin-only` (equivalente a `--pages Administrator.aspx`) restringe
  `publishPages()` a `Administrator.aspx`. Nessa execução a página pública
  **não é localizada, lida, escrita, publicada, nem tem rollback gerado** — a
  única página endereçada é `Administrator.aspx`.
- `--admin-only` é **exclusivo**: combiná-lo com `--pages` ou com
  `--public-page` é rejeitado com erro, para que uma ambiguidade nunca publique
  o site público por engano.
- Sem `--admin-only`/`--pages`, o comportamento é o de sempre (página pública +
  `Administrator.aspx`). Trocar o host do site público pertence a outra frente e
  não é feito aqui.

## 2. Rollback

`publishPages()` grava, antes da primeira escrita, o estado anterior em
`tmp/deploy/<version>/rollback-<page>.html` com o `CanvasContent1` intacto.
Com `--admin-only`, é gerado **apenas** `rollback-Administrator.aspx.html` (a
página pública não recebe rollback porque não é tocada).

- **Rollback da página:** restaurar o `CanvasContent1` salvo em
  `rollback-<page>.html` pelo mesmo MERGE + Publish. As páginas antigas voltam a
  apontar para `releases/0.17.13/` (painel) ou `0.17.10` (página pública).
- **Rollback por pointer (equivalente e preferível):** publicar novamente com
  `--version 0.17.13` — a release 0.17.13 continua no SharePoint e é imutável,
  então basta reapontar a página para ela. Não é preciso reenviar arquivos.
- As releases não são sobrescritas (o guard de "versão já existe" impede), logo
  a 0.17.13 permanece recuperável. Um backup adicional do canvas de produção
  está em `CAMAP-V3/tmp/default_canvas_before.json`.

## 3. O host permite carregar uma release específica sem trocar o pointer? **Sim.**

Três mecanismos, todos já existentes e comprovados neste projeto:

1. **Publicar somente o painel (precedente real).** `PAGES` deriva de duas
   entradas independentes: a pública (`--public-page`, atributo
   `data-minijoomla-site`) e **`Administrator.aspx`** (atributo
   `data-minijoomla-admin-root`); cada página carrega o próprio
   `CanvasContent1` com a URL `<release>/host/loader.js`. Hoje a pública
   (`Default.aspx`) aponta para **0.17.10** e `Administrator.aspx` para
   **0.17.13**. Com `--admin-only` é possível publicar `Administrator.aspx`
   apontando para **0.17.14** sem tocar na página pública, que é o comando do
   passo 2 acima. O aceite visual acontece no painel, liberando a ativação do
   site público só depois da aprovação — e essa troca pertence a outra frente.
2. **`--prepare-only`.** Sobe e verifica `releases/0.17.14/` inteira no
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

- Pacote regerado em `tmp/release-w2-0.17.14` a partir da árvore limpa: 255
  arquivos no `manifest.json` (`algorithm: sha256`, `target: all`), versão
  0.17.14 coerente no `manifest.json`, no `entrypoints.json` e no `loader.js`;
  o `package.json` (versão 0.17.14) é a fonte e não é empacotado.
- `node scripts/release-check.js` aprovado (gate estrutural offline).
- Prova de isolamento: `tmp/prova-sha256-r2.md` — 221 IGUAL, 15 DIFERE-ESCOPO
  justificado, 18 DIFERE-DERIVADO (só o token de versão), 1 NOVO, 0 DIFERE-EOL.

Nada publicado, nada ativado.
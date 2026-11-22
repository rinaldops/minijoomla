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
recusa versão já publicada (`Release <v> já existe; publique uma versão nova.`)
e já aborta se o guard de `Key` falhar; os passos abaixo são a verificação
*positiva* que faltava documentar.

| # | Verificação | Como | Falha |
| --- | --- | --- | --- |
| P1 | A release foi realmente gravada e é imutável | `GetFolderByServerRelativePath('<release>')/Exists` | Abortar; não publicar página |
| P2 | **Readback por hash** de todos os arquivos da release | `walk(<release>)` retorna a contagem remota == `files.length`; cada arquivo já teve SHA-256 conferido no `upload()` | Abortar; `Release incompleta no servidor: <n>/<m>` |
| P3 | Entradas obrigatórias presentes | `releases/0.17.14/host/loader.js`, `host/host.js`, `host/admin.scoped.css`, `manifest.json`, `entrypoints.json` | Abortar |
| P4 | Estabilidade da página alvo | Re-ler `CanvasContent1` e o `etag` imediatamente antes do MERGE; `IF-MATCH` sobre o `etag` lido | Abortar; página mudou |
| P5 | Só depois de P1–P4 | `publishPages()` (MERGE + Publish) | — |

Comando de publicação já existente (não executar nesta tarefa):

```sh
node scripts/deploy-sharepoint.mjs --version 0.17.14 \
  --web <web> --public-page MiniJoomla.aspx \
  --prepare-only   # sobe e verifica a release; NAO altera paginas
```

`--prepare-only` executa `upload()` (com o readback por hash e a contagem
remota) e **pula** `publishPages()`. É exatamente o "confirmar que
`releases/0.17.14/` existe e passou no readback" exigido antes de trocar o
pointer. Sem a flag, o mesmo script já valida o readback e a contagem antes de
chamar `publishPages()` — a ordem no código já é a correta
(`await upload(files)` → `if (remote !== files.length) throw` → `publishPages()`).

## 2. Rollback

`publishPages()` grava, antes da primeira escrita, o estado anterior em
`tmp/deploy/<version>/rollback-<page>.html` com o `CanvasContent1` intacto.

- **Rollback da página:** restaurar o `CanvasContent1` salvo em
  `rollback-<page>.html` pelo mesmo MERGE + Publish. As páginas antigas voltam a
  apontar para `releases/0.17.13/`.
- **Rollback por pointer (equivalente e preferível):** publicar novamente com
  `--version 0.17.13` — a release 0.17.13 continua no SharePoint e é imutável,
  então basta reapontar a página para ela. Não é preciso reenviar arquivos.
- As releases não são sobrescritas (o guard de "versão já existe" impede), logo
  a 0.17.13 permanece recuperável. Um backup adicional do canvas de produção
  está em `CAMAP-V3/tmp/default_canvas_before.json`.

## 3. O host permite carregar uma release específica sem trocar o pointer? **Sim.**

Três mecanismos, todos já existentes e comprovados neste projeto:

1. **Página separada (precedente real).** `PAGES` em `deploy-sharepoint.mjs`
   define duas páginas independentes: a pública (`--public-page`, ex.
   `MiniJoomla.aspx`, atributo `data-minijoomla-site`) e **`Administrator.aspx`**
   (atributo `data-minijoomla-admin-root`). Cada página carrega o seu próprio
   `CanvasContent1`, com a URL `<release>/host/loader.js` embutida. Hoje
   `Administrator.aspx` aponta para **0.17.13**. Logo é possível publicar
   `Administrator.aspx` apontando para **0.17.14** — via
   `node scripts/deploy-sharepoint.mjs --version 0.17.14 --web <web>
   --public-page <pagina-publica-inalterada>` — e deixar `MiniJoomla.aspx`
   (produção) intocado. O aceite visual acontece em `Administrator.aspx`,
   liberando a ativação em produção só depois da aprovação.
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
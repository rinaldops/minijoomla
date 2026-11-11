# Ciclo: aceite real em destino vazio — Sample Data, editor/upload, CRUD e acessibilidade

Data: 11/11/2026 (America/Sao_Paulo). Primeira execução real deste gate contra
um site SharePoint até então vazio (sem releases MINIJOOMLA nem conteúdo nas
oito listas), autorizado explicitamente pelo usuário:
`https://petrobrasbr.sharepoint.com/teams/Comunidades-de-interesse-192`
(`Default.aspx` público, `Administrator.aspx` painel). Sessão FIORI-AUTO
própria e exclusiva (RPC 47250/CDP 9290, perfil
`claude-minijoomla-acceptance`), isolada de qualquer outra sessão/agente em
execução concorrente no mesmo host.

## Descoberta corrigida antes do aceite

A release já publicada nessa página (`0.16.1`) estava configurada com
`webUrl`/listas apontando para **outro site** (`/teams/SAPScripting`) — um
resíduo de trabalho histórico anterior, não uma instalação real deste site.
O painel renderizava dados de `SAPScripting` sob a URL de
`Comunidades-de-interesse-192`, mascarando o fato de que este site nunca
tinha sido instalado de fato. Identificado via leitura do `host.js` publicado
(`PRECONFIGURED` embutido no arquivo) antes de qualquer gravação.

Correção: nova release imutável `0.17.0` publicada com `scripts/deploy-sharepoint.mjs`
apontando corretamente para `/teams/Comunidades-de-interesse-192` (listas
MiniJoomla* provisionadas nesse site, pela primeira vez — oito listas antes
inexistentes aqui). Páginas `Default.aspx`/`Administrator.aspx` atualizadas
com `publishPages()` (mesmo contrato de MERGE com ETag/guard do script já
existente). Nenhum dado de `SAPScripting` foi lido, alterado ou publicado;
o residual `0.16.1` permanece intocado como release imutável histórica.

## Gate 1 — Destino genuinamente vazio

Confirmado por evidência visual dupla: painel com **0 em todos os contadores**
(Artigos/Categorias/Tags/Menus/Módulos do site/Extensões registradas) e site
público mostrando "Nenhum conteúdo publicado ainda." — exatamente o estado
que o guard do Sample Data exige (domínios vazios), sem precisar relaxar ou
contornar o guard.

## Gate 2 — Instalação do Sample Data

Tela `#/sampledata` reportou corretamente a contagem exata do pacote antes de
instalar (Categorias 4, Tags 4, Artigos 11, Itens de menu 8, Plugins 4,
Templates 1, Módulos 7, Configuração 1) e exigiu confirmação explícita
(`window.confirm` nativo — aceito via injeção de um stub `window.confirm=()=>true`
no mesmo contexto de página, já que o RPC do FIORI-AUTO não expõe um método
dedicado a diálogos nativos). Instalação concluída com status final "O pacote
completo já está instalado."; painel pós-instalação bateu exatamente com a
contagem anunciada (11/4/4/8/7/4). Site público renderizou o tema Joomla Blog
completo (menu, busca, módulos nativos, imagens reais sem `data:` URI).

## Gate 3 — CRUD completo + editor + upload real

Ciclo completo exercitado sobre um artigo de teste isolado
("Artigo de aceite MINIJOOMLA"), sem tocar nos 11 artigos do Sample Data:

1. **Create**: formulário `#/articles/new` com TinyMCE real inicializado
   (abas Conteúdo/Imagens e links/Opções/Publicação/Metadados, categorias e
   tags do Sample Data populadas). Título/alias preenchidos via
   `fiori.fillField`; corpo do artigo escrito diretamente no `iframe.tox-edit-area__iframe`
   do TinyMCE. Submit real (`button[type=submit]`) criou o registro (id 12),
   visível no topo da lista, estado Published.
2. **Verificação de acessibilidade nativa**: botão "Verificar acessibilidade"
   do próprio editor de artigo reportou "0 erro(s), 0 aviso(s), 0
   informação(ões). Nenhum problema detectado pelas regras locais."
3. **Upload de imagem real**: arquivo PNG 1×1 criado localmente, injetado no
   `input[type=file]` via `DataTransfer`/`File` (o RPC do FIORI-AUTO não tem
   um método de upload dedicado) e enviado pelo botão "Enviar e usar" real do
   formulário. O campo URL foi preenchido automaticamente com o caminho real
   do SharePoint
   (`/teams/Comunidades-de-interesse-192/SiteAssets/minijoomla/uploads/img-<ts>-1.png`),
   confirmando upload real via `createSharePointFileClient`, não uma
   simulação local.
4. **Update**: artigo salvo novamente com a imagem associada; navegação de
   volta para `#/articles` confirmou a gravação (sem erro/alerta).
5. **Delete (dois passos, igual ao Joomla real)**: lote "Enviar para a
   lixeira" moveu o artigo para o estado Trashed (desapareceu da lista
   padrão, apareceu no filtro "Na lixeira" com botão "Restaurar"); lote
   "Excluir definitivamente" removeu-o de vez. Lista final de lixeira vazia
   ("Nenhum artigo encontrado").

Verificação pós-exclusão via REST direto (`MiniJoomlaArticles` `ItemCount`):
voltou a **11** — exatamente o Sample Data original, sem resíduo do artigo de
teste, confirmando que o CRUD de teste não vazou para o conteúdo nativo.

## Gate 4 — Acessibilidade estrutural (site público)

Inspeção programática da página pública renderizada
(`Default.aspx`, template Cassiopeia-like nativo): 63 landmarks ARIA/
semânticos (`header`/`nav`/`main`/`footer`/`[role]`), zero `<img>` sem `alt`,
hierarquia de headings presente (H1/H2 em sequência, sem saltos). Esta é uma
verificação estrutural automatizada, não uma auditoria assistiva completa
(leitor de tela real, zoom 200/400%, `forced-colors`, navegação por teclado
ponta a ponta continuam fora do escopo desta passagem — mesma lacuna de
ferramental já documentada em `docs/RELEASE-MSE-0.1.0.md` e
`docs/CHECKLIST-CONCLUSAO-MINIJOOMLA.md`).

## Limites desta prova

- Não cobre zoom real 200/400%, `forced-colors`, leitor de tela ou navegação
  por teclado ponta a ponta (lacuna de ferramental conhecida do FIORI-AUTO,
  não de implementação).
- Não testa upload de imagem grande/múltiplos formatos, nem os demais
  domínios (categorias/tags/menus/módulos/plugins/templates) com o mesmo
  nível de detalhe — artigos foi escolhido como representante por já cobrir
  editor rico + upload + CRUD completo no mesmo fluxo.
- Migração assistida (executor) não foi exercitada neste ciclo — permanece
  cobertura local (`tests/extension-migration-executor.test.js`), sem UI de
  painel ainda.
- Release `0.17.0` e as oito listas provisionadas em
  `Comunidades-de-interesse-192` permanecem no site, como evidência viva do
  aceite; nenhum rollback foi executado (não havia necessidade — nenhuma
  falha ocorreu). O residual `0.16.1`/dados de `SAPScripting` não foram
  tocados.
- Capturas de tela ficam em `tmp/acceptance-evidence/` (ignorado pelo Git);
  não commitadas por conterem artefatos de uma sessão real.

## Resultado

Todos os quatro gates do item de fila "Aceites reais: destino vazio, Sample
Data, editor/upload/CRUD e acessibilidade aplicável" passaram com evidência
real, sem simulação. Nenhuma falha ou regressão encontrada; nenhuma correção
de código foi necessária durante este ciclo (a única correção foi
operacional — apontar a release nova para o site correto).

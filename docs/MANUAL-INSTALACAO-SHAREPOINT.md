# Manual de instalação — MINIJOOMLA em um site SharePoint novo

> Público-alvo: administrador/publicador que vai instalar o MINIJOOMLA em um
> site SharePoint **novo, sem listas e sem arquivos do MINIJOOMLA** (ou um
> site existente do qual essas listas/arquivos foram removidos). **Não é
> necessário saber programar nem instalar nenhuma ferramenta de
> desenvolvimento para seguir este manual** — o único passo técnico (gerar
> o pacote `.zip`) é feito uma única vez por quem publica a versão, e pode
> já estar pronto antes mesmo de você começar (seção 2).
>
> Versão de referência deste manual: release MINIJOOMLA **0.17.1**
> (SPMIDDLE 0.2.0). Ajuste os caminhos se publicar uma versão diferente.

## 0. Visão geral do fluxo (caminho recomendado: pacote `.zip`)

1. Obter o pacote `.zip` da versão do MINIJOOMLA que será instalada (seção
   2) — um único arquivo, já com toda a estrutura de pastas definitiva.
2. Enviar esse `.zip` para a biblioteca **SiteAssets** do site de destino e
   extraí-lo pela própria interface do SharePoint (seção 3) — sem criar
   pastas manualmente, sem copiar arquivo por arquivo.
3. Criar (ou reaproveitar) duas páginas modernas `.aspx` no site:
   - uma página **pública** (ex.: `Default.aspx` ou `MiniJoomla.aspx`);
   - uma página **administrativa** (`Administrator.aspx`).
4. Em cada página, adicionar a webpart **Modern Script Editor** e colar o
   código correto — **já pronto, dentro de um arquivo `.txt` que vem junto
   no `.zip`**; basta copiar e colar, trocando só o caminho do site (há um
   código para o site e outro, diferente, para o painel — **nunca o mesmo
   código nas duas páginas**).
5. Publicar as duas páginas.
6. Abrir a página administrativa: o próprio MINIJOOMLA detecta que não há
   infraestrutura (oito listas) e exibe o **instalador inicial**. Preencher
   nome/descrição do site e confirmar.
7. Após a instalação, abrir a página pública para confirmar que o site
   responde (vazio, sem conteúdo — isso é esperado).
8. Opcionalmente, instalar o **Sample Data** (conteúdo de exemplo Joomla)
   pelo próprio painel, em uma etapa separada e explícita.

Nenhum desses passos assume um nome de site, biblioteca alternativa ou
template específico: o MINIJOOMLA é genérico e funciona em qualquer site
SharePoint moderno com permissão de edição de páginas e upload de arquivos.

## 1. Pré-requisitos

- Permissão de **Proprietário/Membro com edição de página** no site de
  destino (para adicionar/editar webparts e publicar páginas).
- Permissão de **gravação na biblioteca SiteAssets** (ou biblioteca
  equivalente) do site, para enviar e extrair o pacote.
- O site de destino deve estar **vazio de MINIJOOMLA**: sem as oito listas
  (`MiniJoomlaArticles`, `MiniJoomlaCategories`, `MiniJoomlaTags`,
  `MiniJoomlaMenu`, `MiniJoomlaExtensions`, `MiniJoomlaTemplates`,
  `MiniJoomlaModuleInstances`, `MiniJoomlaSiteConfig`) e sem a pasta
  `SiteAssets/minijoomla/`. Um site com listas/arquivos de uma instalação
  anterior não é tratado como "vazio" — o instalador recusa adotar listas
  preexistentes, mesmo vazias e compatíveis (ver seção 8 para o
  procedimento de limpeza antes de reinstalar).
- O pacote `.zip` da versão a instalar (próxima seção). **Nenhum outro
  software é necessário** para quem só vai extrair o zip e colar o código
  — nem Node.js, nem Git, nem linha de comando. Essas ferramentas só
  entram em cena para quem *gera* o pacote (seção 2.2, opcional).

## 2. Obter o pacote `.zip`

### 2.1. Se alguém já gerou o pacote para você (caminho normal)

Peça à pessoa responsável pelo MINIJOOMLA na sua organização o arquivo
`minijoomla-<versão>.zip` (por exemplo, `minijoomla-0.17.1.zip`) — ele
costuma ser compartilhado por e-mail, Teams, ou já deixado em uma pasta
compartilhada. Esse arquivo contém **tudo** que este manual pede: o pacote
inteiro, já na estrutura de pastas correta, mais um `.txt` com os dois
códigos prontos para colar nas páginas. Pulando para a seção 3 com esse
arquivo em mãos é suficiente — **o restante desta seção 2 é só para quem
for gerar o pacote pela primeira vez.**

### 2.2. Gerar o pacote você mesmo (avançado, uma vez por versão)

Esta parte é técnica e só precisa ser feita **uma vez por versão**, por
alguém com Node.js instalado — tipicamente um desenvolvedor, não o usuário
final que vai instalar no site. Depois de gerado, o `.zip` resultante pode
ser copiado/distribuído livremente para quem for instalar.

1. **Obter o código-fonte do MINIJOOMLA**, disponível no repositório Git
   `git@github.com:rinaldops/minijoomla.git` (também acessível por HTTPS em
   `https://github.com/rinaldops/minijoomla`):
   ```powershell
   git clone https://github.com/rinaldops/minijoomla.git
   cd minijoomla
   ```
   Sem Git, baixe o ZIP do código-fonte na própria página do repositório no
   GitHub ("Code" → "Download ZIP") e extraia localmente — **esse ZIP do
   código-fonte não é o mesmo arquivo que será enviado ao SharePoint**; é
   só o material bruto a partir do qual o pacote de instalação é gerado.
2. Este repositório depende de um segundo projeto irmão, **SPMIDDLE**
   (`git@github.com:rinaldops/spmiddle.git`), que deve ser clonado/baixado
   **ao lado** do MINIJOOMLA (não dentro dele):
   ```
   algum-diretorio/
     minijoomla/
     SPMIDDLE/
   ```
3. Com [Node.js](https://nodejs.org/) instalado, gere o pacote `.zip` com
   um único comando:
   ```powershell
   cd minijoomla
   node scripts/stage-installation-zip.js --version 0.17.1
   ```
   Isso cria `dist/minijoomla-0.17.1.zip` — um único arquivo, com:
   - todo o pacote (núcleo, administração, templates, módulos/plugins
     nativos, adaptador oficial do SPMIDDLE, TinyMCE etc.), já organizado
     dentro de `minijoomla/releases/0.17.1/` — a mesma estrutura que o
     SharePoint deve reproduzir em `SiteAssets/`;
   - `LEIA-ME.txt`, com o resumo do que fazer com o arquivo;
   - `CODIGO-PARA-COLAR-NAS-PAGINAS.txt`, com os dois códigos do Modern
     Script Editor já preenchidos com a versão `0.17.1` (só falta trocar o
     caminho do site, que o próprio arquivo explica como fazer).

   Esse é o **único arquivo** que precisa ser enviado para o SharePoint.
   `--output dist/<nome>.zip` permite escolher outro caminho/nome local se
   preferir; por padrão, usa `dist/minijoomla-<versão>.zip`.

> Prefere montar o pacote manualmente, arquivo por arquivo, para entender
> exatamente o que cada peça faz (ou integrar num pipeline de publicação
> próprio)? Isso é possível e documentado na seção 9 (avançado) — mas não é
> necessário para uma instalação normal.

## 3. Enviar e extrair o pacote no SharePoint

1. No site de destino, abra a biblioteca **SiteAssets** (ou "Documentos do
   Site").
2. Envie o arquivo `minijoomla-<versão>.zip` pela interface web (botão
   **Enviar** / **Carregar**, ou arrastar o arquivo para a janela do
   navegador).
3. Clique com o botão direito no arquivo `.zip` enviado (ou abra o menu
   "..." ao lado dele) e escolha **Extrair**.
4. O SharePoint cria automaticamente a pasta `minijoomla/` com toda a
   estrutura já organizada — `SiteAssets/minijoomla/releases/<versão>/...`
   — exatamente como o restante deste manual espera. Não é necessário
   criar nenhuma pasta manualmente nem copiar arquivos individualmente.
5. Apague o `.zip` da biblioteca depois de extrair, se preferir — ele não
   é mais necessário (opcional, só para organização).
6. Abra o arquivo `CODIGO-PARA-COLAR-NAS-PAGINAS.txt`, extraído junto na
   raiz de `SiteAssets/` — ele será usado na seção 5.

> **Esta pasta de release nunca é editada depois de extraída.** Se
> precisar corrigir algo, peça/gere um novo `.zip` com um número de versão
> diferente (ex. `0.17.2`), extraia-o ao lado do anterior, e só então
> atualize o código das páginas (seção 5) para apontar para a nova versão
> — nunca edite arquivos dentro de uma pasta `releases/<versão>/` já em uso.

## 4. Criar as duas páginas `.aspx`

### 4.1. Página pública

1. No site, vá em **Novo → Página** (ou reaproveite a página inicial
   existente, como `Default.aspx`/`Home.aspx`, se preferir não criar uma
   nova).
2. Dê um nome à página (ex. `MiniJoomla.aspx`, ou mantenha o nome da página
   inicial existente).
3. **Anote o nome real do arquivo `.aspx`** — ele será necessário em
   `scripts/deploy-sharepoint.mjs --public-page <nome>.aspx` caso decida
   publicar futuras releases via automação; para instalação 100% manual
   (como descrita aqui), não é necessário.

### 4.2. Página administrativa

1. Crie uma segunda página nova chamada **`Administrator.aspx`** (esse nome
   específico é o esperado pela automação de publicação, caso seja usada no
   futuro; para instalação manual, qualquer nome funciona, desde que você
   sempre edite a página certa).
2. Esta página é de uso administrativo — considere restringir sua listagem
   em menus de navegação públicos (não é uma exigência técnica do
   MINIJOOMLA, apenas boa prática).

### 4.3. Em ambas as páginas

- Use o layout de página "Em branco" (sem seções pré-preenchidas de banner,
  texto, etc.) para que a webpart MSE ocupe o espaço livremente.
- **Não publique ainda** — primeiro adicione a webpart e o código corretos
  (próximo passo).

## 5. Adicionar e configurar a webpart Modern Script Editor (MSE)

Esta é a etapa mais sensível: **cada página precisa do código correto e
diferente da outra.** Usar o código errado (por exemplo, colar o código do
site na página administrativa, ou vice-versa) resulta em uma tela em branco
ou em uma mensagem de erro "Não foi possível iniciar o MINIJOOMLA.".

**O código abaixo já vem pronto** no arquivo
`CODIGO-PARA-COLAR-NAS-PAGINAS.txt` extraído na seção 3 — você só precisa
copiar de lá e trocar o caminho do site (`/sites/example` por exemplo), o
que o próprio arquivo explica. Os blocos abaixo mostram o mesmo conteúdo,
para referência e para quem quiser entender cada parte.

### 5.1. Adicionar a webpart

1. Na página em edição, clique no `+` para adicionar uma seção/webpart.
2. Procure por **"Editor de scripts moderno"** (em inglês, "Modern Script
   Editor" — é a webpart com GUID `3a328f0a-99c4-4b28-95ab-fe0847f657a3`,
   caso precise confirmar via inspeção).
3. Clique no ícone de lápis/editar da webpart para abrir a caixa de edição
   de HTML/script.

### 5.2. Código para a página PÚBLICA

Cole exatamente este bloco (ou copie direto do `.txt`), substituindo
`__RELEASE_BASE__` pelo caminho real da release extraída na seção 3 (sem
barra final):

```html
<link rel="stylesheet" data-minijoomla-mse-layout href="__RELEASE_BASE__/host/spmiddle-layout/layout.css">
<div data-spmiddle-host data-spmiddle-instance="minijoomla-site" data-spmiddle-layout="FullBleed">
  <div data-minijoomla-site></div>
</div>
<script src="__RELEASE_BASE__/host/loader.js"></script>
```

Exemplo real, para o site `Comunidades-de-interesse-192` e release
`0.17.1`:

```html
<link rel="stylesheet" data-minijoomla-mse-layout href="/teams/Comunidades-de-interesse-192/SiteAssets/minijoomla/releases/0.17.1/host/spmiddle-layout/layout.css">
<div data-spmiddle-host data-spmiddle-instance="minijoomla-site" data-spmiddle-layout="FullBleed">
  <div data-minijoomla-site></div>
</div>
<script src="/teams/Comunidades-de-interesse-192/SiteAssets/minijoomla/releases/0.17.1/host/loader.js"></script>
```

Pontos-chave deste bloco:

- `data-minijoomla-site` é o contêiner **do site público**. Nunca use
  `data-minijoomla-admin-root` nesta página.
- `data-spmiddle-layout="FullBleed"` faz o MINIJOOMLA ocupar toda a largura
  útil disponível no host (recomendado). Se preferir manter a largura
  contida tradicional do SharePoint, troque por `data-spmiddle-layout="Contained"`.
  Se quiser o comportamento legado sem o wrapper (largura decidida apenas
  pelo tema SharePoint), remova as três linhas do `<link>`/`<div
  data-spmiddle-host>`/`</div>` e deixe apenas:
  ```html
  <div data-minijoomla-site></div>
  <script src="__RELEASE_BASE__/host/loader.js"></script>
  ```
- `data-spmiddle-instance` é um identificador livre (string qualquer, só
  precisa ser única na página); `minijoomla-site` é a convenção usada neste
  manual.

### 5.3. Código para a página ADMINISTRATIVA

Cole exatamente este bloco (mesmo `__RELEASE_BASE__`, mesma release):

```html
<link rel="stylesheet" data-minijoomla-mse-layout href="__RELEASE_BASE__/host/spmiddle-layout/layout.css">
<div data-spmiddle-host data-spmiddle-instance="minijoomla-admin" data-spmiddle-layout="FullBleed">
  <div data-minijoomla-admin-root></div>
</div>
<script src="__RELEASE_BASE__/host/loader.js"></script>
```

Pontos-chave — a diferença em relação ao snippet público:

- O contêiner aqui é `data-minijoomla-admin-root`, **não**
  `data-minijoomla-site`. É exatamente essa `data-*` que diz ao `host.js`
  qual aplicação montar (painel administrativo vs. site público) —
  **não é a URL/nome do arquivo `.aspx` que decide isso**, é o atributo do
  contêiner. Por isso, mesmo que a página se chame "Administrator.aspx", se
  o `<div>` dentro dela tiver `data-minijoomla-site`, o MINIJOOMLA vai
  montar o **site público** dentro do painel, e não o painel administrativo.
- O `<script src="...host/loader.js">` é **idêntico** ao da página pública
  — é o mesmo `loader.js`/`host.js` para as duas páginas; a diferença de
  comportamento vem inteiramente do atributo `data-*` do contêiner.

### 5.4. Checklist de verificação do código colado

Antes de salvar/publicar cada página, confirme:

- [ ] `__RELEASE_BASE__` foi substituído em **todas** as três ocorrências
  (no `<link href>` e no `<script src>`) pelo mesmo caminho real da release.
- [ ] A página pública tem `data-minijoomla-site` (não
  `data-minijoomla-admin-root`).
- [ ] A página administrativa tem `data-minijoomla-admin-root` (não
  `data-minijoomla-site`).
- [ ] As duas páginas apontam para a **mesma** pasta de release
  (`releases/<versão>/`) — não é permitido ter o site numa versão e o
  painel noutra.
- [ ] O caminho usado começa com `/` e é relativo à raiz do domínio (ex.
  `/teams/NomeDoSite/SiteAssets/minijoomla/releases/0.17.1`), não uma URL
  absoluta com `https://...` (o `host.js` valida que a origem da release é
  exatamente a mesma origem da página; uma URL de outro host é rejeitada).

### 5.5. Salvar e publicar

1. Feche a caixa de edição da webpart.
2. Clique em **Publicar** no canto superior direito de cada página.
3. Repita para as duas páginas (pública e administrativa).

## 6. Primeira abertura — instalador automático

1. Abra a página **administrativa** publicada no navegador.
2. Como ainda não existem as oito listas MINIJOOMLA neste site, o
   `host.js` detecta a ausência de configuração e monta automaticamente a
   tela **"Instalação do MINIJOOMLA"** em vez do painel normal — isso é
   esperado e correto, não é um erro.
3. A tela mostra a lista das oito entidades que serão criadas (todas
   marcadas como "a criar") e um formulário com:
   - **Nome do site** (obrigatório, até 200 caracteres);
   - **Descrição** (opcional, até 500 caracteres);
   - uma caixa de confirmação: *"Confirmo a instalação da infraestrutura no
     site atual."*
4. Marque a confirmação e clique em **"Instalar MINIJOOMLA"**.
5. Acompanhe o progresso (a tela anuncia cada lista sendo criada, uma por
   vez — oito no total — seguida da gravação da configuração inicial). Não
   recarregue a página durante esse processo.
6. Ao concluir, a tela de instalação é substituída automaticamente pelo
   **painel administrativo real**, já com o template `cassiopeia` como
   padrão e todos os contadores zerados (nenhum artigo, categoria, módulo
   etc. ainda).

### O que a instalação cria

- As oito listas SharePoint: `MiniJoomlaArticles`, `MiniJoomlaCategories`,
  `MiniJoomlaTags`, `MiniJoomlaMenu`, `MiniJoomlaExtensions`,
  `MiniJoomlaTemplates`, `MiniJoomlaModuleInstances`,
  `MiniJoomlaSiteConfig`, cada uma com os campos/tipos/choices/índices
  nativos exigidos pelo contrato do MINIJOOMLA.
- Uma única linha de configuração em `MiniJoomlaSiteConfig`, com o nome e a
  descrição informados, template padrão `cassiopeia`, página inicial em
  modo "destaques" sem categoria fixa, site **não** em modo offline.
- **Nada mais.** Nenhum artigo, categoria, módulo, extensão, template
  externo, plugin ou Sample Data é criado nesta etapa — isso é proposital:
  a instalação do CMS é sempre separada da instalação de conteúdo/extensões.

### Se algo for interrompido no meio

- O instalador grava um "diário" local (no `localStorage` do navegador, por
  site/biblioteca) a cada lista criada com sucesso. Se a conexão cair ou a
  aba for fechada no meio da instalação, reabrir a mesma página no mesmo
  navegador permite **retomar exatamente do ponto onde parou**, sem repetir
  listas já criadas e sem duplicar nada.
- Se o diário e o estado real do site divergirem de forma irreconciliável
  (por exemplo, alguém excluiu uma lista manualmente no meio do processo), o
  instalador bloqueia com uma mensagem explícita em vez de adivinhar — nesse
  caso, siga o procedimento de limpeza completa (seção 8) e reinstale do
  zero.

## 7. Verificação pós-instalação

1. Abra a página **pública**. Deve mostrar o shell do MINIJOOMLA (menu,
   cabeçalho, rodapé do template Cassiopeia) com a mensagem de "Nenhum
   conteúdo publicado ainda." — isso é o esperado para um site recém-
   instalado, sem conteúdo.
2. No painel administrativo, confira:
   - Painel de controle com todos os contadores zerados;
   - `#/config` mostrando o nome/descrição informados na instalação e o
     template `cassiopeia` selecionado;
   - `#/templates` listando `default` e `cassiopeia` como integrados.
3. (Opcional) Instale o conteúdo de exemplo (Sample Data) pela tela
   `#/sampledata` do painel — essa tela mostra a contagem exata que será
   criada (Artigos 11, Categorias 4, Tags 4, Itens de menu 8, Módulos 7,
   Plugins 4, Templates 1, Configuração 1) e pede confirmação explícita
   antes de gravar qualquer coisa. Essa é uma ação **separada e posterior**
   à instalação do CMS, nunca automática.
4. (Opcional) Em `#/discover` (ou rota equivalente de descoberta), o painel
   detecta novas extensões/templates publicados em
   `SiteAssets/minijoomla/extensions/` e `SiteAssets/minijoomla/templates/`
   e oferece registrá-los — também uma ação explícita e separada, nunca
   automática.

## 8. Limpar um site para reinstalar do zero

Use este procedimento **apenas** em um site de teste cujos dados você está
autorizado a apagar. Ele remove toda a infraestrutura do MINIJOOMLA (listas
e arquivos), deixando o site pronto para seguir este manual desde o início.

1. **Excluir as oito listas** (em "Conteúdo do site" → selecionar cada
   lista `MiniJoomla*` → Excluir, ou via `_api/web/lists(guid'<id>')` com
   `X-HTTP-Method: DELETE`). Isso remove todo o conteúdo editorial
   (artigos, categorias, tags, menus, módulos, extensões registradas,
   templates registrados e a configuração do site). **Importante:** se o
   site estiver sob política de retenção/preservação legal, o SharePoint
   recusa excluir uma lista que ainda tenha itens — exclua primeiro todos
   os itens de cada lista (um a um, ou via REST) e só depois a lista em si.
2. **Excluir a pasta `SiteAssets/minijoomla/`** inteira (todas as releases
   publicadas, uploads de mídia, extensões/templates copiados). Isso remove
   o próprio pacote do MINIJOOMLA do site.
3. As duas páginas `.aspx` (pública e administrativa) **podem ser
   mantidas** — elas só contêm a webpart MSE com o código apontando para
   uma pasta de release que não existirá mais. Ao reabrir essas páginas
   depois da seção 3 em diante (nova pasta de release extraída, com o
   mesmo ou outro número de versão, e o código atualizado para apontar
   para ela), o fluxo de instalação recomeça normalmente. Se preferir,
   você também pode excluir e recriar as páginas — ambos os caminhos
   funcionam, mas não é necessário.
4. Depois de excluir, a página administrativa (se reaberta antes de
   publicar uma nova release) mostrará "Não foi possível carregar o host do
   MINIJOOMLA." (porque o `host.js`/`loader.js` apontados pelo código não
   existem mais) — isso é esperado até você republicar o pacote e, se
   necessário, atualizar o `__RELEASE_BASE__` do código para a nova pasta.

Não há "lixeira lógica" própria do MINIJOOMLA para listas/arquivos — a
exclusão usa a lixeira nativa do SharePoint (recuperável por um tempo
padrão da plataforma, como qualquer exclusão do SharePoint), mas o
MINIJOOMLA em si não oferece desfazer essa operação.

## 9. Avançado: montar o pacote manualmente, sem o `.zip`

Esta seção é só para quem quer entender exatamente o que o `.zip` da seção
2 contém internamente, integrar a geração do pacote a um pipeline de
publicação próprio, ou depurar um problema — **não é necessária para uma
instalação normal**, que termina na seção 3.

`scripts/stage-installation-zip.js` (usado na seção 2.2) é apenas uma casca
fina sobre `scripts/stage-generic-installation.js`, que monta o pacote
completo em uma pasta local (em vez de um `.zip`):

```powershell
cd minijoomla
node scripts/stage-generic-installation.js --version 0.17.1 --output tmp/instalacao-generica-0.17.1
```

Isso gera `tmp/instalacao-generica-0.17.1/` com a seguinte estrutura —
exatamente o que acabaria dentro de `minijoomla/releases/0.17.1/` no `.zip`
da seção 2:

```
instalacao-generica-0.17.1/
  host/
    host.js
    loader.js
    installation-context.js
    mse-layout.js
    spmiddle-layout/
      layout.js
      layout.css
      spmiddle-mse-host.js
    public-snippet.html
    administrator-snippet.html
    admin.scoped.css
  installation-entrypoints.json
  ... (núcleo, administração, templates, módulos/plugins nativos, vendor
       do SPMIDDLE, TinyMCE etc. -- o mesmo pacote gerado por
       scripts/stage-release.js --target all, mais os quatro arquivos do
       host genérico e os dois snippets)
```

Para publicar manualmente, envie **todo** esse conteúdo para
`SiteAssets/minijoomla/releases/0.17.1/` no site de destino (pela interface
web do SharePoint, arrastando a árvore de pastas, ou por sincronização
OneDrive/Explorer) e siga as seções 4-8 normalmente — os códigos do MSE
(seção 5) são os mesmos, só que sem o `.txt` pronto; use os blocos
mostrados na própria seção 5, substituindo `__RELEASE_BASE__` manualmente.

`scripts/stage-release.js --target all|site|core` (sem o `stage-generic-installation.js`)
monta só o núcleo, sem os quatro arquivos do host MSE nem os snippets —
útil para quem for compor um pacote de publicação diferente (por exemplo,
via `scripts/deploy-sharepoint.mjs`, que publica direto no tenant por uma
sessão de navegador autenticada, em vez de gerar arquivos para envio
manual; documentado nos comentários do próprio script, não neste manual).

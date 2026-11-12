# Manual de instalação — MINIJOOMLA em um site SharePoint novo

> Público-alvo: administrador/publicador que vai instalar o MINIJOOMLA em um
> site SharePoint **novo, sem listas e sem arquivos do MINIJOOMLA** (ou um
> site existente do qual essas listas/arquivos foram removidos). Este manual
> cobre o fluxo completo: copiar o pacote, criar as duas páginas `.aspx` com
> a webpart **Modern Script Editor (MSE)**, configurar o código correto em
> cada página, e concluir a instalação inicial pelo próprio painel.
>
> Versão de referência deste manual: release MINIJOOMLA **0.17.1**
> (SPMIDDLE 0.2.0). Ajuste os caminhos se publicar uma versão diferente.

## 0. Visão geral do fluxo

1. Copiar o pacote distribuível do MINIJOOMLA para a biblioteca de
   documentos **SiteAssets** do site de destino, em uma pasta de release
   imutável (`SiteAssets/minijoomla/releases/<versão>/`).
2. Criar (ou reaproveitar) duas páginas modernas `.aspx` no site:
   - uma página **pública** (ex.: `Default.aspx` ou `MiniJoomla.aspx`);
   - uma página **administrativa** (`Administrator.aspx`).
3. Em cada página, adicionar a webpart **Modern Script Editor** e colar o
   snippet correto (há um snippet para o site e outro, diferente, para o
   painel — **nunca o mesmo código nas duas páginas**).
4. Publicar as duas páginas.
5. Abrir a página administrativa: o próprio MINIJOOMLA detecta que não há
   infraestrutura (oito listas) e exibe o **instalador inicial**. Preencher
   nome/descrição do site e confirmar.
6. Após a instalação, abrir a página pública para confirmar que o site
   responde (vazio, sem conteúdo — isso é esperado).
7. Opcionalmente, instalar o **Sample Data** (conteúdo de exemplo Joomla)
   pelo próprio painel, em uma etapa separada e explícita.

Nenhum desses passos assume um nome de site, biblioteca alternativa ou
template específico: o MINIJOOMLA é genérico e funciona em qualquer site
SharePoint moderno com permissão de edição de páginas e upload de arquivos.

## 1. Pré-requisitos

- Permissão de **Proprietário/Membro com edição de página** no site de
  destino (para adicionar/editar webparts e publicar páginas).
- Permissão de **gravação na biblioteca SiteAssets** (ou biblioteca
  equivalente) do site, para enviar os arquivos do pacote.
- O site de destino deve estar **vazio de MINIJOOMLA**: sem as oito listas
  (`MiniJoomlaArticles`, `MiniJoomlaCategories`, `MiniJoomlaTags`,
  `MiniJoomlaMenu`, `MiniJoomlaExtensions`, `MiniJoomlaTemplates`,
  `MiniJoomlaModuleInstances`, `MiniJoomlaSiteConfig`) e sem a pasta
  `SiteAssets/minijoomla/`. Um site com listas/arquivos de uma instalação
  anterior não é tratado como "vazio" — o instalador recusa adotar listas
  preexistentes, mesmo vazias e compatíveis (ver seção 8 para o
  procedimento de limpeza antes de reinstalar).
- Uma máquina local (seu computador ou de quem for publicar) com:
  - [Node.js](https://nodejs.org/) instalado (qualquer versão atual com
    suporte a ES modules; usado nesta documentação com Node 24). É só para
    **gerar o pacote de arquivos localmente antes do envio** — o site
    SharePoint de destino nunca executa Node; tudo que ele recebe é
    HTML/CSS/JavaScript estático.
  - O **código-fonte do MINIJOOMLA** baixado nessa máquina (ver seção 2 —
    é o "pacote distribuível" referido ao longo deste manual: ele **não
    existe pronto para baixar em lugar nenhum**, é gerado localmente a
    partir do código-fonte).

## 2. Obter o código-fonte e gerar o pacote de release

> Esta é a resposta para "onde está o pacote distribuível?": **não há um
> arquivo `.zip` pronto para baixar.** O "pacote distribuível" é gerado
> localmente, pela própria máquina de quem for publicar, a partir do
> código-fonte do MINIJOOMLA — um repositório Git. Depois de gerado, esse
> pacote (uma pasta local) é o que se copia para o SharePoint na seção 3.

### 2.1. Obter o código-fonte

O código-fonte do MINIJOOMLA está no repositório Git
`git@github.com:rinaldops/minijoomla.git` (também acessível por HTTPS em
`https://github.com/rinaldops/minijoomla`, conforme a configuração de
acesso de quem for publicar). Obtenha uma cópia local por um destes
caminhos:

- **Clonar com Git** (recomendado, permite atualizar depois):
  ```powershell
  git clone https://github.com/rinaldops/minijoomla.git
  cd minijoomla
  ```
- **Baixar um ZIP do código-fonte** direto da página do repositório no
  GitHub ("Code" → "Download ZIP") e extrair localmente, se não tiver Git
  instalado ou acesso configurado ao repositório.

Qualquer um dos dois caminhos resulta na mesma estrutura de pastas usada
no restante deste manual (`src/`, `scripts/`, `host-adapters/` etc., na
raiz do que foi baixado/clonado).

> Este repositório depende de um segundo projeto irmão, **SPMIDDLE**
> (`git@github.com:rinaldops/spmiddle.git` ou equivalente), que deve ser
> clonado/baixado **ao lado** do MINIJOOMLA (não dentro dele) — ou seja,
> as duas pastas devem ser irmãs no sistema de arquivos:
> ```
> algum-diretorio/
>   minijoomla/
>   SPMIDDLE/
> ```
> `scripts/stage-release.js`/`scripts/stage-generic-installation.js`
> (próxima seção) leem arquivos de `../SPMIDDLE` relativos à pasta do
> MINIJOOMLA; sem essa pasta irmã presente, a geração do pacote falha.

### 2.2. Gerar o pacote de release (uma vez, por quem publica)

O pacote correto para publicar manualmente em um site SharePoint é gerado
por `scripts/stage-release.js`, que empacota o núcleo **mais** os adaptadores
do host MSE em uma pasta local imutável:

```powershell
cd minijoomla
node scripts/stage-release.js --version 0.17.1 --output tmp/release-0.17.1 --target all
```

Isso gera em `tmp/release-0.17.1/` todos os arquivos do pacote (núcleo,
administração, templates, módulos/plugins nativos, vendor do SPMIDDLE,
TinyMCE etc.), **mas sem** os arquivos do host MSE (`host/host.js`,
`host/loader.js`, `host/installation-context.js`, `host/mse-layout.js`,
`host/spmiddle-layout/*`) nem os snippets prontos — esses fazem parte do
próprio repositório, em `host-adapters/modern-script-editor/`, e precisam
ser copiados manualmente ao lado do restante do pacote (seção 3).

> Alternativa equivalente: `scripts/stage-generic-installation.js` já
> empacota o pacote `core`/`site`/`administrator` **junto com** os quatro
> arquivos genéricos do host e os dois snippets, produzindo um pacote único
> pronto para copiar (sem `host.js` pré-configurado — o host detecta a
> ausência de configuração e abre o instalador por si mesmo):
>
> ```powershell
> node scripts/stage-generic-installation.js --version 0.17.1 --output tmp/instalacao-generica-0.17.1
> ```
>
> Esse caminho é o recomendado para uma instalação **nova** porque não
> requer rodar nenhum script contra o tenant antes da primeira tela: o
> próprio `host.js` genérico, sem configuração embutida, reconhece que não
> há `CONFIG.lists` e monta o instalador automaticamente (ver seção 5).

## 3. Copiar o pacote para o SharePoint

No site de destino, dentro da biblioteca **SiteAssets** (ou outra
biblioteca de documentos de sua escolha, desde que o caminho seja
consistente em todos os passos seguintes), crie a estrutura:

```
SiteAssets/
  minijoomla/
    releases/
      0.17.1/
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
        ... (todo o conteúdo gerado em tmp/instalacao-generica-0.17.1/ ou
             tmp/release-0.17.1/ + host-adapters/modern-script-editor/)
```

- Envie **todo** o conteúdo do pacote gerado na seção 2 para essa pasta,
  preservando a estrutura de subpastas exatamente como está localmente.
- **Esta pasta de release nunca é editada depois de publicada.** Se precisar
  corrigir algo no código, publique uma pasta nova com uma versão diferente
  (ex. `0.17.2`) e só então atualize o snippet das páginas para apontar para
  ela — nunca sobrescreva arquivos dentro de `releases/0.17.1/` já em uso.
- Pode fazer isso manualmente pela interface web do SharePoint (arrastar e
  soltar a árvore de pastas) ou via sincronização OneDrive/Explorer. Não há
  dependência de nenhuma ferramenta de automação para este passo — é cópia
  de arquivos comum.

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
diferente da outra.** Usar o código errado (por exemplo, colar o snippet do
site na página administrativa, ou vice-versa) resulta em uma tela em branco
ou em uma mensagem de erro "Não foi possível iniciar o MINIJOOMLA.".

### 5.1. Adicionar a webpart

1. Na página em edição, clique no `+` para adicionar uma seção/webpart.
2. Procure por **"Editor de scripts moderno"** (em inglês, "Modern Script
   Editor" — é a webpart com GUID `3a328f0a-99c4-4b28-95ab-fe0847f657a3`,
   caso precise confirmar via inspeção).
3. Clique no ícone de lápis/editar da webpart para abrir a caixa de edição
   de HTML/script.

### 5.2. Código para a página PÚBLICA

Cole exatamente este bloco, substituindo `__RELEASE_BASE__` pelo caminho
real da release copiada na seção 3 (sem barra final):

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
   templates registrados e a configuração do site).
2. **Excluir a pasta `SiteAssets/minijoomla/`** inteira (todas as releases
   publicadas, uploads de mídia, extensões/templates copiados). Isso remove
   o próprio pacote do MINIJOOMLA do site.
3. As duas páginas `.aspx` (pública e administrativa) **podem ser
   mantidas** — elas só contêm a webpart MSE com o snippet apontando para
   uma pasta de release que não existirá mais. Ao reabrir essas páginas
   depois da seção 3 em diante (nova pasta de release publicada
   com o mesmo ou outro número de versão, e o snippet atualizado para
   apontar para ela), o fluxo de instalação recomeça normalmente. Se
   preferir, você também pode excluir e recriar as páginas — ambos os
   caminhos funcionam, mas não é necessário.
4. Depois de excluir, a página administrativa (se reaberta antes de
   publicar uma nova release) mostrará "Não foi possível carregar o host do
   MINIJOOMLA." (porque o `host.js`/`loader.js` apontados pelo snippet não
   existem mais) — isso é esperado até você republicar o pacote e, se
   necessário, atualizar o `__RELEASE_BASE__` do snippet para a nova pasta.

Não há "lixeira lógica" própria do MINIJOOMLA para listas/arquivos — a
exclusão usa a lixeira nativa do SharePoint (recuperável por um tempo
padrão da plataforma, como qualquer exclusão do SharePoint), mas o
MINIJOOMLA em si não oferece desfazer essa operação.

/*
 * Integração do TinyMCE (vendorizado em src/media/vendor/tinymce/,
 * licença GPL-2.0-or-later — a mesma que o próprio Joomla já usa para o
 * plugin `plg_editors_tinymce`, confirmada em license.md real do pacote
 * baixado do npm/unpkg) nos campos HTML do painel administrativo.
 *
 * Achado real deste frente (reportado pelo usuário em supervisão):
 * `articletext` de Artigos e `customHtmlBody` da configuração do site
 * eram só `<textarea>` cru — o usuário ficava obrigado a digitar HTML
 * na mão, sem nenhum recurso de negrito/itálico/listas como o TinyMCE
 * real do Joomla oferece.
 *
 * Achado real de 2ª rodada (bug de regressão, supervisão de
 * 02/11/2026): uma implementação anterior desta função montava o
 * preset "simple" do plg_editors_tinymce real e o aplicava também no
 * admin, deixando o toolbar visivelmente "simplificado demais"
 * comparado ao Joomla real. Causa raiz confirmada contra
 * web-devs/JOOMLA/plugins/editors/tinymce/src/PluginTraits/
 * DisplayTrait.php (linha ~294): o Joomla real escolhe o preset POR
 * GRUPO DE USUÁRIO — grupos Administrador/Super Usuário (ids 4/7/8)
 * recebem "advanced"; Registrado/Gerente (ids 2/6) recebem "medium";
 * todo o resto (público) recebe "simple". Quem usa o painel
 * administrativo do MINIJOOMLA sempre desempenha o papel de
 * Administrador/Super Usuário — nunca o papel público "simple" que
 * havia sido usado por engano. Corrigido montando o preset "advanced"
 * real (ver web-devs/JOOMLA/plugins/editors/tinymce/src/PluginTraits/
 * ToolbarPresets.php), abaixo. Não há um terceiro preset "medium"
 * neste arquivo: não existe, hoje, nenhum consumidor
 * Registrado/Gerente do painel administrativo do MINIJOOMLA — só
 * Administrador/Super Usuário monta esta tela.
 *
 * Nunca carrega a biblioteca de um CDN externo em tempo de execução:
 * o tenant real tem Content-Security-Policy restrita por allowlist de
 * domínios (`script-src`) — ver docs/INTEGRATION-SPMIDDLE.md §10.1 —
 * então a mesma origem de SiteAssets que já serve o resto do pacote
 * MINIJOOMLA também precisa servir estes arquivos. `vendorBaseUrl` é
 * sempre informado por quem monta a tela (nunca hardcoded aqui),
 * exatamente como o resto do projeto nunca decide URL de publicação
 * por si só.
 *
 * `loadScript`/`documentRef` são injetáveis (mesmo princípio de
 * createApplication: nenhum acesso direto a `document`/`window` reais
 * fora dos pontos de integração explícitos) para permitir testar a
 * função sem um DOM real.
 *
 * Campos elegíveis (confirmado por varredura no site público): só
 * `articletext` de Artigos (decomposto em introtext/fulltext na
 * fronteira de apresentação — ver app.js) e `customHtmlBody` da
 * configuração do site — os únicos campos que o site público trata
 * como HTML real via sanitizeHtml (ver src/administrator/components/com_minijoomla/field-schemas.js,
 * comentário de `type: 'richtext'`, para o porquê de excluir
 * description/siteDescription).
 */
const DEFAULT_LOAD_SCRIPT = (url) => new Promise((resolve, reject) => {
  const script = document.createElement('script');
  script.src = url;
  script.onload = () => resolve();
  script.onerror = () => reject(new Error(`Falha ao carregar ${url}`));
  document.head.appendChild(script);
});

let loadPromise = null;

/*
 * Carrega o core do TinyMCE uma única vez por página (mesmo princípio
 * já usado por createExtensionLoader.ensureModuleRegistered em
 * src/libraries/minijoomla/modules/dynamic-modules.js: nunca reimportar/recarregar algo já
 * presente). `window.tinymce.baseURL`/`suffix` precisam ser
 * configurados ANTES do script carregar, porque o próprio bootstrap
 * do TinyMCE os lê de `window.tinymce`/`window.tinyMCEPreInit`
 * (confirmado no `tinymce.min.js` real: `UB.setup()` procura
 * `window.tinymce||window.tinyMCEPreInit` para resolver `base`/`suffix`
 * antes de qualquer outra coisa) — sem isso, ele tentaria resolver os
 * sub-recursos (tema/modelo/ícones/skins/plugins) a partir da URL do
 * próprio script, que pode não coincidir com `vendorBaseUrl` informado.
 */
export function loadTinyMceCore(vendorBaseUrl, { loadScript = DEFAULT_LOAD_SCRIPT } = {}) {
  if (loadPromise) return loadPromise;
  globalThis.tinyMCEPreInit = { base: vendorBaseUrl, suffix: '.min' };
  loadPromise = loadScript(`${vendorBaseUrl}/tinymce.min.js`).catch((error) => { loadPromise = null; throw error; });
  return loadPromise;
}

/*
 * Preset "advanced" real do plg_editors_tinymce (ToolbarPresets.php),
 * o preset que o Joomla real entrega aos grupos Administrador/Super
 * Usuário (ver comentário no topo deste arquivo) — o único papel que
 * acessa o painel administrativo do MINIJOOMLA. Reproduzido botão a
 * botão a partir do array real de `toolbar1`, com cinco exclusões
 * deliberadas (nunca substituídas por um botão inventado, mesmo
 * princípio já usado para `readmore`/`jxtdbuttons` no preset "simple"
 * anterior):
 * - `jtemplate`: insere templates de conteúdo do Joomla real — não
 *   existe conceito de "template de conteúdo" no MINIJOOMLA.
 * - `jxtdbuttons`: botões de extensão de outros componentes Joomla
 *   (ex.: inserir módulo/artigo/contato via com_fields/com_modules) —
 *   nenhum desses componentes existe no MINIJOOMLA.
 * - `abbr`/`abbr_remove`: plugin de abreviação PRÓPRIO do Joomla
 *   (`plg_editors_tinymce.abbr`, carregado como script Joomla
 *   separado em DisplayTrait.php, linha ~419) — não é um plugin
 *   TinyMCE padrão, não vendorizável a partir do pacote `tinymce` do
 *   npm.
 * - `language`: seletor de idioma de trechos — recurso de
 *   multilíngue do Joomla (`com_languages`), fora de escopo do
 *   MINIJOOMLA, que não tem conteúdo multilíngue.
 * `readmore` fica, mas segue EXATAMENTE a mesma lógica já existente
 * (abaixo): nunca faz parte do preset base, só é concatenado ao final
 * do toolbar quando `readMoreButton: true` (ver field-schemas.js,
 * ARTICLE_FIELDS.articletext) — é um botão de EDITOR-XTD real
 * (plugins/editors-xtd/readmore), registrado manualmente via
 * `editor.ui.registry.addButton`, nunca um plugin TinyMCE vendorizado.
 * `menu: ['edit', 'insert', 'view', 'format', 'table', 'tools',
 * 'help']` é o array `menu` real do preset "advanced" — igual ao
 * Joomla real, inclui `help`, por isso o plugin `help` é carregado
 * (DisplayTrait.php, linha ~315: `in_array('help', $menubar)` força
 * `$plugins[] = 'help'`).
 *
 * Histórico: uma implementação anterior usava só o preset "simple"
 * (bold/underline/strikethrough, undo/redo, bullist/numlist,
 * pastetext, plugin `lists`) e o aplicava por engano também no admin
 * — ver achado de causa raiz no topo deste arquivo. `TOOLBAR_SIMPLE`/
 * `PLUGINS_SIMPLE` foram removidas (confirmado por varredura: nenhum
 * outro arquivo as referenciava) — o preset "simple" real do Joomla
 * continua documentado em ToolbarPresets.php, caso o MINIJOOMLA um dia
 * precise atender o papel público (não hoje).
 */
const TOOLBAR_ADVANCED = [
  'bold italic underline strikethrough |',
  'alignleft aligncenter alignright alignjustify |',
  'lineheight |',
  'styles |',
  'blocks fontfamily fontsize |',
  'searchreplace |',
  'bullist numlist accordion |',
  'outdent indent |',
  'undo redo |',
  'link unlink anchor image |',
  'code |',
  'forecolor backcolor |',
  'fullscreen |',
  'table |',
  'subscript superscript |',
  'charmap emoticons media hr ltr rtl |',
  'cut copy paste pastetext |',
  'visualchars visualblocks nonbreaking blockquote |',
  'print preview codesample insertdatetime removeformat'
].join(' ');
const MENU_ADVANCED = 'edit insert view format table tools help';
const PLUGINS_ADVANCED = 'lists link image table code charmap emoticons media searchreplace fullscreen visualchars visualblocks nonbreaking codesample insertdatetime accordion anchor directionality preview help';

/*
 * Marcador real de quebra "Leia mais" — EXATAMENTE o mesmo literal que
 * o Joomla real usa em libraries/src/Table/Content.php::bind() (busca)
 * e media_source/com_content/js/admin-article-readmore.es6.js (insere).
 * Nunca um marcador inventado: precisa casar byte a byte com o que
 * src/administrator/components/com_minijoomla/app.js (fromArticleFormValues) procura para decompor
 * articletext em introtext/fulltext.
 */
export const READMORE_MARKER = '<hr id="system-readmore">';
const READMORE_PATTERN = /<hr\s+id=("|')system-readmore("|')\s*\/*>/i;

/*
 * Botão "Leia mais" real (mesmo comportamento de
 * admin-article-readmore.es6.js: insere o marcador na posição do
 * cursor; se o conteúdo já tiver um marcador, avisa em vez de inserir
 * um segundo — um artigo real nunca tem duas quebras).
 */
function registerReadMoreButton(editor) {
  editor.ui.registry.addButton('readmore', {
    text: 'Leia mais',
    tooltip: 'Inserir quebra "Leia mais" (separa introdução do texto completo)',
    onAction() {
      const content = editor.getContent();
      if (content && READMORE_PATTERN.test(content)) {
        globalThis.alert?.('Este artigo já tem uma quebra "Leia mais".');
        return;
      }
      editor.insertContent(READMORE_MARKER);
    }
  });
}

/*
 * Substitui o `<textarea>` identificado por `elementId` por uma
 * instância real do TinyMCE, devolvendo uma função `destroy()` para
 * desmontar o editor (necessário porque src/administrator/components/com_minijoomla/app.js substitui
 * `documentRef.body.innerHTML` por completo a cada navegação — um
 * editor TinyMCE deixado "pendurado" continuaria escutando eventos de
 * um `<textarea>` que não existe mais no DOM, mesmo motivo já
 * documentado para bindFormHandlers/bindTabHandlers precisarem religar
 * a cada navegação). Sincroniza o conteúdo de volta ao `<textarea>`
 * real a cada mudança (`setup: editor => editor.on('change input undo
 * redo', ...)`) para que `readAdminFormValues` (render-form.js), que
 * lê `input.value`, continue funcionando sem precisar saber que existe
 * um editor rico por cima.
 *
 * `readMoreButton: true` (só para `articletext` de Artigos — ver
 * field-schemas.js) adiciona o botão real "Leia mais" ao toolbar,
 * equivalente ao plugin editors-xtd/readmore do Joomla real.
 *
 * `toolbar_mode: 'sliding'` — EXATAMENTE o `default="sliding"` real
 * do campo `toolbar_mode` em
 * web-devs/JOOMLA/plugins/editors/tinymce/forms/setoptions.xml
 * (linha ~59). É este modo (não `'wrap'`, usado por engano numa
 * implementação anterior) que o TinyMCE usa para mostrar o botão "⋯"
 * real (More... — recolhe toda linha de toolbar que não cabe na
 * largura atual atrás desse botão, reexibindo ao clicar de novo);
 * `'wrap'` simplesmente quebra tudo em várias linhas sempre visíveis,
 * sem nenhum botão de recolher — por isso o "⋯" nunca apareceu no
 * preset "advanced" antes desta correção, mesmo com todos os botões
 * reais presentes.
 *
 * `uploadImage` (injetável, mesmo princípio de `vendorBaseUrl`):
 * `({ content, mimeType }) => Promise<{ url }>`, tipicamente
 * `application/media-upload-service.js`'s `uploadImage`, montado pela
 * composição que monta o bootstrap real (nunca decidido aqui, que não
 * sabe onde o SharePoint publica uploads). Quando informado, habilita
 * `images_upload_handler` real: a imagem inserida/colada/arrastada no
 * TinyMCE é enviada como arquivo de verdade, e o editor referencia o
 * resultado por uma URL normal — nunca um `data:` URI inline (ver
 * achado real de bug documentado em media-upload-service.js: um
 * `data:` URI é bloqueado de propósito por `safeUrl`, então uma
 * imagem sem este handler aparecia como quadrado quebrado no artigo
 * publicado). Sem `uploadImage`, o botão de imagem do toolbar
 * continua visível (preset "advanced" real) mas uma tentativa de
 * inserir imagem falha com uma mensagem clara do próprio TinyMCE
 * ("Upload failed"), nunca insere silenciosamente um `data:` URI.
 *
  * `relative_urls: false` preserva as URLs devolvidas por `uploadImage`
  * sem convertê-las em caminhos relativos à página do editor. Por
  * padrão, o TinyMCE faz essa conversão; quando o conteúdo público é
  * renderizado em outra página ou profundidade de URL, o caminho
  * relativo pode apontar para o lugar errado. Caminhos a partir da
  * raiz da origem, como `/uploads/image.png`, devem continuar assim
  * no HTML salvo. O host injeta os destinos de upload; este bridge
  * não configura `document_base_url` nem decide uma base de publicação.
 */
export async function attachRichTextEditor(elementId, { vendorBaseUrl, loadScript, documentRef = globalThis.document, readMoreButton = false, uploadImage } = {}) {
  await loadTinyMceCore(vendorBaseUrl, { loadScript });
  const tinymce = globalThis.tinymce;
  await tinymce.init({
    selector: `#${elementId}`,
    license_key: 'gpl',
    menubar: MENU_ADVANCED,
    toolbar: readMoreButton ? `${TOOLBAR_ADVANCED} | readmore` : TOOLBAR_ADVANCED,
    plugins: PLUGINS_ADVANCED,
    toolbar_mode: 'sliding',
    branding: false,
    promotion: false,
    statusbar: false,
    min_height: 160,
    relative_urls: false,
    // TinyMCE defaults this to false: exposes per-image horizontal/vertical
    // spacing in pixels. The public sanitizer accepts only bounded margins.
    image_advtab: true,
    images_upload_handler: typeof uploadImage === 'function' ? async (blobInfo) => {
      const blob = blobInfo.blob();
      const content = await blob.arrayBuffer();
      const result = await uploadImage({ content, mimeType: blob.type });
      return result.url;
    } : undefined,
    setup(editor) {
      if (readMoreButton) registerReadMoreButton(editor);
      editor.on('change input undo redo SetContent', () => {
        const textarea = documentRef.getElementById(elementId);
        if (textarea) textarea.value = editor.getContent();
      });
    }
  });
  return {
    /*
     * Achado real (supervisão): com `automatic_uploads: true` (padrão do
     * TinyMCE, nunca desativado aqui), uma imagem `data:`/`blob:` JÁ
     * PRESENTE no conteúdo carregado ao abrir o editor é enviada
     * automaticamente — mas de forma assíncrona, e o upload concluído
     * atualiza o `src` da imagem diretamente no DOM do editor SEM
     * disparar nenhum dos eventos acima (`change`/`input`/`undo`/`redo`/
     * `SetContent`) que sincronizam o `<textarea>`. Se o artigo fosse
     * salvo antes de qualquer edição/evento incidental ocorrer depois da
     * conclusão do upload, `readAdminFormValues` lia o `<textarea>` com
     * o `data:` URI ainda antigo — persistido, e depois bloqueado por
     * `safeUrl` ao renderizar (quadrado quebrado, nunca a imagem real).
     * Dois artigos de teste reais com imagem inserida demonstraram os
     * dois lados dessa corrida: um funcionou (upload concluído a tempo
     * de algum evento incidental sincronizar antes do salvar) e outro
     * não (salvo antes).
     *
     * `sync()` elimina a corrida: `editor.uploadImages()` (API real do
     * TinyMCE) aguarda TODO upload de imagem pendente terminar e já
     * substitui o `src` pela URL real no DOM do editor antes de
     * resolver; só então `editor.save()` (API real do TinyMCE) grava
     * `editor.getContent()` atualizado no `<textarea>` subjacente —
     * nunca dependendo de um evento incidental ter disparado primeiro.
     * Chamado explicitamente pelo chamador (src/administrator/components/com_minijoomla/app.js,
     * bindFormHandlers) antes de ler os valores do formulário no
     * submit, para cada editor ativo. Sem `uploadImage` configurado
     * (composição que não publicou o vendor do TinyMCE/upload de
     * mídia), `uploadImages()` ainda existe mas não há nada de `data:`
     * pendente para enviar (o botão de imagem já falha com erro claro,
     * nunca insere `data:` nesse caso — ver `images_upload_handler`
     * acima), então `sync()` seria um no-op seguro de qualquer forma.
     */
    async sync() {
      const editor = tinymce.get(elementId);
      if (!editor) return;
      await editor.uploadImages();
      editor.save();
    },
    destroy() {
      const editor = tinymce.get(elementId);
      editor?.remove();
    }
  };
}

/*
 * Ícones SVG inline do painel administrativo — reconstruídos para
 * parecer com os ícones Font Awesome 6 realmente usados pelo template
 * Atum do Joomla (ver web-devs/JOOMLA/administrator/components/com_menus/
 * presets/default.xml: class="class:home"/"class:file-alt"/"class:list"/
 * "class:puzzle-piece"/"class:wrench", e web-devs/JOOMLA/administrator/
 * modules/mod_menu/src/Menu/CssMenu.php::getIconClass, que transforma
 * isso em "icon-<nome> icon-fw"), nunca uma forma geométrica inventada à
 * parte. Reconstrução própria em SVG (preenchimento solid, estilo
 * Font Awesome real) em vez de vendorizar a biblioteca de fontes/licença
 * do Font Awesome — equivalente visual, sem a dependência externa.
 *
 * Cada função devolve uma string SVG pura, sem estado, usada tanto pelos
 * itens da sidebar (src/administrator/components/com_minijoomla/app.js) quanto por qualquer outro lugar que
 * precise do mesmo símbolo. `aria-hidden="true"` sempre presente: o
 * rótulo textual ao lado de cada ícone já carrega o significado para
 * leitor de tela — o ícone é só reforço visual.
 */
function icon(paths, viewBox = '0 0 512 512') {
  return `<svg viewBox="${viewBox}" width="16" height="16" fill="currentColor" aria-hidden="true" focusable="false">${paths}</svg>`;
}

// icon-home (com_cpanel, item raiz do menu) — mesma silhueta do FA6 "house".
export const dashboardIcon = () => icon('<path d="M275.1 31.1c-11.2-10.1-28.3-10.1-39.4 0L19.1 225.2c-9.1 8.2-14.1 20-14.1 32.3V480c0 17.7 14.3 32 32 32H160c17.7 0 32-14.3 32-32V352c0-17.7 14.3-32 32-32h64c17.7 0 32 14.3 32 32V480c0 17.7 14.3 32 32 32H480c17.7 0 32-14.3 32-32V257.5c0-12.3-5-24.1-14.1-32.3L275.1 31.1z"/>');
// icon-file-alt (com_content, "Artigos") — mesma silhueta do FA6 "file-lines".
export const articleIcon = () => icon('<path d="M64 0C28.7 0 0 28.7 0 64V448c0 35.3 28.7 64 64 64H320c35.3 0 64-28.7 64-64V160H256c-17.7 0-32-14.3-32-32V0H64zM256 0V128H384L256 0zM112 256H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64H272c8.8 0 16 7.2 16 16s-7.2 16-16 16H112c-8.8 0-16-7.2-16-16s7.2-16 16-16z"/>');
// icon-folder (com_categories, "Categorias") — mesma silhueta do FA6 "folder".
export const categoryIcon = () => icon('<path d="M64 480H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H288c-10.1 0-19.6-4.7-25.6-12.8L243.2 57.6C231.1 41.5 212.1 32 192 32H64C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64z"/>');
// icon-tags (com_tags, "Tags") — mesma silhueta do FA6 "tags".
export const tagIcon = () => icon('<path d="M345.9 6.1C354.8 2.2 364.4 0 374.4 0h105.9C495.7 0 512 16.3 512 31.7V137.6c0 10-2.2 19.6-6.1 28.5l-105.3 232c-11.6 25.6-42.1 36.9-67.7 25.3c-6.7-3-12.4-7.5-16.8-13L245.8 328c-6.1-7.6-6.1-18.4 0-26l77.4-96.7c3.4-4.2 3.4-10.3 0-14.5L245.8 94.1c-6.1-7.6-6.1-18.4 0-26l63.4-79.2c5.6-7 13.4-12 22.2-15.3L345.9 6.1zM144 48a48 48 0 1 1 0 96 48 48 0 1 1 0-96z"/><path d="M34.9 97.9C53 86.2 74.8 80 97.1 80H256c17.4 0 31.3 13.9 31.3 31.3V272c0 22.3-6.2 44.1-17.9 62.2L163.9 452.3c-8.3 12.9-25.5 16.7-38.4 8.4s-16.7-25.5-8.4-38.4L223.5 304H97.1C43.5 304 0 260.5 0 206.9V144c0-17.9 9.8-34.7 25-43.9l9.9-6.2z" opacity="0"/>');
// icon-list (com_menus, "Menus") — mesma silhueta do FA6 "list".
export const menuIcon = () => icon('<path d="M40 48C26.7 48 16 58.7 16 72v48c0 13.3 10.7 24 24 24H88c13.3 0 24-10.7 24-24V72c0-13.3-10.7-24-24-24H40zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zM40 208c-13.3 0-24 10.7-24 24v48c0 13.3 10.7 24 24 24H88c13.3 0 24-10.7 24-24V232c0-13.3-10.7-24-24-24H40zm152 48c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zM40 368c-13.3 0-24 10.7-24 24v48c0 13.3 10.7 24 24 24H88c13.3 0 24-10.7 24-24V392c0-13.3-10.7-24-24-24H40zm152 48c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192z"/>');
// icon-puzzle-piece (com_plugins, "Extensões") — mesma silhueta do FA6 "puzzle-piece".
export const pluginIcon = () => icon('<path d="M192 104.8c0-9.2-5.8-17.1-13.9-21.8-14.5-8.4-24.1-24-24.1-41.8C154 18.1 172.1 0 194.5 0S235 18.1 235 41.1c0 17.9-9.6 33.4-24.1 41.8-8.1 4.7-13.9 12.6-13.9 21.8 0 8.4 6.8 15.3 15.2 15.3h77.4c15.6 0 28.3 12.7 28.3 28.3v77.4c0 8.4 6.8 15.2 15.3 15.2 9.2 0 17.1-5.8 21.8-13.9 8.4-14.5 24-24.1 41.8-24.1 23 0 41.1 18.1 41.1 40.5s-18.1 40.5-41.1 40.5c-17.9 0-33.4-9.6-41.8-24.1-4.7-8.1-12.6-13.9-21.8-13.9-8.4 0-15.3 6.8-15.3 15.2v63.6c0 15.6-12.7 28.3-28.3 28.3h-63.6c-8.4 0-15.2 6.8-15.2 15.3 0 9.2 5.8 17.1 13.9 21.8 14.5 8.4 24.1 24 24.1 41.8 0 23-18.1 41.1-41.1 41.1S154 489 154 466.1c0-17.9 9.6-33.4 24.1-41.8 8.1-4.7 13.9-12.6 13.9-21.8 0-8.4-6.8-15.3-15.3-15.3H99.3c-15.6 0-28.3-12.7-28.3-28.3v-63.6c0-8.4-6.8-15.2-15.3-15.2-9.2 0-17.1 5.8-21.8 13.9-8.4 14.5-24 24.1-41.8 24.1C-30.9 318.1-49 300-49 277s18.1-41.1 41.1-41.1c17.9 0 33.4 9.6 41.8 24.1 4.7 8.1 12.6 13.9 21.8 13.9 8.4 0 15.3-6.8 15.3-15.2V195.3c0-15.6 12.7-28.3 28.3-28.3h78.5c8.4 0 15.2-6.9 15.2-15.3z"/>');
// icon-tasks/icon-th-large aproximado como blocos de módulo lateral (com_modules, "Módulos") — mesma silhueta do FA6 "table-cells-large".
export const moduleIcon = () => icon('<path d="M448 96c8.8 0 16 7.2 16 16V224H272V96H448zM272 288H464V400c0 8.8-7.2 16-16 16H272V288zM224 416H64c-8.8 0-16-7.2-16-16V288H224V416zM48 224V112c0-8.8 7.2-16 16-16H224V224H48zM64 48C28.7 48 0 76.7 0 112V400c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V112c0-35.3-28.7-64-64-64H64z"/>');
// icon-wrench (com_cpanel dashboard="system", "Configuração"/"Sistema") — mesma silhueta do FA6 "wrench".
export const configIcon = () => icon('<path d="M352 320c88.4 0 160-71.6 160-160c0-15.3-2.2-30.1-6.2-44.2c-3.1-10.8-16.4-13.2-24.3-5.3l-76.8 76.8c-3 3-7.1 4.7-11.3 4.7H336c-8.8 0-16-7.2-16-16V118.6c0-4.2 1.7-8.3 4.7-11.3l76.8-76.8c7.9-7.9 5.4-21.2-5.3-24.3C382.1 2.2 367.3 0 352 0C263.6 0 192 71.6 192 160c0 19.1 3.4 37.5 9.5 54.5L19.9 396.1c-25.1 25.1-25.1 65.8 0 90.9s65.8 25.1 90.9 0L292.4 305.5c17 6.2 35.4 9.5 54.5 9.5c1.7 0 3.4 0 5.1-0.1z"/><circle cx="48" cy="448" r="16"/>');
export const searchIcon = () => icon('<path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/>');
// icon-arrow-left ("Voltar"/fechar discovery) — mesma silhueta do FA6 "arrow-left".
export const backIcon = () => icon('<path d="M257.5 445.1l-22.2 22.2c-9.4 9.4-24.6 9.4-33.9 0L7 273c-9.4-9.4-9.4-24.6 0-33.9L201.4 44.7c9.4-9.4 24.6-9.4 33.9 0l22.2 22.2c9.5 9.5 9.3 25-.4 34.3L136.6 216H424c13.3 0 24 10.7 24 24v32c0 13.3-10.7 24-24 24H136.6L257.9 410.7c9.8 9.4 10 24.9 .4 34.3z"/>');
// icon-plus ("+ Novo") — mesma silhueta do FA6 "plus".
export const plusIcon = () => icon('<path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"/>');
// icon-star cheia (featured=true) — mesma silhueta do FA6 "star" sólida.
export const starIcon = () => icon('<path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.5 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2.1 12 2.9 24.1 12.9 31.1s23.3 7.9 34.2 2.1L288.1 439.8 415.6 507.9c10.9 5.9 24.2 4.9 34.2-2.1s15-19.1 12.9-31.1L438.3 329 541.4 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"/>');
// icon-star vazia (featured=false), mesma silhueta mas só contorno.
export const starOutlineIcon = () => `<svg viewBox="0 0 576 512" width="16" height="16" fill="none" stroke="currentColor" stroke-width="32" aria-hidden="true" focusable="false"><path d="M316.9 18C311.6 7 300.4 0 288.1 0s-23.5 7-28.8 18L195 150.3 51.4 171.5c-12 1.8-22 10.2-25.7 21.7s-.7 24.2 7.9 32.7L137.8 329 113.2 474.7c-2.1 12 2.9 24.1 12.9 31.1s23.3 7.9 34.2 2.1L288.1 439.8 415.6 507.9c10.9 5.9 24.2 4.9 34.2-2.1s15-19.1 12.9-31.1L438.3 329 541.4 225.9c8.6-8.5 11.7-21.2 7.9-32.7s-13.7-19.9-25.7-21.7L381.2 150.3 316.9 18z"/></svg>`;
// icon-check (publicado/habilitado) — mesma silhueta do FA6 "check".
export const checkIcon = () => icon('<path d="M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"/>');
// Own simple clock and warning pictograms for scheduled/invalid date windows.
export const clockIcon = () => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>`;
export const warningIcon = () => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M12 3L2 21h20L12 3zM12 9v5"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></svg>`;
// icon-ban (rascunho/despublicado/desabilitado) — mesma silhueta do FA6 "ban".
export const banIcon = () => icon('<path d="M367.2 412.5L99.5 144.8C77.1 176.1 64 214.5 64 256c0 106 86 192 192 192c41.5 0 79.9-13.1 111.2-35.5zm45.3-45.3C434.9 335.9 448 297.5 448 256c0-106-86-192-192-192c-41.5 0-79.9 13.1-111.2 35.5L412.5 367.2zM0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256z"/>');
// icon-box-archive (arquivado) — mesma silhueta do FA6 "box-archive".
export const archiveIcon = () => icon('<path d="M32 32H480c17.7 0 32 14.3 32 32V96c0 17.7-14.3 32-32 32H32C14.3 128 0 113.7 0 96V64C0 46.3 14.3 32 32 32zm0 128H480V416c0 35.3-28.7 64-64 64H96c-35.3 0-64-28.7-64-64V160zm128 80c0 8.8 7.2 16 16 16H336c8.8 0 16-7.2 16-16s-7.2-16-16-16H176c-8.8 0-16 7.2-16 16z"/>');
// icon-trash (excluir) — mesma silhueta do FA6 "trash".
export const trashIcon = () => icon('<path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/>');
// icon-pen-to-square (editar) — mesma silhueta do FA6 "pen-to-square".
export const editIcon = () => icon('<path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z"/>');
// icon-save (disquete) — mesma silhueta do FA6 "floppy-disk".
export const saveIcon = () => icon('<path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V173.3c0-17-6.7-33.3-18.7-45.3L352 50.7C340 38.7 323.7 32 306.7 32H64zm0 96c0-17.7 14.3-32 32-32H288c17.7 0 32 14.3 32 32v64c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V128zM224 288a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/>');
// icon-xmark (cancelar) — mesma silhueta do FA6 "xmark".
export const closeIcon = () => icon('<path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/>');
/*
 * Ícone de marca (header) — própria composição em forma de roda/aspas
 * giratórias (4 lâminas arredondadas ao redor de um centro), inspirada
 * na COMPOSIÇÃO do logo real do Joomla (brand-small.svg: um símbolo
 * giratório composto por peças repetidas ao redor de um ponto central —
 * ver web-devs/JOOMLA/media_source/templates/administrator/atum/images/
 * logos/brand-small.svg), nunca o desenho exato das peças (evita
 * reproduzir a marca registrada Joomla!, mantendo só o mesmo princípio
 * visual de composição giratória para o "MINIJOOMLA").
 */
export const brandIcon = () => `<svg viewBox="0 0 20 20" width="22" height="22" fill="currentColor" aria-hidden="true" focusable="false"><g><path d="M10 10 L10 3.2 A6.8 6.8 0 0 1 15.8 6.6 Z"/><path d="M10 10 L15.8 6.6 A6.8 6.8 0 0 1 13.4 15.8 Z"/><path d="M10 10 L13.4 15.8 A6.8 6.8 0 0 1 4.9 13.8 Z"/><path d="M10 10 L4.9 13.8 A6.8 6.8 0 0 1 6.6 4.2 Z"/></g></svg>`;
// icon-desktop (com_cpanel, cabeçalho de seção "Site") — mesma silhueta do FA6 "display".
export const desktopIcon = () => icon('<path d="M64 0C28.7 0 0 28.7 0 64V352c0 35.3 28.7 64 64 64H240l-10.7 32H160c-17.7 0-32 14.3-32 32s14.3 32 32 32H352c17.7 0 32-14.3 32-32s-14.3-32-32-32H282.7L272 416H448c35.3 0 64-28.7 64-64V64c0-35.3-28.7-64-64-64H64zM480 64V288H64V64H480z"/>');
// icon-angle-right ("chevron" que indica item colapsável de sidebar/painel) — mesma silhueta do FA6 "angle-right"; gira 90° via CSS quando o grupo está expandido.
export const chevronIcon = () => `<svg viewBox="0 0 320 512" width="10" height="10" fill="currentColor" aria-hidden="true" focusable="false"><path d="M278.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L214.7 256 41.4 82.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"/></svg>`;

// icon-image (com_media, "Mídia") — mesma silhueta do FA6 "image".
export const imageIcon = () => icon('<path d="M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zM323.8 202.5c-4.5-6.6-11.9-10.5-19.8-10.5s-15.4 3.9-19.8 10.5l-87 127.6L170.7 297c-4.6-5.7-11.5-9-18.7-9s-14.2 3.3-18.7 9l-64 80c-5.8 7.2-6.9 17.1-2.9 25.4s12.4 13.6 21.6 13.6h96 32H424c8.9 0 17.1-4.9 21.2-12.8s3.6-17.4-1.4-24.7l-120-176zM112 192a48 48 0 1 0 0-96 48 48 0 1 0 0 96z"/>');

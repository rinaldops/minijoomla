import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function luminance(hex) {
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(background, foreground) {
  const first = luminance(background); const second = luminance(foreground);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function colorHex(value) {
  if (value.startsWith('#')) {
    const hex = value.slice(1).toUpperCase();
    return hex.length === 3 ? [...hex].map((channel) => channel.repeat(2)).join('') : hex;
  }
  const match = value.match(/^hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)$/);
  assert.ok(match, `cor administrativa não verificável: ${value}`);
  const [, hue, saturation, lightness] = match.map(Number);
  const h = hue / 60, s = saturation / 100, l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(h % 2 - 1)), m = l - c / 2;
  const channels = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return channels.map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function checkAdminAtum(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const root = source.match(/:root\s*\{([^}]+)\}/)?.[1];
  assert.ok(root, 'o painel deve declarar seus tokens Atum');
  const tokens = new Map([...root.matchAll(/(--[\w-]+)\s*:\s*([^;\n}]+)/g)].map(([, name, value]) => [name, value.trim()]));
  const resolve = (value, seen = new Set()) => value.replace(/var\((--[\w-]+)\)/g, (_, name) => {
    assert.ok(tokens.has(name), `token administrativo ausente: ${name}`);
    assert.ok(!seen.has(name), `alias circular de token administrativo: ${name}`);
    return resolve(tokens.get(name), new Set([...seen, name]));
  });
  const color = (name) => colorHex(resolve(tokens.get(name)));
  const expected = {
    '--atum-dark-blue': '001B4C', '--atum-base': '132F53', '--atum-link': '2A69B7', '--atum-link-dark': '1F5090',
    '--atum-success': '457D54', '--atum-danger': 'C52827', '--atum-danger-bg': 'F3D4D4',
    '--atum-warning': 'FFB514', '--atum-featured': 'C78800', '--atum-bg-light': 'F0F4FB',
    '--atum-border': 'DEE2E6', '--atum-gray-100': 'F8F9FA', '--atum-gray-400': 'CDCDCD',
    '--atum-gray-600': '666E76', '--atum-gray-700': '495057', '--atum-gray-900': '212529'
  };
  for (const [name, hex] of Object.entries(expected)) assert.equal(color(name), hex, `${name} mantém a paleta Atum`);
  assert.equal(tokens.get('--atum-sidebar-bg'), 'hsl(214,40%,20%)');
  assert.equal(tokens.get('--atum-sidebar-hover'), 'hsl(214,40%,35%)');
  assert.equal(resolve(tokens.get('--atum-sidebar-active')), 'hsl(214,40%,30%)');
  assert.equal(tokens.get('--atum-sidebar-submenu'), 'hsl(214,40%,16%)');
  for (const name of ['--atum-base', '--atum-sidebar-bg', '--atum-sidebar-hover', '--atum-sidebar-active', '--atum-sidebar-submenu', '--atum-success', '--atum-danger']) {
    assert.ok(contrast(color(name), 'FFFFFF') >= 4.5, `${name} suporta texto/foco branco`);
  }
  for (const name of ['--atum-link', '--atum-link-dark', '--atum-gray-600', '--atum-gray-700']) {
    for (const background of ['FFFFFF', color('--atum-bg-light'), color('--atum-list-hover')]) {
      assert.ok(contrast(color(name), background) >= 4.5, `${name} mantém contraste nas superfícies claras`);
    }
  }
  assert.ok(contrast(color('--atum-gray-900'), color('--atum-danger-bg')) >= 4.5, 'alertas mantêm texto legível');
  assert.ok(contrast(color('--atum-control-border'), 'FFFFFF') >= 3, 'campos vazios têm contorno funcional');
  assert.ok(contrast(color('--atum-featured'), 'FFFFFF') >= 3, 'pictograma de destaque mantém contraste não textual');
  assert.equal(tokens.get('--atum-radius'), '0', 'raízes/cards continuam retos');
  assert.match(root, /font-family:Roboto,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif/);
  assert.doesNotMatch(source, /Petrobras|#(?:006298|008542|ED8B00|E3E9ED|F2F7FA)\b/i, 'painel padrão não depende da identidade corporativa');
  assert.doesNotMatch(source, /@(?:import|font-face)\b|\.tox\b/, 'não carregar fontes externas nem recolorir TinyMCE');
  for (const [, value] of source.matchAll(/\bopacity\s*:\s*([^;}]+)/g)) assert.equal(value.trim(), '1');

  assert.match(source, /\.admin-sidebar-list a\{[^}]*color:#fff/);
  assert.match(source, /\.admin-sidebar-list a:hover\{background:var\(--atum-sidebar-hover\);color:#fff\}/);
  assert.match(source, /\.admin-sidebar-list a\[aria-current="page"\]\{background:var\(--atum-sidebar-active\);color:#fff;font-weight:500\}/);
  assert.match(source, /\.admin-sidebar-list \.mm-collapse\{[^}]*background:var\(--atum-sidebar-submenu\)/);
  for (const [variant, token] of [['primary', 'link'], ['success', 'success'], ['danger', 'danger']]) {
    assert.ok(source.includes(`.admin-btn-${variant}{color:var(--atum-${token})}`));
    assert.ok(source.includes(`.admin-btn-${variant}:hover,.admin-btn-${variant}:focus-visible{background:var(--atum-${token});color:#fff;border-color:var(--atum-${token})}`));
  }
  assert.match(source, /\.admin-overview a:is\(:hover,:focus-visible\)\{background:var\(--atum-sidebar-bg\);color:#fff\}/);
  assert.match(source, /\.admin-overview a\{display:grid;grid-template-columns:2rem minmax\(0,1fr\);[^}]*flex:1;min-width:0/, 'quickicon preserva faixa ícone/contador sem altura percentual');
  assert.match(source, /\.admin-overview-icon>svg\{width:2rem;height:2rem\}/, 'desenho SVG, não só seu contêiner, usa tamanho quickicon');
  assert.match(source, /\.admin-overview \.admin-overview-label\{grid-column:1\/-1;[^}]*font-size:1rem;font-weight:700\}/, 'nome do atalho tem hierarquia própria abaixo da faixa');
  assert.match(source, /\.admin-overview a:is\(:hover,:focus-visible\) \.admin-overview-count\{background:#fff;color:var\(--atum-sidebar-bg\)\}/, 'contador continua legível no quickicon ativo');
  assert.match(source, /\.admin-shell \.admin-overview a:is\(:hover,:focus-visible\) \.admin-overview-count\{background:HighlightText;color:Highlight\}/, 'contador respeita cores de alto contraste');
  assert.match(source, /\.admin-state-icon\{[^}]*border:2px solid var\(--atum-gray-600\);border-radius:50%;color:var\(--atum-gray-600\)/);
  assert.match(source, /\.admin-state-icon\{[^}]*background:#fff/, 'dourado conserva contraste também no hover da linha');
  assert.match(source, /\.admin-state-icon\.is-trashed\{color:var\(--atum-danger\);border-color:var\(--atum-danger\)\}/);
  assert.match(source, /\.admin-field input,\.admin-field select,\.admin-field textarea\{[^}]*border:1px solid var\(--atum-control-border\)/);
  assert.match(source, /\.admin-shell :focus-visible\{outline:2px solid var\(--atum-link\);outline-offset:2px\}/);
  assert.match(source, /\.admin-header :focus-visible\{outline-color:#fff;outline-offset:-4px\}/);
  assert.match(source, /\.admin-sidebar-list a:focus-visible\{outline-color:#fff;outline-offset:-4px\}/);
  assert.match(source, /\.admin-btn:not\(\.admin-btn-ghost\):focus-visible\{outline-color:#fff;outline-offset:-4px\}/);
  assert.match(source, /\.admin-overview a:focus-visible\{outline-color:#fff;outline-offset:-4px\}/);
  assert.match(source, /outline:3px solid Highlight!important/);
  assert.doesNotMatch(source, /forced-color-adjust:\s*none/);
  assert.match(source, /--atum-shadow:none/);
  assert.match(source, /--atum-sidebar-submenu:Canvas/);
  assert.match(source, /\.admin-shell \.admin-state-icon\{background:Canvas\}/);
  assert.match(source, /\.admin-shell \.admin-overview a:is\(:hover,:focus-visible\) :is\(\.admin-overview-label,\.admin-overview-icon\)\{color:HighlightText\}/);
  assert.match(source, /transition:none!important;animation:none!important;scroll-behavior:auto!important/);
  assert.match(source, /\.admin-tabs\{[^}]*flex-wrap:wrap/);
  assert.match(source, /\.admin-tabs button\{[^}]*min-width:0;max-width:100%[^}]*white-space:normal;overflow-wrap:anywhere/);
  assert.match(source, /\.admin-field\{[^}]*min-width:0/);
  assert.match(source, /\.admin-shell\{position:relative;[^}]*font-size:1rem;line-height:1\.5\}/, 'tipografia não herda 14px/entrelinha indefinida do host');
  assert.match(source, /\.admin-body\{position:relative;/, 'menu móvel tem bloco de referência dentro do painel');
  assert.match(source, /\.admin-sidebar\{position:absolute;[^}]*top:0;bottom:auto;[^}]*max-width:100%;max-height:calc\(100dvh - 54px\)/);
  assert.doesNotMatch(source, /\.admin-sidebar\{position:fixed;/, 'menu não invade o chrome do host');
  assert.match(source, /\.admin-form-status:empty\{min-height:0;margin:0;background:transparent\}/, 'formulário sem erro não exibe faixa vermelha');
  assert.match(source, /\.admin-page-inner\{[^}]*container-type:inline-size/, 'reflow usa a largura do conteúdo do host');
  assert.match(source, /@container\(max-width:50rem\)\{\s*\.admin-article-header,\.admin-article-grid\{grid-template-columns:1fr\}/, 'editor não é esmagado entre as duas sidebars');
  assert.match(source, /\.admin-searchbar input\[type="search"\]\{flex-basis:auto;width:100%\}/);
  assert.match(source, /\.admin-sidebar\{[^}]*visibility:hidden/);
  assert.match(source, /\.admin-sidebar\.admin-sidebar-open\{[^}]*visibility:visible/);
  assert.match(source, /minmax\(min\(100%,\s*15rem\),\s*1fr\)/);
  assert.match(source, /\.admin-table-wrap\{overflow-x:auto\}/);
  assert.match(source, /\.admin-col-action \.admin-btn\s*\{[^}]*max-width:\s*none;\s*white-space:\s*nowrap;\s*overflow-wrap:\s*normal;/, 'ações curtas da tabela não encolhem e quebram letra a letra');
  assert.match(source, /\[data-admin-tab-panel\]\[hidden\]\{display:none\}/);
}

function checkPublicCassiopeia(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const root = source.match(/\.cassiopeia-template\s*\{([^}]+)\}/)?.[1];
  const alternative = source.match(/\.cassiopeia-template\.colors-alternative\s*\{([^}]+)\}/)?.[1];
  assert.ok(root && alternative, 'os dois esquemas públicos permanecem disponíveis');
  const tokens = (block) => new Map([...block.matchAll(/(--[\w-]+)\s*:\s*([^;\n}]+)/g)].map(([, name, value]) => [name, value.trim()]));
  const standardTokens = tokens(root);
  const alternativeTokens = new Map([...standardTokens, ...tokens(alternative)]);
  const expectedSchemes = [
    [standardTokens, ['hsl(220, 67%, 20%)', 'hsl(220, 67%, 40%)', 'hsl(242, 30%, 36%)']],
    [alternativeTokens, ['hsl(351, 54%, 37%)', 'hsl(207, 49%, 37%)', 'hsl(351, 33%, 44%)']]
  ];
  for (const [scheme, expected] of expectedSchemes) {
    for (const [index, token] of ['--cassiopeia-color-primary', '--cassiopeia-color-link', '--cassiopeia-color-hover'].entries()) {
      assert.equal(scheme.get(token), expected[index], `${token} segue a referência Cassiopeia`);
    }
    const color = (name) => colorHex(scheme.get(name));
    for (const background of ['FFFFFF', color('--cassiopeia-card-cap-bg'), color('--cassiopeia-state-bg')]) {
      for (const name of ['--cassiopeia-color-link', '--cassiopeia-color-hover', '--cassiopeia-body-color', '--cassiopeia-muted']) {
        assert.ok(contrast(color(name), background) >= 4.5, `${name}: texto AA sobre #${background}`);
      }
    }
    // Static samples of legacy sRGB gradient interpolation; not a browser audit.
    const endpoints = ['--cassiopeia-color-primary', '--cassiopeia-color-hover'].map((name) => [0, 2, 4].map((offset) => Number.parseInt(color(name).slice(offset, offset + 2), 16)));
    for (let step = 0; step <= 20; step += 1) {
      const background = endpoints[0].map((channel, index) => Math.round(channel + (endpoints[1][index] - channel) * step / 20).toString(16).padStart(2, '0')).join('');
      assert.ok(contrast(background, 'FFFFFF') >= 4.5, 'texto/foco branco legível no gradiente e nos botões');
      assert.ok(contrast(background, 'DEE2E6') >= 4.5, 'links da marca/rodapé legíveis no hover');
    }
    assert.ok(contrast(color('--cassiopeia-control-border'), 'FFFFFF') >= 3, 'contorno funcional dos campos');
    assert.ok(contrast(color('--cassiopeia-color-link'), 'FFFFFF') >= 3, 'foco nos campos brancos');
    assert.ok(contrast(color('--cassiopeia-error-color'), color('--cassiopeia-error-bg')) >= 4.5, 'erros legíveis');
    assert.ok(contrast(color('--cassiopeia-color-accent'), '000000') >= 4.5, 'mark/skip mantêm texto preto legível');
    assert.ok(contrast(color('--cassiopeia-color-link'), color('--cassiopeia-color-accent')) >= 3, 'foco do skip visível');
  }
  for (const [name, expected] of Object.entries({
    '--cassiopeia-body-color': '#22262a', '--cassiopeia-muted': '#495057', '--cassiopeia-border-color': '#dee2e6',
    '--cassiopeia-card-cap-bg': '#f5f5f5', '--cassiopeia-state-bg': '#f8f9fa', '--cassiopeia-color-accent': '#fbeea8'
  })) assert.equal(standardTokens.get(name), expected, `${name} mantém superfícies neutras`);
  assert.match(root, /--cassiopeia-font-family-system: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,/);
  assert.match(source, /\.font-roboto\s*\{[^}]*--cassiopeia-font-family-body: Roboto, var\(--cassiopeia-font-family-system\)/);
  assert.doesNotMatch(source, /Petrobras|--(?:camap|atum)-|#(?:008542|006298|FDC82F|ED8B00|00B2A9)\b/i, 'template padrão não depende da marca ou dos tokens corporativos');
  assert.doesNotMatch(source, /:root\s*\{|@(?:import|font-face)\b|url\(\s*['"]?https?:/i, 'CSS escopado e sem carregamento externo');
  assert.doesNotMatch(source, /forced-color-adjust:\s*none|opacity\s*:/i, 'não reduzir contraste nem bloquear cores do sistema');
  assert.match(source, /\.container-header :focus-visible,\s*\.cassiopeia-template \.container-footer :focus-visible \{ outline-color: #fff;/);
  assert.match(source, /:is\(input, select, textarea\):focus-visible \{ outline-color: var\(--link-color\); outline-offset: -4px;/, 'foco de campo branco fica interno ao campo no cabeçalho escuro');
  assert.match(source, /\.article-tags a:focus-visible \{ outline-color: #fff; outline-offset: -4px;/);
  assert.match(source, /:is\(button\[type="submit"\], \.btn-primary\) \{ border-color: #fff;/, 'botão de busca mantém borda distinguível sobre cabeçalho escuro');
  assert.match(source, /\.container-menu \[data-menu-tree-js\] li > ul :focus-visible \{ outline-color: var\(--link-color\); outline-offset: -2px;/);
  assert.match(source, /\.container-footer :focus-visible \{ outline-color: Highlight;/);
  assert.match(source, /\.site-description \{ color: CanvasText; background: Canvas;/, 'descrição branca acompanha a superfície em cores forçadas');
  assert.match(source, /\.container-header \.search-module-form button \{ color: ButtonText; border-color: ButtonText; background: ButtonFace;/, 'busca não mantém borda branca sobre Canvas em cores forçadas');
  assert.equal(standardTokens.get('--cassiopeia-radius'), '.25rem', 'raio apenas em controles internos');
  assert.match(source, /> \.module \{[^}]*border-radius: 0;/, 'raízes estruturais permanecem retas');
  assert.match(source, /\.module > :is\(h2, h3\):first-child \{[^}]*border-radius: 0;/);

  // Do not reset the image-only inline pixel margins retained by sanitization.
  for (const [, selectors, declarations] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/\bimg\b/.test(selectors)) continue;
    assert.doesNotMatch(declarations, /(?:margin(?:-[\w-]+)?|all)\s*:[^;{}]*!important/, 'CSS público não sobrepõe margens inline de imagem');
  }
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\(max-width:768px\)/);
  assert.match(css, /@media\(max-width:480px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  assert.match(css, /@media print/);
  assert.match(css, /\.visually-hidden\{/);
}

export async function runStaticUiTests() {
  const css = await readFile(new URL('../src/media/templates/site/cassiopeia/css/template.css', import.meta.url), 'utf8');
  checkPublicCassiopeia(css);
  console.log('ok - public Cassiopeia-inspired palette, contrast, focus, responsive CSS and image spacing (offline checks)');

  const adminCss = await readFile(new URL('../src/media/templates/administrator/atum/css/template.css', import.meta.url), 'utf8');
  checkAdminAtum(adminCss);
  console.log('ok - admin Joomla/Atum palette, contrast, focus and responsive CSS (TinyMCE vendor skin unchanged)');
}

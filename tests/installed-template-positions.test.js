import assert from 'node:assert/strict';
import { ValidationError } from '../src/libraries/minijoomla/core/contracts.js';
import { templatePositions, isWellFormedPositionName, STRUCTURAL_TEMPLATE_POSITIONS } from '../src/libraries/minijoomla/application/extension-input.js';
import { resolveModuleEntries } from '../src/libraries/minijoomla/modules/dynamic-modules.js';
import { templateParamDefinitions } from '../src/libraries/minijoomla/application/template-styles.js';

/*
 * Cobertura genérica do mecanismo de instalação de templates, introduzido
 * no pivô de empacotamento (Iteração 4.0): um template INSTALADO (nunca
 * builtin) pode declarar posições/parâmetros próprios no manifesto, sem
 * exigir edição do MINIJOOMLA a cada posição/template novo. Usa uma
 * fixture sintética ('custom-hero'), não o `camap-v3` real — este arquivo
 * valida o MECANISMO, não um template específico (esse é coberto no pacote
 * em web-devs/CAMAP-V3/minijoomla-template/tests/).
 */
export async function runInstalledTemplatePositionsTests() {
  // 1. isWellFormedPositionName: forma apenas, sem pertencimento a enumeração.
  assert.equal(isWellFormedPositionName('custom-hero'), true);
  assert.equal(isWellFormedPositionName('CustomHero'), false, 'maiúsculas rejeitadas');
  assert.equal(isWellFormedPositionName('custom hero'), false, 'espaço rejeitado');
  assert.equal(isWellFormedPositionName('1custom'), false, 'não pode começar com dígito');
  assert.equal(isWellFormedPositionName(''), false);
  assert.equal(isWellFormedPositionName(null), false);
  assert.equal(isWellFormedPositionName('a'.repeat(42)), false, 'excede o comprimento máximo');

  // 2. templatePositions(): aceita posição estrutural OU bem-formada vinda de um manifesto de template instalado.
  assert.equal(templatePositions(['footer']), '["footer"]', 'posição estrutural continua aceita');
  assert.equal(templatePositions(['custom-hero']), '["custom-hero"]', 'posição nova bem-formada, fora da lista estrutural fechada, é aceita');
  assert.equal(templatePositions(['footer', 'custom-hero']), '["footer","custom-hero"]', 'mistura de estrutural e declarada é aceita');
  assert.throws(() => templatePositions(['Custom Hero!']), ValidationError, 'nome malformado continua rejeitado');
  assert.throws(() => templatePositions([]), ValidationError, 'lista vazia continua rejeitada');
  assert.ok(!STRUCTURAL_TEMPLATE_POSITIONS.includes('custom-hero'), 'a lista estrutural fechada não precisa crescer por posição nova');
  console.log('ok - installed template positions: isWellFormedPositionName/templatePositions aceitam posições declaradas sem editar a lista estrutural fechada');

  // 3. resolveModuleEntries(): um módulo atribuído a uma posição declarada
  // pelo template ATIVO (repassada como 4º parâmetro) renderiza nela, não
  // cai no fallback 'sidebar'. Ausência do parâmetro preserva o
  // comportamento atual (builtins, sem linha de catálogo).
  const rows = [
    { extensionKey: 'hero-widget', position: 'custom-hero', ordering: 1, enabled: true },
    { extensionKey: 'sidebar-widget', position: 'sidebar', ordering: 1, enabled: true }
  ];
  const withoutActiveTemplatePositions = resolveModuleEntries(rows, {}, new Date());
  assert.deepEqual(withoutActiveTemplatePositions.sidebar.map((entry) => entry.name), ['hero-widget', 'sidebar-widget'], 'sem o parâmetro, posição desconhecida cai em sidebar (comportamento inalterado)');
  assert.equal(withoutActiveTemplatePositions['custom-hero'], undefined);

  const withActiveTemplatePositions = resolveModuleEntries(rows, {}, new Date(), ['custom-hero']);
  assert.deepEqual(withActiveTemplatePositions['custom-hero'].map((entry) => entry.name), ['hero-widget'], 'módulo atribuído à posição declarada pelo template ativo é roteado para ela');
  assert.deepEqual(withActiveTemplatePositions.sidebar.map((entry) => entry.name), ['sidebar-widget'], 'módulo atribuído a sidebar continua em sidebar');

  // 3b. Uma posição estrutural já conhecida não é duplicada/afetada quando repassada por engano em activeTemplatePositions.
  const redundant = resolveModuleEntries(rows, {}, new Date(), ['footer']);
  assert.deepEqual(redundant.sidebar.map((entry) => entry.name), ['hero-widget', 'sidebar-widget'], 'posição estrutural repetida em activeTemplatePositions não muda o roteamento');
  console.log('ok - installed template positions: resolveModuleEntries roteia módulos para as posições declaradas pelo template ativo, sem afetar builtins');

  // 4. templateParamDefinitions(key, installedDefinitions): definições
  // fornecidas por um template instalado têm precedência sobre o mapa
  // estático de builtins; ausência preserva o comportamento atual.
  const installedDefinitions = [{ name: 'heroTitle', type: 'text', label: 'Título do hero', default: '' }];
  assert.deepEqual(templateParamDefinitions('unknown-installed-template', installedDefinitions), installedDefinitions, 'definições fornecidas têm precedência, mesmo para uma chave não-builtin');
  assert.deepEqual(templateParamDefinitions('default'), [], 'builtin sem definições próprias continua devolvendo lista vazia quando nada é fornecido');
  assert.deepEqual(templateParamDefinitions('default', undefined), [], 'parâmetro ausente/undefined preserva o comportamento síncrono original');
  console.log('ok - installed template positions: templateParamDefinitions aceita definições de um template instalado sem exigir import estático no MINIJOOMLA');
}

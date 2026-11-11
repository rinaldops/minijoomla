/*
 * Gestão de extensões do painel (equivalentes funcionais de com_modules,
 * com_plugins, com_templates/estilos, com_config por componente e
 * com_installer). Compõe os namespaces CRUD já validados por
 * admin-service.js; nenhuma escrita contorna ETag/validação de lá.
 */
import { ValidationError, ownDataValue } from '../core/contracts.js';
import { STRUCTURAL_TEMPLATE_POSITIONS, BUILTIN_MODULE_KEYS, NATIVE_PLUGIN_KEYS, NATIVE_PLUGIN_URLS, templatePositions, isWellFormedPositionName } from './extension-input.js';
import { moduleTypeCatalog } from './module-catalog.js';
import { moduleState } from './module-assignment.js';
import { normalizeParamDefinitions, normalizeParamValues, parseJsonObject } from './declared-params.js';
import { BUILTIN_TEMPLATES, effectiveTemplateStyles, templateParamDefinitions, validateTemplateStyles, parseTemplateStyles } from './template-styles.js';
import { COMPONENT_OPTIONS, findComponentOptions, mergeComponentParams, resolveComponentParams } from './component-options.js';
import { parseExtensionManifest, manifestRecordJson } from './extension-manifest.js';
import { readTemplateMetadata } from './template-metadata.js';

export const MODULE_POSITIONS = Object.freeze([...STRUCTURAL_TEMPLATE_POSITIONS.filter((position) => position !== 'component'), 'sidebar', 'content']);
export const MODULE_BATCH_ACTIONS = Object.freeze(['publish', 'unpublish', 'trash', 'restore', 'delete', 'move']);

function conflict(message) { return Object.assign(new Error(message), { code: 'concurrency-conflict' }); }

function requireItems(items) {
  if (!Array.isArray(items) || !items.length) throw new ValidationError('Selecione ao menos um item.');
  if (items.length > 200) throw new ValidationError('Selecione no máximo 200 itens por vez.');
  return items.map((item) => {
    if (!item || item.id === undefined || typeof item.etag !== 'string' || !item.etag.trim() || item.etag === '*') throw new ValidationError('Cada item selecionado precisa de id e ETag.');
    return item;
  });
}

export async function runBatch(items, operation) {
  const succeeded = [];
  const failed = [];
  for (const item of requireItems(items)) {
    try { await operation(item); succeeded.push(item.id); } catch (error) { failed.push({ id: item.id, code: error?.code, message: error?.message ?? String(error) }); }
  }
  return { succeeded, failed };
}

const NATIVE_PLUGINS = Object.freeze({
  emailcloak: ['Conteúdo - Ocultar e-mails', 'Oculta endereços de e-mail no conteúdo para protegê-los contra robôs de spam.'],
  pagebreak: ['Conteúdo - Quebra de página', 'Divide um artigo em várias páginas e gera o índice do artigo.'],
  loadmodule: ['Conteúdo - Carregar módulo', 'Carrega módulos dentro do conteúdo com {loadposition posição} ou {loadmodule tipo}.'],
  pagenavigation: ['Conteúdo - Navegação de páginas', 'Adiciona links de artigo anterior e próximo ao final do artigo.']
});
const isNative = (row) => NATIVE_PLUGIN_URLS.includes(row.entryPointUrl);

export function optionalPluginGroup(value, field) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{0,39}$/.test(value.trim())) throw new ValidationError(`${field} (grupo de plugin) persistido inválido. Nenhum dado foi alterado.`);
  return value.trim();
}

function pluginView(row) {
  const manifest = parseJsonObject(row.manifestJson, { strict: true, field: 'manifestJson' });
  // Valide também o grupo do manifesto quando folder tem precedência;
  // uma visão normalizada não deve ocultar corrupção nem alterar o registro.
  const folder = optionalPluginGroup(row.folder, 'folder');
  const manifestGroup = optionalPluginGroup(manifest.group, 'manifest.group');
  const definitions = normalizeParamDefinitions(manifest.params);
  const stored = parseJsonObject(row.paramsJson, { strict: true, field: 'paramsJson' });
  const params = normalizeParamValues(definitions, stored, { keepUndeclared: true });
  return { ...row, etag: row.etag, group: folder || manifestGroup || 'content', ordering: Number(row.ordering) || 0, version: String(manifest.version ?? ''), description: String(manifest.description ?? ''), definitions, params };
}

export function createExtensionAdministration({ repositories, extensions, moduleInstances, templates, siteConfig, listAll, requireRepository }) {
  const extensionRows = async () => (repositories.extensions ? listAll(requireRepository(repositories, 'extensions')) : []);
  const templateRows = async () => (repositories.templates ? listAll(requireRepository(repositories, 'templates')) : []);

  async function templateCatalog() {
    const rows = await templateRows();
    const builtins = BUILTIN_TEMPLATES.map((key) => ({ key, title: key === 'default' ? 'MiniJoomla (padrão)' : key === 'cassiopeia' ? 'Cassiopeia' : 'CAMAP', builtin: true, enabled: true, positions: STRUCTURAL_TEMPLATE_POSITIONS.filter((position) => position !== 'component') }));
    const registered = rows.filter((row) => !BUILTIN_TEMPLATES.includes(row.key)).map((row) => {
      // Ausência legada é distinta de JSON persistido inválido.
      const descriptor = Object.getOwnPropertyDescriptor(row, 'positionsJson');
      if (descriptor && !Object.hasOwn(descriptor, 'value')) throw new ValidationError('positionsJson deve ser uma propriedade de dados.');
      const value = descriptor?.value;
      const positions = value === undefined || value === null || value === '' ? [] : JSON.parse(templatePositions(value));
      const { definitions } = readTemplateMetadata(row);
      return { key: row.key, title: row.title || row.key, builtin: false, enabled: row.enabled !== false, positions: positions.filter((position) => position !== 'component'), definitions, id: row.id };
    });
    return [...builtins, ...registered];
  }

  // Metadados de templates desabilitados continuam úteis para editar módulos;
  // a seleção não ativa templates nem cria configuração do site.
  const modulePositions = (catalog) => [...new Set([...MODULE_POSITIONS, ...catalog.flatMap((template) => template.positions)])];
  const templateDefinitions = (catalog) => Object.fromEntries(catalog.filter((entry) => !entry.builtin).map((entry) => [entry.key, entry.definitions]));

  const modules = {
    async catalog() { return moduleTypeCatalog(await extensionRows()); },
    async positions(templateKey) {
      const catalog = await templateCatalog();
      const key = templateKey || (await siteConfig.get())?.templateKey || siteConfig.defaults?.templateKey || 'default';
      const template = catalog.find((entry) => entry.key === key) ?? catalog[0];
      return { template: template.key, positions: template.positions, all: modulePositions(catalog) };
    },
    async duplicate(id) {
      const record = await moduleInstances.get(id);
      if (!record) throw new ValidationError('Módulo não encontrado.');
      const { id: _id, etag: _etag, ...copy } = record;
      for (const field of Object.keys(copy)) if (copy[field] === undefined || copy[field] === null) delete copy[field];
      // Uma posição customizada sem declaração atual é rejeitada na criação,
      // nunca substituída silenciosamente por uma posição estrutural.
      return moduleInstances.create({ ...copy, title: `${record.title} (cópia)`, enabled: false, trashed: false });
    },
    async setState(id, state, { etag } = {}) {
      return modules.batch([{ id, etag }], { publish: 'publish', unpublish: 'unpublish', trash: 'trash' }[state] ?? state);
    },
    async batch(items, action, options = {}) {
      if (!MODULE_BATCH_ACTIONS.includes(action)) throw new ValidationError(`Ação em lote desconhecida: ${String(action)}.`);
      requireItems(items);
      let position;
      if (action === 'move') {
        const descriptor = Object.getOwnPropertyDescriptor(options, 'position');
        if (!descriptor || !Object.hasOwn(descriptor, 'value')) throw new ValidationError('Escolha uma posição válida para mover.');
        position = descriptor.value;
        if (position === 'component' || (!MODULE_POSITIONS.includes(position) && !isWellFormedPositionName(position))) throw new ValidationError('Escolha uma posição válida para mover.');
        if (!MODULE_POSITIONS.includes(position) && !modulePositions(await templateCatalog()).includes(position)) throw new ValidationError('Escolha uma posição válida para mover.');
      }
      return runBatch(items, async ({ id, etag }) => {
        if (action === 'delete') {
          const record = await moduleInstances.get(id);
          if (moduleState(record) !== 'trashed') throw new ValidationError('Envie o módulo para a lixeira antes de excluí-lo.');
          return moduleInstances.remove(id, { etag });
        }
        const patch = { publish: { enabled: true, trashed: false }, unpublish: { enabled: false }, trash: { enabled: false, trashed: true }, restore: { trashed: false }, move: { position } }[action];
        return moduleInstances.update(id, patch, { etag });
      });
    }
  };

  const plugins = {
    available: Boolean(repositories.extensions),
    async list() {
      return (await extensionRows()).filter((row) => row.type === 'Plugin').map(pluginView)
        .sort((a, b) => a.group.localeCompare(b.group) || a.ordering - b.ordering || String(a.title).localeCompare(String(b.title)));
    },
    async get(id) {
      const row = await extensions.get(id);
      return row && row.type === 'Plugin' ? pluginView(row) : null;
    },
    // Lista com os plugins nativos sempre presentes; sem registro aparecem desabilitados (id/etag ausentes).
    async catalog() {
      const rows = (await plugins.list()).map((row) => (isNative(row) && Object.hasOwn(NATIVE_PLUGINS, row.key) ? { ...row, description: row.description || NATIVE_PLUGINS[row.key][1], native: true } : row));
      const virtual = NATIVE_PLUGIN_KEYS.filter((key) => !rows.some((row) => row.key === key)).map((key) => ({
        id: `native:${key}`, type: 'Plugin', key, title: NATIVE_PLUGINS[key][0], description: NATIVE_PLUGINS[key][1], enabled: false, group: 'content', ordering: 0, version: '', definitions: [], params: {}, native: true, virtual: true
      }));
      return [...rows, ...virtual].sort((a, b) => a.group.localeCompare(b.group) || a.ordering - b.ordering || String(a.title).localeCompare(String(b.title)));
    },
    async setNative(key, enabled, { etag } = {}) {
      if (!NATIVE_PLUGIN_KEYS.includes(key)) throw new ValidationError('Plugin nativo desconhecido.');
      const existing = (await extensionRows()).find((row) => row.key === key);
      if (existing) {
        if (existing.type !== 'Plugin' || !isNative(existing)) throw new ValidationError('Esta chave não identifica um plugin nativo registrado.');
        // Não substitua params/manifest/group ao habilitar registros existentes.
        return plugins.update(existing.id, { enabled }, { etag });
      }
      return extensions.create({ type: 'Plugin', key, title: NATIVE_PLUGINS[key][0], entryPointUrl: `native:${key}`, enabled, manifestJson: '{"version":"1.0.0","group":"content","params":[]}' });
    },
    groups(rows) { return [...new Set(rows.map((row) => row.group))].sort(); },
    async update(id, input = {}, { etag } = {}) {
      const row = await plugins.get(id);
      if (!row) throw new ValidationError('Plugin não encontrado.');
      const patch = {};
      if (input.enabled !== undefined) patch.enabled = input.enabled;
      if (input.ordering !== undefined) patch.ordering = input.ordering;
      if (input.params !== undefined) {
        const values = parseJsonObject(input.params, { strict: true, field: 'params' });
        patch.params = { ...row.params, ...normalizeParamValues(row.definitions, values, { keepUndeclared: false }) };
      }
      if (!Object.keys(patch).length) throw new ValidationError('Nada para salvar.');
      return extensions.update(id, patch, { etag });
    },
    async batch(items, action) {
      if (!['enable', 'disable'].includes(action)) throw new ValidationError(`Ação em lote desconhecida: ${String(action)}.`);
      const nativeItems = items.filter((item) => String(item?.id).startsWith('native:'));
      const rest = items.filter((item) => !nativeItems.includes(item));
      const result = !rest.length && nativeItems.length ? { succeeded: [], failed: [] } : await runBatch(rest, async ({ id, etag }) => {
        const row = await plugins.get(id);
        if (!row) throw new ValidationError('Plugin não encontrado.');
        return extensions.update(id, { enabled: action === 'enable' }, { etag });
      });
      for (const { id } of nativeItems) {
        try { if (action === 'enable') await plugins.setNative(String(id).slice(7), true); result.succeeded.push(id); } catch (error) { result.failed.push({ id, code: error?.code, message: error?.message ?? String(error) }); }
      }
      return result;
    }
  };

  async function requireConfig(etag) {
    const config = await siteConfig.get();
    if (config && config.etag !== etag) throw conflict('A configuração foi alterada por outra pessoa.');
    return config;
  }

  const templateStyles = {
    async list() {
      const [config, catalog] = await Promise.all([siteConfig.get(), templateCatalog()]);
      const titles = Object.fromEntries(catalog.map((entry) => [entry.key, entry.title]));
      const activeKey = config?.templateKey || siteConfig.defaults?.templateKey || 'default';
      const styles = effectiveTemplateStyles(config?.templateStylesJson, catalog.filter((entry) => entry.enabled || entry.key === activeKey).map((entry) => entry.key), titles, { strict: true }, templateDefinitions(catalog))
        .map((style) => ({ ...style, templateTitle: titles[style.template] ?? style.template, isDefault: style.template === activeKey && style.home }));
      return { etag: config?.etag, templateKey: activeKey, styles, catalog };
    },
    async get(id) {
      const { etag, styles, templateKey, catalog } = await templateStyles.list();
      const style = styles.find((entry) => entry.id === String(id));
      return style ? { ...style, etag, templateKey, definitions: templateParamDefinitions(style.template, ownDataValue(templateDefinitions(catalog), style.template)) } : null;
    },
    async save(id, input = {}, { etag } = {}) {
      const title = ownDataValue(input, 'title');
      const params = ownDataValue(input, 'params');
      return persistStyles(etag, (styles, config, catalog) => {
        const style = styles.find((entry) => entry.id === String(id));
        if (!style) throw new ValidationError('Estilo não encontrado.');
        if (title !== undefined) style.title = String(title).trim();
        if (params !== undefined) {
          const values = parseJsonObject(params, { strict: true, field: 'params' });
          const definitions = templateParamDefinitions(style.template, ownDataValue(templateDefinitions(catalog), style.template));
          const submitted = definitions.filter((definition) => Object.hasOwn(values, definition.name));
          style.params = { ...style.params, ...normalizeParamValues(submitted, values, { keepUndeclared: false }) };
        }
        return styles;
      });
    },
    async duplicate(id, { etag } = {}) {
      let createdId;
      await persistStyles(etag, (styles) => {
        const source = styles.find((entry) => entry.id === String(id));
        if (!source) throw new ValidationError('Estilo não encontrado.');
        let index = 2;
        while (styles.some((entry) => entry.id === `${source.template}-${index}`)) index += 1;
        createdId = `${source.template}-${index}`;
        styles.push({ id: createdId, template: source.template, title: `${source.title} (${index})`, home: false, params: { ...source.params } });
        return styles;
      });
      return createdId;
    },
    async setDefault(id, { etag } = {}) {
      return persistStyles(etag, (styles, config, catalog) => {
        const style = styles.find((entry) => entry.id === String(id));
        if (!style) throw new ValidationError('Estilo não encontrado.');
        const template = catalog.find((entry) => entry.key === style.template);
        if (!template?.enabled) throw new ValidationError('Habilite o template antes de definir seu estilo como padrão.');
        for (const entry of styles) if (entry.template === style.template) entry.home = entry.id === style.id;
        return styles;
      }, (style) => ({ templateKey: style.template }), id);
    },
    async remove(id, { etag } = {}) {
      return persistStyles(etag, (styles) => {
        const style = styles.find((entry) => entry.id === String(id));
        if (!style) throw new ValidationError('Estilo não encontrado.');
        if (style.home) throw new ValidationError('O estilo padrão de um template não pode ser excluído.');
        return styles.filter((entry) => entry.id !== style.id);
      });
    }
  };

  async function persistStyles(etag, mutate, extraPatch, styleId) {
    const config = await requireConfig(etag);
    if (config) requireEtagValue(etag);
    const catalog = await templateCatalog();
    const titles = Object.fromEntries(catalog.map((entry) => [entry.key, entry.title]));
    const activeKey = config?.templateKey || siteConfig.defaults?.templateKey || 'default';
    const keys = [...new Set([...catalog.filter((entry) => entry.enabled).map((entry) => entry.key), activeKey])];
    const definitionsByKey = templateDefinitions(catalog);
    const styles = effectiveTemplateStyles(config?.templateStylesJson, keys, titles, { strict: true }, definitionsByKey).map(({ virtual, ...style }) => style);
    const next = mutate(styles, config, catalog);
    const patch = { templateStylesJson: validateTemplateStyles(next, definitionsByKey, {preserveValues:true}) };
    if (extraPatch) Object.assign(patch, extraPatch(next.find((entry) => entry.id === String(styleId))));
    return siteConfig.save(patch, config ? { etag } : {});
  }

  function requireEtagValue(etag) {
    if (typeof etag !== 'string' || !etag.trim() || etag === '*') throw new ValidationError('etag da configuração é obrigatório.');
  }

  const componentOptions = {
    list() { return COMPONENT_OPTIONS.map(({ key, title, joomla, available, unavailableReason }) => ({ key, title, joomla, available, unavailableReason })); },
    async get(key) {
      const component = findComponentOptions(key);
      const config = await siteConfig.get();
      return { key: component.key, title: component.title, joomla: component.joomla, available: component.available, unavailableReason: component.unavailableReason, definitions: component.params, values: resolveComponentParams(config ?? {}, { strict: true })[component.key], etag: config?.etag };
    },
    async save(key, values, { etag } = {}) {
      const config = await requireConfig(etag);
      if (config) requireEtagValue(etag);
      return siteConfig.save({ componentParamsJson: mergeComponentParams(config?.componentParamsJson, key, values) }, config ? { etag } : {});
    }
  };

  const installer = {
    preview(manifest) { return parseExtensionManifest(manifest); },
    async install(input) {
      const manifest = parseExtensionManifest(input);
      if (manifest.type === 'Template') {
        if (!templates.available) throw new ValidationError('Catálogo de templates não configurado nesta composição.');
        return templates.create({ title: manifest.title, key: manifest.key, version: manifest.version, entryPointUrl: manifest.entryPointUrl, styles: manifest.styles, paramDefinitions: manifest.paramDefinitions, positionsJson: manifest.positionsJson, discoveredFrom: 'manifesto', enabled: false });
      }
      return extensions.create({
        title: manifest.title, key: manifest.key, type: manifest.type, entryPointUrl: manifest.entryPointUrl, discoveredFrom: 'manifesto',
        enabled: false, folder: manifest.group ?? '', manifestJson: manifestRecordJson(manifest)
      });
    },
    async list() {
      const [rows, tplRows] = await Promise.all([extensionRows(), templateRows()]);
      const core = [
        ...BUILTIN_MODULE_KEYS.map((key) => ({ uid: `module:${key}`, kind: 'Module', key, title: key, core: true, enabled: true })),
        ...BUILTIN_TEMPLATES.map((key) => ({ uid: `template:${key}`, kind: 'Template', key, title: key, core: true, enabled: true })),
        ...COMPONENT_OPTIONS.map((component) => ({ uid: `component:${component.key}`, kind: 'Component', key: component.joomla, title: component.title, core: true, enabled: true }))
      ];
      const registered = [
        ...rows.map((row) => ({ uid: `extension:${row.id}`, id: row.id, domain: 'extensions', kind: row.type, key: row.key, title: row.title, core: false, enabled: row.enabled !== false, version: String(parseJsonObject(row.manifestJson, { strict: true, field: 'manifestJson' }).version ?? ''), source: row.discoveredFrom || '' })),
        ...tplRows.filter((row) => !BUILTIN_TEMPLATES.includes(row.key)).map((row) => ({ uid: `template-record:${row.id}`, id: row.id, domain: 'templates', kind: 'Template', key: row.key, title: row.title, core: false, enabled: row.enabled !== false, version: row.version ?? '', source: row.discoveredFrom || '' }))
      ];
      return [...core, ...registered];
    }
  };

  async function overviewExtras() {
    const [rows, instances] = await Promise.all([extensionRows(), repositories.moduleInstances ? listAll(requireRepository(repositories, 'moduleInstances')) : []]);
    return { plugins: rows.filter((row) => row.type === 'Plugin').length, modulesPublished: instances.filter((row) => moduleState(row) === 'published').length };
  }

  return { modules, plugins, templateStyles, componentOptions, installer, overviewExtras, templateCatalog };
}

export { parseTemplateStyles };

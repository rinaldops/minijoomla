import { NATIVE_MODULE_PACKAGES, MODULE_ADVANCED_PARAMS } from '../src/libraries/minijoomla/application/module-catalog.js';

// Metadata only: no native renderer, third-party extension or fixture is executed.
const xml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
const attribute = (name, value) => value === undefined ? '' : ` ${name}="${xml(value)}"`;

function field(definition) {
  const { name, type, label, description, min, max, maxLength, default: fallback } = definition;
  const kind = type === 'select' ? 'list' : type === 'checkbox' ? 'radio' : type === 'json' ? 'textarea' : type;
  const value = typeof fallback === 'boolean' ? Number(fallback) : fallback && typeof fallback === 'object' ? JSON.stringify(fallback) : fallback;
  const options = type === 'checkbox' ? [{ value: '1', label: 'Sim' }, { value: '0', label: 'Não' }] : definition.options ?? [];
  const attributes = Object.entries({ name, type: kind, label, description, min, max, maxlength: maxLength, default: value,
    'mj:type': type === 'json' ? 'json' : undefined, 'mj:valueType': type === 'json' ? definition.valueType : undefined }).map(([key, entry]) => attribute(key, entry)).join('');
  return options.length
    ? `        <field${attributes}>\n${options.map((option) => `          <option value="${xml(option.value)}">${xml(option.label)}</option>`).join('\n')}\n        </field>`
    : `        <field${attributes} />`;
}

/** Generate only descriptors whose entry point and template are in this target. */
export function generateModuleManifests(paths, version) {
  const selected = new Set(paths);
  return new Map(NATIVE_MODULE_PACKAGES.flatMap((module) => {
    const root = `modules/${module.folder}`;
    if (!selected.has(`${root}/${module.folder}.js`)) return [];
    if (!selected.has(`${root}/tmpl/default.js`)) throw new Error(`Template de módulo ausente: ${module.folder}`);
    const data = `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated from the native module catalogue; no PHP installer is provided. -->
<extension type="module" client="site" method="upgrade" xmlns:mj="urn:minijoomla:runtime:1" mj:key="${xml(module.key)}">
  <name>${xml(module.folder)}</name>
  <version>${xml(version)}</version>
  <description>${xml(module.description)}</description>
  <files>
    <filename module="${xml(module.folder)}">${xml(module.folder)}.js</filename>
    <folder>tmpl</folder>
  </files>
  <config>
    <fields name="params">
      <fieldset name="basic" label="${xml(module.title)}">
${module.params.map(field).join('\n')}
      </fieldset>
      <fieldset name="advanced" label="Avançado">
${MODULE_ADVANCED_PARAMS.map(field).join('\n')}
      </fieldset>
    </fields>
  </config>
</extension>
`;
    return [[`${root}/${module.folder}.xml`, Buffer.from(data)]];
  }));
}

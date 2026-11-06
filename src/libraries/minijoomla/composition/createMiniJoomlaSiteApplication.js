import { createMiniJoomlaSharePointApp } from './createMiniJoomlaSharePointApp.js';
import { createApplication } from '../index.js';
import { toSiteConfigOverrides } from '../application/site-config-overrides.js';

async function rows(repository) {
  const page = await repository.findMany({}, { maxPages: 100, maxItems: 10000 });
  if (!Array.isArray(page?.items)) throw new TypeError('Repositório retornou uma lista inválida.');
  return page.items;
}

export async function createMiniJoomlaSiteApplication({ documentRef, autoStart = true, template, plugins, importModule, moduleStyles, moduleStyleRevisions, ...options } = {}) {
  const composition = createMiniJoomlaSharePointApp(options);
  const { repositories } = composition;
  const settings = repositories.siteConfig ? await rows(repositories.siteConfig) : [];
  if (settings.length > 1) throw new TypeError('A configuração do site deve possuir uma única linha.');
  const saved = settings[0];
  const config = {
    ...options.config,
    ...(saved ? toSiteConfigOverrides(saved) : {})
  };
  const application = createApplication({
    adapter: composition.adapter, config, documentRef, autoStart, template, plugins, importModule, moduleStyles, moduleStyleRevisions,
    ...(repositories.moduleInstances ? { getModuleInstances: () => rows(repositories.moduleInstances) } : {}),
    ...(repositories.extensions ? { getExtensions: () => rows(repositories.extensions) } : {}),
    ...(repositories.templates ? { getTemplate: () => rows(repositories.templates) } : {})
  });
  return Object.freeze({ ...composition, config: application.config, application });
}

import { escapeHtml } from '../../../../libraries/minijoomla/security/sanitize.js';

const LABELS = { categories: 'Categorias', tags: 'Tags', articles: 'Artigos', menu: 'Itens de menu', extensions: 'Plugins', templates: 'Templates', moduleInstances: 'Módulos', siteConfig: 'Configuração' };

export function renderSampleDataPage(state, link, shell) {
  const summary = state?.summary ?? { counts: {}, total: 0 };
  const enabled = state?.status === 'ready' || state?.status === 'partial' && state.canResume === true;
  const counts = Object.entries(summary.counts ?? {}).map(([domain, count]) => `<li>${escapeHtml(LABELS[domain] ?? domain)}: ${escapeHtml(count)}</li>`).join('');
  const action = state?.canResume ? 'Retomar instalação verificada' : 'Instalar dados de exemplo';
  const html = `<section aria-labelledby="sample-data-title"><h2 id="sample-data-title">Joomla Blog Sample Data</h2><p>Conteúdo e imagens de exemplo do Joomla original, adaptados aos recursos suportados. Não instala PHP, usuários, ACL, workflows ou feeds.</p><p role="status" aria-live="polite" aria-atomic="true" data-sample-status>${escapeHtml(state?.message ?? 'Dados de exemplo não configurados.')}</p><ul>${counts}</ul><p>Registros existentes ou alterados nunca são sobrescritos. Resultado incerto exige revisão; não há rollback automático nem transação entre listas.</p><button type="button" class="admin-btn admin-btn-success" data-sample-install${enabled ? '' : ' disabled'}>${escapeHtml(action)}</button><progress data-sample-progress aria-label="Progresso da instalação" max="${summary.total || 1}" value="${summary.completed ?? 0}"></progress><p><a href="${escapeHtml(link('/'))}">Voltar ao painel</a></p></section>`;
  return shell({ activeKey: 'sampleData', pageTitle: 'Dados de exemplo', breadcrumbItems: [{ label: 'Painel de controle', href: link('/') }, { label: 'Dados de exemplo' }], bodyHtml: html, link });
}

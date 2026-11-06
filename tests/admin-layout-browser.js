import { createAdminApplication } from '../src/administrator/components/com_minijoomla/app.js';
import { createAdminService } from '../src/libraries/minijoomla/application/admin-service.js';
import { createDemoRepositories } from '../examples/demo-repositories.js';
import { inspectAdminListLayout, inspectAdminOverviewLayout, runAdminLayoutFixtureTests } from './admin-layout-dom.test.js';
import { renderAdminList } from '../src/administrator/components/com_minijoomla/render-list.js';
import { runLegacyAssignmentBrowserTests } from './legacy-assignment-browser.js';

// Only mounted by tests/admin-layout.html on the loopback demo server. No tenant,
// persisted demo state, TinyMCE, uploads or editorial write assertions.
export async function prepareAdminLayoutBrowserTests() {
  if (location.hostname !== '127.0.0.1' || location.pathname !== '/tests/admin-layout.html') {
    throw new Error('Local layout test page required');
  }
  const root = document.querySelector('[data-minijoomla-admin-root]');
  const repositories = createDemoRepositories({ storage: null });
  const snapshot = async () => JSON.stringify(await Promise.all(Object.values(repositories).map((repository) => repository.findMany())));
  const initialData = await snapshot();
  let writeAttempts = 0, submits = 0;
  // Defense in depth: a misdirected native Enter cannot mutate even memory.
  // Attempt counters fail acceptance; mutations are never delegated.
  const readonlyRepositories = Object.fromEntries(Object.entries(repositories).map(([domain, repository]) => [domain, {
    ...repository, ...Object.fromEntries(['create', 'update', 'delete'].map((method) => [method, async () => {
      writeAttempts += 1; throw new Error('Layout fixture is read only');
    }]))
  }]));
  const preventSubmit = (event) => { submits += 1; event.preventDefault(); event.stopImmediatePropagation(); };
  root.addEventListener('submit', preventSubmit, true);
  const before = await repositories.articles.findMany();
  const application = createAdminApplication({
    adminService: createAdminService(readonlyRepositories), documentRef: { body: root }, autoStart: false
  });
  await application.start();
  let disposed = false;
  let keyboard;
  const nextFrame = () => new Promise((ok) => requestAnimationFrame(ok));
  const clearKeyboard = () => {
    keyboard?.cleanup();
    keyboard = null;
  };
  return Object.freeze({
    keyboardTarget() {
      if (disposed || !keyboard || location.hostname !== '127.0.0.1' || location.pathname !== '/tests/admin-layout.html') throw new Error('Keyboard fixture not ready');
      return { success: true, width: innerWidth };
    },
    async prepareKeyboard(scenario) {
      if (disposed || !['title', 'title-tab-blocked', 'title-enter-blocked', 'menu', 'menu-escape-blocked', 'menu-focus-blocked'].includes(scenario)) throw new Error('Invalid keyboard fixture');
      clearKeyboard();
      await application.router.navigate('#/articles');
      await nextFrame();
      const title = root.querySelector('tbody th[scope="row"] a');
      const expected = before.items.find((row) => application.router.link(`/articles/${row.id}`) === title?.getAttribute('href'));
      const toggle = root.querySelector('[data-admin-sidebar-toggle]');
      const sidebar = root.querySelector('.admin-sidebar');
      const brand = root.querySelector('.admin-header-brand');
      const sidebarLink = sidebar?.querySelector('a');
      const predecessor = root.querySelector('.admin-searchbar button[type="submit"]');
      if (!title || !expected || !predecessor || !toggle || !sidebar || !brand || !sidebarLink) throw new Error('Keyboard controls missing');
      const keys = [];
      const observe = (event) => {
        if (!['Tab', 'Enter', 'Escape'].includes(event.key)) return;
        keys.push({ key: event.key, trusted: event.isTrusted, target: event.target });
        // Negative controls inhibit the real input's behavior, never create a
        // keyboard event or call a router/click/focus to mimic its success.
        if ((scenario === 'title-enter-blocked' && event.key === 'Enter' && event.target === title)
            || (scenario === 'menu-escape-blocked' && event.key === 'Escape')) {
          event.preventDefault(); event.stopImmediatePropagation();
        }
      };
      const isMenu = scenario.startsWith('menu');
      if (isMenu && (innerWidth > 768 || getComputedStyle(toggle).display === 'none')) throw new Error('Mobile keyboard fixture requires visible toggle');
      keyboard = { scenario, keys, title, expected, toggle, sidebar, brand, sidebarLink,
        cleanup() { root.removeEventListener('keydown', observe, true); title.removeAttribute('tabindex'); if (scenario === 'menu-focus-blocked') delete toggle.focus; }
      };
      root.addEventListener('keydown', observe, true);
      if (scenario === 'title-tab-blocked') title.tabIndex = -1;
      const seed = isMenu ? toggle : predecessor;
      seed.focus();
      if (document.activeElement !== seed) { clearKeyboard(); throw new Error('Keyboard focus seed failed'); }
      // Suppress only the app's focus-return call for this synthetic regression;
      // the genuine Escape still closes the menu using the production handler.
      if (scenario === 'menu-focus-blocked') toggle.focus = () => {};
      return { success: true, scenario, width: innerWidth };
    },
    async inspectKeyboard(stage) {
      if (disposed || !keyboard) throw new Error('Keyboard fixture not ready');
      const { keys, title, expected, toggle, sidebar, brand, sidebarLink, scenario } = keyboard;
      const checks = [];
      const check = (condition, name) => checks.push({ name, ok: !!condition });
      const trusted = (key, target, count) => keys.length === count && keys.every((entry) => entry.trusted === true)
        && keys.at(-1)?.key === key && keys.at(-1)?.target === target;
      if (stage === 'title-tab') {
        check(trusted('Tab', root.querySelector('.admin-searchbar button[type="submit"]'), 1), 'title-tab-trusted');
        check(document.activeElement === title, 'title-tab-focus');
      } else if (stage === 'title-enter') {
        // Native anchor activation/hashchange renders asynchronously. Wait for
        // the form only, without navigating on behalf of the keyboard.
        if (scenario === 'title') {
          const deadline = performance.now() + 2000;
          while (!root.querySelector('[data-admin-form="articles"]') && performance.now() < deadline) await nextFrame();
        }
        check(trusted('Enter', title, 2), 'title-enter-trusted');
        check(location.hash === application.router.link(`/articles/${expected.id}`)
          && root.querySelector('[data-admin-form="articles"]')
          && root.querySelector('[name="title"]')?.value === expected.title
          && root.querySelector('[name="alias"]')?.value === expected.alias, 'title-enter-correct-form');
      } else if (stage === 'menu-enter') {
        check(trusted('Enter', toggle, 1), 'menu-enter-trusted');
        check(sidebar.classList.contains('admin-sidebar-open') && toggle.getAttribute('aria-expanded') === 'true', 'menu-enter-open');
      } else if (stage === 'menu-tab-brand') {
        check(trusted('Tab', toggle, 2), 'menu-tab-brand-trusted');
        check(document.activeElement === brand, 'menu-tab-brand-focus');
      } else if (stage === 'menu-tab-sidebar') {
        check(trusted('Tab', brand, 3), 'menu-tab-sidebar-trusted');
        check(document.activeElement === sidebarLink && sidebar.contains(document.activeElement), 'menu-tab-sidebar-focus');
      } else if (stage === 'menu-escape') {
        check(trusted('Escape', sidebarLink, 4), 'menu-escape-trusted');
        check(!sidebar.classList.contains('admin-sidebar-open') && toggle.getAttribute('aria-expanded') === 'false', 'menu-escape-closed');
        check(document.activeElement === toggle, 'menu-escape-toggle-focus');
      } else throw new Error('Invalid keyboard assertion stage');
      check(submits === 0, 'keyboard-no-submits');
      check(writeAttempts === 0, 'keyboard-no-write-attempts');
      check(await snapshot() === initialData, 'keyboard-in-memory-data-unchanged');
      return { success: checks.every((entry) => entry.ok), checks };
    },
    finishKeyboard() { clearKeyboard(); return { finished: true }; },
    async run() {
      if (disposed) throw new Error('Layout test application is stopped');
      clearKeyboard();
      const checks = [];
      const check = (condition, name) => checks.push({ name, ok: !!condition });
      await application.router.navigate('#/articles');
      const list = inspectAdminListLayout(root);
      const titles = [...root.querySelectorAll('tbody th[scope="row"] a')];
      check(titles.length === before.items.length && titles.length > 0, 'all-title-row-header-links');
      check(titles.every((title) => {
        const action = title.closest('tr').querySelector('.admin-col-action a');
        return title.getAttribute('href') === action?.getAttribute('href')
          && title.getAttribute('aria-label') === `Editar: ${title.textContent.trim()}`
          && title.getAttribute('aria-label') === action?.getAttribute('aria-label');
      }), 'title-action-safe-route-and-contextual-names');
      const title = titles[0];
      if (title) {
        const expected = before.items.find((row) => application.router.link(`/articles/${row.id}`) === title.getAttribute('href'));
        await application.router.navigate(title.getAttribute('href'));
        check(expected && root.querySelector('[data-admin-form="articles"]')
          && root.querySelector('[name="title"]')?.value === expected.title, 'title-route-opens-corresponding-form');
      } else check(false, 'title-route-opens-corresponding-form');
      await application.router.navigate('#/');
      const overview = inspectAdminOverviewLayout(root);
      const fixture = runAdminLayoutFixtureTests(document);

      // Article-only synthetic schedule fixture. Inspect actual SVG geometry
      // and hidden-label styling with the existing Atum CSS, not just HTML.
      const scheduleHost = document.createElement('div');
      scheduleHost.className = 'admin-shell';
      const scheduleRows = [
        { id: 1, title: 'Ativo', state: 'Published', featured: true },
        { id: 2, title: 'Futuro', state: 'Published', featured: true, publishUp: '2026-11-04T12:00:00.001Z' },
        { id: 3, title: 'Encerrado', state: 'Published', featured: true, publishDown: '2026-11-04T12:00:00.000Z' },
        { id: 4, title: 'Inválido', state: 'Published', featured: true, publishUp: 'invalid', featuredUp: 'invalid' },
        { id: 5, title: 'Destaque futuro', state: 'Published', featured: true, featuredUp: '2026-11-04T12:00:00.001Z' },
        { id: 6, title: 'Destaque encerrado', state: 'Published', featured: true, featuredDown: '2026-11-04T12:00:00.000Z' }
      ];
      const savedSchedule = JSON.stringify(scheduleRows);
      scheduleHost.innerHTML = renderAdminList({ rows: scheduleRows, domain: 'articles', columns: ['title', 'state', 'featured'], now: '2026-11-04T12:00:00.000Z' });
      document.body.append(scheduleHost);
      try {
        const indicators = [...scheduleHost.querySelectorAll('.admin-state-icon')];
        check(indicators.length === 12, 'schedule-all-cells-have-indicators');
        check(indicators.every((indicator) => {
          const label = indicator.querySelector('.visually-hidden');
          const svg = indicator.querySelector('svg');
          const bounds = svg?.getBoundingClientRect();
          return label && label.textContent === indicator.title && getComputedStyle(label).position === 'absolute'
            && svg?.getAttribute('aria-hidden') === 'true' && svg?.getAttribute('focusable') === 'false'
            && bounds?.width === 12 && bounds?.height === 12;
        }), 'schedule-svg-size-and-hidden-contextual-labels');
        check(scheduleHost.querySelectorAll('.is-featured').length === 1, 'schedule-only-currently-published-active-highlight');
        check(['Publicação agendada', 'Publicação encerrada', 'Publicação com datas inválidas', 'Destaque agendado', 'Destaque encerrado'].every((label) => indicators.some((indicator) => indicator.title === label)), 'schedule-label-matrix');
        check(scheduleHost.scrollWidth <= scheduleHost.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1, 'schedule-overflow-stays-in-table-wrapper');
        check(savedSchedule === JSON.stringify(scheduleRows), 'schedule-saved-records-unchanged');
      } finally { scheduleHost.remove(); }

      const legacy = await runLegacyAssignmentBrowserTests(document);
      check(legacy.success, 'legacy-assignment-native-dom-and-geometry');
      checks.push(...legacy.checks);

      // Synthetic regressions of the old action/icon defects. Deliberately not
      // presented as a complete historical stylesheet or visual comparison.
      const regression = document.createElement('style');
      regression.textContent = '.admin-list .admin-col-action .admin-btn{white-space:normal!important;overflow-wrap:anywhere!important}.admin-overview-icon>svg{width:16px!important;height:16px!important}';
      document.head.append(regression);
      let negative;
      try { negative = runAdminLayoutFixtureTests(document); }
      finally { regression.remove(); }
      check(negative.list.checks.some((entry) => entry.name === 'action-caption-not-broken-into-letters' && !entry.ok), 'negative-action-control-detected');
      check(negative.overview.checks.some((entry) => entry.name === 'overview-svg-uses-quickicon-size' && !entry.ok), 'negative-icon-control-detected');
      check(!negative.success, 'negative-fixture-rejected');
      const restored = runAdminLayoutFixtureTests(document);
      check(restored.success, 'fixture-recovers-after-negative-control');
      check(JSON.stringify(await repositories.articles.findMany()) === JSON.stringify(before), 'in-memory-articles-unchanged');
      check(document.querySelectorAll('.admin-shell').length === 1, 'single-mount-and-fixture-cleanup');
      return {
        success: list.success && overview.success && fixture.success && checks.every((entry) => entry.ok),
        width: innerWidth, list, overview, fixture, checks,
        localSyntheticOnly: true, tenantWrites: false, richEditorTested: false, integralVisualAcceptance: false
      };
    },
    stop() { clearKeyboard(); root.removeEventListener('submit', preventSubmit, true); application.stop(); disposed = true; root.replaceChildren(); }
  });
}

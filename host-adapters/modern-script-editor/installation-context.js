/**
 * window._spPageContextInfo only exists on classic SharePoint pages; modern
 * pages (where this host actually runs) never populate it. The release path
 * itself (same-origin, already where this script was loaded from) is the
 * reliable same-site signal: .../<webUrl>/SiteAssets/<library>/releases/<v>/.
 */
function webUrlFromReleasePath(pathname) {
  const marker = '/SiteAssets/';
  const index = pathname.indexOf(marker);
  return index < 0 ? undefined : (pathname.slice(0, index) || '/');
}

/** Bootstrap metadata only; never infer list absence or permission from URL. */
export function resolveInstallationContext({ configured = {}, pageContext = {}, locationRef, releaseUrl } = {}) {
  const origin = locationRef?.origin;
  if (typeof origin !== 'string' || !/^https:\/\/[^/]+$/.test(origin)) throw new TypeError('Origem HTTPS da instalação inválida.');
  const release = new URL(releaseUrl, origin);
  if (release.origin !== origin) throw new TypeError('Release deve pertencer à mesma origem da instalação.');
  const rawWeb = configured.webUrl ?? pageContext.webServerRelativeUrl ?? webUrlFromReleasePath(release.pathname);
  if (typeof rawWeb !== 'string' || !rawWeb.startsWith('/') || rawWeb.startsWith('//') || /[\\?#\s]/.test(rawWeb) || rawWeb.split('/').some(segment=>segment==='.'||segment==='..')) throw new TypeError('Contexto do site ausente ou inválido.');
  const webUrl = rawWeb === '/' ? '/' : rawWeb.replace(/\/$/,'');
  const libraryPath = configured.libraryPath ?? `${webUrl === '/' ? '' : webUrl}/SiteAssets/minijoomla`;
  if (typeof libraryPath !== 'string' || !libraryPath.startsWith(`${webUrl === '/' ? '' : webUrl}/SiteAssets/`) || libraryPath.includes('..') || /[\\?#\s]/.test(libraryPath)) throw new TypeError('Biblioteca da instalação inválida.');
  if (!release.pathname.startsWith(`${libraryPath}/releases/`)) throw new TypeError('Release deve pertencer à biblioteca da instalação.');
  return Object.freeze({webUrl,libraryPath});
}

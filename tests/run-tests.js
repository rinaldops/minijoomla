import { lstat, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Mark dependencies explicitly, including imports through another test fixture.
// Adapter-contract and error-translation tests use local implementations only.
export const TEST_SUITES = Object.freeze([
  ['runner.test.js', 'runRunnerTests'],
  ['generic-installation-scope.test.js', 'runGenericInstallationScopeTests'],
  ['installation-view.test.js', 'runInstallationViewTests'],
  ['installation-context.test.js', 'runInstallationContextTests'],
  ['installation-service.test.js', 'runInstallationServiceTests'],
  ['sharepoint-installation.test.js', 'runSharePointInstallationTests', true],
  ['generic-installation-package.test.js', 'runGenericInstallationPackageTests', true],
  ['generic-installation-host.test.js', 'runGenericInstallationHostTests', true],
  ['installation-config-continuity.test.js', 'runInstallationConfigContinuityTests'],
  ['sharepoint-media-folder.test.js', 'runSharePointMediaFolderTests'],
  ['extension-roots-view.test.js', 'runExtensionRootsViewTests'],
  ['extension-roots-service.test.js', 'runExtensionRootsServiceTests'],
  ['sharepoint-extension-roots.test.js', 'runSharePointExtensionRootsTests'],
  ['installed-template-runtime.test.js', 'runInstalledTemplateRuntimeTests'],
  ['installed-template-administration.test.js', 'runInstalledTemplateAdministrationTests'],
  ['template-metadata.test.js', 'runTemplateMetadataTests'],
  ['installed-template-params.test.js', 'runInstalledTemplateParamsTests'],
  ['installed-template-params-admin.test.js', 'runInstalledTemplateParamsAdminTests'],
  ['installed-template-params-spmiddle.test.js', 'runInstalledTemplateParamsSPMiddleTests', true],
  ['articles-featured.test.js', 'runArticlesFeaturedTests'],
  ['articles-featured-integration.test.js', 'runArticlesFeaturedIntegrationTests'],
  ['sample-data-service.test.js', 'runSampleDataServiceTests'],
  ['sample-data-journal.test.js', 'runSampleDataJournalTests'],
  ['sample-data-package.test.js', 'runSampleDataPackageTests'],
  ['sample-data-view.test.js', 'runSampleDataViewTests'],
  ['sample-data-singleton.test.js', 'runSampleDataSingletonTests'],
  ['site-views-core.test.js', 'runSiteViewsCoreTests'],
  ['plugins-native-runtime.test.js', 'runPluginsNativeRuntimeTests'],
  ['plugins-save-events.test.js', 'runPluginsSaveEventsTests'],
  ['admin-plugins-runtime.test.js', 'runAdminPluginsRuntimeTests', true],
  ['extension-migration-plan.test.js', 'runExtensionMigrationPlanTests'],
  ['admin-joomla-content.test.js', 'runAdminJoomlaContentTests'],
  ['admin-menu-model.test.js', 'runAdminMenuModelTests'],
  ['admin-article-model.test.js', 'runAdminArticleModelTests'],
  ['admin-component-views.test.js', 'runAdminComponentViewsTests'],
  ['admin-config-view.test.js', 'runAdminConfigViewTests'],
  ['admin-discovery-views.test.js', 'runAdminDiscoveryViewsTests'],
  ['admin-installer-confirmation.test.js', 'runAdminInstallerConfirmationTests'],
  ['admin-taxonomy-views.test.js', 'runAdminTaxonomyViewsTests'],
  ['admin-modules-view.test.js', 'runAdminModulesViewTests'],
  ['admin-plugins-view.test.js', 'runAdminPluginsViewTests'],
  ['admin-template-styles-view.test.js', 'runAdminTemplateStylesViewTests'],
  ['admin-module-form-view.test.js', 'runAdminModuleFormViewTests'],
  ['admin-extension-forms-view.test.js', 'runAdminExtensionFormsViewTests'],
  ['admin-component-options-view.test.js', 'runAdminComponentOptionsViewTests'],
  ['admin-installer-view.test.js', 'runAdminInstallerViewTests'],
  ['admin-template-discovery.test.js', 'runAdminTemplateDiscoveryTests'],
  ['admin-joomla-forms.test.js', 'runAdminJoomlaFormsTests', true],
  ['sanitize-html.test.js', 'runSanitizeHtmlTests'],
  ['spmiddle-adapter-cache.test.js', 'runSPMiddleAdapterCacheTests'],
  ['review-fixes.test.js', 'runReviewFixesTests'],
  ['modules-joomla.test.js', 'runModulesJoomlaTests'],
  ['module-manifests.test.js', 'runModuleManifestsTests'],
  ['joomla-manifest.test.js', 'runJoomlaManifestTests'],
  ['joomla-discovery.test.js', 'runJoomlaDiscoveryTests'],
  ['joomla-host.test.js', 'runJoomlaHostTests'],
  ['joomla-package-assets.test.js', 'runJoomlaPackageAssetsTests'],
  ['joomla-pilot-lifecycle.test.js', 'runJoomlaPilotLifecycleTests', true],
  ['module-adoption.test.js', 'runModuleAdoptionTests'],
  ['camap-editorial-adoption.test.js', 'runCamapEditorialAdoptionTests'],
  ['editorial-adaptation.test.js', 'runEditorialAdaptationTests'],
  ['highlights-adaptation.test.js', 'runHighlightsAdaptationTests'],
  ['topsections-adaptation.test.js', 'runTopsectionsAdaptationTests'],
  ['xml-module-group.test.js', 'runXmlModuleGroupTests'],
  ['hero-adaptation.test.js', 'runHeroAdaptationTests'],
  ['home-adaptation.test.js', 'runHomeAdaptationTests'],
  ['recursos-adaptation.test.js', 'runRecursosAdaptationTests'],
  ['showcase-adaptation.test.js', 'runShowcaseAdaptationTests'],
  ['documentation-adaptation.test.js', 'runDocumentationAdaptationTests'],
  ['documentation-source-package.test.js', 'runDocumentationSourcePackageTests'],
  ['plugins-builtin.test.js', 'runPluginsBuiltinTests'],
  ['release-check.test.js', 'runReleaseCheckTests'],
  ['serve-local.test.js', 'runServeLocalTests'],
  ['standalone-examples.test.js', 'runStandaloneExamplesTests'],
  ['release-stage.test.js', 'runReleaseCoreStageTests'],
  ['distribution-audit.test.js', 'runDistributionAuditTests'],
  ['tooling-validation.test.js', 'runToolingValidationTests'],
  ['contributor-stage.test.js', 'runContributorStageTests'],
  ['admin-layout-runner.test.js', 'runAdminLayoutRunnerTests'],
  ['editor-final.test.js', 'runEditorFinalTests'],
  ['image-margins.test.js', 'runImageMarginsTests'],
  ['published-parameter-compat.test.js', 'runPublishedParameterCompatTests'],
  ['tinymce-notices.test.js', 'runTinyMceNoticesTests'],
  ['legacy-module-assignment.test.js', 'runLegacyModuleAssignmentTests'],
  ['legacy-assignment-forms.test.js', 'runLegacyAssignmentFormTests'],
  ['featured-schedule.test.js', 'runFeaturedScheduleTests'],
  ['article-schedule.test.js', 'runArticleScheduleTests'],
  ['admin-integrity.test.js', 'runAdminIntegrityTests', true],
  ['admin-extensions-service.test.js', 'runAdminExtensionsServiceTests', true],
  ['plugin-group-storage.test.js', 'runPluginGroupStorageTests', true],
  ['admin-extensions-app.test.js', 'runAdminExtensionsAppTests', true],
  ['admin-management.test.js', 'runAdminManagementTests'],
  ['camap-template.test.js', 'runCamapTemplateTests'],
  ['cassiopeia-template.test.js', 'runCassiopeiaTemplateTests'],
  ['menu-tree.test.js', 'runMenuTreeTests'],
  ['core.test.js', 'runTests'],
  ['static-ui.test.js', 'runStaticUiTests'],
  ['adapter-contract.test.js', 'runAdapterContractTests'],
  ['spmiddle-adapter.test.js', 'runSPMiddleAdapterTests'],
  ['spmiddle-integration.test.js', 'runSPMiddleIntegrationTests', true],
  ['provisioning-model.test.js', 'runProvisioningModelTests', true],
  ['spmiddle-error-translation.test.js', 'runSPMiddleErrorTranslationTests'],
  ['admin-service.test.js', 'runAdminServiceTests'],
  ['extension-discovery-service.test.js', 'runExtensionDiscoveryServiceTests'],
  ['media-upload-service.test.js', 'runMediaUploadServiceTests'],
  ['dynamic-modules.test.js', 'runDynamicModulesTests'],
  ['admin-render.test.js', 'runAdminRenderTests'],
  ['admin-app.test.js', 'runAdminAppTests'],
  ['admin-discovery-registration.test.js', 'runAdminDiscoveryRegistrationTests'],
  ['article-accessibility.test.js', 'runArticleAccessibilityTests'],
  ['site-runtime.test.js', 'runSiteRuntimeTests', true],
  ['module-runtime.test.js', 'runModuleRuntimeTests'],
  ['component-options-runtime.test.js', 'runComponentOptionsRuntimeTests', true],
  ['query-options.test.js', 'runQueryOptionsTests'],
  ['query-options-main-regression.test.js', 'runQueryOptionsMainRegressionTests'],
  ['query-options-main-spmiddle.test.js', 'runQueryOptionsMainSPMiddleRegressionTests', true],
  ['offline-gate.test.js', 'runOfflineGateTests'],
  ['site-config-overrides.test.js', 'runSiteConfigOverridesTests'],
  ['schema-migration.test.js', 'runSchemaMigrationTests', true],
  ['entity-contracts-final.test.js', 'runEntityContractsFinalTests', true]
].map(([file, entryPoint, requiresSPMiddle = false]) => Object.freeze({ file, entryPoint, requiresSPMiddle })));

async function hasSPMiddle(testsDirectory) {
  // Only an absent sibling is optional. A partial checkout, permission failure,
  // bad package import, or a non-directory sibling must never become a skip.
  const sibling = new URL('../../SPMIDDLE', testsDirectory);
  try {
    await lstat(sibling);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  // Following a broken symlink must fail too, not look like an absent checkout.
  if (!(await stat(sibling)).isDirectory()) throw new Error('SPMIDDLE exists but is not a directory');
  return true;
}

// testsDirectory/suites support isolated runner fixtures, not middleware mocks
// or a CLI switch that silently disables an installed integration.
export async function runTestSuites({
  suites = TEST_SUITES,
  testsDirectory = new URL('./', import.meta.url),
  report = console.log
} = {}) {
  const spmiddlePresent = suites.some((suite) => suite.requiresSPMiddle)
    ? await hasSPMiddle(testsDirectory) : false;
  const summary = { passed: 0, skipped: 0, failed: 0 };
  const failures = [];

  for (const suite of suites) {
    if (suite.requiresSPMiddle && !spmiddlePresent) {
      summary.skipped += 1;
      report(`SKIP - ${suite.file}: optional SPMIDDLE integration; ../SPMIDDLE is absent`);
      continue;
    }
    try {
      const module = await import(new URL(suite.file, testsDirectory).href);
      if (typeof module[suite.entryPoint] !== 'function') {
        throw new TypeError(`${suite.file} must export ${suite.entryPoint}()`);
      }
      await module[suite.entryPoint]();
      summary.passed += 1;
      report(`ok - suite ${suite.file} (${suite.requiresSPMiddle ? 'SPMIDDLE integration' : 'core/local'})`);
    } catch (error) {
      summary.failed += 1;
      failures.push(new Error(`${suite.file}: ${error.message}`, { cause: error }));
      report(`not ok - suite ${suite.file}: ${error.message}`);
    }
  }

  report(`Suites: ${summary.passed} passed, ${summary.skipped} skipped, ${summary.failed} failed`);
  if (failures.length) throw new AggregateError(failures, `${failures.length} test suite(s) failed`);
  return summary;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runTestSuites().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

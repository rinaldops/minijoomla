# Next work

This is a bounded contributor backlog, not a claim of Joomla feature parity.
See [contribution guidance](CONTRIBUTING.md) and [security policy](SECURITY.md).

## Reconciled baseline — 2026-11-04

> Historical baseline below. The current [continuity plan](PLANO-CONTINUIDADE-MINIJOOMLA.md)
> prioritizes consolidation and Joomla-standard features. Videoteca/Forum and
> further external adoption are suspended; existing work and installed modules
> are preserved. Plugin/template XML and assisted migrations remain explicit
> pending work, not implied support from the module profile.

Coordinator-reported production versions are **public 0.2.11 / admin 0.2.10**.
The saved-image fix has **user-reported acceptance**, not a fresh agent
observation. Main push `23f4696` includes `bc64256`, `343bb58` and restored JSON
contracts; counter/label and declarative consumers are now active in 0.2.10.
The coordinator reports
**43 passing suites, zero suite skips/failures / 136 JavaScript syntax checks**, including
standalone and the new pure compatibility suite. Native local FIORI-AUTO checks
passed seven widths after JSON restoration; this is not integral visual acceptance.
Admin 0.2.9 was briefly activated, then **restored to 0.2.7** after its real
module route exposed loss of the published JSON parameter contract from the
actual historical 0.2.5 base. Fresh canvas/ETag, scoped MERGE/Publish and reload
confirmed one admin mount and a working module route. Public 0.2.8, its
canvas/ETag and saved data were untouched. **Subsequently, 0.2.10 was published
and reloaded successfully**, after independent compatibility review. Its 15 new
files (14 JS plus manifest) and 119 dependencies/134 total assets were verified
by bytes/SHA-256/MIME. CSS/editor 0.2.5, scheduling 0.2.6 and discovery 0.2.7 are
preserved. Seven-width preview covered a real catalog snapshot (11 registered
modules/eight native types, including overlaps); effective-host checks covered
one mount, routes, real TinyMCE/three tabs/cleanup and synthetic scheduling.
Article/page ETags and public 0.2.8 were preserved, without data writes, module
creation or media upload. 0.2.9 remains immutable/inactive. See the
[incident/rollback contract](CONTRACTS-MINIJOOMLA.md#65-contadores-administrativos-e-parâmetros-declarativos-próprios).
The
[current plan matrix](PLANO-CONTINUIDADE-MINIJOOMLA.md#estado-atual-autoritativo--04112026)
is authoritative over historical release descriptions below.

**Subsequent public publication:** 0.2.11, source `23f4696`, replaced only the
public script `src` from 0.2.8, preserving admin 0.2.10/canvas/ETag. Nine new files
(seven JS, CSS and manifest), 248 historical dependencies/257 total assets were
verified by bytes/SHA-256/MIME. The six-module replacement closure is based on
the actual 0.2.8 graph, not a full runtime update: sanitizer 0.2.8 hash, four
optional CAMAP CSS files and absolute 0.2.1/`import.meta` resources are preserved.
Saved configuration retains precedence over the `camap` → `cassiopeia` fallback;
no configuration was saved. Fresh prepublication 0.2.8 already rendered Cassiopeia
with old corporate CSS; the external configuration change's origin is unknown.
Seven-width preview and effective reload passed; neutral CSS/computed header,
one mount, navigation and a real article without alerts were confirmed. Synthetic
position/image/security/lifecycle tests and trusted Enter/Escape menu checks are
distinct from the real article. Both page ETags stayed unchanged during checks;
no editorial save, module creation or media upload. See
[public contract 6.6](CONTRACTS-MINIJOOMLA.md#66-público-neutro-cassiopeia--0211).

## Before an independent distribution

1. **Neutral public presentation.** Verify a usable independent selection with
   the neutral template; host publication 0.2.11 is verified but not a complete
   contributor distribution or integral visual acceptance.
   Preserve module positions,
   navigation, image spacing, responsive behavior, focus and sanitization.
   Validate actual rendering; absence of overflow is not visual acceptance.
   Local Cassiopeia styling/labels were neutralized; public 0.2.11 now loads the
   neutral CSS. Preview and reload passed seven widths, with 15 positions/legacy
   aliases, synthetic image float/180px width/20px margin and two trusted native
   Enter/Escape menu checks. Integral visual/assistive acceptance is still open.
2. **Dependency rights and provenance.** Verify TinyMCE corresponding source and
   build provenance before redistributing its minified subset. Include original
   notices for any integration packages included in a release. Current staging
   preserves the original SPMIDDLE MIT notice for integration targets; this
   corrects the earlier copying defect. The original TinyMCE `notices.txt` is now
   preserved locally and required/hashed in `all`, with all 32 prior vendor files
   unchanged. Those fixes do not authenticate provenance or supply full license/
   corresponding-source/build materials; no new host release was made. A source link is
   not by itself evidence of complete license compliance.
3. **Privacy review.** Review selected distributable files and existing history.
   Ignoring temporary files does not remove tracked copies or historical data.
   Do not publish the workspace, profiles or tenant evidence wholesale.
   The historical core sample remains **48 files / three candidates**.
   Selected-source neutralization `51a1b2a` is committed/pushed (**3 → 0**).
   A new core **0.3.1 / 50 files / 496,268 bytes** was audited: **zero candidates,
   all declared hashes verified**. This closes the technical manifest gate,
   not manual privacy/rights review or the 243 tracked temporary files/history.
   Core 0.3.0 (49/490,634/zero) is a preserved historical stage.
4. **Standalone execution.** Keep core tests and core staging independent of
   integrations. Standalone `bc64256` and CAMAP preview correction `343bb58`
   are committed/pushed through main `23f4696`: **seven isolated Node groups passed**,
   without `LIMIT` or tolerated warnings, preserving saved data/ETags and
   template-owned defaults/styles. Modules execute without source transformation
   or a sibling; eight integrations are skipped only in the no-sibling run.
   Use `npm run test:standalone-examples` and [LOCAL-DEMO.md](LOCAL-DEMO.md).
    The isolated child reports 34 passes because it excludes `runner.test.js`
   to avoid recursion, while including the standalone examples;
   the full runner registers 35 local suites plus eight optional integrations.
   Core source staging is not a complete usable contributor distribution;
   this test does not exercise real TinyMCE, browser DOM or visual acceptance.
   Native admin layout now has a separate FIORI-AUTO command, in-memory data,
   seven widths and required negative controls; core tests do not launch it.

## Administration

- **Assisted legacy assignments implemented locally:** exact All/native-route
  plans, preview/apply/restore without writes and explicit save with rendered
  ETag. Category-route intersections are intentionally refused: tokens use OR,
  not AND. 1,034 real public-resolver comparisons and form tests passed; native
  local DOM/geometry passed seven widths with scripted clicks. No new host
  deployment or automatic tenant migration; see
  [contract 6.7](CONTRACTS-MINIJOOMLA.md#67-conversão-assistida-de-atribuições-legadas--local).

- Image layout fix supplied by the user is committed with regression coverage:
  image-only `float` and bounded pixel width now survive public sanitization,
  alongside margins. Editor upload synchronization and exact saved HTML remain
  unchanged; in-memory round-trip and the **historical 38-suite run for that image
  increment** passed. The current combined run is 43/0 suite skips/0 failures. Public 0.2.8
  was published and reloaded, with 248 assets verified; 154 native preview checks
  passed seven widths. An actual public-template synthetic fixture passed; the
  real article opened had no images, so that agent observation did not exercise
  a saved image. The user subsequently confirmed testing the correction:
  **“ok você está certo acabei testar”**. Record this as user-reported acceptance,
  distinct from the synthetic fixture and without claiming a new agent retest.
  No editorial writes, neutral Cassiopeia adoption or admin replacement occurred
  **during that image increment**; current admin is 0.2.10.
  See [image presentation contract](CONTRACTS-MINIJOOMLA.md#64-correção-de-apresentação-das-imagens-de-artigos).

- Title edit links and contextual accessible names shipped in administrative
  increment 0.2.4, verified after reload and across seven widths, then preserved
  by 0.2.6 on the actual editor/services base 0.2.5 and byte-identical 0.2.3 CSS. Integral visual and
  accessibility acceptance are still pending.
- Article indicators now distinguish saved state/flags from scheduled,
  expired, invalid or effective windows, sharing temporal semantics with public
  adapters. Synthetic regression and native seven-width geometry checks passed;
  no saved records changed. Deployed in administrative increment **0.2.6** with
  the actual 0.2.5 base and unchanged CSS. Real reload, seven-width list/editor
  navigation and 42 synthetic scheduling checks in the host passed. The public
  page stayed 0.2.1 **at that historical increment**; current versions are admin
   0.2.10/public 0.2.11, preserving scheduling 0.2.6. See [scheduling contract](CONTRACTS-MINIJOOMLA.md#62-agendamentos-de-artigo-e-indicadores-administrativos).
  Refresh occurs on navigation, not on a timer; integral assistive acceptance
  remains pending. Native local keyboard coverage now passes seven widths.
- Add keyboard, zoom, screen-reader and real system-media acceptance. Native DOM
  and color measurements supplement, but do not replace, visual review.
  Public zoom attempts did not establish 200%/400%: `Control+Add` was rejected;
  `Control+Equal` left the DPR ratio at 1. Zoom is unverified, not unavailable.
  Real forced-colors/reduced-motion were not checked; a screen reader was not
  investigated. Generic JSON controls restored in 0.2.10 do not implement the
   CAMAP `bandTones` editor. Assisted legacy conversion was subsequently
   implemented locally, not deployed in admin 0.2.10.
  The session model could not interpret the private screenshot; no integral
  visual/screenshot acceptance is claimed.
- Preserve the already-published 0.2.5 disabled discovery registration fix when
  shipping article indicators. It is integrated and preserved in 0.2.6, with tests
  for cancellation, tampered attributes and stale handlers. The separate metadata
  increment now propagates validated raw manifests, plugin groups and parameter
  definitions locally, preserving unknown data and disabled registration. Legacy
   missing metadata keeps the empty-manifest/default-group fallback. Admin 0.2.7
  was published with immutable assets and a verified single mount; seven-width
  preactivation and post-publication checks passed (315 per run, including 119
  synthetic metadata checks). No extension registration was written to the tenant.
  See [discovery metadata contract](CONTRACTS-MINIJOOMLA.md#63-descoberta-de-extensões-metadados-declarativos-v2).
- **Published in admin 0.2.10:** declarative parameter consumers now
  read own properties only; plugin-group views normalize valid groups without
  recovering invalid raw groups. This does not repair persisted legacy manifests
  automatically. The admin consumer was updated with the verified historical
  contract preserved. Combined regression is
  coordinator-reported (43 suites, zero suite skips/failures / syntax of 136 JS).
  Historical JSON/limits/clone/URL-hash/native-input compatibility is restored
  and independently reviewed: exact historical normalization, eight native types,
  three advanced defaults and rendered function-body equality passed. Real-catalog
  preview and seven-width effective-host validation subsequently passed for 0.2.10;
  full visual/assistive acceptance and actual data-write tests remain separate.
- Keep regression coverage for compact action captions, SVG size, counter/name
  hierarchy, editor width inside host containers and panel-anchored mobile menu.
  `test:admin-layout` durably covers actions/cards/title-route fixtures; rich
  editor and media/zoom acceptance remain separately scoped work.
- **Published in admin 0.2.10:** overview labels clarify saved module
  instances separately from catalog/type totals. The instance counter counts
  saved module instances, not
  enabled module extension types or currently rendered placements. Creating the
  first instance makes the total nonzero; disabled/trashed instances still count.
  Local regression covers an empty collection **0 → 1 → 2**, including registered
  types and disabled/trashed saved instances. No tenant record was created to
  make the count positive. The 0 → 1 → 2 preview is synthetic; the real catalog
  snapshot checks are separate. The brief 0.2.9 activation was rolled back;
  current admin 0.2.10 passed its own publication/reload checks.

## Out of scope for a minimal first release

Own authentication/ACL, PHP packages, server extensions, Joomla migration,
multiuser production-readiness, and corporate provisioning are not implemented
or promised. Any new integration must enforce authorization at its backend/host.

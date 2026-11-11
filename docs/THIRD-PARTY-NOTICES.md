# Third-party notices

## Original MINIJOOMLA code

### Joomla Blog Sample Data

`src/plugins/sampledata/blog/data.js` is generated from Joomla sampledata Blog
PHP/INI at revision `52559589cb6a02c9e2fc48270f92b3aff7b8b7a0`.
Source text: GPL-2.0-or-later, (C) 2017 Open Source Matters, Inc.
`scripts/generate-joomla-sampledata.js` retains original text, translating only
supported paths/relationships into the MiniJoomla JavaScript profile.
The JPEG subset in `src/media/sampledata/joomla-blog/` preserves original bytes;
NASA captions from the sample data are retained. Byte correspondence to the
local Joomla checkout is not universal media-rights or acquisition certification.
See [implementation and limits](ETAPA-1-SAMPLE-DATA.md). No PHP plugin is executed.

Licensed under GPL-2.0-or-later, selected by the project owner on 2026-11-03.
See [LICENSE.md](../LICENSE.md) and the [GPL version 2 text](licenses/GPL-2.0.txt).
This selection does not replace existing third-party notices or resolve rights
over private artifacts in the current workspace.

## Current distribution gates — 2026-11-04

This documentary reconciliation relies on the existing offline aggregate and
coordinator reports; it does not reinspect concurrently changing vendor/source
files. Historical inspections below retain their original scope and results.

- Original **SPMIDDLE MIT copying is fixed in current staging** for graphs that
  include SPMIDDLE. Earlier paragraphs recording its omission are superseded
  findings, not current blockers. Package provenance/embedded rights are not
  thereby certified.
- TinyMCE local 32-file correspondence is not authenticated upstream provenance,
  a verified complete preferred-form corresponding source/build distribution,
  or legal compliance. Original internal notices must be preserved and mapped
  to the actual subset with applicable full licenses/copyrights/modifications.
  The missing `notices.txt` copying defect was subsequently fixed locally,
  as detailed below; full license texts/provenance remain separate requirements.
- The historical **48-file core / three-candidate** sample remains historical.
  Selected-source neutralization is committed/pushed in `51a1b2a`; the coordinator
  reports **3 → 0 in those sources**. A new core **0.3.0 / 49 files / 490,634 bytes**
  was audited with **zero candidates and all declared hashes verified**, closing
  the technical manifest gate only. `publicDistributionApproved`, `rightsReviewed`
  and `privacyCertified` remain **false**; manual privacy/rights review and the
  243 tracked temporary files/history remain unresolved.
- `core` selects source without the TinyMCE runtime or SPMIDDLE; it is not a
  complete contributor distribution or proof that the rich editor works without
  them. Standalone `bc64256` and CAMAP preview correction `343bb58` are committed
  and pushed through main `23f4696`: seven isolated Node groups passed without `LIMIT` or tolerated
  warnings, executing example modules without transformation and preserving saved
  data/ETags. These are not real TinyMCE/browser DOM tests;
  see [LOCAL-DEMO.md](LOCAL-DEMO.md). `all`/`site` remain integration targets.
  Rights review follows the actual selected materials, not merely the project's
  main license.
- Joomla configuration/code actually reused and name/trademark claims still
  require review. A request to continue until completion grants neither those
  rights nor permission to disclose corporate data or rewrite history.

Administrative 0.2.9 was briefly activated and selectively rolled back to
**0.2.7** after a historical JSON contract mismatch; public **0.2.8** and saved
data were preserved. JSON/compatibility subsequently passed independent review;
**admin 0.2.10 is now published/reloaded**, source/main push `23f4696`, including
`bc64256`/`343bb58` and restored contracts. Its 15 new files and 119 dependencies/
134 assets were verified by bytes/SHA-256/MIME; CSS/editor 0.2.5, scheduling 0.2.6
and discovery 0.2.7 are preserved. Real-catalog preview and effective-host checks
passed seven widths, real TinyMCE/three tabs/cleanup and synthetic scheduling,
without data writes, module creation or media uploads. **Public Cassiopeia 0.2.11
was subsequently published**, also from `23f4696`, replacing only the public
script `src` and preserving admin 0.2.10/canvas/ETag. Nine new files (seven JS,
CSS and manifest), 248 historical dependencies/257 total assets were verified
by bytes/SHA-256/MIME. Six replaced modules follow the actual 0.2.8 graph, not a
full runtime update: sanitizer 0.2.8 hash, four optional CAMAP CSS files and
absolute 0.2.1/`import.meta` resources remain unchanged. Saved configuration
keeps precedence; no saved data was written. Prepublication 0.2.8 already mounted
Cassiopeia with old corporate CSS; the external configuration change's origin is
unknown. Preview/reload passed seven widths, neutral CSS/computed header, one
mount, navigation/real article without alerts and two trusted native Enter/Escape
menu checks. Both page ETags stayed unchanged during checks; no editorial save,
module creation or media upload. These are deployment checks, not a materials/
rights audit. Zoom 200%/400% was not established by the failed attempts; real
forced-colors/reduced-motion were not checked and a screen reader was not
investigated. None is declared unavailable or accepted. The pre-notice run's **40 passing
suites / zero skips/failures / 131 JS syntax checks** and seven native local
widths after JSON restoration do not constitute visual/legal approval. Neither
the successful deployment nor source/test commits resolve any license gate;
[contract 6.5](CONTRACTS-MINIJOOMLA.md#65-contadores-administrativos-e-parâmetros-declarativos-próprios)
records the administrative incident; [public contract 6.6](CONTRACTS-MINIJOOMLA.md#66-público-neutro-cassiopeia--0211)
records the public increment. GPL selection remains distinct from verified corresponding source,
embedded-license compatibility and rights over reused code/assets.

See [current readiness](OPEN-SOURCE-READINESS.md) and the
[authoritative plan matrix](PLANO-CONTINUIDADE-MINIJOOMLA.md#estado-atual-autoritativo--04112026).

### Subsequent local notice preservation — 2026-11-04

The original [TinyMCE notices](../src/media/vendor/tinymce/notices.txt) are now
preserved byte-for-byte: **471 bytes**, SHA-256
`998c28e80bb7ffcd8c0b96d6f1bc2be79742929281b8259750613dac7376281e`.
All **32 existing vendor files remain unchanged**; the 33-file subset corresponds
to the retained package and archive entries locally. Git attributes disable
line-ending transformation of vendor files, preserving original artifact bytes.
The new portable `tinymce-notices.test.js` requires neither that retained archive
nor a sibling, and pins the original notice and previous vendor baseline.

Staging `all` requires/copies the notice and hashes it; `site`/`core` still
exclude TinyMCE and do not acquire its notices without its code. Regression
rejects arbitrary text/config files; `notices.txt` is the explicit additional
basename, not a generic `.txt` allowance. Full stage checks passed **all 111 /
site 55 / core 49**. The integrated runner now passes **41 suites (33 local,
eight integration), zero suite skips/failures**; syntax passes **132 JS** on
Node 24.18.0. The isolated child passes 32 local suites, excluding only its runner.

Committed as **`11afbe4`**. This is a **local source/staging correction**, not a new host publication:
admin 0.2.10/public 0.2.11 retain source `23f4696` and immutable assets. It fixes
the missing original notice, **not** authenticated acquisition, complete full
license/source/build materials, a DOMPurify license-branch choice or a finding
of legal compatibility/compliance. Historical absence findings below describe
the earlier inspected subset; do not present that specific omission as current.

## TinyMCE

**Subsequent local contributor selection:** exact allowlist staging now includes
the same 33 vendored files and original notices, without SPMIDDLE or operational
evidence/runbooks. All declared hashes and the complete inventory are checked;
the contributor candidate auditor includes vendor, documentation, fixtures and
its own rules without exemptions. This is local preparation only, not an
authenticated acquisition, complete license/corresponding-source/build package
or privacy/rights approval. See [contributor selection](CONTRIBUTOR-SELECTION.md).
Administrative 0.2.12 selectively publishes the reviewed conversion delta on
the actual 0.2.10 graph; it does not replace vendor/editor assets or establish
new TinyMCE provenance. Public remains 0.2.11.

- Component: TinyMCE 7.9.1, self-hosted subset in `src/media/vendor/tinymce/`.
- Copyright: (c) 2024, Ephox Corporation DBA Tiny Technologies, Inc., as stated
  in the included [vendor notice](../src/media/vendor/tinymce/license.md).
- License in that notice: GPL-2.0-or-later.
- Upstream: <https://github.com/tinymce/tinymce>.
- Corresponding version reference: <https://github.com/tinymce/tinymce/tree/7.9.1>.

**Distribution check pending:** the current subset contains minified build
artifacts, not a verified complete corresponding source distribution. Before
publishing a release, verify artifact provenance and provide the corresponding
source and build materials through a GPL-compliant distribution mechanism.
An upstream link alone is not treated here as proof of compliance.

### Historical selected offline evidence review — 2026-11-04

The retained local `tinymce-7.9.1.tgz` and its extracted `package/` directory
were inspected read-only under `tmp/<local-package>/`. All **32 files** in
`src/media/vendor/tinymce/`, including `license.md`, have matching SHA-256 bytes
both in the extracted directory and in the corresponding archive entries.
Archive entries were read to memory, not extracted to disk. This establishes
local copy correspondence only: the archive's upstream origin, registry
integrity/signature evidence and authenticated acquisition remain **pending**.
The download claim in `src/administrator/components/com_minijoomla/editor.js` is not independent provenance proof.

The extracted `license.md`, `package.json`, `bower.json` and `composer.json`
consistently declare GPL-2.0-or-later; `package.json` and `composer.json` identify
7.9.1, matching the vendored core header. This agrees with MINIJOOMLA's own
declared license, but is not a finding that all bundled third-party obligations
have been satisfied. The archive contains unminified distribution JS/CSS and
`tinymce.d.ts`, but its inventory does not provide a verified preferred-form
source tree and compilation/installation scripts. Unminified bundles, a version
label and an upstream URL do not establish complete corresponding source.
The GPL v2 source definition and distribution alternatives are in section 3
of [the local license text](licenses/GPL-2.0.txt); the release must select and
actually fulfill an applicable mechanism, not merely name one here.

### Third parties inside the TinyMCE subset

The original extracted package includes `notices.txt`; **that file was absent
from the vendored subset inspected in this historical review**; the subsequent
local copying correction above supersedes that absence. It lists the following components. These are local
notice declarations, not independently authenticated upstream license reviews:

| Component | License declared locally | Evidence in the selected vendor files |
| --- | --- | --- |
| DOMPurify 3.2.4, patched by Tiny | MPL-2.0 OR Apache-2.0 | `tinymce.min.js` header credits Cure53 and other contributors and states that the bundled code was modified. |
| PrismJS 1.25.0 | MIT | `plugins/codesample/plugin.min.js` retains a Prism MIT/Lea Verou comment. The version comes from the original package notice, not that comment. |
| prism-themes 1.9.0 | MIT | The package notice lists prism-themes; `skins/content/default/content.min.css` and `skins/ui/oxide/content.min.css` credit the Dracula theme to Zeno Rocha and its Prism port to Albert Vallverdu. Exact component/version/attribution mapping remains pending. |

No standalone complete DOMPurify, PrismJS or prism-themes license texts were
found in the inspected vendor subset or retained package inventory. Preserve
the existing embedded notices. Before redistributing TinyMCE, reconcile the
original notice list with the actual subset, obtain/verify the applicable
license texts and copyright notices, and include the required materials in
the distribution. Do not replace their copyrights with MINIJOOMLA's or
SPMIDDLE's. The dual DOMPurify declaration is not a choice of license branch
or a compatibility determination for the complete GPL distribution; applicable
terms, modifications/source and compatibility remain **pending**. This review
does not make a legal compliance finding.

## SPMIDDLE (optional integration)

The current workspace imports SPMIDDLE packages from a sibling project. Its
root license is MIT, with copyright (c) 2026 SPMIDDLE contributors. It is not
yet a declared, versioned dependency of a standalone MINIJOOMLA clone.

If its source is included in a MINIJOOMLA release, include that copyright and
the complete MIT license with the copied material. The current staging script
now copies the sibling project's root `LICENSE` byte-for-byte to
`vendor/spmiddle/LICENSE` when the staged graph includes SPMIDDLE sources.
Missing/incomplete MIT notices or junctions stop staging before output is written.
Integration targets also carry MINIJOOMLA's LICENSE/GPL text/third-party notices;
their manifest hashes cover these files. This preserves notices, not a legal
finding that the complete distribution is compliant.

**Local comparison — 2026-11-04:** `../SPMIDDLE/LICENSE` contains the full MIT
permission, inclusion condition and warranty disclaimer; its root
`package.json` declares MIT. The seven inspected `packages/*/package.json`
files identify version 0.1.0 but have no individual `license` field and no
declared dependency/devDependency sections. No separate LICENSE/COPYING/NOTICE
files were found under those package directories. This is limited metadata
evidence, not an audit of every package's code, assets or provenance, nor proof
of a published standalone package or absence of embedded third parties.

**Superseded historical copying finding:** read-only inspection during that
review confirmed that `core` excludes
SPMIDDLE, whereas `all`/`site` copy referenced `packages/*/src` files without
copying the sibling root MIT license. Thus the existing inclusion prerequisite
was then unfulfilled for targets containing SPMIDDLE. Neither the sibling nor
staging code was changed, and no new staging was generated by this review.

**Subsequent coordinator correction:** the copying defect above is fixed locally
in `scripts/stage-release.js`, with regression checks of exact original bytes,
missing/incomplete/junction gates, deterministic hashes and unchanged loader
closure. New current-source `site`/`all` tests passed with the original MIT and
project notices (54/109 files); **that historical core sample had 48 files** and
never opened the sibling. The later integrated core has 49 files, as stated above.
No tenant deployment, vendor-runtime edit or public redistribution was performed.
Preserving a local license does not verify all package rights/provenance.

## Joomla inspiration and name

Joomla/Atum/Cassiopeia are architectural and visual references. MINIJOOMLA is
an independent implementation, not an official Joomla distribution or a claim
of endorsement. No trademark rights are granted by MINIJOOMLA's license.
Any future inclusion of Joomla code/assets requires their original notices
and license review; do not treat inspiration as permission to copy assets.

The inspected comments in `src/administrator/components/com_minijoomla/editor.js` explicitly describe adapting
a Joomla toolbar preset and matching its readmore marker/behavior. Comments
are not proof of authorship, copying extent or upstream license compliance.
Review any actually reused configuration/code separately before making a
blanket claim that no Joomla material was reproduced. No Joomla source/license
comparison or trademark clearance was performed in this selected review.

## Historical selected core candidates and non-bundled font reference — 2026-11-04

Manual reading of `src/administrator/components/com_minijoomla/editor.js`, `src/templates/camap/index.js` and
`src/media/templates/site/camap/css/template.css` distinguishes three different findings, detailed in
[DISTRIBUTION-AUDIT.md](DISTRIBUTION-AUDIT.md):

- The editor's pathname candidate is an abbreviated example in a comment,
  not an import or hardcoded tenant endpoint. Actual editor assets and upload
  handling are injected; this does not validate any host's authentication,
  authorization or the provenance of those assets.
- CAMAP's JavaScript candidate **in that historical inspection** was a
  corporate-context default title consumed
  by runtime rendering, not a pathname/import or a credential. Its naming and
  disclosure/rights decision was unresolved in that review; the later selected
  source has been neutralized, without certifying broader rights. No literal is
  reproduced here.
- CAMAP's CSS candidate **in that historical inspection** was a corporate
  font-family name. That inspected CSS contained no `@font-face`, `@import` or
  `url()` that bundled or downloaded the font; it was a host-installed-font
  preference with fallbacks. This is not
  permission to distribute that font or a finding about its licensing. The
  reference was neutralized later in the selected source; broader font/theme
  rights are not certified by removing a reference.

No corporate candidate values, tenant URLs or identifiers are copied into
these notices. That review did not change source/artifacts or the three-candidate
sample. Later neutralization `51a1b2a` and the new zero-candidate 49-file core
audit are distinct subsequent results stated above; the old sample is unchanged.
This offline review does not certify privacy, rights, repository history,
complete third-party source, host authentication or public release readiness.

## XML parser - 2026-11-05

The optional Joomla XML discovery profile includes the unmodified browser ES
module from `@rgrove/parse-xml` 5.0.0 (ISC License, Ryan Grove). It is used
identically in Node and the browser, without a CDN or custom entity resolver.
The original license and npm package integrity are retained beside the module
in `src/libraries/vendor/parse-xml/`. See the upstream
[source](https://github.com/rgrove/parse-xml).
This inclusion is not a public-distribution or security certification.

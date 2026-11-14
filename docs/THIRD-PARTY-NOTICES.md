# Third-party notices

## Scope and distribution gates

Original MINIJOOMLA code is **GPL-2.0-or-later**, selected by the project owner
on 2026-11-03. See [LICENSE.md](../LICENSE.md) and the
[full GPL version 2 text](licenses/GPL-2.0.txt). This selection does not replace
third-party notices, grant trademark rights or settle rights over private artifacts.

These notices distinguish technical copy/staging checks from authenticated
provenance and rights clearance. Historical deployment and test counts are not
current release certification. Current implementation and acceptance limits are
in [ESTADO.md](ESTADO.md); source/rebuild evidence and rights gates are in
[PROVENIENCIA.md](PROVENIENCIA.md).

- `core` omits the TinyMCE runtime and SPMIDDLE. It selects public runtime and
  injectable administration sources, not a complete rich-editor contributor
  distribution. `site` and `all` remain integration targets.
- Current staging preserves the original SPMIDDLE MIT license when its sources
  are included, and the TinyMCE notices when TinyMCE is selected. Earlier findings
  of those two copying omissions are superseded; package provenance, full license
  materials and corresponding source/build obligations are not thereby settled.
- Selected-source neutralization (`51a1b2a`) and a subsequent zero-candidate,
  hash-verified core audit closed only the selected-manifest technical gate.
  `publicDistributionApproved`, `rightsReviewed` and `privacyCertified` remained
  **false**. The unresolved tracked-temporary/history privacy finding must not
  be presented as cleared by a staging audit; its historical file count is not a
  current inventory.
- Contributor staging checks the exact allowlist, complete inventory and hashes,
  including vendor/docs/fixtures and its audit rules without exemptions. It is
  not authenticated acquisition, full corresponding source or privacy/rights
  approval. See [contributor selection](DESENVOLVIMENTO.md#staging-contributor)
  and [manifest-only audit limits](DESENVOLVIMENTO.md#auditoria-manifest-only).
- Source fixes, successful host deployment, ETags unchanged during read-only
  checks and tests with doubles are distinct evidence. They do not establish
  license compliance, upload/authorization safety, assistive accessibility or
  the version currently active on a host. In particular, historical corporate
  releases retain old assets until explicitly updated; see the actionable
  [sanitizer advisory](SECURITY.md#correção-do-sanitizador--05112026).

A contract regression caused a selective administrative rollback while preserving
public assets and saved data. The reusable cause and rebaseline requirements are
in [adapter contracts](CONTRATOS.md#minijoomla--contrato-v1-congelado-dos-adapters-de-conteúdo).
Source-notice correction `11afbe4` was local staging work, not a host publication;
immutable published assets must never be assumed updated by a source commit.

## Joomla Blog Sample Data

`src/plugins/sampledata/blog/data.js` is generated from Joomla sampledata Blog
PHP/INI at revision `52559589cb6a02c9e2fc48270f92b3aff7b8b7a0`.
Source text: GPL-2.0-or-later, (C) 2017 Open Source Matters, Inc.
`scripts/generate-joomla-sampledata.js` retains original text, translating only
supported paths/relationships into the MINIJOOMLA JavaScript profile.

The JPEG subset in `src/media/sampledata/joomla-blog/` preserves original bytes;
NASA captions from the sample data are retained. Byte correspondence to the local
Joomla checkout is not universal media-rights or authenticated acquisition
certification. See [implementation and limits](INSTALACAO.md#sample-data-joomla).
No PHP plugin is executed.

## TinyMCE and embedded third parties

- Component: **TinyMCE 7.9.1**, self-hosted subset in `src/media/vendor/tinymce/`.
- Copyright: (c) 2024, Ephox Corporation DBA Tiny Technologies, Inc., as stated
  in the included [vendor license](../src/media/vendor/tinymce/license.md).
- License declared by that notice: **GPL-2.0-or-later**.
- Upstream: <https://github.com/tinymce/tinymce>;
  [version reference](https://github.com/tinymce/tinymce/tree/7.9.1).

### Local correspondence and preservation

A selected read-only offline review compared the retained `tinymce-7.9.1.tgz`
and its extracted `package/` with the 32 original vendor files, including
`license.md`: SHA-256 matched both extracted files and archive entries.
The archive entries were read to memory rather than extracted by that review.
This proves local copy correspondence only; upstream origin, registry integrity,
signature and authenticated acquisition evidence remain **pending**. A download
claim in an editor comment is not independent provenance proof.

The original [notices.txt](../src/media/vendor/tinymce/notices.txt), absent from
that historical 32-file subset, was subsequently copied byte-for-byte:
**471 bytes**, SHA-256
`998c28e80bb7ffcd8c0b96d6f1bc2be79742929281b8259750613dac7376281e`.
The resulting 33-file subset preserves the previous vendor bytes. Git attributes
disable vendor newline transformation; the portable `tinymce-notices.test.js`
pins the notice and prior baseline without requiring the retained archive.

`all` requires/copies and hashes the notice; `site`/`core` exclude TinyMCE and
therefore do not copy its notices without its code. Contributor staging includes
the selected 33 vendor files and original notices. `notices.txt` is an explicit
additional basename, not permission to include arbitrary text/config files.

### Corresponding source and license materials still required

The retained `license.md`, `package.json`, `bower.json` and `composer.json`
declare GPL-2.0-or-later; the package/composer metadata identify 7.9.1, matching
core headers. This is metadata evidence, not fulfillment of all bundled
obligations. The selected runtime contains minified artifacts; unminified
JS/CSS and `tinymce.d.ts` in the retained archive do not establish a verified
complete preferred-form source tree with compilation/installation scripts.

Before redistribution, verify provenance and actually fulfill an applicable
GPL corresponding-source distribution mechanism. Naming an upstream URL or a
version alone is insufficient; see section 3 of the
[local GPL text](licenses/GPL-2.0.txt).

The original TinyMCE package notice declares these embedded components:

| Component | License declared locally | Evidence and limits |
| --- | --- | --- |
| DOMPurify 3.2.4, patched by Tiny | MPL-2.0 OR Apache-2.0 | `tinymce.min.js` credits Cure53/other contributors and states that bundled code was modified. The dual declaration is not a selected license branch or compatibility determination. |
| PrismJS 1.25.0 | MIT | `plugins/codesample/plugin.min.js` retains Prism MIT/Lea Verou attribution; the version comes from the package notice, not that comment. |
| prism-themes 1.9.0 | MIT | The package notice lists prism-themes. `skins/content/default/content.min.css` and `skins/ui/oxide/content.min.css` credit Dracula to Zeno Rocha and the Prism port to Albert Vallverdu; exact component/version mapping remains pending. |

These are local notice declarations, not independently authenticated license
reviews. Complete standalone DOMPurify, PrismJS and prism-themes license texts
were not found in the inspected subset or retained inventory. Preserve embedded
notices; reconcile the notice list with the actual selected code and obtain/
verify applicable full licenses, copyrights, modifications and source materials.
Do not replace those copyrights with MINIJOOMLA's or SPMIDDLE's. License branch,
embedded-license compatibility and complete legal compliance remain **pending**.

## SPMIDDLE — optional integration

The workspace imports packages from the sibling SPMIDDLE project. Its root
license is **MIT**, copyright (c) 2026 SPMIDDLE contributors. It is not yet a
declared, versioned standalone MINIJOOMLA dependency.

When SPMIDDLE source is selected, `scripts/stage-release.js` copies the complete
sibling `LICENSE` byte-for-byte to `libraries/vendor/spmiddle/LICENSE` in staging;
release manifests name that exact destination when the graph includes it. Missing/incomplete MIT text or
junctions stop staging before output; manifest hashes cover licenses/notices.
The correction tests exact bytes, missing/incomplete/junction gates and
unchanged loader closure. `core` does not open/include the sibling.

The selected local metadata review found a complete root MIT license and MIT
in root `package.json`. Seven inspected `packages/*/package.json` files declared
0.1.0, without individual `license` or dependency/devDependency sections; no
separate LICENSE/COPYING/NOTICE was found under those package directories.
This is historical limited metadata, not a current package inventory, full
embedded-third-party audit or evidence of standalone publication.

Include the original copyright and full MIT text with copied material. Local
notice preservation does not establish provenance or complete distribution
compliance; every embedded dependency/asset still needs its applicable review.

## Joomla inspiration, reused material, marks and fonts

Joomla, Atum and Cassiopeia are architectural/visual references. MINIJOOMLA is
independent, not an official distribution or an endorsement. Its license grants
no trademark rights. Inclusion of Joomla code/assets requires their original
notices and license review; inspiration is not permission to copy assets.

The editor comments describe adaptation of a Joomla toolbar preset and matching
its readmore marker/behavior. They do not prove authorship, extent of copying or
upstream compliance. Review actual reused code/configuration before claiming
that no Joomla material was reproduced. The selected review did not compare
all Joomla source/licenses or clear trademarks.

Three historical selected-core candidates had different implications: an
editor pathname example in a comment (not a tenant endpoint/import), a CAMAP
runtime corporate-title default, and a CAMAP font-family preference with
fallbacks. That CSS contained no `@font-face`, `@import` or `url()` bundling/
downloading the font. Removing/neutralizing selected references neither clears
broader rights nor authorizes distribution of fonts/themes. No corporate
candidate values, tenant URLs or identifiers are reproduced here.

Injected assets/uploads and neutralized strings do not prove host authentication,
authorization, privacy, repository-history clearance or public release readiness.
See [security boundaries](SECURITY.md) and [distribution limits](DESENVOLVIMENTO.md#limites).

## XML parser

The optional Joomla XML discovery profile includes the **unmodified** browser
ES module from **@rgrove/parse-xml 5.0.0**, ISC License, Ryan Grove. It is used
identically in Node and the browser, without CDN or a custom entity resolver.
The original license and npm package integrity are retained beside the module
in `src/libraries/vendor/parse-xml/`. See the
[upstream source](https://github.com/rgrove/parse-xml).
This inclusion is not a public-distribution or security certification.

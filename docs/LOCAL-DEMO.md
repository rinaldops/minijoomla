# Local standalone examples

The local examples use MINIJOOMLA-owned source and demo repositories. The name
`createSPMiddleAdapter` describes its repository contract: that module does not
import the optional sibling SPMIDDLE checkout. Neither demo provisions a tenant
or needs corporate feeds, credentials, installation or an external CDN.

## Offline Node contract check

From the project root, using Node 20 or newer:

```sh
node scripts/test-standalone-examples.js
```

This command creates a unique source-only checkout under `tmp/`, without any
sibling or minified vendor tree, then removes only its own fixture. It retains
the original MINIJOOMLA LICENSE, GPL text and third-party notices unchanged.
Node's experimental VM module flag is enabled only for the isolated child.
No package installation, HTTP request or browser is used.

Eight deterministic contract groups execute the **unchanged inline module**
from both `examples/index.html` and `examples/admin.html`, resolving actual
owned source modules in an isolated Node context. They check public/admin
bootstrap and routes, real service writes in memory, shared demo storage/reload,
ETag conflicts, local dynamic plugin activation/deactivation, catalog-selected
template preview, template/CSS declarations and negative controls for missing/
sibling/external imports and unavailable/corrupt storage. The clock is fixed
for schedule determinism.

Template previews resolve configuration with the requested `templateKey` before
starting the renderer. The query accepts the three builtins **or** any enabled
key already present in the local catalog (an "installed" template record in
demo storage); an unknown or disabled key is rejected with the same safe error.
Each selects its own saved home style (not another
template's parameters), or its declared defaults when no style exists. The
`default` preview retains the existing Cassiopeia renderer alias and its own
default-key parameter contract. Global site settings and component options are
retained; the query never saves the selected template, creates/edits a catalog
record or changes the stored configuration, style titles/parameters, content or
ETags. Without a template query, reload still uses the saved template and its
saved home style. See the [template preview contract](TEMPLATE-INSTALL-CONTRACT.md#preview-local-seleção-por-catálogo).
The check requires empty diagnostics for all three previews, both with initial
defaults and with saved Cassiopeia/CAMAP configurations. Any warning or error
fails, with no allowed-warning exception. Preview/style selection is not visual
approval.

The document/storage contracts are deliberately minimal: generated HTML strings,
declared styles and router events are inspected, not a parsed browser DOM.
No real form submission, TinyMCE initialization, media upload, keyboard/zoom,
screen-reader, visual acceptance or SharePoint integration is claimed. Passing
this command is **not** complete contributor/distribution or legal acceptance.
The source fixture is not a release artifact and intentionally omits TinyMCE's
minified subset; review [third-party obligations](THIRD-PARTY-NOTICES.md) before
redistribution. Integration targets must retain their original MIT notices.

This core/local suite also runs through `node tests/run-tests.js`. Only the
explicitly marked SPMIDDLE integrations are skipped when the sibling is absent;
a broken present sibling or failing core/example import must still fail.

## Safe static preview

For a full existing source checkout (including the locally retained editor
resources if testing rich text), start the read-only server:

```sh
node scripts/serve-local.js
# Optional: node scripts/serve-local.js --port 8081
```

It binds to **127.0.0.1 only**, defaults to port 8080, and stops with Ctrl+C.
It serves selected HTML/JS/CSS/image/font types in `src/`, `examples/` and
`tests/` for the local test pages. It does not serve `tmp/`, docs, Git files,
profiles, credential/private directories, arbitrary JSON, traversal paths or
symlinks/junctions. Responses use explicit MIME, `nosniff` and `no-store`;
methods other than GET/HEAD are rejected. Do not expose it through a proxy or
use it as a production server. Do not add sensitive material to served trees.

- Public: `http://127.0.0.1:8080/examples/index.html`
- Admin: `http://127.0.0.1:8080/examples/admin.html`
- Template preview: add `?template=default`, `?template=cassiopeia` or
  `?template=camap` before a hash route.
- Public route example: `/examples/index.html#/article/boas-vindas`.
- Admin route example: `/examples/admin.html#/articles/1`.

Public/admin share the browser origin's demo storage key `minijoomla-demo-v1`.
Reload the public page after editing locally; a different port is a different
storage origin. Use synthetic content only. To reset **only** the demo dataset,
remove that key in the local origin's storage, not the entire browser profile.
Unavailable/corrupt storage produces a visible bootstrap error.

### Explicit local package mounts

A trusted package can be previewed without copying it into the project:

```sh
node scripts/serve-local.js --port 8081 --extra-root "packages/probe=../package-dedicated-directory"
```

This opt-in mounts that directory at `/packages/probe/`. Repeat the flag for
different IDs, up to ten. Prefixes are canonical lowercase `packages/<id>`;
duplicates, subprefixes, reserved IDs and source-route shadowing are refused.
Source/private root aliases and duplicate or overlapping physical roots are
rejected. Generated dedicated packages below
`tmp/` are allowed, but `tmp/` itself is never a mount. Private/dot-named roots
or ancestors are denied (except an ancestor `tmp` used for generated fixtures).
These additional gates were added after review reproduced an alias exposing
project scripts and reserved IDs that created unreachable mounts. Corrected
version passed both local native and readonly SharePoint proof retests.

CLI paths are resolved locally; the API `extraRoots` requires absolute directories.
Roots and their ancestors cannot be symlinks/junctions; request-time checks cover descendants
too. GET/HEAD, MIME, `no-store`, `nosniff`, private-path/traversal/ADS restrictions
also apply to mounts. Invalid configuration fails before listening. Decimal port
syntax and the default no-mount behavior are retained.

Only mount a **dedicated public-asset directory you trust**. This is not a sandbox,
a remote package installer, an inventory-signature verifier, a race-resistant
filesystem boundary or permission to expose credentials elsewhere in a package.
Imported JavaScript runs with the preview origin's privileges. Nothing registers
or activates an extension/template, changes demo seeds or selects its default.
The public demo's template query now also accepts an enabled installed catalog
key, as documented above; a separately mounted `--extra-root` package is not
automatically added to that catalog. No server mount exists
in SharePoint: production assets use their explicit immutable published paths.

Validation of this server increment: real loopback HTTP including raw encoded
negatives and mount/API/CLI checks; native local FIORI-AUTO import/CSS/image,
Enter and 320/768/1366 reflow with unchanged demo storage. The same small synthetic
asset closure was uploaded to a new immutable SharePoint proof and mounted only
in a disposable iframe. Relative imports/CSS/image passed and the iframe was
removed; 48 records/ETags, both page records and active host 0.16.1 remained
unchanged. That proof validates asset portability, **not production mounts or
installed-template selection**. No tenant provisioning/settings/editor writes.

One integrated run completed with 122 passes. A concurrently running repetition
reached the external 900-second tool timeout before its final summary; that
incomplete run is not a pass. Final sequential validation completed with
**122 passed, 0 skipped, 0 failed**, using a larger external execution budget
without relaxing assertions, hashes or skips. Syntax: 358 JS/MJS (parse only).
Contributor: 456 exact paths with deterministic inventory/hash/containment gates.
The seven standalone example contract groups also passed separately.

In the corporate workspace, all browser opening/inspection/automation, including
these loopback pages, must use FIORI-AUTO and a session-owned instance/profile.
The coordinator owns the browser validation for this task. The separate
`test:admin-layout` command and [its documentation](ADMIN-LAYOUT-TESTS.md)
cover native synthetic admin layout/keyboard checks, not complete standalone
example or rich-editor acceptance. Do not use Playwright/Selenium/direct CDP
as a substitute. This Node change launches no browser and publishes nothing.

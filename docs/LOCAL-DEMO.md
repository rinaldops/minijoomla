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

Seven deterministic contract groups execute the **unchanged inline module**
from both `examples/index.html` and `examples/admin.html`, resolving actual
owned source modules in an isolated Node context. They check public/admin
bootstrap and routes, real service writes in memory, shared demo storage/reload,
ETag conflicts, local dynamic plugin activation/deactivation, template/CSS
declarations and negative controls for missing/sibling/external imports and
unavailable/corrupt storage. The clock is fixed for schedule determinism.

Template previews resolve configuration with the requested `templateKey` before
starting the renderer. Each selects its own saved home style (not another
template's parameters), or its declared defaults when no style exists. The
`default` preview retains the existing Cassiopeia renderer alias and its own
default-key parameter contract. Global site settings and component options are
retained; the query never saves the selected template or changes the stored
configuration, style titles/parameters, content or ETags. Without a template
query, reload still uses the saved template and its saved home style.
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

In the corporate workspace, all browser opening/inspection/automation, including
these loopback pages, must use FIORI-AUTO and a session-owned instance/profile.
The coordinator owns the browser validation for this task. The separate
`test:admin-layout` command and [its documentation](ADMIN-LAYOUT-TESTS.md)
cover native synthetic admin layout/keyboard checks, not complete standalone
example or rich-editor acceptance. Do not use Playwright/Selenium/direct CDP
as a substitute. This Node change launches no browser and publishes nothing.

# Storybook threat model (condensed copy)

This file is a public-safe projection of the maintainers' threat model, which is a living document outside this repository. It lists surfaces, the controls that protect them, the flags that weaken those controls, the tests that pin them, and the published advisories. It never lists open leads, unfixed weaknesses, or accepted risks. The audit reads this file first and reports where the code and this file disagree (see "Delta procedure").

Sync status: condensed from the code at the date of the last commit touching this file. The authoritative version lives in the maintainers' Notion workspace.

## Principals

Lower-trust actors whose input Storybook accepts. A finding names exactly one of these as the actor of each escalation step.

1. **Website visited by the developer** while `storybook dev` runs. Reaches the dev server through the browser: navigation, iframes, `postMessage`, cross-site requests, WebSocket upgrades.
2. **Peer on the developer's local network.** Reaches the dev server by IP when it is bound beyond loopback, or through DNS rebinding and Host header tricks.
3. **Visitor of a built, deployed Storybook**, including one who crafts a URL (`?args=`, `?globals=`, `?path=`) for another visitor.
4. **Composed remote Storybook** declared in `refs`: its `index.json`, `metadata.json`, and preview iframe run in the composing manager.
5. **Fork PR author** against CI, canary, and release workflows.
6. **Package registry, template source, or sandbox repository** the CLI fetches from and executes.
7. **MCP client or agent** driving the tools surface on untrusted content.

## Non-boundaries

Behaviour that is intended authority, not a privilege escalation. A candidate whose only actor is one of these is not a finding.

- Story files, `.storybook/main.*`, `preview.*`, `manager.*`, `middleware.js`, presets, and addons execute arbitrary code in Node and the browser by design. Their authors are the developer.
- The developer's own browser acting on the developer's own dev server, through the manager UI the developer operates.
- Hosting configuration of a built Storybook: headers, CSP, authentication in front of it. Those belong to the deployer.
- `--host`, `core.allowedHosts: true`, `security.insecureIframeMessaging`, and `security.insecureRemoteIframeEmbed` when the user set them. A finding may show that a flag has wider effect than its documentation states.
- A dependency advisory without a path that Storybook exercises. SECURITY.md states this policy.
- Telemetry contents the documentation already lists as collected.

## Surfaces

Each surface has an id used by the attack classes and by findings.

### `dev-server.http`

The `storybook dev` HTTP server: `code/core/src/core-server/dev-server.ts` builds a polka app on the server from `code/core/src/core-server/utils/server-init.ts`.

- Bind address: `code/core/src/core-server/utils/server-address.ts`. Default `127.0.0.1`; `--host` adds an interface and keeps a loopback listener.
- Host validation: `code/core/src/core-server/utils/getHostValidationMiddleware.ts` (`isValidHost`): loopback names always pass, IPs must be local interfaces or listed, hostnames must be in `core.allowedHosts` or equal `--host`. `core.allowedHosts: true` or `--host 0.0.0.0` with no allowlist disables it; `code/core/src/core-server/utils/host-validation-warning.ts` warns and asks for confirmation. Validation is skipped inside WebContainers.
- Embedding: `code/core/src/core-server/utils/getSecurityHeadersMiddleware.ts` sets `Content-Security-Policy: frame-ancestors` to self and loopback. `security.insecureRemoteIframeEmbed` removes it. Built output has no such header.
- Routes: `/index.json` (`code/core/src/core-server/utils/index-json.ts`), `/project.json` (`code/core/src/core-server/utils/metadata.ts`), `/manifests/*` behind `features.componentsManifest` (`code/core/src/core-server/utils/manifests/manifests.ts`), static dirs through `sirv` (`code/core/src/core-server/utils/server-statics.ts`), manager assets (`code/core/src/builder-manager/index.ts`), user middleware (`code/core/src/core-server/utils/middleware.ts`), addon routes through the `experimental_devServer` preset hook.
- Preview builders: `code/builders/builder-vite/src/vite-server.ts` (middleware mode, `fs.strict`, `allowedHosts` passthrough) and `code/builders/builder-webpack5/src/index.ts`.
- Tests: `code/core/src/core-server/utils/__tests__/getHostValidationMiddleware.test.ts`, `code/core/src/core-server/utils/__tests__/host-validation-warning.test.ts`, `code/core/src/core-server/utils/__tests__/getSecurityHeadersMiddleware.test.ts`, `code/core/src/core-server/utils/server-address.test.ts`, `code/core/src/core-server/utils/server-address.listen.test.ts`, `code/core/src/core-server/utils/__tests__/server-statics.test.ts`.

### `dev-server.ws-channel`

The WebSocket server channel at `/storybook-server-channel`: `code/core/src/core-server/utils/get-server-channel.ts`, transport in `code/core/src/channels/websocket/index.ts`.

- Origin: an upgrade carrying an `Origin` header must pass `isValidHost`.
- Token: every upgrade carries `?token=`, a per-process `randomUUID` from `code/core/src/core-server/presets/wsToken.ts`, compared in constant time by `code/core/src/core-server/utils/validate-token.ts`. The token is inlined into the manager and preview HTML as channel options (`code/core/src/builder-manager/utils/framework.ts`, `code/builders/builder-vite/src/transform-iframe-html.ts`, `code/builders/builder-webpack5/src/preview/iframe-webpack.config.ts`).
- Sender role: `?page=manager|preview` declares the client; a client with neither page nor `Origin` is the `server` role used by the tools SDK. `code/core/src/core-server/utils/event-senders.ts` (`CORE_EVENT_SENDERS`) drops a core event whose declared sender does not match. Events outside that table are not filtered by sender.
- Payloads are decoded with `telejson`.
- Tests: `code/core/src/core-server/utils/__tests__/server-channel.test.ts`, `code/core/src/core-server/utils/__tests__/validate-token.test.ts`.

### `dev-server.channel-handlers`

Server-side handlers that act on channel events. Registered in `code/core/src/core-server/presets/common-preset.ts` (`experimental_serverChannel`). Each is a separate step target because each decides its own validation.

| Handler | File | Effect |
| --- | --- | --- |
| Save story from controls | `code/core/src/core-server/utils/save-story/save-story.ts` | rewrites a CSF file; rejects paths outside the project and names that are not identifiers; writes only serialised args and story names |
| Open in editor | `code/core/src/core-server/server-channel/open-in-editor-channel.ts` | launches the user's editor on a file path |
| What's New | `code/core/src/core-server/utils/whats-new.ts` | fetches the Storybook website; rewrites `.storybook/main.*`; merges browser data into the project cache |
| Checklist state | `code/core/src/core-server/utils/checklist.ts` | persists UniversalStore state to the global settings file and the project cache |
| Ghost stories | `code/core/src/core-server/server-channel/ghost-stories-channel.ts` | can run `vitest` as a child process (`code/core/src/core-server/utils/ghost-stories/run-story-tests.ts`) |
| Telemetry and AI setup | `code/core/src/core-server/server-channel/telemetry-channel.ts`, `code/core/src/core-server/server-channel/ai-setup-channel.ts` | forward browser events to telemetry |
| Vitest test run | `code/addons/vitest/src/node/test-run-responder.ts` | triggers a Vitest run with the given story ids and config |

- Tests: `code/core/src/core-server/utils/save-story/save-story.security.test.ts`, `code/core/src/core-server/utils/save-story/save-story.test.ts`.

### `dev-server.tools-and-mcp`

Agent-facing access to a running instance.

- Instance registry: `code/core/src/core-server/utils/runtime-instance-registry.ts` writes one record per instance, including the channel token, under the user's state directory with owner-only permissions. `storybook tools` attaches through it (`code/core/src/cli/tools/sdk/attached-runtime.ts`, `code/core/src/cli/tools/sdk/node-channel.ts`).
- Open services and toolsets: `code/core/src/shared/open-service/`, registered from the `services` preset hook.
- MCP addon: `code/addons/mcp/src/preset.ts` adds `/mcp` and `/.well-known/oauth-protected-resource`. An `Origin` header, when present, must pass `isValidHost`; POST bodies must be `application/json`; bearer auth is required only for composed refs (`code/addons/mcp/src/auth/`). Tools live in `code/addons/mcp/src/tools/`.
- Tests: `code/core/src/core-server/utils/runtime-instance-registry.test.ts`, `code/core/src/core-server/utils/runtime-instance-registry.memfs.test.ts`, `code/e2e-internal/tools-attach.spec.ts`, `code/addons/mcp/src/preset.test.ts`, `code/addons/mcp/src/auth/composition-auth.test.ts`.

### `browser.postmessage`

Manager and preview messaging: `code/core/src/channels/postmessage/index.ts`.

- In dev, a preview accepts messages only from its own origin or a loopback host, the manager accepts only from iframes marked `data-is-storybook` matched by `event.source`, and both pin the target origin. A built preview accepts any origin and sends to `*`. `security.insecureIframeMessaging` disables all checks. The `SecurityConfig` type is in `code/core/src/types/modules/core-common.ts`.
- Events arriving in the manager are dispatched by `code/core/src/manager-api/`; `NAVIGATE_URL` reaches `code/core/src/manager-api/modules/url.ts`.
- Highlight: `code/core/src/highlight/` accepts a constrained menu payload after the October 2026 rework.
- Tests: `code/core/src/channels/postmessage/index.test.ts`, `code/e2e-internal/iframe-messaging.spec.ts`.

### `browser.refs`

Composition of remote Storybooks: `code/core/src/manager-api/modules/refs.ts` fetches `index.json`, `stories.json`, and `metadata.json`, sends credentials unless the ref is public, converts `user:pass@` into a Basic header, and loads the remote preview in an iframe. Refs come from `code/core/src/core-server/utils/get-refs-from-config.ts`. The MCP addon resolves composed sources in `code/addons/mcp/src/auth/resolve-composition-sources.ts`.

- Tests: `code/core/src/manager-api/tests/refs.test.ts`.

### `browser.rendering`

Places where strings become markup or script in the manager, preview, or docs.

- `code/core/src/manager/components/sidebar/Brand.tsx` renders the theme's brand title as raw HTML when no brand image is set.
- `code/core/src/preview-api/modules/preview-web/WebView.ts` and `code/core/src/component-testing/components/` render errors through `ansi-to-html` with XML escaping.
- `code/renderers/html/src/render.ts`, `code/renderers/web-components/src/render.ts`, `code/renderers/web-components/src/bind-args.ts`, and `code/renderers/server/src/render.ts` assign story output to `innerHTML` by design; the server renderer fetches it from `parameters.server.url` with args as query parameters.
- `code/core/src/preview-api/modules/preview-web/simulate-pageload.ts` re-executes `<script>` tags in rendered content.
- Docs: `markdown-to-jsx` in `code/addons/docs/src/blocks/blocks/Markdown.tsx`, `code/addons/docs/src/blocks/components/ArgsTable/ArgRow.tsx`, `code/addons/docs/src/blocks/components/ArgsTable/ArgJsDoc.tsx`; `react-syntax-highlighter` in `code/core/src/components/components/syntaxhighlighter/syntaxhighlighter.tsx`.
- URL args and globals: `code/core/src/preview-api/modules/preview-web/parseArgsParam.ts`, kept in step with `code/core/src/router/utils.ts`.
- Tests: `code/core/src/preview-api/modules/preview-web/parseArgsParam.test.ts`.

### `build.static-output`

`storybook build`: `code/core/src/core-server/build-static.ts` writes `index.json`, `project.json`, manifests, service snapshots, and copies `staticDirs` (`code/core/src/core-server/utils/copy-all-static-files.ts`).

- Environment: `code/core/src/common/utils/envs.ts` loads `.env` and exposes only `STORYBOOK_*` variables to the client. `managerHead` in `code/core/src/core-server/presets/common-preset.ts` interpolates `STORYBOOK_*` variables into `manager-head.html`.
- Tests: `code/core/src/builder-manager/utils/files.test.ts` (`sanitizePath`).

### `cli.config-loading`

`code/core/src/common/utils/load-main-config.ts` and `code/core/src/common/presets.ts` import `main.*`, presets, and addons in Node with a loader hook from `code/core/src/bin/loader.ts`. This is intended code execution by the developer; the surface matters for what is resolved from where (`resolveAddonName`, `safeResolveModule`).

### `cli.package-manager`

`code/core/src/common/js-package-manager/` wraps `execa` through `code/core/src/common/utils/command.ts`; `shell: true` is a per-call choice. Version resolution in `JsPackageManager.getVersion()` queries the registry and falls back to `code/core/src/common/versions.ts`. The dispatcher `code/core/src/bin/dispatcher.ts` runs a matching local `@storybook/cli`, else `npx`/`dlx`, and takes a pkg.pr.new specifier from process ancestry (`code/core/src/common/utils/get-storybook-version-specifier-from-ancestry.ts`).

### `cli.project-mutation`

Commands that write into the user's project or run project code.

- `code/lib/create-storybook/src/scaffold-new-project.ts` runs shell strings for `npm create vite`, `create-next-app`, and the Angular CLI. Generators write `.storybook/` and example stories.
- `code/lib/cli-storybook/src/postinstallAddon.ts` resolves and executes an addon's `postinstall` export.
- `code/lib/cli-storybook/src/sandbox.ts` fetches a sandbox repository with `gitpick`; `code/lib/cli-storybook/src/link.ts` clones and links a repository.
- Automigrations in `code/lib/cli-storybook/src/automigrate/fixes/` rewrite config and story files through `csf-tools`.
- `code/core/src/cli/agentInstructions.ts` and `code/core/src/cli/installSkills.ts` write agent instruction files; `code/core/src/cli/globalSettings.ts` writes user settings.

### `telemetry`

`code/core/src/telemetry/telemetry.ts` posts to the Storybook event log. Payload metadata is built in `code/core/src/telemetry/storybook-metadata.ts`; the anonymous id is a one-way hash of the git remote and project path (`code/core/src/telemetry/anonymous-id.ts`); crash reports are scrubbed by `code/core/src/telemetry/sanitize.ts`. Disabled by `--disable-telemetry`, `STORYBOOK_DISABLE_TELEMETRY`, or `core.disableTelemetry` (`code/core/src/core-server/withTelemetry.ts`). Documented in `docs/configure/telemetry.mdx`.

- Tests: `code/core/src/telemetry/sanitize.test.ts`, `code/core/src/telemetry/anonymous-id.test.ts`.

### `ci.workflows`

- `pull_request_target` workflows that never check out fork code: `.github/workflows/agent-scan.yml`, `.github/workflows/danger-js.yml`, `.github/workflows/trigger-circle-ci-workflow.yml` (gates shared caches on org membership).
- Canaries: `.github/workflows/publish-canary.yml` publishes on push to `next`, on same-repo PRs labelled `ci:canary`, or on maintainer dispatch, which may build a fork PR.
- Claude workflows: `.github/workflows/claude.yml` (owners and members only, read permissions), `.github/workflows/claude-code-review.yml` (label-gated), `.github/workflows/agent-eval.yml` (non-fork, label-gated, holds provider secrets).
- Linting: `.github/workflows/zizmor.yml`. Actions are SHA-pinned.

### `release.publish`

`.github/workflows/publish.yml` under the `Release` environment runs `scripts/release/publish.ts` with provenance. Yarn settings in `.yarnrc.yml`: scripts enabled, a seven-day minimum package age, single root `yarn.lock`. `scripts/release/sync-skills.ts` publishes `code/lib/claude-plugin/skills` to the skills repository.

## Path map

Blast radius drives effort in `pr` mode. The first matching prefix wins; the maximum across changed files is the PR's blast radius.

| Path prefix | Surface | Blast radius |
| --- | --- | --- |
| `code/core/src/core-server/utils/save-story/` | `dev-server.channel-handlers` | high |
| `code/core/src/core-server/server-channel/` | `dev-server.channel-handlers` | high |
| `code/core/src/core-server/utils/get-server-channel.ts` | `dev-server.ws-channel` | high |
| `code/core/src/core-server/utils/event-senders.ts` | `dev-server.ws-channel` | high |
| `code/core/src/core-server/utils/validate-token.ts` | `dev-server.ws-channel` | high |
| `code/core/src/core-server/presets/wsToken.ts` | `dev-server.ws-channel` | high |
| `code/core/src/channels/` | `browser.postmessage` | high |
| `code/core/src/core-server/utils/getHostValidationMiddleware.ts` | `dev-server.http` | high |
| `code/core/src/core-server/utils/getSecurityHeadersMiddleware.ts` | `dev-server.http` | high |
| `code/core/src/core-server/utils/server-address.ts` | `dev-server.http` | high |
| `code/core/src/core-server/utils/runtime-instance-registry.ts` | `dev-server.tools-and-mcp` | high |
| `code/core/src/core-server/utils/manifests/` | `dev-server.http` | medium |
| `code/core/src/core-server/presets/common-preset.ts` | `dev-server.channel-handlers` | high |
| `code/core/src/core-server/` | `dev-server.http` | medium |
| `code/core/src/core-events/` | `dev-server.ws-channel` | high |
| `code/core/src/manager-api/modules/refs.ts` | `browser.refs` | high |
| `code/core/src/core-server/utils/get-refs-from-config.ts` | `browser.refs` | medium |
| `code/core/src/highlight/` | `browser.postmessage` | high |
| `code/core/src/manager-api/` | `browser.postmessage` | medium |
| `code/core/src/manager/components/sidebar/Brand.tsx` | `browser.rendering` | medium |
| `code/core/src/preview-api/modules/preview-web/parseArgsParam.ts` | `browser.rendering` | high |
| `code/core/src/router/utils.ts` | `browser.rendering` | high |
| `code/core/src/preview-api/` | `browser.rendering` | medium |
| `code/addons/docs/src/blocks/` | `browser.rendering` | medium |
| `code/core/src/components/components/syntaxhighlighter/` | `browser.rendering` | medium |
| `code/renderers/server/` | `browser.rendering` | medium |
| `code/renderers/` | `browser.rendering` | low |
| `code/core/src/common/utils/envs.ts` | `build.static-output` | high |
| `code/core/src/core-server/build-static.ts` | `build.static-output` | medium |
| `code/builders/` | `dev-server.http` | medium |
| `code/core/src/common/js-package-manager/` | `cli.package-manager` | high |
| `code/core/src/common/utils/command.ts` | `cli.package-manager` | high |
| `code/core/src/bin/` | `cli.package-manager` | high |
| `code/core/src/common/presets.ts` | `cli.config-loading` | medium |
| `code/core/src/common/utils/load-main-config.ts` | `cli.config-loading` | medium |
| `code/lib/create-storybook/` | `cli.project-mutation` | high |
| `code/lib/cli-storybook/src/postinstallAddon.ts` | `cli.project-mutation` | high |
| `code/lib/cli-storybook/src/sandbox.ts` | `cli.project-mutation` | high |
| `code/lib/cli-storybook/src/link.ts` | `cli.project-mutation` | high |
| `code/lib/cli-storybook/src/automigrate/` | `cli.project-mutation` | medium |
| `code/lib/cli-storybook/` | `cli.project-mutation` | medium |
| `code/core/src/cli/` | `cli.project-mutation` | medium |
| `code/core/src/telemetry/` | `telemetry` | medium |
| `code/addons/mcp/` | `dev-server.tools-and-mcp` | high |
| `code/lib/mcp/` | `dev-server.tools-and-mcp` | medium |
| `code/core/src/shared/open-service/` | `dev-server.tools-and-mcp` | high |
| `code/core/src/cli/tools/` | `dev-server.tools-and-mcp` | high |
| `code/addons/vitest/src/node/` | `dev-server.channel-handlers` | high |
| `code/addons/vitest/src/vitest-plugin/` | `dev-server.channel-handlers` | high |
| `code/addons/vitest/` | `dev-server.channel-handlers` | medium |
| `.github/workflows/` | `ci.workflows` | high |
| `.github/scripts/` | `ci.workflows` | high |
| `scripts/release/` | `release.publish` | high |
| `.yarnrc.yml` | `release.publish` | high |
| `code/addons/` | `browser.rendering` | low |
| `code/frameworks/` | `cli.config-loading` | low |
| `docs/` | none | low |
| `code/**/*.stories.*` | none | low |

A diff that adds any of the following raises the blast radius to `high` regardless of path: a new channel event, a new HTTP route or middleware, a child process or shell string, a file write derived from request data, `dangerouslySetInnerHTML` or `innerHTML`, a `fetch` of a URL derived from config or request data, or a workflow trigger.

## Published advisories

Each entry names the chain and the controls it introduced. An audit re-checks that these controls hold and that their escape hatches remain opt-in.

| Advisory | Chain | Controls introduced |
| --- | --- | --- |
| GHSA-8452-54wp-rmv6 (high, December 2025) | `.env` values bundled into built output, exposed when published | only `STORYBOOK_*` variables reach the client (`cli`/`build.static-output`) |
| GHSA-mjf5-7g4m-gx5w (high, February 2026) | website opens a WebSocket to the dev server without Origin check, then save or create story writes a file | WebSocket Origin validation (`dev-server.ws-channel`) |
| GHSA-px85-f4q5-jh77 (high, October 2026) | LAN peer loads the HTML, reads the channel token, bypasses save-story validation, triggers a Vitest run that writes files | loopback-only default bind, Host and Origin validation with `core.allowedHosts`, strict save-story validation, Vitest `browser.api.allowWrite` and `allowExec` off (`dev-server.http`, `dev-server.channel-handlers`) |
| GHSA-f2ph-cmg5-wxc8 (critical, October 2026) | website embeds the preview iframe, posts messages, abuses the highlight event to emit arbitrary events to the dev server, writes a story file | `frame-ancestors` CSP in dev, origin-pinned `postMessage`, sender-role filtering of events, constrained highlight payload (`browser.postmessage`, `dev-server.ws-channel`) |

## Delta procedure

Every audit compares this file with the code it reviewed and reports, under "Threat model delta", each of:

- a handler, route, event, child process, file write, or rendering sink the code has and this file lacks;
- a control or test this file lists that the code no longer has;
- a path in the path map that no longer exists, or a new high-radius directory the map does not cover;
- an advisory published since the table above.

The delta is a proposal for human review. The audit does not edit this file.

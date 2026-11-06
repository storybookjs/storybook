# Attack classes

Each class describes one shape of escalation step. A hunter assigned a class looks for steps of that shape on the surfaces named, and returns each as a step record (see `validation-and-reporting.md`). Classes are grouped by the principal that starts the step; principal numbers and surface ids come from `threat-model.md`.

Every class shares these rules:

- A step is complete only when it names the principal, the accepted input or action, the control that should bind it, the boundary crossed, and the smallest observable result.
- The proof is a test or command that asserts the control and fails today. The test uses an inert marker (a file named `security-audit-marker`, an event with a sentinel payload, a dummy origin), never a payload that does harm.
- Two steps are never combined into one working chain. A step that only matters as part of a chain is recorded with its chain membership and stays its own record.
- A fact outside the repository or the local harness is a `needs-validation` blocker, not an assumption.

## Principal 1: website visited by the developer

**W1. Cross-site request to a dev-server route**
Step: a page on another origin makes the developer's browser send a request to `dev-server.http` that reads project data or changes state. Control: Host validation, the route's own checks, browser preflight rules for non-simple requests.
Where: every route in `dev-server.http`, every `experimental_devServer` route in addons, `/mcp`.
Validation: a Vitest test that builds the request with a foreign `Origin` and `Host` and asserts a 403 or an unchanged project; for a route that must stay reachable, assert the response holds nothing the page could not already obtain.
Not a finding: a GET of public assets with no credentials, or a request the browser blocks before it reaches the server.

**W2. Cross-site WebSocket**
Step: a page opens the channel at `/storybook-server-channel`, or reaches it after obtaining the token. Control: Origin validation, the per-process token, sender-role filtering.
Where: `dev-server.ws-channel`, plus any HTML, JSON, or script that embeds the token.
Validation: `server-channel.test.ts` style tests: foreign `Origin` rejected, missing or wrong token rejected, an event whose declared sender mismatches dropped; a test that the token is absent from every response a cross-origin page can read.
Not a finding: the token present in the manager HTML on the same origin.

**W3. Framing and `postMessage` into the preview or manager**
Step: a page embeds a dev-mode manager or preview, or sends it a message, and a handler acts on the message. Control: `frame-ancestors`, origin pinning, `data-is-storybook` source matching, the handler's own payload validation.
Where: `browser.postmessage`, `browser.refs`, every `channel.on` in `code/core/src/manager-api/` and `code/core/src/preview-api/` whose handler writes, navigates, or re-emits.
Validation: `postmessage/index.test.ts` style tests with a foreign origin or a non-Storybook source, or a Playwright spec in `code/e2e-internal/` that embeds the preview from a second loopback origin.
Not a finding: behaviour that only `security.insecureIframeMessaging` or `security.insecureRemoteIframeEmbed` enables, unless the flag's effect exceeds its documentation.

**W4. Event fan-out**
Step: one accepted event causes the manager or preview to emit another event that reaches a server handler, so the sender-role table or a payload constraint is bypassed. Control: the constrained payload of the re-emitted event, sender filtering on the server.
Where: `code/core/src/highlight/`, `NAVIGATE_URL`, `UPDATE_GLOBALS`, `SET_CURRENT_STORY`, any handler that calls `channel.emit` with data from the incoming event.
Validation: a unit test that feeds the first event a sentinel payload and asserts the second event is not emitted, or is emitted with the sentinel stripped.

**W5. Browser-driven file write or process launch**
Step: a channel event or route causes the dev server to write a file, rewrite config, or spawn a process with a path, name, or content from the browser. Control: project-root containment, identifier validation, allowlisted targets, the sender role of the event.
Where: `dev-server.channel-handlers`, `code/addons/vitest/src/node/`, every `writeFile`, `mkdir`, `execa`, `spawn`, `launch-editor` call reachable from a handler.
Validation: a `*.security.test.ts` that sends the event with a traversal path, an absolute path, or a non-identifier name and asserts the handler rejects it without touching the filesystem (`memfs`, assert `vol.toJSON()` unchanged).
Not a finding: a write to the exact path the developer selected in the manager UI, when the event carries the manager sender role and every other layer holds.

## Principal 2: peer on the local network

**N1. Reachability beyond loopback**
Step: the server listens on a non-loopback interface, or a loopback-only server becomes reachable through a proxy, container port mapping, or DNS rebinding. Control: default bind address, Host validation, the confirmation prompt.
Where: `dev-server.http`, `code/builders/builder-vite/src/vite-server.ts` (`allowedHosts`), WebContainer bypass.
Validation: `server-address` tests for the bind address; a Host validation test with a rebinding-style hostname.
Not a finding: `--host` set by the developer, with validation still on.

**N2. Token or secret disclosure to the network**
Step: a peer who can reach the server reads the channel token, instance registry data, project metadata, or environment values from a response. Control: Host validation, the token's placement only in pages that require it, file permissions of the registry.
Where: `dev-server.ws-channel`, `dev-server.tools-and-mcp`, `/project.json`, `/index.json`, manifests, source maps served in dev.
Validation: a test that the token and registry contents appear only in the manager and preview HTML; a `memfs` test for registry file modes.

## Principal 3: visitor of a deployed Storybook

**D1. Script execution from a URL**
Step: `?args=`, `?globals=`, `?path=`, or another query value reaches markup, a URL sink, or script. Control: `parseArgsParam` validation, framework escaping, the renderer's own handling.
Where: `browser.rendering`, `code/core/src/router/`, `code/core/src/manager-api/modules/url.ts`, `code/renderers/server/`.
Validation: a `parseArgsParam` test with a sentinel value, or a story with a `play` function asserting the sentinel is rendered as text.
Not a finding: a story author rendering their own args unescaped; the author is the developer.

**D2. Markup from docs and metadata**
Step: a string from `index.json`, docgen, theme configuration, or markdown reaches raw HTML. Control: the escaping of each sink.
Where: `code/core/src/manager/components/sidebar/Brand.tsx` and every `dangerouslySetInnerHTML` or `innerHTML` in `code/core/src/manager/`, `code/addons/docs/src/blocks/`, `code/core/src/components/`.
Validation: a story with a `play` function or a unit test asserting a sentinel string is not parsed as markup.
Not a finding: a sink fed only by values the developer wrote into `main.*`, `preview.*`, or `manager.*`.

**D3. Built-output disclosure**
Step: a value from the build environment or project reaches a published file. Control: the `STORYBOOK_*` filter, `staticDirs` copying, `project.json` contents.
Where: `build.static-output`, `cli.config-loading` for environment handling.
Validation: a unit test on `envs.ts` with a sentinel non-prefixed variable, or a build of a sandbox with the sentinel in `.env` and a grep of the output.

## Principal 4: composed remote Storybook

**R1. Remote index and metadata trust**
Step: a composed ref's `index.json` or `metadata.json` changes manager behaviour beyond listing stories: navigation, rendering, requests, credentials. Control: the manager's handling of ref data, origin pinning of the remote iframe.
Where: `browser.refs`, `browser.postmessage`.
Validation: a `refs.test.ts` style test with sentinel values in a mocked ref response.
Not a finding: the remote preview rendering its own stories inside its own iframe.

**R2. Credential forwarding**
Step: ref credentials, `user:pass@`, bearer tokens, or cookies reach an origin other than the ref's own. Control: the fetch options and the auth resolution code.
Where: `browser.refs`, `code/addons/mcp/src/auth/`.
Validation: a test asserting the credential appears only in requests to the ref's origin.

## Principal 5: fork PR author

**C1. Untrusted code in a privileged workflow**
Step: a fork PR, comment, label, or branch name runs contributor-controlled code or data in a job holding a secret, a write token, or publish authority. Control: trigger type, checkout ref, author-association and label gates, permission blocks, environment protection.
Where: `ci.workflows`, `release.publish`, `.circleci/config.yml`.
Validation: cite the exact trigger and checkout lines; where a repository setting decides (branch protection, environment reviewers), record `needs-validation` with the setting to check.
Not a finding: a workflow `zizmor` already flags, unless the audit shows a reachable effect the lint does not.

**C2. Expression and cache injection**
Step: a contributor-controlled field reaches a shell line, an expression, a path, or a cache key in a workflow or release script. Control: quoting through `env`, cache namespaces keyed on trust.
Where: `.github/workflows/`, `.github/scripts/`, `scripts/release/`.
Validation: cite the line; a local run of the script with a sentinel value when it runs in Node.

## Principal 6: registry, template, or sandbox source

**S1. Unbound fetch and execute**
Step: the CLI fetches a version, template, repository, or addon that a lower-trust source can change, then executes it without a pin or integrity check. Control: pinned versions, the `versions.ts` fallback, the Yarn minimum-age gate, explicit user confirmation.
Where: `cli.package-manager`, `cli.project-mutation`.
Validation: cite the resolution path; a unit test with a mocked registry response holding a sentinel version.
Not a finding: installing the package the user asked for, at the version the user chose.

**S2. Shell string construction**
Step: a project name, path, version, or package name reaches a `shell: true` command line or `node -e` string. Control: argument arrays, validation of the interpolated value.
Where: `code/core/src/common/utils/command.ts` callers, `code/lib/create-storybook/src/scaffold-new-project.ts`, `code/lib/cli-storybook/src/postinstallAddon.ts`, `code/lib/cli-storybook/src/link.ts`.
Validation: a unit test with a sentinel containing shell metacharacters, asserting the spawned argument list.
Not a finding: a value the user typed at the prompt, when the command runs with the user's own privileges and the user sees it.

## Principal 7: MCP client or agent

**A1. Tool argument to a sink**
Step: a tool argument reaches a file path, a story write, a process, or a fetch without handler-side validation. Control: schema parsing plus the handler's own checks.
Where: `code/addons/mcp/src/tools/`, `code/core/src/shared/open-service/`, `code/core/src/cli/tools/`.
Validation: a handler unit test with a traversal or sentinel argument.
Not a finding: a tool doing exactly what its description says with the developer's own authority.

**A2. Endpoint reachability**
Step: a browser page or network peer reaches `/mcp` or the tools attach path without the checks the channel has. Control: Origin validation, content-type requirement, registry file permissions.
Where: `dev-server.tools-and-mcp`.
Validation: `code/addons/mcp/src/preset.test.ts` style tests with a foreign `Origin`, a missing `Origin`, and a non-JSON content type.

## Cross-cutting

**X1. Wildcard**
No class is assigned. Read the handlers, routes, and sinks on the assigned surface that no other class covers, and the code that looks unrelated to security: compatibility paths, experimental features behind flags, fallbacks when a check cannot run (`isWebContainer`, missing config, CI detection). State for each whether it is safe and why.

**X2. Obvious things**
Literal checks on the assigned surface: secrets or tokens in source or in served output; `TODO` or `FIXME` comments mentioning validation, auth, or security; `eval`, `new Function`, dynamic `import()` of request-derived names; `shell: true`; permissive CORS or `*` origins; flags that disable a control and where they are read. For each hit, trace the effect before reporting it; a pattern match is not a step.

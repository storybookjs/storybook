# @storybook/addon-mcp

## 0.7.0

### Minor Changes

- [#357](https://github.com/storybookjs/mcp/pull/357) [`4a19151`](https://github.com/storybookjs/mcp/commit/4a1915199892b3f733728844113a6b918ff70be9) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Added the `display-review` tool. The agent pushes a curated review of current changes and returns the review-page URL. Pairs with the `@storybook/addon-review` Storybook addon.

- [#357](https://github.com/storybookjs/mcp/pull/357) [`4a19151`](https://github.com/storybookjs/mcp/commit/4a1915199892b3f733728844113a6b918ff70be9) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Add the `get-stories-by-component` tool. Maps component source files to the stories that render them via Storybook's live reverse dependency graph, returning grounded story IDs ranked by import distance. Also hardens change detection: `get-changed-stories` now surfaces working-tree files that are unreachable from any story, and story-index resolution and reverse-graph lookups are normalized for cross-platform (Windows) path handling.

- [#357](https://github.com/storybookjs/mcp/pull/357) [`4a19151`](https://github.com/storybookjs/mcp/commit/4a1915199892b3f733728844113a6b918ff70be9) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Introduced the `get-changed-stories` tool to retrieve metadata for stories marked as new, modified, or affected.
  Updated `dev-instructions.md` and `storybook-story-instructions.md` to reflect the new workflow for calling `get-changed-stories` before `preview-stories`.

- [#357](https://github.com/storybookjs/mcp/pull/357) [`4a19151`](https://github.com/storybookjs/mcp/commit/4a1915199892b3f733728844113a6b918ff70be9) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Enabled the review workflow by default for the `storybook ai` CLI channel (the Claude/Codex plugins). Requests carrying the trusted local-client header get `display-review` and the review instructions without setting `experimentalReview`; direct MCP clients keep the opt-in flag, and `experimentalReview: false` turns review off for both channels.

- [#357](https://github.com/storybookjs/mcp/pull/357) [`4a19151`](https://github.com/storybookjs/mcp/commit/4a1915199892b3f733728844113a6b918ff70be9) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Add an optional MCP endpoint setting for the addon dev server.

- [#357](https://github.com/storybookjs/mcp/pull/357) [`4a19151`](https://github.com/storybookjs/mcp/commit/4a1915199892b3f733728844113a6b918ff70be9) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Make the review tooling opt-in via the new `experimentalReview` feature flag. Previously `display-review` (and the review-mode behavior of `preview-stories` / `get-changed-stories`) was enabled whenever the `changeDetection` feature flag was on — which is Storybook's default. Now review requires explicitly enabling `features.experimentalReview` in `.storybook/main.ts` (on top of `changeDetection`), so change detection stays on by default while review ships disabled by default.

  With the flag off, the server instructions are byte-identical to the previous release; the review-flavored instructions are only served with the flag on.

- [#357](https://github.com/storybookjs/mcp/pull/357) [`4a19151`](https://github.com/storybookjs/mcp/commit/4a1915199892b3f733728844113a6b918ff70be9) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Expose serverless Storybook AI metadata from addon-mcp presets. The new preset returns MCP-shaped instructions and tool descriptors, plus a local `get-storybook-story-instructions` runner that shares the same builders as the live MCP server.

- [#357](https://github.com/storybookjs/mcp/pull/357) [`4a19151`](https://github.com/storybookjs/mcp/commit/4a1915199892b3f733728844113a6b918ff70be9) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Support v0 (inline) and v1 (split/ref) Storybook manifest formats. `@storybook/mcp` follows `$ref` pointers into sibling `services/` payloads for static and remote sources; `@storybook/addon-mcp` adds an in-process manifest provider for `experimentalDocgenServer` dev mode and fixes composition so local docgen-server and remote v0/v1 composed sources all work.

### Patch Changes

- [#359](https://github.com/storybookjs/mcp/pull/359) [`4eb4a2e`](https://github.com/storybookjs/mcp/commit/4eb4a2eff337fc9fa04ce3c30d07d0f7f255b68f) Thanks [@huang-julien](https://github.com/huang-julien)! - Add a schema description to the `collections` argument of the `display-review` tool. The field now documents that collections are groups of stories to show in the review, ordered most-relevant-first, with a preferred 2-5 range. Previously it carried no description, so MCP clients and the `storybook ai display-review` help had no guidance on the argument's shape or intent.

- [#357](https://github.com/storybookjs/mcp/pull/357) [`4a19151`](https://github.com/storybookjs/mcp/commit/4a1915199892b3f733728844113a6b918ff70be9) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Make display-review the single ending for visual work: the after-change instruction step now feeds story discovery into the review instead of ending at preview URLs, preview-stories is framed as a mid-loop tool, the "or you skipped it" escape is removed (non-visual changes say so plainly instead of listing links), and get-changed-stories results append a "publish the review now" next-step hint when review is enabled. Fixes agents completing visual changes but handing back preview links instead of the review.

  The preview-stories tool also closes the review exit ramp: when review is enabled its description states display-review's availability as fact instead of hedging with "when available" (which let an agent that wrongly believed the tool was missing treat raw links as a sanctioned fallback), and its results append a recovery nudge pointing finished visual work and browse requests back to display-review. When review is disabled, the description no longer mentions display-review at all — the tool is not registered in those sessions.

  The get-storybook-story-instructions story-linking workflow gets the same review-aware rewrite: with review enabled it now routes discovered story IDs into display-review and forbids constructing IDs from file names or memory, instead of framing get-changed-stories as a preview-stories helper. The `storybook ai --help` output embeds the same server instructions, so on the CLI/plugin path the two channels contradicted each other — this tool, billed as the source of truth for story work, still pointed discovery at previews, and agents were observed resolving the conflict by publishing reviews with hand-derived story IDs and zero discovery calls.

- [#357](https://github.com/storybookjs/mcp/pull/357) [`4a19151`](https://github.com/storybookjs/mcp/commit/4a1915199892b3f733728844113a6b918ff70be9) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Refine the review/preview workflow so agents reuse the running Storybook and present a single set of links:

  - **Reuse the running Storybook.** A successful tool call proves Storybook is already running, so the agent is instructed never to start another instance (no `storybook dev`, launcher, or new port) just to view a review — a busy port is the instance to reuse, not a conflict to route around.
  - **`display-review` triggers on insight requests too.** Beyond post-change reviews, it now fires when the user wants to browse stories/components (e.g. "show me all badge components"), rendering exactly those stories with no diff (`changedFiles` omitted).
  - **One set of links in the final response.** When `display-review` is available, the response links only the curated review page ("You can see a curated summary of stories in the Storybook review page"); otherwise it lists the individual preview URLs — never both.

- [#357](https://github.com/storybookjs/mcp/pull/357) [`4a19151`](https://github.com/storybookjs/mcp/commit/4a1915199892b3f733728844113a6b918ff70be9) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Show private composed Storybooks as own-MCP guidance when accessed through the local MCP proxy.

- [#357](https://github.com/storybookjs/mcp/pull/357) [`4a19151`](https://github.com/storybookjs/mcp/commit/4a1915199892b3f733728844113a6b918ff70be9) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Add Storybook 10.5 prerelease packages to the supported peer dependency range.

  The `display-review` tool schema now requires `changedFiles`: pass the paths of
  the files you changed (most central first), or an empty array `[]` for browse
  requests where no code changed. Payloads that previously omitted the field will
  fail validation.

- [#357](https://github.com/storybookjs/mcp/pull/357) [`4a19151`](https://github.com/storybookjs/mcp/commit/4a1915199892b3f733728844113a6b918ff70be9) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Gate the `display-review` tool solely on the `changeDetection` feature flag. The previous `@storybook/addon-review` package-presence check is removed, since review is now built into Storybook core.

- [#357](https://github.com/storybookjs/mcp/pull/357) [`4a19151`](https://github.com/storybookjs/mcp/commit/4a1915199892b3f733728844113a6b918ff70be9) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Close the shared-code and docs-question gaps in the default (review-off) workflow steering, which eval runs showed agents falling through:

  - The dev and validation instructions now trigger on "anything that changes how the UI looks" (the stories skill's proven phrasing) instead of only "any component or story" — a theme-token edit is literally neither, so agents (GPT-5.5 on the MCP path consistently) finished shared-file changes with shell-level verification only, never calling preview-stories or run-story-tests. The preview-stories and run-story-tests descriptions carry the same trigger, including that a shared file has no stories of its own so the consumers' stories are the ones to surface, and that typecheck/lint does not replace story tests.
  - The docs-question rule now opens the server instructions ("Answer questions about component props, API, or usage with the documentation tools — never from source or type definitions") — Claude Code was observed grepping component source for props questions without ever reaching the rule further down. Design-system discovery is unconditional for new UI work — agents answered docs requests by grepping component source while still producing a correct-looking answer. The get-documentation and list-all-documentation descriptions repeat that steering at the tool level, where it reaches agents even when a client truncates server instructions, and get-storybook-story-instructions (the tool billed as the source of truth for story work, on both the MCP and `storybook ai` CLI channels) appends a Design-System Documentation section whenever the docs tools are registered.

  The review-off server instructions stay under the 2,048-char client truncation limit (now 2,046 chars), paid for by tightening existing sentences without dropping any rule.

- [#357](https://github.com/storybookjs/mcp/pull/357) [`4a19151`](https://github.com/storybookjs/mcp/commit/4a1915199892b3f733728844113a6b918ff70be9) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Slimmed the `experimentalReview` server instructions under the 2,048-character client truncation limit. Claude Code hard-truncates MCP server instructions at 2,048 characters, and the review-flavored instructions had grown to ~8.7k — the Validation and Documentation workflow sections never reached the model and agents stopped using the documentation tools. With the flag on, the dev, test, and docs sections now use slim variants that only carry the workflow triggers; the detailed guidance moved into the tool descriptions and tool results (`get-stories-by-component`, `get-changed-stories`, `display-review`, `list-all-documentation`), which are never truncated. The default (review off) instructions are unchanged. A unit test enforces the limit for every toolset configuration in both review modes.

- [#357](https://github.com/storybookjs/mcp/pull/357) [`4a19151`](https://github.com/storybookjs/mcp/commit/4a1915199892b3f733728844113a6b918ff70be9) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Surface the change-detection and review tools on the `/mcp` landing page. The "Available Toolsets" list now includes `get-stories-by-component`, `get-changed-stories`, and `display-review` under **dev** (each with an enabled/disabled badge reflecting its real runtime gate), and `get-documentation-for-story` under **docs**.

## 0.6.0

### Minor Changes

- [#209](https://github.com/storybookjs/mcp/pull/209) [`f59e38c`](https://github.com/storybookjs/mcp/commit/f59e38c1b91500f886cd923141b6ce45fa6c5822) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Add support for subcomponent docs

### Patch Changes

- [#212](https://github.com/storybookjs/mcp/pull/212) [`27a53b3`](https://github.com/storybookjs/mcp/commit/27a53b3f941240174a33442e17f9c258e5d87345) Thanks [@yannbf](https://github.com/yannbf)! - Add support for Storybook canaries

- Updated dependencies [[`f59e38c`](https://github.com/storybookjs/mcp/commit/f59e38c1b91500f886cd923141b6ce45fa6c5822)]:
  - @storybook/mcp@0.7.0

## 0.5.0

### Minor Changes

- [#208](https://github.com/storybookjs/mcp/pull/208) [`5418509`](https://github.com/storybookjs/mcp/commit/5418509f2c482d3b598032b7f263f759c8c3f777) Thanks [@yannbf](https://github.com/yannbf)! - Enable components manifest by default

### Patch Changes

- [#204](https://github.com/storybookjs/mcp/pull/204) [`b2a327d`](https://github.com/storybookjs/mcp/commit/b2a327dde8d0529ee3a2b80e033ce35991ad538e) Thanks [@JReinhold](https://github.com/JReinhold)! - upgrade tmcp dependencies

- Updated dependencies [[`70b5b23`](https://github.com/storybookjs/mcp/commit/70b5b2333a3bd37fc8065cc56cc8f8dcd474572e), [`b2a327d`](https://github.com/storybookjs/mcp/commit/b2a327dde8d0529ee3a2b80e033ce35991ad538e)]:
  - @storybook/mcp@0.6.2

## 0.4.2

### Patch Changes

- [#202](https://github.com/storybookjs/mcp/pull/202) [`9d19fae`](https://github.com/storybookjs/mcp/commit/9d19fae499557d2e5393fbeadd1bdda1d664f5dd) Thanks [@shilman](https://github.com/shilman)! - Add MCP registry metadata for `@storybook/addon-mcp`.

## 0.4.1

### Patch Changes

- [#172](https://github.com/storybookjs/mcp/pull/172) [`a610073`](https://github.com/storybookjs/mcp/commit/a610073f123efc2843e1e0deffd6eb2902d94c96) Thanks [@JReinhold](https://github.com/JReinhold)! - Simplify package READMEs for docs-site-first documentation

- Updated dependencies [[`a610073`](https://github.com/storybookjs/mcp/commit/a610073f123efc2843e1e0deffd6eb2902d94c96)]:
  - @storybook/mcp@0.6.1

## 0.4.0

### Minor Changes

- [#185](https://github.com/storybookjs/mcp/pull/185) [`c5439b7`](https://github.com/storybookjs/mcp/commit/c5439b72425a614e23549ba661d43df87a58443a) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Add MCP server-level instructions to both packages

  Both `@storybook/mcp` and `@storybook/addon-mcp` now include server instructions in the MCP `initialize` response. These instructions guide agents on how to use the available tools effectively without requiring explicit prompting from users.

### Patch Changes

- [#193](https://github.com/storybookjs/mcp/pull/193) [`dbb33c2`](https://github.com/storybookjs/mcp/commit/dbb33c29df2a2cee75eacb2f3575afddce6cd0bf) Thanks [@JReinhold](https://github.com/JReinhold)! - Fix enabling docs toolset even when component manifests were not present

- Updated dependencies [[`eb0ea73`](https://github.com/storybookjs/mcp/commit/eb0ea73f30c73a8102d9023c5201d1459d791fa1), [`c5439b7`](https://github.com/storybookjs/mcp/commit/c5439b72425a614e23549ba661d43df87a58443a)]:
  - @storybook/mcp@0.6.0

## 0.3.4

### Patch Changes

- [#179](https://github.com/storybookjs/mcp/pull/179) [`ec300bd`](https://github.com/storybookjs/mcp/commit/ec300bd9bf76169f537ae3358418db8973628bcf) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Improve `/mcp` HTML response

- [#181](https://github.com/storybookjs/mcp/pull/181) [`ff217d8`](https://github.com/storybookjs/mcp/commit/ff217d8d901b3b6ec932613792df17118b452fe3) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Rename feature flag `experimentalComponentsManifest` → `componentsManifest`

  The Storybook feature flag has been renamed from `experimentalComponentsManifest` to `componentsManifest` and now defaults to `true` in Storybook core.

- Updated dependencies [[`ff217d8`](https://github.com/storybookjs/mcp/commit/ff217d8d901b3b6ec932613792df17118b452fe3)]:
  - @storybook/mcp@0.5.1

## 0.3.3

### Patch Changes

- [#171](https://github.com/storybookjs/mcp/pull/171) [`b3a8356`](https://github.com/storybookjs/mcp/commit/b3a835605a760cdfb8748c17f6daec8701fb5914) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Fix: expose the `get-documentation-for-story` tool in the MCP Addon.

- [#176](https://github.com/storybookjs/mcp/pull/176) [`8afbb72`](https://github.com/storybookjs/mcp/commit/8afbb72c1bbbf718e12076a3d857516c9c9e7da2) Thanks [@JReinhold](https://github.com/JReinhold)! - Improve `preview-stories` tool description to make agent behavior more consistent.

- [#175](https://github.com/storybookjs/mcp/pull/175) [`6a098f9`](https://github.com/storybookjs/mcp/commit/6a098f96d3da58d572037e07a2aa33dab2a51bfd) Thanks [@JReinhold](https://github.com/JReinhold)! - Add story ID based inputs for preview/testing workflows and surface story IDs in docs outputs.

  This change keeps existing path-based story inputs (`absoluteStoryPath` + `exportName`) while adding a `storyId` input shape for `preview-stories` and `run-story-tests`. It also adds `withStoryIds` to `list-all-documentation` and includes story IDs in `get-documentation` story sections, so agents can discover and reuse IDs directly without extra filesystem lookup steps.

- Updated dependencies [[`b3a8356`](https://github.com/storybookjs/mcp/commit/b3a835605a760cdfb8748c17f6daec8701fb5914), [`6a098f9`](https://github.com/storybookjs/mcp/commit/6a098f96d3da58d572037e07a2aa33dab2a51bfd)]:
  - @storybook/mcp@0.5.0

## 0.3.2

### Patch Changes

- [#131](https://github.com/storybookjs/mcp/pull/131) [`9cf991c`](https://github.com/storybookjs/mcp/commit/9cf991c65e0c67bf85b011ab6ed29dac9cac2cfa) Thanks [@JReinhold](https://github.com/JReinhold)! - Added `run-story-tests` tool that is available when:

  1. `@storybook/addon-vitest` is configured
  2. Running Storybook 10.3.0-alpha.8 or above

  Additionally, if `@storybook/addon-a11y` is configured, the tool returns accessibility violations too.

- Updated dependencies [[`9cf991c`](https://github.com/storybookjs/mcp/commit/9cf991c65e0c67bf85b011ab6ed29dac9cac2cfa)]:
  - @storybook/mcp@0.4.1

## 0.3.1

### Patch Changes

- Updated dependencies [[`c0793d4`](https://github.com/storybookjs/mcp/commit/c0793d4dd9b1895f6f67be21a5bf0339a3458e95)]:
  - @storybook/mcp@0.4.0

## 0.3.0

### Minor Changes

- [#165](https://github.com/storybookjs/mcp/pull/165) [`e088e05`](https://github.com/storybookjs/mcp/commit/e088e0501619b29bf7f38ef2ee2b60c8477c803a) Thanks [@JReinhold](https://github.com/JReinhold)! - Remove support for XML format.

  ## Breaking Change

  The related option to configure XML vs markdown format now has no impact, the output is always formatted as markdown.

- [#140](https://github.com/storybookjs/mcp/pull/140) [`f9fce2a`](https://github.com/storybookjs/mcp/commit/f9fce2a12b691d1187d8bc719c88e912e27e3391) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Add multi-source composition with OAuth for private Storybooks

### Patch Changes

- [#163](https://github.com/storybookjs/mcp/pull/163) [`68cb213`](https://github.com/storybookjs/mcp/commit/68cb2138f16d4987b5cef1fc85052e583825e896) Thanks [@domazet93](https://github.com/domazet93)! - Fix `preview-stories` failing to find stories in monorepo packages directories.

- Updated dependencies [[`e088e05`](https://github.com/storybookjs/mcp/commit/e088e0501619b29bf7f38ef2ee2b60c8477c803a), [`f9fce2a`](https://github.com/storybookjs/mcp/commit/f9fce2a12b691d1187d8bc719c88e912e27e3391)]:
  - @storybook/mcp@0.3.0

## 0.2.3

### Patch Changes

- [#141](https://github.com/storybookjs/mcp/pull/141) [`03e957d`](https://github.com/storybookjs/mcp/commit/03e957d013d6e240b82e3106dd2790068fe058e1) Thanks [@shilman](https://github.com/shilman)! - Upgrade deprecated MCP server methods

- [#160](https://github.com/storybookjs/mcp/pull/160) [`bab8ec9`](https://github.com/storybookjs/mcp/commit/bab8ec9ece4f89661b458fbecd59b0a560948192) Thanks [@JReinhold](https://github.com/JReinhold)! - Render component-attached MDX docs entries in markdown output for `get-documentation`.

  This fixes a regression where docs attached to components via `component.docs` in `components.json` were not included in markdown responses. The markdown formatter now emits a `## Docs` section below stories (and before props).

- Updated dependencies [[`b7aeb40`](https://github.com/storybookjs/mcp/commit/b7aeb40c32d831618774c13e316596e9ff840aa7), [`bab8ec9`](https://github.com/storybookjs/mcp/commit/bab8ec9ece4f89661b458fbecd59b0a560948192)]:
  - @storybook/mcp@0.2.2

## 0.2.2

### Patch Changes

- [#137](https://github.com/storybookjs/mcp/pull/137) [`56be9e7`](https://github.com/storybookjs/mcp/commit/56be9e70919771b42e1be43c388f8a7cd62ce20f) Thanks [@valentinpalkovic](https://github.com/valentinpalkovic)! - Fix preview-stories tool on Windows

## 0.2.1

### Patch Changes

- [#134](https://github.com/storybookjs/mcp/pull/134) [`457b349`](https://github.com/storybookjs/mcp/commit/457b3497c9b30dbe465dc6f07f708c5ac77edc45) Thanks [@JReinhold](https://github.com/JReinhold)! - Add support for MCP App, rendering stories directly in the agent chat in MCP clients that support it

## 0.2.0

### Minor Changes

- [#118](https://github.com/storybookjs/mcp/pull/118) [`bafbfc6`](https://github.com/storybookjs/mcp/commit/bafbfc661f93f32024ce75d553f2b7bc90954508) Thanks [@valentinpalkovic](https://github.com/valentinpalkovic)! - Renamed tool `get-ui-building-instructions` to `get-storybook-story-instructions` to increase the likelihood of Agents calling the MCP tool.

  Further updates:

  - Updated storybook-story building instructions template to be more specific about what a good story is.
  - Added an extensive description for the `get-storybook-story-instructions` tool to give agents more information of when to call the MCP tool

### Patch Changes

- [#128](https://github.com/storybookjs/mcp/pull/128) [`20d97e2`](https://github.com/storybookjs/mcp/commit/20d97e26020c47eca3816888811c557c42a45342) Thanks [@JReinhold](https://github.com/JReinhold)! - Fix disabled docs toolset in Storybook version prior to v10.2.0-alpha.10

## 0.1.8

### Patch Changes

- [#122](https://github.com/storybookjs/mcp/pull/122) [`0254c09`](https://github.com/storybookjs/mcp/commit/0254c091f60ac8b1c69116c936bcb7a1540dc916) Thanks [@JReinhold](https://github.com/JReinhold)! - Log output token count of tool calls to telemetry

- Updated dependencies [[`0254c09`](https://github.com/storybookjs/mcp/commit/0254c091f60ac8b1c69116c936bcb7a1540dc916)]:
  - @storybook/mcp@0.2.1

## 0.1.7

### Patch Changes

- [#120](https://github.com/storybookjs/mcp/pull/120) [`c1fc816`](https://github.com/storybookjs/mcp/commit/c1fc8167a8077e3bb07bce3c9c22539b23a07a29) Thanks [@JReinhold](https://github.com/JReinhold)! - Add support for docs entries in manifests, sourced by MDX files.

- Updated dependencies [[`c1fc816`](https://github.com/storybookjs/mcp/commit/c1fc8167a8077e3bb07bce3c9c22539b23a07a29)]:
  - @storybook/mcp@0.2.0

## 0.1.6

### Patch Changes

- [#105](https://github.com/storybookjs/mcp/pull/105) [`e27f6b2`](https://github.com/storybookjs/mcp/commit/e27f6b2a78354f252715ae14dd9de321c9055cda) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Update Valibot to v1.2.0 to fix security vulnerabilities

  Valibot 1.1.0 contained 3 security vulnerabilities that are addressed in v1.2.0. This is a non-breaking security patch - no changes required for consumers.

- Updated dependencies [[`e27f6b2`](https://github.com/storybookjs/mcp/commit/e27f6b2a78354f252715ae14dd9de321c9055cda)]:
  - @storybook/mcp@0.1.1

## 0.1.5

### Patch Changes

- [#93](https://github.com/storybookjs/mcp/pull/93) [`dce8c8d`](https://github.com/storybookjs/mcp/commit/dce8c8d47103e5eb122196c14328658f69f52f11) Thanks [@JReinhold](https://github.com/JReinhold)! - Improve visibility into which toolsets are available

## 0.1.4

### Patch Changes

- [#78](https://github.com/storybookjs/mcp/pull/78) [`f40da8f`](https://github.com/storybookjs/mcp/commit/f40da8fde7302619f5c5c08bd5958f23ad0e32a2) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Add toolset to telemetry payload

- [#56](https://github.com/storybookjs/mcp/pull/56) [`edcbf4e`](https://github.com/storybookjs/mcp/commit/edcbf4e7a5d85db1f7aeb1d54b90d0d1801774c1) Thanks [@JReinhold](https://github.com/JReinhold)! - improve html bundling

- [#86](https://github.com/storybookjs/mcp/pull/86) [`94c01d2`](https://github.com/storybookjs/mcp/commit/94c01d2c162b5f6a20268957a17eedf7beeb7156) Thanks [@JReinhold](https://github.com/JReinhold)! - Docs toolset: output markdown instead of XML, configurable via experimentalOutput: 'markdown' | 'xml' addon option

- [#84](https://github.com/storybookjs/mcp/pull/84) [`47ab165`](https://github.com/storybookjs/mcp/commit/47ab1659b65aa2879267e664bd0b569b2fdb4fa2) Thanks [@JReinhold](https://github.com/JReinhold)! - improve handling of disableTelemetry option

- [#70](https://github.com/storybookjs/mcp/pull/70) [`cf4ef86`](https://github.com/storybookjs/mcp/commit/cf4ef8697c84102bd274809ec749beb41ebdb98a) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Handle GET responses in the MCP server

- [#59](https://github.com/storybookjs/mcp/pull/59) [`ed0fe09`](https://github.com/storybookjs/mcp/commit/ed0fe09eb2f33b723f50e18fe6e3f6e1ba3d3f80) Thanks [@JReinhold](https://github.com/JReinhold)! - Allow Storybook 10.1.0 prerelases as peer dependencies

- Updated dependencies [[`94c01d2`](https://github.com/storybookjs/mcp/commit/94c01d2c162b5f6a20268957a17eedf7beeb7156), [`9f75d0f`](https://github.com/storybookjs/mcp/commit/9f75d0f0d9c2e24e6ec4078526a6876ebc31f6bb), [`5d18405`](https://github.com/storybookjs/mcp/commit/5d1840506f2ee4f1ae1f757ff133108a046cfc5d), [`a9321a3`](https://github.com/storybookjs/mcp/commit/a9321a33e6ec907eacd876d7ede368fc672d95c6), [`77536a7`](https://github.com/storybookjs/mcp/commit/77536a71812fe111f6b60c84bd2c26cb0eb00bc5), [`cddbf34`](https://github.com/storybookjs/mcp/commit/cddbf34a0c99296856ecfed2c24cf689fcb2fd2a)]:
  - @storybook/mcp@0.1.0

## 0.1.4-next.2

### Patch Changes

- Updated dependencies [[`77536a7`](https://github.com/storybookjs/mcp/commit/77536a71812fe111f6b60c84bd2c26cb0eb00bc5), [`cddbf34`](https://github.com/storybookjs/mcp/commit/cddbf34a0c99296856ecfed2c24cf689fcb2fd2a)]:
  - @storybook/mcp@0.0.7-next.0

## 0.1.4-next.1

### Patch Changes

- [#59](https://github.com/storybookjs/mcp/pull/59) [`ed0fe09`](https://github.com/storybookjs/mcp/commit/ed0fe09eb2f33b723f50e18fe6e3f6e1ba3d3f80) Thanks [@JReinhold](https://github.com/JReinhold)! - Allow Storybook 10.1.0 prerelases as peer dependencies

## 0.1.4-next.0

### Patch Changes

- [#56](https://github.com/storybookjs/mcp/pull/56) [`edcbf4e`](https://github.com/storybookjs/mcp/commit/edcbf4e7a5d85db1f7aeb1d54b90d0d1801774c1) Thanks [@JReinhold](https://github.com/JReinhold)! - improve html bundling

## 0.1.3

### Patch Changes

- [#50](https://github.com/storybookjs/mcp/pull/50) [`0334d29`](https://github.com/storybookjs/mcp/commit/0334d2988f7b5be056f458e60bee7eca7a366997) Thanks [@JReinhold](https://github.com/JReinhold)! - Add GET handler that serves HTML when visiting `/mcp`, and redirects to human-readable component manifest when applicable

- [#50](https://github.com/storybookjs/mcp/pull/50) [`0334d29`](https://github.com/storybookjs/mcp/commit/0334d2988f7b5be056f458e60bee7eca7a366997) Thanks [@JReinhold](https://github.com/JReinhold)! - Update manifest format

## 0.1.2

### Patch Changes

- [#51](https://github.com/storybookjs/mcp/pull/51) [`2028709`](https://github.com/storybookjs/mcp/commit/20287092a914fb108af1d90d64adf4c604e1a81a) Thanks [@paoloricciuti](https://github.com/paoloricciuti)! - chore: update `tmcp`

- [#48](https://github.com/storybookjs/mcp/pull/48) [`52be338`](https://github.com/storybookjs/mcp/commit/52be33863c62c703826fa915be7eae656c18a6ed) Thanks [@JReinhold](https://github.com/JReinhold)! - Add possibility to configure toolsets (dev tools vs docs tools) either via addon options or request headers

- Updated dependencies [[`52be338`](https://github.com/storybookjs/mcp/commit/52be33863c62c703826fa915be7eae656c18a6ed), [`2028709`](https://github.com/storybookjs/mcp/commit/20287092a914fb108af1d90d64adf4c604e1a81a)]:
  - @storybook/mcp@0.0.6

## 0.1.1

### Patch Changes

- [#42](https://github.com/storybookjs/mcp/pull/42) [`57a1602`](https://github.com/storybookjs/mcp/commit/57a16022dda428ddc303eec615b5b4c73942144c) Thanks [@JReinhold](https://github.com/JReinhold)! - Log telemetry when the additional @storybook/mcp tools are called

- [#44](https://github.com/storybookjs/mcp/pull/44) [`140ecc4`](https://github.com/storybookjs/mcp/commit/140ecc4b7845ba86a3d2a0d6aa4c69a5f4c33a78) Thanks [@JReinhold](https://github.com/JReinhold)! - Support Storybook 9.1.16 and up

- Updated dependencies [[`57a1602`](https://github.com/storybookjs/mcp/commit/57a16022dda428ddc303eec615b5b4c73942144c)]:
  - @storybook/mcp@0.0.5

## 0.1.0

### Minor Changes

- [#36](https://github.com/storybookjs/mcp/pull/36) [`93f88e4`](https://github.com/storybookjs/mcp/commit/93f88e4a28c3dae1b4c02c29839eb5e8b9375146) Thanks [@JReinhold](https://github.com/JReinhold)! - Add support for Webpack (including Webpack-based frameworks like Next.js)

# Breaking Change

This requires version 10.1 of Storybook, currently only available as the canary version `0.0.0-pr-32810-sha-6e759c7e`. If you want to continue to use the addon with Storybook 9 or 10.0 (and Vite), stick to [version `0.0.9` of this package](https://github.com/storybookjs/mcp/tree/%40storybook/addon-mcp%400.0.9).

EDIT: The above is not true anymore, see version [0.1.1](#011) of this package.

### Patch Changes

- [#38](https://github.com/storybookjs/mcp/pull/38) [`fc83cd1`](https://github.com/storybookjs/mcp/commit/fc83cd1c7f50cc0d12bc24ed427c5b38fa52acee) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - include prop types in component documentation tool

- Updated dependencies [[`fc83cd1`](https://github.com/storybookjs/mcp/commit/fc83cd1c7f50cc0d12bc24ed427c5b38fa52acee)]:
  - @storybook/mcp@0.0.4

## 0.0.9

### Patch Changes

- [#35](https://github.com/storybookjs/mcp/pull/35) [`4344744`](https://github.com/storybookjs/mcp/commit/43447442ea57a4167a2ec1c83f59c95a2a306171) Thanks [@JReinhold](https://github.com/JReinhold)! - Improve documentation around tool usage and setup

- [#35](https://github.com/storybookjs/mcp/pull/35) [`373741b`](https://github.com/storybookjs/mcp/commit/373741b26595796b7e3aa4f6f78cb79c3a44cbf6) Thanks [@JReinhold](https://github.com/JReinhold)! - Specify that only Storybook 9 or above is supported

## 0.0.8

### Patch Changes

- [#33](https://github.com/storybookjs/mcp/pull/33) [`ae6ab44`](https://github.com/storybookjs/mcp/commit/ae6ab44e4c4bdf9797facab69c6748bc7a52ba9a) Thanks [@JReinhold](https://github.com/JReinhold)! - Add tools to get documentation for components, based on the component manifest being generated in the Storybook dev server.

  Requirements:

  1. That the **experimental** feature flag `features.experimentalComponentsManifest` is set to `true` in the main config.
  2. Only React-based frameworks supports component manifest generation for now.
  3. Requires Storybook v10.1 (prereleases), which at the time of writing is available as a canary version `0.0.0-pr-32810-sha-af0645cd`.

- Updated dependencies [[`531a2d4`](https://github.com/storybookjs/mcp/commit/531a2d4be0684c94d516b76d93863337883b2bad), [`ae6ab44`](https://github.com/storybookjs/mcp/commit/ae6ab44e4c4bdf9797facab69c6748bc7a52ba9a)]:
  - @storybook/mcp@0.0.3

## 0.0.7

### Patch Changes

- [#31](https://github.com/storybookjs/mcp/pull/31) [`512c958`](https://github.com/storybookjs/mcp/commit/512c9588bf6e6b39b7c4d58694229b1e67ffc1d2) Thanks [@JReinhold](https://github.com/JReinhold)! - use shared tsdown config for all monorepo packages, target node 20.19

- [#31](https://github.com/storybookjs/mcp/pull/31) [`f660cfe`](https://github.com/storybookjs/mcp/commit/f660cfe5f436c318f04a329dd5cf996789e26cf0) Thanks [@JReinhold](https://github.com/JReinhold)! - change tool names

- [#31](https://github.com/storybookjs/mcp/pull/31) [`a47e61d`](https://github.com/storybookjs/mcp/commit/a47e61d5ce281baae93e74768164c7b02a380d49) Thanks [@JReinhold](https://github.com/JReinhold)! - This release migrates the addon's MCP implementation from `@modelcontextprotocol/sdk` to `tmcp`.

## 0.0.6

### Patch Changes

- [#29](https://github.com/storybookjs/mcp/pull/29) [`4086e0d`](https://github.com/storybookjs/mcp/commit/4086e0d41d29a2e5c412a5cfd6bc65d97bf9ee76) Thanks [@JReinhold](https://github.com/JReinhold)! - Update documentation and repository links

## 0.0.5

### Patch Changes

- [#21](https://github.com/storybookjs/addon-mcp/pull/21) [`b91acac`](https://github.com/storybookjs/addon-mcp/commit/b91acac6fcb7d8e3556e07a499432c1779d59680) Thanks [@shilman](https://github.com/shilman)! - Embed demo image from storybook.js.org

- [#16](https://github.com/storybookjs/addon-mcp/pull/16) [`bf41737`](https://github.com/storybookjs/addon-mcp/commit/bf41737f3409ff25a023993bf1475bf9620c085d) Thanks [@shilman](https://github.com/shilman)! - Improve README

## 0.0.4

### Patch Changes

- [#12](https://github.com/storybookjs/addon-mcp/pull/12) [`b448cd4`](https://github.com/storybookjs/addon-mcp/commit/b448cd45093866556cfb1b3edba8e98c0db23a9a) Thanks [@JReinhold](https://github.com/JReinhold)! - Add instructions on when to write stories

## 0.0.3

### Patch Changes

- [#11](https://github.com/storybookjs/addon-mcp/pull/11) [`bba9b8c`](https://github.com/storybookjs/addon-mcp/commit/bba9b8c683acdd5dfa835d4dea848dce7355ee82) Thanks [@JReinhold](https://github.com/JReinhold)! - - Improved UI Building Instructions

  - Improved output format of Get Story URLs tool

- [#9](https://github.com/storybookjs/addon-mcp/pull/9) [`e5e2adf`](https://github.com/storybookjs/addon-mcp/commit/e5e2adf7192d5e12f21229056b644e7aa32287ed) Thanks [@JReinhold](https://github.com/JReinhold)! - Add basic telemetry for sessions and tool calls

## 0.0.2

### Patch Changes

- [#8](https://github.com/storybookjs/addon-mcp/pull/8) [`77d0779`](https://github.com/storybookjs/addon-mcp/commit/77d0779f471537bd72eca42543a559e97d329f6f) Thanks [@JReinhold](https://github.com/JReinhold)! - Add initial readme content

## 0.0.1

### Patch Changes

- [#5](https://github.com/storybookjs/addon-mcp/pull/5) [`e4978f3`](https://github.com/storybookjs/addon-mcp/commit/e4978f3cc0f587f3fc51aa26f49b8183bfbbc966) Thanks [@JReinhold](https://github.com/JReinhold)! - Initial release with UI instruction and story link tools

# @storybook/mcp

## 0.8.0

### Minor Changes

- [#298](https://github.com/storybookjs/mcp/pull/298) [`ae6e9bb`](https://github.com/storybookjs/mcp/commit/ae6e9bbdb55f4262e697a68437a00d4cd4accc4d) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Expose serverless Storybook AI metadata from addon-mcp presets. The new preset returns MCP-shaped instructions and tool descriptors, plus a local `get-storybook-story-instructions` runner that shares the same builders as the live MCP server.

- [#308](https://github.com/storybookjs/mcp/pull/308) [`ff09619`](https://github.com/storybookjs/mcp/commit/ff09619079520ed238eff91bd385b7ba0cb7b102) Thanks [@JReinhold](https://github.com/JReinhold)! - Support v0 (inline) and v1 (split/ref) Storybook manifest formats. `@storybook/mcp` follows `$ref` pointers into sibling `services/` payloads for static and remote sources; `@storybook/addon-mcp` adds an in-process manifest provider for `experimentalDocgenServer` dev mode and fixes composition so local docgen-server and remote v0/v1 composed sources all work.

### Patch Changes

- [#329](https://github.com/storybookjs/mcp/pull/329) [`86ff2bf`](https://github.com/storybookjs/mcp/commit/86ff2bfb62818cf1370aacec1a672f1f608e8cf2) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Fold the "CRITICAL: Never hallucinate component properties!" guidance from the documented AGENTS.md snippet into the Documentation Workflow server instructions, so the docs no longer need to recommend a manual AGENTS.md addition. The separate "Verification Rules" section is merged into the Documentation Workflow (the guidance is about checking documentation before starting work, not about verifying it afterwards), keeping the full default instructions under the 2,048-character client truncation limit.

- [#242](https://github.com/storybookjs/mcp/pull/242) [`d142450`](https://github.com/storybookjs/mcp/commit/d142450ba94ce341d0a0ef869ddd057610d10fbd) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Show private composed Storybooks as own-MCP guidance when accessed through the local MCP proxy.

- [#335](https://github.com/storybookjs/mcp/pull/335) [`3486c0d`](https://github.com/storybookjs/mcp/commit/3486c0d81bbbfb25940291a0b8560fa6c0e625b5) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Close the shared-code and docs-question gaps in the default (review-off) workflow steering, which eval runs showed agents falling through:

  - The dev and validation instructions now trigger on "anything that changes how the UI looks" (the stories skill's proven phrasing) instead of only "any component or story" — a theme-token edit is literally neither, so agents (GPT-5.5 on the MCP path consistently) finished shared-file changes with shell-level verification only, never calling preview-stories or run-story-tests. The preview-stories and run-story-tests descriptions carry the same trigger, including that a shared file has no stories of its own so the consumers' stories are the ones to surface, and that typecheck/lint does not replace story tests.
  - The docs-question rule now opens the server instructions ("Answer questions about component props, API, or usage with the documentation tools — never from source or type definitions") — Claude Code was observed grepping component source for props questions without ever reaching the rule further down. Design-system discovery is unconditional for new UI work — agents answered docs requests by grepping component source while still producing a correct-looking answer. The get-documentation and list-all-documentation descriptions repeat that steering at the tool level, where it reaches agents even when a client truncates server instructions, and get-storybook-story-instructions (the tool billed as the source of truth for story work, on both the MCP and `storybook ai` CLI channels) appends a Design-System Documentation section whenever the docs tools are registered.

  The review-off server instructions stay under the 2,048-char client truncation limit (now 2,046 chars), paid for by tightening existing sentences without dropping any rule.

- [#320](https://github.com/storybookjs/mcp/pull/320) [`da8d525`](https://github.com/storybookjs/mcp/commit/da8d525167045299985bcb6f236f91502716c9e8) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Slimmed the `experimentalReview` server instructions under the 2,048-character client truncation limit. Claude Code hard-truncates MCP server instructions at 2,048 characters, and the review-flavored instructions had grown to ~8.7k — the Validation and Documentation workflow sections never reached the model and agents stopped using the documentation tools. With the flag on, the dev, test, and docs sections now use slim variants that only carry the workflow triggers; the detailed guidance moved into the tool descriptions and tool results (`get-stories-by-component`, `get-changed-stories`, `display-review`, `list-all-documentation`), which are never truncated. The default (review off) instructions are unchanged. A unit test enforces the limit for every toolset configuration in both review modes.

- [#279](https://github.com/storybookjs/mcp/pull/279) [`367ecc1`](https://github.com/storybookjs/mcp/commit/367ecc1eabdc92f3fa60e6159b2d79a2bb2f6f77) Thanks [@huang-julien](https://github.com/huang-julien)! - Support the externalized-docgen component manifest format. Newer Storybooks emit a `components.json` whose entries are lightweight stubs carrying a `docgen.$ref` pointer instead of inline `path`/docgen data, with the full component data served from a referenced file. `get-documentation` and `get-documentation-for-story` now resolve that reference (through the same auth-aware manifest provider) before formatting, so composition/multi-source documentation works against Storybooks using the new format. `path` and the top-level manifest `v` field are now optional to accommodate stubs and referenced docgen files.

## 0.7.0

### Minor Changes

- [#209](https://github.com/storybookjs/mcp/pull/209) [`f59e38c`](https://github.com/storybookjs/mcp/commit/f59e38c1b91500f886cd923141b6ce45fa6c5822) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Add support for subcomponent docs

## 0.6.2

### Patch Changes

- [#206](https://github.com/storybookjs/mcp/pull/206) [`70b5b23`](https://github.com/storybookjs/mcp/commit/70b5b2333a3bd37fc8065cc56cc8f8dcd474572e) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Support Storybook component manifests that use `reactComponentMeta` for React prop extraction.

  This keeps MCP documentation output working when Storybook is configured to emit the newer
  `reactComponentMeta` payload instead of `reactDocgen` or `reactDocgenTypescript`.

- [#204](https://github.com/storybookjs/mcp/pull/204) [`b2a327d`](https://github.com/storybookjs/mcp/commit/b2a327dde8d0529ee3a2b80e033ce35991ad538e) Thanks [@JReinhold](https://github.com/JReinhold)! - upgrade tmcp dependencies

## 0.6.1

### Patch Changes

- [#172](https://github.com/storybookjs/mcp/pull/172) [`a610073`](https://github.com/storybookjs/mcp/commit/a610073f123efc2843e1e0deffd6eb2902d94c96) Thanks [@JReinhold](https://github.com/JReinhold)! - Simplify package READMEs for docs-site-first documentation

## 0.6.0

### Minor Changes

- [#185](https://github.com/storybookjs/mcp/pull/185) [`c5439b7`](https://github.com/storybookjs/mcp/commit/c5439b72425a614e23549ba661d43df87a58443a) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Add MCP server-level instructions to both packages

  Both `@storybook/mcp` and `@storybook/addon-mcp` now include server instructions in the MCP `initialize` response. These instructions guide agents on how to use the available tools effectively without requiring explicit prompting from users.

### Patch Changes

- [#194](https://github.com/storybookjs/mcp/pull/194) [`eb0ea73`](https://github.com/storybookjs/mcp/commit/eb0ea73f30c73a8102d9023c5201d1459d791fa1) Thanks [@JReinhold](https://github.com/JReinhold)! - Forward `sources` through `createStorybookMcpHandler()` into the per-request transport context.

## 0.5.1

### Patch Changes

- [#181](https://github.com/storybookjs/mcp/pull/181) [`ff217d8`](https://github.com/storybookjs/mcp/commit/ff217d8d901b3b6ec932613792df17118b452fe3) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Rename feature flag `experimentalComponentsManifest` → `componentsManifest`

  The Storybook feature flag has been renamed from `experimentalComponentsManifest` to `componentsManifest` and now defaults to `true` in Storybook core.

## 0.5.0

### Minor Changes

- [#171](https://github.com/storybookjs/mcp/pull/171) [`b3a8356`](https://github.com/storybookjs/mcp/commit/b3a835605a760cdfb8748c17f6daec8701fb5914) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Export `addGetStoryDocumentationTool` directly instead of renaming it to `addGetComponentStoryDocumentationTool`.

  **Breaking change**: If you were importing `addGetComponentStoryDocumentationTool` from `@storybook/mcp`, update your import to use `addGetStoryDocumentationTool` instead.

### Patch Changes

- [#175](https://github.com/storybookjs/mcp/pull/175) [`6a098f9`](https://github.com/storybookjs/mcp/commit/6a098f96d3da58d572037e07a2aa33dab2a51bfd) Thanks [@JReinhold](https://github.com/JReinhold)! - Add story ID based inputs for preview/testing workflows and surface story IDs in docs outputs.

  This change keeps existing path-based story inputs (`absoluteStoryPath` + `exportName`) while adding a `storyId` input shape for `preview-stories` and `run-story-tests`. It also adds `withStoryIds` to `list-all-documentation` and includes story IDs in `get-documentation` story sections, so agents can discover and reuse IDs directly without extra filesystem lookup steps.

## 0.4.1

### Patch Changes

- [#131](https://github.com/storybookjs/mcp/pull/131) [`9cf991c`](https://github.com/storybookjs/mcp/commit/9cf991c65e0c67bf85b011ab6ed29dac9cac2cfa) Thanks [@JReinhold](https://github.com/JReinhold)! - Fixed type bundling issue

## 0.4.0

### Minor Changes

- [#168](https://github.com/storybookjs/mcp/pull/168) [`c0793d4`](https://github.com/storybookjs/mcp/commit/c0793d4dd9b1895f6f67be21a5bf0339a3458e95) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Add react-docgen-typescript support for component manifest parsing.

## 0.3.0

### Minor Changes

- [#165](https://github.com/storybookjs/mcp/pull/165) [`e088e05`](https://github.com/storybookjs/mcp/commit/e088e0501619b29bf7f38ef2ee2b60c8477c803a) Thanks [@JReinhold](https://github.com/JReinhold)! - Remove support for XML format.

  ## Breaking Change

  The related option to configure XML vs markdown format now has no impact, the output is always formatted as markdown.

- [#140](https://github.com/storybookjs/mcp/pull/140) [`f9fce2a`](https://github.com/storybookjs/mcp/commit/f9fce2a12b691d1187d8bc719c88e912e27e3391) Thanks [@kasperpeulen](https://github.com/kasperpeulen)! - Add multi-source composition with OAuth for private Storybooks

## 0.2.2

### Patch Changes

- [#123](https://github.com/storybookjs/mcp/pull/123) [`b7aeb40`](https://github.com/storybookjs/mcp/commit/b7aeb40c32d831618774c13e316596e9ff840aa7) Thanks [@valentinpalkovic](https://github.com/valentinpalkovic)! - Minimize token usage by only including the 3 first stories in component documentation.

  ... if there are already prop types. If there are no prop types, include all stories. Additional stories can be fetched individually using a new `get-documentation-for-story` tool.

- [#160](https://github.com/storybookjs/mcp/pull/160) [`bab8ec9`](https://github.com/storybookjs/mcp/commit/bab8ec9ece4f89661b458fbecd59b0a560948192) Thanks [@JReinhold](https://github.com/JReinhold)! - Render component-attached MDX docs entries in markdown output for `get-documentation`.

  This fixes a regression where docs attached to components via `component.docs` in `components.json` were not included in markdown responses. The markdown formatter now emits a `## Docs` section below stories (and before props).

## 0.2.1

### Patch Changes

- [#122](https://github.com/storybookjs/mcp/pull/122) [`0254c09`](https://github.com/storybookjs/mcp/commit/0254c091f60ac8b1c69116c936bcb7a1540dc916) Thanks [@JReinhold](https://github.com/JReinhold)! - Add resultText to args of onListAllDocumentation and onGetDocumentation

## 0.2.0

### Minor Changes

- [#120](https://github.com/storybookjs/mcp/pull/120) [`c1fc816`](https://github.com/storybookjs/mcp/commit/c1fc8167a8077e3bb07bce3c9c22539b23a07a29) Thanks [@JReinhold](https://github.com/JReinhold)! - Add support for docs entries in manifests, sourced by MDX files.

  # Breaking Changes

  This change introduces a number of minor breaking changes to `@storybook/mcp`:

  1. The lower level tool adder functions have been renamed:
  2. `addGetComponentDocumentationTool` -> `addGetDocumentationTool`
  3. `addListAllComponentsTool` -> `addListAllDocumentationTool`
  4. The optional tool hooks have been renamed:
  5. `onListAllComponents` -> `onListAllDocumentation`
  6. `onGetComponentDocumentation` -> `onGetDocumentation`
  7. The exported `MANIFEST_PATH` constant have been removed in favor of two new constants, `COMPONENT_MANIFEST_PATH` and `DOCS_MANIFEST_PATH`

## 0.1.1

### Patch Changes

- [#105](https://github.com/storybookjs/mcp/pull/105) [`e27f6b2`](https://github.com/storybookjs/mcp/commit/e27f6b2a78354f252715ae14dd9de321c9055cda) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Update Valibot to v1.2.0 to fix security vulnerabilities

  Valibot 1.1.0 contained 3 security vulnerabilities that are addressed in v1.2.0. This is a non-breaking security patch - no changes required for consumers.

## 0.1.0

### Minor Changes

- [#54](https://github.com/storybookjs/mcp/pull/54) [`5d18405`](https://github.com/storybookjs/mcp/commit/5d1840506f2ee4f1ae1f757ff133108a046cfc5d) Thanks [@JReinhold](https://github.com/JReinhold)! - Replace the `source` property in the context with `request`.

  Now you don't pass in a source string that might be fetched or handled by your custom `manifestProvider`, but instead you pass in the whole web request. (This is automatically handled if you use the createStorybookMcpHandler() function).

  The default action is now to fetch the manifest from `../manifests/components.json` assuming the server is running at `./mcp`. Your custom `manifestProvider()`-function then also does not get a source string as an argument, but gets the whole web request, that you can use to get information about where to fetch the manifest from. It also gets a second argument, `path`, which it should use to determine which specific manifest to get from a built Storybook. (Currently always `./manifests/components.json`, but in the future it might be other paths too).

### Patch Changes

- [#86](https://github.com/storybookjs/mcp/pull/86) [`94c01d2`](https://github.com/storybookjs/mcp/commit/94c01d2c162b5f6a20268957a17eedf7beeb7156) Thanks [@JReinhold](https://github.com/JReinhold)! - Docs toolset: output markdown instead of XML, configurable via experimentalOutput: 'markdown' | 'xml' addon option

- [#85](https://github.com/storybookjs/mcp/pull/85) [`9f75d0f`](https://github.com/storybookjs/mcp/commit/9f75d0f0d9c2e24e6ec4078526a6876ebc31f6bb) Thanks [@JReinhold](https://github.com/JReinhold)! - Allow undefined request in server context when using custom manifestProvider

- [#79](https://github.com/storybookjs/mcp/pull/79) [`a9321a3`](https://github.com/storybookjs/mcp/commit/a9321a33e6ec907eacd876d7ede368fc672d95c6) Thanks [@JReinhold](https://github.com/JReinhold)! - get-documentation now only handles one component at a time

- [#61](https://github.com/storybookjs/mcp/pull/61) [`77536a7`](https://github.com/storybookjs/mcp/commit/77536a71812fe111f6b60c84bd2c26cb0eb00bc5) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - rename examples to stories in manifest

- [#55](https://github.com/storybookjs/mcp/pull/55) [`cddbf34`](https://github.com/storybookjs/mcp/commit/cddbf34a0c99296856ecfed2c24cf689fcb2fd2a) Thanks [@JReinhold](https://github.com/JReinhold)! - Support error.name in manifests

## 0.0.7-next.0

### Patch Changes

- [#61](https://github.com/storybookjs/mcp/pull/61) [`77536a7`](https://github.com/storybookjs/mcp/commit/77536a71812fe111f6b60c84bd2c26cb0eb00bc5) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - rename examples to stories in manifest

- [#55](https://github.com/storybookjs/mcp/pull/55) [`cddbf34`](https://github.com/storybookjs/mcp/commit/cddbf34a0c99296856ecfed2c24cf689fcb2fd2a) Thanks [@JReinhold](https://github.com/JReinhold)! - Support error.name in manifests

## 0.0.6

### Patch Changes

- [#48](https://github.com/storybookjs/mcp/pull/48) [`52be338`](https://github.com/storybookjs/mcp/commit/52be33863c62c703826fa915be7eae656c18a6ed) Thanks [@JReinhold](https://github.com/JReinhold)! - Add optional "enabled" function to the directly exported tool adders. This allow you to define a function that will dynamically enable/disable the tool however you want, eg. per request condition

- [#51](https://github.com/storybookjs/mcp/pull/51) [`2028709`](https://github.com/storybookjs/mcp/commit/20287092a914fb108af1d90d64adf4c604e1a81a) Thanks [@paoloricciuti](https://github.com/paoloricciuti)! - chore: update `tmcp`

## 0.0.5

### Patch Changes

- [#42](https://github.com/storybookjs/mcp/pull/42) [`57a1602`](https://github.com/storybookjs/mcp/commit/57a16022dda428ddc303eec615b5b4c73942144c) Thanks [@JReinhold](https://github.com/JReinhold)! - Add optional event handlers to the tool calls, so you can optionally run some functionality on all tool calls

## 0.0.4

### Patch Changes

- [#38](https://github.com/storybookjs/mcp/pull/38) [`fc83cd1`](https://github.com/storybookjs/mcp/commit/fc83cd1c7f50cc0d12bc24ed427c5b38fa52acee) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - include prop types in component documentation tool

## 0.0.3

### Patch Changes

- [#32](https://github.com/storybookjs/mcp/pull/32) [`531a2d4`](https://github.com/storybookjs/mcp/commit/531a2d4be0684c94d516b76d93863337883b2bad) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Support passing in a custom manifestProvider option to the MCP server, falling back to fetch() as the default

- [#33](https://github.com/storybookjs/mcp/pull/33) [`ae6ab44`](https://github.com/storybookjs/mcp/commit/ae6ab44e4c4bdf9797facab69c6748bc7a52ba9a) Thanks [@JReinhold](https://github.com/JReinhold)! - Export tools to be merged into other MCP servers.

  Currently only [tmcp](https://github.com/paoloricciuti/tmcp)-based MCP servers supports using these tools directly.

## 0.0.2

### Patch Changes

- [#31](https://github.com/storybookjs/mcp/pull/31) [`512c958`](https://github.com/storybookjs/mcp/commit/512c9588bf6e6b39b7c4d58694229b1e67ffc1d2) Thanks [@JReinhold](https://github.com/JReinhold)! - use shared tsdown config for all monorepo packages, target node 20.19

## 0.0.1

### Patch Changes

- [#29](https://github.com/storybookjs/mcp/pull/29) [`4086e0d`](https://github.com/storybookjs/mcp/commit/4086e0d41d29a2e5c412a5cfd6bc65d97bf9ee76) Thanks [@JReinhold](https://github.com/JReinhold)! - Update documentation and repository links

- [#27](https://github.com/storybookjs/mcp/pull/27) [`2168250`](https://github.com/storybookjs/mcp/commit/2168250cc1f365a221b3c63dce375ed4bf1a583b) Thanks [@JReinhold](https://github.com/JReinhold)! - Initial release

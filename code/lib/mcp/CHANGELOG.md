# @storybook/mcp

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

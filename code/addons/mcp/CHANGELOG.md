# @storybook/addon-mcp

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

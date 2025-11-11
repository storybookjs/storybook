# @storybook/addon-mcp

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

# @storybook/addon-mcp

## 0.1.0

### Minor Changes

- [#36](https://github.com/storybookjs/mcp/pull/36) [`93f88e4`](https://github.com/storybookjs/mcp/commit/93f88e4a28c3dae1b4c02c29839eb5e8b9375146) Thanks [@JReinhold](https://github.com/JReinhold)! - Add support for Webpack (including Webpack-based frameworks like Next.js)

  # Breaking Change

  This requires version 10.1 of Storybook, currently only available as the canary version `0.0.0-pr-32810-sha-6e759c7e`. If you want to continue to use the addon with Storybook 9 or 10.0 (and Vite), stick to [version `0.0.9` of this package](https://github.com/storybookjs/mcp/tree/%40storybook/addon-mcp%400.0.9).

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

# @storybook/mcp

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

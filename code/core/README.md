# @storybook/core

The shared runtime, types and Node utilities behind `storybook`.
Internal: users import them through `storybook/*`.

- Contents: instance, hooks and the legacy preset bridge, story index, services, open services and toolsets, preview page, csf, csf-tools, channels, preview, preview-api, test, telemetry, types, Node utilities.
- Imported by: `@storybook/ui`, `@storybook/manager`, `@storybook/open-service`, `storybook`, and the Node side of frameworks, renderers, builders, presets and addons.
  - Addon postinstall scripts stay on `storybook/*`.
- Direction: `core <- ui <- manager <- storybook`; `@storybook/open-service` sits on core alone. Core imports no other Storybook package, relatively or through `storybook/*`.
- Product-specific behaviour (built-in features, server, CLI) is injected by `storybook`, never imported.
- The root entry `@storybook/core` is the public instance API: `createStorybook`, `defineAddon`, `defineBuilder`, `defineFramework`, `defineRenderer`, `declareHooks`, the instance accessors, `getFeatures`, and their types.
  - `@storybook/core/internal/instance` adds the legacy bridge and internal helpers on top of it.
- Other entries are `@storybook/core/internal/<area>` (for example `@storybook/core/internal/types`), plus `@storybook/core/open-service`, `@storybook/core/preview-api`, and `@storybook/core/test`.
  - Most mirror a `storybook/internal/*` subpath; `storybook/manager-api` and `storybook/theming` come from `@storybook/manager` and `@storybook/ui`.
  - `@storybook/core/internal/deep/*` reaches any source module, for tests in the upper packages.

See the [instance README](./src/instance/README.md) for the full source layout and import rules.

# @storybook/ui

The components and theming shared by the Storybook manager and addons.
Internal: import them through `storybook/internal/components` and `storybook/theming`.

- Contents: `src/components/`, `src/theming/` and `src/tour-guide/` (`./internal/tour-guide`, re-exported as `storybook/internal/tour-guide`).
- Imported by: `@storybook/manager` and `storybook`.
- Direction: `core <- ui <- manager <- storybook`. UI imports only `@storybook/core`.
- Entries mirror the `storybook/*` subpaths, for example `@storybook/ui/theming`.

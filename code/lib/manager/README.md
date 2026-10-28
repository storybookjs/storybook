# @storybook/manager

The Storybook manager app, manager API, router and manager builder.
Internal: import them through `storybook/manager-api` and `storybook/internal/*`.

- Contents: `src/ui/`, `src/manager-api/`, `src/router/`, `src/builder-manager/`, `src/shared/`.
- Imported by: `storybook`.
- Direction: `core <- ui <- manager <- storybook`. The manager imports only `@storybook/ui` and `@storybook/core`.
- Entries mirror the `storybook/*` subpaths, for example `@storybook/manager/manager-api`.
- Manager globals: `globalsPackageSpecifiers` (`src/ui/globals/globals.ts`) lists the `@storybook/*` twin of each globalized `storybook/*` key, and `globalsModuleInfoMap` (`src/ui/globals/globals-module-info.ts`) maps both to one global. Pinned by `src/ui/globals/globals.test.ts`.

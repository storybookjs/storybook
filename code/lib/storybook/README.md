<p align="center">
  <a href="https://storybook.js.org/?ref=readme">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://user-images.githubusercontent.com/263385/199832481-bbbf5961-6a26-481d-8224-51258cce9b33.png">
      <img src="https://user-images.githubusercontent.com/321738/63501763-88dbf600-c4cc-11e9-96cd-94adadc2fd72.png" alt="Storybook" width="400" />
    </picture>
    
  </a>
  
</p>

<p align="center">Build bulletproof UI components faster</p>

<br/>

<p align="center">
Storybook is a frontend workshop for building UI components and pages in isolation. Thousands of teams use it for UI development, testing, and documentation. Find out more at <a href="https://storybook.js.org/?ref=readme">storybook.js.org</a>!
</p>

<center>
  <img src="https://raw.githubusercontent.com/storybookjs/storybook/refs/heads/release-6-5/media/storybook-intro.gif" width="100%" />
</center>

---

# Storybook

The `storybook` package is the product entry point.
Users install it, and its `storybook/*` subpaths stay the public import surface.

Learn more about Storybook at [storybook.js.org](https://storybook.js.org/?ref=readme).

## Package split

The code lives in several packages:

- `@storybook/core`: the instance, hooks, services, toolsets and shared runtime code.
- `@storybook/ui`: components and theming.
- `@storybook/manager`: the manager app, manager API, router and manager builder.
- `storybook`: this package.
- `@storybook/open-service`: the Node tools SDK; it imports only `@storybook/core`.

Direction: `core <- ui <- manager <- storybook`.
Many `storybook/*` subpaths are shims that re-export the lower packages.

The root entry `storybook` (`src/index.ts`) is what `main.ts` imports: `defineMain`, `defineAddon`, and the `StorybookConfig`, `StorybookFrameworks`, `Storybook`, `StorybookAddon`, `MainConfig`, `MainTypes`, `StorybookHooks` and `HookHandler` types, re-exported from `@storybook/core`.
Addon and tool authors import the rest of the instance API (`defineFramework`, `defineBuilder`, `defineRenderer`, `declareHooks`, `createStorybook`) from `@storybook/core`.

## What this package owns

- The CLI (`src/storybook/bin`, `src/storybook/cli`).
- The dev server and static build (`src/storybook/server`, see its [README](./src/storybook/server/README.md)).
- Compatibility for presets and older configurations (`src/storybook/compat`).
- Built-in features such as controls, actions, viewport and the interaction debugger (`src/features`).

Official packages register as addons with no preset.
How legacy presets still load is in the [instance README](../../core/src/instance/README.md); the user-facing change is in [MIGRATION.md](../../../MIGRATION.md#official-packages-no-longer-export-presets).

## Copied runtimes

The build copies `mocker-runtime.js` from the `@storybook/core` dist into `dist` (see `scripts/copy-runtimes.ts`), because an `exports` target cannot point outside its package and the browser loads it by path.
The manager globals runtime is built by this package from `src/shims/internal/manager/globals-runtime.ts`.

---
title: 'Main configuration'
---

The main configuration defines a Storybook project's behavior, including the location of stories, addons to use, feature flags, and other project-specific settings.

## `main.js` or `main.ts`

This configuration is defined in `.storybook/main.js|ts`, which is located relative to the root of your project.

A typical Storybook configuration file looks like this:

<CodeSnippets
paths={[
'common/main-config-typical.js.mdx',
'common/main-config-typical.ts.mdx',
]}
/>

## config

An object to configure Storybook containing the following properties:

- [`framework`](./main-config-framework.md) (Required)
- [`stories`](./main-config-stories.md) (Required)
- [`addons`](./main-config-addons.md)
- [`babel`](./main-config-babel.md)
- [`babelDefault`](./main-config-babel-default.md)
- [`build`](./main-config-build.md)
- [`core`](./main-config-core.md)
- [`docs`](./main-config-docs.md)
- [`env`](./main-config-env.md)
- [`features`](./main-config-features.md)
- [`indexers`](./main-config-indexers.md) (⚠️ Experimental)
- [`logLevel`](./main-config-log-level.md)
- [`managerHead`](./main-config-manager-head.md)
- [`previewAnnotations`](./main-config-preview-annotations.md)
- [`previewBody`](./main-config-preview-body.md)
- [`previewHead`](./main-config-preview-head.md)
- [`refs`](./main-config-refs.md)
- [`staticDirs`](./main-config-static-dirs.md)
- [`swc`](./main-config-swc.md)
- [`typescript`](./main-config-typescript.md)
- [`viteFinal`](./main-config-vite-final.md)
- [`webpackFinal`](./main-config-webpack-final.md)
- [`config`](./main-config-config.md) (⛔️ Deprecated)

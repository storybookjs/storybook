# Storybook for SvelteKit <!-- omit in toc -->

Our goal is to help you use the tools you love together with Storybook. That’s why Storybook has zero-config support for SvelteKit with the `@storybook/sveltekit` package.

Check out our [Frameworks API](https://storybook.js.org/blog/framework-api/) announcement for what this all means for you and our continued efforts to make Storybook a seamless integration for any project.

## Table of Contents <!-- omit in toc -->

- [Supported features](#supported-features)
- [Requirements](#requirements)
- [Getting Started](#getting-started)
  - [In a project without Storybook](#in-a-project-without-storybook)
  - [In a project with Storybook](#in-a-project-with-storybook)
    - [Automatic migration](#automatic-migration)
    - [Manual migration](#manual-migration)
- [How to mock](#how-to-mock)
  - [Mocking links](#mocking-links)
- [Troubleshooting](#troubleshooting)
  - [Error: `ERR! SyntaxError: Identifier '__esbuild_register_import_meta_url__' has already been declared` when starting Storybook](#error-err-syntaxerror-identifier-__esbuild_register_import_meta_url__-has-already-been-declared-when-starting-storybook)
- [Acknowledgements](#acknowledgements)

## Supported features

All Svelte language features are supported out of the box, as Storybook uses the Svelte compiler underneath.
However SvelteKit has some [Kit-specific modules](https://kit.svelte.dev/docs/modules) that currently aren't supported. It's on our roadmap to support most of them soon:

| **Module**                                                                         | **Status**             | **Note**                                                                                                                            |
| ---------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| [`$app/environment`](https://kit.svelte.dev/docs/modules#$app-environment)         | ✅ Supported           | `version` is always empty in Storybook.                                                                                             |
| [`$app/forms`](https://kit.svelte.dev/docs/modules#$app-forms)                     | ✅ Supported           | See [How to mock](#how-to-mock)                                                                                                     |
| [`$app/navigation`](https://kit.svelte.dev/docs/modules#$app-navigation)           | ✅ Supported           | See [How to mock](#how-to-mock)                                                                                                     |
| [`$app/paths`](https://kit.svelte.dev/docs/modules#$app-paths)                     | ✅ Supported           | Requires SvelteKit 1.4.0 or newer                                                                                                   |
| [`$app/stores`](https://kit.svelte.dev/docs/modules#$app-stores)                   | ✅ Supported           | See [How to mock](#how-to-mock)                                                                                                     |
| [`$env/dynamic/private`](https://kit.svelte.dev/docs/modules#$env-dynamic-private) | ⛔ Not supported       | They are meant to only be available server-side, and Storybook renders all components on the client.                                |
| [`$env/dynamic/public`](https://kit.svelte.dev/docs/modules#$env-dynamic-public)   | 🚧 Partially supported | Only supported in development mode. Storybook is built as a static app with no server-side API so cannot dynamically serve content. |
| [`$env/static/private`](https://kit.svelte.dev/docs/modules#$env-static-private)   | ⛔ Not supported       | They are meant to only be available server-side, and Storybook renders all components on the client.                                |
| [`$env/static/public`](https://kit.svelte.dev/docs/modules#$env-static-public)     | ✅ Supported           |                                                                                                                                     |
| [`$lib`](https://kit.svelte.dev/docs/modules#$lib)                                 | ✅ Supported           |                                                                                                                                     |
| [`$service-worker`](https://kit.svelte.dev/docs/modules#$service-worker)           | ⛔ Not supported       | They are only meant to be used in service workers                                                                                   |
| [`@sveltejs/kit/*`](https://kit.svelte.dev/docs/modules#sveltejs-kit)              | ✅ Supported           |                                                                                                                                     |

This is just the beginning. We're close to adding basic support for many of the SvelteKit features. Longer term we're planning on making it an even better experience to [build](https://storybook.js.org/docs/svelte/writing-stories), [test](https://storybook.js.org/docs/svelte/writing-tests) and [document](https://storybook.js.org/docs/svelte/writing-docs) all the SvelteKit goodies like [pages](https://kit.svelte.dev/docs/routing), [forms](https://kit.svelte.dev/docs/form-actions) and [layouts](https://kit.svelte.dev/docs/routing#layout) in Storybook, while still integrating with all the addons and workflows you know and love.

## Requirements

- [SvelteKit](https://kit.svelte.dev/) >= 1.0.0 (not including beta versions)
- [Storybook](https://storybook.js.org/) >= 7.x

## Getting Started

### In a project without Storybook

Run the following command in your SvelteKit project's root directory, and follow the prompts:

```bash
npx storybook@latest init
```

[More on getting started with Storybook](https://storybook.js.org/docs/svelte/get-started/install)

### In a project with Storybook

This framework is designed to work with Storybook 7. If you’re not already using v7, upgrade with this command:

```bash
npx storybook@latest upgrade
```

#### Automatic migration

When running the `upgrade` command above you should get a prompt asking you to migrate to `@storybook/sveltekit`, which should handle everything for you. In some cases it can't migrate for you, eg. if your existing Storybook setup is based on Webpack. In such cases, refer to the manual migration below.

Storybook 7.0 automatically loads your Vite config, and by extension your Svelte config. If you had a `svelteOptions` property in `.storybook/main.js` the automigration will have removed it, as it is no longer supported.

#### Manual migration

Install the framework:

```bash
yarn add -D @storybook/sveltekit
```

Update your `main.js` to change the framework property:

```js
// .storybook/main.js
export default {
  ...
  framework: '@storybook/sveltekit',
};
```

Storybook 7.0 automatically loads your Vite config, and by extension your Svelte config. If you have a `svelteOptions` property in `.storybook/main.js` you need to remove that. See [Troubleshooting](#error-about-__esbuild_register_import_meta_url__-when-starting-storybook) below.

Remove any redundant dependencies, if you have them:

```bash
yarn remove @storybook/svelte-vite
yarn remove @storybook/svelte-webpack5
yarn remove storybook-builder-vite
yarn remove @storybook/builder-vite
```

## How to mock

To mock a SvelteKit import you can set it on `parameters.sveltekit_experimental`:

```ts
export const MyStory = {
  parameters: {
    sveltekit_experimental: {
      stores: {
        page: {
          data: {
            test: 'passed',
          },
        },
        navigating: {
          route: {
            id: '/storybook',
          },
        },
        updated: true,
      },
    },
  },
};
```

You can add the name of the module you want to mock to `parameters.sveltekit_experimental` (in the example above we are mocking the `stores` module which correspond to `$app/stores`) and then pass the following kind of objects:

| Module                                            | Path in parameters                                           | Kind of objects                                                                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `import { page } from "$app/stores"`              | `parameters.sveltekit_experimental.stores.page`              | A Partial of the page store                                                                                                               |
| `import { navigating } from "$app/stores"`        | `parameters.sveltekit_experimental.stores.navigating`        | A Partial of the navigating store                                                                                                         |
| `import { updated } from "$app/stores"`           | `parameters.sveltekit_experimental.stores.updated`           | A boolean representing the value of updated (you can also access `check()` which will be a noop)                                          |
| `import { goto } from "$app/navigation"`          | `parameters.sveltekit_experimental.navigation.goto`          | A callback that will be called whenever goto is called, in no function is provided an action will be logged to the Actions panel          |
| `import { pushState } from "$app/navigation"`     | `parameters.sveltekit_experimental.navigation.pushState`     | A callback that will be called whenever pushState is called, in no function is provided an action will be logged to the Actions panel     |
| `import { replaceState } from "$app/navigation"`  | `parameters.sveltekit_experimental.navigation.replaceState`  | A callback that will be called whenever replaceState is called, in no function is provided an action will be logged to the Actions panel  |
| `import { invalidate } from "$app/navigation"`    | `parameters.sveltekit_experimental.navigation.invalidate`    | A callback that will be called whenever invalidate is called, in no function is provided an action will be logged to the Actions panel    |
| `import { invalidateAll } from "$app/navigation"` | `parameters.sveltekit_experimental.navigation.invalidateAll` | A callback that will be called whenever invalidateAll is called, in no function is provided an action will be logged to the Actions panel |
| `import { afterNavigate } from "$app/navigation"` | `parameters.sveltekit_experimental.navigation.afterNavigate` | An object that will be passed to the afterNavigate function (which will be invoked onMount) called                                        |
| `import { enhance } from "$app/forms"`            | `parameters.sveltekit_experimental.forms.enhance`            | A callback that will called when a form with `use:enhance` is submitted                                                                   |

All the other functions are still exported as `noop` from the mocked modules so that your application will still work.

### Mocking links

The default link-handling behavior (ie. clicking an `<a />` tag with an `href` attribute) is to log an action to the Actions panel.

You can override this by setting an object on `parameter.sveltekit_experimental.hrefs`, where the keys are strings representing an href and the values are objects typed as `{ callback: (href, event) => void, asRegex?: boolean }`.

If you have an `<a />` tag inside your code with the `href` attribute that matches one or more of the links defined (treated as regex based on the `asRegex` property) the corresponding `callback` will be called.

Example:

```ts
export const MyStory = {
  parameters: {
    sveltekit_experimental: {
      hrefs: {
        '/basic-href': (to, event) => {
          console.log(to, event);
        },
        '/root.*': {
          callback: (to, event) => {
            console.log(to, event);
          },
          asRegex: true,
        },
      },
    },
  },
};
```

## Troubleshooting

### Error: `ERR! SyntaxError: Identifier '__esbuild_register_import_meta_url__' has already been declared` when starting Storybook

> When starting Storybook after upgrading to v7.0, it breaks with the following error:
>
> ```
> ERR! SyntaxError: Identifier '__esbuild_register_import_meta_url__' has already been declared
> ```

You'll get this error when manually upgrading from 6.5 to 7.0. You need to remove the `svelteOptions` property in `.storybook/main.js`, as that is not supported by Storybook 7.0 + SvelteKit. The property is also not necessary anymore because the Vite and Svelte configurations are loaded automatically in Storybook 7.0.

### Error: `Cannot read properties of undefined (reading 'disable_scroll_handling')` in preview

> Some stories don't load, instead they show the following error in the preview:
>
> ```
> Cannot read properties of undefined (reading 'disable_scroll_handling')
> ```

You'll experience this if anything in your story is importing from `$app/forms` or `$app/navigation`, which is currently not supported. To get around this, separate your component into a shallow parent component that imports what's needed and passes it to a child component via props. This way you can write stories for your child component and mock any of the necessary modules by passing props in.

## Acknowledgements

Integrating with SvelteKit would not have been possible if it weren't for the fantastic efforts by the Svelte core team - especially [Ben McCann](https://twitter.com/benjaminmccann) - to make integrations with the wider ecosystem possible.
A big thank you also goes out to [Paolo Ricciuti](https://twitter.com/PaoloRicciuti) for improving the mocking capabilities.

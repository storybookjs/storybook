---
title: 'Essential addons'
hideRendererSelector: true
---

A major strength of Storybook are [addons](https://storybook.js.org/addons) that extend Storybook’s UI and behavior. Storybook ships by default with a set of “essential” addons that add to the initial user experience. There are many third-party addons as well as “official” addons developed by the Storybook core team.

- [Actions](./actions.md)
- [Backgrounds](./backgrounds.md)
- [Controls](./controls.md)
- [Docs](../writing-docs/index.md)
- [Highlight](./highlight.md)
- [Measure & outline](./measure-and-outline.md)
- [Toolbars & globals](./toolbars-and-globals.md)
- [Viewport](./viewport.md)

### Installation

If you ran `npx storybook@latest init` to include Storybook in your project, the latest version of the Essentials addon ([`@storybook/addon-essentials`](https://storybook.js.org/addons/tag/essentials)) is already installed and configured for you. You can go ahead and skip the rest of this section.

However, if you intend to install the Essentials addon manually into an existing Storybook instance, you can do so by running the following command in your terminal:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/storybook-addon-essentials-install.yarn.js.mdx',
    'common/storybook-addon-essentials-install.npm.js.mdx',
    'common/storybook-addon-essentials-install.pnpm.js.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

Update your Storybook configuration (in [`.storybook/main.js|ts`](../configure/index.md#configure-story-rendering)) to include the Essentials addon.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/storybook-main-register-essentials-addon.js.mdx',
    'common/storybook-main-register-essentials-addon.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

### Configuration

Essentials is "zero-config”. It comes with a recommended configuration out of the box.

If you need to reconfigure any of the [individual Essentials addons](https://storybook.js.org/addons/tag/essentials), install them manually by following the installation instructions, and depending on the method of choice, register them in your Storybook configuration file (i.e., [`.storybook/main.js|ts`](../configure/index.md#configure-story-rendering)) and adjust the configuration to suit your needs. For example:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/storybook-addon-actions-install.yarn.js.mdx',
    'common/storybook-addon-actions-install.npm.js.mdx',
    'common/storybook-addon-actions-install.pnpm.js.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/storybook-main-register-individual-actions-addon.js.mdx',
    'common/storybook-main-register-individual-actions-addon.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

Below is an abridged configuration and table with all the available options for each addon.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/storybook-main-full-individual-essentials-config.js.mdx',
    'common/storybook-main-full-individual-essentials-config.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

| Addon                          | Option             | Description                                                                                                                                                   |
| ------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@storybook/addon-actions`     | N/A                | N/A                                                                                                                                                           |
| `@storybook/addon-viewport`    | N/A                | N/A                                                                                                                                                           |
| `@storybook/addon-docs`        | `csfPluginOptions` | Provides additional configuration for Storybook's CSF plugin. Can be disabled with `null`.                                                                    |
|                                | `mdxPluginOptions` | Provides additional configuration options and plugin configuration for [MDX documentation](../writing-docs/mdx.md#markdown-tables-arent-rendering-correctly). |
| `@storybook/addon-controls`    | N/A                | N/A                                                                                                                                                           |
| `@storybook/addon-backgrounds` | N/A                | N/A                                                                                                                                                           |
| `@storybook/addon-toolbars`    | N/A                | N/A                                                                                                                                                           |
| `@storybook/addon-measure`     | N/A                | N/A                                                                                                                                                           |

When you start Storybook, your custom configuration will override the default.

### Disabling addons

If you need to disable any of the Essential's addons, you can do it by changing your [`.storybook/main.js`](../configure/index.md#configure-story-rendering) file.

For example, if you wanted to disable the [backgrounds addon](./backgrounds.md), you would apply the following change to your Storybook configuration:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/storybook-main-disable-addon.js.mdx',
    'common/storybook-main-disable-addon.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

<Callout variant="info" icon="💡">

You can use the following keys for each individual addon: `actions`, `backgrounds`, `controls`, `docs`, `viewport`, `toolbars`, `measure`, `outline`, and `highlight`.

</Callout>

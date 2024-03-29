---
title: 'Install addons'
---

Storybook has [hundreds of reusable addons](https://storybook.js.org/integrations) packaged as NPM modules. Let's walk through how to extend Storybook by installing and registering addons.

## Automatic installation

Storybook includes a [`storybook add`](../api/cli-options.md#add) command to automate the setup of addons. Several community-led addons can be added using this command, except for preset addons. We encourage you to read the addon's documentation to learn more about its installation process.

Run the `storybook add` command using your chosen package manager, and the CLI will update your Storybook configuration to include the addon and install any necessary dependencies.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/storybook-add-command.yarn.js.mdx',
    'common/storybook-add-command.npm.js.mdx',
    'common/storybook-add-command.pnpm.js.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

<Callout variant="warning">

If you're attempting to install multiple addons at once, it will only install the first addon that was specified. This is a known limitation of the current implementation and will be addressed in a future release.

</Callout>

### Manual installation

Storybook addons are always added through the [`addons`](../api/main-config-addons.md) configuration array in [`.storybook/main.js|ts`](../configure/index.md). The following example shows how to manually add the [Accessibility addon](https://storybook.js.org/addons/@storybook/addon-a11y) to Storybook.

Run the following command with your package manager of choice to install the addon.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/storybook-a11y-install.yarn.js.mdx',
    'common/storybook-a11y-install.npm.js.mdx',
    'common/storybook-a11y-install.pnpm.js.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

Next, update `.storybook/main.js|ts` to the following:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/storybook-a11y-register.js.mdx',
    'common/storybook-a11y-register.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

When you run Storybook, the accessibility testing addon will be enabled.

![Storybook addon installed and registered](./storybook-addon-installed-registered.png)

### Removing addons

To remove an addon from Storybook, you can choose to manually uninstall it and remove it from the configuration file (i.e., [`.storybook/main.js|ts`](../configure/index.md)) or opt-in to do it automatically via the CLI with the [`remove`](../api/cli-options.md#remove) command. For example, to remove the [Accessibility addon](https://storybook.js.org/addons/@storybook/addon-a11y) from Storybook with the CLI, run the following command:

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/storybook-remove-command.yarn.js.mdx',
    'common/storybook-remove-command.npm.js.mdx',
    'common/storybook-remove-command.pnpm.js.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

<p align="center">
  <a href="https://storybook.js.org/?ref=readme">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./media/logo-default-dark.svg">
      <img src="./media/logo-default-light.svg" alt="Storybook" width="400" />
    </picture>
  </a>
</p>

<p align="center">Build, test & document components</p>

<br/>

<p align="center">
  <a href="https://github.com/storybookjs/storybook/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/storybookjs/storybook.svg?color=2A0481" alt="License" />
  </a>
  <a href="https://www.npmjs.com/package/storybook">
    <img src="https://img.shields.io/npm/dw/storybook?style=flat&logo=npm&color=CB3837" alt="NPM downloads per week" />
  </a>
  <img src="https://img.shields.io/github/stars/storybookjs/storybook?style=flat&logo=github&color=181717" alt="" />
  <a href="https://discord.gg/storybook">
    <img src="https://img.shields.io/badge/discord-join-7289DA.svg?logo=discord&longCache=true&style=fla&logoColor=white" alt="Join our Discord" />
  </a>
  <a href="https://storybook.js.org/community/?ref=readme">
    <img src="https://img.shields.io/badge/community-join-FF4785.svg?logo=storybook&logoColor=white" alt="Storybook Community" />
  </a>
  <a href="https://bsky.app/profile/storybook.js.org">
    <img src="https://img.shields.io/badge/bluesky-follow-1185FE?style=shield&logo=bluesky&longCache=true&style=flat&logoColor=white" alt="Follow Storybook on BlueSky" />
  </a>
  <a href="https://x.com/intent/follow?screen_name=storybookjs">
    <img src="https://img.shields.io/badge/@storybookjs-follow-000?style=shield&logo=x&longCache=true&style=flat&logoColor=white" alt="Follow Storybook on X" />
  </a>
</p>
<center>
  <img src="https://raw.githubusercontent.com/storybookjs/storybook/refs/heads/next/media/storybook-intro.gif" alt="Storybook lets you build UI components and pages in isolation, mock hard-to-reach edge cases as stories, and use stories as tests" width="100%" />
</center>

<p align="center">
Storybook is a frontend workshop for building UI components and pages in isolation. Thousands of teams use it for UI development, testing, and documentation. Find out more at <a href="https://storybook.js.org/?ref=readme">storybook.js.org</a>!
</p>



## Table of contents

- 🚀 [Getting Started](#getting-started)
- 🤖 [AI](#ai)
- 📒 [Projects](#projects)
  - 🛠 [Supported Frameworks](#supported-frameworks)
  - 🔗 [Addons](#addons)
- 👥 [Community](#community)
- 👏 [Contributing](#contributing)
  - 👨‍💻 [Development scripts](#development-scripts)
  - 💸 [Sponsors](#sponsors)
  - 💵 [Backers](#backers)
- 🏅 [Badges & Presentation materials](#badges--presentation-materials)
- 📝 [License](#license)

## Getting Started

Run this command at the root of an existing project to install and configure Storybook:

```sh
npm create storybook@latest
```

Or paste this prompt into your agent:

```text
Set up Storybook for me with npm create storybook@latest and follow its instructions precisely
```

Visit [Storybook's website](https://storybook.js.org/?ref=readme) to learn more about Storybook, or follow the [installation guide](https://storybook.js.org/docs/get-started/install?ref=readme) for other package managers and manual setup.

### Documentation

Documentation can be found on [Storybook's docs site](https://storybook.js.org/docs?ref=readme). To learn Storybook step by step, follow the [tutorials](https://storybook.js.org/tutorials/?ref=readme).

### Examples

View the [Storybook Showcase](https://storybook.js.org/showcase?ref=readme) to see how leading teams use Storybook.

Use [storybook.new](https://storybook.new) to quickly create an example project in Stackblitz.

## AI

Storybook makes building UI with agents faster, better and cheaper. Your agent reuses the components you already have, writes stories for what it builds, tests its work by running stories, and gives you a visual review to check the result.

### Skills and the CLI

Run this command in the root of your project to install Storybook's skills:

```sh
npx storybook automigrate skills
```

Skills are short instruction files in your repository that tell your agent what to do at each step of a UI change. Most AI agents support skills. Your agent learns how to interact with Storybook by reading skill files, and then calls the `storybook tools` command to get work done:

| Command                           |                                                                             |
| --------------------------------- | --------------------------------------------------------------------------- |
| `storybook tools docs list`       | List all components and docs entries                                        |
| `storybook tools docs show`       | Show the props and usage examples of a component                            |
| `storybook tools stories changed` | List the stories that are new, modified, or affected by uncommitted changes |
| `storybook tools test run`        | Run story tests, with accessibility checks if set up                        |
| `storybook tools review create`   | Publish a review of the stories that a change affects                       |

See [Connect your agent](https://storybook.js.org/docs/ai/connect?ref=readme) to get started, and the [CLI options](https://storybook.js.org/docs/api/cli-options?ref=readme#tools) for all the tools. If you want your agent to call Storybook through MCP tools instead of CLI commands, the [MCP addon](code/addons/mcp/) serves the same tools from your dev server.

These features are available for React, Next, TanStack, Vue, Angular, Svelte, Web Components and multiple community frameworks. Check the [supported frameworks](https://storybook.js.org/docs/ai/connect?ref=readme#supported-frameworks) for more details.

### Published Storybooks

When you [publish your Storybook with Chromatic](https://storybook.js.org/docs/sharing/publish-storybook?ref=readme#publish-storybook-with-chromatic), Chromatic also publishes its MCP server, at your published Storybook's URL followed by `/mcp`:

```
https://<branch>--<app-id>.chromatic.com/mcp
```

Agents that connect to the MCP server can look up your components, with their props and usage examples, without running Storybook. This lets the teams that build with your design system reuse its components from their own repositories. Chromatic MCP hosting is entirely free. See [Use a published Storybook](https://storybook.js.org/docs/ai/published-storybook?ref=readme) and [Chromatic's setup guide](https://chromatic.com/docs/storybook-mcp/) for more details.

## Projects

### Supported Frameworks

| Framework                                                   | Version                                                                                                                                                                        | Downloads                                                                                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [React](code/frameworks/react-vite)                         | [![](https://img.shields.io/npm/v/@storybook/react-vite/latest?style=flat-square&color=blue&label)](https://www.npmjs.com/package/@storybook/react-vite)                       | [![React](https://img.shields.io/npm/dm/@storybook/react-vite?style=flat-square&color=eee)](code/frameworks/react-vite)                                  |
| [Next.js](code/frameworks/nextjs-vite)                      | [![](https://img.shields.io/npm/v/@storybook/nextjs-vite/latest?style=flat-square&color=blue&label)](https://www.npmjs.com/package/@storybook/nextjs-vite)                     | [![Next.js](https://img.shields.io/npm/dm/@storybook/nextjs-vite?style=flat-square&color=eee)](code/frameworks/nextjs-vite)                              |
| [TanStack React](code/frameworks/tanstack-react)            | [![](https://img.shields.io/npm/v/@storybook/tanstack-react/latest?style=flat-square&color=blue&label)](https://www.npmjs.com/package/@storybook/tanstack-react)               | [![TanStack React](https://img.shields.io/npm/dm/@storybook/tanstack-react?style=flat-square&color=eee)](code/frameworks/tanstack-react)                 |
| [React Native Web](code/frameworks/react-native-web-vite)   | [![](https://img.shields.io/npm/v/@storybook/react-native-web-vite/latest?style=flat-square&color=blue&label)](https://www.npmjs.com/package/@storybook/react-native-web-vite) | [![React Native Web](https://img.shields.io/npm/dm/@storybook/react-native-web-vite?style=flat-square&color=eee)](code/frameworks/react-native-web-vite) |
| [React Native](https://github.com/storybookjs/react-native) | [![](https://img.shields.io/npm/v/@storybook/react-native/latest?style=flat-square&color=blue&label)](https://www.npmjs.com/package/@storybook/react-native)                   | [![React Native](https://img.shields.io/npm/dm/@storybook/react-native?style=flat-square&color=eee)](https://github.com/storybookjs/react-native)        |
| [Vue 3](code/frameworks/vue3-vite)                          | [![](https://img.shields.io/npm/v/@storybook/vue3-vite/latest?style=flat-square&color=blue&label)](https://www.npmjs.com/package/@storybook/vue3-vite)                         | [![Vue 3](https://img.shields.io/npm/dm/@storybook/vue3-vite?style=flat-square&color=eee)](code/frameworks/vue3-vite)                                    |
| [Angular](code/frameworks/angular-vite)                     | [![](https://img.shields.io/npm/v/@storybook/angular-vite/latest?style=flat-square&color=blue&label)](https://www.npmjs.com/package/@storybook/angular-vite)                   | [![Angular](https://img.shields.io/npm/dm/@storybook/angular-vite?style=flat-square&color=eee)](code/frameworks/angular-vite)                            |
| [SvelteKit](code/frameworks/sveltekit)                      | [![](https://img.shields.io/npm/v/@storybook/sveltekit/latest?style=flat-square&color=blue&label)](https://www.npmjs.com/package/@storybook/sveltekit)                         | [![SvelteKit](https://img.shields.io/npm/dm/@storybook/sveltekit?style=flat-square&color=eee)](code/frameworks/sveltekit)                                |
| [Svelte](code/frameworks/svelte-vite)                       | [![](https://img.shields.io/npm/v/@storybook/svelte-vite/latest?style=flat-square&color=blue&label)](https://www.npmjs.com/package/@storybook/svelte-vite)                     | [![Svelte](https://img.shields.io/npm/dm/@storybook/svelte-vite?style=flat-square&color=eee)](code/frameworks/svelte-vite)                               |
| [Web components](code/frameworks/web-components-vite)       | [![](https://img.shields.io/npm/v/@storybook/web-components-vite/latest?style=flat-square&color=blue&label)](https://www.npmjs.com/package/@storybook/web-components-vite)     | [![Web components](https://img.shields.io/npm/dm/@storybook/web-components-vite?style=flat-square&color=eee)](code/frameworks/web-components-vite)       |
| [Preact](code/frameworks/preact-vite)                       | [![](https://img.shields.io/npm/v/@storybook/preact-vite/latest?style=flat-square&color=blue&label)](https://www.npmjs.com/package/@storybook/preact-vite)                     | [![Preact](https://img.shields.io/npm/dm/@storybook/preact-vite?style=flat-square&color=eee)](code/frameworks/preact-vite)                               |
| [HTML](code/frameworks/html-vite)                           | [![](https://img.shields.io/npm/v/@storybook/html-vite/latest?style=flat-square&color=blue&label)](https://www.npmjs.com/package/@storybook/html-vite)                         | [![HTML](https://img.shields.io/npm/dm/@storybook/html-vite?style=flat-square&color=eee)](code/frameworks/html-vite)                                     |

The community maintains frameworks for other libraries, including:

| Community framework                                       | Version                                                                                                                                                            | Downloads                                                                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [Astro](https://storybook-astro.org)                      | [![](https://img.shields.io/npm/v/@storybook-astro/framework/latest?style=flat-square&color=blue&label)](https://www.npmjs.com/package/@storybook-astro/framework) | [![Astro](https://img.shields.io/npm/dm/@storybook-astro/framework?style=flat-square&color=eee)](https://storybook-astro.org)                  |
| [Nuxt](https://storybook.nuxtjs.org)                      | [![](https://img.shields.io/npm/v/@storybook-vue/nuxt/latest?style=flat-square&color=blue&label)](https://www.npmjs.com/package/@storybook-vue/nuxt)               | [![Nuxt](https://img.shields.io/npm/dm/@storybook-vue/nuxt?style=flat-square&color=eee)](https://storybook.nuxtjs.org)                         |
| [SolidJS](https://github.com/solidjs-community/storybook) | [![](https://img.shields.io/npm/v/storybook-solidjs-vite/latest?style=flat-square&color=blue&label)](https://www.npmjs.com/package/storybook-solidjs-vite)         | [![SolidJS](https://img.shields.io/npm/dm/storybook-solidjs-vite?style=flat-square&color=eee)](https://github.com/solidjs-community/storybook) |

See the [frameworks documentation](https://storybook.js.org/docs/get-started/frameworks?ref=readme) for requirements and setup instructions.

### Addons

[Addons](https://storybook.js.org/docs/configure/user-interface/storybook-addons?ref=readme) extend Storybook with features for component design, documentation, testing, interactivity, and so on. Add one to your project with `npx storybook add <package>`.

| Addons                                                                |                                                                           | Downloads                                                                                                                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [docs](code/addons/docs/)                                             | Add high quality documentation to your components                         | [![docs](https://img.shields.io/npm/dm/@storybook/addon-docs?style=flat-square&color=eee)](code/addons/docs/)                                                  |
| [a11y](code/addons/a11y/)                                             | Test that your components are accessible                                  | [![a11y](https://img.shields.io/npm/dm/@storybook/addon-a11y?style=flat-square&color=eee)](code/addons/a11y/)                                                  |
| [links](code/addons/links/)                                           | Create links between stories                                              | [![links](https://img.shields.io/npm/dm/@storybook/addon-links?style=flat-square&color=eee)](code/addons/links/)                                               |
| [vitest](code/addons/vitest/)                                         | Run your stories as tests in Vitest browser mode                          | [![vitest](https://img.shields.io/npm/dm/@storybook/addon-vitest?style=flat-square&color=eee)](code/addons/vitest/)                                            |
| [visual tests](https://github.com/chromaui/addon-visual-tests)        | Catch unexpected visual changes in your stories using Chromatic           | [![visual tests](https://img.shields.io/npm/dm/@chromatic-com/storybook?style=flat-square&color=eee)](https://github.com/chromaui/addon-visual-tests)          |
| [themes](code/addons/themes/)                                         | Switch your component library themes from the toolbar                     | [![themes](https://img.shields.io/npm/dm/@storybook/addon-themes?style=flat-square&color=eee)](code/addons/themes/)                                            |
| [msw](https://github.com/mswjs/msw-storybook-addon)                   | Mock API requests in stories using Mock Service Worker                    | [![msw](https://img.shields.io/npm/dm/msw-storybook-addon?style=flat-square&color=eee)](https://github.com/mswjs/msw-storybook-addon)                          |
| [mcp](code/addons/mcp/)                                               | Run a MCP server in your local Storybook                                  | [![mcp](https://img.shields.io/npm/dm/@storybook/addon-mcp?style=flat-square&color=eee)](code/addons/mcp/)                                                     |
| [designs](https://github.com/storybookjs/addon-designs)               | Embed Figma files and other design previews alongside your story          | [![designs](https://img.shields.io/npm/dm/@storybook/addon-designs?style=flat-square&color=eee)](https://github.com/storybookjs/addon-designs)                 |
| [pseudo-states](code/addons/pseudo-states/)                           | Toggle CSS pseudo states such as `:hover` and `:focus` on your components | [![pseudo-states](https://img.shields.io/npm/dm/storybook-addon-pseudo-states?style=flat-square&color=eee)](code/addons/pseudo-states/)                        |
| [dark-mode](https://github.com/hipstersmoothie/storybook-dark-mode)   | Toggle between light and dark mode in Storybook                           | [![dark-mode](https://img.shields.io/npm/dm/storybook-dark-mode?style=flat-square&color=eee)](https://github.com/hipstersmoothie/storybook-dark-mode)          |
| [tag-badges](https://github.com/Sidnioulz/storybook-addon-tag-badges) | Display story tags as badges in the sidebar and toolbar                   | [![tag-badges](https://img.shields.io/npm/dm/storybook-addon-tag-badges?style=flat-square&color=eee)](https://github.com/Sidnioulz/storybook-addon-tag-badges) |

Find more in the [addon catalog](https://storybook.js.org/addons?ref=readme), and see the [Addon / Framework Support Table](https://storybook.js.org/docs/configure/integration/frameworks-feature-support?ref=readme).

## Community

- Getting help in [the repo's GitHub Discussions](https://github.com/storybookjs/storybook/discussions/new?category=help)
- Posting on [Bluesky](https://bsky.app/profile/storybook.js.org)
- Blogging at [storybook.js.org](https://storybook.js.org/blog/?ref=readme) and [Medium](https://medium.com/storybookjs)
- Chatting on [Discord](https://discord.gg/storybook)
- Videos and streams at [YouTube](https://www.youtube.com/channel/UCr7Quur3eIyA_oe8FNYexfg)

## Contributing

Contributions to Storybook are always welcome! 📥 Pull requests and 🌟 Stars and 🕵🏿 Issue reproductions help us out.

Read our [contributing guide](CONTRIBUTING.md) to get started, or find us on [Discord](https://discord.gg/storybook), we will take the time to guide you. We have contributor office hours on Discord every Monday at 3PM CET.

Looking for a first issue to tackle?

- We tag issues with [![Good First Issue](https://img.shields.io/github/issues/storybookjs/storybook/good%20first%20issue.svg)](https://github.com/storybookjs/storybook/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) when we think they are well suited for people who are new to the codebase or OSS in general
- [Talk to us](https://discord.gg/storybook), we'll find something that suits your skills and learning interests

### Development scripts

Storybook is organized as a monorepo. Useful scripts include:

#### `yarn`

> Installs dependencies

#### `yarn task`

> Lets you compile the codebase, run tests, create a sandbox, etc

#### `yarn storybook:ui`

> Runs Storybook's own Storybook with our UI components

- `yarn task compile` - builds the whole monorepo, needed once before you build --watch
- `yarn --cwd code build --watch storybook` - lets you rebuild Storybook's core package in the background as you make change
- `yarn storybook:ui` - opens our Storybook and detects file changes made by the build script

#### `yarn lint`

> boolean check if code conforms to linting rules - uses oxlint

- `yarn --cwd code lint:js:cmd <file> --fix` - will lint one file (path relative to `code/`) and automatically fix it
- `yarn fmt:check` - will check formatting - uses oxfmt
- `yarn fmt:write` - will automatically fix formatting

#### `yarn test`

> boolean check if unit tests all pass - uses vitest

- `yarn test:watch` - will run unit tests in watch-mode
- `yarn storybook:vitest` - will run the stories of Storybook's own UI as tests in watch-mode, through the [Vitest addon](code/addons/vitest/)

### Sponsors

Become a sponsor to have your logo and website URL on our README on Github. [Become a sponsor](https://opencollective.com/storybook#sponsor).

<a href="https://opencollective.com/storybook/tiers/sponsors/0/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/0/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/1/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/1/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/2/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/2/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/3/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/3/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/4/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/4/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/5/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/5/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/6/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/6/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/7/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/7/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/8/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/8/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/9/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/9/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/10/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/10/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/11/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/11/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/12/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/12/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/13/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/13/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/14/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/14/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/15/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/15/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/16/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/16/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/17/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/17/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/18/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/18/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/19/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/19/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/20/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/20/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/21/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/21/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/22/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/22/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/23/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/23/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/24/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/24/avatar.svg?requireActive=true"></a>
<a href="https://opencollective.com/storybook/tiers/sponsors/25/website?requireActive=true" target="_blank"><img src="https://opencollective.com/storybook/tiers/sponsors/25/avatar.svg?requireActive=true"></a>

### Backers

By making a recurring donation, you can support us and our work. [Become a backer](https://opencollective.com/storybook#backer).

<a href="https://opencollective.com/storybook"><img src="https://opencollective.com/storybook/tiers/backers.svg?limit=80&button=false&avatarHeight=46&width=750"></a>

## Badges & Presentation materials

We have a badge! Link it to your live Storybook example.

![Storybook](https://cdn.jsdelivr.net/gh/storybookjs/brand@main/badge/badge-storybook.svg)

```md
[![Storybook](https://cdn.jsdelivr.net/gh/storybookjs/brand@main/badge/badge-storybook.svg)](link to site)
```

If you're looking for material to use in your Storybook presentation, such as logos, video material, and the colors we use, you can find it all on our [brand repo](https://github.com/storybookjs/brand).

## License

[MIT](https://github.com/storybookjs/storybook/blob/main/LICENSE)

-the end-

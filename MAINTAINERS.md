This document outlines some of the processes that the maintainers should adhere to.

# PR Process

1. Triage with the correct [label](#labels)
2. If there is a change related to it, ensure it has been published and tested before closing

# Labels

| label name                     | purpose                                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| accessibility                  | Issue, bug, or pull request related to accessibility                                                                                                 |
| addon:(name)                   | Issue, bug, or pull request related to Storybook addons (e.g., [Controls](/docs/essentials/controls.mdx))                                            |
| app:(name)                     | Issue, bug, or pull request related to Storybook's supported frameworks (e.g., React)                                                                |
| api:(name)                     | Issue, bug, or pull request related to Storybook's API (e.g.,[makeDecorator](/docs/addons/addons-api.mdx#makeDecorator-API))                         |
| args                           | Issue, bug, or pull request related to Storybook's [args](/docs/writing-stories/args.mdx)                                                            |
| babel/webpack                  | Issue, bug, or pull request related to Storybook's build system (e.g., Webpack or Babel), for Webpack 5 issues see below                             |
| block:(name)                   | Issue or bug within a certain surface are of Storybook (e.g., [argTypes](/docs/api/doc-blocks/doc-block-argtypes.mdx))                               |
| BREAKING CHANGE                | Issue or pull request that introduces a breaking change within Storybook's ecosystem.                                                                |
| BREAKING PRERELASE             | Breaking, but only for prerelease users (not relative to the stable release)                                                                         |
| build-storybook                | Issue, bug, or pull request related to Storybook's production build                                                                                  |
| cleanup                        | Minor cleanup style change that won't show up in release changelog                                                                                   |
| bug                            | A bug within Storybook                                                                                                                               |
| cli                            | Issue, bug, or pull request that affects the Storybook's CLI                                                                                         |
| compatibility with other tools | Issue, bug, or pull request between Storybook and other tools (e.g., [Nuxt](https://nuxtjs.org/))                                                    |
| components                     | Issue, bug, or pull request related to Storybook's internal components                                                                               |
| composition                    | Issue, bug, or pull request related to Storybook [Composition](/docs/sharing/storybook-composition.mdx)                                              |
| configuration                  | Issue, bug, or pull request related to Storybook [configuration](/docs/configure/index.mdx)                                                          |
| core                           | Issue, bug, or pull request related to Storybook's Core                                                                                              |
| cra                            | Issue, bug, or pull request that affects Storybook's compatibility with Create React APP ([CRA](https://create-react-app.dev/docs/getting-started/)) |
| CSF                            | Issue, bug, or pull request related to Storybook's [Component Story Format (CSF)](/docs/api/csf.mdx)                                                 |
| decorators                     | Issue, bug, or pull related to Storybook's [Decorators](/docs/writing-stories/decorators.mdx)                                                        |
| dependencies                   | Issue, bug, or pull request that related to upstream dependencies                                                                                    |
| discussion                     | Issue currently being discussed between the maintainers and community                                                                                |
| do not merge                   | Pull request that will introduce regressions and will not be merged                                                                                  |
| documentation                  | Issue, bug, or pull request that affects Storybook's documentation                                                                                   |
| duplicate                      | Question or issue already asked in the repo's issues                                                                                                 |
| feature request                | Request for a new feature to be included in Storybook                                                                                                |
| flow                           | Issue, bug, or pull request related to Storybook and Flow                                                                                            |
| Funded on Issuehunt            | Storybook issue funded on [IssueHunt](https://issuehunt.io/)                                                                                         |
| gatsby                         | Issue, bug, or pull request that affects Storybook and [Gatsby](https://www.gatsbyjs.com/)                                                           |
| good first issue               | Low impact Storybook issues that help new members get involved and start contributing                                                                |
| has workaround                 | Issue or bug that has an alternative way to be solved with Storybook                                                                                 |
| help wanted                    | Issue, or bug that requires additional help from the community                                                                                       |
| ie11                           | Issue, bug, or pull request related to Storybook and IE11                                                                                            |
| in progress                    | Issue or pull request that is currently being reviewed or worked on with the author                                                                  |
| inactive                       | Issue, or pull request that has gone stale and no active development has been done                                                                   |
| maintenance                    | Issue, or pull request related to Storybook's internal maintenance                                                                                   |
| mdx                            | Issue, bug, or pull request related to MDX and Storybook                                                                                             |
| medium                         | Issue or pull request that involves a significant amount of work within Storybook                                                                    |
| monorepos                      | Issue, bug, or pull request related to Storybook and monorepos                                                                                       |
| mui                            | Issue, bug, or pull request that affects Storybook and [Material-UI](https://material-ui.com/)                                                       |
| multiframework                 | Issue, bug, or pull request that affects multiple supported frameworks (e.g., React, Vue)                                                            |
| needs more info                | Issue, or bug that requires additional context from the author                                                                                       |
| needs reproduction             | Issue, or bug that requires a reproduction to be looked at                                                                                           |
| needs triage                   | Issue, bug, or pull request that requires further investigation from the maintainers                                                                 |
| nextjs                         | Issue, bug, or pull request related to Storybook's integration with [Next.js](https://nextjs.org/)                                                   |
| nx                             | Issue, bug, or pull request related to Storybook's integration with [NX](https://nx.dev/)                                                            |
| other                          | Storybook's miscellaneous issue or pull request                                                                                                      |
| P(n)                           | Bug or issue priority. Ranges from `0` (most urgent) to `N` (least urgent)                                                                           |
| patch                          | Bug fix and documentation pull request that will be picked to the main branch                                                                        |
| performance issue              | Issue, bug or pull request that affects Storybook's performance                                                                                      |
| picked                         | Patch PRs cherry-picked to the main branch                                                                                                           |
| presets                        | Issue, bug, or pull requests that affect Storybook's presets                                                                                         |
| question / support             | General question about Storybook                                                                                                                     |
| run e2e extended test suite    | Pull request that affects Storybook's testing suite                                                                                                  |
| search                         | Issue, bug or pull request related to Storybook's search functionality                                                                               |
| security                       | Issue, bug, or pull request that addresses security with Storybook                                                                                   |
| small                          | Issue or pull request that requires a small amount of work to be done                                                                                |
| source-loader                  | Issue, bug, or pull request related to code display within Storybook's stories                                                                       |
| theming                        | Issue, bug, or pull request related to Storybook customization (e.g., [theming](/docs/configure/user-interface/theming.mdx))                         |
| todo                           | Issue or pull request currently being worked on                                                                                                      |
| typescript                     | Issue, bug, or pull request related to TypeScript                                                                                                    |
| ui                             | Issue, bug, or pull request related to Storybook's UI                                                                                                |
| webpack5                       | Issue, bug, or pull request related to Webpack 5                                                                                                     |
| won't fix                      | Issue or pull request that won't be addressed by the maintainers (e.g., introduces a regression)                                                     |
| yarn/npm                       | Issue or pull request related to node package managers                                                                                               |

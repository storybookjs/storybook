# Contributors Guide
> Tip: If you want to make a fast contribution, check the “good first issue” label in the Issues tab for small frontend and docs tasks that are easy to fix directly on GitHub.


We welcome contributions of any type and skill level. As an open-source project, we believe in the power of community and welcome any contributions that help us improve Storybook. Whether you are a developer, designer, writer, or someone who wants to help, we'd love to have you on board. If you are interested in contributing, please read the following guidelines.

Whether you're new to open source or a seasoned contributor, we welcome all contributions. Here are a few ways you can contribute to Storybook: 

- [Create an RFC](https://storybook.js.org/docs/contribute/RFC) for feature requests
- Update our [documentation](https://storybook.js.org/docs/contribute/documentation/documentation-updates) with fixes, improvements, or clarifications
- Add [new examples](https://storybook.js.org/docs/contribute/documentation/new-snippets) of code snippets for using Storybook with a JS framework
- [Integrate Storybook with a JS framework](https://storybook.js.org/docs/contribute/framework) or improve support of existing frameworks
- [Write an addon](https://storybook.js.org/docs/addons) to extend Storybook's functionality

If you're not sure where to start, you can always help us by:

- [Reporting a bug](https://github.com/storybookjs/storybook/issues/new/choose)
- Answer [Help](https://github.com/storybookjs/storybook/discussions/categories/help?discussions_q=is%3Aopen+category%3AHelp) questions on Storybook's GitHub discussions
- [Browse `Good First Issue`s to fix](https://github.com/storybookjs/storybook/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22)

> **Note**: Before you start contributing, please read the [Code of Conduct](./CODE_OF_CONDUCT.md) and reach out to the maintainers if you have any questions or concerns about the project or the contribution process on the [`#contributing`](https://discord.com/channels/486522875931656193/839297503446695956) channel on Discord.

## Quick guide 

### Prerequisites 

Storybook is developed against a specific Node.js version specified in the `.nvmrc` file.
You can use any version manager to install the correct version of Node.js. We recommend using [fnm](https://github.com/Schniz/fnm).

1. Check if you have the correct version of Node.js installed by running the following command:
  
  ```shell
  # Check which version you're using
  node --version
  # node version manager
  nvm use 22
  # pnpm
  pnpm env use --global 22
  ```

2. Install [fnm](https://github.com/Schniz/fnm/tree/master?tab=readme-ov-file#installation) and adjust your shell configuration to include the following parameters: `fnm env`, `use-on-cd`, `corepack-enabled`, and `version-file-strategy recursive`.
   
   ```shell
   eval "$(fnm env --use-on-cd --corepack-enabled --version-file-strategy recursive)"
   ```

3. If you're a Windows user, you'll need to enable Windows Subsystem for Linux (WSL). You can follow the instructions [here](https://docs.microsoft.com/en-us/windows/wsl/install).

### Running the local development environment

- All commands should be run in a terminal with administrator privileges in Windows environments.

### What's inside?

Storybook uses a monorepo structure to manage the project and its packages.
Here's a highlight of notable directories and files:

```shell
.
├── CHANGELOG.md                  # Changelog for current version of Storybook
├── CHANGELOG.prerelease.md
├── CHANGELOG.v1-5.md
├── CHANGELOG.v6.md
├── CODEOWNERS
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING                  # Info relevant for maintainers
├── CONTRIBUTING.md               <--------- You are here!
├── LICENSE
├── MAINTAINERS.md
├── MIGRATION.md                  # Migration Guide for Storybook
├── README.md
├── RESOLUTIONS.md
├── SECURITY.md
├── code                         # Codebase for Storybook
│   ├── __mocks__
│   ├── addons
│   ├── bench
│   ├── builders
│   ├── chromatic.config.json
│   ├── core                     # Core package for UI and API of Storybook
│   ├── e2e-tests
│   ├── frameworks               # Different framework-bundler versions of Storybook
│   ├── lib                      # CLI and plugins
│   ├── node_modules
│   ├── nx.json
│   ├── package.json
│   ├── playwright.config.ts
│   ├── presets                  # Preset packages
│   ├── prettier.config.mjs
│   ├── renderers                # Storybook renderers for different frameworks
│   ├── sandbox                  # Sandboxes for Bug Reproductions or experimentation
│   ├── tsconfig.json
│   ├── vitest-setup.ts
│   ├── vitest.config.ts
│   ├── vitest.helpers.ts
│   └── vitest.workspace.ts
├── codecov.yml
├── dependabot.yml
├── docs                         # Documentation
│   ├── _assets
│   ├── _snippets
│   ├── addons
│   ├── api
│   ├── builders
│   ├── configure
│   ├── contribute
│   ├── essentials
│   ├── faq.mdx
│   ├── frameworks.js
│   ├── get-started
│   ├── index.mdx
│   ├── migration-guide
│   ├── sharing
│   ├── versions
│   ├── writing-docs
│   ├── writing-stories
│   └── writing-tests
├── node_modules
├── package.json                      # Root of the yarn monorepo
├── prettier.config.mjs
├── scripts                           # Build and Helper Scripts
├── test-storybooks
│   ├── ember-cli
│   ├── external-docs
│   ├── portable-stories-kitchen-sink
│   ├── server-kitchen-sink
│   └── standalone-preview
└── yarn.lock
```

### Fork the repository 

If you plan to contribute to Storybook's codebase, you should fork the repository to your GitHub account. This will allow you to make changes to the codebase and submit a pull request to the main repository when you're ready to contribute your changes.

Additionally, adding our codebase as upstream ensures you can rebase against the latest changes in the main repository. To do this, run the following commands:

```shell
git remote add upstream https://github.com/storybookjs/storybook.git
git fetch upstream
git branch --set-upstream-to upstream/main main
```

### Running the local development environment 

If you're interested in contributing to Storybook's codebase, you can run it locally to get a feel for the codebase and the development environment. To get started with the development environment, you should always run `yarn start` from the root directory. Running `yarn start` will install the required dependencies, build the project, including the packages, and generate a sandbox environment using React with TypeScript with a set of test stories to help you get started.

```shell
# Navigate to the root directory of the Storybook repository 
cd path/to/your/storybook/fork 

# Install the required dependencies
yarn
# start the development environment 
yarn start
```

### Making code changes 

If you want to make code changes to Storybook packages while running a sandbox, you'll need to do the following: 

1. In a second terminal, run `yarn build --watch <package-1> <package-2>` in the `code/` directory.

For example, to build the `@storybook/react`, `storybook` itself, `@storybook/builder-vite`, and `@storybook/addon-docs` packages, you would run: 

```shell 
# Navigate to the code directory 
cd path/to/your/storybook/fork/code 

# Build the specified packages in watch mode 
yarn build --watch react core-server api addon-docs 

Most package names can be found after `@storybook/` in the published package.

For instance, to build the `@storybook/react storybook @storybook/builder-vite @storybook/addon-docs` packages at the same time in watch mode:

```shell 
cd code
yarn build --watch react storybook builder-vite addon-docs 
```

2. If you are running the sandbox in ["linked"](https://yarnpkg.com/cli/link) mode (the default), you should see the changes reflected on a refresh (you may need to restart it if changing server packages) 

3. If you are running the sandbox in "unlinked" mode, you'll need to rerun the sandbox from the `publish` step to see the changes: 

```shell 
yarn task --task dev --template <your template> --start-from=publish 
``` 

4. If you have made any changes inside `/code` or other packages, remember to run `yarn test` inside the package to ensure that your changes do not break any tests. 

### Angular-specific code

If you are working on Angular-specific code, you will need to append `--prod` to the above mentioned commands to ensure that the Angular compiler is able to pick up the changes appropriately and doesn't fail. This will build all the packages in production mode.

```shell
# Starts the build process in production mode
yarn task --prod
```

```shell
# Builds the specified packages in production mode
yarn build --prod --watch angular storybook addon-docs
```

### Running against different sandbox templates 

You can pick a specific template to use as your sandbox by running `yarn task`, which will prompt you to make further choices about which template you want and which task you want to run.

## Troubleshooting 

### The initialization process throws an error 

If you run `yarn start` and encounter the following error, try rerunning `yarn start` a second time: 

```shell 
> NX ENOENT: no such file or directory, open 'storybook/code/node_modules/nx/package.json' 
```

### Storybook doesn't detect changes in the codebase 

If you are a Storybook contributor and still experience issues, it is recommended that you verify your local Storybook instance for any unintentional local changes. To do this, you can use the following command: 

```shell 
git clean -dx --dry-run 
``` 

By executing this command, you can see which untracked or ignored files and directories will be removed from your working directory if you run it with the `--force` flag. Before running the command with the `--force` flag, please commit any local changes you want to keep. Otherwise, they will be lost.

## Contributing to Storybook 

For further advice on contributing, please refer to our [NEW contributing guide on the Storybook website](https://storybook.js.org/docs/contribute).

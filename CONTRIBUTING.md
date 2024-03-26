# Getting started

Storybook is developed against a specific node version which is defined in an `.nvmrc` file. You can use any Node version manager that uses the `.nvmrc` configuration file (we recommend [fnm](https://fnm.vercel.app/)).

## Table of Contents

- [Contributing](#contributing)
  - [How to contribute](#how-to-contribute)
  - [Easy Ways to Contribute](#easy-ways-to-contribue)
- [What's Inside?](#whats-inside)

# Contributing

Check out setup instructions for [Code Contributions](./docs/contribute/code.md)

## How to contribute

- [Create an RFC](./docs/contribute/rfc.md) for feature requests
- [Integrate Storybook with a JS framework](./docs/contribute/framework.md) or improve support of existing frameworks
- Update [Documentation](./docs/contribute/documentation-updates.md) for documentation improvements, typos, and clarifications
- Add [new examples](./docs/contribute/new-snippets.md) of code snippets for using Storybook with a JS framework
- [Write a preset](https://storybook.js.org/docs/presets/introduction)
- [Write an addon](https://storybook.js.org/docs/addons/introduction)

#### Easy Ways to Contribute :sparkle:

- Report a bug by [creating a reproduction](https://storybook.js.org/docs/contribute/bug-report) of the problem

- [Update Documentation](https://storybook.js.org/docs/contribute/documentation-updates), including [code snippets](https://storybook.js.org/docs/contribute/new-snippets) for using Storybook with different frameworks
- [Create a new feature](https://storybook.js.org/docs/contribute/feature)

Don't know where to start?

- Ask [`#contributing`](https://discord.com/channels/486522875931656193/839297503446695956) on Discord

- Answer [Help](https://github.com/storybookjs/storybook/discussions/categories/help?discussions_q=is%3Aopen+category%3AHelp) questions on Storybook Github

- [Browse `Good First Issue`s to fix](https://github.com/storybookjs/storybook/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22)


## What's Inside?

This is a brief overview of directories and files most relevant to contributors in this repo.

```bash
.
├── CHANGELOG.md                  # Changelog of current version of Storybook
├── CODEOWNERS
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING <---------------- You are here!
├── Issue.md
├── MIGRATION.md
├── README.md
├── repros                        # Hidden folder: Reproductions for issues    
├── sandbox                       # Hidden folder: Sandbox for testing Storybook
└── code                          # Storybook packages
    ├── __mocks__                 # Mocks for jest tests
    ├── addons                    # Storybook addon packages
    ├── builders                  # Storybook builder packages
    ├── deprecated
    ├── e2e-tests
    └── frameworks                # Storybook meta-framework packages for spinning up new Storybook instances
        ├── angular
        ├── ember
        ├── html-vite
        ├── html-webpack5
        ├── nextjs
        ├── preact-vite
        ├── preact-webpack5
        ├── react-vite
        ├── react-webpack5
        ├── server-webpack5
        ├── svelte-vite
        ├── svelte-webpack5
        ├── sveltekit
        ├── vue-vite
        ├── vue-webpack5
        ├── vue3-vite
        ├── vue3-webpack5
        ├── web-components-vite
        └── web-components-webpack5
│   ├── lib                       # Storybook core features
│   ├── migrations.json
│   ├── node_modules
│   ├── nx.json
│   ├── package.json
│   ├── playwright-report
│   ├── playwright-results
│   ├── playwright.config.ts
│   ├── presets                   # Storybook preset packages
│   ├── prettier.config.js
│   ├── renderers                 # Storybook renderer for integrating JS framework components in stories
│   ├── tsconfig.json
│   ├── ui
│   └── yarn.lock
├── codecov.yml
├── docs                          # Storybook documentation - the easiest place to start!
├── node_modules
├── package.json
├── repros
│   ├── cra
│   ├── html-vite
│   ├── nextjs
│   └── react-vite
├── sandbox
├── scripts
├── test-storybooks
└── yarn.lock

```

## Ensure you're using Node 18

```bash
# Check which version you're using
node --version

# node version manager 
nvm use 18

# pnpm
pnpm env use --global 18
```

## Using fnm as a Node version manager

- Install fnm [as per instructions](https://github.com/Schniz/fnm/tree/master#installation)
- In your shell setup include the `use-on-cd`, `corepack-enabled` and `version-file-strategy recursive` parameters in the `fnm env` command, e.g.

  ```sh
  eval "$(fnm env --use-on-cd --corepack-enabled --version-file-strategy recursive)"
  ```

## Running the local development environment

- Ensure if you are using Windows to use the [Windows Subsystem for Linux](https://learn.microsoft.com/en-us/windows/wsl/install) (WSL).
- Run `yarn start` in the root directory to run a basic test Storybook "sandbox".

The `yarn start` script will by default generate a React Vite TypeScript sandbox with a set of test stories inside it, as well as taking all steps required to get it running (building the various packages we need etc). There is no need to run `yarn` or `yarn install` as `yarn start` will do this for you.

#### Forked repos

Unless you're editing docs, you'll have to fork the Storybook repo to make code changes.

After forking the repository, you should [disable Github Actions for your repo](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository) as many of them (e.g. pushing to sandbox) will fail without proper authorization. In your Github repo, go to Settings > Actions > General > set the Actions Permissions to **Disable actions**.

After forking the repository, adding our codebase as upstream ensures you can rebase against the latest changes in the main repository. To do this, run the following commands:

```sh
git remote add upstream git@github.com:storybookjs/storybook.git
```

Now, when you want to update your fork with the latest changes from the main repository, you can run the following commands:

```sh
git fetch upstream # updates your local copy of the main repository with changes from the official repository

git rebase upstream/main # rebases your current branch against upstream/main
```

## Running against different sandbox templates

You can pick a specific template to use as your sandbox by running `yarn task`, which will prompt you to make further choices about which template you want and which task you want to run.

## Making code changes

If you want to make code changes to Storybook packages while running a sandbox, you'll need to do the following:

1. In a second terminal run `yarn build --watch <package-1> <package-2>` in the `code/` directory. 
The package name can be found after `@storybook/` in the published package. 

For instance, to build the `@storybook/react @storybook/core-server @storybook/api @storybook/addon-docs` packages at the same time in watch mode:

```bash
cd code
yarn build --watch react core-server api addon-docs
```

2. If you are running the sandbox in ["linked"](https://yarnpkg.com/cli/link) mode (the default), you should see the changes reflected on a refresh (you may need to restart it if changing server packages)

3. If you are running the sandbox in "unlinked" mode you'll need to re-run the sandbox from the `publish` step to see the changes:

```sh
yarn task --task dev --template <your template> --start-from=publish
```

4. If you have made any changes inside `/code` or other packages, remember to run `yarn test` from inside the package to ensure that your changes do not break any tests.
    
### Troubleshooting

If you run `yarn start` and encounter the following error, try rerunning `yarn start` a second time:

```sh
>  NX   ENOENT: no such file or directory, open 'storybook/code/node_modules/nx/package.json'
```

If you are a Storybook contributor and still experience issues, it is recommended that you verify your local Storybook instance for any unintentional local changes. To do this, you can use the following command:

```sh
git clean -dx --dry-run
```

By executing this command, you will be able to see which untracked or ignored files and directories will be removed from your working directory if you run it with the `--force` flag. Before running the command with the `--force` flag, please commit any local changes that you want to keep. Otherwise they will be lost.


## Contributing to Storybook

For further advice on how to contribute, please refer to our :new: [NEW contributing guide on the Storybook website](https://storybook.js.org/docs/contribute).

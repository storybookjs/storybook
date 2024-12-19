# Getting started

Storybook is developed against a specific node version which is defined in an `.nvmrc` file. You can use any Node version manager that uses the `.nvmrc` configuration file (we recommend [fnm](https://fnm.vercel.app/)).

## Ensure you have the required system utilities

You will need to have the following installed:

- git
- node
- yarn

## Using fnm as a Node version manager

- Install fnm [as per instructions](https://github.com/Schniz/fnm/tree/master#installation)
- In your shell setup include the `use-on-cd`, `corepack-enabled` and `version-file-strategy recursive` parameters in the `fnm env` command, e.g.

  ```sh
  eval "$(fnm env --use-on-cd --corepack-enabled --version-file-strategy recursive)"
  ```

## Running the local development environment

- All commands should be run in a terminal with administrator privileges in Windows environments.
- Run `yarn start` in the root directory to run a basic test Storybook "sandbox".

The `yarn start` script will generate a React Vite TypeScript sandbox with a set of test stories inside it, as well as taking all steps required to get it running (building the various packages we need etc). There is no need to run `yarn` or `yarn install` as `yarn start` will do this for you.

### Issues

If you run `yarn start` and encounter the following error, try rerunning `yarn start` a second time:

```sh
>  NX   ENOENT: no such file or directory, open 'storybook/code/node_modules/nx/package.json'
```

If you are a Storybook contributor and still experience issues, it is recommended that you verify your local Storybook instance for any unintentional local changes. To do this, you can use the following command:

```sh
git clean -dx --dry-run
```

By executing this command, you will be able to see which untracked or ignored files and directories will be removed from your working directory if you run it with the `--force` flag. Before running the command with the `--force` flag, please commit any local changes that you want to keep. Otherwise they will be lost.

## Forked repos

If you have forked the repository, you should [disable Github Actions for your repo](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository) as many of them (e.g. pushing to sandbox) will fail without proper authorization. In your Github repo, go to Settings > Actions > General > set the Actions Permissions to **Disable actions**.

## Running against different sandbox templates

You can also pick a specific template to use as your sandbox by running `yarn task`, which will prompt you to make further choices about which template you want and which task you want to run.

## Making code changes

If you want to make code changes to Storybook packages while running a sandbox, you'll need to do the following:

1. In a second terminal run `yarn build --watch <package-1> <package-2>` in the `code/` directory. The package names is the bit after the `@storybook/` in the published package. For instance, to build the `@storybook/react @storybook/core-server @storybook/api @storybook/addon-docs` packages at the same time in watch mode:

```bash
cd code
yarn build --watch react core addon-docs
```

2. If you are running the sandbox in "linked" mode (the default), you should see the changes reflected on a refresh (you may need to restart it if changing server packages)

3. If you are running the sandbox in "unlinked" mode you'll need to re-run the sandbox from the `publish` step to see the changes:

```sh
yarn task --task dev --template <your template> --start-from=publish
```

### Making code changes when working on Angular-specific code

If you are working on Angular-specific code, you will need to append `--prod` to the above mentioned commands to ensure that the Angular compiler is able to pick up the changes appropriately and doesn't fail. This will build all the packages in production mode.

```sh
yarn task --prod
```

```bash
cd code
yarn build --prod --watch angular core addon-docs
```

## Contributing to Storybook

For further advice on how to contribute, please refer to our [NEW contributing guide on the Storybook website](https://storybook.js.org/docs/contribute).

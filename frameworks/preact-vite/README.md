# Storybook for Preact <!-- omit in toc -->

## Requirements

- [Preact](https://preactjs.com/) >= 10.x
- [Storybook](https://storybook.js.org/) >= 7.x

## Getting Started

### In a project without Storybook

Follow the prompts after running this command in your Preact project's root directory:

```bash
npx storybook@latest init
```

[More on getting started with Storybook](https://storybook.js.org/docs/get-started/install?renderer=preact)

### In a project with Storybook

This framework is designed to work with Storybook 7. If you’re not already using v7, upgrade with this command:

```bash
npx storybook@latest upgrade
```

#### Manual migration

Install the framework:

```bash
yarn add --dev @storybook/preact-vite
```

Update your `main.js` to change the framework property:

```js
// .storybook/main.js
export default {
  // ...
  framework: {
    name: '@storybook/preact-vite', // <- Change this
    options: {},
  },
};
```

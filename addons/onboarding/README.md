# Storybook Addon Onboarding

This addon provides a guided tour in some of Storybook's features, helping you get to know about the basics of Storybook and learn how to write stories!

![](./.github/assets/onboarding-intro.png)

## Triggering the onboarding

This addon comes installed by default in Storybook projects and should trigger automatically.
If you want to retrigger the addon, you should make sure that your Storybook still contains the example stories that come when initializing Storybook, and you can then navigate to http://localhost:6006/?path=/onboarding after running Storybook.

## Uninstalling

This addon serves to provide you a guided experience on the basics of Storybook. Once you are done, the addon is therefore not needed anymore and will not get activated (unless triggered manually), so you can freely remove it. Here's how to do so:

### 1. Remove the dependency

yarn:

```zsh
yarn remove @storybook/addon-onboarding
```

npm:

```zsh
npm uninstall -D @storybook/addon-onboarding
```

pnpm:

```zsh
pnpm remove -D @storybook/addon-onboarding
```

### 2. Remove the addon in your `.storybook/main.js` file

```diff
const config = {
  stories: [
    "../stories/**/*.stories.mdx",
    "../stories/**/*.stories.@(js|jsx|ts|tsx)",
  ],
  addons: [
    "@storybook/addon-essentials",
-   "@storybook/addon-onboarding"
  ],
};
export default config;
```

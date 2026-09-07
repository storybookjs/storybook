# Storybook Addon Onboarding

This addon provides a guided tour in some of Storybook's features, helping you get to know about the basics of Storybook and learn how to write stories!

![](./.github/assets/onboarding-intro.png)

## Triggering the onboarding

If you're setting up Storybook for the first time, you will be prompted to set up the onboarding addon. If you choose to skip it, you can always install it manually later if needed. To manually trigger the addon, ensure that your Storybook still contains the example stories added by default and navigate to http://localhost:6006/?path=/onboarding in your browser.

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
-   "@storybook/addon-onboarding"
  ],
};
export default config;
```

Learn more about Storybook at [storybook.js.org](https://storybook.js.org/?ref=readme).

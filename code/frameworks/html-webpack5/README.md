# Storybook for HTML

---

Storybook for HTML is a UI development environment for your plain HTML snippets.
With it, you can visualize different states of your UI components and develop them interactively.

![Storybook Screenshot](https://github.com/storybookjs/storybook/blob/main/media/storybook-intro.gif)

Storybook runs outside of your app.
So you can develop UI components in isolation without worrying about app specific dependencies and requirements.

## Getting Started

```sh
cd my-app
npx storybook@latest init -t html
```

For more information visit: [storybook.js.org](https://storybook.js.org)

### Typescript

`npx sb init` will select `.ts` starter stories if your `package.json` has typescript as a dependency. If starting a new project,
run `npm init` and `npm install typescript --save-dev` before initializing storybook to get the typescript starter stories.

---

Storybook also comes with a lot of [addons](https://storybook.js.org/addons) and a great API to customize as you wish.
You can also build a [static version](https://storybook.js.org/docs/sharing/publish-storybook?renderer=html) of your Storybook and deploy it anywhere you want.

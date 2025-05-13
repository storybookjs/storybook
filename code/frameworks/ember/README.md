# Storybook for Ember

Storybook for Ember is a UI development environment for your Ember components.
With it, you can visualize different states of your UI components and develop them interactively.

![Storybook Screenshot](https://github.com/storybookjs/storybook/blob/main/media/storybook-intro.gif)

Storybook runs outside of your app.
So you can develop UI components in isolation without worrying about app specific dependencies and requirements.

## Getting Started

```sh
cd my-ember-app
npx storybook@latest init
```

For more information visit: [storybook.js.org](https://storybook.js.org)

---

Storybook also comes with a lot of [addons](https://storybook.js.org/addons) and a great API to customize as you wish.
You can also build a [static version](https://storybook.js.org/docs/sharing/publish-storybook?renderer=ember) of your Storybook and deploy it anywhere you want.

## Docs

- [Basics](https://storybook.js.org/docs/get-started/install?renderer=ember)
- [Configurations](https://storybook.js.org/docs/configure?renderer=ember)
- [Addons](https://storybook.js.org/docs/configure/user-interface/storybook-addons?renderer=ember)

## Working with polyfills

If you need to use a polyfill that is already in use in our Ember application,
you will need to add some options to have Storybook working with them.

In this example we'll use the [named-block-polyfill](https://github.com/ember-polyfills/ember-named-blocks-polyfill).
This example also assume that you already have the package in your `package.json`.

In your `.storybook/main.js` you can add the following lines:

```javascript
import namedBlockPolyfill from 'ember-named-blocks-polyfill/lib/named-blocks-polyfill-plugin';

export default {
  framework: {
    name: '@storybook/ember',
    options: {
      polyfills: [namedBlockPolyfill],
    }
  },
  [...]
};
```

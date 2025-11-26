<img src="https://user-images.githubusercontent.com/321738/105224055-f6c29c00-5b5c-11eb-83c9-ba28a7fbadf2.gif" width="80" height="80" alt="">

# Storybook Pseudo States

Toggle CSS pseudo states for your components in Storybook.

<p>
  <img src="https://user-images.githubusercontent.com/321738/105100903-51e98580-5aae-11eb-82bf-2b625c5a88a3.gif" width="560" alt="" />
</p>

## Introduction

This addon attempts to "force" your components' pseudo states. It rewrites all document stylesheets to add a class name selector to any rules that target a pseudo-class (`:hover`, `:focus`, etc.). The tool then allows you to toggle these class names on the story container (`#root`) or any other root element you want (via the `rootSelector` param). Additionally, you can set the `pseudo` property on your story `parameters` to set a default value for each pseudo class. This makes it possible to test such states with [Chromatic](https://www.chromatic.com/).

### Limitations

Because this addon rewrites your stylesheets rather than toggle the actual browser behavior like DevTools does, it won't render any of the default user agent (browser) styles. Unfortunately there's no JavaScript API to toggle real pseudo states without using a browser extension.

## Getting Started

To install the addon:

```sh
npx storybook add storybook-addon-pseudo-states
```

For Storybook versions before 9.0, use v4.0.3 of the addon:

```sh
npx storybook add storybook-addon-pseudo-states@4.0.3
```

### Setting default story states

You can have your stories automatically use a specific set of pseudo states, by setting the `pseudo` property on `parameters`:

```jsx
export const Hover = () => <Button>Label</Button>;
Hover.parameters = { pseudo: { hover: true } };
```

This is what enables snapshot testing your pseudo states in [Chromatic](https://www.chromatic.com/).

### Targeting specific elements

If you don't want to force or toggle pseudo styles to all elements that use them, but rather only enable them on specific elements, you can set a string or array value instead of a boolean:

```jsx
export const Buttons = () => (
  <>
    <Button id="one">Hover</Button>
    <Button id="two">Hover focus</Button>
    <Button id="three">Hover focus active</Button>
  </>
);
Buttons.parameters = {
  pseudo: {
    hover: ['#one', '#two', '#three'],
    focus: ['#two', '#three'],
    active: '#three',
  },
};
```

This accepts a single CSS selector (string), or an array of CSS selectors on which to enable that pseudo style.

### Overriding the default root element

By default, we use `#storybook-root` (or `#root` before Storybook 7) element as the root element for all pseudo classes. If you need to render elements outside Storybook's root element, you can set `parameters.pseudo.rootSelector` to override it. This is convenient for portals, dialogs, tooltips, etc.

For example, consider a `Dialog` component that injects itself to the document's `body` node:

```jsx
export const DialogButton = () => (
  <Dialog>
    <Button>Hover</Button>
  </Dialog>
);

DialogButton.parameters = {
  pseudo: { hover: true, rootSelector: 'body' },
};
```

Learn more about Storybook at [storybook.js.org](https://storybook.js.org/?ref=readme).

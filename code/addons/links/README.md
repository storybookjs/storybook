# Story Links Addon

The Storybook Links addon can be used to create links that navigate between stories in [Storybook](https://storybook.js.org).

[Framework Support](https://storybook.js.org/docs/configure/integration/frameworks-feature-support)

## Getting Started

Install this addon by adding the `@storybook/addon-links` dependency:

```sh
yarn add -D @storybook/addon-links
```

within `.storybook/main.js`:

```js
export default {
  addons: ['@storybook/addon-links'],
};
```

Then you can import `linkTo` in your stories and use like this:

```js
import { linkTo } from '@storybook/addon-links';

export default {
  title: 'Button',
};

export const first = () => <button onClick={linkTo('Button', 'second')}>Go to "Second"</button>;
export const second = () => <button onClick={linkTo('Button', 'first')}>Go to "First"</button>;
```

Have a look at the linkTo function:

```js
import { linkTo } from '@storybook/addon-links';

linkTo('Toggle', 'off');
linkTo(
  () => 'Toggle',
  () => 'off'
);
linkTo('Toggle'); // Links to the first story in the 'Toggle' kind
```

With that, you can link an event in a component to any story in the Storybook.

- First parameter is the story kind name (what you named with `title`).
- Second (optional) parameter is the story name (what you named with `exported name`).
  If the second parameter is omitted, the link will point to the first story in the given kind.

You can also pass a function instead for any of above parameter. That function accepts arguments emitted by the event and it should return a string:

```js
import { linkTo } from '@storybook/addon-links';
import LinkTo from '@storybook/addon-links/react';

export default {
  title: 'Select',
};

export const index = () => (
  <select value="Index" onChange={linkTo('Select', (e) => e.currentTarget.value)}>
    <option>index</option>
    <option>first</option>
    <option>second</option>
    <option>third</option>
  </select>
);
export const first = () => <LinkTo story="index">Go back</LinkTo>;
export const second = () => <LinkTo story="index">Go back</LinkTo>;
export const third = () => <LinkTo story="index">Go back</LinkTo>;
```

## hrefTo function

If you want to get an URL for a particular story, you may use `hrefTo` function. It returns a promise, which resolves to string containing a relative URL:

```js
import { action } from '@storybook/addon-actions';
import { hrefTo } from '@storybook/addon-links';

export default {
  title: 'Href',
};

export const log = () => {
  hrefTo('Href', 'log').then(action('URL of this story'));

  return <span>See action logger</span>;
};
```

## withLinks decorator

`withLinks` decorator enables a declarative way of defining story links, using data attributes.
Here is an example in React, but it works with any framework:

```js
import { withLinks } from '@storybook/addon-links';

export default {
  title: 'Button',
  decorators: [withLinks],
};

export const first = () => (
  <button data-sb-kind="OtherKind" data-sb-story="otherStory">
    Go to "OtherStory"
  </button>
);
```

## LinkTo component (React only)

One possible way of using `hrefTo` is to create a component that uses native `a` element, but prevents page reloads on plain left click, so that one can still use default browser methods to open link in new tab.
A React implementation of such a component can be imported from `@storybook/addon-links` package:

```js
import LinkTo from '@storybook/addon-links/react';

export default {
  title: 'Link',
};

export const first = () => <LinkTo story="second">Go to Second</LinkTo>;
export const second = () => <LinkTo story="first">Go to First</LinkTo>;
```

It accepts all the props the `a` element does, plus `story` and `kind`. It the `kind` prop is omitted, the current kind will be preserved.

```js
<LinkTo
  kind="Toggle"
  story="off"
  target="_blank"
  title="link to second story"
  style={{ color: '#1474f3' }}
>
  Go to Second
</LinkTo>
```

To implement such a component for another framework, you need to add special handling for `click` event on native `a` element. See [`RoutedLink` sources](https://github.com/storybookjs/storybook/blob/next/code/addons/links/src/react/components/RoutedLink.tsx) for reference.

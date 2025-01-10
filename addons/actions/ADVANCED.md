## Advanced/Legacy Actions usage

For basic usage, see the [documentation](https://storybook.js.org/docs/essentials/actions).

This document describes the pre-6.0 usage of the addon, and as such is no longer recommended (although it will be supported until at least 7.0).

## Manually-specified actions

Import the `action` function and use it to create actions handlers. When creating action handlers, provide a **name** to make it easier to identify.

> _Note: Be mindful of the choice of the function's name. Avoid using Javascript reserved words such as **default** or **if**, as they will lead into unexpected errors._

```js
import { action } from '@storybook/addon-actions';
import Button from './button';

export default {
  title: 'Button',
  component: Button,
};

export const defaultView = () => <Button onClick={action('button-click')}>Hello World!</Button>;
```

## Multiple actions

If your story requires multiple actions, it may be convenient to use `actions` to create many at once:

```js
import { actions } from '@storybook/addon-actions';
import Button from './button';

export default {
  title: 'Button',
  component: Button,
};

// This will lead to { onClick: action('onClick'), ... }
const eventsFromNames = actions('onClick', 'onMouseOver');

// This will lead to { onClick: action('clicked'), ... }
const eventsFromObject = actions({ onClick: 'clicked', onMouseOver: 'hovered' });

export const first = () => <Button {...eventsFromNames}>Hello World!</Button>;

export const second = () => <Button {...eventsFromObject}>Hello World!</Button>;
```

## Configuration

Arguments which are passed to the action call will have to be serialized while be "transferred" over the channel.

This is not very optimal and can cause lag when large objects are being logged, for this reason it is possible to configure a maximum depth.

The action logger, by default, will log all actions fired during the lifetime of the story. After a while this can make the storybook laggy. As a workaround, you can configure an upper limit to how many actions should be logged.

To apply the configuration globally use the `configureActions` function in your `preview.js` file.

```js
import { configureActions } from '@storybook/addon-actions';

configureActions({
  maxDepth: 100,
  // Limit the number of items logged into the actions panel
  limit: 20,
});
```

To apply the configuration per action use:

```js
action('my-action', {
  maxDepth: 5,
});
```

### Available Options

| Name                 | Type    | Description                                                                         | Default |
| -------------------- | ------- | ----------------------------------------------------------------------------------- | ------- |
| `maxDepth`           | Number  | Configures the transferred depth of any logged objects.                             | `10`    |
| `clearOnStoryChange` | Boolean | Flag whether to clear the action logger when switching away from the current story. | `true`  |
| `limit`              | Number  | Limits the number of items logged in the action logger                              | `50`    |

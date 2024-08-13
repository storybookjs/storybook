```js filename=".storybook/YourTheme.js" renderer="common" language="js"
import { create } from '@storybook/theming/create';

export default create({
  base: 'light',
  brandTitle: 'My custom Storybook',
  brandUrl: 'https://example.com',
  brandImage: 'https://storybook.js.org/images/placeholders/350x150.png',
  brandTarget: '_self',
});
```

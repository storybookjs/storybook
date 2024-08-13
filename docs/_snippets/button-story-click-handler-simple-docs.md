```js filename="Button.stories.js|jsx" renderer="react" language="js"
import { action } from '@storybook/addon-actions';

import { Button } from './Button';

export default {
  component: Button,
};

export const Text = {
  render: ({ label, onClick }) => <Button label={label} onClick={onClick} />,
};
```

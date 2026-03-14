```js
import { addons } from '@storybook/manager-api';
import { CheckIcon } from '@storybook/icons';

addons.register('my-organisation/my-addon', (api) => {
  // Add a simple notification
  api.addNotification({
    id: 'my-notification',
    content: {
      headline: 'Action completed',
      subHeadline: 'Your changes have been saved successfully',
    },
    duration: 5000, // 5 seconds
  });

  // Add a notification with an icon
  api.addNotification({
    id: 'success-notification',
    content: {
      headline: 'Success!',
      subHeadline: 'Operation completed successfully',
    },
    icon: <CheckIcon />,
    duration: 3000,
  });
});
```

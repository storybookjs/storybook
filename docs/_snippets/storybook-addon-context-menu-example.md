```js filename="addon-context-menu/manager.js" renderer="common" language="js"
import React from 'react';

import { addons, types } from 'storybook/manager-api';
import { PencilIcon } from '@storybook/icons';

addons.register('my-addon', () => {
  addons.add('my-addon/context-menu', {
    //👇 Sets the type of UI element in Storybook
    type: types.experimental_CONTEXT_MENU,
    //👇 Adds the entry to stories only, leaving the other sidebar items untouched
    items: ({ context }) =>
      context.type === 'story'
        ? [
            {
              id: 'annotate',
              title: 'Annotate story',
              icon: <PencilIcon />,
              onClick: (event, { triggerRef }) => {
                //👇 `triggerRef` points at the button that opened the menu, so your own UI can be positioned next to it
                openAnnotationDialog({ storyId: context.id, triggerRef });
              },
            },
          ]
        : [],
  });
});
```

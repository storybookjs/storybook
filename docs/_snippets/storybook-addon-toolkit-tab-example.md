```tsx filename="src/Tab.tsx" renderer="common" language="ts" tabTitle="tab"
import React from 'react';

import { useParameter } from '@storybook/manager-api';
import { PARAM_KEY } from './constants';

// See https://github.com/storybookjs/addon-kit/blob/main/src/components/TabContent.tsx for an example of a TabContent component
import { TabContent } from './components/TabContent';

interface TabProps {
  active: boolean;
}

export const Tab: React.FC<TabProps> = ({ active }) => {
  // https://storybook.js.org/docs/addons/addons-api#useparameter
  const paramData = useParameter<string>(PARAM_KEY, '');

  return active ? <TabContent code={paramData} /> : null;
};
```


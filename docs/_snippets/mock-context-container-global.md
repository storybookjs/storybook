```js filename=".storybook/preview.js" renderer="react" language="js"
import React from 'react';

import { normal as NavigationNormal } from '../components/Navigation.stories';

import GlobalContainerContext from '../components/lib/GlobalContainerContext';

const context = {
  NavigationContainer: NavigationNormal,
};

const AppDecorator = (storyFn) => {
  return (
    <GlobalContainerContext.Provider value={context}>{storyFn()}</GlobalContainerContext.Provider>
  );
};

export default { decorators: [AppDecorator] };
```

```ts filename=".storybook/preview.ts" renderer="react" language="ts"
import React from 'react';

// Replace your-framework with the framework you are using (e.g., react, vue3)
import { Preview } from '@storybook/your-framework';

import { normal as NavigationNormal } from '../components/Navigation.stories';

import GlobalContainerContext from '../components/lib/GlobalContainerContext';

const context = {
  NavigationContainer: NavigationNormal,
};

const AppDecorator = (storyFn) => {
  return (
    <GlobalContainerContext.Provider value={context}>{storyFn()}</GlobalContainerContext.Provider>
  );
};

const preview: Preview = {
  decorators: [AppDecorator],
};

export default preview;
```

```js filename=".storybook/preview.js" renderer="solid" language="js"
import { normal as NavigationNormal } from '../components/Navigation.stories';

import GlobalContainerContext from '../components/lib/GlobalContainerContext';

const context = {
  NavigationContainer: NavigationNormal,
};

const AppDecorator = (storyFn) => {
  return (
    <GlobalContainerContext.Provider value={context}>{storyFn()}</GlobalContainerContext.Provider>
  );
};
export const decorators = [AppDecorator];
```

```ts filename=".storybook/preview.ts" renderer="solid" language="ts"
import { normal as NavigationNormal } from '../components/Navigation.stories';

import GlobalContainerContext from '../components/lib/GlobalContainerContext';

const context = {
  NavigationContainer: NavigationNormal,
};

const AppDecorator = (storyFn) => {
  return (
    <GlobalContainerContext.Provider value={context}>{storyFn()}</GlobalContainerContext.Provider>
  );
};

const preview: Preview = {
  decorators: [AppDecorator],
};

export default preview;
```

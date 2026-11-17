```jsx filename=".storybook/preview.jsx" renderer="react" language="js" tabTitle="CSF 4"
import * as React from 'react';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

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

export default definePreview({
  decorators: [AppDecorator],
});
```

```tsx filename=".storybook/preview.tsx" renderer="react" language="ts" tabTitle="CSF 4"
import * as React from 'react';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { definePreview } from '@storybook/your-framework';

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

export default definePreview({
  decorators: [AppDecorator],
});
```

```tsx filename=".storybook/preview.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import * as React from 'react';

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

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

```jsx filename=".storybook/preview.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import * as React from 'react';

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

```jsx filename=".storybook/preview.jsx" renderer="solid" language="js" tabTitle="CSF 4"
import { definePreview } from 'storybook-solidjs-vite';

import { normal as NavigationNormal } from '../components/Navigation.stories';
import GlobalContainerContext from '../components/lib/GlobalContainerContext';

const context = {
  NavigationContainer: NavigationNormal,
};

const AppDecorator = (storyFn) => {
  return <GlobalContainerContext value={context}>{storyFn()}</GlobalContainerContext>;
};

export default definePreview({
  decorators: [AppDecorator],
});
```

```tsx filename=".storybook/preview.tsx" renderer="solid" language="ts" tabTitle="CSF 4"
import { definePreview } from 'storybook-solidjs-vite';

import { normal as NavigationNormal } from '../components/Navigation.stories';
import GlobalContainerContext from '../components/lib/GlobalContainerContext';

const context = {
  NavigationContainer: NavigationNormal,
};

const AppDecorator = (storyFn) => {
  return <GlobalContainerContext value={context}>{storyFn()}</GlobalContainerContext>;
};

export default definePreview({
  decorators: [AppDecorator],
});
```

```tsx filename=".storybook/preview.ts|tsx" renderer="solid" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { normal as NavigationNormal } from '../components/Navigation.stories';
import GlobalContainerContext from '../components/lib/GlobalContainerContext';

const context = {
  NavigationContainer: NavigationNormal,
};

const AppDecorator = (storyFn) => {
  return <GlobalContainerContext value={context}>{storyFn()}</GlobalContainerContext>;
};

const preview: Preview = {
  decorators: [AppDecorator],
};

export default preview;
```

```jsx filename=".storybook/preview.js|jsx" renderer="solid" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { normal as NavigationNormal } from '../components/Navigation.stories';
import GlobalContainerContext from '../components/lib/GlobalContainerContext';

const context = {
  NavigationContainer: NavigationNormal,
};

const AppDecorator = (storyFn) => {
  return <GlobalContainerContext value={context}>{storyFn()}</GlobalContainerContext>;
};

export default { decorators: [AppDecorator] };
```

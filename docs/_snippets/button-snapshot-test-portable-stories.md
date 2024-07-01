```js filename="test/Button.test.js|ts" renderer="react" language="js" tabTitle="jest"
import { render } from '@testing-library/react';

import { composeStories } from '@storybook/react';

import * as stories from '../stories/Button.stories';

const { Primary } = composeStories(stories);
test('Button snapshot', async () => {
  const mounted = render(<Primary />);
  expect(mounted.container).toMatchSnapshot();
});
```

```js filename="test/Button.test.js|ts" renderer="react" language="js" tabTitle="vitest"
// @vitest-environment jsdom

import { expect, test } from 'vitest';

import { render } from '@testing-library/react';

import { composeStories } from '@storybook/react';

import * as stories from '../stories/Button.stories';

const { Primary } = composeStories(stories);
test('Button snapshot', async () => {
  const mounted = render(Primary());
  expect(mounted.container).toMatchSnapshot();
});
```

```js filename="__tests__/Button.spec.js|ts" renderer="vue" language="js"
// @vitest-environment jsdom

import { expect, test } from 'vitest';

import { render } from '@testing-library/vue';

import { composeStories } from '@storybook/vue3';

import * as stories from '../stories/Button.stories';

const { Primary } = composeStories(stories);
test('Button snapshot', async () => {
  const mounted = render(Primary());
  expect(mounted.container).toMatchSnapshot();
});
```


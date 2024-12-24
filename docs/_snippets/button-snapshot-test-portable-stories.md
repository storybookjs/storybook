```js filename="test/Button.test.js|ts" renderer="react" language="js" tabTitle="jest"
import { composeStories } from '@storybook/react';

import * as stories from '../stories/Button.stories';

const { Primary } = composeStories(stories);
test('Button snapshot', async () => {
  await Primary.run();
  expect(document.body.firstChild).toMatchSnapshot();
});
```

```js filename="test/Button.test.js|ts" renderer="react" language="js" tabTitle="vitest"
// @vitest-environment jsdom

import { expect, test } from 'vitest';

import { composeStories } from '@storybook/react';

import * as stories from '../stories/Button.stories';

const { Primary } = composeStories(stories);
test('Button snapshot', async () => {
  await Primary.run();
  expect(document.body.firstChild).toMatchSnapshot();
});
```

```js filename="__tests__/Button.spec.js|ts" renderer="vue" language="js"
// @vitest-environment jsdom

import { expect, test } from 'vitest';

import { composeStories } from '@storybook/vue3';

import * as stories from '../stories/Button.stories';

const { Primary } = composeStories(stories);
test('Button snapshot', async () => {
  await Primary.run();
  expect(document.body.firstChild).toMatchSnapshot();
});
```

```js filename="__tests__/Button.spec.js|ts" renderer="svelte" language="js"
// @vitest-environment jsdom

import { expect, test } from 'vitest';

import { composeStories } from '@storybook/svelte';

import * as stories from '../stories/Button.stories';

const { Primary } = composeStories(stories);
test('Button snapshot', async () => {
  await Primary.run();
  expect(document.body.firstChild).toMatchSnapshot();
});
```

```js filename="test/Button.test.js|ts" renderer="react" language="js" tabTitle="jest"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { composeStories } from '@storybook/your-framework';

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

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { composeStories } from '@storybook/your-framework';

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

import { composeStories } from '@storybook/vue3-vite';

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

// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
import { composeStories } from '@storybook/your-framework';

import * as stories from '../stories/Button.stories';

const { Primary } = composeStories(stories);
test('Button snapshot', async () => {
  await Primary.run();
  expect(document.body.firstChild).toMatchSnapshot();
});
```

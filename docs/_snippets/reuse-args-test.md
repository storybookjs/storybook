```js filename="Button.test.js|jsx" renderer="react" language="js"
import { render, screen } from '@testing-library/react';

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { composeStories } from '@storybook/your-framework';

import * as stories from './Button.stories';

const { Primary } = composeStories(stories);

test('reuses args from composed story', () => {
  render(<Primary />);

  const buttonElement = screen.getByRole('button');
  // Testing against values coming from the story itself! No need for duplication
  expect(buttonElement.textContent).toEqual(Primary.args.label);
});
```

```ts filename="Button.test.ts|tsx" renderer="react" language="ts"
import { render, screen } from '@testing-library/react';

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { composeStories } from '@storybook/your-framework';

import * as stories from './Button.stories';

const { Primary } = composeStories(stories);

test('reuses args from composed story', () => {
  render(<Primary />);

  const buttonElement = screen.getByRole('button');
  // Testing against values coming from the story itself! No need for duplication
  expect(buttonElement.textContent).toEqual(Primary.args.label);
});
```

```js filename="tests/Button.test.js" renderer="vue" language="js"
import { render, screen } from '@testing-library/vue';

import { composeStories } from '@storybook/vue3-vite';

import * as stories from './Button.stories';

const { Primary } = composeStories(stories);

test('reuses args from composed story', () => {
  render(Primary());

  const buttonElement = screen.getByRole('button');
  // Testing against values coming from the story itself! No need for duplication
  expect(buttonElement.textContent).toEqual(Primary.args.label);
});
```

```ts filename="tests/Button.test.ts" renderer="vue" language="ts"
import { render, screen } from '@testing-library/vue';

import { composeStories } from '@storybook/vue3-vite';

import * as stories from './Button.stories';

const { Primary } = composeStories(stories);

test('reuses args from composed story', () => {
  render(Primary());

  const buttonElement = screen.getByRole('button');
  // Testing against values coming from the story itself! No need for duplication
  expect(buttonElement.textContent).toEqual(Primary.args.label);
});
```

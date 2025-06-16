```js filename="Form.test.js|jsx" renderer="react" language="js"
import { fireEvent, screen } from '@testing-library/react';

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { composeStory } from '@storybook/your-framework';

import Meta, { ValidForm as ValidFormStory } from './LoginForm.stories';

const ValidForm = composeStory(ValidFormStory, Meta);

test('Validates form', async () => {
  await ValidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).not.toBeInTheDocument();
});
```

```ts filename="Form.test.ts|tsx" renderer="react" language="ts"
import { fireEvent, screen } from '@testing-library/react';

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { composeStory } from '@storybook/your-framework';

import Meta, { ValidForm as ValidFormStory } from './LoginForm.stories';

const ValidForm = composeStory(ValidFormStory, Meta);

test('Validates form', async () => {
  await ValidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).not.toBeInTheDocument();
});
```

```js filename="tests/Form.test.js" renderer="vue" language="js"
import { fireEvent, screen } from '@testing-library/vue';

import { composeStory } from '@storybook/vue3-vite';

import Meta, { ValidForm as ValidFormStory } from './LoginForm.stories';

const ValidForm = composeStory(ValidFormStory, Meta);

test('Validates form', async () => {
  await ValidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).not.toBeInTheDocument();
});
```

```ts filename="tests/Form.test.ts" renderer="vue" language="ts"
import { fireEvent, screen } from '@testing-library/vue';

import { composeStory } from '@storybook/vue3-vite';

import Meta, { ValidForm as ValidFormStory } from './LoginForm.stories';

const ValidForm = composeStory(ValidFormStory, Meta);

test('Validates form', async () => {
  await ValidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).not.toBeInTheDocument();
});
```

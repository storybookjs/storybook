```js filename="Form.test.js|jsx" renderer="react" language="js"
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { composeStories } from '@storybook/your-framework';

import * as FormStories from './LoginForm.stories';

const { InvalidForm, ValidForm } = composeStories(FormStories);

test('Tests invalid form state', async () => {
  const user = userEvent.setup();

  await InvalidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  await user.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});

test('Tests filled form', async () => {
  const user = userEvent.setup();

  await ValidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  await user.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).not.toBeInTheDocument();
});
```

```ts filename="Form.test.ts|tsx" renderer="react" language="ts"
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { composeStories } from '@storybook/your-framework';

import * as FormStories from './LoginForm.stories';

const { InvalidForm, ValidForm } = composeStories(FormStories);

test('Tests invalid form state', async () => {
  const user = userEvent.setup();

  await InvalidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  await user.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});

test('Tests filled form', async () => {
  const user = userEvent.setup();

  await ValidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  await user.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).not.toBeInTheDocument();
});
```

```js filename="tests/Form.test.js" renderer="vue" language="js"
import { screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';

import { composeStories } from '@storybook/vue3-vite';

import * as FormStories from './LoginForm.stories';

const { InvalidForm, ValidForm } = composeStories(FormStories);

test('Tests invalid form state', async () => {
  const user = userEvent.setup();

  await InvalidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  await user.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});

test('Tests filled form', async () => {
  const user = userEvent.setup();

  await ValidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  await user.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).not.toBeInTheDocument();
});
```

```ts filename="tests/Form.test.ts" renderer="vue" language="ts"
import { screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';

import { composeStories } from '@storybook/vue3-vite';

import * as FormStories from './LoginForm.stories';

const { InvalidForm, ValidForm } = composeStories(FormStories);

test('Tests invalid form state', async () => {
  const user = userEvent.setup();

  await InvalidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  await user.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});

test('Tests filled form', async () => {
  const user = userEvent.setup();

  await ValidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  await user.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).not.toBeInTheDocument();
});
```

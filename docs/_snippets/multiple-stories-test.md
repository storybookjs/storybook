```js filename="Form.test.js|jsx" renderer="react" language="js"
import { fireEvent, screen } from '@testing-library/react';

import { composeStories } from '@storybook/react';

import * as FormStories from './LoginForm.stories';

const { InvalidForm, ValidForm } = composeStories(FormStories);

test('Tests invalid form state', async () => {
  await InvalidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});

test('Tests filled form', async () => {
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

import { composeStories } from '@storybook/react';

import * as FormStories from './LoginForm.stories';

const { InvalidForm, ValidForm } = composeStories(FormStories);

test('Tests invalid form state', async () => {
  await InvalidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});

test('Tests filled form', async () => {
  await ValidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).not.toBeInTheDocument();
});
```

```js filename="tests/Form.test.js" renderer="vue" language="js" tabTitle="3"
import { fireEvent, screen } from '@testing-library/vue';

import { composeStories } from '@storybook/vue3';

import * as FormStories from './LoginForm.stories';

const { InvalidForm, ValidForm } = composeStories(FormStories);

test('Tests invalid form state', async () => {
  await InvalidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});

test('Tests filled form', async () => {
  await ValidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).not.toBeInTheDocument();
});
```

```ts filename="tests/Form.test.ts" renderer="vue" language="ts" tabTitle="3"
import { fireEvent, screen } from '@testing-library/vue';

import { composeStories } from '@storybook/vue3';

import * as FormStories from './LoginForm.stories';

const { InvalidForm, ValidForm } = composeStories(FormStories);

test('Tests invalid form state', async () => {
  await InvalidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});

test('Tests filled form', async () => {
  await ValidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).not.toBeInTheDocument();
});
```

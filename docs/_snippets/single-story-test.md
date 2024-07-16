```js filename="Form.test.js|jsx" renderer="react" language="js"
import { fireEvent, screen } from '@testing-library/react';

import { composeStory } from '@storybook/react';

import Meta, { ValidForm as ValidFormStory } from './LoginForm.stories';

const ValidForm = composeStory(ValidFormStory, Meta);

test('Validates form', async () => {
  await ValidForm.play();

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

import { composeStory } from '@storybook/react';

import Meta, { ValidForm as ValidFormStory } from './LoginForm.stories';

const ValidForm = composeStory(ValidFormStory, Meta);

test('Validates form', async () => {
  await ValidForm.play();

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

import { composeStory } from '@storybook/vue3';

import Meta, { ValidForm as ValidFormStory } from './LoginForm.stories';

const ValidForm = composeStory(ValidFormStory, Meta);

test('Validates form', async () => {
  await ValidForm.play();

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

import { composeStory } from '@storybook/vue3';

import Meta, { ValidForm as ValidFormStory } from './LoginForm.stories';

const ValidForm = composeStory(ValidFormStory, Meta);

test('Validates form', async () => {
  await ValidForm.play();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).not.toBeInTheDocument();
});
```

```js filename="Form.test.js|jsx" renderer="react" language="js"
import { fireEvent, render, screen } from '@testing-library/react';

import { composeStory } from '@storybook/react';

import Meta, { ValidForm as ValidFormStory } from './LoginForm.stories';

const FormOK = composeStory(ValidFormStory, Meta);

test('Validates form', () => {
  render(<FormOK />);

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).not.toBeInTheDocument();
});
```

```ts filename="Form.test.ts|tsx" renderer="react" language="ts"
import { fireEvent, render, screen } from '@testing-library/react';

import { composeStory } from '@storybook/react';

import Meta, { ValidForm as ValidFormStory } from './LoginForm.stories';

const FormOK = composeStory(ValidFormStory, Meta);

test('Validates form', () => {
  render(<FormOK />);

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).not.toBeInTheDocument();
});
```

```js filename="tests/Form.test.js" renderer="vue" language="js"
import { fireEvent, render, screen } from '@testing-library/vue';

import { composeStory } from '@storybook/testing-vue3';

import Meta, { ValidForm as ValidFormStory } from './LoginForm.stories';

const FormOK = composeStory(ValidFormStory, Meta);

test('Validates form', () => {
  render(FormOK());

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).not.toBeInTheDocument();
});
```

```ts filename="tests/Form.test.ts" renderer="vue" language="ts"
import { fireEvent, render, screen } from '@testing-library/vue';

import { composeStory } from '@storybook/testing-vue3';

import Meta, { ValidForm as ValidFormStory } from './LoginForm.stories';

const FormOK = composeStory(ValidFormStory, Meta);

test('Validates form', () => {
  render(FormOK());

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).not.toBeInTheDocument();
});
```

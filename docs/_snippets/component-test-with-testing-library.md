```ts filename="form.component.spec.ts" renderer="angular" language="ts"
import { render, screen, fireEvent } from '@testing-library/angular';

import { FormComponent } from './LoginForm.component';

import { InvalidForm } from './Form.stories'; //👈 Our stories imported here.

test('Checks if the form is valid ', async () => {
  await render(FormComponent, {
    componentProperties: InvalidForm.args,
  });

  fireEvent.click(screen.getByText('Submit'));

  const isFormValid = screen.getByTestId('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});
```

```js filename="Form.test.js" renderer="preact" language="js"
import '@testing-library/jest-dom/extend-expect';

import { h } from 'preact';

import { render, fireEvent } from '@testing-library/preact';

import { InvalidForm } from './LoginForm.stories'; //👈 Our stories imported here.

it('Checks if the form is valid', async () => {
  const { getByTestId, getByText } = render(<InvalidForm {...InvalidForm.args} />);

  fireEvent.click(getByText('Submit'));

  const isFormValid = getByTestId('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});
```

```js filename="Form.test.js|jsx" renderer="react" language="js"
import { fireEvent, render, screen } from '@testing-library/react';

import { composeStories } from '@storybook/react';

import * as stories from './LoginForm.stories'; // 👈 Our stories imported here.

const { InvalidForm } = composeStories(stories);

test('Checks if the form is valid', async () => {
  // Renders the composed story
  await InvalidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});
```

```ts filename="Form.test.ts|tsx" renderer="react" language="ts"
import { fireEvent, render, screen } from '@testing-library/react';

import { composeStories } from '@storybook/react';

import * as stories from './LoginForm.stories'; // 👈 Our stories imported here.

const { InvalidForm } = composeStories(stories);

test('Checks if the form is valid', async () => {
  // Renders the composed story
  await InvalidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});
```

```js filename="Form.test.js" renderer="svelte" language="js"
import { fireEvent, render, screen } from '@testing-library/svelte';

import { composeStories } from '@storybook/svelte';

import * as stories from './LoginForm.stories'; // 👈 Our stories imported here.

const { InvalidForm } = composeStories(stories);

it('Checks if the form is valid', async () => {
  // Renders the composed story
  await InvalidForm.run();

  await fireEvent.click(screen.getByText('Submit'));

  const isFormValid = screen.getByTestId('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});
```

```js filename="tests/Form.test.js" renderer="vue" language="js"
import { fireEvent, render, screen } from '@testing-library/vue';

import { composeStories } from '@storybook/vue3';

import * as stories from './LoginForm.stories'; // 👈 Our stories imported here.

const { InvalidForm } = composeStories(stories);

test('Checks if the form is valid', async () => {
  // Renders the composed story
  await InvalidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});
```

```ts filename="tests/Form.test.ts" renderer="vue" language="ts"
import { fireEvent, render, screen } from '@testing-library/vue';

import { composeStories } from '@storybook/vue3';

import * as stories from './LoginForm.stories'; // 👈 Our stories imported here.

const { InvalidForm } = composeStories(stories);

test('Checks if the form is valid', async () => {
  // Renders the composed story
  await InvalidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  fireEvent.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});
```

```ts filename="form.component.spec.ts" renderer="angular" language="ts"
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { FormComponent } from './login-form.component';

import { InvalidForm } from './Form.stories'; //👈 Our stories imported here.

test('Checks if the form is valid ', async () => {
  const user = userEvent.setup();

  await render(FormComponent, {
    componentProperties: InvalidForm.args,
  });

  await user.click(screen.getByText('Submit'));

  const isFormValid = screen.getByTestId('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});
```

```js filename="Form.test.js" renderer="preact" language="js"
import '@testing-library/jest-dom/extend-expect';

import { h } from 'preact';

import { render } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';

import { InvalidForm } from './LoginForm.stories'; //👈 Our stories imported here.

it('Checks if the form is valid', async () => {
  const user = userEvent.setup();

  const { getByTestId, getByText } = render(<InvalidForm {...InvalidForm.args} />);

  await user.click(getByText('Submit'));

  const isFormValid = getByTestId('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});
```

```js filename="Form.test.js|jsx" renderer="react" language="js"
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { composeStories } from '@storybook/your-framework';

import * as stories from './LoginForm.stories'; // 👈 Our stories imported here.

const { InvalidForm } = composeStories(stories);

test('Checks if the form is valid', async () => {
  const user = userEvent.setup();

  // Renders the composed story
  await InvalidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  await user.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});
```

```ts filename="Form.test.ts|tsx" renderer="react" language="ts"
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { composeStories } from '@storybook/your-framework';

import * as stories from './LoginForm.stories'; // 👈 Our stories imported here.

const { InvalidForm } = composeStories(stories);

test('Checks if the form is valid', async () => {
  const user = userEvent.setup();

  // Renders the composed story
  await InvalidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  await user.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});
```

```js filename="Form.test.js" renderer="svelte" language="js"
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';

// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
import { composeStories } from '@storybook/your-framework';

import * as stories from './LoginForm.stories'; // 👈 Our stories imported here.

const { InvalidForm } = composeStories(stories);

it('Checks if the form is valid', async () => {
  const user = userEvent.setup();

  // Renders the composed story
  await InvalidForm.run();

  await user.click(screen.getByText('Submit'));

  const isFormValid = screen.getByTestId('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});
```

```js filename="tests/Form.test.js" renderer="vue" language="js"
import { screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';

import { composeStories } from '@storybook/vue3-vite';

import * as stories from './LoginForm.stories'; // 👈 Our stories imported here.

const { InvalidForm } = composeStories(stories);

test('Checks if the form is valid', async () => {
  const user = userEvent.setup();

  // Renders the composed story
  await InvalidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  await user.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});
```

```ts filename="tests/Form.test.ts" renderer="vue" language="ts"
import { screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';

import { composeStories } from '@storybook/vue3-vite';

import * as stories from './LoginForm.stories'; // 👈 Our stories imported here.

const { InvalidForm } = composeStories(stories);

test('Checks if the form is valid', async () => {
  const user = userEvent.setup();

  // Renders the composed story
  await InvalidForm.run();

  const buttonElement = screen.getByRole('button', {
    name: 'Submit',
  });

  await user.click(buttonElement);

  const isFormValid = screen.getByLabelText('invalid-form');
  expect(isFormValid).toBeInTheDocument();
});
```

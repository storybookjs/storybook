import { global as globalThis } from '@storybook/global';

import {
  expect,
  fireEvent,
  fn,
  userEvent as testUserEvent,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from 'storybook/test';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Form,
  args: {
    onSuccess: fn(),
  },
  globals: {
    sb_theme: 'light',
  },
  tags: ['!vitest'],
};

export const Validation = {
  play: async (context) => {
    const { args, canvasElement, step } = context;
    const canvas = within(canvasElement);

    await step('Submit', async () => fireEvent.click(canvas.getByRole('button')));

    await expect(args.onSuccess).not.toHaveBeenCalled();
  },
};

export const Type = {
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByTestId('value'), 'foobar');
  },
};

export const Step = {
  play: async ({ step }) => {
    await step('Enter value', Type.play);
  },
};

export const TypeAndClear = {
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByTestId('value'), 'initial value');
    await userEvent.clear(canvas.getByTestId('value'));
    await userEvent.type(canvas.getByTestId('value'), 'final value');
  },
};

export const Callback = {
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step('Enter value', Type.play);

    await step('Submit', async () => {
      await fireEvent.click(canvas.getByRole('button'));
    });

    await expect(args.onSuccess).toHaveBeenCalled();
  },
};

// NOTE: of course you can use `findByText()` to implicitly waitFor, but we want
// an explicit test here
export const SyncWaitFor = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step('Submit form', Callback.play);
    await waitFor(() => canvas.getByText('Completed!!'));
    await waitForElementToBeRemoved(() => canvas.queryByText('Completed!!'), {
      timeout: 2000,
    });
  },
};

export const AsyncWaitFor = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step('Submit form', Callback.play);
    await waitFor(async () => canvas.getByText('Completed!!'));
    await waitForElementToBeRemoved(() => canvas.queryByText('Completed!!'), {
      timeout: 2000,
    });
  },
};

export const WithLoaders = {
  loaders: [async () => new Promise((resolve) => setTimeout(resolve, 2000))],
  play: async ({ step }) => {
    await step('Submit form', Callback.play);
  },
};

const UserEventSetup = {
  play: async (context) => {
    const { args, canvasElement, step, userEvent } = context;
    const canvas = within(canvasElement);
    await step('Select and type on input using user-event v14 setup', async () => {
      const input = canvas.getByRole('textbox');
      await userEvent.click(input);
      await userEvent.type(input, 'Typing ...');
    });
    await step('Tab and press enter on submit button', async () => {
      // Vitest's userEvent does not support pointer events, so we use storybook's
      await testUserEvent.pointer([
        { keys: '[TouchA>]', target: canvas.getByRole('textbox') },
        { keys: '[/TouchA]' },
      ]);
      const submitButton = await canvas.findByRole('button');

      if (navigator.userAgent.toLowerCase().includes('firefox')) {
        // user event has a few issues on firefox, therefore we do it differently
        await fireEvent.click(submitButton);
      } else {
        await userEvent.tab();
        await userEvent.keyboard('{enter}');
        await expect(submitButton).toHaveFocus();
      }

      await expect(args.onSuccess).toHaveBeenCalled();
    });
  },
};

export { UserEventSetup };

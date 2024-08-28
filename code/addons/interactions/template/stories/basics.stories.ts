import { global as globalThis } from '@storybook/global';
import {
  expect,
  fireEvent,
  fn,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from '@storybook/test';

export default {
  component: globalThis.Components.Form,
  args: {
    onSuccess: fn(),
  },
  globals: {
    sb_theme: 'light',
  },
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
  play: async ({ canvasElement }) => {
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
  play: async ({ canvasElement }) => {
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
  },
};

export const AsyncWaitFor = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step('Submit form', Callback.play);
    await waitFor(async () => canvas.getByText('Completed!!'));
  },
};

export const WaitForElementToBeRemoved = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step('SyncWaitFor play fn', SyncWaitFor.play);
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
    const { args, canvasElement, step } = context;
    const user = userEvent.setup();
    const canvas = within(canvasElement);
    await step('Select and type on input using user-event v14 setup', async () => {
      const input = canvas.getByRole('textbox');
      await user.click(input);
      await user.type(input, 'Typing ...');
    });
    await step('Tab and press enter on submit button', async () => {
      await user.pointer([
        { keys: '[TouchA>]', target: canvas.getByRole('textbox') },
        { keys: '[/TouchA]' },
      ]);
      await user.tab();
      await user.keyboard('{enter}');
      const submitButton = await canvas.findByRole('button');
      await expect(submitButton).toHaveFocus();
      await expect(args.onSuccess).toHaveBeenCalled();
    });
  },
};

export { UserEventSetup };

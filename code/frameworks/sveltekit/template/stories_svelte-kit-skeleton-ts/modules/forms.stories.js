import { applyAction } from '$app/forms';
import { goto, refreshAll } from '$app/navigation';
import { formAction } from '@storybook/sveltekit/forms.mock';
import { expect, fn, userEvent, waitFor } from 'storybook/test';

import Forms from './Forms.svelte';

export default {
  title: 'stories/frameworks/sveltekit/modules/forms',
  component: Forms,
};

const subscribe = async (canvas) => {
  await userEvent.type(canvas.getByLabelText('Email'), 'ada@example.com');
  await userEvent.click(canvas.getByRole('button', { name: 'Subscribe' }));
};

export const Success = {
  beforeEach() {
    formAction.mockResolvedValue({
      type: 'success',
      status: 200,
      data: { email: 'ada@example.com' },
    });
  },
  async play({ canvas }) {
    await subscribe(canvas);
    await expect(await canvas.findByText('Subscribed ada@example.com')).toBeInTheDocument();
    await expect(formAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: expect.any(URL), formData: expect.any(FormData) })
    );
    const [{ action, formData }] = formAction.mock.calls[0];
    await expect(action.search).toBe('?/subscribe');
    await expect(formData.get('email')).toBe('ada@example.com');
    await expect(refreshAll).toHaveBeenCalled();
    await expect(canvas.getByLabelText('Email')).toHaveValue('');
    await expect(canvas.getByTestId('status')).toHaveTextContent('200');
  },
};

export const Failure = {
  beforeEach() {
    formAction.mockResolvedValue({
      type: 'failure',
      status: 400,
      data: { error: 'Invalid email' },
    });
  },
  async play({ canvas }) {
    await subscribe(canvas);
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Invalid email');
    await expect(canvas.getByTestId('status')).toHaveTextContent('400');
    await expect(canvas.getByLabelText('Email')).toHaveValue('ada@example.com');
    await expect(refreshAll).not.toHaveBeenCalled();
  },
};

export const Redirect = {
  beforeEach() {
    formAction.mockResolvedValue({ type: 'redirect', status: 303, location: '/thanks' });
  },
  async play({ canvas }) {
    await subscribe(canvas);
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/thanks'));
  },
};

export const ServerError = {
  beforeEach() {
    formAction.mockRejectedValue(new Error('Server down'));
  },
  async play({ canvas }) {
    await subscribe(canvas);
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Error: Server down');
    await expect(canvas.getByTestId('status')).toHaveTextContent('500');
  },
};

export const Cancel = {
  args: {
    submit: fn(({ cancel }) => cancel()),
  },
  async play({ args, canvas }) {
    await subscribe(canvas);
    await waitFor(() => expect(args.submit).toHaveBeenCalled());
    await expect(formAction).not.toHaveBeenCalled();
  },
};

export const CustomCallback = {
  args: {
    submit: () => async () => {},
  },
  async play({ canvas }) {
    await subscribe(canvas);
    await waitFor(() => expect(formAction).toHaveBeenCalled());
    await expect(applyAction).not.toHaveBeenCalled();
    await expect(canvas.getByLabelText('Email')).toHaveValue('ada@example.com');
  },
};

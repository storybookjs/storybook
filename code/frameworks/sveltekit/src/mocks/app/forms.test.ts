// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { restoreAllMocks } from 'storybook/test';

import { page, resetAppState } from '@storybook/sveltekit/internal/mocks/app/state.svelte.js';
import { refreshAll } from '@storybook/sveltekit/navigation.mock';

import type { ActionResult, SubmitFunction } from '../types.ts';
import { applyAction, enhance, formAction } from './forms.ts';

let destroy: (() => void) | undefined;

const setup = (
  html = '<form method="post" action="/subscribe"><input name="email" /><button>Go</button></form>',
  submit?: SubmitFunction
) => {
  document.body.innerHTML = html;
  const form = document.querySelector('form')!;
  destroy = enhance(form, submit).destroy;
  const input = form.querySelector('input')!;
  input.value = 'ada@example.com';
  return { form, input };
};

const submitForm = async (form: HTMLFormElement, submitter?: HTMLElement) => {
  form.requestSubmit(submitter);
  await vi.waitFor(() => expect(formAction).toHaveBeenCalled());
  // Lets the rest of the submit flow run
  await new Promise((resolve) => setTimeout(resolve));
};

beforeEach(() => {
  restoreAllMocks();
  resetAppState();
});

afterEach(() => {
  destroy?.();
  document.body.innerHTML = '';
});

describe('enhance', () => {
  it('sends the submission to formAction instead of the server', async () => {
    const { form } = setup();

    await submitForm(form, form.querySelector('button')!);

    expect(formAction).toHaveBeenCalledWith({
      action: new URL('/subscribe', location.href),
      formData: expect.any(FormData),
      formElement: form,
      submitter: form.querySelector('button'),
    });
    expect(formAction.mock.calls[0][0].formData.get('email')).toBe('ada@example.com');
  });

  it('uses the formaction of the submitter', async () => {
    const { form } = setup(
      '<form method="post" action="/a"><input name="email" /><button formaction="/b">Go</button></form>'
    );

    await submitForm(form, form.querySelector('button')!);

    expect(formAction.mock.calls[0][0].action.pathname).toBe('/b');
  });

  it('leaves forms that are not posted to the browser', async () => {
    const { form } = setup('<form method="get" action="/search"><input name="q" /></form>');
    const submit = new Event('submit', { cancelable: true });

    form.dispatchEvent(submit);
    await new Promise((resolve) => setTimeout(resolve));

    expect(submit.defaultPrevented).toBe(false);
    expect(formAction).not.toHaveBeenCalled();
  });

  it('applies the result when the callback calls update, with its options', async () => {
    const { form, input } = setup(undefined, () => async ({ update }) => {
      await update({ reset: false, refreshAll: false });
    });

    await submitForm(form);

    expect(applyAction).toHaveBeenCalledWith({ type: 'success', status: 200 });
    expect(input.value).toBe('ada@example.com');
    expect(refreshAll).not.toHaveBeenCalled();
  });

  it('does not call formAction when the submit callback aborts the controller', async () => {
    const { form } = setup(undefined, ({ controller }) => controller.abort());

    form.requestSubmit();
    await new Promise((resolve) => setTimeout(resolve));

    expect(formAction).not.toHaveBeenCalled();
    expect(applyAction).not.toHaveBeenCalled();
  });

  describe('with a formAction that rejects', () => {
    const error = new Error('Server down');

    beforeEach(() => {
      formAction.mockRejectedValue(error);
    });

    it('passes an error result with status 500 to the callback of the submit function', async () => {
      const callback = vi.fn();
      const { form } = setup(undefined, () => callback);

      await submitForm(form);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ result: { type: 'error', status: 500, error } })
      );
    });
  });

  describe('with a formAction that is still pending', () => {
    let results: Array<(result: ActionResult) => void>;

    beforeEach(() => {
      results = [];
      formAction.mockImplementation(() => new Promise((resolve) => results.push(resolve)));
    });

    it('drops the result of a submission whose controller was aborted', async () => {
      let previous: AbortController | undefined;
      const { form } = setup(undefined, ({ controller }) => {
        previous?.abort();
        previous = controller;
      });

      form.requestSubmit();
      await vi.waitFor(() => expect(formAction).toHaveBeenCalledTimes(1));
      form.requestSubmit();
      await vi.waitFor(() => expect(formAction).toHaveBeenCalledTimes(2));
      results[1]({ type: 'failure', status: 400, data: { submission: 2 } });
      results[0]({ type: 'success', status: 200, data: { submission: 1 } });
      await new Promise((resolve) => setTimeout(resolve));

      expect(applyAction).toHaveBeenCalledTimes(1);
      expect(page.form).toEqual({ submission: 2 });
    });

    it('drops the result when the form is destroyed, so it does not change the next story', async () => {
      const { form } = setup();
      form.requestSubmit();
      await vi.waitFor(() => expect(formAction).toHaveBeenCalled());

      destroy!();
      destroy = undefined;
      restoreAllMocks();
      resetAppState();
      results[0]({ type: 'success', status: 201, data: { stale: true } });
      await new Promise((resolve) => setTimeout(resolve));

      expect(page.form).toBeNull();
      expect(page.status).toBe(-1);
      expect(refreshAll).not.toHaveBeenCalled();
    });
  });

  it('drops a submission whose submit callback is still running when the form is destroyed', async () => {
    let validate!: () => void;
    const { form } = setup(undefined, () => new Promise<void>((resolve) => (validate = resolve)));
    form.requestSubmit();
    await vi.waitFor(() => expect(validate).toBeDefined());

    destroy!();
    destroy = undefined;
    restoreAllMocks();
    resetAppState();
    validate();
    await new Promise((resolve) => setTimeout(resolve));

    expect(formAction).not.toHaveBeenCalled();
    expect(page.form).toBeNull();
    expect(page.status).toBe(-1);
  });

  it('does not apply the result when the form is destroyed before the callback calls update', async () => {
    let finish!: () => void;
    const { form } = setup(undefined, () => async ({ update }) => {
      await new Promise<void>((resolve) => (finish = resolve));
      await update();
    });
    await submitForm(form);

    destroy!();
    destroy = undefined;
    restoreAllMocks();
    resetAppState();
    finish();
    await new Promise((resolve) => setTimeout(resolve));

    expect(applyAction).not.toHaveBeenCalled();
    expect(refreshAll).not.toHaveBeenCalled();
    expect(page.status).toBe(-1);
  });

  describe('with a refreshAll that is still pending', () => {
    let finishRefresh: () => void;

    beforeEach(() => {
      refreshAll.mockImplementation(
        () => new Promise<void>((resolve) => (finishRefresh = resolve))
      );
    });

    it('does not apply the result of an unawaited update when the form is destroyed', async () => {
      const { form } = setup(undefined, () => ({ update }) => {
        void update();
      });
      await submitForm(form);
      await vi.waitFor(() => expect(refreshAll).toHaveBeenCalled());

      destroy!();
      destroy = undefined;
      finishRefresh();
      await new Promise((resolve) => setTimeout(resolve));

      expect(applyAction).not.toHaveBeenCalled();
    });
  });

  it('stops listening when destroyed', async () => {
    const { form } = setup();
    destroy!();
    destroy = undefined;
    const submit = new Event('submit', { cancelable: true });

    form.dispatchEvent(submit);
    await new Promise((resolve) => setTimeout(resolve));

    expect(formAction).not.toHaveBeenCalled();
  });
});

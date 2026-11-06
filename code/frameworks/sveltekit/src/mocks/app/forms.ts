// @ts-expect-error no declaration file for this JS module
import { page } from '@storybook/sveltekit/internal/mocks/app/state.svelte.js';
// The same module instance as `$app/navigation`, so stories see the calls of `goto` and `refreshAll`
import { goto, refreshAll } from '@storybook/sveltekit/navigation.mock';
import { noteConfiguration } from '@storybook/sveltekit/internal/mocks/docs-isolation';
import { fn } from 'storybook/test';

import type { ActionResult, FormSubmission, SubmitFunction, UpdateOptions } from '../types.ts';

/*
 * Mock of SvelteKit's `$app/forms`, which the framework aliases to this module. `enhance` runs
 * SvelteKit's submit flow, with `formAction` in place of the request to the server:
 * https://github.com/sveltejs/kit/blob/main/packages/kit/src/runtime/app/forms/client.js
 */

/**
 * Stands in for the server's form action. A form with `use:enhance` calls it on submit, and its
 * result drives the rest of the submit flow. Resolves `{ type: 'success', status: 200 }` by
 * default; set another result in `beforeEach`.
 *
 * @example
 *
 * ```ts
 * import { formAction } from '@storybook/sveltekit/forms.mock';
 *
 * export const InvalidEmail = {
 *   beforeEach() {
 *     formAction.mockResolvedValue({ type: 'failure', status: 400, data: { error: 'Invalid email' } });
 *   },
 * };
 * ```
 */
export const formAction = fn<(submission: FormSubmission) => Promise<ActionResult>>(async () => ({
  type: 'success',
  status: 200,
})).mockName('$app/forms::formAction');

/**
 * Applies a form action result to the page, like SvelteKit: a redirect calls `goto`, an error sets
 * `page.error`, and other results set `page.form` and `page.status`.
 */
export const applyAction = fn(async (result: ActionResult) => {
  switch (result.type) {
    case 'redirect':
      await goto(result.location);
      return;
    case 'error':
      page.error = result.error;
      page.status = result.status ?? 500;
      return;
    case 'success':
    case 'failure':
      page.form = result.data;
      page.status = result.status;
      return;
    default: {
      const unknownResult: never = result;
      return unknownResult;
    }
  }
}).mockName('$app/forms::applyAction');

// Stories have no server response to deserialize; give it an implementation in `beforeEach` if a
// component needs one
export const deserialize = fn<(result: string) => ActionResult | undefined>(
  () => undefined
).mockName('$app/forms::deserialize');

// Shallow clones the form, so `form.action` and `form.method` are not shadowed by inputs with
// those names, like SvelteKit does
const clone = <T extends HTMLElement>(element: T): T =>
  HTMLElement.prototype.cloneNode.call(element) as T;

// Not named, so mounting a form doesn't log anything
export const enhance = fn((formElement: HTMLFormElement, submit: SubmitFunction = () => {}) => {
  // The submissions in flight. `destroy` aborts them, so a result that arrives after the story
  // ended doesn't change the next story
  const controllers = new Set<AbortController>();
  // Also checked by `update()`, which a callback can call without waiting for it
  let destroyed = false;

  // Does nothing once the submission is aborted or the form destroyed, also after the
  // `refreshAll()` it waits for
  const fallback = async (
    signal: AbortSignal,
    result: ActionResult,
    options: UpdateOptions = {}
  ) => {
    if (signal.aborted || destroyed) {
      return;
    }
    const { reset = true } = options;
    const shouldRefreshAll =
      options.refreshAll ?? options.invalidateAll ?? result.type === 'success';

    if (result.type === 'success' && reset) {
      HTMLFormElement.prototype.reset.call(formElement);
    }
    if (shouldRefreshAll && result.type !== 'redirect') {
      await refreshAll();
    }
    if (!signal.aborted && !destroyed) {
      await applyAction(result);
    }
  };

  const handleSubmit = async (event: Event) => {
    const submitter = (event as SubmitEvent).submitter as
      | HTMLButtonElement
      | HTMLInputElement
      | null;
    const method = submitter?.hasAttribute('formmethod')
      ? submitter.formMethod
      : clone(formElement).method;
    if (method !== 'post') {
      return;
    }

    event.preventDefault();

    const action = new URL(
      submitter?.hasAttribute('formaction') ? submitter.formAction : clone(formElement).action
    );
    const formData = new FormData(formElement, submitter);

    // Tracked for the whole submission, so `destroy` also stops one that waits in a callback
    const controller = new AbortController();
    controllers.add(controller);
    try {
      await submitWith(controller, { action, formData, formElement, submitter });
    } finally {
      controllers.delete(controller);
    }
  };

  const submitWith = async (controller: AbortController, submission: FormSubmission) => {
    const { signal } = controller;
    let cancelled = false;
    const callback =
      (await submit({
        ...submission,
        cancel: () => {
          cancelled = true;
        },
        controller,
      })) ?? (({ result }: { result: ActionResult }) => fallback(signal, result));
    // Like SvelteKit, whose aborted request rejects with an `AbortError` that ends the submission
    if (cancelled || signal.aborted) {
      return;
    }

    let result: ActionResult;
    try {
      result = await formAction(submission);
    } catch (error) {
      result = { type: 'error', status: 500, error };
    }
    if (signal.aborted) {
      return;
    }

    await callback({
      action: submission.action,
      formData: submission.formData,
      formElement: submission.formElement,
      result,
      update: (options) => fallback(signal, result, options),
    });
  };

  HTMLFormElement.prototype.addEventListener.call(formElement, 'submit', handleSubmit);

  return {
    destroy() {
      destroyed = true;
      controllers.forEach((controller) => controller.abort());
      HTMLFormElement.prototype.removeEventListener.call(formElement, 'submit', handleSubmit);
    },
  };
});

// On a docs page, configuring these in `beforeEach` counts as setting the mocks
[formAction, applyAction, deserialize, enhance].forEach(noteConfiguration);

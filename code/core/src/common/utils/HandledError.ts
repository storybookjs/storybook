import { StorybookError } from '../../storybook-error.ts';

export class HandledError extends Error {
  public handled = true;

  constructor(error: unknown) {
    super(String(error));

    if (typeof error !== 'string') {
      this.cause = error;
    }
  }
}

/** Whether the error was already shown to the user, so it is not printed again or treated as a crash. */
export const isHandledError = (error: unknown): error is HandledError | StorybookError =>
  error instanceof HandledError || (error instanceof StorybookError && error.isHandledError);

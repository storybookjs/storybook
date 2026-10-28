export class HandledError extends Error {
  public handled = true;

  constructor(error: unknown) {
    super(String(error));

    if (typeof error !== 'string') {
      this.cause = error;
    }
  }
}

/**
 * Whether `error` is a {@link HandledError}. Matches on the `handled` marker so it also recognizes
 * instances from another copy of this module, where `instanceof` fails.
 */
export function isHandledError(error: unknown): error is HandledError {
  return (
    error instanceof HandledError ||
    (error instanceof Error && (error as Partial<HandledError>).handled === true)
  );
}

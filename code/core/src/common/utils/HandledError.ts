export class HandledError extends Error {
  public handled = true;

  constructor(error: unknown) {
    super(String(error));

    if (typeof error !== 'string') this.cause = error;
  }
}

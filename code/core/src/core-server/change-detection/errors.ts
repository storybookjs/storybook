export class ChangeDetectionUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ChangeDetectionUnavailableError';
  }
}

export class ChangeDetectionFailureError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ChangeDetectionFailureError';
  }
}

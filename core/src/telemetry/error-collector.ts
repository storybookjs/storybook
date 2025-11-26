/**
 * Service for collecting errors during Storybook initialization.
 *
 * This singleton class exists to accumulate non-fatal errors that occur during the Storybook's
 * processes. Instead of immediately reporting errors to telemetry (which could interrupt the
 * process), errors are collected here and then batch-reported at the end of initialization via the
 * telemetry system.
 *
 * This allows Storybook to continue e.g. initialization even when non-critical errors occur,
 * ensuring a better user experience while still capturing all errors for telemetry and debugging
 * purposes.
 */
export class ErrorCollector {
  private static instance: ErrorCollector;
  private errors: unknown[] = [];

  private constructor() {}

  public static getInstance(): ErrorCollector {
    if (!ErrorCollector.instance) {
      ErrorCollector.instance = new ErrorCollector();
    }
    return ErrorCollector.instance;
  }

  public static addError(error: unknown) {
    this.getInstance().errors.push(error);
  }

  public static getErrors() {
    return this.getInstance().errors;
  }
}

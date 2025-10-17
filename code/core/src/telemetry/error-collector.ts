/** Service for collecting errors during Storybook initialization */
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

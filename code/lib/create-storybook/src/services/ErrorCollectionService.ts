/** Service for collecting errors during Storybook initialization */
export class ErrorCollectionService {
  private static instance: ErrorCollectionService;
  private errors: unknown[] = [];

  private constructor() {}

  public static getInstance(): ErrorCollectionService {
    if (!ErrorCollectionService.instance) {
      ErrorCollectionService.instance = new ErrorCollectionService();
    }
    return ErrorCollectionService.instance;
  }

  public static addError(error: unknown) {
    this.getInstance().errors.push(error);
  }

  public static getErrors() {
    return this.getInstance().errors;
  }
}

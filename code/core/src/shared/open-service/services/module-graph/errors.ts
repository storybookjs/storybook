export class ModuleGraphFailureError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ModuleGraphFailureError';
  }
}

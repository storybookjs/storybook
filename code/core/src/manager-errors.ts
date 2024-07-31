import { StorybookError } from './storybook-error';

/**
 * If you can't find a suitable category for your error, create one
 * based on the package name/file path of which the error is thrown.
 * For instance:
 * If it's from @storybook/client-logger, then MANAGER_CLIENT-LOGGER
 *
 * Categories are prefixed by a logical grouping, e.g. MANAGER_
 * to prevent manager and preview errors from having the same category and error code.
 */
export enum Category {
  MANAGER_UNCAUGHT = 'MANAGER_UNCAUGHT',
  MANAGER_UI = 'MANAGER_UI',
  MANAGER_API = 'MANAGER_API',
  MANAGER_CLIENT_LOGGER = 'MANAGER_CLIENT-LOGGER',
  MANAGER_CHANNELS = 'MANAGER_CHANNELS',
  MANAGER_CORE_EVENTS = 'MANAGER_CORE-EVENTS',
  MANAGER_ROUTER = 'MANAGER_ROUTER',
  MANAGER_THEMING = 'MANAGER_THEMING',
}

export class ProviderDoesNotExtendBaseProviderError extends StorybookError {
  constructor() {
    super({
      category: Category.MANAGER_UI,
      code: 1,
      message: `The Provider passed into Storybook's UI is not extended from the base Provider. Please check your Provider implementation.`,
    });
  }
}

export class UncaughtManagerError extends StorybookError {
  constructor(
    public data: {
      error: Error;
    }
  ) {
    super({
      category: Category.MANAGER_UNCAUGHT,
      code: 1,
      message: data.error.message,
    });
    this.stack = data.error.stack;
  }
}

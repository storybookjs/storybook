import type { Status, StatusTypeId } from './shared/status-store/index.ts';
import { StorybookError } from './storybook-error.ts';

/**
 * If you can't find a suitable category for your error, create one based on the package name/file
 * path of which the error is thrown. For instance: If it's from `storybook/internal/client-logger`,
 * then MANAGER_CLIENT-LOGGER
 *
 * Categories are prefixed by a logical grouping, e.g. MANAGER_ to prevent manager and preview
 * errors from having the same category and error code.
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
  MANAGER_UNIVERSAL_STORE = 'MANAGER_UNIVERSAL-STORE',
  MANAGER_OPEN_SERVICE = 'MANAGER_OPEN-SERVICE',
}

export class ProviderDoesNotExtendBaseProviderError extends StorybookError {
  constructor() {
    super({
      name: 'ProviderDoesNotExtendBaseProviderError',
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
      name: 'UncaughtManagerError',
      category: Category.MANAGER_UNCAUGHT,
      code: 1,
      message: data.error.message,
    });
    this.stack = data.error.stack;
  }
}

export class StatusTypeIdMismatchError extends StorybookError {
  constructor(
    public data: {
      status: Status;
      typeId: StatusTypeId;
    }
  ) {
    super({
      name: 'StatusTypeIdMismatchError',
      category: Category.MANAGER_API,
      code: 1,
      message: `Status has typeId "${data.status.typeId}" but was added to store with typeId "${data.typeId}". Full status: ${JSON.stringify(
        data.status,
        null,
        2
      )}`,
    });
  }
}

export class UniversalStoreFollowerTimeoutError extends StorybookError {
  constructor(followerId: string) {
    super({
      name: 'UniversalStoreFollowerTimeoutError',
      category: Category.MANAGER_UNIVERSAL_STORE,
      code: 1,
      message: `Timed out waiting for leader state for UniversalStore follower with id: '${followerId}'. Ensure a leader with the same id exists and is reachable before creating a follower.`,
    });
  }
}

export class OpenServiceStaticSnapshotLoadError extends StorybookError {
  constructor(
    public data: {
      serviceId: string;
      queryName: string;
      input: unknown;
      logicalPath: string;
      url: string;
      cause: unknown;
      status?: number;
      statusText?: string;
    }
  ) {
    super({
      name: 'OpenServiceStaticSnapshotLoadError',
      category: Category.MANAGER_OPEN_SERVICE,
      code: 1,
      message: `Failed to load open-service static snapshot "${data.logicalPath}" from "${data.url}" for "${data.serviceId}.${data.queryName}".`,
      cause: data.cause,
    });
  }
}

export class OpenServiceStaticSnapshotInvalidError extends StorybookError {
  constructor(
    public data: {
      serviceId: string;
      queryName: string;
      input: unknown;
      logicalPath: string;
      url: string;
      received: unknown;
    }
  ) {
    super({
      name: 'OpenServiceStaticSnapshotInvalidError',
      category: Category.MANAGER_OPEN_SERVICE,
      code: 2,
      message: `Open-service static snapshot "${data.logicalPath}" from "${data.url}" for "${data.serviceId}.${data.queryName}" must be a plain object.`,
    });
  }
}

import { StorybookError } from '../../storybook-error';

export abstract class UniversalStoreError extends StorybookError {
  constructor(props: { code: number; message: string; name: string }) {
    super({
      ...props,
      category: 'MANAGER_UNIVERSAL-STORE',
    });
  }
}

export class UniversalStoreFollowerTimeoutError extends UniversalStoreError {
  constructor(public data: { id: string }) {
    super({
      name: 'UniversalStoreFollowerTimeoutError',
      code: 1,
      message: `No existing state found for follower with id: '${data.id}'. Make sure a leader with the same id exists before creating a follower.`,
    });
  }
}

export class UniversalStoreNotConstructableError extends UniversalStoreError {
  constructor() {
    super({
      name: 'UniversalStoreNotConstructableError',
      code: 1001,
      message: 'UniversalStore is not constructable - use UniversalStore.create() instead',
    });
  }
}

export class UniversalStoreIdRequiredError extends UniversalStoreError {
  constructor() {
    super({
      name: 'UniversalStoreIdRequiredError',
      code: 1002,
      message: 'id is required and must be a string, when creating a UniversalStore',
    });
  }
}

export class UniversalStoreNotReadyError extends UniversalStoreError {
  constructor(public data: { id: string; action: 'set state' | 'send event' }) {
    super({
      name: 'UniversalStoreNotReadyError',
      code: 1003,
      message: `Cannot ${data.action} before store with id '${data.id}' is ready. You can get the current status with store.status, or await store.readyPromise to wait for the store to be ready before sending events.`,
    });
  }
}

export class UniversalStoreMissingSubscribeArgumentError extends UniversalStoreError {
  constructor(public data: { id: string }) {
    super({
      name: 'UniversalStoreMissingSubscribeArgumentError',
      code: 1004,
      message: `Missing first subscribe argument, or second if first is the event type, when subscribing to a UniversalStore with id '${data.id}'`,
    });
  }
}

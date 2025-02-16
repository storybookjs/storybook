import { Channel } from '@storybook/core/channels';

import dedent from 'ts-dedent';

import { UniversalStore } from '.';
import type { StoreOptions } from './types';

/**
 * A mock universal store that can be used when testing code that relies on a universal store. It
 * functions exactly like a normal universal store, with a few exceptions:
 *
 * - It is fully isolated, meaning that it doesn't interact with any channel, and it is always a
 *   leader.
 *
 * If the second testUtils argument is provided, all the public methods are spied on, so they can be
 * asserted.
 *
 * When a mock store is re-used across tests (eg. in stories), you manually need to reset the state
 * after each test.
 *
 * @example
 *
 * ```ts
 * import * as testUtils from '@storybook/test'; // in stories
 * import { vi as testUtils } from 'vitest'; // ... or in Vitest tests
 *
 * const initialState = { ... };
 * const store = new MockUniversalStore({ initialState }, testUtils);
 *
 * export default {
 *   title: 'My story',
 *   beforeEach: () => {
 *     return () => {
 *       store.setState(initialState);
 *     };
 *   }
 * }
 * ```
 */
export class MockUniversalStore<
  State,
  CustomEvent extends { type: string; payload?: any } = { type: string; payload?: any },
> extends UniversalStore<State, CustomEvent> {
  private testUtils;

  public constructor(options: StoreOptions<State>, testUtils?: any) {
    UniversalStore.isInternalConstructing = true;
    super(
      { ...options, leader: true },
      { channel: new Channel({}), environment: UniversalStore.Environment.MOCK }
    );
    UniversalStore.isInternalConstructing = false;

    if (typeof testUtils?.fn !== 'function') {
      return;
    }

    this.testUtils = testUtils;
    this.getState = testUtils.fn(this.getState);
    this.setState = testUtils.fn(this.setState);
    this.subscribe = testUtils.fn(this.subscribe);
    this.onStateChange = testUtils.fn(this.onStateChange);
    this.send = testUtils.fn(this.send);
  }

  /** Create a mock universal store. This is just an alias for the constructor */
  static create<
    State = any,
    CustomEvent extends { type: string; payload?: any } = { type: string; payload?: any },
  >(options: StoreOptions<State>, testUtils?: any): MockUniversalStore<State, CustomEvent> {
    return new MockUniversalStore(options, testUtils);
  }

  public unsubscribeAll() {
    if (!this.testUtils) {
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error(
        dedent`Cannot call unsubscribeAll on a store that does not have testUtils.
        Please provide testUtils as the second argument when creating the store.`
      );
    }
    // unsubscribe all listeners by calling the unsubscribe methods returned from the calls
    const callReturnedUnsubscribeFn = (result: any) => {
      try {
        result.value();
      } catch (e) {
        // ignore
      }
    };
    //@ts-expect-error - TS doesn't know that it's a mock
    this.subscribe.mock?.results.forEach(callReturnedUnsubscribeFn);
    //@ts-expect-error - TS doesn't know that it's a mock
    this.onStateChange.mock?.results.forEach(callReturnedUnsubscribeFn);
  }
}

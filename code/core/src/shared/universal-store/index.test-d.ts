import { describe, expectTypeOf, it } from 'vitest';

import { UniversalStore } from '.';
import type { EventInfo, InternalEvent } from './types';
import { useUniversalStore as useUniversalStoreManager } from './use-universal-store-manager';
import { useUniversalStore as useUniversalStorePreview } from './use-universal-store-preview';

type State = { count: number; done: boolean };
type IncrementEvent = {
  type: 'INCREMENT';
  payload: number;
};
type ToggleEvent = { type: 'TOGGLE' };
type CustomEvent = IncrementEvent | ToggleEvent;

describe('UniversalStore', () => {
  it('should have any types without State or Event specified', () => {
    const store = UniversalStore.create({ id: 'test' });
    expectTypeOf(store).toEqualTypeOf<UniversalStore<any, { type: string; payload?: any }>>();

    expectTypeOf(store.getState()).toEqualTypeOf<any>();
    expectTypeOf(store.setState).parameter(0).toEqualTypeOf<any | ((state: any) => any)>();
    store.onStateChange((state, previousState, eventInfo) => {
      expectTypeOf(state).toEqualTypeOf<any>();
      expectTypeOf(previousState).toEqualTypeOf<any>();
      expectTypeOf(eventInfo).toEqualTypeOf<EventInfo>();
    });
  });

  it('should have the correct types for State', () => {
    const store = UniversalStore.create<State>({ id: 'test' });
    expectTypeOf(store).toEqualTypeOf<UniversalStore<State, { type: string; payload?: any }>>();

    // Assert - get
    expectTypeOf(store.getState()).toEqualTypeOf<State>();

    // Assert - set
    expectTypeOf(store.setState).parameter(0).toEqualTypeOf<State | ((state: State) => State)>();

    // Assert - listener
    store.onStateChange((state, previousState, eventInfo) => {
      expectTypeOf(state).toEqualTypeOf<State>();
      expectTypeOf(previousState).toEqualTypeOf<State>();
      expectTypeOf(eventInfo).toEqualTypeOf<EventInfo>();
    });
  });

  it('should have the correct types for CustomEvent', () => {
    const store = UniversalStore.create<any, CustomEvent>({ id: 'test' });
    expectTypeOf(store).toEqualTypeOf<UniversalStore<any, CustomEvent>>();

    expectTypeOf(store.send).parameter(0).toEqualTypeOf<CustomEvent>();

    store.subscribe((event) => {
      expectTypeOf(event).toMatchTypeOf<CustomEvent | InternalEvent<State>>();
      if (event.type === 'INCREMENT') {
        expectTypeOf(event.payload).toEqualTypeOf<IncrementEvent['payload']>();
      }
    });

    store.subscribe('TOGGLE', (event) => {
      expectTypeOf(event).toEqualTypeOf<ToggleEvent>();
    });
  });

  describe('useUniversalStore', () => {
    describe('Manager', () => {
      it('should have correct types for the state without a selector', () => {
        const store = UniversalStore.create<State, CustomEvent>({ id: 'test' });
        const [state, setState] = useUniversalStoreManager(store);
        expectTypeOf(state).toEqualTypeOf<State>();
        expectTypeOf(setState).parameter(0).toEqualTypeOf<State | ((state: State) => State)>();
      });

      it('should have correct types for the state with a selector', () => {
        const store = UniversalStore.create<State, CustomEvent>({ id: 'test' });
        const [state, setState] = useUniversalStoreManager(store, (s) => {
          expectTypeOf(s).toEqualTypeOf<State>();
          return s.count;
        });
        expectTypeOf(state).toEqualTypeOf<State['count']>();
        expectTypeOf(setState).parameter(0).toEqualTypeOf<State | ((state: State) => State)>();
      });
    });

    describe('Preview', () => {
      it('should have correct types for the state without a selector', () => {
        const store = UniversalStore.create<State, CustomEvent>({ id: 'test' });
        const [state, setState] = useUniversalStorePreview(store);
        expectTypeOf(state).toEqualTypeOf<State>();
        expectTypeOf(setState).parameter(0).toEqualTypeOf<State | ((state: State) => State)>();
      });

      it('should have correct types for the state with a selector', () => {
        const store = UniversalStore.create<State, CustomEvent>({ id: 'test' });
        const [state, setState] = useUniversalStorePreview(store, (s) => {
          expectTypeOf(s).toEqualTypeOf<State>();
          return s.count;
        });
        expectTypeOf(state).toEqualTypeOf<State['count']>();
        expectTypeOf(setState).parameter(0).toEqualTypeOf<State | ((state: State) => State)>();
      });
    });
  });
});

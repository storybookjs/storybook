import { getContext, setContext } from 'svelte';

function createMockedStateValue<T>(contextName: string, defaultValue?: T) {
  let value = $state.raw(getContext(contextName) ?? defaultValue);

  return {
    get current() {
      return value as T;
    },
    set current(newValue: T) {
      value = newValue;
      setContext(contextName, newValue);
    },
  };
}

function createPageState() {
  const contextValue = getContext('page-state-ctx') ?? {
    url: new URL('http://localhost:6006'),
    params: {},
    route: {
      id: '/',
    },
    status: 200,
    error: null,
    data: {},
    form: undefined,
    state: {},
  };

  return $state.raw(contextValue);
}

function createNavigatingState() {
  const contextValue = getContext('navigating-state-ctx') ?? null;
  return $state.raw(contextValue);
}

function createUpdatedState() {
  const updatedValue = createMockedStateValue('updated-state-ctx', false);

  return {
    get current() {
      return updatedValue.current;
    },
    check: async () => {
      const event = new CustomEvent('storybook:updated-check');
      window.dispatchEvent(event);
      return false;
    },
  };
}

export const page = createPageState();
export const navigating = createNavigatingState();
export const updated = createUpdatedState();

export function setPageState(value: any) {
  setContext('page-state-ctx', value);
}

export function setNavigatingState(value: any) {
  setContext('navigating-state-ctx', value);
}

export function setUpdatedState(value: boolean) {
  setContext('updated-state-ctx', value);
}

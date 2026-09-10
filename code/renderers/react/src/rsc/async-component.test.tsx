// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as React from 'react';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return {
    ...actual,
    // Stand-in for React 19's `use()`: return the settled value of a promise, throw it otherwise.
    use: vi.fn((promise: Promise<unknown> & { __value?: unknown; __settled?: boolean }) => {
      if (promise.__settled) {
        return promise.__value;
      }
      throw promise;
    }),
  };
});

const {
  clearAsyncComponentCache,
  getAsyncComponentPromise,
  isAsyncFunctionComponent,
  isStructurallyEqual,
  wrapAsyncComponent,
} = await import('./async-component.tsx');
const { render } = await import('../render.tsx');

// React 18 types (used in this repo) don't know about `use`, see the mock above.
const use = vi.mocked((React as unknown as { use: (promise: Promise<unknown>) => unknown }).use);

// Async components are not valid JSX element types for React 18 types.
const asComponent = <Props,>(component: (props: Props) => Promise<React.ReactNode>) =>
  component as unknown as React.FunctionComponent<Props>;

const settle = async <T,>(promise: Promise<T>) => {
  const value = await promise;
  Object.assign(promise, { __value: value, __settled: true });
  return value;
};

describe('isAsyncFunctionComponent', () => {
  it('detects async functions and arrows only', () => {
    expect(isAsyncFunctionComponent(async () => null)).toBe(true);
    expect(isAsyncFunctionComponent(async function Component() {})).toBe(true);
    expect(isAsyncFunctionComponent(() => null)).toBe(false);
    expect(isAsyncFunctionComponent(function Component() {})).toBe(false);
    expect(isAsyncFunctionComponent(class Component {})).toBe(false);
    expect(isAsyncFunctionComponent(React.memo(() => null))).toBe(false);
    expect(isAsyncFunctionComponent('div')).toBe(false);
    expect(isAsyncFunctionComponent(null)).toBe(false);
  });
});

describe('isStructurallyEqual', () => {
  const Component = (_props: { label?: string; children?: React.ReactNode }) => null;

  it('compares primitives, arrays, dates and plain objects by value', () => {
    expect(isStructurallyEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true);
    expect(isStructurallyEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(isStructurallyEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(isStructurallyEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(isStructurallyEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(isStructurallyEqual(new Date(0), new Date(0))).toBe(true);
    expect(isStructurallyEqual(new Date(0), new Date(1))).toBe(false);
    expect(isStructurallyEqual(NaN, NaN)).toBe(true);
  });

  it('compares functions by identity or source', () => {
    const fn = () => 1;
    expect(isStructurallyEqual(fn, fn)).toBe(true);
    expect(
      isStructurallyEqual(
        () => 1,
        () => 1
      )
    ).toBe(true);
    expect(
      isStructurallyEqual(
        () => 1,
        () => 2
      )
    ).toBe(false);
    expect(
      isStructurallyEqual(
        function a() {},
        function b() {}
      )
    ).toBe(false);
  });

  it('compares React elements by type, key and props', () => {
    expect(
      isStructurallyEqual(<Component>{'child'}</Component>, <Component>{'child'}</Component>)
    ).toBe(true);
    expect(isStructurallyEqual(<Component key="a" />, <Component key="b" />)).toBe(false);
    expect(isStructurallyEqual(<Component />, <div />)).toBe(false);
    expect(
      isStructurallyEqual(
        <div>
          <Component label="a" />
        </div>,
        <div>
          <Component label="b" />
        </div>
      )
    ).toBe(false);
  });

  it('compares promises and class instances by identity only', () => {
    const promise = Promise.resolve(1);
    expect(isStructurallyEqual({ promise }, { promise })).toBe(true);
    expect(isStructurallyEqual({ promise }, { promise: Promise.resolve(1) })).toBe(false);
    expect(isStructurallyEqual(new Map(), new Map())).toBe(false);
  });
});

describe('getAsyncComponentPromise', () => {
  beforeEach(() => {
    clearAsyncComponentCache();
  });

  it('runs the component once per distinct props and reuses the promise afterwards', () => {
    const component = vi.fn(async ({ label }: { label: string }) => <>{label}</>);

    const first = getAsyncComponentPromise(component, { label: 'a' });
    const second = getAsyncComponentPromise(component, { label: 'a' });
    const third = getAsyncComponentPromise(component, { label: 'b' });

    expect(first).toBe(second);
    expect(third).not.toBe(first);
    expect(component).toHaveBeenCalledTimes(2);
  });

  it('is cleared by clearAsyncComponentCache', () => {
    const component = vi.fn(async () => null);

    const first = getAsyncComponentPromise(component, {});
    clearAsyncComponentCache();
    const second = getAsyncComponentPromise(component, {});

    expect(second).not.toBe(first);
    expect(component).toHaveBeenCalledTimes(2);
  });

  it('keeps a rejected promise so that a failing component is not retried forever', async () => {
    const component = vi.fn(async () => {
      throw new Error('boom');
    });

    const first = getAsyncComponentPromise(component, {});
    await expect(first).rejects.toThrow('boom');
    expect(getAsyncComponentPromise(component, {})).toBe(first);
    expect(component).toHaveBeenCalledTimes(1);
  });
});

describe('wrapAsyncComponent', () => {
  beforeEach(() => {
    clearAsyncComponentCache();
  });

  afterEach(() => {
    use.mockClear();
  });

  it('returns non-async types untouched', () => {
    const Sync = () => null;
    class ClassComponent extends React.Component {}
    expect(wrapAsyncComponent(Sync)).toBe(Sync);
    expect(wrapAsyncComponent(ClassComponent)).toBe(ClassComponent);
    expect(wrapAsyncComponent('div')).toBe('div');
    expect(wrapAsyncComponent(React.Fragment)).toBe(React.Fragment);
  });

  it('returns a memoized sync wrapper carrying the original name', () => {
    const Async = asComponent(async function MyServerComponent() {
      return null;
    });
    const Wrapper = wrapAsyncComponent(Async);

    expect(Wrapper).not.toBe(Async);
    expect(isAsyncFunctionComponent(Wrapper)).toBe(false);
    expect((Wrapper as React.FunctionComponent).displayName).toBe('MyServerComponent');
    expect(wrapAsyncComponent(Async)).toBe(Wrapper);
  });

  it('suspends on the cached promise and returns its value once settled', async () => {
    let runs = 0;
    const Async = async ({ label }: { label: string }) => {
      runs += 1;
      return <span>{label}</span>;
    };
    const Wrapper = wrapAsyncComponent(asComponent(Async));

    let thrown: unknown;
    try {
      Wrapper({ label: 'a' });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Promise);

    // React retries the suspended tree from scratch, calling the wrapper with fresh props objects.
    // The very same promise must be handed to `use()` again, otherwise React never settles.
    await settle(thrown as Promise<unknown>);
    expect(Wrapper({ label: 'a' })).toEqual(<span>a</span>);
    expect(runs).toBe(1);
    expect(use.mock.calls.map(([promise]) => promise)).toEqual([thrown, thrown]);
  });
});

describe('default render', () => {
  const Async = asComponent(async (_props: { label: string }) => null);
  const context = (rsc: boolean) =>
    ({
      id: 'story',
      component: Async,
      parameters: { react: { rsc } },
    }) as unknown as Parameters<typeof render>[1];

  it('swaps an async story component for the cached wrapper when RSC is enabled', () => {
    expect(render({ label: 'a' }, context(true))).toMatchObject({
      type: wrapAsyncComponent(Async),
      props: { label: 'a' },
    });
  });

  it('renders the component as is otherwise', () => {
    expect(render({ label: 'a' }, context(false))).toMatchObject({
      type: Async,
      props: { label: 'a' },
    });
  });
});

import * as React from 'react';

/**
 * Storybook renders React Server Components (RSC) in the browser by wrapping the story in
 * `<Suspense>` and relying on React's (unsupported) handling of async client components.
 *
 * Since React 19 RC1 (Suspense sibling pre-warming), React commits the fallback right away and
 * re-runs the suspended component from scratch on every retry. An async component creates a brand
 * new Promise on every run, so React never observes a resolved promise and re-renders forever.
 *
 * @see https://github.com/storybookjs/storybook/issues/30317
 *
 * To make the render converge, async function components are replaced by a thin client component
 * that caches the Promise per component + props for the lifetime of a story render and reads it
 * with `React.use()`. Frameworks apply `wrapAsyncComponent` at the JSX runtime level (see
 * `@storybook/nextjs/rsc/jsx-runtime`), the renderer applies it to the story's `component` in the
 * default `render` function, which creates the element with `React.createElement`.
 */

type AnyProps = Record<string, unknown>;

type AsyncFunctionComponent<Props = never> = ((props: Props) => Promise<React.ReactNode>) & {
  displayName?: string;
};

type CacheEntry = { props: unknown; promise: Promise<React.ReactNode> };

const MAX_ENTRIES_PER_COMPONENT = 50;
const MAX_COMPARE_DEPTH = 50;

const REACT_ELEMENT_TYPES = new Set<symbol>([
  Symbol.for('react.transitional.element'),
  Symbol.for('react.element'),
]);

let promiseCache = new WeakMap<AsyncFunctionComponent, CacheEntry[]>();
const wrappers = new WeakMap<AsyncFunctionComponent, React.FunctionComponent<AnyProps>>();

export const isAsyncFunctionComponent = (type: unknown): type is AsyncFunctionComponent =>
  typeof type === 'function' && type.constructor?.name === 'AsyncFunction';

/** Forget every cached server component result. Called before each story render. */
export const clearAsyncComponentCache = (): void => {
  promiseCache = new WeakMap();
};

const isReactElement = (
  value: unknown
): value is { type: unknown; key: unknown; props: AnyProps } =>
  typeof value === 'object' &&
  value !== null &&
  REACT_ELEMENT_TYPES.has((value as { $$typeof?: symbol }).$$typeof as symbol);

const isPlainObject = (value: unknown): value is AnyProps => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * Structural equality for the props of a server component. Props coming from a re-executed parent
 * (story function, decorators, client components) are new objects on every render, but a server
 * component only needs to run again when their _values_ differ.
 */
export const isStructurallyEqual = (a: unknown, b: unknown, depth = 0): boolean => {
  if (Object.is(a, b)) {
    return true;
  }
  if (depth > MAX_COMPARE_DEPTH) {
    return false;
  }
  if (typeof a === 'function' && typeof b === 'function') {
    // Inline callbacks are recreated on every render, so identity would always miss the cache.
    // Compare by source, name and arity instead. Closures capturing different values stay
    // indistinguishable, which is acceptable: a real server component never receives functions
    // from a client component.
    return a.toString() === b.toString() && a.name === b.name && a.length === b.length;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, i) => isStructurallyEqual(item, b[i], depth + 1))
    );
  }
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (isReactElement(a) || isReactElement(b)) {
    return (
      isReactElement(a) &&
      isReactElement(b) &&
      a.type === b.type &&
      a.key === b.key &&
      isStructurallyEqual(a.props, b.props, depth + 1)
    );
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    return (
      keysA.length === keysB.length &&
      keysA.every((key) => Object.hasOwn(b, key) && isStructurallyEqual(a[key], b[key], depth + 1))
    );
  }
  // Promises, Maps, Sets, class instances, ...: identity only
  return false;
};

export const getAsyncComponentPromise = <Props,>(
  type: AsyncFunctionComponent<Props>,
  props: Props
): Promise<React.ReactNode> => {
  let entries = promiseCache.get(type);
  if (!entries) {
    entries = [];
    promiseCache.set(type, entries);
  }
  const cached = entries.find((entry) => isStructurallyEqual(entry.props, props));
  if (cached) {
    return cached.promise;
  }

  const promise = type(props);
  entries.push({ props, promise });
  if (entries.length > MAX_ENTRIES_PER_COMPONENT) {
    entries.shift();
  }
  return promise;
};

/**
 * Returns a sync client component standing in for an async (server) component. Anything that is
 * not an async function component is returned untouched, so this is safe to apply to every JSX
 * element type.
 */
export const wrapAsyncComponent = <T,>(type: T): T => {
  const use = (React as { use?: <V>(promise: Promise<V>) => V }).use;
  if (!isAsyncFunctionComponent(type) || typeof use !== 'function') {
    return type;
  }

  let wrapper = wrappers.get(type);
  if (!wrapper) {
    const AsyncComponent: React.FunctionComponent<AnyProps> = (props) =>
      use(getAsyncComponentPromise(type as AsyncFunctionComponent<AnyProps>, props));
    AsyncComponent.displayName = type.displayName ?? type.name ?? 'AsyncComponent';
    wrappers.set(type, AsyncComponent);
    wrapper = AsyncComponent;
  }
  return wrapper as unknown as T;
};

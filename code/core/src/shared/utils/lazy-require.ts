/**
 * Resolve a bundled dependency on first access instead of at import.
 *
 * Every command evaluates `storybook/internal/common` and `storybook/internal/babel`, but most
 * runs never parse a file or edit a lockfile, so the packages behind those paths (babel, recast,
 * yaml, the Yarn zip filesystem) would cost about 130 ms for nothing. The `require()` calls stay
 * static so the bundler still inlines the packages; only their evaluation moves.
 *
 * Vitest runs the source and services `require()` through its own loader, which reads through
 * `node:fs` — a test that mocks `node:fs` would then break the first lazy resolution. Tests get the
 * eager behaviour the dist had before, which is also what they were written against.
 */

const eager = process.env.VITEST === 'true';

export function lazyModule<T extends object>(load: () => T): T {
  if (eager) {
    return load();
  }
  let loaded: T | undefined;
  const get = () => (loaded ??= load());
  return new Proxy({} as T, {
    get: (_, key) => Reflect.get(get(), key),
    has: (_, key) => Reflect.has(get(), key),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(get(), key);
      // The proxy target owns nothing, so a reported property must be configurable.
      return descriptor && { ...descriptor, configurable: true };
    },
  });
}

export function lazyFunction<T extends (...args: never[]) => unknown>(load: () => T): T {
  if (eager) {
    return load();
  }
  let loaded: T | undefined;
  const get = () => (loaded ??= load());
  return new Proxy(function () {} as unknown as T, {
    apply: (_, thisArg, args) => Reflect.apply(get(), thisArg, args),
    construct: (_, args) =>
      Reflect.construct(get() as unknown as new (...args: unknown[]) => object, args),
    get: (_, key) => Reflect.get(get(), key),
  });
}

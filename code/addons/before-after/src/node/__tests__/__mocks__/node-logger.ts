// Minimal stub used by the addon-before-after test suite. The full storybook
// node-logger is only available after `yarn nx compile core`, which the unit
// tests intentionally do not depend on.
const noop = () => undefined;

export const logger = {
  trace: noop,
  debug: noop,
  info: noop,
  log: noop,
  warn: noop,
  error: noop,
};

export const colors = new Proxy(
  {},
  {
    get: () => (s: unknown) => String(s),
  }
) as Record<string, (s: string) => string>;

export const instance = logger;

export default logger;

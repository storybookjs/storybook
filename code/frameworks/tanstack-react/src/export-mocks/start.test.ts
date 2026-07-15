import { describe, expect, it } from 'vitest';

import { createServerFn } from './start.ts';

type MockCreateServerFnBuilder = {
  validator: (validator: (input: unknown) => unknown) => {
    handler: (handlerFn: () => Promise<string>) => () => Promise<string>;
  };
};

describe('createServerFn', () => {
  it('supports TanStack Start validator chain syntax', async () => {
    const serverFn = (createServerFn() as unknown as MockCreateServerFnBuilder)
      .validator((input: unknown) => input)
      .handler(async () => 'ok');

    await expect(serverFn()).resolves.toBe('ok');
  });

  it('keeps the handler implementation across mock resets', async () => {
    // storybook/test resets all mocks before every story. Implementations
    // installed with mockImplementation() are erased by a reset; only the
    // implementation passed at fn() creation survives. Server functions are
    // defined at module scope, so a reset must not turn them into
    // undefined-returning stubs.
    const serverFn = (createServerFn() as unknown as MockCreateServerFnBuilder)
      .validator((input: unknown) => input)
      .handler(async () => 'ok');

    (serverFn as unknown as { mockReset: () => void }).mockReset();

    await expect(serverFn()).resolves.toBe('ok');
  });
});

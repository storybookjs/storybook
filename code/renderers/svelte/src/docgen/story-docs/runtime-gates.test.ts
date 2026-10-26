import { afterEach, describe, expect, it, vi } from 'vitest';

import { emitCode } from '../../svelte-csf/runtime/emit-code.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('server snippet runtime gates', () => {
  it('does not read runtime story args when server docgen is on', () => {
    vi.stubGlobal('FEATURES', { docgenServer: true });
    const input: Parameters<typeof emitCode>[0] = {
      get args(): never {
        throw new Error('runtime args accessed');
      },
      get storyContext(): never {
        throw new Error('runtime context accessed');
      },
    };
    expect(() => emitCode(input)).not.toThrow();
  });

  it.each([true, false])('uses runtime decorators only when server mode is %s', async (enabled) => {
    vi.stubGlobal('FEATURES', { docgenServer: enabled });
    const { decorators } = await import('../../entry-preview-docs.ts');
    expect(decorators).toHaveLength(enabled ? 0 : 1);
  });
});

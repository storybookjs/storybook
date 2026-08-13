import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/client-logger';

vi.mock('storybook/internal/client-logger', () => ({
  logger: { warn: vi.fn() },
}));

const importFresh = async (features: Record<string, boolean> | undefined) => {
  vi.stubGlobal('FEATURES', features);
  vi.resetModules();
  return import('./index.ts');
};

beforeEach(() => {
  vi.stubGlobal('__STORYBOOK_COMPODOC_JSON__', undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.mocked(logger.warn).mockClear();
});

describe('setCompodocJson', () => {
  it.each([
    ['the feature is off', { experimentalDocgenServer: false }],
    ['no features are set', undefined],
  ])('parks the Compodoc JSON on the global when %s', async (_name, features) => {
    const { setCompodocJson } = await importFresh(features);
    const json = { components: [] };

    setCompodocJson(json);

    expect((globalThis as any).__STORYBOOK_COMPODOC_JSON__).toBe(json);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('ignores the Compodoc JSON when the docgen server is on', async () => {
    const { setCompodocJson } = await importFresh({ experimentalDocgenServer: true });

    setCompodocJson({ components: [] });

    expect((globalThis as any).__STORYBOOK_COMPODOC_JSON__).toBeUndefined();
  });

  it('warns once however often it is called', async () => {
    const { setCompodocJson } = await importFresh({ experimentalDocgenServer: true });

    setCompodocJson({ components: [] });
    setCompodocJson({ components: [] });

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logger.warn).mock.calls[0][0]).toMatch(/experimentalDocgenServer/);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPreviewAnnotations } from './create-preview-annotations';

const mockOptions = (docsPreset: Record<string, unknown> = {}) =>
  ({
    presets: {
      apply: vi.fn().mockResolvedValue(docsPreset),
    },
  }) as any;

describe('createPreviewAnnotations', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('includes entry-preview', async () => {
    const fn = createPreviewAnnotations('@storybook/html');
    const result = await fn([], mockOptions());
    expect(result?.some((p: string) => p.includes('entry-preview'))).toBe(true);
  });

  it('does NOT include entry-preview-docs when docs is disabled', async () => {
    const fn = createPreviewAnnotations('@storybook/html');
    const result = await fn([], mockOptions({}));
    expect(result?.some((p: string) => p.includes('entry-preview-docs'))).toBe(false);
  });

  it('includes entry-preview-docs when docs is enabled', async () => {
    const fn = createPreviewAnnotations('@storybook/html');
    const result = await fn([], mockOptions({ someDocsConfig: true }));
    expect(result?.some((p: string) => p.includes('entry-preview-docs'))).toBe(true);
  });

  it('preserves user input at the start', async () => {
    const fn = createPreviewAnnotations('@storybook/html');
    const result = await fn(['/user/custom.js'], mockOptions());
    expect(result?.[0]).toBe('/user/custom.js');
  });

  it('includes extraEntries before entry-preview', async () => {
    const fn = createPreviewAnnotations('@storybook/web-components', [
      '@storybook/web-components/entry-preview-argtypes',
    ]);
    const result = await fn([], mockOptions());
    const argtypesIdx =
      result?.findIndex((p: string) => p.includes('entry-preview-argtypes')) ?? -1;
    const previewIdx =
      result?.findIndex(
        (p: string) => p.includes('entry-preview') && !p.includes('argtypes') && !p.includes('docs')
      ) ?? -1;
    expect(argtypesIdx).toBeGreaterThan(-1);
    expect(previewIdx).toBeGreaterThan(-1);
    expect(argtypesIdx).toBeLessThan(previewIdx);
  });
});

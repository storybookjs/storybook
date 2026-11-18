import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isTypeScriptReadyForDocgen } from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import { isDocgenProviderEnabled } from './preset.ts';

vi.mock('storybook/internal/common', { spy: true });

const optionsWith = (frameworkOptions: Record<string, unknown>) =>
  ({
    configDir: '/project/.storybook',
    presets: { apply: async () => frameworkOptions },
  }) as unknown as Options;

describe('isDocgenProviderEnabled', () => {
  beforeEach(() => {
    vi.mocked(isTypeScriptReadyForDocgen).mockResolvedValue(false);
  });

  it('turns docgen on with a Custom Elements Manifest, without a usable typescript', async () => {
    await expect(
      isDocgenProviderEnabled(
        undefined,
        optionsWith({ customElementsManifest: 'custom-elements.json' })
      )
    ).resolves.toBe(true);
  });

  it('keeps builder docgen without a manifest and without a usable typescript', async () => {
    await expect(
      isDocgenProviderEnabled(undefined, optionsWith({ customElementsManifest: [] }))
    ).resolves.toBe(false);
  });
});

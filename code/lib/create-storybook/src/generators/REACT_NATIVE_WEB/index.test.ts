import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SupportedLanguage } from 'storybook/internal/types';

import reactNativeWebGenerator from './index.ts';
import { rewriteExpoTsconfigFile } from './expoTsconfig.ts';

vi.mock('./expoTsconfig.ts', { spy: true });

describe('REACT_NATIVE_WEB generator', () => {
  beforeEach(() => {
    vi.mocked(rewriteExpoTsconfigFile).mockResolvedValue(undefined);
  });

  it('rewrites an extensionless Expo tsconfig during init', async () => {
    await reactNativeWebGenerator.configure(
      {} as any,
      {
        language: SupportedLanguage.TYPESCRIPT,
      } as any
    );

    expect(rewriteExpoTsconfigFile).toHaveBeenCalledWith(process.cwd());
  });
});

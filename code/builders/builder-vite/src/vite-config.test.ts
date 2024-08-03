import { describe, it, expect, vi } from 'vitest';
import type { Options, Presets } from 'storybook/internal/types';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { loadConfigFromFile } from 'vite';
import { commonConfig } from './vite-config';

vi.mock('vite', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vite')>()),
  loadConfigFromFile: vi.fn(async () => ({})),
}));
const loadConfigFromFileMock = vi.mocked(loadConfigFromFile);

const dummyOptions: Options = {
  configType: 'DEVELOPMENT',
  configDir: '',
  packageJson: {},
  presets: {
    apply: async (key: string) =>
      ({
        framework: {
          name: '',
        },
        addons: [],
        core: {
          builder: {},
        },
        options: {},
      })[key],
  } as Presets,
  presetsList: [],
};

describe('commonConfig', () => {
  it('should preserve default envPrefix', async () => {
    loadConfigFromFileMock.mockReturnValueOnce(
      Promise.resolve({
        config: {},
        path: '',
        dependencies: [],
      })
    );
    const config = await commonConfig(dummyOptions, 'development');
    expect(config.envPrefix).toStrictEqual(['VITE_', 'STORYBOOK_']);
  });

  it('should preserve custom envPrefix string', async () => {
    loadConfigFromFileMock.mockReturnValueOnce(
      Promise.resolve({
        config: { envPrefix: 'SECRET_' },
        path: '',
        dependencies: [],
      })
    );
    const config = await commonConfig(dummyOptions, 'development');
    expect(config.envPrefix).toStrictEqual(['SECRET_', 'STORYBOOK_']);
  });

  it('should preserve custom envPrefix array', async () => {
    loadConfigFromFileMock.mockReturnValueOnce(
      Promise.resolve({
        config: { envPrefix: ['SECRET_', 'VUE_'] },
        path: '',
        dependencies: [],
      })
    );
    const config = await commonConfig(dummyOptions, 'development');
    expect(config.envPrefix).toStrictEqual(['SECRET_', 'VUE_', 'STORYBOOK_']);
  });
});

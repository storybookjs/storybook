import * as fsp from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAddonNames } from 'storybook/internal/common';

import { existsSync } from 'fs';
import { vol } from 'memfs';
import path from 'path';
import { dedent } from 'ts-dedent';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { addonA11yAddonTest, transformPreviewFile } from './addon-a11y-addon-test.ts';

vi.mock('node:fs/promises', { spy: true });

vi.mock('storybook/internal/common', async (importOriginal) => {
  const mod = (await importOriginal()) as any;
  return {
    ...mod,
    getAddonNames: vi.fn(),
  };
});

vi.mock('fs', async (importOriginal) => {
  const mod = (await importOriginal()) as any;
  return {
    ...mod,
    existsSync: vi.fn(),
  };
});

vi.mock('picocolors', async (importOriginal) => {
  const mod = (await importOriginal()) as any;
  return {
    ...mod,
    default: {
      gray: (s: string) => s,
      green: (s: string) => s,
      cyan: (s: string) => s,
      magenta: (s: string) => s,
      yellow: (s: string) => s,
    },
  };
});

describe('addonA11yAddonTest', () => {
  const configDir = '/path/to/config';
  const previewFile = path.join(configDir, 'preview.js');
  const mainConfig = {} as any;

  const check = (options: { mainConfig: any; configDir: string }) =>
    checkFix(addonA11yAddonTest, {
      packageManager: {} as any,
      storybookVersion: '11.0.0',
      storiesPaths: [],
      hasCsfFactoryPreview: false,
      ...options,
    });

  const run = (result: { previewFile: string | null; canTransformPreview: boolean }) =>
    runFix(addonA11yAddonTest, {
      packageManager: {} as any,
      result,
      mainConfigPath: path.join(configDir, 'main.js'),
      mainConfig,
      configDir,
      storybookVersion: '11.0.0',
      storiesPaths: [],
    });

  beforeEach(() => {
    vol.reset();
    vi.mocked(fsp.readFile).mockImplementation(vol.promises.readFile as typeof fsp.readFile);
    vi.mocked(fsp.writeFile).mockImplementation(vol.promises.writeFile as typeof fsp.writeFile);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('check', () => {
    it('should return null if a11y addon is not present', async () => {
      vi.mocked(getAddonNames).mockReturnValue([]);
      const result = await check({ mainConfig, configDir });
      expect(result).toBeNull();
    });

    it('should return null if test addon is not present', async () => {
      vi.mocked(getAddonNames).mockReturnValue(['@storybook/addon-a11y']);
      const result = await check({ mainConfig, configDir });
      expect(result).toBeNull();
    });

    it('should return null if configDir is not provided', async () => {
      const result = await check({ mainConfig, configDir: '' });
      expect(result).toBeNull();
    });

    it('should return null if provided framework is not supported', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
      const result = await check({
        mainConfig: {
          framework: '@storybook/angular',
        },
        configDir: '',
      });
      expect(result).toBeNull();
    });

    it('should return null if preview file has the necessary transformations', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
      vi.mocked(existsSync).mockReturnValue(true);
      vol.fromJSON({
        [previewFile]: `
        export default {
          parameters: {
            a11y: {
              test: 'todo'
            }
          }
        }
      `,
      });

      const result = await check({
        mainConfig: {
          framework: '@storybook/react-vite',
        },
        configDir,
      });
      expect(result).toBeNull();
    });

    it('should return a transformable previewFile if preview file exists', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
      vi.mocked(existsSync).mockReturnValue(true);
      vol.fromJSON({ [previewFile]: 'export default {}' });

      const result = await check({
        mainConfig: {
          framework: '@storybook/react-vite',
        },
        configDir,
      });
      expect(result).toEqual({ previewFile, canTransformPreview: true });
      expect(vol.readFileSync(previewFile, 'utf8')).toBe('export default {}');
    });

    it('should return no previewFile if there is no preview file', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await check({
        mainConfig: {
          framework: '@storybook/react-vite',
        },
        configDir,
      });
      expect(result).toEqual({ previewFile: null, canTransformPreview: false });
    });

    it('should return a non-transformable previewFile if reading it fails', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fsp.readFile).mockRejectedValue(new Error('Test error'));

      const result = await check({
        mainConfig: {
          framework: '@storybook/sveltekit',
        },
        configDir,
      });
      expect(result).toEqual({ previewFile, canTransformPreview: false });
    });
  });

  describe('run', () => {
    it('should write the transformed preview file', async () => {
      vol.fromJSON({ [previewFile]: 'export default {};' });

      await run({ previewFile, canTransformPreview: true });

      expect(vol.readFileSync(previewFile, 'utf8')).toMatchInlineSnapshot(`
        "export default {
          parameters: {
            a11y: {
              // 'todo' - show a11y violations in the test UI only
              // 'error' - fail CI on a11y violations
              // 'off' - skip a11y checks entirely
              test: "todo"
            }
          }
        };"
      `);
    });

    it('should throw with instructions when the preview file cannot be transformed', async () => {
      vol.fromJSON({ [previewFile]: 'export default {};' });

      await expect(run({ previewFile, canTransformPreview: false })).rejects
        .toMatchInlineSnapshot(`[Error: The addon-a11y-addon-test automigration couldn't make the changes but here are instructions for doing them yourself:
We couldn't find or automatically update your .storybook/preview.<ts|js> in your project to smoothly set up parameters.a11y.test from @storybook/addon-a11y. Please manually update your .storybook/preview.<ts|js> file to include the following:

export default {
  ...
  parameters: {
+   a11y: {
+      test: "todo"
+   }
  }
}]`);

      expect(vol.readFileSync(previewFile, 'utf8')).toBe('export default {};');
    });
  });

  describe('transformPreviewFile', () => {
    it('should add a new parameter property if it does not exist', async () => {
      const source = dedent`
        import type { Preview } from '@storybook/react';

        const preview: Preview = {};

        export default preview;
      `;

      const transformed = await transformPreviewFile(source, process.cwd());

      expect(transformed).toMatchInlineSnapshot(`
        "import type { Preview } from '@storybook/react';

        const preview: Preview = {
          parameters: {
            a11y: {
              // 'todo' - show a11y violations in the test UI only
              // 'error' - fail CI on a11y violations
              // 'off' - skip a11y checks entirely
              test: 'todo'
            }
          }
        };

        export default preview;"
      `);
    });

    it('should add a new parameter property if it does not exist and a default export does not exist', async () => {
      const source = dedent``;

      const transformed = await transformPreviewFile(source, process.cwd());

      expect(transformed).toMatchInlineSnapshot(`
        "export const parameters = {
          a11y: {
            // 'todo' - show a11y violations in the test UI only
            // 'error' - fail CI on a11y violations
            // 'off' - skip a11y checks entirely
            test: "todo"
          }
        };"
        `);
    });

    it('should extend the existing parameters property', async () => {
      const source = dedent`
        export const parameters = {
          controls: {
            matchers: {
              color: /(background|color)$/i,
              date: /Date$/i,
            },
          },
        }
      `;

      const transformed = await transformPreviewFile(source, process.cwd());

      expect(transformed).toMatchInlineSnapshot(`
        "export const parameters = {
          controls: {
            matchers: {
              color: /(background|color)$/i,
              date: /Date$/i,
            },
          },

          a11y: {
            // 'todo' - show a11y violations in the test UI only
            // 'error' - fail CI on a11y violations
            // 'off' - skip a11y checks entirely
            test: "todo"
          }
        }"
        `);
    });

    it('should not add the test parameter if it already exists', async () => {
      const source = dedent`
        import type { Preview } from "@storybook/react";

        const preview: Preview = {
          parameters: {
            a11y: {
              test: "off"
            }
          },
        };

        export default preview;
      `;

      const transformed = await transformPreviewFile(source, process.cwd());

      expect(transformed).toMatchInlineSnapshot(`
        "import type { Preview } from "@storybook/react";

        const preview: Preview = {
          parameters: {
            a11y: {
              test: "off"
            }
          },
        };

        export default preview;"
      `);
    });

    it('should handle the default export without type annotations', async () => {
      const source = dedent`
        export default {};
      `;

      const transformed = await transformPreviewFile(source, process.cwd());

      expect(transformed).toMatchInlineSnapshot(`
        "export default {
          parameters: {
            a11y: {
              // 'todo' - show a11y violations in the test UI only
              // 'error' - fail CI on a11y violations
              // 'off' - skip a11y checks entirely
              test: "todo"
            }
          }
        };"
      `);
    });

    it('should handle const parameters with preview object', async () => {
      const source = dedent`
        const parameters = {};
        const preview = {
          parameters,
        };
        export default preview;
      `;

      const transformed = await transformPreviewFile(source, process.cwd());

      expect(transformed).toMatchInlineSnapshot(`
        "const parameters = {
          a11y: {
            // 'todo' - show a11y violations in the test UI only
            // 'error' - fail CI on a11y violations
            // 'off' - skip a11y checks entirely
            test: "todo"
          }
        };
        const preview = {
          parameters,
        };
        export default preview;"
      `);
    });
  });
});

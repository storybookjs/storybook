import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAddonNames } from 'storybook/internal/common';

import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { dedent } from 'ts-dedent';

import { addonA11yAddonTest, transformPreviewFile } from './addon-a11y-addon-test.ts';

vi.mock('storybook/internal/common', async (importOriginal) => {
  const mod = (await importOriginal()) as any;
  return {
    ...mod,
    getAddonNames: vi.fn(),
  };
});

// mock fs.existsSync
vi.mock('fs', async (importOriginal) => {
  const mod = (await importOriginal()) as any;
  return {
    ...mod,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
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
  const mainConfig = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('check', () => {
    it('should return null if a11y addon is not present', async () => {
      vi.mocked(getAddonNames).mockReturnValue([]);
      const result = await addonA11yAddonTest.check({ mainConfig, configDir } as any);
      expect(result).toBeNull();
    });

    it('should return null if test addon is not present', async () => {
      vi.mocked(getAddonNames).mockReturnValue(['@storybook/addon-a11y']);
      const result = await addonA11yAddonTest.check({ mainConfig, configDir } as any);
      expect(result).toBeNull();
    });

    it('should return null if configDir is not provided', async () => {
      const result = await addonA11yAddonTest.check({ mainConfig, configDir: '' } as any);
      expect(result).toBeNull();
    });

    it('should return null if provided framework is not supported', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
      const result = await addonA11yAddonTest.check({
        mainConfig: {
          framework: '@storybook/angular',
        },
        configDir: '',
      } as any);
      expect(result).toBeNull();
    });

    it('should return null if preview file has the necessary transformations', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(`
        export default {
          parameters: {
            a11y: {
              test: 'todo'
            }
          }
        }
      `);

      const result = await addonA11yAddonTest.check({
        mainConfig: {
          framework: '@storybook/react-vite',
        },
        configDir,
      } as any);
      expect(result).toBeNull();
    });

    it('should return previewFile and transformedPreviewCode if preview file exists', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('export default {}');

      const result = await addonA11yAddonTest.check({
        mainConfig: {
          framework: '@storybook/react-vite',
        },
        configDir,
      } as any);
      expect(result).toEqual({
        previewFile: path.join(configDir, 'preview.js'),
        transformedPreviewCode: expect.any(String),
      });
    });

    it('should return null transformedPreviewCode if there is no preview file', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
      vi.mocked(existsSync).mockReturnValue(false);

      const result = await addonA11yAddonTest.check({
        mainConfig: {
          framework: '@storybook/react-vite',
        },
        configDir,
      } as any);
      expect(result).toEqual({ previewFile: null, transformedPreviewCode: null });
    });

    it('should return previewFile and null transformedPreviewCode if transformation fails', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Test error');
      });

      const result = await addonA11yAddonTest.check({
        mainConfig: {
          framework: '@storybook/sveltekit',
        },
        configDir,
      } as any);
      expect(result).toEqual({
        previewFile: path.join(configDir, 'preview.js'),
        transformedPreviewCode: null,
      });
    });
  });

  describe('run', () => {
    it('should write transformed preview code to file', async () => {
      const previewFile = '/path/to/preview.ts';
      const transformedPreviewCode = 'transformed code';

      await addonA11yAddonTest.run?.({
        result: { previewFile, transformedPreviewCode },
      } as any);

      expect(writeFileSync).toHaveBeenCalledWith(previewFile, transformedPreviewCode, 'utf8');
    });

    it('should throw with instructions when transformedPreviewCode is null', async () => {
      await expect(
        addonA11yAddonTest.run?.({
          result: { previewFile: 'preview.js', transformedPreviewCode: null },
        } as any)
      ).rejects
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

      expect(writeFileSync).not.toHaveBeenCalled();
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

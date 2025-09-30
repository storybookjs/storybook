import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAddonNames } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { dedent } from 'ts-dedent';

import {
  addonA11yAddonTest,
  transformPreviewFile,
  transformSetupFile,
} from './addon-a11y-addon-test';

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

const loggerMock = vi.mocked(logger);

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

    it('should return null if vitest.setup file and preview file have the necessary transformations', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((p) => {
        if (p.toString().includes('vitest.setup')) {
          return `
            import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";
            import { setProjectAnnotations } from 'storybook';
            import * as projectAnnotations from './preview';

            setProjectAnnotations([a11yAddonAnnotations, projectAnnotations]);
          `;
        } else {
          return `
            export default {
              parameters: {
                a11y: {
                  test: 'todo'
                }
              }
            }
          `;
        }
      });

      const result = await addonA11yAddonTest.check({
        mainConfig: {
          framework: '@storybook/react-vite',
        },
        configDir,
      } as any);
      expect(result).toBeNull();
    });

    it('should return setupFile and transformedSetupCode if vitest.setup file exists', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
      vi.mocked(existsSync).mockImplementation((p) => {
        if (p.toString().includes('vitest.setup')) {
          return true;
        } else {
          return false;
        }
      });
      vi.mocked(readFileSync).mockImplementation((p) => {
        if (p.toString().includes('vitest.setup')) {
          return 'const annotations = setProjectAnnotations([]);';
        } else {
          return '';
        }
      });

      const result = await addonA11yAddonTest.check({
        mainConfig: {
          framework: '@storybook/react-vite',
        },
        configDir,
      } as any);
      expect(result).toEqual({
        setupFile: path.join(configDir, 'vitest.setup.js'),
        previewFile: null,
        transformedPreviewCode: null,
        transformedSetupCode: expect.any(String),
        skipPreviewTransformation: false,
        skipVitestSetupTransformation: false,
      });
    });

    it.skip('should return previewFile and transformedPreviewCode if preview file exists', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
      vi.mocked(existsSync).mockImplementation((p) => {
        if (p.toString().includes('preview')) {
          return true;
        } else {
          return false;
        }
      });
      vi.mocked(readFileSync).mockImplementation((p) => {
        if (p.toString().includes('preview')) {
          return 'export default {}';
        } else {
          return '';
        }
      });

      const result = await addonA11yAddonTest.check({
        mainConfig: {
          framework: '@storybook/react-vite',
        },
        configDir,
      } as any);
      expect(result).toEqual({
        setupFile: null,
        previewFile: path.join(configDir, 'preview.js'),
        transformedPreviewCode: expect.any(String),
        transformedSetupCode: null,
        skipPreviewTransformation: false,
        skipVitestSetupTransformation: false,
      });
    });

    it('should return setupFile and null transformedSetupCode if transformation fails', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
      vi.mocked(existsSync).mockImplementation((p) => {
        if (p.toString().includes('vitest.setup')) {
          return true;
        } else {
          return false;
        }
      });
      vi.mocked(readFileSync).mockImplementation((p) => {
        if (p.toString().includes('vitest.setup')) {
          throw new Error('Test error');
        } else {
          return '';
        }
      });

      const result = await addonA11yAddonTest.check({
        mainConfig: {
          framework: '@storybook/sveltekit',
        },
        configDir,
      } as any);
      expect(result).toEqual({
        setupFile: path.join(configDir, 'vitest.setup.js'),
        previewFile: null,
        transformedPreviewCode: null,
        transformedSetupCode: null,
        skipPreviewTransformation: false,
        skipVitestSetupTransformation: false,
      });
    });

    it('should return previewFile and null transformedPreviewCode if transformation fails', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
      vi.mocked(existsSync).mockImplementation((p) => {
        if (p.toString().includes('preview')) {
          return true;
        } else {
          return false;
        }
      });
      vi.mocked(readFileSync).mockImplementation((p) => {
        if (p.toString().includes('preview')) {
          throw new Error('Test error');
        } else {
          return '';
        }
      });

      const result = await addonA11yAddonTest.check({
        mainConfig: {
          framework: '@storybook/sveltekit',
        },
        configDir,
      } as any);
      expect(result).toEqual({
        setupFile: null,
        previewFile: path.join(configDir, 'preview.js'),
        transformedPreviewCode: null,
        transformedSetupCode: null,
        skipPreviewTransformation: false,
        skipVitestSetupTransformation: false,
      });
    });

    it('should return skipPreviewTransformation=true if preview file has the necessary change', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((p) => {
        if (p.toString().includes('vitest.setup')) {
          return `
            import { setProjectAnnotations } from 'storybook';
            import * as projectAnnotations from './preview';

            setProjectAnnotations([projectAnnotations]);
          `;
        } else {
          return `
            export default {
              parameters: {
                a11y: {
                  test: 'todo'
                }
              }
            }
          `;
        }
      });

      const result = await addonA11yAddonTest.check({
        mainConfig: {
          framework: '@storybook/sveltekit',
        },
        configDir,
      } as any);
      expect(result).toEqual({
        setupFile: path.join(configDir, 'vitest.setup.js'),
        previewFile: path.join(configDir, 'preview.js'),
        transformedPreviewCode: null,
        transformedSetupCode: expect.any(String),
        skipPreviewTransformation: true,
        skipVitestSetupTransformation: false,
      });
    });

    it('should return skipVitestSetupTransformation=true if setup file has the necessary change', async () => {
      vi.mocked(getAddonNames).mockReturnValue([
        '@storybook/addon-a11y',
        '@storybook/addon-vitest',
      ]);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockImplementation((p) => {
        if (p.toString().includes('vitest.setup')) {
          return `
            import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";
            import { setProjectAnnotations } from 'storybook';
            import * as projectAnnotations from './preview';

            setProjectAnnotations([a11yAddonAnnotations, projectAnnotations]);
          `;
        } else {
          return `
            export default {
              tags: [],
            }
          `;
        }
      });

      const result = await addonA11yAddonTest.check({
        mainConfig: {
          framework: '@storybook/sveltekit',
        },
        configDir,
      } as any);
      expect(result).toEqual({
        setupFile: path.join(configDir, 'vitest.setup.js'),
        previewFile: path.join(configDir, 'preview.js'),
        transformedPreviewCode: expect.any(String),
        transformedSetupCode: null,
        skipPreviewTransformation: false,
        skipVitestSetupTransformation: true,
      });
    });
  });

  describe('run', () => {
    it('should write transformed setup code to file', async () => {
      const setupFile = '/path/to/vitest.setup.ts';
      const transformedSetupCode = 'transformed code';

      await addonA11yAddonTest.run?.({
        result: {
          setupFile,
          transformedSetupCode,
          previewFile: null,
          transformedPreviewCode: null,
          skipVitestSetupTransformation: false,
          skipPreviewTransformation: true,
        },
      } as any);

      expect(writeFileSync).toHaveBeenCalledWith(setupFile, transformedSetupCode, 'utf8');
    });

    it('should write transformed preview code to file', async () => {
      const previewFile = '/path/to/preview.ts';
      const transformedPreviewCode = 'transformed code';

      await addonA11yAddonTest.run?.({
        result: {
          setupFile: null,
          transformedSetupCode: null,
          previewFile: previewFile,
          transformedPreviewCode: transformedPreviewCode,
          skipVitestSetupTransformation: true,
          skipPreviewTransformation: false,
        },
      } as any);

      expect(writeFileSync).toHaveBeenCalledWith(previewFile, transformedPreviewCode, 'utf8');
    });

    it('should not write to file if setupFile or transformedSetupCode is null', async () => {
      await addonA11yAddonTest.run?.({
        result: {
          setupFile: null,
          transformedSetupCode: null,
          previewFile: null,
          transformedPreviewCode: null,
          skipVitestSetupTransformation: true,
          skipPreviewTransformation: true,
        },
      } as any);

      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('should throw with instructions when skipVitestSetupTransformation is false and transformedSetupCode is null', async () => {
      await expect(
        addonA11yAddonTest.run?.({
          result: {
            setupFile: 'vitest.setup.ts',
            transformedSetupCode: null,
            previewFile: null,
            transformedPreviewCode: null,
            skipPreviewTransformation: true,
            skipVitestSetupTransformation: false,
          },
        } as any)
      ).rejects.toMatchInlineSnapshot(
        `[Error: The addon-a11y-addon-test automigration couldn't make the changes but here are instructions for doing them yourself:
1) We couldn't find or automatically update .storybook/vitest.setup.<ts|js> in your project to smoothly set up project annotations from @storybook/addon-a11y. 
Please manually update your vitest.setup.ts file to include the following:

...   
+ import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";

setProjectAnnotations([
  ...
+ a11yAddonAnnotations,
]);]`
      );
    });

    it('should throw with instructions when skipPreviewTransformation is false and transformedPreviewCode is null', async () => {
      await expect(
        addonA11yAddonTest.run?.({
          result: {
            setupFile: null,
            transformedSetupCode: null,
            previewFile: 'preview.js',
            transformedPreviewCode: null,
            skipPreviewTransformation: false,
            skipVitestSetupTransformation: true,
          },
        } as any)
      ).rejects
        .toMatchInlineSnapshot(`[Error: The addon-a11y-addon-test automigration couldn't make the changes but here are instructions for doing them yourself:
1) We couldn't find or automatically update your .storybook/preview.<ts|js> in your project to smoothly set up parameters.a11y.test from @storybook/addon-a11y. Please manually update your .storybook/preview.<ts|js> file to include the following:

export default {
  ...
  parameters: {
+   a11y: {
+      test: "todo"
+   }
  }
}]`);
    });

    it('should throw with full instructions when skipPreviewTransformation is false and both transformedSetupCode and transformedPreviewCode are null', async () => {
      await expect(
        addonA11yAddonTest.run?.({
          result: {
            setupFile: 'vitest.setup.ts',
            transformedSetupCode: null,
            previewFile: 'preview.js',
            transformedPreviewCode: null,
            skipPreviewTransformation: false,
            skipVitestSetupTransformation: false,
          },
        } as any)
      ).rejects
        .toMatchInlineSnapshot(`[Error: The addon-a11y-addon-test automigration couldn't make the changes but here are instructions for doing them yourself:
1) We couldn't find or automatically update .storybook/vitest.setup.<ts|js> in your project to smoothly set up project annotations from @storybook/addon-a11y. 
Please manually update your vitest.setup.ts file to include the following:

...   
+ import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";

setProjectAnnotations([
  ...
+ a11yAddonAnnotations,
]);
2) We couldn't find or automatically update your .storybook/preview.<ts|js> in your project to smoothly set up parameters.a11y.test from @storybook/addon-a11y. Please manually update your .storybook/preview.<ts|js> file to include the following:

export default {
  ...
  parameters: {
+   a11y: {
+      test: "todo"
+   }
  }
}]`);
    });
  });

  describe('transformSetupFile', async () => {
    it('should throw', async () => {
      const setupFile = '/path/to/vitest.setup.ts';
      const source = dedent`
        import { setProjectAnnotations } from 'storybook';
      `;

      vi.mocked(readFileSync).mockReturnValue(source);

      expect(() => transformSetupFile(setupFile)).toThrow();
    });

    it('should transform setup file correctly - 1', () => {
      const setupFile = '/path/to/vitest.setup.ts';
      const source = dedent`
        import { setProjectAnnotations } from 'storybook';
        import * as projectAnnotations from './preview';

        setProjectAnnotations([projectAnnotations]);
      `;
      vi.mocked(readFileSync).mockReturnValue(source);

      const s = readFileSync(setupFile, 'utf8');
      const transformedCode = transformSetupFile(s);
      expect(transformedCode).toMatchInlineSnapshot(`
        "import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";
        import { setProjectAnnotations } from 'storybook';
        import * as projectAnnotations from './preview';

        setProjectAnnotations([a11yAddonAnnotations, projectAnnotations]);"
      `);
    });

    it('should transform setup file correctly - 2 (different format)', () => {
      const setupFile = '/path/to/vitest.setup.ts';
      const source = dedent`
        import { setProjectAnnotations } from 'storybook';
        import * as projectAnnotations from './preview';

        setProjectAnnotations([
          projectAnnotations
        ]);
      `;
      vi.mocked(readFileSync).mockReturnValue(source);

      const s = readFileSync(setupFile, 'utf8');
      const transformedCode = transformSetupFile(s);
      expect(transformedCode).toMatchInlineSnapshot(`
        "import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";
        import { setProjectAnnotations } from 'storybook';
        import * as projectAnnotations from './preview';

        setProjectAnnotations([a11yAddonAnnotations, projectAnnotations]);"
      `);
    });

    it('should transform setup file correctly - project annotation is not an array', () => {
      const setupFile = '/path/to/vitest.setup.ts';
      const source = dedent`
        import { setProjectAnnotations } from 'storybook';
        import * as projectAnnotations from './preview';

        setProjectAnnotations(projectAnnotations);
      `;
      vi.mocked(readFileSync).mockReturnValue(source);

      const s = readFileSync(setupFile, 'utf8');
      const transformedCode = transformSetupFile(s);
      expect(transformedCode).toMatchInlineSnapshot(dedent`
        "import * as a11yAddonAnnotations from "@storybook/addon-a11y/preview";
        import { setProjectAnnotations } from 'storybook';
        import * as projectAnnotations from './preview';

        setProjectAnnotations([a11yAddonAnnotations, projectAnnotations]);"
      `);
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

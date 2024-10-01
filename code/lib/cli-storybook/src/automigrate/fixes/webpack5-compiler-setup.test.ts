import { describe, expect, it, vi } from 'vitest';

import { CoreWebpackCompilers } from 'storybook/internal/cli';
import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfig } from 'storybook/internal/types';

import { webpack5CompilerSetup } from './webpack5-compiler-setup';

const check = async ({
  packageManager,
  mainConfig,
  storybookVersion = '8.0.0',
}: {
  packageManager?: Partial<JsPackageManager>;
  main?: Partial<StorybookConfig> & Record<string, unknown>;
  storybookVersion?: string;
  mainConfig?: Partial<StorybookConfig>;
}) => {
  return webpack5CompilerSetup.check({
    packageManager: packageManager as any,
    configDir: '',
    storybookVersion,
    mainConfig: mainConfig as any,
  });
};

const promptMocks = vi.hoisted(() => {
  return {
    default: vi.fn(),
  };
});

vi.mock('prompts', () => {
  return {
    default: promptMocks.default,
  };
});

// mock picocolors yellow and cyan
vi.mock('picocolors', () => {
  return {
    default: {
      yellow: (str: string) => str,
      cyan: (str: string) => str,
    },
  };
});

describe('webpack5Migration check function', () => {
  describe('return null', async () => {
    it('should return null if one of the addons is already installed', async () => {
      const result = check({
        packageManager: {
          getPackageVersion: (name) => {
            return Promise.resolve(null);
          },
        },
        mainConfig: {
          addons: ['@storybook/addon-webpack5-compiler-swc'],
          framework: {
            name: '@storybook/react-webpack5',
            options: {
              builder: {
                useSWC: true,
              },
            },
          },
        },
      });

      expect(result).resolves.toBeNull();
    });

    it('should return null if the builder is not webpack5', async () => {
      const result = check({
        mainConfig: {
          framework: {
            name: '@storybook/react-vite',
          },
        },
      });

      await expect(result).resolves.toBeNull();
    });

    it('should return null if the framework is Angular', async () => {
      const result = check({
        mainConfig: {
          framework: '@storybook/angular',
        },
      });

      await expect(result).resolves.toBeNull();
      // ...
    });

    it('should return null if the framework is Ember', async () => {
      const result = check({
        mainConfig: {
          framework: {
            name: '@storybook/ember',
          },
        },
      });

      await expect(result).resolves.toBeNull();
    });

    it('should return null if the framework is Webpack5 based but a different framework builder is used', async () => {
      const result = check({
        mainConfig: {
          framework: {
            name: '@storybook/react-webpack5',
            options: {
              builder: '@storybook/builder-vite',
            },
          },
        },
      });

      await expect(result).resolves.toBeNull();
    });

    it('should return null if the framework is Webpack5 based but a different core builder is used', async () => {
      const result = check({
        mainConfig: {
          framework: {
            name: '@storybook/react-webpack5',
          },
          core: {
            builder: '@storybook/builder-vite',
          },
        },
      });

      await expect(result).resolves.toBeNull();
    });

    it('should return null if the framework is CRA based', async () => {
      const result = check({
        packageManager: {
          getPackageVersion: (name) => {
            if (name === 'react-scripts') {
              return Promise.resolve('5.0.0');
            }

            return Promise.resolve(null);
          },
        },
        mainConfig: {
          framework: {
            name: '@storybook/react-webpack5',
          },
        },
      });

      await expect(result).resolves.toBeNull();
    });
  });

  describe('useSWC', () => {
    it('should return shouldRemoveSWCFlag: true when useSWC flag is set to true', async () => {
      const result = await check({
        packageManager: {
          getPackageVersion: (name) => {
            return Promise.resolve(null);
          },
        },
        mainConfig: {
          framework: {
            name: '@storybook/react-webpack5',
            options: {
              builder: {
                useSWC: true,
              },
            },
          },
        },
      });

      expect(result).contains({
        shouldRemoveSWCFlag: true,
      });
    });

    it('should return shouldRemoveSWCFlag: true when useSWC flag is set to false', async () => {
      const result = await check({
        packageManager: {
          getPackageVersion: (name) => {
            return Promise.resolve(null);
          },
        },
        mainConfig: {
          framework: {
            name: '@storybook/react-webpack5',
            options: {
              builder: {
                useSWC: false,
              },
            },
          },
        },
      });

      expect(result).contains({
        shouldRemoveSWCFlag: true,
      });
    });

    it('should return shouldRemoveSWCFlag: false when useSWC flag is not set', async () => {
      const result = await check({
        packageManager: {
          getPackageVersion: (name) => {
            return Promise.resolve(null);
          },
        },
        mainConfig: {
          framework: {
            name: '@storybook/react-webpack5',
            options: {
              builder: {},
            },
          },
        },
      });

      expect(result).contains({
        shouldRemoveSWCFlag: false,
      });
    });
  });

  describe('Next.js', () => {
    it('should return isNextJs: true when the framework is nextjs', async () => {
      const result = await check({
        packageManager: {
          getPackageVersion: (name) => {
            return Promise.resolve(null);
          },
        },
        mainConfig: {
          framework: {
            name: '@storybook/nextjs',
          },
        },
      });

      expect(result).contains({
        isNextJs: true,
      });
    });

    it('should return isNextJs: true AND should return shouldRemoveSWCFlag: true when useSWC flag is set', async () => {
      const result = await check({
        packageManager: {
          getPackageVersion: (name) => {
            return Promise.resolve(null);
          },
        },
        mainConfig: {
          framework: {
            name: '@storybook/nextjs',
            options: {
              builder: {
                useSWC: true,
              },
            },
          },
        },
      });

      expect(result).contains({
        isNextJs: true,
        shouldRemoveSWCFlag: true,
      });
    });

    it('should return isNextJs: false when the framework is not nextjs', async () => {
      const result = await check({
        packageManager: {
          getPackageVersion: (name) => {
            return Promise.resolve(null);
          },
        },
        mainConfig: {
          framework: {
            name: '@storybook/react-webpack5',
          },
        },
      });

      expect(result).contains({
        isNextJs: false,
      });
    });
  });

  describe('return options', () => {
    it('should return defaultCompiler: babel when useSWC flag is not set', async () => {
      const result = await check({
        packageManager: {
          getPackageVersion: (name) => {
            return Promise.resolve(null);
          },
        },
        mainConfig: {
          framework: {
            name: '@storybook/react-webpack5',
          },
        },
      });

      expect(result).contains({
        defaultCompiler: CoreWebpackCompilers.Babel,
      });
    });

    describe('user selects swc', () => {
      it('should return defaultCompiler: swc when useSWC flag is set', async () => {
        const result = await check({
          packageManager: {
            getPackageVersion: (name) => {
              return Promise.resolve(null);
            },
          },
          mainConfig: {
            framework: {
              name: '@storybook/react-webpack5',
              options: {
                builder: {
                  useSWC: true,
                },
              },
            },
          },
        });

        expect(result).contains({
          defaultCompiler: CoreWebpackCompilers.SWC,
        });
      });
    });

    it('should return options if the framework is unknown but webpack5 was detected', async () => {
      const result = await check({
        packageManager: {
          getPackageVersion: (name) => {
            if (name === 'webpack') {
              return Promise.resolve('5.0.0');
            }

            return Promise.resolve(null);
          },
        },
        mainConfig: {
          framework: {
            name: '@storybook/unknown',
          },
        },
      });

      expect(result).not.toBeNull();
    });
  });
});

describe('promptOnly', () => {
  it('should return notification if isNextJs = true and shouldRemoveSWCFlag = false', () => {
    const promptType = webpack5CompilerSetup.promptType({
      isNextJs: true,
      shouldRemoveSWCFlag: false,
      defaultCompiler: undefined,
    });

    expect(promptType).toBe('notification');
  });

  it('should return auto if isNextJs = false', () => {
    const promptType = webpack5CompilerSetup.promptType({
      isNextJs: false,
      shouldRemoveSWCFlag: false,
      defaultCompiler: undefined,
    });

    expect(promptType).toBe('auto');
  });

  it('should return auto if shouldRemoveSWCFlag is true', () => {
    const promptType = webpack5CompilerSetup.promptType({
      isNextJs: true,
      shouldRemoveSWCFlag: true,
      defaultCompiler: undefined,
    });

    expect(promptType).toBe('auto');
  });
});

describe('prompt', () => {
  it('shouldRemoveSWCFlag = true', async () => {
    const prompt = webpack5CompilerSetup.prompt({
      shouldRemoveSWCFlag: true,
      isNextJs: false,
      defaultCompiler: CoreWebpackCompilers.SWC,
    });

    expect(prompt).toMatchInlineSnapshot(`
        "We need to update your Storybook configuration for Webpack 5.
        The framework.options.builder.useSWC flag will be removed.

        Storybook's Webpack5 builder is now compiler agnostic, meaning you have to install an additional addon to set up a compiler for Webpack5.

        We have detected, that you want to use SWC as the compiler for Webpack5.

        In the next step, Storybook will install @storybook/addon-webpack5-compiler-swc and will add it to your addons list in your Storybook config.

        After the migration, you can switch Webpack5 compilers by swapping the addon in your project.
        You can find more information here: https://storybook.js.org/docs/8.0/builders/webpack#compiler-support"
      `);
  });

  it('shouldRemoveSWCFlag = false', async () => {
    const prompt = webpack5CompilerSetup.prompt({
      shouldRemoveSWCFlag: false,
      isNextJs: false,
      defaultCompiler: CoreWebpackCompilers.SWC,
    });

    expect(prompt).toMatchInlineSnapshot(`
        "Storybook's Webpack5 builder is now compiler agnostic, meaning you have to install an additional addon to set up a compiler for Webpack5.

        We have detected, that you want to use SWC as the compiler for Webpack5.

        In the next step, Storybook will install @storybook/addon-webpack5-compiler-swc and will add it to your addons list in your Storybook config.

        After the migration, you can switch Webpack5 compilers by swapping the addon in your project.
        You can find more information here: https://storybook.js.org/docs/8.0/builders/webpack#compiler-support"
      `);
  });

  it('defaultCompiler = babel', async () => {
    const prompt = webpack5CompilerSetup.prompt({
      shouldRemoveSWCFlag: false,
      isNextJs: false,
      defaultCompiler: CoreWebpackCompilers.Babel,
    });

    expect(prompt).toMatchInlineSnapshot(`
        "Storybook's Webpack5 builder is now compiler agnostic, meaning you can choose a compiler addon that best fits your project:

          - Babel: A vast ecosystem and is battle-tested. It's a robust choice if you have an extensive Babel setup or need specific Babel plugins for your project.
          - SWC:  Fast and easy to configure. Ideal if you want faster builds and have a straightforward configuration without the need for Babel's extensibility.

        In the next step, Storybook will ask you to choose a compiler to automatically set it up for you.

        After the migration, you can switch Webpack5 compilers by swapping the addon in your project.
        You can find more information here: https://storybook.js.org/docs/8.0/builders/webpack#compiler-support"
      `);
  });

  it('isNextJs = true', () => {
    const prompt = webpack5CompilerSetup.prompt({
      shouldRemoveSWCFlag: true,
      isNextJs: true,
      defaultCompiler: CoreWebpackCompilers.SWC,
    });

    expect(prompt).toMatchInlineSnapshot(`
      "We need to update your Storybook configuration for Webpack 5.
      The framework.options.builder.useSWC flag will be removed.

      Storybook now detects whether it should use Babel or SWC as a compiler by applying the same logic as Next.js itself:

        - If you have a .babelrc (or babel.config.js) file in your project, Storybook will use Babel as the compiler.
        - If you have a .babelrc (or babel.config.js) file in your project and you have set 
          experimental.forceSwcTransforms = true in your next.config.js file, 
          Storybook will use SWC as the compiler.
        - If you don't have a .babelrc (or babel.config.js) file in your project, Storybook will use SWC as the compiler."
    `);
  });

  it('isNextjs = false AND defaultCompiler = swc', () => {
    const prompt = webpack5CompilerSetup.prompt({
      shouldRemoveSWCFlag: false,
      isNextJs: false,
      defaultCompiler: CoreWebpackCompilers.SWC,
    });

    expect(prompt).toMatchInlineSnapshot(`
        "Storybook's Webpack5 builder is now compiler agnostic, meaning you have to install an additional addon to set up a compiler for Webpack5.

        We have detected, that you want to use SWC as the compiler for Webpack5.

        In the next step, Storybook will install @storybook/addon-webpack5-compiler-swc and will add it to your addons list in your Storybook config.

        After the migration, you can switch Webpack5 compilers by swapping the addon in your project.
        You can find more information here: https://storybook.js.org/docs/8.0/builders/webpack#compiler-support"
      `);
  });

  it('isNextjs = false AND defaultCompiler = babel', () => {
    const prompt = webpack5CompilerSetup.prompt({
      shouldRemoveSWCFlag: false,
      isNextJs: false,
      defaultCompiler: CoreWebpackCompilers.Babel,
    });

    expect(prompt).toMatchInlineSnapshot(`
        "Storybook's Webpack5 builder is now compiler agnostic, meaning you can choose a compiler addon that best fits your project:

          - Babel: A vast ecosystem and is battle-tested. It's a robust choice if you have an extensive Babel setup or need specific Babel plugins for your project.
          - SWC:  Fast and easy to configure. Ideal if you want faster builds and have a straightforward configuration without the need for Babel's extensibility.

        In the next step, Storybook will ask you to choose a compiler to automatically set it up for you.

        After the migration, you can switch Webpack5 compilers by swapping the addon in your project.
        You can find more information here: https://storybook.js.org/docs/8.0/builders/webpack#compiler-support"
      `);
  });
});

import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { SourceEditor } from 'storybook/internal/csf-tools';

import { getDiff } from '../../../core/src/core-server/utils/save-story/getDiff.ts';
import { loadTemplate, updateConfigFile } from './updateVitestFile.ts';

vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../core/src/shared/utils/module', () => ({
  resolvePackageDir: vi.fn().mockImplementation(() => join(__dirname, '..')),
}));

describe('updateConfigFile', () => {
  it('updates vite config file with existing projects', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    // In Vitest 4, `workspace` doesn't exist — users have `projects`
    const target = new SourceEditor(`
      /// <reference types="vitest/config" />
      import { defineConfig } from 'vite'
      import react from '@vitejs/plugin-react'

      // https://vite.dev/config/
      export default defineConfig({
        plugins: [react()],
        test: {
          globals: true,
          projects: ['packages/*']
        },
      })
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly — appends to existing projects array
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
              /// <reference types="vitest/config" />
              import { defineConfig } from 'vite'
              import react from '@vitejs/plugin-react'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              // https://vite.dev/config/
              export default defineConfig({
                plugins: [react()],
                test: {
                  globals: true,
        
      -           projects: ['packages/*']
      - 
      +           projects: [
      +             'packages/*',
      +             {
      +               extends: true,
      +               plugins: [
      +                 // The plugin will run tests for the stories defined in your Storybook config
      +                 // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                 storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +               ],
      +               test: {
      +                 name: 'storybook',
      +                 browser: {
      +                   enabled: true,
      +                   headless: true,
      +                   provider: playwright({}),
      +                   instances: [{ browser: 'chromium' }],
      +                 },
      +               },
      +             }
      +           ]
      + 
                },
              })
            "
    `);
  });

  it('supports object notation without defineConfig with existing projects', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    // In Vitest 4, `workspace` doesn't exist — users have `projects`
    const target = new SourceEditor(`
      /// <reference types="vitest/config" />
      import react from '@vitejs/plugin-react'

      // https://vite.dev/config/
      export default {
        plugins: [react()],
        test: {
          globals: true,
          projects: ['packages/*']
        },
      }
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly — appends to existing projects array
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
              /// <reference types="vitest/config" />
              import react from '@vitejs/plugin-react'
        
      + import path from 'node:path';
      + import { defineConfig } from 'vitest/config';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              // https://vite.dev/config/
              export default {
                plugins: [react()],
                test: {
                  globals: true,
        
      -           projects: ['packages/*']
      - 
      +           projects: [
      +             'packages/*',
      +             {
      +               extends: true,
      +               plugins: [
      +                 // The plugin will run tests for the stories defined in your Storybook config
      +                 // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                 storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +               ],
      +               test: {
      +                 name: 'storybook',
      +                 browser: {
      +                   enabled: true,
      +                   headless: true,
      +                   provider: playwright({}),
      +                   instances: [{ browser: 'chromium' }],
      +                 },
      +               },
      +             }
      +           ]
      + 
                },
              }
            "
    `);
  });

  it('supports function notation when defineConfig callback returns an object literal', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      /// <reference types="vitest" />

      import angular from '@analogjs/vite-plugin-angular';
      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
      import { defineConfig } from 'vite';

      // https://vitejs.dev/config/
      export default defineConfig(({ mode }) => {
        return {
          plugins: [angular(), nxViteTsPaths()],
          test: {
            globals: true,
            environment: 'jsdom',
            setupFiles: ['src/test-setup.ts'],
            include: ['**/*.spec.ts'],
            reporters: ['default'],
            hideSkippedTests: true,
            passWithNoTests: true,
          },
          define: {
            'import.meta.vitest': mode !== 'production',
          },
        };
      });
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();
    expect(after).not.toBe(before);
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
              import angular from '@analogjs/vite-plugin-angular';
              import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
              import { defineConfig } from 'vite';
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              // https://vitejs.dev/config/
              export default defineConfig(({ mode }) => {
                return {
                  plugins: [angular(), nxViteTsPaths()],
                  test: {
        
      -             globals: true,
      -             environment: 'jsdom',
      -             setupFiles: ['src/test-setup.ts'],
      -             include: ['**/*.spec.ts'],
      - 
                    reporters: ['default'],
        
      -             hideSkippedTests: true,
      - 
                    passWithNoTests: true,
        
      +             projects: [
      +               {
      +                 extends: true,
      +                 test: {
      +                   globals: true,
      +                   environment: 'jsdom',
      +                   setupFiles: ['src/test-setup.ts'],
      +                   include: ['**/*.spec.ts'],
      +                   hideSkippedTests: true,
      +                 },
      +               },
      +               {
      +                 extends: true,
      +                 plugins: [
      +                   // The plugin will run tests for the stories defined in your Storybook config
      +                   // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                   storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +                 ],
      +                 test: {
      +                   name: 'storybook',
      +                   browser: {
      +                     enabled: true,
      +                     headless: true,
      +                     provider: playwright({}),
      +                     instances: [{ browser: 'chromium' }],
      +                   },
      +                 },
      +               },
      +             ],
      + 
                  },
                  define: {
                    'import.meta.vitest': mode !== 'production',
                  },
        ..."
    `);
  });

  it('does not support complex function notation', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      /// <reference types="vitest/config" />
      import react from '@vitejs/plugin-react'

      // https://vite.dev/config/
      export default defineConfig(({ mode }) => {
        if (mode === 'production') {
          return {
            plugins: [react()],
            test: {
              globals: true,
              projects: ['packages/*']
            },
          }
        }

        return {
          plugins: [react()],
          test: {
            globals: false,
            projects: ['packages/*']
          },
        }
      })
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(false);

    const after = target.toString();

    // check if the code was NOT updated
    expect(after).toBe(before);
  });

  it('adds projects property to test config', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      /// <reference types="vitest/config" />
      import { defineConfig } from 'vite'
      import react from '@vitejs/plugin-react'

      // https://vite.dev/config/
      export default defineConfig({
        plugins: [react()],
        test: {
          globals: true,
        },
      })
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
              /// <reference types="vitest/config" />
              import { defineConfig } from 'vite'
              import react from '@vitejs/plugin-react'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              // https://vite.dev/config/
              export default defineConfig({
                plugins: [react()],
                test: {
        
      -           globals: true,
      - 
      +           projects: [
      +             {
      +               extends: true,
      +               test: {
      +                 globals: true,
      +               },
      +             },
      +             {
      +               extends: true,
      +               plugins: [
      +                 // The plugin will run tests for the stories defined in your Storybook config
      +                 // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                 storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +               ],
      +               test: {
      +                 name: 'storybook',
      +                 browser: {
      +                   enabled: true,
      +                   headless: true,
      +                   provider: playwright({}),
      +                   instances: [{ browser: 'chromium' }],
      +                 },
      +               },
      +             },
      +           ],
      + 
                },
              })
            "
    `);
  });

  it('keeps the lines of template literals and continued strings in the wrapped test config', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { defineConfig } from 'vite'

      export default defineConfig({
        test: {
          include: [\`src/**/*.test.ts
lib/**/*.test.ts\`],
          exclude: ['a\\
b'],
        },
      })
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    expect(after).toContain('`src/**/*.test.ts\nlib/**/*.test.ts`');
    expect(after).toContain("'a\\\nb'");
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
              import { defineConfig } from 'vite'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              export default defineConfig({
                test: {
        
      -           include: [\`src/**/*.test.ts
      - 
      +           projects: [
      +             {
      +               extends: true,
      +               test: {
      +                 include: [\`src/**/*.test.ts
      + 
        lib/**/*.test.ts\`],
        
      -           exclude: ['a\\
      - 
      +                 exclude: ['a\\
      + 
        b'],
        
      +               },
      +             },
      +             {
      +               extends: true,
      +               plugins: [
      +                 // The plugin will run tests for the stories defined in your Storybook config
      +                 // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                 storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +               ],
      +               test: {
      +                 name: 'storybook',
      +                 browser: {
      +                   enabled: true,
      +                   headless: true,
      +                   provider: playwright({}),
      +                   instances: [{ browser: 'chromium' }],
      +                 },
      +               },
      +             },
      +           ],
      + 
                },
              })
            "
    `);
  });

  it('updates config which is not exported immediately', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { defineConfig } from 'vite'
      import viteReact from '@vitejs/plugin-react'
      import { fileURLToPath, URL } from 'url'

      const config = defineConfig({
        resolve: {
          preserveSymlinks: true,
          alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
          },
        },
        plugins: [
          viteReact(),
        ],
      })

      export default config
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
              import { defineConfig } from 'vite'
              import viteReact from '@vitejs/plugin-react'
              import { fileURLToPath, URL } from 'url'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              const config = defineConfig({
                resolve: {
                  preserveSymlinks: true,
      ...
                plugins: [
                  viteReact(),
                ],
        
      +         test: {
      +           projects: [
      +             {
      +               extends: true,
      +               plugins: [
      +                 // The plugin will run tests for the stories defined in your Storybook config
      +                 // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                 storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +               ],
      +               test: {
      +                 name: 'storybook',
      +                 browser: {
      +                   enabled: true,
      +                   headless: true,
      +                   provider: playwright({}),
      +                   instances: [{ browser: 'chromium' }],
      +                 },
      +               },
      +             },
      +           ],
      +         },
      + 
              })
        
              export default config
            "
    `);
  });

  it('edits projects property of test config', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      /// <reference types="vitest/config" />
      import { defineConfig } from 'vite'
      import react from '@vitejs/plugin-react'

      // https://vite.dev/config/
      export default defineConfig({
        plugins: [react()],
        test: {
          globals: true,
          projects: ['packages/*', {some: 'config'}]
        }
      })
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
              /// <reference types="vitest/config" />
              import { defineConfig } from 'vite'
              import react from '@vitejs/plugin-react'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              // https://vite.dev/config/
              export default defineConfig({
                plugins: [react()],
                test: {
                  globals: true,
        
      -           projects: ['packages/*', {some: 'config'}]
      - 
      +           projects: [
      +             'packages/*',
      +             {some: 'config'},
      +             {
      +               extends: true,
      +               plugins: [
      +                 // The plugin will run tests for the stories defined in your Storybook config
      +                 // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                 storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +               ],
      +               test: {
      +                 name: 'storybook',
      +                 browser: {
      +                   enabled: true,
      +                   headless: true,
      +                   provider: playwright({}),
      +                   instances: [{ browser: 'chromium' }],
      +                 },
      +               },
      +             }
      +           ]
      + 
                }
              })
            "
    `);
  });

  it('adds projects property to test config', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      /// <reference types="vitest/config" />
      import { defineConfig } from 'vite'
      import react from '@vitejs/plugin-react'

      // https://vite.dev/config/
      export default defineConfig({
        plugins: [react()],
        test: {
          globals: true,
        },
      })
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
              /// <reference types="vitest/config" />
              import { defineConfig } from 'vite'
              import react from '@vitejs/plugin-react'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              // https://vite.dev/config/
              export default defineConfig({
                plugins: [react()],
                test: {
        
      -           globals: true,
      - 
      +           projects: [
      +             {
      +               extends: true,
      +               test: {
      +                 globals: true,
      +               },
      +             },
      +             {
      +               extends: true,
      +               plugins: [
      +                 // The plugin will run tests for the stories defined in your Storybook config
      +                 // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                 storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +               ],
      +               test: {
      +                 name: 'storybook',
      +                 browser: {
      +                   enabled: true,
      +                   headless: true,
      +                   provider: playwright({}),
      +                   instances: [{ browser: 'chromium' }],
      +                 },
      +               },
      +             },
      +           ],
      + 
                },
              })
            "
    `);
  });

  it('adds test property to vite config', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      /// <reference types="vitest/config" />
      import { defineConfig } from 'vite'
      import react from '@vitejs/plugin-react'

      // https://vite.dev/config/
      export default defineConfig({
        plugins: [react()],
      })
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
              /// <reference types="vitest/config" />
              import { defineConfig } from 'vite'
              import react from '@vitejs/plugin-react'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              // https://vite.dev/config/
              export default defineConfig({
                plugins: [react()],
        
      +         test: {
      +           projects: [
      +             {
      +               extends: true,
      +               plugins: [
      +                 // The plugin will run tests for the stories defined in your Storybook config
      +                 // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                 storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +               ],
      +               test: {
      +                 name: 'storybook',
      +                 browser: {
      +                   enabled: true,
      +                   headless: true,
      +                   provider: playwright({}),
      +                   instances: [{ browser: 'chromium' }],
      +                 },
      +               },
      +             },
      +           ],
      +         },
      + 
              })
            "
    `);
  });

  it('supports mergeConfig with multiple defineConfig calls, finding the one with test', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { mergeConfig } from 'vite'
      import { defineConfig } from 'vitest/config'
      import viteConfig from './vite.config'

      export default mergeConfig(
        viteConfig,
        defineConfig({
          plugins: [react()],
        }),
        defineConfig({
          test: {
            environment: 'jsdom',
          }
        })
      )
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
              import { mergeConfig } from 'vite'
              import { defineConfig } from 'vitest/config'
              import viteConfig from './vite.config'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              export default mergeConfig(
                viteConfig,
                defineConfig({
                  plugins: [react()],
                }),
                defineConfig({
                  test: {
        
      -             environment: 'jsdom',
      - 
      +             projects: [
      +               {
      +                 extends: true,
      +                 test: {
      +                   environment: 'jsdom',
      +                 },
      +               },
      +               {
      +                 extends: true,
      +                 plugins: [
      +                   // The plugin will run tests for the stories defined in your Storybook config
      +                   // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                   storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +                 ],
      +                 test: {
      +                   name: 'storybook',
      +                   browser: {
      +                     enabled: true,
      +                     headless: true,
      +                     provider: playwright({}),
      +                     instances: [{ browser: 'chromium' }],
      +                   },
      +                 },
      +               },
      +             ],
      + 
                  }
                })
              )
            "
    `);
  });
  it('supports mergeConfig without defineConfig calls', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { mergeConfig } from 'vite'
      import viteConfig from './vite.config'

      export default mergeConfig(
        viteConfig,
        {
          plugins: [react()],
          test: {
            environment: 'jsdom',
          }
        }
      )
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
              import { mergeConfig } from 'vite'
              import viteConfig from './vite.config'
        
      + import path from 'node:path';
      + import { defineConfig } from 'vitest/config';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              export default mergeConfig(
                viteConfig,
                {
                  plugins: [react()],
                  test: {
        
      -             environment: 'jsdom',
      - 
      +             projects: [
      +               {
      +                 extends: true,
      +                 test: {
      +                   environment: 'jsdom',
      +                 },
      +               },
      +               {
      +                 extends: true,
      +                 plugins: [
      +                   // The plugin will run tests for the stories defined in your Storybook config
      +                   // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                   storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +                 ],
      +                 test: {
      +                   name: 'storybook',
      +                   browser: {
      +                     enabled: true,
      +                     headless: true,
      +                     provider: playwright({}),
      +                     instances: [{ browser: 'chromium' }],
      +                   },
      +                 },
      +               },
      +             ],
      + 
                  }
                }
              )
            "
    `);
  });

  it('supports mergeConfig without config containing test property', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { mergeConfig } from 'vite'
      import { defineConfig } from 'vitest/config'
      import viteConfig from './vite.config'

      export default mergeConfig(
        viteConfig,
        defineConfig({
          plugins: [react()],
        })
      )
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
              import { mergeConfig } from 'vite'
              import { defineConfig } from 'vitest/config'
              import viteConfig from './vite.config'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              export default mergeConfig(
                viteConfig,
                defineConfig({
                  plugins: [react()],
        
      +           test: {
      +             projects: [
      +               {
      +                 extends: true,
      +                 plugins: [
      +                   // The plugin will run tests for the stories defined in your Storybook config
      +                   // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                   storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +                 ],
      +                 test: {
      +                   name: 'storybook',
      +                   browser: {
      +                     enabled: true,
      +                     headless: true,
      +                     provider: playwright({}),
      +                     instances: [{ browser: 'chromium' }],
      +                   },
      +                 },
      +               },
      +             ],
      +           },
      + 
                })
              )
            "
    `);
  });

  it('supports mergeConfig with defineConfig pattern using projects (Vitest 3.2+)', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      /// <reference types="vitest/config" />
      import { mergeConfig, defineConfig } from 'vitest/config'
      import viteConfig from './vite.config'

      // https://vite.dev/config/
      export default mergeConfig(
        viteConfig,
        defineConfig({
          test: {
            globals: true,
          },
        })
      )
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
              /// <reference types="vitest/config" />
              import { mergeConfig, defineConfig } from 'vitest/config'
              import viteConfig from './vite.config'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              // https://vite.dev/config/
              export default mergeConfig(
                viteConfig,
                defineConfig({
                  test: {
        
      -             globals: true,
      - 
      +             projects: [
      +               {
      +                 extends: true,
      +                 test: {
      +                   globals: true,
      +                 },
      +               },
      +               {
      +                 extends: true,
      +                 plugins: [
      +                   // The plugin will run tests for the stories defined in your Storybook config
      +                   // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                   storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +                 ],
      +                 test: {
      +                   name: 'storybook',
      +                   browser: {
      +                     enabled: true,
      +                     headless: true,
      +                     provider: playwright({}),
      +                     instances: [{ browser: 'chromium' }],
      +                   },
      +                 },
      +               },
      +             ],
      + 
                  },
                })
              )
            "
    `);
  });

  it('appends storybook project to existing test.projects array (no double nesting)', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { mergeConfig, defineConfig } from 'vitest/config'
      import viteConfig from './vite.config'

      export default mergeConfig(
        viteConfig,
        defineConfig({
          test: {
            expect: { requireAssertions: true },
            projects: [
              {
                extends: "./vite.config.ts",
                test: { name: "client" },
              },
              {
                extends: "./vite.config.ts",
                test: { name: "server" },
              },
            ],
          },
        })
      )
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly (storybook project appended to existing projects, no double nesting)
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
              import { mergeConfig, defineConfig } from 'vitest/config'
              import viteConfig from './vite.config'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              export default mergeConfig(
                viteConfig,
                defineConfig({
      ...
                        extends: "./vite.config.ts",
                        test: { name: "server" },
                      },
        
      +               {
      +                 extends: true,
      +                 plugins: [
      +                   // The plugin will run tests for the stories defined in your Storybook config
      +                   // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                   storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +                 ],
      +                 test: {
      +                   name: 'storybook',
      +                   browser: {
      +                     enabled: true,
      +                     headless: true,
      +                     provider: playwright({}),
      +                     instances: [{ browser: 'chromium' }],
      +                   },
      +                 },
      +               },
      + 
                    ],
                  },
                })
              )
        ..."
    `);
  });
  it('appends storybook project when test.projects is bound to an identifier', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { defineConfig } from 'vitest/config'

      const workspaceProjects = [
        { extends: true, test: { name: 'client' } },
        { extends: true, test: { name: 'server' } },
      ]

      export default defineConfig({
        test: {
          globals: true,
          projects: workspaceProjects,
        },
      })
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly — the reference is statically proven to be an
    // array, so it spreads plain and the storybook project is a sibling entry in the same
    // array. Wrapping the reference inside a project entry would bury it: a `projects` key
    // inside a project entry is not a project list, so the original list would stop applying.
    expect(after).toContain('...workspaceProjects');

    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
              import { defineConfig } from 'vitest/config'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              const workspaceProjects = [
                { extends: true, test: { name: 'client' } },
                { extends: true, test: { name: 'server' } },
      ...
              export default defineConfig({
                test: {
                  globals: true,
        
      -           projects: workspaceProjects,
      - 
      +           projects: [
      +             ...workspaceProjects,
      +             {
      +               extends: true,
      +               plugins: [
      +                 // The plugin will run tests for the stories defined in your Storybook config
      +                 // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                 storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +               ],
      +               test: {
      +                 name: 'storybook',
      +                 browser: {
      +                   enabled: true,
      +                   headless: true,
      +                   provider: playwright({}),
      +                   instances: [{ browser: 'chromium' }],
      +                 },
      +               },
      +             }
      +           ],
      + 
                },
              })
            "
    `);
  });

  it('appends storybook project when test.projects is a computed expression', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { getWorkspaceProjects } from './vitest.projects'

      export default {
        test: {
          globals: true,
          projects: getWorkspaceProjects(),
        },
      }
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly — a call result cannot be statically proven
    // non-nullish, so the spread coalesces to an `{ extends: true }` project that reproduces
    // the root config: in Vitest 5 an absent list means "no workspace, root config runs as the
    // default project", and an empty-array fallback would instead declare an empty workspace
    // that silently stops the user's own tests. The storybook project is a sibling entry in
    // the same array.
    expect(after).toContain('?? [{ extends: true }]');

    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
              import { getWorkspaceProjects } from './vitest.projects'
        
      + import path from 'node:path';
      + import { defineConfig } from 'vitest/config';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              export default {
                test: {
                  globals: true,
        
      -           projects: getWorkspaceProjects(),
      - 
      +           projects: [
      +             ...((getWorkspaceProjects()) ?? [{ extends: true }]),
      +             {
      +               extends: true,
      +               plugins: [
      +                 // The plugin will run tests for the stories defined in your Storybook config
      +                 // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                 storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +               ],
      +               test: {
      +                 name: 'storybook',
      +                 browser: {
      +                   enabled: true,
      +                   headless: true,
      +                   provider: playwright({}),
      +                   instances: [{ browser: 'chromium' }],
      +                 },
      +               },
      +             }
      +           ],
      + 
                },
              }
            "
    `);
  });

  it('appends storybook project when a mergeConfig export binds test.projects to an identifier', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { mergeConfig, defineConfig } from 'vitest/config'
      import viteConfig from './vite.config'

      const workspaceProjects = [
        { extends: true, test: { name: 'client' } },
      ]

      export default mergeConfig(
        viteConfig,
        defineConfig({
          test: {
            projects: workspaceProjects,
          },
        })
      )
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly — the reference is statically proven to be an
    // array, so it spreads plain and the storybook project is a sibling entry in the same array
    expect(after).toContain('...workspaceProjects');

    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
              import { mergeConfig, defineConfig } from 'vitest/config'
              import viteConfig from './vite.config'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              const workspaceProjects = [
                { extends: true, test: { name: 'client' } },
              ]
      ...
                viteConfig,
                defineConfig({
                  test: {
        
      -             projects: workspaceProjects,
      - 
      +             projects: [
      +               ...workspaceProjects,
      +               {
      +                 extends: true,
      +                 plugins: [
      +                   // The plugin will run tests for the stories defined in your Storybook config
      +                   // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                   storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +                 ],
      +                 test: {
      +                   name: 'storybook',
      +                   browser: {
      +                     enabled: true,
      +                     headless: true,
      +                     provider: playwright({}),
      +                     instances: [{ browser: 'chromium' }],
      +                   },
      +                 },
      +               }
      +             ],
      + 
                  },
                })
              )
            "
    `);
  });

  it('appends storybook project when test.projects is a single string glob', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { defineConfig } from 'vitest/config'

      export default defineConfig({
        test: {
          globals: true,
          projects: './packages/*/vitest.config.ts',
        },
      })
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly — the original glob keeps applying as a string
    // entry and the storybook project is a sibling entry in the same array
    expect(after).toContain("'./packages/*/vitest.config.ts'");

    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
              import { defineConfig } from 'vitest/config'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              export default defineConfig({
                test: {
                  globals: true,
        
      -           projects: './packages/*/vitest.config.ts',
      - 
      +           projects: [
      +             './packages/*/vitest.config.ts',
      +             {
      +               extends: true,
      +               plugins: [
      +                 // The plugin will run tests for the stories defined in your Storybook config
      +                 // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                 storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +               ],
      +               test: {
      +                 name: 'storybook',
      +                 browser: {
      +                   enabled: true,
      +                   headless: true,
      +                   provider: playwright({}),
      +                   instances: [{ browser: 'chromium' }],
      +                 },
      +               },
      +             }
      +           ],
      + 
                },
              })
            "
    `);
  });

  it('appends storybook project when test.projects is a template-literal glob', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { defineConfig } from 'vitest/config'

      export default defineConfig({
        test: {
          globals: true,
          projects: \`./packages/*/vitest.config.ts\`,
        },
      })
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly — a template-literal glob wraps into a
    // single-entry array exactly like a string literal, keeping the glob applying with the
    // storybook project as a sibling. Without this arm the template literal would fall
    // through to the spread and become one entry per character.
    expect(after).toContain('`./packages/*/vitest.config.ts`');

    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
              import { defineConfig } from 'vitest/config'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              export default defineConfig({
                test: {
                  globals: true,
        
      -           projects: \`./packages/*/vitest.config.ts\`,
      - 
      +           projects: [
      +             \`./packages/*/vitest.config.ts\`,
      +             {
      +               extends: true,
      +               plugins: [
      +                 // The plugin will run tests for the stories defined in your Storybook config
      +                 // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                 storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +               ],
      +               test: {
      +                 name: 'storybook',
      +                 browser: {
      +                   enabled: true,
      +                   headless: true,
      +                   provider: playwright({}),
      +                   instances: [{ browser: 'chromium' }],
      +                 },
      +               },
      +             }
      +           ],
      + 
                },
              })
            "
    `);
  });

  it('appends storybook project when test.projects is conditionally undefined', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { defineConfig } from 'vitest/config'

      const workspaceProjects = [
        { extends: true, test: { name: 'client' } },
      ]

      export default defineConfig({
        test: {
          globals: true,
          projects: process.env.CI ? workspaceProjects : undefined,
        },
      })
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly — an absent project list must not be spread
    // bare (spreading undefined throws) and must not degrade to `[]` either: in Vitest 5 an
    // undefined list means "no workspace", so the root config runs as the default project,
    // while an empty array declares an empty workspace and silently stops the user's own
    // tests. The `{ extends: true }` fallback reproduces the root project, keeping the
    // user's tests and the storybook project both running outside CI.
    expect(after).toContain('?? [{ extends: true }]');

    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
              import { defineConfig } from 'vitest/config'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              const workspaceProjects = [
                { extends: true, test: { name: 'client' } },
              ]
        
              export default defineConfig({
                test: {
                  globals: true,
        
      -           projects: process.env.CI ? workspaceProjects : undefined,
      - 
      +           projects: [
      +             ...((process.env.CI ? workspaceProjects : undefined) ?? [{ extends: true }]),
      +             {
      +               extends: true,
      +               plugins: [
      +                 // The plugin will run tests for the stories defined in your Storybook config
      +                 // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                 storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +               ],
      +               test: {
      +                 name: 'storybook',
      +                 browser: {
      +                   enabled: true,
      +                   headless: true,
      +                   provider: playwright({}),
      +                   instances: [{ browser: 'chromium' }],
      +                 },
      +               },
      +             }
      +           ],
      + 
                },
              })
            "
    `);
  });

  it('extracts coverage config and keeps it at top level when using workspace', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { mergeConfig, defineConfig } from 'vitest/config'
      import viteConfig from './vite.config'

      export default mergeConfig(
        viteConfig,
        defineConfig({
          test: {
            name: 'node',
            environment: 'happy-dom',
            include: ['**/*.test.ts'],
            coverage: {
              exclude: [
                'storybook.setup.ts',
                '**/*.stories.*',
              ],
            },
          },
        })
      )
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    // Coverage should stay at the top level, not moved into the workspace
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
              import { mergeConfig, defineConfig } from 'vitest/config'
              import viteConfig from './vite.config'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              export default mergeConfig(
                viteConfig,
                defineConfig({
                  test: {
        
      -             name: 'node',
      -             environment: 'happy-dom',
      -             include: ['**/*.test.ts'],
      - 
                    coverage: {
                      exclude: [
                        'storybook.setup.ts',
                        '**/*.stories.*',
                      ],
                    },
        
      +             projects: [
      +               {
      +                 extends: true,
      +                 test: {
      +                   name: 'node',
      +                   environment: 'happy-dom',
      +                   include: ['**/*.test.ts'],
      +                 },
      +               },
      +               {
      +                 extends: true,
      +                 plugins: [
      +                   // The plugin will run tests for the stories defined in your Storybook config
      +                   // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                   storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +                 ],
      +                 test: {
      +                   name: 'storybook',
      +                   browser: {
      +                     enabled: true,
      +                     headless: true,
      +                     provider: playwright({}),
      +                     instances: [{ browser: 'chromium' }],
      +                   },
      +                 },
      +               },
      +             ],
      + 
                  },
                })
              )
            "
    `);
  });

  it('extracts coverage config and keeps it at top level when using projects', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { mergeConfig, defineConfig } from 'vitest/config'
      import viteConfig from './vite.config'

      export default mergeConfig(
        viteConfig,
        defineConfig({
          test: {
            name: 'node',
            environment: 'happy-dom',
            include: ['**/*.test.ts'],
            coverage: {
              exclude: [
                'storybook.setup.ts',
                '**/*.stories.*',
              ],
            },
          },
        })
      )
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    // Coverage should stay at the top level, not moved into the projects
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
              import { mergeConfig, defineConfig } from 'vitest/config'
              import viteConfig from './vite.config'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              export default mergeConfig(
                viteConfig,
                defineConfig({
                  test: {
        
      -             name: 'node',
      -             environment: 'happy-dom',
      -             include: ['**/*.test.ts'],
      - 
                    coverage: {
                      exclude: [
                        'storybook.setup.ts',
                        '**/*.stories.*',
                      ],
                    },
        
      +             projects: [
      +               {
      +                 extends: true,
      +                 test: {
      +                   name: 'node',
      +                   environment: 'happy-dom',
      +                   include: ['**/*.test.ts'],
      +                 },
      +               },
      +               {
      +                 extends: true,
      +                 plugins: [
      +                   // The plugin will run tests for the stories defined in your Storybook config
      +                   // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                   storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +                 ],
      +                 test: {
      +                   name: 'storybook',
      +                   browser: {
      +                     enabled: true,
      +                     headless: true,
      +                     provider: playwright({}),
      +                     instances: [{ browser: 'chromium' }],
      +                   },
      +                 },
      +               },
      +             ],
      + 
                  },
                })
              )
            "
    `);
  });

  it('supports defineConfig wrapping mergeConfig', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { defineConfig, mergeConfig } from 'vitest/config'
      import viteConfig from './vite.config'

      export default defineConfig(mergeConfig(viteConfig, {
        test: {
          name: 'node',
          environment: 'happy-dom',
          include: ['**/*.test.ts'],
        },
      }))
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();
    expect(after).not.toBe(before);
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
              import { defineConfig, mergeConfig } from 'vitest/config'
              import viteConfig from './vite.config'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              export default defineConfig(mergeConfig(viteConfig, {
                test: {
        
      -           name: 'node',
      -           environment: 'happy-dom',
      -           include: ['**/*.test.ts'],
      - 
      +           projects: [
      +             {
      +               extends: true,
      +               test: {
      +                 name: 'node',
      +                 environment: 'happy-dom',
      +                 include: ['**/*.test.ts'],
      +               },
      +             },
      +             {
      +               extends: true,
      +               plugins: [
      +                 // The plugin will run tests for the stories defined in your Storybook config
      +                 // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                 storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +               ],
      +               test: {
      +                 name: 'storybook',
      +                 browser: {
      +                   enabled: true,
      +                   headless: true,
      +                   provider: playwright({}),
      +                   instances: [{ browser: 'chromium' }],
      +                 },
      +               },
      +             },
      +           ],
      + 
                },
              }))
            "
    `);
  });

  it('supports defineConfig wrapping mergeConfig with satisfies operator', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { defineConfig, mergeConfig } from 'vitest/config'
      import viteConfig from './vite.config'
      import type { ViteUserConfig } from 'vitest/config'

      export default defineConfig(
        mergeConfig(viteConfig, {
          test: {
            name: 'node',
            environment: 'happy-dom',
            include: ['**/*.test.ts'],
          },
        }) satisfies ViteUserConfig
      )
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();
    expect(after).not.toBe(before);
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
              import { defineConfig, mergeConfig } from 'vitest/config'
              import viteConfig from './vite.config'
              import type { ViteUserConfig } from 'vitest/config'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              export default defineConfig(
                mergeConfig(viteConfig, {
                  test: {
        
      -             name: 'node',
      -             environment: 'happy-dom',
      -             include: ['**/*.test.ts'],
      - 
      +             projects: [
      +               {
      +                 extends: true,
      +                 test: {
      +                   name: 'node',
      +                   environment: 'happy-dom',
      +                   include: ['**/*.test.ts'],
      +                 },
      +               },
      +               {
      +                 extends: true,
      +                 plugins: [
      +                   // The plugin will run tests for the stories defined in your Storybook config
      +                   // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                   storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +                 ],
      +                 test: {
      +                   name: 'storybook',
      +                   browser: {
      +                     enabled: true,
      +                     headless: true,
      +                     provider: playwright({}),
      +                     instances: [{ browser: 'chromium' }],
      +                   },
      +                 },
      +               },
      +             ],
      + 
                  },
                }) satisfies ViteUserConfig
              )
            "
    `);
  });

  it('supports mergeConfig with as operator (TSAsExpression)', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { mergeConfig } from 'vitest/config'
      import viteConfig from './vite.config'
      import type { ViteUserConfig } from 'vitest/config'

      export default mergeConfig(viteConfig, {
        test: {
          name: 'node',
          environment: 'happy-dom',
          include: ['**/*.test.ts'],
        },
      }) as ViteUserConfig
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();
    expect(after).not.toBe(before);
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
              import { mergeConfig } from 'vitest/config'
              import viteConfig from './vite.config'
              import type { ViteUserConfig } from 'vitest/config'
        
      + import path from 'node:path';
      + import { defineConfig } from 'vitest/config';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              export default mergeConfig(viteConfig, {
                test: {
        
      -           name: 'node',
      -           environment: 'happy-dom',
      -           include: ['**/*.test.ts'],
      - 
      +           projects: [
      +             {
      +               extends: true,
      +               test: {
      +                 name: 'node',
      +                 environment: 'happy-dom',
      +                 include: ['**/*.test.ts'],
      +               },
      +             },
      +             {
      +               extends: true,
      +               plugins: [
      +                 // The plugin will run tests for the stories defined in your Storybook config
      +                 // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                 storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +               ],
      +               test: {
      +                 name: 'storybook',
      +                 browser: {
      +                   enabled: true,
      +                   headless: true,
      +                   provider: playwright({}),
      +                   instances: [{ browser: 'chromium' }],
      +                 },
      +               },
      +             },
      +           ],
      + 
                },
              }) as ViteUserConfig
            "
    `);
  });

  it('supports mergeConfig with test defined as a constant (shorthand property)', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { mergeConfig } from 'vitest/config'
      import viteConfig from './vite.config'

      const test = {
        name: 'node',
        environment: 'happy-dom',
        include: ['**/*.test.ts'],
      }

      export default mergeConfig(viteConfig, { test })
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();
    expect(after).not.toBe(before);
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
              import { mergeConfig } from 'vitest/config'
              import viteConfig from './vite.config'
        
      + import path from 'node:path';
      + import { defineConfig } from 'vitest/config';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              const test = {
                name: 'node',
                environment: 'happy-dom',
                include: ['**/*.test.ts'],
              }
        
        
      -       export default mergeConfig(viteConfig, { test })
      - 
      +       export default mergeConfig(viteConfig, { test: {
      +         projects: [
      +           {
      +             extends: true,
      +             test: {
      +               name: 'node',
      +               environment: 'happy-dom',
      +               include: ['**/*.test.ts'],
      +             },
      +           },
      +           {
      +             extends: true,
      +             plugins: [
      +               // The plugin will run tests for the stories defined in your Storybook config
      +               // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +               storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +             ],
      +             test: {
      +               name: 'storybook',
      +               browser: {
      +                 enabled: true,
      +                 headless: true,
      +                 provider: playwright({}),
      +                 instances: [{ browser: 'chromium' }],
      +               },
      +             },
      +           },
      +         ],
      +       } })
      + 
            "
    `);
  });

  it('supports const defined config re-exported (export default config)', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { defineConfig, mergeConfig } from 'vitest/config'
      import viteConfig from './vite.config'

      const config = mergeConfig(
        viteConfig,
        defineConfig({
          test: {
            name: 'node',
            environment: 'happy-dom',
            include: ['**/*.test.ts'],
          },
        })
      )

      export default config
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();
    expect(after).not.toBe(before);
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
              import { defineConfig, mergeConfig } from 'vitest/config'
              import viteConfig from './vite.config'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              const config = mergeConfig(
                viteConfig,
                defineConfig({
                  test: {
        
      -             name: 'node',
      -             environment: 'happy-dom',
      -             include: ['**/*.test.ts'],
      - 
      +             projects: [
      +               {
      +                 extends: true,
      +                 test: {
      +                   name: 'node',
      +                   environment: 'happy-dom',
      +                   include: ['**/*.test.ts'],
      +                 },
      +               },
      +               {
      +                 extends: true,
      +                 plugins: [
      +                   // The plugin will run tests for the stories defined in your Storybook config
      +                   // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                   storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +                 ],
      +                 test: {
      +                   name: 'storybook',
      +                   browser: {
      +                     enabled: true,
      +                     headless: true,
      +                     provider: playwright({}),
      +                     instances: [{ browser: 'chromium' }],
      +                   },
      +                 },
      +               },
      +             ],
      + 
                  },
                })
              )
        
        ..."
    `);
  });

  it('supports defineProject instead of defineConfig', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { defineProject } from 'vitest/config'

      export default defineProject({
        test: {
          name: 'node',
          environment: 'happy-dom',
          include: ['**/*.test.ts'],
        },
      })
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();
    expect(after).not.toBe(before);
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
              import { defineProject } from 'vitest/config'
        
      + import path from 'node:path';
      + import { defineConfig } from 'vitest/config';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              export default defineProject({
                test: {
        
      -           name: 'node',
      -           environment: 'happy-dom',
      -           include: ['**/*.test.ts'],
      - 
      +           projects: [
      +             {
      +               extends: true,
      +               test: {
      +                 name: 'node',
      +                 environment: 'happy-dom',
      +                 include: ['**/*.test.ts'],
      +               },
      +             },
      +             {
      +               extends: true,
      +               plugins: [
      +                 // The plugin will run tests for the stories defined in your Storybook config
      +                 // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                 storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +               ],
      +               test: {
      +                 name: 'storybook',
      +                 browser: {
      +                   enabled: true,
      +                   headless: true,
      +                   provider: playwright({}),
      +                   instances: [{ browser: 'chromium' }],
      +                 },
      +               },
      +             },
      +           ],
      + 
                },
              })
            "
    `);
  });

  it('supports export const config re-exported as default (ExportNamedDeclaration)', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
        import { defineConfig, mergeConfig } from 'vitest/config'
        import viteConfig from './vite.config'
  
        export const config = mergeConfig(
          viteConfig,
          defineConfig({
            test: {
              name: 'node',
              environment: 'happy-dom',
              include: ['**/*.test.ts'],
            },
          })
        )
  
        export default config
      `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();
    expect(after).not.toBe(before);
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
                import { defineConfig, mergeConfig } from 'vitest/config'
                import viteConfig from './vite.config'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
          
                export const config = mergeConfig(
                  viteConfig,
                  defineConfig({
                    test: {
        
      -               name: 'node',
      -               environment: 'happy-dom',
      -               include: ['**/*.test.ts'],
      - 
      +               projects: [
      +                 {
      +                   extends: true,
      +                   test: {
      +                     name: 'node',
      +                     environment: 'happy-dom',
      +                     include: ['**/*.test.ts'],
      +                   },
      +                 },
      +                 {
      +                   extends: true,
      +                   plugins: [
      +                     // The plugin will run tests for the stories defined in your Storybook config
      +                     // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                     storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +                   ],
      +                   test: {
      +                     name: 'storybook',
      +                     browser: {
      +                       enabled: true,
      +                       headless: true,
      +                       provider: playwright({}),
      +                       instances: [{ browser: 'chromium' }],
      +                     },
      +                   },
      +                 },
      +               ],
      + 
                    },
                  })
                )
          
        ..."
    `);
  });

  it('supports mergeConfig with config object as an exported constant (ExportNamedDeclaration)', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
        import { mergeConfig } from 'vitest/config'
        import viteConfig from './vite.config'
  
        export const vitestConfig = {
          test: {
            name: 'node',
            environment: 'happy-dom',
            include: ['**/*.test.ts'],
          }
        }
  
        export default mergeConfig(viteConfig, vitestConfig)
      `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();
    expect(after).not.toBe(before);
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
                import { mergeConfig } from 'vitest/config'
                import viteConfig from './vite.config'
        
      + import path from 'node:path';
      + import { defineConfig } from 'vitest/config';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
          
                export const vitestConfig = {
                  test: {
        
      -             name: 'node',
      -             environment: 'happy-dom',
      -             include: ['**/*.test.ts'],
      - 
      +             projects: [
      +               {
      +                 extends: true,
      +                 test: {
      +                   name: 'node',
      +                   environment: 'happy-dom',
      +                   include: ['**/*.test.ts'],
      +                 },
      +               },
      +               {
      +                 extends: true,
      +                 plugins: [
      +                   // The plugin will run tests for the stories defined in your Storybook config
      +                   // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                   storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +                 ],
      +                 test: {
      +                   name: 'storybook',
      +                   browser: {
      +                     enabled: true,
      +                     headless: true,
      +                     provider: playwright({}),
      +                     instances: [{ browser: 'chromium' }],
      +                   },
      +                 },
      +               },
      +             ],
      + 
                  }
                }
          
                export default mergeConfig(viteConfig, vitestConfig)
        ..."
    `);
  });

  it('supports mergeConfig with config object as a constant variable', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { mergeConfig } from 'vitest/config'
      import viteConfig from './vite.config'

      const vitestConfig = {
        test: {
          name: 'node',
          environment: 'happy-dom',
          include: ['**/*.test.ts'],
        }
      }

      export default mergeConfig(viteConfig, vitestConfig)
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();
    expect(after).not.toBe(before);
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
              import { mergeConfig } from 'vitest/config'
              import viteConfig from './vite.config'
        
      + import path from 'node:path';
      + import { defineConfig } from 'vitest/config';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              const vitestConfig = {
                test: {
        
      -           name: 'node',
      -           environment: 'happy-dom',
      -           include: ['**/*.test.ts'],
      - 
      +           projects: [
      +             {
      +               extends: true,
      +               test: {
      +                 name: 'node',
      +                 environment: 'happy-dom',
      +                 include: ['**/*.test.ts'],
      +               },
      +             },
      +             {
      +               extends: true,
      +               plugins: [
      +                 // The plugin will run tests for the stories defined in your Storybook config
      +                 // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                 storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +               ],
      +               test: {
      +                 name: 'storybook',
      +                 browser: {
      +                   enabled: true,
      +                   headless: true,
      +                   provider: playwright({}),
      +                   instances: [{ browser: 'chromium' }],
      +                 },
      +               },
      +             },
      +           ],
      + 
                }
              }
        
              export default mergeConfig(viteConfig, vitestConfig)
        ..."
    `);
  });

  it('supports mergeConfig with aliased defineConfig and updates the config that contains test', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import react from "@vitejs/plugin-react";
      import { playwright } from "@vitest/browser-playwright";
      import { defineConfig, mergeConfig } from "vite";
      import tsconfigPaths from "vite-tsconfig-paths";
      import { defineConfig as defineVitestConfig } from "vitest/config";

      // https://vitejs.dev/config/
      const viteConfig = defineConfig({
        plugins: [tsconfigPaths(), react()],
        optimizeDeps: {
          exclude: ["@xmtp/wasm-bindings"],
        },
        server: {
          allowedHosts: true,
        },
        build: {
          sourcemap: true,
        },
      });

      const vitestConfig = defineVitestConfig({
        test: {
          browser: {
            provider: playwright(),
            enabled: true,
            headless: true,
            screenshotFailures: false,
            instances: [
              {
                browser: "chromium",
              },
            ],
          },
          testTimeout: 120000,
        },
      });

      export default mergeConfig(viteConfig, vitestConfig);
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();
    expect(after).not.toBe(before);

    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
              import { defineConfig, mergeConfig } from "vite";
              import tsconfigPaths from "vite-tsconfig-paths";
              import { defineConfig as defineVitestConfig } from "vitest/config";
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + 
        
              // https://vitejs.dev/config/
              const viteConfig = defineConfig({
                plugins: [tsconfigPaths(), react()],
      ...
        
              const vitestConfig = defineVitestConfig({
                test: {
        
      -           browser: {
      -             provider: playwright(),
      -             enabled: true,
      -             headless: true,
      -             screenshotFailures: false,
      -             instances: [
      -               {
      -                 browser: "chromium",
      - 
      +           projects: [
      +             {
      +               extends: true,
      +               test: {
      +                 browser: {
      +                   provider: playwright(),
      +                   enabled: true,
      +                   headless: true,
      +                   screenshotFailures: false,
      +                   instances: [
      +                     {
      +                       browser: "chromium",
      +                     },
      +                   ],
      +                 },
      +                 testTimeout: 120000,
      + 
                      },
        
      -             ],
      -           },
      -           testTimeout: 120000,
      - 
      +             },
      +             {
      +               extends: true,
      +               plugins: [
      +                 // The plugin will run tests for the stories defined in your Storybook config
      +                 // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                 storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +               ],
      +               test: {
      +                 name: 'storybook',
      +                 browser: {
      +                   enabled: true,
      +                   headless: true,
      +                   provider: playwright({}),
      +                   instances: [{ browser: 'chromium' }],
      +                 },
      +               },
      +             },
      +           ],
      + 
                },
              });
        
              export default mergeConfig(viteConfig, vitestConfig);
        ..."
    `);
  });

  it('keeps coverage at top level instead of moving into projects', async () => {
    const source = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
      BROWSER_CONFIG: "{ provider: 'playwright' }",
      SETUP_FILE: '../.storybook/vitest.setup.ts',
    });
    const target = new SourceEditor(`
      import { mergeConfig, defineConfig } from 'vitest/config'
      import viteConfig from './vite.config'

      export default mergeConfig(
        viteConfig,
        defineConfig({
          test: {
            name: 'unit',
            environment: 'happy-dom',
            include: ['**/*.test.ts'],
            env: { CI: 'true' },
            pool: 'forks',
            maxWorkers: 4,
            coverage: {
              provider: 'v8',
              exclude: ['**/*.stories.*'],
            },
          },
        })
      )
    `);

    const before = target.code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = target.toString();
    expect(after).not.toBe(before);

    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  
              import { mergeConfig, defineConfig } from 'vitest/config'
              import viteConfig from './vite.config'
        
      + import path from 'node:path';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + import { playwright } from '@vitest/browser-playwright';
      + 
        
              export default mergeConfig(
                viteConfig,
                defineConfig({
                  test: {
        
      -             name: 'unit',
      -             environment: 'happy-dom',
      -             include: ['**/*.test.ts'],
      -             env: { CI: 'true' },
      -             pool: 'forks',
      -             maxWorkers: 4,
      - 
                    coverage: {
                      provider: 'v8',
                      exclude: ['**/*.stories.*'],
                    },
        
      +             projects: [
      +               {
      +                 extends: true,
      +                 test: {
      +                   name: 'unit',
      +                   environment: 'happy-dom',
      +                   include: ['**/*.test.ts'],
      +                   env: { CI: 'true' },
      +                   pool: 'forks',
      +                   maxWorkers: 4,
      +                 },
      +               },
      +               {
      +                 extends: true,
      +                 plugins: [
      +                   // The plugin will run tests for the stories defined in your Storybook config
      +                   // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +                   storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
      +                 ],
      +                 test: {
      +                   name: 'storybook',
      +                   browser: {
      +                     enabled: true,
      +                     headless: true,
      +                     provider: playwright({}),
      +                     instances: [{ browser: 'chromium' }],
      +                   },
      +                 },
      +               },
      +             ],
      + 
                  },
                })
              )
            "
    `);
  });
});

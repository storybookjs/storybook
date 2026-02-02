import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import * as babel from 'storybook/internal/babel';

import { getDiff } from '../../../core/src/core-server/utils/save-story/getDiff';
import { loadTemplate, updateConfigFile, updateWorkspaceFile } from './updateVitestFile';

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
  it('updates vite config file', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.template.txt', {
        CONFIG_DIR: '.storybook',
        BROWSER_CONFIG: "{ provider: 'playwright' }",
        SETUP_FILE: '../.storybook/vitest.setup.ts',
      })
    );
    const target = babel.babelParse(`
      /// <reference types="vitest/config" />
      import { defineConfig } from 'vite'
      import react from '@vitejs/plugin-react'

      // https://vite.dev/config/
      export default defineConfig({
        plugins: [react()],
        test: {
          globals: true,
          workspace: ['packages/*']
        },
      })
    `);

    const before = babel.generate(target).code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = babel.generate(target).code;

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
        import react from '@vitejs/plugin-react';
        
        // https://vite.dev/config/
        
      + import path from 'node:path';
      + import { fileURLToPath } from 'node:url';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
      + 
      + // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      + 
        export default defineConfig({
          plugins: [react()],
          test: {
            globals: true,
        
      -     workspace: ['packages/*']
      - 
      +     workspace: ['packages/*', {
      +       extends: true,
      +       plugins: [
      +       // The plugin will run tests for the stories defined in your Storybook config
      +       // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +       storybookTest({
      +         configDir: path.join(dirname, '.storybook')
      +       })],
      +       test: {
      +         name: 'storybook',
      +         browser: {
      +           enabled: true,
      +           headless: true,
      +           provider: 'playwright',
      +           instances: [{
      +             browser: 'chromium'
      +           }]
      +         },
      +         setupFiles: ['../.storybook/vitest.setup.ts']
      +       }
      +     }]
      + 
          }
        });"
    `);
  });

  it('supports object notation without defineConfig', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.template.txt', {
        CONFIG_DIR: '.storybook',
        BROWSER_CONFIG: "{ provider: 'playwright' }",
        SETUP_FILE: '../.storybook/vitest.setup.ts',
      })
    );
    const target = babel.babelParse(`
      /// <reference types="vitest/config" />
      import react from '@vitejs/plugin-react'

      // https://vite.dev/config/
      export default {
        plugins: [react()],
        test: {
          globals: true,
          workspace: ['packages/*']
        },
      }
    `);

    const before = babel.generate(target).code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = babel.generate(target).code;

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
        import react from '@vitejs/plugin-react';
        
        // https://vite.dev/config/
        
      + import path from 'node:path';
      + import { fileURLToPath } from 'node:url';
      + import { defineConfig } from 'vitest/config';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
      + 
      + // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      + 
        export default {
          plugins: [react()],
          test: {
            globals: true,
        
      -     workspace: ['packages/*']
      - 
      +     workspace: ['packages/*', {
      +       extends: true,
      +       plugins: [
      +       // The plugin will run tests for the stories defined in your Storybook config
      +       // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +       storybookTest({
      +         configDir: path.join(dirname, '.storybook')
      +       })],
      +       test: {
      +         name: 'storybook',
      +         browser: {
      +           enabled: true,
      +           headless: true,
      +           provider: 'playwright',
      +           instances: [{
      +             browser: 'chromium'
      +           }]
      +         },
      +         setupFiles: ['../.storybook/vitest.setup.ts']
      +       }
      +     }]
      + 
          }
        };"
    `);
  });

  it('does not support function notation', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.template.txt', {
        CONFIG_DIR: '.storybook',
        BROWSER_CONFIG: "{ provider: 'playwright' }",
        SETUP_FILE: '../.storybook/vitest.setup.ts',
      })
    );
    const target = babel.babelParse(`
      /// <reference types="vitest/config" />
      import react from '@vitejs/plugin-react'

      // https://vite.dev/config/
      export default defineConfig(() => ({
        plugins: [react()],
        test: {
          globals: true,
          workspace: ['packages/*']
        },
      }))
    `);

    const before = babel.generate(target).code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(false);

    const after = babel.generate(target).code;

    // check if the code was NOT updated
    expect(after).toBe(before);
  });

  it('adds projects property to test config', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.3.2.template.txt', {
        CONFIG_DIR: '.storybook',
        BROWSER_CONFIG: "{ provider: 'playwright' }",
        SETUP_FILE: '../.storybook/vitest.setup.ts',
      })
    );
    const target = babel.babelParse(`
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

    const before = babel.generate(target).code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = babel.generate(target).code;

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
        import react from '@vitejs/plugin-react';
        
        // https://vite.dev/config/
        
      + import path from 'node:path';
      + import { fileURLToPath } from 'node:url';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
      + 
      + // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      + 
        export default defineConfig({
          plugins: [react()],
          test: {
        
      -     globals: true
      - 
      +     globals: true,
      +     projects: [{
      +       extends: true,
      +       plugins: [
      +       // The plugin will run tests for the stories defined in your Storybook config
      +       // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +       storybookTest({
      +         configDir: path.join(dirname, '.storybook')
      +       })],
      +       test: {
      +         name: 'storybook',
      +         browser: {
      +           enabled: true,
      +           headless: true,
      +           provider: 'playwright',
      +           instances: [{
      +             browser: 'chromium'
      +           }]
      +         },
      +         setupFiles: ['../.storybook/vitest.setup.ts']
      +       }
      +     }]
      + 
          }
        });"
    `);
  });

  it('edits projects property of test config', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.3.2.template.txt', {
        CONFIG_DIR: '.storybook',
        BROWSER_CONFIG: "{ provider: 'playwright' }",
        SETUP_FILE: '../.storybook/vitest.setup.ts',
      })
    );
    const target = babel.babelParse(`
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

    const before = babel.generate(target).code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = babel.generate(target).code;

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
        import react from '@vitejs/plugin-react';
        
        // https://vite.dev/config/
        
      + import path from 'node:path';
      + import { fileURLToPath } from 'node:url';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
      + 
      + // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      + 
        export default defineConfig({
          plugins: [react()],
          test: {
            globals: true,
            projects: ['packages/*', {
              some: 'config'
        
      +     }, {
      +       extends: true,
      +       plugins: [
      +       // The plugin will run tests for the stories defined in your Storybook config
      +       // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +       storybookTest({
      +         configDir: path.join(dirname, '.storybook')
      +       })],
      +       test: {
      +         name: 'storybook',
      +         browser: {
      +           enabled: true,
      +           headless: true,
      +           provider: 'playwright',
      +           instances: [{
      +             browser: 'chromium'
      +           }]
      +         },
      +         setupFiles: ['../.storybook/vitest.setup.ts']
      +       }
      + 
            }]
          }
        });"
    `);
  });

  it('adds workspace property to test config', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.template.txt', {
        CONFIG_DIR: '.storybook',
        BROWSER_CONFIG: "{ provider: 'playwright' }",
        SETUP_FILE: '../.storybook/vitest.setup.ts',
      })
    );
    const target = babel.babelParse(`
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

    const before = babel.generate(target).code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = babel.generate(target).code;

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
        import react from '@vitejs/plugin-react';
        
        // https://vite.dev/config/
        
      + import path from 'node:path';
      + import { fileURLToPath } from 'node:url';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
      + 
      + // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      + 
        export default defineConfig({
          plugins: [react()],
          test: {
        
      -     globals: true
      - 
      +     globals: true,
      +     workspace: [{
      +       extends: true,
      +       plugins: [
      +       // The plugin will run tests for the stories defined in your Storybook config
      +       // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +       storybookTest({
      +         configDir: path.join(dirname, '.storybook')
      +       })],
      +       test: {
      +         name: 'storybook',
      +         browser: {
      +           enabled: true,
      +           headless: true,
      +           provider: 'playwright',
      +           instances: [{
      +             browser: 'chromium'
      +           }]
      +         },
      +         setupFiles: ['../.storybook/vitest.setup.ts']
      +       }
      +     }]
      + 
          }
        });"
    `);
  });

  it('adds test property to vite config', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.template.txt', {
        CONFIG_DIR: '.storybook',
        BROWSER_CONFIG: "{ provider: 'playwright' }",
        SETUP_FILE: '../.storybook/vitest.setup.ts',
      })
    );
    const target = babel.babelParse(`
      /// <reference types="vitest/config" />
      import { defineConfig } from 'vite'
      import react from '@vitejs/plugin-react'

      // https://vite.dev/config/
      export default defineConfig({
        plugins: [react()],
      })
    `);

    const before = babel.generate(target).code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = babel.generate(target).code;

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
        import react from '@vitejs/plugin-react';
        
        // https://vite.dev/config/
        
      + import path from 'node:path';
      + import { fileURLToPath } from 'node:url';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
      + 
      + // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      + 
        export default defineConfig({
        
      -   plugins: [react()]
      - 
      +   plugins: [react()],
      +   test: {
      +     workspace: [{
      +       extends: true,
      +       plugins: [
      +       // The plugin will run tests for the stories defined in your Storybook config
      +       // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +       storybookTest({
      +         configDir: path.join(dirname, '.storybook')
      +       })],
      +       test: {
      +         name: 'storybook',
      +         browser: {
      +           enabled: true,
      +           headless: true,
      +           provider: 'playwright',
      +           instances: [{
      +             browser: 'chromium'
      +           }]
      +         },
      +         setupFiles: ['../.storybook/vitest.setup.ts']
      +       }
      +     }]
      +   }
      + 
        });"
    `);
  });

  it('supports mergeConfig with multiple defineConfig calls, finding the one with test', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.template.txt', {
        CONFIG_DIR: '.storybook',
        BROWSER_CONFIG: "{ provider: 'playwright' }",
        SETUP_FILE: '../.storybook/vitest.setup.ts',
      })
    );
    const target = babel.babelParse(`
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

    const before = babel.generate(target).code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = babel.generate(target).code;

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  import { mergeConfig } from 'vite';
        import { defineConfig } from 'vitest/config';
        import viteConfig from './vite.config';
        
      + import path from 'node:path';
      + import { fileURLToPath } from 'node:url';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
      + 
      + // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      + 
        export default mergeConfig(viteConfig, defineConfig({
          plugins: [react()]
        }), defineConfig({
          test: {
        
      -     environment: 'jsdom'
      - 
      +     workspace: [{
      +       extends: true,
      +       test: {
      +         environment: 'jsdom'
      +       }
      +     }, {
      +       extends: true,
      +       plugins: [
      +       // The plugin will run tests for the stories defined in your Storybook config
      +       // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +       storybookTest({
      +         configDir: path.join(dirname, '.storybook')
      +       })],
      +       test: {
      +         name: 'storybook',
      +         browser: {
      +           enabled: true,
      +           headless: true,
      +           provider: 'playwright',
      +           instances: [{
      +             browser: 'chromium'
      +           }]
      +         },
      +         setupFiles: ['../.storybook/vitest.setup.ts']
      +       }
      +     }]
      + 
          }
        }));"
    `);
  });
  it('supports mergeConfig without defineConfig calls', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.template.txt', {
        CONFIG_DIR: '.storybook',
        BROWSER_CONFIG: "{ provider: 'playwright' }",
        SETUP_FILE: '../.storybook/vitest.setup.ts',
      })
    );
    const target = babel.babelParse(`
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

    const before = babel.generate(target).code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = babel.generate(target).code;

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  import { mergeConfig } from 'vite';
        import viteConfig from './vite.config';
        
      + import path from 'node:path';
      + import { fileURLToPath } from 'node:url';
      + import { defineConfig } from 'vitest/config';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
      + 
      + // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      + 
        export default mergeConfig(viteConfig, {
          plugins: [react()],
          test: {
        
      -     environment: 'jsdom'
      - 
      +     workspace: [{
      +       extends: true,
      +       test: {
      +         environment: 'jsdom'
      +       }
      +     }, {
      +       extends: true,
      +       plugins: [
      +       // The plugin will run tests for the stories defined in your Storybook config
      +       // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +       storybookTest({
      +         configDir: path.join(dirname, '.storybook')
      +       })],
      +       test: {
      +         name: 'storybook',
      +         browser: {
      +           enabled: true,
      +           headless: true,
      +           provider: 'playwright',
      +           instances: [{
      +             browser: 'chromium'
      +           }]
      +         },
      +         setupFiles: ['../.storybook/vitest.setup.ts']
      +       }
      +     }]
      + 
          }
        });"
    `);
  });

  it('supports mergeConfig without config containing test property', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.template.txt', {
        CONFIG_DIR: '.storybook',
        BROWSER_CONFIG: "{ provider: 'playwright' }",
        SETUP_FILE: '../.storybook/vitest.setup.ts',
      })
    );
    const target = babel.babelParse(`
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

    const before = babel.generate(target).code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = babel.generate(target).code;

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  import { mergeConfig } from 'vite';
        import { defineConfig } from 'vitest/config';
        import viteConfig from './vite.config';
        
      + import path from 'node:path';
      + import { fileURLToPath } from 'node:url';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
      + 
      + // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      + 
        export default mergeConfig(viteConfig, defineConfig({
        
      -   plugins: [react()]
      - 
      +   plugins: [react()],
      +   test: {
      +     workspace: [{
      +       extends: true,
      +       plugins: [
      +       // The plugin will run tests for the stories defined in your Storybook config
      +       // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +       storybookTest({
      +         configDir: path.join(dirname, '.storybook')
      +       })],
      +       test: {
      +         name: 'storybook',
      +         browser: {
      +           enabled: true,
      +           headless: true,
      +           provider: 'playwright',
      +           instances: [{
      +             browser: 'chromium'
      +           }]
      +         },
      +         setupFiles: ['../.storybook/vitest.setup.ts']
      +       }
      +     }]
      +   }
      + 
        }));"
    `);
  });

  it('supports mergeConfig with defineConfig pattern using projects (Vitest 3.2+)', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.3.2.template.txt', {
        CONFIG_DIR: '.storybook',
        BROWSER_CONFIG: "{ provider: 'playwright' }",
        SETUP_FILE: '../.storybook/vitest.setup.ts',
      })
    );
    const target = babel.babelParse(`
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

    const before = babel.generate(target).code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = babel.generate(target).code;

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  ...
        import viteConfig from './vite.config';
        
        // https://vite.dev/config/
        
      + import path from 'node:path';
      + import { fileURLToPath } from 'node:url';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
      + 
      + // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      + 
        export default mergeConfig(viteConfig, defineConfig({
          test: {
        
      -     globals: true
      - 
      +     projects: [{
      +       extends: true,
      +       test: {
      +         globals: true
      +       }
      +     }, {
      +       extends: true,
      +       plugins: [
      +       // The plugin will run tests for the stories defined in your Storybook config
      +       // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +       storybookTest({
      +         configDir: path.join(dirname, '.storybook')
      +       })],
      +       test: {
      +         name: 'storybook',
      +         browser: {
      +           enabled: true,
      +           headless: true,
      +           provider: 'playwright',
      +           instances: [{
      +             browser: 'chromium'
      +           }]
      +         },
      +         setupFiles: ['../.storybook/vitest.setup.ts']
      +       }
      +     }]
      + 
          }
        }));"
    `);
  });

  it('appends storybook project to existing test.projects array (no double nesting)', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.3.2.template.txt', {
        CONFIG_DIR: '.storybook',
        BROWSER_CONFIG: "{ provider: 'playwright' }",
        SETUP_FILE: '../.storybook/vitest.setup.ts',
      })
    );
    const target = babel.babelParse(`
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

    const before = babel.generate(target).code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = babel.generate(target).code;

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly (storybook project appended to existing projects, no double nesting)
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  import { mergeConfig, defineConfig } from 'vitest/config';
        import viteConfig from './vite.config';
        
      + import path from 'node:path';
      + import { fileURLToPath } from 'node:url';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
      + 
      + // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      + 
        export default mergeConfig(viteConfig, defineConfig({
          test: {
            expect: {
              requireAssertions: true
      ...
              test: {
                name: "server"
              }
        
      +     }, {
      +       extends: true,
      +       plugins: [
      +       // The plugin will run tests for the stories defined in your Storybook config
      +       // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +       storybookTest({
      +         configDir: path.join(dirname, '.storybook')
      +       })],
      +       test: {
      +         name: 'storybook',
      +         browser: {
      +           enabled: true,
      +           headless: true,
      +           provider: 'playwright',
      +           instances: [{
      +             browser: 'chromium'
      +           }]
      +         },
      +         setupFiles: ['../.storybook/vitest.setup.ts']
      +       }
      + 
            }]
          }
        }));"
    `);
  });

  it('extracts coverage config and keeps it at top level when using workspace', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.template.txt', {
        CONFIG_DIR: '.storybook',
        BROWSER_CONFIG: "{ provider: 'playwright' }",
        SETUP_FILE: '../.storybook/vitest.setup.ts',
      })
    );
    const target = babel.babelParse(`
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

    const before = babel.generate(target).code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = babel.generate(target).code;

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    // Coverage should stay at the top level, not moved into the workspace
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  import { mergeConfig, defineConfig } from 'vitest/config';
        import viteConfig from './vite.config';
        
      + import path from 'node:path';
      + import { fileURLToPath } from 'node:url';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
      + 
      + // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      + 
        export default mergeConfig(viteConfig, defineConfig({
          test: {
        
      -     name: 'node',
      -     environment: 'happy-dom',
      -     include: ['**/*.test.ts'],
      - 
            coverage: {
              exclude: ['storybook.setup.ts', '**/*.stories.*']
        
      -     }
      - 
      +     },
      +     workspace: [{
      +       extends: true,
      +       test: {
      +         name: 'node',
      +         environment: 'happy-dom',
      +         include: ['**/*.test.ts']
      +       }
      +     }, {
      +       extends: true,
      +       plugins: [
      +       // The plugin will run tests for the stories defined in your Storybook config
      +       // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +       storybookTest({
      +         configDir: path.join(dirname, '.storybook')
      +       })],
      +       test: {
      +         name: 'storybook',
      +         browser: {
      +           enabled: true,
      +           headless: true,
      +           provider: 'playwright',
      +           instances: [{
      +             browser: 'chromium'
      +           }]
      +         },
      +         setupFiles: ['../.storybook/vitest.setup.ts']
      +       }
      +     }]
      + 
          }
        }));"
    `);
  });

  it('extracts coverage config and keeps it at top level when using projects', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.3.2.template.txt', {
        CONFIG_DIR: '.storybook',
        BROWSER_CONFIG: "{ provider: 'playwright' }",
        SETUP_FILE: '../.storybook/vitest.setup.ts',
      })
    );
    const target = babel.babelParse(`
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

    const before = babel.generate(target).code;
    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const after = babel.generate(target).code;

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    // Coverage should stay at the top level, not moved into the projects
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  import { mergeConfig, defineConfig } from 'vitest/config';
        import viteConfig from './vite.config';
        
      + import path from 'node:path';
      + import { fileURLToPath } from 'node:url';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
      + 
      + // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      + 
        export default mergeConfig(viteConfig, defineConfig({
          test: {
        
      -     name: 'node',
      -     environment: 'happy-dom',
      -     include: ['**/*.test.ts'],
      - 
            coverage: {
              exclude: ['storybook.setup.ts', '**/*.stories.*']
        
      -     }
      - 
      +     },
      +     projects: [{
      +       extends: true,
      +       test: {
      +         name: 'node',
      +         environment: 'happy-dom',
      +         include: ['**/*.test.ts']
      +       }
      +     }, {
      +       extends: true,
      +       plugins: [
      +       // The plugin will run tests for the stories defined in your Storybook config
      +       // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +       storybookTest({
      +         configDir: path.join(dirname, '.storybook')
      +       })],
      +       test: {
      +         name: 'storybook',
      +         browser: {
      +           enabled: true,
      +           headless: true,
      +           provider: 'playwright',
      +           instances: [{
      +             browser: 'chromium'
      +           }]
      +         },
      +         setupFiles: ['../.storybook/vitest.setup.ts']
      +       }
      +     }]
      + 
          }
        }));"
    `);
  });
});

describe('updateWorkspaceFile', () => {
  it('updates vitest workspace file using array syntax', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.workspace.template.txt', {
        EXTENDS_WORKSPACE: '',
        CONFIG_DIR: '.storybook',
        BROWSER_CONFIG: "{ provider: 'playwright' }",
        SETUP_FILE: '../.storybook/vitest.setup.ts',
      })
    );
    const target = babel.babelParse(`
      export default ['packages/*']
    `);

    const before = babel.generate(target).code;
    const updated = updateWorkspaceFile(source, target);
    expect(updated).toBe(true);

    const after = babel.generate(target).code;

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "- export default ['packages/*'];
      + import path from 'node:path';
      + import { fileURLToPath } from 'node:url';
      + import { defineWorkspace } from 'vitest/config';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
      + 
      + // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      + export default ['packages/*', 'ROOT_CONFIG', {
      +   extends: '.',
      +   plugins: [
      +   // The plugin will run tests for the stories defined in your Storybook config
      +   // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +   storybookTest({
      +     configDir: path.join(dirname, '.storybook')
      +   })],
      +   test: {
      +     name: 'storybook',
      +     browser: {
      +       enabled: true,
      +       headless: true,
      +       provider: 'playwright',
      +       instances: [{
      +         browser: 'chromium'
      +       }]
      +     },
      +     setupFiles: ['../.storybook/vitest.setup.ts']
      +   }
      + }];"
    `);
  });

  it('updates vitest workspace file using defineWorkspace syntax', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.workspace.template.txt', {
        EXTENDS_WORKSPACE: '',
        CONFIG_DIR: '.storybook',
        BROWSER_CONFIG: "{ provider: 'playwright' }",
        SETUP_FILE: '../.storybook/vitest.setup.ts',
      })
    );
    const target = babel.babelParse(`
      import { defineWorkspace } from 'vitest/config'

      export default defineWorkspace(['packages/*'])
    `);

    const before = babel.generate(target).code;
    const updated = updateWorkspaceFile(source, target);
    expect(updated).toBe(true);

    const after = babel.generate(target).code;

    // check if the code was updated at all
    expect(after).not.toBe(before);

    // check if the code was updated correctly
    expect(getDiff(before, after)).toMatchInlineSnapshot(`
      "  import { defineWorkspace } from 'vitest/config';
        
      - export default defineWorkspace(['packages/*']);
      + import path from 'node:path';
      + import { fileURLToPath } from 'node:url';
      + import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      + const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
      + 
      + // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      + export default defineWorkspace(['packages/*', 'ROOT_CONFIG', {
      +   extends: '.',
      +   plugins: [
      +   // The plugin will run tests for the stories defined in your Storybook config
      +   // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      +   storybookTest({
      +     configDir: path.join(dirname, '.storybook')
      +   })],
      +   test: {
      +     name: 'storybook',
      +     browser: {
      +       enabled: true,
      +       headless: true,
      +       provider: 'playwright',
      +       instances: [{
      +         browser: 'chromium'
      +       }]
      +     },
      +     setupFiles: ['../.storybook/vitest.setup.ts']
      +   }
      + }]);"
    `);
  });
});

describe('loadTemplate', () => {
  it('normalizes Windows paths to forward slashes', async () => {
    // Windows-style path with backslashes (need to escape them in JS strings)
    const windowsPath = '.\\apps\\frontend-storybook\\.storybook';

    const result = await loadTemplate('vitest.config.template.txt', {
      CONFIG_DIR: windowsPath,
      SETUP_FILE: '.\\apps\\frontend-storybook\\.storybook\\vitest.setup.ts',
    });

    // Should contain forward slashes, not backslashes
    expect(result).toContain('apps/frontend-storybook/.storybook');
    expect(result).not.toContain('\\apps\\');
  });

  it('preserves forward slashes in paths', async () => {
    // Unix-style path with forward slashes
    const unixPath = './apps/frontend-storybook/.storybook';

    const result = await loadTemplate('vitest.config.template.txt', {
      CONFIG_DIR: unixPath,
      SETUP_FILE: './apps/frontend-storybook/.storybook/vitest.setup.ts',
    });

    // Should still contain forward slashes
    expect(result).toContain('apps/frontend-storybook/.storybook');
  });
});

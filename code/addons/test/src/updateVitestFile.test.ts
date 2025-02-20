import { describe, expect, it } from 'vitest';

import * as babel from 'storybook/internal/babel';

import { loadTemplate, updateConfigFile, updateWorkspaceFile } from './updateVitestFile';

describe('updateConfigFile', () => {
  it('updates vite config file', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.template.ts', {
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

    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const { code } = babel.generate(target);
    expect(code).toMatchInlineSnapshot(`
      "/// <reference types="vitest/config" />
      import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';

      // https://vite.dev/config/
      import path from 'node:path';
      import { fileURLToPath } from 'node:url';
      import { storybookTest } from '@storybook/experimental-addon-test/vitest-plugin';
      const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

      // More info at: https://storybook.js.org/docs/writing-tests/test-addon
      export default defineConfig({
        plugins: [react()],
        test: {
          globals: true,
          workspace: ['packages/*', {
            extends: true,
            plugins: [
            // The plugin will run tests for the stories defined in your Storybook config
            // See options at: https://storybook.js.org/docs/writing-tests/test-addon#storybooktest
            storybookTest({
              configDir: path.join(dirname, '.storybook')
            })],
            test: {
              name: 'storybook',
              browser: {
                provider: 'playwright'
              },
              setupFiles: ['../.storybook/vitest.setup.ts']
            }
          }]
        }
      });"
    `);
  });

  it('supports object notation without defineConfig', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.template.ts', {
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

    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const { code } = babel.generate(target);
    expect(code).toMatchInlineSnapshot(`
      "/// <reference types="vitest/config" />
      import react from '@vitejs/plugin-react';

      // https://vite.dev/config/
      import path from 'node:path';
      import { fileURLToPath } from 'node:url';
      import { defineConfig } from 'vitest/config';
      import { storybookTest } from '@storybook/experimental-addon-test/vitest-plugin';
      const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

      // More info at: https://storybook.js.org/docs/writing-tests/test-addon
      export default {
        plugins: [react()],
        test: {
          globals: true,
          workspace: ['packages/*', {
            extends: true,
            plugins: [
            // The plugin will run tests for the stories defined in your Storybook config
            // See options at: https://storybook.js.org/docs/writing-tests/test-addon#storybooktest
            storybookTest({
              configDir: path.join(dirname, '.storybook')
            })],
            test: {
              name: 'storybook',
              browser: {
                provider: 'playwright'
              },
              setupFiles: ['../.storybook/vitest.setup.ts']
            }
          }]
        }
      };"
    `);
  });

  it('does not support function notation', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.template.ts', {
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

    const updated = updateConfigFile(source, target);
    expect(updated).toBe(false);
  });

  it('adds workspace property to test config', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.template.ts', {
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

    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const { code } = babel.generate(target);
    expect(code).toMatchInlineSnapshot(`
      "/// <reference types="vitest/config" />
      import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';

      // https://vite.dev/config/
      import path from 'node:path';
      import { fileURLToPath } from 'node:url';
      import { storybookTest } from '@storybook/experimental-addon-test/vitest-plugin';
      const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

      // More info at: https://storybook.js.org/docs/writing-tests/test-addon
      export default defineConfig({
        plugins: [react()],
        test: {
          globals: true,
          workspace: [{
            extends: true,
            plugins: [
            // The plugin will run tests for the stories defined in your Storybook config
            // See options at: https://storybook.js.org/docs/writing-tests/test-addon#storybooktest
            storybookTest({
              configDir: path.join(dirname, '.storybook')
            })],
            test: {
              name: 'storybook',
              browser: {
                provider: 'playwright'
              },
              setupFiles: ['../.storybook/vitest.setup.ts']
            }
          }]
        }
      });"
    `);
  });

  it('adds test property to vite config', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.config.template.ts', {
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

    const updated = updateConfigFile(source, target);
    expect(updated).toBe(true);

    const { code } = babel.generate(target);
    expect(code).toMatchInlineSnapshot(`
      "/// <reference types="vitest/config" />
      import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';

      // https://vite.dev/config/
      import path from 'node:path';
      import { fileURLToPath } from 'node:url';
      import { storybookTest } from '@storybook/experimental-addon-test/vitest-plugin';
      const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

      // More info at: https://storybook.js.org/docs/writing-tests/test-addon
      export default defineConfig({
        plugins: [react()],
        test: {
          workspace: [{
            extends: true,
            plugins: [
            // The plugin will run tests for the stories defined in your Storybook config
            // See options at: https://storybook.js.org/docs/writing-tests/test-addon#storybooktest
            storybookTest({
              configDir: path.join(dirname, '.storybook')
            })],
            test: {
              name: 'storybook',
              browser: {
                provider: 'playwright'
              },
              setupFiles: ['../.storybook/vitest.setup.ts']
            }
          }]
        }
      });"
    `);
  });
});

describe('updateWorkspaceFile', () => {
  it('updates vitest workspace file using array syntax', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.workspace.template.ts', {
        EXTENDS_WORKSPACE: '',
        CONFIG_DIR: '.storybook',
        BROWSER_CONFIG: "{ provider: 'playwright' }",
        SETUP_FILE: '../.storybook/vitest.setup.ts',
      })
    );
    const target = babel.babelParse(`
      export default ['packages/*']
    `);

    const updated = updateWorkspaceFile(source, target);
    expect(updated).toBe(true);

    const { code } = babel.generate(target);
    expect(code).toMatchInlineSnapshot(`
      "import path from 'node:path';
      import { fileURLToPath } from 'node:url';
      import { defineWorkspace } from 'vitest/config';
      import { storybookTest } from '@storybook/experimental-addon-test/vitest-plugin';
      const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

      // More info at: https://storybook.js.org/docs/writing-tests/test-addon
      export default ['packages/*', 'ROOT_CONFIG', {
        extends: '',
        plugins: [
        // The plugin will run tests for the stories defined in your Storybook config
        // See options at: https://storybook.js.org/docs/writing-tests/test-addon#storybooktest
        storybookTest({
          configDir: path.join(dirname, '.storybook')
        })],
        test: {
          name: 'storybook',
          browser: {
            provider: 'playwright'
          },
          setupFiles: ['../.storybook/vitest.setup.ts']
        }
      }];"
    `);
  });

  it('updates vitest workspace file using defineWorkspace syntax', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.workspace.template.ts', {
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

    const updated = updateWorkspaceFile(source, target);
    expect(updated).toBe(true);

    const { code } = babel.generate(target);
    expect(code).toMatchInlineSnapshot(`
      "import { defineWorkspace } from 'vitest/config';
      import path from 'node:path';
      import { fileURLToPath } from 'node:url';
      import { storybookTest } from '@storybook/experimental-addon-test/vitest-plugin';
      const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

      // More info at: https://storybook.js.org/docs/writing-tests/test-addon
      export default defineWorkspace(['packages/*', 'ROOT_CONFIG', {
        extends: '',
        plugins: [
        // The plugin will run tests for the stories defined in your Storybook config
        // See options at: https://storybook.js.org/docs/writing-tests/test-addon#storybooktest
        storybookTest({
          configDir: path.join(dirname, '.storybook')
        })],
        test: {
          name: 'storybook',
          browser: {
            provider: 'playwright'
          },
          setupFiles: ['../.storybook/vitest.setup.ts']
        }
      }]);"
    `);
  });
});

import { describe, expect, it } from 'vitest';

import { SourceEditor } from 'storybook/internal/csf-tools';

import { dedent } from 'ts-dedent';

import { loadTemplate, updateConfigFile } from './updateVitestFile.ts';

const template = dedent`
  import { fileURLToPath } from 'node:url';
  import { dirname } from 'node:path';
  // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
  const dirname = fileURLToPath(new URL('.', import.meta.url));

  export default defineConfig({
    test: {
      projects: [{ extends: true, test: { name: 'storybook' } }],
    },
  });
`;

const realTemplate = () => loadTemplate('vitest.config.4.template', { CONFIG_DIR: '.storybook' });

const update = (code: string) => {
  const target = new SourceEditor(code);
  expect(updateConfigFile(template, target)).toBe(true);
  const result = target.toString();
  expect(() => new SourceEditor(result)).not.toThrow();
  return result;
};

describe('updateConfigFile statements', () => {
  it('inserts the template statements before a statement sharing the last import line', () => {
    const code = update(
      `import react from '@vitejs/plugin-react'; const x = 1\nexport default defineConfig({ test: {} })\n`
    );

    expect(code).toMatchInlineSnapshot(`
      "import react from '@vitejs/plugin-react';
      import { fileURLToPath } from 'node:url';
      import { dirname } from 'node:path';
      // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      const dirname = fileURLToPath(new URL('.', import.meta.url));
      const x = 1
      export default defineConfig({ test: {
        projects: [{
      extends: true,
      test: {},
      }, { extends: true, test: { name: 'storybook' } }],
      } })
      "
    `);
  });

  it('inserts the template statements before export default on the last import line', () => {
    const code = update(
      `import react from '@vitejs/plugin-react'; export default defineConfig({ test: {} })`
    );

    expect(code.indexOf('const dirname')).toBeLessThan(code.indexOf('export default'));
    expect(code).toMatchInlineSnapshot(`
      "import react from '@vitejs/plugin-react';
      import { fileURLToPath } from 'node:url';
      import { dirname } from 'node:path';
      // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      const dirname = fileURLToPath(new URL('.', import.meta.url));
      export default defineConfig({ test: {
        projects: [{
      extends: true,
      test: {},
      }, { extends: true, test: { name: 'storybook' } }],
      } })"
    `);
  });

  it('inserts the template statements after a block comment starting on the last import line', () => {
    const code = update(
      `import react from '@vitejs/plugin-react'; /* a\n b */\nexport default defineConfig({ test: {} })\n`
    );

    expect(code).toMatchInlineSnapshot(`
      "import react from '@vitejs/plugin-react'; /* a
       b */
      import { fileURLToPath } from 'node:url';
      import { dirname } from 'node:path';
      // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      const dirname = fileURLToPath(new URL('.', import.meta.url));
      export default defineConfig({ test: {
        projects: [{
      extends: true,
      test: {},
      }, { extends: true, test: { name: 'storybook' } }],
      } })
      "
    `);
  });

  it('inserts the template statements above a JSDoc block starting on the last import line', () => {
    const code = update(
      `import react from '@vitejs/plugin-react'; /**\n * Config\n */\nexport default defineConfig({ test: {} })\n`
    );

    expect(code).toMatchInlineSnapshot(`
      "import react from '@vitejs/plugin-react';
      import { fileURLToPath } from 'node:url';
      import { dirname } from 'node:path';
      // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      const dirname = fileURLToPath(new URL('.', import.meta.url));
      /**
       * Config
       */
      export default defineConfig({ test: {
        projects: [{
      extends: true,
      test: {},
      }, { extends: true, test: { name: 'storybook' } }],
      } })
      "
    `);
  });

  it('keeps a line comment trailing the last import in place', () => {
    const code = update(
      `import react from '@vitejs/plugin-react' // plugins\nexport default defineConfig({ test: {} })\n`
    );

    expect(code).toMatchInlineSnapshot(`
      "import react from '@vitejs/plugin-react' // plugins
      import { fileURLToPath } from 'node:url';
      import { dirname } from 'node:path';
      // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      const dirname = fileURLToPath(new URL('.', import.meta.url));
      export default defineConfig({ test: {
        projects: [{
      extends: true,
      test: {},
      }, { extends: true, test: { name: 'storybook' } }],
      } })
      "
    `);
  });

  it('appends the template statements when the last import ends the file', () => {
    const code = update(`export default defineConfig({ test: {} })\nimport react from 'x'`);

    expect(code).toMatchInlineSnapshot(`
      "export default defineConfig({ test: {
        projects: [{
      extends: true,
      test: {},
      }, { extends: true, test: { name: 'storybook' } }],
      } })
      import react from 'x'
      import { fileURLToPath } from 'node:url';
      import { dirname } from 'node:path';
      // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
      const dirname = fileURLToPath(new URL('.', import.meta.url));
      "
    `);
  });

  it('keeps CRLF line endings', () => {
    const code = update(
      `import react from '@vitejs/plugin-react';\r\nexport default defineConfig({ test: {} });\r\n`
    );

    expect(code).toContain('const dirname');
    expect(code.replaceAll('\r\n', '')).not.toContain('\n');
  });

  it.each([
    ['imports', `import { dirname, resolve } from 'node:path';`],
    ['requires', `const { dirname } = require('path');`],
  ])('keeps a dirname function the config %s', async (_, binding) => {
    const target = new SourceEditor(dedent`
      ${binding}
      export default defineConfig({ test: {} });
    `);

    expect(updateConfigFile(await realTemplate(), target)).toBe(true);
    const code = target.toString();
    expect(code).toContain(binding);
    expect(code).toContain("import path from 'node:path';");
    expect(code).toContain(
      "storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') })"
    );
    expect(() => new SourceEditor(code)).not.toThrow();
  });

  it('reuses a namespace import of path', async () => {
    const target = new SourceEditor(dedent`
      import * as path from 'path';
      export default defineConfig({ test: {} });
    `);

    expect(updateConfigFile(await realTemplate(), target)).toBe(true);
    const code = target.toString();
    expect(code.match(/^import .* from '(node:)?path';$/gm)).toEqual([
      "import * as path from 'path';",
    ]);
    expect(code).toContain("path.join(import.meta.dirname, '.storybook')");
  });

  it('adds the path import next to named imports from node:path', async () => {
    const target = new SourceEditor(dedent`
      import { join } from 'node:path';
      export default defineConfig({ test: { setupFiles: [join('src', 'setup.ts')] } });
    `);

    expect(updateConfigFile(await realTemplate(), target)).toBe(true);
    const code = target.toString();
    expect(code).toContain("import { join } from 'node:path';\nimport path from 'node:path';");
    expect(code).toContain("setupFiles: [join('src', 'setup.ts')]");
    expect(() => new SourceEditor(code)).not.toThrow();
  });

  it('does not import a template name the config declares and the merge does not read', async () => {
    const target = new SourceEditor(dedent`
      function defineConfig(config) { return config; }
      export default defineConfig({ test: {} });
    `);

    expect(updateConfigFile(await realTemplate(), target)).toBe(true);
    expect(target.toString()).not.toContain('import { defineConfig }');
  });

  it.each([
    ['imports path from another module', `import path from './custom-path';`],
    ['requires path', `const path = require('path');`],
    ['declares path as a class', `class path {}`],
    ['imports playwright as a default', `import playwright from '@vitest/browser-playwright';`],
  ])('leaves a config that %s unchanged', async (_, binding) => {
    const code = dedent`
      ${binding}
      export default defineConfig({ test: {} });
    `;
    const target = new SourceEditor(code);

    expect(updateConfigFile(await realTemplate(), target)).toBe(false);
    expect(target.toString()).toBe(code);
  });

  it('leaves a config whose function parameter shadows a template import unchanged', async () => {
    const code = dedent`
      import path from 'node:path';
      export default defineConfig((path) => ({ test: {} }));
    `;
    const target = new SourceEditor(code);

    expect(updateConfigFile(await realTemplate(), target)).toBe(false);
    expect(target.toString()).toBe(code);
  });

  it('leaves a CommonJS config unchanged', async () => {
    const code = dedent`
      const { defineConfig } = require('vite');
      module.exports = defineConfig({ test: {} });
    `;
    const target = new SourceEditor(code, 'vite.config.cjs');

    expect(updateConfigFile(await realTemplate(), target)).toBe(false);
    expect(target.toString()).toBe(code);
  });

  it('merges an ESM config that already imports path into valid code', async () => {
    const target = new SourceEditor(
      dedent`
        import path from 'node:path';
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';

        export default defineConfig({
          plugins: [react()],
          resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
          test: { environment: 'jsdom' },
        });
      `,
      'vite.config.mts'
    );

    expect(updateConfigFile(await realTemplate(), target)).toBe(true);
    const code = target.toString();
    expect(() => new SourceEditor(code, 'vite.config.mts')).not.toThrow();
    expect(code).toMatchInlineSnapshot(`
      "import path from 'node:path';
      import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';
      import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      import { playwright } from '@vitest/browser-playwright';

      // More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon

      export default defineConfig({
        plugins: [react()],
        resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
        test: {
          projects: [
            {
              extends: true,
              test: {
                environment: 'jsdom',
              },
            },
            {
              extends: true,
              plugins: [
                // The plugin will run tests for the stories defined in your Storybook config
                // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
                storybookTest({ configDir: path.join(import.meta.dirname, '.storybook') }),
              ],
              test: {
                name: 'storybook',
                browser: {
                  enabled: true,
                  headless: true,
                  provider: playwright({}),
                  instances: [{ browser: 'chromium' }],
                },
              },
            },
          ],
        },
      });"
    `);
  });
});

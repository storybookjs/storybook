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

  it('does not declare a name the config already declares as a function or class', () => {
    const target = new SourceEditor(dedent`
      function fileURLToPath() {}
      class dirname {}
      export default defineConfig({ test: {} });
    `);

    expect(updateConfigFile(template, target)).toBe(true);
    const code = target.toString();
    expect(code).not.toContain('import { fileURLToPath }');
    expect(code).not.toContain('import { dirname }');
    expect(code).not.toContain('const dirname');
    expect(() => new SourceEditor(code)).not.toThrow();
  });

  it.each([
    ['imports', `import { dirname, resolve } from 'node:path';`],
    ['requires', `const { dirname } = require('path');`],
  ])('renames the template dirname when the config %s a dirname function', async (_, binding) => {
    const target = new SourceEditor(dedent`
      ${binding}
      import { fileURLToPath } from 'url';
      export default defineConfig({ test: {} });
    `);
    const realTemplate = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
    });

    expect(updateConfigFile(realTemplate, target)).toBe(true);
    const code = target.toString();
    expect(code).toContain(binding);
    expect(code).toContain(
      'const storybookDirname =\n' +
        "  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));"
    );
    expect(code).toContain(
      "storybookTest({ configDir: path.join(storybookDirname, '.storybook') })"
    );
    expect(code).not.toContain("import { fileURLToPath } from 'node:url'");
    expect(code.match(/(?<!\.)\bdirname\b/g)).toHaveLength(1);
    expect(() => new SourceEditor(code)).not.toThrow();
  });

  it('renames an import the config binds to another module', async () => {
    const target = new SourceEditor(dedent`
      import path from './path-helpers';
      export default defineConfig({ test: {} });
    `);
    const realTemplate = await loadTemplate('vitest.config.4.template', {
      CONFIG_DIR: '.storybook',
    });

    expect(updateConfigFile(realTemplate, target)).toBe(true);
    const code = target.toString();
    expect(code).toContain("import storybookPath from 'node:path';");
    expect(code).toContain('storybookPath.dirname(fileURLToPath(import.meta.url))');
    expect(code).toContain('storybookPath.join(dirname, ');
    expect(() => new SourceEditor(code)).not.toThrow();
  });
});

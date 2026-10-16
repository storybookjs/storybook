import { describe, expect, it } from 'vitest';

import { SourceEditor } from 'storybook/internal/csf-tools';

import { dedent } from 'ts-dedent';

import { updateConfigFile } from './updateVitestFile.ts';

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

describe('updateConfigFile statements', () => {
  it('inserts the template statements on their own lines after the last import', () => {
    const target = new SourceEditor(
      `import react from '@vitejs/plugin-react'; const x = 1\nexport default defineConfig({ test: {} })\n`
    );

    expect(updateConfigFile(template, target)).toBe(true);

    const code = target.toString();
    expect(code).toMatch(/^import react from '@vitejs\/plugin-react'; const x = 1$/m);
    expect(code).toMatch(/^\/\/ More info at: .*\nconst dirname = /m);
    expect(() => new SourceEditor(code)).not.toThrow();
  });

  it('does not declare a name the config already imports', () => {
    const target = new SourceEditor(dedent`
      import { dirname } from 'node:path';
      import { fileURLToPath } from 'node:url';
      export default defineConfig({ test: {} });
    `);

    expect(updateConfigFile(template, target)).toBe(true);
    expect(target.toString()).not.toContain('const dirname');
    expect(() => new SourceEditor(target.toString())).not.toThrow();
  });
});

import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import * as babel from 'storybook/internal/babel';

import { getDiff } from '../../../core/src/core-server/utils/save-story/getDiff';
import { loadTemplate, updateWorkspaceFile } from './updateVitestFile';

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

describe('updateWorkspaceFile', () => {
  it('updates vitest workspace file using array syntax', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.workspace.template', {
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
      +     }
      +   }
      + }];"
    `);
  });

  it('updates vitest workspace file using defineWorkspace syntax', async () => {
    const source = babel.babelParse(
      await loadTemplate('vitest.workspace.template', {
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
      +     }
      +   }
      + }]);"
    `);
  });
});

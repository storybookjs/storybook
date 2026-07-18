import { describe, expect, it, vi } from 'vitest';

import type { types as t } from 'storybook/internal/babel';
import { babelParse, generate, traverse } from 'storybook/internal/babel';

import {
  ANGULAR_VITEST_PLUGIN_CALL,
  injectAngularVitestIntoAst,
  injectAngularVitestIntoConfig,
} from './angular-vitest-postinstall.ts';
import { getTemplateConfigDir, isConfigAlreadySetup } from './postinstall.ts';
import { loadTemplate, updateConfigFile } from './updateVitestFile.ts';

vi.mock('storybook/internal/node-logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/**
 * Returns the callee names of the plugins array that holds the (possibly aliased) storybookTest
 * call, in source order. Asserts co-location: the Angular bridge must sit in the SAME array.
 */
function pluginCalleesInSameArray(code: string, locatorName = 'storybookTest'): string[] | null {
  const ast = babelParse(code);
  let elements: string[] | null = null;
  traverse(ast, {
    CallExpression(path) {
      if (elements) {
        path.stop();
        return;
      }
      const { callee } = path.node;
      if (
        callee.type === 'Identifier' &&
        callee.name === locatorName &&
        path.parentPath.isArrayExpression()
      ) {
        elements = (path.parentPath.node as t.ArrayExpression).elements.map((el) =>
          el?.type === 'CallExpression' && el.callee.type === 'Identifier'
            ? el.callee.name
            : 'other'
        );
        path.stop();
      }
    },
  });
  return elements;
}

describe('getTemplateConfigDir', () => {
  it('returns the config dir relative to the generated config file directory', () => {
    // Both inputs are cwd-relative, so the result is independent of the test cwd.
    expect(getTemplateConfigDir('vitest.config.ts', '.storybook')).toBe('.storybook');
  });

  it('does not double the path when the config file lives in a monorepo subproject', () => {
    // `storybook add --config-dir apps/x/.storybook` run from the repo root, with the
    // new vitest.config.ts created inside apps/x.
    expect(getTemplateConfigDir('apps/x/vitest.config.ts', 'apps/x/.storybook')).toBe('.storybook');
  });

  it('keeps a relative climb when the config dir is above the config file', () => {
    expect(getTemplateConfigDir('apps/x/vitest.config.ts', '.storybook')).toBe('../../.storybook');
  });

  it('supports a custom config dir name', () => {
    expect(getTemplateConfigDir('apps/x/vitest.config.ts', 'apps/x/sb-config')).toBe('sb-config');
  });
});

describe('postinstall helpers', () => {
  it('detects a fully configured Vitest config with addon plugin', () => {
    const config = `
      import { defineConfig } from 'vitest/config';
      import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

      export default defineConfig({
        test: {
          projects: [
            {
              extends: true,
              plugins: [storybookTest({ configDir: '.storybook' })],
            },
          ],
        },
      });
    `;

    expect(isConfigAlreadySetup('/project/vitest.config.ts', config)).toBe(true);
  });

  it('returns false when storybookTest plugin is not used', () => {
    const config = `
      import { defineConfig } from 'vitest/config';

      export default defineConfig({
        test: {
          projects: [
            {
              extends: true,
            },
          ],
        },
      });
    `;

    expect(isConfigAlreadySetup('/project/vitest.config.ts', config)).toBe(false);
  });
});

describe('Angular bridge wiring (postinstall integration)', () => {
  it('fresh-create v4: co-locates the bridge in the template plugins array (case 5)', async () => {
    const template = await loadTemplate('vitest.config.4.template', { CONFIG_DIR: '.storybook' });
    const out = injectAngularVitestIntoConfig(template);
    expect(out).not.toBeNull();
    expect(pluginCalleesInSameArray(out!)).toEqual([ANGULAR_VITEST_PLUGIN_CALL, 'storybookTest']);
    // Template comment survives the reprint (probe-locked path).
    expect(out).toContain('The plugin will run tests for the stories');
  });

  it('fresh-create v3.2: co-locates the bridge in the template plugins array (case 5)', async () => {
    const template = await loadTemplate('vitest.config.3.2.template', { CONFIG_DIR: '.storybook' });
    const out = injectAngularVitestIntoConfig(template);
    expect(out).not.toBeNull();
    expect(pluginCalleesInSameArray(out!)).toEqual([ANGULAR_VITEST_PLUGIN_CALL, 'storybookTest']);
  });

  it('fresh-create base: co-locates the bridge in the template plugins array (case 5)', async () => {
    const template = await loadTemplate('vitest.config.template', { CONFIG_DIR: '.storybook' });
    const out = injectAngularVitestIntoConfig(template);
    expect(out).not.toBeNull();
    expect(pluginCalleesInSameArray(out!)).toEqual([ANGULAR_VITEST_PLUGIN_CALL, 'storybookTest']);
  });

  it('existing-config sequencing: merge storybookTest, then co-locate the bridge (case 4)', async () => {
    // Mirrors postinstall's existing-config branch: updateConfigFile merges the template into the
    // user's vite config, then injectAngularVitestIntoAst runs on the SAME (merged) target.
    const source = babelParse(
      await loadTemplate('vitest.config.4.template', { CONFIG_DIR: '.storybook' })
    );
    const target = babelParse(`
      import { defineConfig } from 'vite'
      import react from '@vitejs/plugin-react'
      export default defineConfig({
        plugins: [react()],
        test: { globals: true },
      })
    `);

    expect(updateConfigFile(source, target)).toBe(true);
    expect(injectAngularVitestIntoAst(target)).toBe(true);

    const after = generate(target).code;
    expect(pluginCalleesInSameArray(after)).toEqual([ANGULAR_VITEST_PLUGIN_CALL, 'storybookTest']);
    // The bridge must NOT be deposited as a top-level plugins sibling (react stays alone).
    expect(pluginCalleesInSameArray(after, 'react')).toEqual(['react']);
  });

  it('arrow-function config: merges storybookTest and co-locates the bridge (case 4)', async () => {
    // Function-notation configs (e.g. `defineConfig(() => ({ ... }))`) are now
    // supported by updateConfigFile, so the merge succeeds and the Angular bridge
    // co-locates with storybookTest in the same plugins array.
    const source = babelParse(
      await loadTemplate('vitest.config.4.template', { CONFIG_DIR: '.storybook' })
    );
    const target = babelParse(`
      import { defineConfig } from 'vite'
      export default defineConfig(() => ({ test: { globals: true } }))
    `);
    expect(updateConfigFile(source, target)).toBe(true);
    expect(injectAngularVitestIntoAst(target)).toBe(true);
    expect(pluginCalleesInSameArray(generate(target).code)).toEqual([
      ANGULAR_VITEST_PLUGIN_CALL,
      'storybookTest',
    ]);
  });

  it('early-return-safe: storybookTest present but bridge absent still injects (case 9)', () => {
    // Simulates the alreadyConfigured fall-through: storybookTest is wired, Angular is not.
    const existing = `
      import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      export default {
        test: { projects: [{ extends: true, plugins: [storybookTest({ configDir: '.storybook' })] }] },
      };
    `;
    const out = injectAngularVitestIntoConfig(existing);
    expect(out).not.toBeNull();
    expect(pluginCalleesInSameArray(out!)).toEqual([ANGULAR_VITEST_PLUGIN_CALL, 'storybookTest']);
  });

  it('non-Angular is unaffected: injector is never invoked, config has no bridge (case 11)', () => {
    // The postinstall gate (info.framework === ANGULAR_VITE) is what skips the injector for
    // react-vite; the injector itself only acts when explicitly called. This documents that a
    // react-vite fresh-create config contains no Angular references.
    const reactConfig = `
      import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      export default { test: { projects: [{ plugins: [storybookTest({})] }] } };
    `;
    expect(reactConfig).not.toContain(ANGULAR_VITEST_PLUGIN_CALL);
  });
});

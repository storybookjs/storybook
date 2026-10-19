import { describe, expect, it } from 'vitest';

import type { types as t } from 'storybook/internal/babel';
import { babelParse, generate, traverse } from 'storybook/internal/babel';

import {
  ANGULAR_VITEST_IMPORT_SOURCE,
  ANGULAR_VITEST_PLUGIN_CALL,
  collectStorybookTestLocalNames,
  injectAngularVitestIntoAst,
  injectAngularVitestIntoConfig,
  isAngularVitestAlreadyWired,
} from './angular-vitest-postinstall.ts';

/** Returns the names of the elements (call callees / spread) inside the plugins array, in order. */
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
        const array = path.parentPath.node as t.ArrayExpression;
        elements = array.elements.map((el) => {
          if (el?.type === 'CallExpression' && el.callee.type === 'Identifier') {
            return el.callee.name;
          }
          if (el?.type === 'SpreadElement') {
            return 'spread';
          }
          return el?.type ?? 'null';
        });
        path.stop();
      }
    },
  });
  return elements;
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const FRESH_V4 = `
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          storybookTest({ configDir: path.join(__dirname, '.storybook') }),
        ],
        test: { name: 'storybook' },
      },
    ],
  },
});
`;

describe('isAngularVitestAlreadyWired', () => {
  it('is false on a plain storybookTest config', () => {
    expect(isAngularVitestAlreadyWired(FRESH_V4)).toBe(false);
  });

  it('is true when the import source is present', () => {
    expect(
      isAngularVitestAlreadyWired(
        `import { storybookAngularVitest } from '${ANGULAR_VITEST_IMPORT_SOURCE}';`
      )
    ).toBe(true);
  });

  it('is true when only the call is present (partial wiring)', () => {
    expect(
      isAngularVitestAlreadyWired('plugins: [storybookAngularVitest({}), storybookTest({})]')
    ).toBe(true);
  });
});

describe('collectStorybookTestLocalNames', () => {
  it('always seeds the bare storybookTest name', () => {
    const names = collectStorybookTestLocalNames(babelParse('export default {};'));
    expect(names.has('storybookTest')).toBe(true);
  });

  it('collects aliased import names', () => {
    const names = collectStorybookTestLocalNames(
      babelParse(`import { storybookTest as sbTest } from '@storybook/addon-vitest/vitest-plugin';`)
    );
    expect(names.has('sbTest')).toBe(true);
    expect(names.has('storybookTest')).toBe(true);
  });

  it('ignores imports from other sources', () => {
    const names = collectStorybookTestLocalNames(
      babelParse(`import { storybookTest as other } from 'somewhere-else';`)
    );
    expect(names.has('other')).toBe(false);
  });
});

describe('injectAngularVitestIntoConfig', () => {
  it('co-locates the bridge in the same plugins array as storybookTest (case 1)', () => {
    const out = injectAngularVitestIntoConfig(FRESH_V4);
    expect(out).not.toBeNull();
    const callees = pluginCalleesInSameArray(out!);
    expect(callees).toEqual([ANGULAR_VITEST_PLUGIN_CALL, 'storybookTest']);
    // Quote style is normalized later by prettier in the real flow; assert on the structural import.
    expect(out).toContain(`{ ${ANGULAR_VITEST_PLUGIN_CALL} }`);
    expect(out).toContain(ANGULAR_VITEST_IMPORT_SOURCE);
  });

  it('adds the scaffold comment (case 20: comments preserved through generate)', () => {
    const out = injectAngularVitestIntoConfig(FRESH_V4)!;
    expect(out).toContain('Forwards Angular build options');
    // The template's own comment must also survive.
    expect(out).toContain('The plugin will run tests for the stories');
  });

  it('is alias-aware: co-locates next to an aliased storybookTest (case 2)', () => {
    const aliased = FRESH_V4.replace(
      `import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';`,
      `import { storybookTest as sbTest } from '@storybook/addon-vitest/vitest-plugin';`
    ).replace('storybookTest({ configDir', 'sbTest({ configDir');

    const out = injectAngularVitestIntoConfig(aliased);
    expect(out).not.toBeNull();
    const callees = pluginCalleesInSameArray(out!, 'sbTest');
    expect(callees).toEqual([ANGULAR_VITEST_PLUGIN_CALL, 'sbTest']);
  });

  it('returns null on spread storybookTest with no locatable array (case 3)', () => {
    const spread = `
      import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      export default { test: { projects: [{ plugins: [...storybookTest()] }] } };
    `;
    expect(injectAngularVitestIntoConfig(spread)).toBeNull();
  });

  it('returns null when storybookTest is not in any array (exotic)', () => {
    const exotic = `
      import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      const p = storybookTest();
      export default { test: { projects: [{ plugins: p }] } };
    `;
    expect(injectAngularVitestIntoConfig(exotic)).toBeNull();
  });

  it('returns null on unparsable content', () => {
    expect(injectAngularVitestIntoConfig('this is ::: not valid <<< ts')).toBeNull();
  });

  it('is idempotent: a second pass adds no duplicate import or call (case 8)', () => {
    const once = injectAngularVitestIntoConfig(FRESH_V4)!;
    const twice = injectAngularVitestIntoConfig(once);
    // Already wired by the import source — the string path short-circuits via callers, but the
    // injector itself must also not duplicate when re-run on already-injected content.
    expect(twice).not.toBeNull();
    expect(countOccurrences(twice!, ANGULAR_VITEST_IMPORT_SOURCE)).toBe(1);
    expect(countOccurrences(twice!, `${ANGULAR_VITEST_PLUGIN_CALL}(`)).toBe(1);
  });

  it('partial wiring: call already present, adds import without duplicating the call (case 10a)', () => {
    const callOnly = FRESH_V4.replace(
      'plugins: [',
      'plugins: [\n          storybookAngularVitest({}),'
    );
    const out = injectAngularVitestIntoConfig(callOnly)!;
    expect(countOccurrences(out, `${ANGULAR_VITEST_PLUGIN_CALL}(`)).toBe(1);
    expect(countOccurrences(out, ANGULAR_VITEST_IMPORT_SOURCE)).toBe(1);
  });

  it('partial wiring: import already present, adds call without duplicating the import (case 10b)', () => {
    const importOnly = `import { storybookAngularVitest } from '${ANGULAR_VITEST_IMPORT_SOURCE}';\n${FRESH_V4}`;
    const out = injectAngularVitestIntoConfig(importOnly)!;
    expect(countOccurrences(out, ANGULAR_VITEST_IMPORT_SOURCE)).toBe(1);
    expect(countOccurrences(out, `${ANGULAR_VITEST_PLUGIN_CALL}(`)).toBe(1);
    const callees = pluginCalleesInSameArray(out);
    expect(callees).toEqual([ANGULAR_VITEST_PLUGIN_CALL, 'storybookTest']);
  });
});

describe('injectAngularVitestIntoAst', () => {
  it('mutates the AST in place and returns true', () => {
    const ast = babelParse(FRESH_V4);
    expect(injectAngularVitestIntoAst(ast)).toBe(true);
    const callees = pluginCalleesInSameArray(generate(ast).code);
    expect(callees).toEqual([ANGULAR_VITEST_PLUGIN_CALL, 'storybookTest']);
  });

  it('returns false for non-locatable arrays', () => {
    const ast = babelParse('export default { test: {} };');
    expect(injectAngularVitestIntoAst(ast)).toBe(false);
  });

  it('co-locates in a workspace (defineWorkspace) element plugins array (case 6)', () => {
    const workspace = `
      import { defineWorkspace } from 'vitest/config';
      import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      export default defineWorkspace([
        './vite.config.ts',
        {
          extends: './vite.config.ts',
          plugins: [storybookTest({ configDir: '.storybook' })],
          test: { name: 'storybook' },
        },
      ]);
    `;
    const out = injectAngularVitestIntoConfig(workspace);
    expect(out).not.toBeNull();
    const callees = pluginCalleesInSameArray(out!);
    expect(callees).toEqual([ANGULAR_VITEST_PLUGIN_CALL, 'storybookTest']);
  });

  it('returns null for a workspace that only references external configs (case 7)', () => {
    const referenced = `
      import { defineWorkspace } from 'vitest/config';
      export default defineWorkspace(['./vite.config.ts', './vitest.storybook.config.ts']);
    `;
    expect(injectAngularVitestIntoConfig(referenced)).toBeNull();
  });
});

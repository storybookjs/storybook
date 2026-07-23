import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  enableExperimentalReview,
  isReviewEnabledFor,
  rewritePackageSpecsForNpm,
} from './templates.ts';

const AGENT_EVAL_ROOT = join(fileURLToPath(import.meta.url), '..', '..');

// EVAL_REVIEW is unset in unit-test runs, so this asserts the default gate:
// plugin sandboxes are always review-on (the addon enables review for the
// `storybook ai` CLI channel by default), MCP sandboxes review-off.
describe('isReviewEnabledFor', () => {
  it('is always on for the plugin integration', () => {
    expect(isReviewEnabledFor('plugin')).toBe(true);
  });

  it('is off for the mcp integration without EVAL_REVIEW=1', () => {
    expect(isReviewEnabledFor('mcp')).toBe(false);
  });
});

describe('enableExperimentalReview', () => {
  it('injects the experimentalReview feature into a Storybook main.ts', () => {
    const files = {
      '.storybook/main.ts': [
        "import type { StorybookConfig } from '@storybook/react-vite';",
        '',
        'const config: StorybookConfig = {',
        "\tstories: ['../stories/**/*.stories.tsx'],",
        "\tframework: '@storybook/react-vite',",
        '};',
        'export default config;',
        '',
      ].join('\n'),
      'src/App.tsx': 'export const App = () => null;',
    };

    enableExperimentalReview(files);

    expect(files['.storybook/main.ts']).toContain('experimentalReview: true');
    expect(files['src/App.tsx']).toBe('export const App = () => null;');
  });

  it('fails loudly when a main.ts drifts from the expected config shape', () => {
    const files = { 'packages/ui/.storybook/main.ts': 'export default {};' };

    expect(() => enableExperimentalReview(files)).toThrowError(/experimentalReview/);
  });

  // Drift guard: EVAL_REVIEW=1 patches every sandbox `.storybook/main.ts`, so
  // each template and fixture Storybook config must keep the uniform opener
  // the patcher anchors on — otherwise ci:review runs die in sandbox setup.
  it('can patch every template and fixture Storybook main.ts', () => {
    const mainFiles = [
      ...findStorybookMainFiles(join(AGENT_EVAL_ROOT, 'templates')),
      ...findStorybookMainFiles(join(AGENT_EVAL_ROOT, 'evals')),
    ];
    expect(mainFiles.length).toBeGreaterThan(0);

    for (const mainFile of mainFiles) {
      const files = { '.storybook/main.ts': readFileSync(mainFile, 'utf8') };
      expect(() => enableExperimentalReview(files), mainFile).not.toThrow();
      expect(files['.storybook/main.ts'], mainFile).toContain('experimentalReview: true');
    }
  });
});

describe('rewritePackageSpecsForNpm', () => {
  it('rewrites the real addon manifest for npm sandboxes', () => {
    const packageJson = JSON.parse(
      readFileSync(join(AGENT_EVAL_ROOT, '..', 'code', 'addons', 'mcp', 'package.json'), 'utf8')
    ) as Record<string, unknown>;
    const rewritten = rewritePackageSpecsForNpm(packageJson, {
      catalog: {},
      dependencyOverrides: {
        '@storybook/mcp': 'file:../mcp',
      },
    });
    const version = packageJson.version;
    const dependencyFields = [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ] as const;
    const rewrittenSpecs = dependencyFields.flatMap((field) =>
      Object.values((rewritten[field] as Record<string, string> | undefined) ?? {})
    );

    expect(rewrittenSpecs.some((spec) => spec.startsWith('workspace:'))).toBe(false);
    expect((rewritten.dependencies as Record<string, string>)['@storybook/mcp']).toBe(
      'file:../mcp'
    );
    expect((rewritten.devDependencies as Record<string, string>)['@storybook/addon-a11y']).toBe(
      version
    );
    expect((rewritten.peerDependencies as Record<string, string>)['@storybook/addon-vitest']).toBe(
      `^${version}`
    );
  });
});

function findStorybookMainFiles(rootDir: string): string[] {
  return readdirSync(rootDir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : findStorybookMainFiles(entryPath);
    }
    return entry.name === 'main.ts' && entryPath.includes('/.storybook/') ? [entryPath] : [];
  });
}

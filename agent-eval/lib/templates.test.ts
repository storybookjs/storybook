import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  enableExperimentalReview,
  isReviewEnabledFor,
  pinStorybookPackages,
  type StorybookWorkspace,
} from './templates.ts';

const AGENT_EVAL_ROOT = join(fileURLToPath(import.meta.url), '..', '..');

// EVAL_REVIEW is unset in unit-test runs, so this asserts the default gate:
// plugin sandboxes are always review-on (the addon enables review for the
// `storybook tools` CLI channel by default), MCP sandboxes review-off.
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

// The Codex MCP experiment copies the server instructions into AGENTS.md, so a
// change to them must update the copies too.
describe('Codex AGENTS.md instructions', () => {
  let buildServerInstructions: (options: Record<string, unknown>) => string;

  // Imported by path, not statically: agent-eval's tsc would otherwise type-check core's
  // sources. Inside `beforeAll`, a moved file fails only these tests.
  beforeAll(async () => {
    ({ buildServerInstructions } = await import(
      join(AGENT_EVAL_ROOT, '..', 'code/core/src/cli/skills/content/build-server-instructions.ts')
    ));
  });

  // The server derives these flags from the sandbox (`getToolAvailability`); they match the MCP
  // fixtures, which are all react-vite with addon-vitest, docs and MCP. Keep them in sync.
  const serverInstructions = (reviewEnabled: boolean) =>
    buildServerInstructions({
      transport: 'mcp',
      devEnabled: true,
      testSupported: true,
      docsEnabled: true,
      changeDetectionEnabled: true,
      moduleGraphSupported: true,
      reviewEnabled,
    }).trim();

  it('match the review-off server instructions', () => {
    const copy = readFileSync(join(AGENT_EVAL_ROOT, 'lib', 'mcp', 'codex-agents.md'), 'utf8');
    expect(copy.trim()).toBe(serverInstructions(false));
  });

  it('match the review-on server instructions', () => {
    const copy = readFileSync(
      join(AGENT_EVAL_ROOT, 'lib', 'mcp', 'codex-agents-review.md'),
      'utf8'
    );
    expect(copy.trim()).toBe(serverInstructions(true));
  });
});

describe('pinStorybookPackages', () => {
  const workspace: StorybookWorkspace = new Map([
    ['storybook', { dir: 'code/core', dependencies: [] }],
    [
      '@storybook/react-vite',
      {
        dir: 'code/frameworks/react-vite',
        dependencies: ['@storybook/builder-vite', '@storybook/react'],
      },
    ],
    ['@storybook/builder-vite', { dir: 'code/builders/builder-vite', dependencies: [] }],
    [
      '@storybook/react',
      { dir: 'code/renderers/react', dependencies: ['@storybook/react-dom-shim'] },
    ],
    ['@storybook/react-dom-shim', { dir: 'code/lib/react-dom-shim', dependencies: [] }],
    ['@storybook/addon-mcp', { dir: 'code/addons/mcp', dependencies: [] }],
  ]);

  const manifest = (packageJson: Record<string, unknown>) =>
    JSON.stringify(packageJson, null, 2).concat('\n');

  it('points every monorepo dependency at its checkout tarball and overrides the transitive ones', async () => {
    const files = {
      'package.json': manifest({
        workspaces: ['packages/*'],
        devDependencies: {
          storybook: 'next',
          '@storybook/addon-mcp': 'file:./local-packages/addon-mcp',
          vite: '7.2.2',
        },
      }),
      'packages/ui/package.json': manifest({
        devDependencies: { '@storybook/react-vite': 'next', react: '19.2.0' },
      }),
    };

    const packed = await pinStorybookPackages(files, workspace, 'checkout');

    expect(JSON.parse(files['package.json'])).toEqual({
      workspaces: ['packages/*'],
      devDependencies: {
        storybook: 'file:local-packages/storybook.tgz',
        '@storybook/addon-mcp': 'file:local-packages/storybook-addon-mcp.tgz',
        vite: '7.2.2',
      },
      overrides: {
        '@storybook/builder-vite': 'file:local-packages/storybook-builder-vite.tgz',
        '@storybook/react': 'file:local-packages/storybook-react.tgz',
        '@storybook/react-dom-shim': 'file:local-packages/storybook-react-dom-shim.tgz',
      },
    });
    expect(JSON.parse(files['packages/ui/package.json']).devDependencies).toEqual({
      '@storybook/react-vite': 'file:../../local-packages/storybook-react-vite.tgz',
      react: '19.2.0',
    });
    expect(packed.sort()).toEqual([
      '@storybook/addon-mcp',
      '@storybook/builder-vite',
      '@storybook/react',
      '@storybook/react-dom-shim',
      '@storybook/react-vite',
      'storybook',
    ]);
  });

  it('leaves a manifest without monorepo dependencies byte-identical', async () => {
    const source = '{"dependencies":{"react":"19.2.0"}}';
    const files = { 'package.json': source };

    const packed = await pinStorybookPackages(files, workspace, 'checkout');

    expect(files['package.json']).toBe(source);
    expect(packed).toEqual([]);
  });
});

function findStorybookMainFiles(rootDir: string): string[] {
  return readdirSync(rootDir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : findStorybookMainFiles(entryPath);
    }
    // `sep`-based so the match also works on Windows, where `join` emits backslashes.
    return entry.name === 'main.ts' && entryPath.includes(`${sep}.storybook${sep}`)
      ? [entryPath]
      : [];
  });
}

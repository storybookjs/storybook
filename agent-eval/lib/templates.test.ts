import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Sandbox } from '@vercel/agent-eval';
import { describe, expect, it } from 'vitest';

import {
  enableExperimentalReview,
  isReviewEnabledFor,
  pinStorybookPackages,
  type StorybookWorkspace,
  writeClaudeInAppBrowserMock,
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

describe('writeClaudeInAppBrowserMock', () => {
  it('registers the Browser server next to existing servers and writes the prompt block', async () => {
    const storybookServer = { type: 'http', url: 'http://127.0.0.1:6006/mcp' };
    const files: Record<string, string> = {
      '.mcp.json': JSON.stringify({ mcpServers: { 'storybook-dev-mcp': storybookServer } }),
    };
    const sandbox = {
      writeFiles: async (written: Record<string, string>) => {
        Object.assign(files, written);
      },
      readFile: async (filePath: string) => {
        const content = files[filePath];
        if (content === undefined) {
          throw new Error(`ENOENT: ${filePath}`);
        }
        return content;
      },
    } as unknown as Sandbox;

    await writeClaudeInAppBrowserMock(sandbox);

    expect(JSON.parse(files['.mcp.json'] ?? '')).toEqual({
      mcpServers: {
        'storybook-dev-mcp': storybookServer,
        Browser: { command: 'node', args: ['.agent-eval/mcp/claude-browser-mock.mjs'] },
      },
    });
    expect(files['CLAUDE.md']).toMatch(/^<built_in_browser>\n/);
    expect(files['CLAUDE.md']).toContain('tools named `mcp__Browser__*`');
    expect(files['.agent-eval/mcp/claude-browser-mock.mjs']).toContain("name: 'Browser'");
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

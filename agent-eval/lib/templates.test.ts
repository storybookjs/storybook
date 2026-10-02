import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Sandbox } from '@vercel/agent-eval';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  enableExperimentalReview,
  pointStorybookAtCheckout,
  isReviewEnabledFor,
  readStorybookWorkspace,
  readTemplateCheckoutPackages,
  type StorybookWorkspace,
  type WorkspacePackage,
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

describe('readStorybookWorkspace', () => {
  it('lists the published packages with the monorepo packages npm installs along with them', async () => {
    const workspace = await readStorybookWorkspace();

    expect(workspace.get('storybook')).toMatchObject({ dir: 'code/core', project: 'core' });
    expect(workspace.get('@storybook/react-vite')?.dependencies).toEqual(
      expect.arrayContaining(['@storybook/builder-vite', '@storybook/react', 'storybook'])
    );
    expect(workspace.get('@storybook/addon-mcp')?.dependencies).toContain('storybook');
    expect(workspace.get('@storybook/addon-mcp')?.dependencies).not.toContain(
      '@storybook/addon-vitest'
    );
    expect(workspace.has('agent-eval')).toBe(false);
  });
});

describe('readTemplateCheckoutPackages', () => {
  it('collects the packages the templates and fixtures install from the checkout', async () => {
    const packages = (await readTemplateCheckoutPackages()).map((pkg) => pkg.name);

    expect(packages).toEqual(
      expect.arrayContaining(['storybook', '@storybook/react-vite', '@storybook/builder-vite'])
    );
  });
});

describe('pointStorybookAtCheckout', () => {
  const workspacePackage = (name: string, dependencies: string[] = []): WorkspacePackage => ({
    name,
    dir: `code/${name}`,
    project: name,
    dependencies,
  });
  const workspace: StorybookWorkspace = new Map(
    [
      workspacePackage('storybook'),
      workspacePackage('@storybook/react-vite', [
        '@storybook/builder-vite',
        '@storybook/react',
        'storybook',
      ]),
      workspacePackage('@storybook/builder-vite', ['storybook']),
      workspacePackage('@storybook/react', ['@storybook/react-dom-shim', 'storybook']),
      workspacePackage('@storybook/react-dom-shim'),
      workspacePackage('@storybook/addon-mcp', ['storybook']),
    ].map((pkg) => [pkg.name, pkg])
  );

  const manifest = (packageJson: Record<string, unknown>) =>
    JSON.stringify(packageJson, null, 2).concat('\n');

  it('points every workspace:* dependency at its checkout tarball and overrides the packages no workspace package lists', async () => {
    const files = {
      'package.json': manifest({
        workspaces: ['packages/*'],
        devDependencies: {
          '@storybook/addon-mcp': 'workspace:*',
          vite: '7.2.2',
        },
        overrides: { vite: '7.2.2' },
      }),
      'packages/ui/package.json': manifest({
        devDependencies: { '@storybook/react-vite': 'workspace:*', react: '19.2.0' },
      }),
    };

    const packages = await pointStorybookAtCheckout(files, workspace);

    expect(JSON.parse(files['package.json'])).toEqual({
      workspaces: ['packages/*'],
      devDependencies: {
        '@storybook/addon-mcp': 'file:local-packages/storybook-addon-mcp.tgz',
        vite: '7.2.2',
      },
      overrides: {
        vite: '7.2.2',
        '@storybook/addon-mcp': 'file:local-packages/storybook-addon-mcp.tgz',
        '@storybook/builder-vite': 'file:local-packages/storybook-builder-vite.tgz',
        '@storybook/react': 'file:local-packages/storybook-react.tgz',
        '@storybook/react-dom-shim': 'file:local-packages/storybook-react-dom-shim.tgz',
        storybook: 'file:local-packages/storybook.tgz',
      },
    });
    expect(JSON.parse(files['packages/ui/package.json']).devDependencies).toEqual({
      '@storybook/react-vite': 'file:../../local-packages/storybook-react-vite.tgz',
      react: '19.2.0',
    });
    expect(packages.map((pkg) => pkg.name).sort()).toEqual([
      '@storybook/addon-mcp',
      '@storybook/builder-vite',
      '@storybook/react',
      '@storybook/react-dom-shim',
      '@storybook/react-vite',
      'storybook',
    ]);
  });

  it('keeps exact Storybook versions and leaves their manifest byte-identical', async () => {
    const source = '{"devDependencies":{"storybook":"9.1.20","react":"19.2.0"}}';
    const files = { 'package.json': source };

    const packages = await pointStorybookAtCheckout(files, workspace);

    expect(files['package.json']).toBe(source);
    expect(packages).toEqual([]);
  });

  it('rejects workspace ranges other than workspace:*', async () => {
    const files = { 'package.json': manifest({ devDependencies: { storybook: 'workspace:^' } }) };

    await expect(pointStorybookAtCheckout(files, workspace)).rejects.toThrowError(
      /storybook@workspace:\^; use workspace:\*/
    );
  });

  it('rejects workspace:* on a package this monorepo does not publish', async () => {
    const files = {
      'package.json': manifest({ devDependencies: { '@storybook/icons': 'workspace:*' } }),
    };

    await expect(pointStorybookAtCheckout(files, workspace)).rejects.toThrowError(
      /@storybook\/icons is not a published package of this monorepo/
    );
  });
});

describe('writeClaudeInAppBrowserMock', () => {
  function createSandbox(files: Record<string, string>): Sandbox {
    return {
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
  }

  it('registers the Browser server next to existing servers and writes the prompt block', async () => {
    const storybookServer = { type: 'http', url: 'http://127.0.0.1:6006/mcp' };
    const files: Record<string, string> = {
      '.mcp.json': JSON.stringify({ mcpServers: { 'storybook-dev-mcp': storybookServer } }),
    };

    await writeClaudeInAppBrowserMock(createSandbox(files));

    expect(JSON.parse(files['.mcp.json'] ?? '')).toEqual({
      mcpServers: {
        'storybook-dev-mcp': storybookServer,
        Browser: { command: 'node', args: ['.agent-eval/mcp/claude-browser-mock.mjs'] },
      },
    });
    expect(files['CLAUDE.md']).toContain('<built_in_browser>');
    expect(files['.agent-eval/mcp/claude-browser-mock.mjs']).toBeDefined();
  });

  it('keeps an existing CLAUDE.md and appends the prompt block', async () => {
    const files: Record<string, string> = { 'CLAUDE.md': '# Project rules' };

    await writeClaudeInAppBrowserMock(createSandbox(files));

    expect(files['CLAUDE.md']).toMatch(/^# Project rules\n\n[\s\S]*<built_in_browser>/);
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

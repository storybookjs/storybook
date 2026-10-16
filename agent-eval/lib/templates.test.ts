import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Sandbox } from '@vercel/agent-eval';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  addMcpAddon,
  pointStorybookAtCheckout,
  readStorybookWorkspace,
  readTemplateCheckoutPackages,
  type StorybookWorkspace,
  type WorkspacePackage,
  writeCodexLunaTestRules,
  writeStorybookAgentInstructions,
} from './templates.ts';

const AGENT_EVAL_ROOT = join(fileURLToPath(import.meta.url), '..', '..');

describe('addMcpAddon', () => {
  it('registers the addon in every template and fixture Storybook', () => {
    const mainFiles = [
      ...findStorybookMainFiles(join(AGENT_EVAL_ROOT, 'templates')),
      ...findStorybookMainFiles(join(AGENT_EVAL_ROOT, 'evals')),
    ];
    expect(mainFiles.length).toBeGreaterThan(0);

    for (const mainFile of mainFiles) {
      const files = {
        '.storybook/main.ts': readFileSync(mainFile, 'utf8'),
        'package.json': readFileSync(join(mainFile, '..', '..', 'package.json'), 'utf8'),
      };

      addMcpAddon(files);

      expect(files['.storybook/main.ts'], mainFile).toContain("'@storybook/addon-mcp'],");
      expect(JSON.parse(files['package.json']).devDependencies, mainFile).toMatchObject({
        '@storybook/addon-mcp': 'workspace:*',
      });
    }
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
      expect.arrayContaining([
        'storybook',
        '@storybook/react-vite',
        '@storybook/builder-vite',
        '@storybook/addon-mcp',
        // Served by the lifecycle evals' checkout registry.
        'create-storybook',
        '@storybook/cli',
        '@storybook/codemod',
      ])
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

function createSandbox(files: Record<string, string>): Sandbox {
  return {
    writeFiles: async (written: Record<string, string>) => {
      Object.assign(files, written);
    },
    runCommand: async (command: string, [flag, filePath]: string[] = []) => ({
      stdout: '',
      stderr: '',
      exitCode:
        command === 'test' &&
        flag === '-f' &&
        filePath !== undefined &&
        files[filePath] !== undefined
          ? 0
          : 1,
    }),
    readFile: async (filePath: string) => {
      const content = files[filePath];
      if (content === undefined) {
        throw new Error(`ENOENT: ${filePath}`);
      }
      return content;
    },
  } as unknown as Sandbox;
}

describe('writeCodexLunaTestRules', () => {
  const instructionsFile = '/home/user/.codex/storybook-eval-instructions.md';

  function createCodexSandbox(files: Record<string, string>, nodeExitCode = 0) {
    const sandbox = createSandbox(files);
    const commands: string[][] = [];
    sandbox.runCommand = async (command: string, args: string[] = []) => {
      commands.push([command, ...args]);
      const node = command === 'node';
      return {
        stdout: node && nodeExitCode === 0 ? instructionsFile : '',
        stderr: node && nodeExitCode !== 0 ? 'do not have the line' : '',
        exitCode: node ? nodeExitCode : 0,
      };
    };
    return { sandbox, commands };
  }

  it('points the Codex config at the instructions it writes, above the tables', async () => {
    const files: Record<string, string> = {
      '.codex/config.toml': '[mcp_servers.storybook]\nurl = "http://127.0.0.1:6006/mcp"\n',
    };
    const { sandbox, commands } = createCodexSandbox(files);

    await writeCodexLunaTestRules(sandbox, 'gpt-6-luna?reasoningEffort=low');
    await writeCodexLunaTestRules(sandbox, 'gpt-6-luna?reasoningEffort=low');

    expect(commands[1]?.slice(0, 2)).toEqual(['node', '-e']);
    expect(commands[1]?.[3]).toBe('gpt-6-luna');
    const config = files['.codex/config.toml'] ?? '';
    expect(
      config.startsWith(
        `model_instructions_file = "${instructionsFile}"\n\n[mcp_servers.storybook]\n`
      )
    ).toBe(true);
    expect(config.match(/model_instructions_file/g)).toHaveLength(1);
  });

  it('fails when the script cannot write the instructions', async () => {
    const files: Record<string, string> = {};
    const { sandbox } = createCodexSandbox(files, 1);

    await expect(writeCodexLunaTestRules(sandbox, 'gpt-6-luna')).rejects.toThrow(
      'Failed to write the gpt-6-luna instructions: do not have the line'
    );
    expect(files).toEqual({});
  });
});

describe('writeStorybookAgentInstructions', () => {
  let STORYBOOK_AGENT_INSTRUCTIONS: string;

  beforeAll(async () => {
    ({ STORYBOOK_AGENT_INSTRUCTIONS } = await import(
      join(AGENT_EVAL_ROOT, '..', 'code/core/src/cli/agentInstructions.ts')
    ));
  });

  it('writes the section of create storybook to AGENTS.md', async () => {
    const files: Record<string, string> = {};

    await writeStorybookAgentInstructions(createSandbox(files));

    expect(files['AGENTS.md']).toBe(STORYBOOK_AGENT_INSTRUCTIONS);
    expect(files['CLAUDE.md']).toBeUndefined();
  });

  it('also writes it to a CLAUDE.md of the template', async () => {
    const files: Record<string, string> = { 'CLAUDE.md': '# Project rules\n' };

    await writeStorybookAgentInstructions(createSandbox(files));

    expect(files['CLAUDE.md']).toBe(`# Project rules\n\n${STORYBOOK_AGENT_INSTRUCTIONS}`);
  });

  it('writes nothing when it cannot tell whether a file exists', async () => {
    const files: Record<string, string> = { 'AGENTS.md': '# Project rules\n' };
    const sandbox = createSandbox(files);
    sandbox.runCommand = async () => ({ stdout: '', stderr: 'test: I/O error', exitCode: 2 });

    await expect(writeStorybookAgentInstructions(sandbox)).rejects.toThrow('I/O error');

    expect(files).toEqual({ 'AGENTS.md': '# Project rules\n' });
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

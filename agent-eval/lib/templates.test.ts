import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Sandbox } from '@vercel/agent-eval';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  addMcpAddon,
  LUNA_INSTRUCTIONS_SCRIPT_PATH,
  LUNA_TEST_RULE,
  pointStorybookAtCheckout,
  readStorybookWorkspace,
  readTemplateCheckoutPackages,
  SOL_TEST_RULES,
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

// The script runs `codex`, so each test puts a `codex` on the PATH that prints its catalog.
describe.skipIf(process.platform === 'win32')('the Luna instructions script', () => {
  const solRules = [
    '- Do not write tests for reversible one-off changes.',
    '- Run tests appropriate to the change.',
  ];

  function runScript(models: Array<{ slug: string; base_instructions: string }>) {
    const home = mkdtempSync(join(tmpdir(), 'luna-instructions-'));
    const catalog = join(home, 'catalog.json');
    writeFileSync(catalog, JSON.stringify({ models }));
    const codex = join(home, 'codex');
    writeFileSync(
      codex,
      `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "codex-cli 1.2.3"; else cat "${catalog}"; fi\n`
    );
    chmodSync(codex, 0o755);
    return execFileSync(
      'node',
      [
        '-e',
        readFileSync(LUNA_INSTRUCTIONS_SCRIPT_PATH, 'utf8'),
        'gpt-6-luna',
        LUNA_TEST_RULE,
        SOL_TEST_RULES,
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, HOME: home, PATH: `${home}${delimiter}${process.env.PATH}` },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
  }

  it("swaps Luna's test rule for the two of Sol and keeps the rest", () => {
    const file = runScript([
      { slug: 'gpt-6-luna', base_instructions: `Be brief.\n${LUNA_TEST_RULE}\nUse rg.` },
      { slug: 'gpt-6.1-sol', base_instructions: `Intro.\n${solRules.join('\n')}\nOutro.` },
    ]);

    expect(file.endsWith(join('.codex', 'storybook-eval-instructions.md'))).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe(`Be brief.\n${solRules.join('\n')}\nUse rg.`);
  });

  it("fails when Luna's instructions no longer have the rule", () => {
    expect(() =>
      runScript([
        { slug: 'gpt-6-luna', base_instructions: 'Be brief.' },
        { slug: 'gpt-6.1-sol', base_instructions: solRules.join('\n') },
      ])
    ).toThrow('The base instructions of gpt-6-luna do not have the line');
  });

  it('fails when Sol does not have exactly two test rules', () => {
    expect(() =>
      runScript([
        { slug: 'gpt-6-luna', base_instructions: LUNA_TEST_RULE },
        { slug: 'gpt-6.1-sol', base_instructions: solRules[0] ?? '' },
      ])
    ).toThrow('have 1 test rules instead of 2 in the catalog of codex-cli 1.2.3');
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

describe('sharedPackState', () => {
  it('is one state for every copy of the module, as agent-eval loads one per experiment', async () => {
    const { createJiti } = await import('jiti');
    const load = () =>
      createJiti(import.meta.url, { interopDefault: true, moduleCache: false }).import<
        typeof import('./templates.ts')
      >(join(fileURLToPath(new URL('.', import.meta.url)), 'templates.ts'));
    const [first, second] = await Promise.all([load(), load()]);

    expect(first).not.toBe(second);
    expect(first.sharedPackState()).toBe(second.sharedPackState());
  });
});

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { syncBaselines, type Project } from './sync-baselines.ts';

let TMP = '';

afterEach(() => {
  if (TMP) {
    rmSync(TMP, { recursive: true, force: true });
    TMP = '';
  }
});

describe('syncBaselines', () => {
  it('syncs authoritative mealdrop files into root and nested repos, removes old eval-results, and pushes main', async () => {
    TMP = mkdtempSync(join(tmpdir(), 'eval-sync-baselines-'));
    const reposRoot = join(TMP, 'repos');
    const remotesRoot = join(TMP, 'remotes');
    await mkdir(reposRoot, { recursive: true });
    await mkdir(remotesRoot, { recursive: true });

    const projects: Project[] = [
      {
        name: 'mealdrop',
        repo: join(remotesRoot, 'mealdrop.git'),
        branch: 'main',
        githubSlug: 'storybook-tmp/mealdrop',
      },
      {
        name: 'edgy',
        repo: join(remotesRoot, 'edgy.git'),
        branch: 'main',
        githubSlug: 'storybook-tmp/edgy',
      },
      {
        name: 'wikitok',
        repo: join(remotesRoot, 'wikitok.git'),
        branch: 'main',
        githubSlug: 'storybook-tmp/wikitok',
        projectDir: 'frontend',
      },
    ];

    setupRepo({
      repoRoot: join(reposRoot, 'mealdrop'),
      remoteRoot: join(remotesRoot, 'mealdrop.git'),
      storybookDir: '.storybook',
      mainFile: 'main.ts',
      mainContents: [
        "import type { StorybookConfig } from '@storybook/react-vite';",
        '',
        'const config: StorybookConfig = {',
        "  stories: ['../src/**/*.stories.tsx', './eval-support/*.mdx'],",
        '};',
        '',
        'export default config;',
      ].join('\n'),
      evalSupportFiles: {
        'summary.mdx': "import data from '../../eval-results/data.json';\n\n# Source Summary\n",
        'transcript.mdx':
          "import data from '../../eval-results/data.json';\nimport { Transcript } from './transcript';\n\n# Transcript\n\n<Transcript {...data.docs.transcript} />\n",
        'transcript.tsx': 'export const Transcript = () => null;\n',
        'transcript.types.ts':
          'export interface TranscriptProps { messages: unknown[]; prompt: string; promptTokenCount: number; promptCost: number; }\n',
      },
      previewContents: "export default { parameters: { a11y: { test: 'todo' } } };\n",
      rootEvalResultsFiles: {
        'summary.json': '{ "empty": true }\n',
        'transcript.json': '[]\n',
      },
    });

    setupRepo({
      repoRoot: join(reposRoot, 'edgy'),
      remoteRoot: join(remotesRoot, 'edgy.git'),
      storybookDir: '.storybook',
      mainFile: 'main.js',
      mainContents: [
        '/** @type { import("@storybook/react-vite").StorybookConfig } */',
        'const config = {',
        "  stories: ['../src/**/*.stories.tsx'],",
        '};',
        '',
        'export default config;',
      ].join('\n'),
      evalSupportFiles: {
        'old-helper.ts': 'export const stale = true;\n',
      },
      previewContents: 'export default { parameters: { old: true } };\n',
      rootEvalResultsFiles: {
        'data.json': '{}\n',
        'summary.json': '{ "empty": true }\n',
      },
    });

    setupRepo({
      repoRoot: join(reposRoot, 'wikitok'),
      remoteRoot: join(remotesRoot, 'wikitok.git'),
      storybookDir: 'frontend/.storybook',
      mainFile: 'main.ts',
      mainContents: [
        "import type { StorybookConfig } from '@storybook/react-vite';",
        '',
        'const config: StorybookConfig = {',
        '  stories: [',
        "    '../src/**/*.stories.tsx',",
        '  ],',
        '};',
        '',
        'export default config;',
      ].join('\n'),
      evalSupportFiles: {
        'old.txt': 'stale\n',
      },
      previewContents: 'export default { parameters: { old: true } };\n',
      rootEvalResultsFiles: {
        'transcript.json': '[]\n',
      },
    });

    writeFileSync(
      join(reposRoot, 'mealdrop', '.storybook', 'eval-support', 'summary.mdx'),
      "import data from '../../eval-results/data.json';\n\n# Source Summary Updated\n"
    );

    await syncBaselines({
      reposRoot,
      sourceProjectName: 'mealdrop',
      projects,
      push: true,
      log: () => {},
    });

    expect(
      readFileSync(join(reposRoot, 'edgy', '.storybook', 'eval-support', 'summary.mdx'), 'utf-8')
    ).toContain('../eval-results/data.json');
    expect(
      readFileSync(join(reposRoot, 'edgy', '.storybook', 'eval-support', 'summary.mdx'), 'utf-8')
    ).toContain('# Source Summary Updated');
    expect(
      readFileSync(
        join(reposRoot, 'wikitok', 'frontend', '.storybook', 'eval-support', 'transcript.mdx'),
        'utf-8'
      )
    ).toContain('../eval-results/data.json');

    expect(
      readFileSync(join(reposRoot, 'edgy', '.storybook', 'eval-results', 'data.json'), 'utf-8')
    ).toBe('{}\n');
    expect(
      readFileSync(
        join(reposRoot, 'wikitok', 'frontend', '.storybook', 'eval-results', 'data.json'),
        'utf-8'
      )
    ).toBe('{}\n');

    expect(existsSync(join(reposRoot, 'edgy', 'eval-results'))).toBe(false);
    expect(existsSync(join(reposRoot, 'wikitok', 'eval-results'))).toBe(false);
    expect(existsSync(join(reposRoot, 'edgy', '.storybook', 'main.js'))).toBe(false);
    expect(existsSync(join(reposRoot, 'edgy', '.storybook', 'eval-support', 'old-helper.ts'))).toBe(
      false
    );
    expect(
      existsSync(join(reposRoot, 'wikitok', 'frontend', '.storybook', 'eval-support', 'old.txt'))
    ).toBe(false);

    expect(readFileSync(join(reposRoot, 'edgy', '.storybook', 'main.ts'), 'utf-8')).toContain(
      './eval-support/*.mdx'
    );
    expect(readFileSync(join(reposRoot, 'edgy', '.storybook', 'preview.tsx'), 'utf-8')).toBe(
      "export default { parameters: { a11y: { test: 'todo' } } };\n"
    );
    expect(
      readFileSync(join(reposRoot, 'wikitok', 'frontend', '.storybook', 'main.ts'), 'utf-8')
    ).toContain('./eval-support/*.mdx');

    expect(getHead(join(reposRoot, 'edgy'))).toBe(getRemoteHead(join(remotesRoot, 'edgy.git')));
    expect(getHead(join(reposRoot, 'wikitok'))).toBe(
      getRemoteHead(join(remotesRoot, 'wikitok.git'))
    );
  });

  it('fails fast when a non-source target repo is dirty', async () => {
    TMP = mkdtempSync(join(tmpdir(), 'eval-sync-baselines-dirty-'));
    const reposRoot = join(TMP, 'repos');
    const remotesRoot = join(TMP, 'remotes');
    await mkdir(reposRoot, { recursive: true });
    await mkdir(remotesRoot, { recursive: true });

    const projects: Project[] = [
      {
        name: 'mealdrop',
        repo: join(remotesRoot, 'mealdrop.git'),
        branch: 'main',
        githubSlug: 'storybook-tmp/mealdrop',
      },
      {
        name: 'edgy',
        repo: join(remotesRoot, 'edgy.git'),
        branch: 'main',
        githubSlug: 'storybook-tmp/edgy',
      },
    ];

    setupRepo({
      repoRoot: join(reposRoot, 'mealdrop'),
      remoteRoot: join(remotesRoot, 'mealdrop.git'),
      storybookDir: '.storybook',
      mainFile: 'main.ts',
      mainContents: "export default { stories: ['./eval-support/*.mdx'] };\n",
      evalSupportFiles: {
        'summary.mdx': "import data from '../../eval-results/data.json';\n",
        'transcript.mdx': "import data from '../../eval-results/data.json';\n",
        'transcript.tsx': 'export const Transcript = () => null;\n',
        'transcript.types.ts': 'export interface TranscriptProps {}\n',
      },
      previewContents: 'export default {};\n',
      rootEvalResultsFiles: {
        'summary.json': '{ "empty": true }\n',
      },
    });

    setupRepo({
      repoRoot: join(reposRoot, 'edgy'),
      remoteRoot: join(remotesRoot, 'edgy.git'),
      storybookDir: '.storybook',
      mainFile: 'main.js',
      mainContents: 'export default { stories: [] };\n',
      evalSupportFiles: {},
      previewContents: 'export default {};\n',
      rootEvalResultsFiles: {},
    });

    writeFileSync(join(reposRoot, 'edgy', 'README.md'), 'dirty\n');

    await expect(
      syncBaselines({
        reposRoot,
        sourceProjectName: 'mealdrop',
        projects,
        push: true,
        log: () => {},
      })
    ).rejects.toThrow('edgy has local changes');

    expect(existsSync(join(reposRoot, 'edgy', '.storybook', 'eval-results', 'data.json'))).toBe(
      false
    );
    expect(existsSync(join(reposRoot, 'edgy', 'eval-results'))).toBe(false);
  });
});

function setupRepo(opts: {
  repoRoot: string;
  remoteRoot: string;
  storybookDir: string;
  mainFile: string;
  mainContents: string;
  evalSupportFiles: Record<string, string>;
  previewContents: string;
  rootEvalResultsFiles: Record<string, string>;
}) {
  execFileSync('git', ['init', '--bare', '--initial-branch=main', opts.remoteRoot]);
  execFileSync('git', ['init', '--initial-branch=main', opts.repoRoot]);
  execFileSync('git', ['-C', opts.repoRoot, 'config', 'user.name', 'Test User']);
  execFileSync('git', ['-C', opts.repoRoot, 'config', 'user.email', 'test@example.com']);

  const storybookRoot = join(opts.repoRoot, opts.storybookDir);
  mkdirSyncRecursive(join(storybookRoot, 'eval-support'));
  writeFileSync(join(storybookRoot, opts.mainFile), opts.mainContents);
  writeFileSync(join(storybookRoot, 'preview.tsx'), opts.previewContents);
  for (const [name, contents] of Object.entries(opts.evalSupportFiles)) {
    writeFileSync(join(storybookRoot, 'eval-support', name), contents);
  }

  if (Object.keys(opts.rootEvalResultsFiles).length > 0) {
    mkdirSyncRecursive(join(opts.repoRoot, 'eval-results'));
    for (const [name, contents] of Object.entries(opts.rootEvalResultsFiles)) {
      writeFileSync(join(opts.repoRoot, 'eval-results', name), contents);
    }
  }

  execFileSync('git', ['-C', opts.repoRoot, 'add', '-A']);
  execFileSync('git', ['-C', opts.repoRoot, 'commit', '-m', 'initial']);
  execFileSync('git', ['-C', opts.repoRoot, 'remote', 'add', 'origin', opts.remoteRoot]);
  execFileSync('git', ['-C', opts.repoRoot, 'push', '-u', 'origin', 'main']);
}

function mkdirSyncRecursive(path: string) {
  execFileSync('mkdir', ['-p', path]);
}

function getHead(repoRoot: string) {
  return execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], {
    encoding: 'utf-8',
  }).trim();
}

function getRemoteHead(remoteRoot: string) {
  return execFileSync('git', ['--git-dir', remoteRoot, 'rev-parse', 'refs/heads/main'], {
    encoding: 'utf-8',
  }).trim();
}

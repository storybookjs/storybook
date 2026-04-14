import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { BASELINE_STORYBOOK_FILES } from './lib/baseline-template-files.ts';
import type { Project } from './lib/projects.ts';
import { syncBaselines } from './sync-baselines.ts';

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

    await syncBaselines({
      reposRoot,
      projects,
      push: true,
      log: () => {},
    });

    expect(
      readFileSync(join(reposRoot, 'edgy', '.storybook', 'eval-support', 'summary.mdx'), 'utf-8')
    ).toContain('../eval-results/data.json');
    expect(
      readFileSync(join(reposRoot, 'edgy', '.storybook', 'eval-support', 'summary.mdx'), 'utf-8')
    ).toContain('# Eval Summary');
    expect(
      readFileSync(join(reposRoot, 'edgy', '.storybook', 'eval-support', 'summary.mdx'), 'utf-8')
    ).toContain("{data.project?.name ?? '-'}");
    expect(
      readFileSync(
        join(reposRoot, 'wikitok', 'frontend', '.storybook', 'eval-support', 'transcript.mdx'),
        'utf-8'
      )
    ).toContain('../eval-results/data.json');
    expect(
      readFileSync(
        join(reposRoot, 'wikitok', 'frontend', '.storybook', 'eval-support', 'transcript.mdx'),
        'utf-8'
      )
    ).toContain(
      "<Transcript {...(data.docs?.transcript ?? { prompt: '', promptTokenCount: 0, promptCost: 0, messages: [] })} />"
    );

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
    expect(existsSync(join(reposRoot, 'wikitok', 'frontend', 'eval-results'))).toBe(false);
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
      baselineTemplate('.storybook/preview.tsx')
    );
    expect(
      readFileSync(join(reposRoot, 'wikitok', 'frontend', '.storybook', 'main.ts'), 'utf-8')
    ).toContain('./eval-support/*.mdx');
    expect(
      readFileSync(join(reposRoot, 'edgy', '.storybook', 'eval-support', 'transcript.tsx'), 'utf-8')
    ).toBe(resultDocTemplate('transcript.tsx'));
    expect(
      readFileSync(
        join(reposRoot, 'wikitok', 'frontend', '.storybook', 'eval-support', 'transcript.types.ts'),
        'utf-8'
      )
    ).toBe(resultDocTemplate('transcript.types.ts'));

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

  it('syncs nested project baselines even when there is no legacy eval-results directory', async () => {
    TMP = mkdtempSync(join(tmpdir(), 'eval-sync-baselines-nested-no-legacy-'));
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
        name: 'excalidraw',
        repo: join(remotesRoot, 'excalidraw.git'),
        branch: 'main',
        githubSlug: 'storybook-tmp/excalidraw',
        projectDir: 'excalidraw-app',
      },
    ];

    setupRepo({
      repoRoot: join(reposRoot, 'mealdrop'),
      remoteRoot: join(remotesRoot, 'mealdrop.git'),
      storybookDir: '.storybook',
      mainFile: 'main.ts',
      mainContents: "export default { stories: ['./eval-support/*.mdx'] };\n",
      evalSupportFiles: {
        'summary.mdx': '# Source Summary\n',
        'transcript.mdx': '# Transcript\n',
        'transcript.tsx': 'export const Transcript = () => null;\n',
        'transcript.types.ts': 'export interface TranscriptProps {}\n',
      },
      previewContents: 'export default {};\n',
      rootEvalResultsFiles: {
        'summary.json': '{ "empty": true }\n',
      },
    });

    setupRepo({
      repoRoot: join(reposRoot, 'excalidraw'),
      remoteRoot: join(remotesRoot, 'excalidraw.git'),
      storybookDir: 'excalidraw-app/.storybook',
      mainFile: 'main.ts',
      mainContents: 'export default { stories: ["../stories/**/*.stories.tsx"] };\n',
      evalSupportFiles: {},
      previewContents: 'export default { parameters: { old: true } };\n',
      rootEvalResultsFiles: {},
    });

    await syncBaselines({
      reposRoot,
      projects,
      push: true,
      log: () => {},
    });

    expect(
      readFileSync(
        join(reposRoot, 'excalidraw', 'excalidraw-app', '.storybook', 'main.ts'),
        'utf-8'
      )
    ).toContain('./eval-support/*.mdx');
    expect(
      existsSync(join(reposRoot, 'excalidraw', 'excalidraw-app', '.storybook', 'eval-support'))
    ).toBe(true);
    expect(
      readFileSync(
        join(reposRoot, 'excalidraw', 'excalidraw-app', '.storybook', 'eval-results', 'data.json'),
        'utf-8'
      )
    ).toBe('{}\n');
    expect(getHead(join(reposRoot, 'excalidraw'))).toBe(
      getRemoteHead(join(remotesRoot, 'excalidraw.git'))
    );
  });

  it('fast-forwards a clean target repo before copying the baseline', async () => {
    TMP = mkdtempSync(join(tmpdir(), 'eval-sync-baselines-target-behind-'));
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
      mainContents: 'export default { stories: [] };\n',
      evalSupportFiles: {
        'summary.mdx': '# Old Summary\n',
        'transcript.mdx': '# Transcript\n',
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
      mainFile: 'main.ts',
      mainContents: 'export default { stories: [] };\n',
      evalSupportFiles: {},
      previewContents: 'export default {};\n',
      rootEvalResultsFiles: {},
    });

    const targetRemoteWorktree = join(TMP, 'edgy-remote-worktree');
    execFileSync('git', ['clone', join(remotesRoot, 'edgy.git'), targetRemoteWorktree]);
    execFileSync('git', ['-C', targetRemoteWorktree, 'config', 'user.name', 'Test User']);
    execFileSync('git', ['-C', targetRemoteWorktree, 'config', 'user.email', 'test@example.com']);
    writeFileSync(join(targetRemoteWorktree, 'README.md'), 'updated upstream\n');
    execFileSync('git', ['-C', targetRemoteWorktree, 'add', '-A']);
    execFileSync('git', ['-C', targetRemoteWorktree, 'commit', '-m', 'update target upstream']);
    execFileSync('git', ['-C', targetRemoteWorktree, 'push', 'origin', 'main']);

    await syncBaselines({
      reposRoot,
      projects,
      push: true,
      log: () => {},
    });

    expect(
      readFileSync(
        join(reposRoot, 'mealdrop', '.storybook', 'eval-support', 'summary.mdx'),
        'utf-8'
      )
    ).toBe(baselineTemplate('.storybook/eval-support/summary.mdx'));
    expect(
      readFileSync(join(reposRoot, 'edgy', '.storybook', 'eval-support', 'summary.mdx'), 'utf-8')
    ).toBe(baselineTemplate('.storybook/eval-support/summary.mdx'));
    expect(readFileSync(join(reposRoot, 'edgy', 'README.md'), 'utf-8')).toBe('updated upstream\n');
    expect(getHead(join(reposRoot, 'edgy'))).toBe(getRemoteHead(join(remotesRoot, 'edgy.git')));
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
  const projectRoot = join(opts.repoRoot, dirname(opts.storybookDir));
  mkdirSyncRecursive(join(storybookRoot, 'eval-support'));
  writeFileSync(join(storybookRoot, opts.mainFile), opts.mainContents);
  writeFileSync(join(storybookRoot, 'preview.tsx'), opts.previewContents);
  for (const [name, contents] of Object.entries(opts.evalSupportFiles)) {
    writeFileSync(join(storybookRoot, 'eval-support', name), contents);
  }

  if (Object.keys(opts.rootEvalResultsFiles).length > 0) {
    mkdirSyncRecursive(join(projectRoot, 'eval-results'));
    for (const [name, contents] of Object.entries(opts.rootEvalResultsFiles)) {
      writeFileSync(join(projectRoot, 'eval-results', name), contents);
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

function baselineTemplate(path: string) {
  const normalizedPath = path.replace(/^\.storybook\//, '');
  const template = BASELINE_STORYBOOK_FILES[normalizedPath];
  if (template == null) {
    throw new Error(`Missing baseline template for ${path}`);
  }
  return template;
}

function resultDocTemplate(file: 'transcript.tsx' | 'transcript.types.ts') {
  return baselineTemplate(`eval-support/${file}`);
}

import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let TMP = '';

beforeEach(() => {
  TMP = mkdtempSync(join(tmpdir(), 'eval-prepare-trial-'));
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock('tinyexec');
  vi.doUnmock('./package-manager.ts');
  vi.doUnmock('./utils.ts');
  vi.restoreAllMocks();
  vi.resetModules();

  if (TMP) {
    rmSync(TMP, { recursive: true, force: true });
    TMP = '';
  }
});

function createLogger() {
  return {
    log: vi.fn(),
    logStep: vi.fn(),
    logSuccess: vi.fn(),
    logError: vi.fn(),
  };
}

function createExecResult(stdout = '', exitCode = 0) {
  return { stdout, stderr: '', exitCode };
}

describe('prepareTrial', () => {
  it('clones missing source repos, creates a worktree, and installs from the trial repo root', async () => {
    const reposDir = join(TMP, 'repos');
    const trialsDir = join(TMP, 'trials');
    const installDeps = vi.fn().mockResolvedValue(undefined);
    const calls: Array<{ cmd: string; args: string[]; cwd?: string }> = [];

    vi.doMock('tinyexec', () => ({
      x: vi.fn(
        async (cmd: string, args: string[], options?: { nodeOptions?: { cwd?: string } }) => {
          calls.push({ cmd, args, cwd: options?.nodeOptions?.cwd });

          if (cmd === 'git' && args[0] === 'rev-parse') {
            return createExecResult('deadbeef\n');
          }

          return createExecResult();
        }
      ),
    }));

    vi.doMock('./package-manager.ts', () => ({ installDeps }));
    vi.doMock('./utils.ts', async () => {
      const actual = await vi.importActual<typeof import('./utils.ts')>('./utils.ts');
      return {
        ...actual,
        REPOS_DIR: reposDir,
        TRIALS_DIR: trialsDir,
      };
    });

    const { prepareTrial } = await import('./prepare-trial.ts');
    const logger = createLogger();
    const project = {
      name: 'evergreen-ci',
      repo: 'https://github.com/storybook-tmp/ui',
      branch: 'main',
      githubSlug: 'storybook-tmp/ui',
      projectDir: 'packages/lib',
    };

    const workspace = await prepareTrial(project, 'trial-123', logger);

    expect(workspace).toEqual({
      trialDir: join(trialsDir, 'trial-123'),
      sourceDir: join(reposDir, 'evergreen-ci'),
      repoRoot: join(trialsDir, 'trial-123', 'project'),
      projectPath: join(trialsDir, 'trial-123', 'project', 'packages/lib'),
      resultsDir: join(
        trialsDir,
        'trial-123',
        'project',
        'packages/lib',
        '.storybook',
        'eval-results'
      ),
      baselineCommit: 'deadbeef',
      trialBranch: 'trial/trial-123',
    });
    expect(existsSync(workspace.resultsDir)).toBe(true);
    expect(installDeps).toHaveBeenCalledWith(
      join(trialsDir, 'trial-123', 'project', 'packages/lib'),
      logger,
      undefined,
      { stopAt: join(trialsDir, 'trial-123', 'project') }
    );

    expect(calls).toEqual(
      expect.arrayContaining([
        {
          cmd: 'git',
          args: ['clone', '--branch', 'main', project.repo, join(reposDir, 'evergreen-ci')],
          cwd: undefined,
        },
        {
          cmd: 'git',
          args: ['remote', 'set-url', 'origin', project.repo],
          cwd: join(reposDir, 'evergreen-ci'),
        },
        {
          cmd: 'git',
          args: ['fetch', 'origin', '--prune'],
          cwd: join(reposDir, 'evergreen-ci'),
        },
        {
          cmd: 'git',
          args: ['checkout', 'main'],
          cwd: join(reposDir, 'evergreen-ci'),
        },
        {
          cmd: 'git',
          args: ['reset', '--hard', 'origin/main'],
          cwd: join(reposDir, 'evergreen-ci'),
        },
        {
          cmd: 'git',
          args: ['rev-parse', 'HEAD'],
          cwd: join(reposDir, 'evergreen-ci'),
        },
        {
          cmd: 'git',
          args: [
            'worktree',
            'add',
            '-b',
            'trial/trial-123',
            join(trialsDir, 'trial-123', 'project'),
            'main',
          ],
          cwd: join(reposDir, 'evergreen-ci'),
        },
      ])
    );
  });

  it('reuses an existing source clone without recloning it', async () => {
    const reposDir = join(TMP, 'repos');
    const trialsDir = join(TMP, 'trials');
    const sourceDir = join(reposDir, 'mealdrop');
    const installDeps = vi.fn().mockResolvedValue(undefined);
    const calls: Array<{ cmd: string; args: string[]; cwd?: string }> = [];

    mkdirSync(join(sourceDir, '.git'), { recursive: true });

    vi.doMock('tinyexec', () => ({
      x: vi.fn(
        async (cmd: string, args: string[], options?: { nodeOptions?: { cwd?: string } }) => {
          calls.push({ cmd, args, cwd: options?.nodeOptions?.cwd });

          if (cmd === 'git' && args[0] === 'rev-parse') {
            return createExecResult('cafebabe\n');
          }

          return createExecResult();
        }
      ),
    }));

    vi.doMock('./package-manager.ts', () => ({ installDeps }));
    vi.doMock('./utils.ts', async () => {
      const actual = await vi.importActual<typeof import('./utils.ts')>('./utils.ts');
      return {
        ...actual,
        REPOS_DIR: reposDir,
        TRIALS_DIR: trialsDir,
      };
    });

    const { prepareTrial } = await import('./prepare-trial.ts');
    const logger = createLogger();
    const project = {
      name: 'mealdrop',
      repo: 'https://github.com/storybook-tmp/mealdrop',
      branch: 'main',
      githubSlug: 'storybook-tmp/mealdrop',
    };

    const workspace = await prepareTrial(project, 'trial-456', logger);

    expect(workspace.baselineCommit).toBe('cafebabe');
    expect(calls.some((call) => call.args[0] === 'clone')).toBe(false);
    expect(calls).toEqual(
      expect.arrayContaining([
        {
          cmd: 'git',
          args: ['remote', 'set-url', 'origin', project.repo],
          cwd: sourceDir,
        },
        {
          cmd: 'git',
          args: ['fetch', 'origin', '--prune'],
          cwd: sourceDir,
        },
        {
          cmd: 'git',
          args: ['checkout', 'main'],
          cwd: sourceDir,
        },
        {
          cmd: 'git',
          args: ['reset', '--hard', 'origin/main'],
          cwd: sourceDir,
        },
        {
          cmd: 'git',
          args: [
            'worktree',
            'add',
            '-b',
            'trial/trial-456',
            join(trialsDir, 'trial-456', 'project'),
            'main',
          ],
          cwd: sourceDir,
        },
      ])
    );
    expect(installDeps).toHaveBeenCalledTimes(1);
  });
});

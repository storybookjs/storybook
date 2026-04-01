import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let TMP = '';

beforeEach(() => {
  TMP = mkdtempSync(join(tmpdir(), 'eval-publish-trial-'));
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock('tinyexec');
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

function writeEvalSupportFixture(projectPath: string, repoRoot: string) {
  const supportDir = join(projectPath, '.storybook', 'eval-support');
  const configPath = join(projectPath, '.storybook', 'main.ts');
  const resultsDir = join(repoRoot, 'eval-results');

  mkdirSync(supportDir, { recursive: true });
  mkdirSync(resultsDir, { recursive: true });

  writeFileSync(
    configPath,
    [
      "import type { StorybookConfig } from '@storybook/react-vite';",
      '',
      'const config: StorybookConfig = {',
      "  stories: ['../src/**/*.stories.tsx', './eval-support/*.mdx'],",
      '};',
      '',
      'export default config;',
    ].join('\n')
  );

  for (const file of ['summary.mdx', 'transcript.mdx', 'transcript.tsx', 'transcript.types.ts']) {
    writeFileSync(join(supportDir, file), `fixture ${file}\n`);
  }

  writeFileSync(join(resultsDir, 'summary.json'), '{}');
  writeFileSync(join(resultsDir, 'transcript.json'), '[]');
}

describe('buildTrialLabels', () => {
  it('includes eval, project, agent, model, effort, and prompt labels', async () => {
    const { buildTrialLabels } = await import('./publish-trial.ts');

    expect(
      buildTrialLabels(
        {
          name: 'mealdrop',
          repo: 'https://github.com/storybook-tmp/mealdrop',
          branch: 'main',
          githubSlug: 'storybook-tmp/mealdrop',
        },
        {
          agent: 'claude',
          model: 'sonnet-4.6',
          effort: 'high',
        },
        'setup'
      )
    ).toEqual([
      'eval',
      'project:mealdrop',
      'agent:claude',
      'model:sonnet-4.6',
      'effort:high',
      'prompt:setup',
    ]);
  });
});

describe('buildTrialArtifactUrls', () => {
  it('creates blob URLs for committed eval artifacts on the trial branch', async () => {
    const { buildTrialArtifactUrls } = await import('./publish-trial.ts');

    expect(
      buildTrialArtifactUrls(
        {
          name: 'mealdrop',
          repo: 'https://github.com/storybook-tmp/mealdrop',
          branch: 'main',
          githubSlug: 'storybook-tmp/mealdrop',
        },
        'trial/foo'
      )
    ).toEqual({
      summaryUrl:
        'https://github.com/storybook-tmp/mealdrop/blob/trial/foo/eval-results/summary.json',
      transcriptUrl:
        'https://github.com/storybook-tmp/mealdrop/blob/trial/foo/eval-results/transcript.json',
    });
  });
});

describe('publishTrialBranch', () => {
  it('validates shared eval support, writes the PR body, and leaves Storybook config untouched', async () => {
    const calls: Array<{ cmd: string; args: string[]; cwd?: string }> = [];

    vi.doMock('tinyexec', () => ({
      x: vi.fn(async (cmd: string, args: string[], options?: { nodeOptions?: { cwd?: string } }) => {
        calls.push({ cmd, args, cwd: options?.nodeOptions?.cwd });

        if (cmd === 'gh' && args[0] === 'label' && args[1] === 'list') {
          return createExecResult('');
        }

        if (cmd === 'git' && args[0] === 'config' && args.length === 2) {
          return createExecResult('', 1);
        }

        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'create') {
          return createExecResult('https://github.com/storybook-tmp/mealdrop/pull/123\n');
        }

        return createExecResult();
      }),
    }));

    const { publishTrialBranch } = await import('./publish-trial.ts');
    const repoRoot = join(TMP, 'repo');
    const projectPath = join(repoRoot, 'packages', 'app');
    const resultsDir = join(repoRoot, 'eval-results');
    const configPath = join(projectPath, '.storybook', 'main.ts');

    writeEvalSupportFixture(projectPath, repoRoot);
    const originalConfig = readFileSync(configPath, 'utf-8');

    const publish = await publishTrialBranch({
      project: {
        name: 'mealdrop',
        repo: 'https://github.com/storybook-tmp/mealdrop',
        branch: 'main',
        githubSlug: 'storybook-tmp/mealdrop',
      },
      workspace: {
        trialDir: join(TMP, 'trial'),
        sourceDir: join(TMP, 'source'),
        repoRoot,
        projectPath,
        resultsDir,
        baselineCommit: 'deadbeef',
        trialBranch: 'trial/foo',
      },
      variant: {
        agent: 'claude',
        model: 'sonnet-4.6',
        effort: 'high',
      },
      prompt: 'setup',
      trialId: 'trial-123',
      score: 0.91,
      screenshots: [
        {
          storyFilePath: 'src/Button.stories.tsx',
          exportName: 'Primary',
          imagePath: 'src/Button.stories.Primary.chromium.png',
        },
      ],
      logger: createLogger(),
    });

    expect(publish).toMatchObject({
      branch: 'trial/foo',
      prUrl: 'https://github.com/storybook-tmp/mealdrop/pull/123',
      summaryUrl:
        'https://github.com/storybook-tmp/mealdrop/blob/trial/foo/eval-results/summary.json',
      transcriptUrl:
        'https://github.com/storybook-tmp/mealdrop/blob/trial/foo/eval-results/transcript.json',
    });

    expect(readFileSync(configPath, 'utf-8')).toBe(originalConfig);

    const prBody = readFileSync(join(resultsDir, 'pr-body.md'), 'utf-8');
    expect(prBody).toContain('Trial ID: `trial-123`');
    expect(prBody).toContain('Score: `0.91`');
    expect(prBody).toContain(
      '[src/Button.stories.Primary.chromium.png](https://github.com/storybook-tmp/mealdrop/blob/trial/foo/src/Button.stories.Primary.chromium.png)'
    );
    expect(prBody).not.toContain('## Chromatic');

    expect(calls).toEqual(
      expect.arrayContaining([
        {
          cmd: 'git',
          args: ['add', '-A'],
          cwd: repoRoot,
        },
        {
          cmd: 'git',
          args: ['commit', '-m', 'eval: trial-123'],
          cwd: repoRoot,
        },
        {
          cmd: 'git',
          args: ['push', '--set-upstream', 'origin', 'trial/foo'],
          cwd: repoRoot,
        },
      ])
    );

    const labelCreateCalls = calls.filter(
      (call) => call.cmd === 'gh' && call.args[0] === 'label' && call.args[1] === 'create'
    );
    for (const call of labelCreateCalls) {
      expect(call.args).not.toContain('--color');
    }
  });

  it('fails with a clear error when eval support files are missing', async () => {
    vi.doMock('tinyexec', () => ({
      x: vi.fn(async (cmd: string, args: string[]) => {
        if (cmd === 'gh' && args[0] === 'label' && args[1] === 'list') {
          return createExecResult('');
        }

        return createExecResult();
      }),
    }));

    const { publishTrialBranch } = await import('./publish-trial.ts');
    const repoRoot = join(TMP, 'repo');
    const projectPath = join(repoRoot, 'packages', 'app');
    const resultsDir = join(repoRoot, 'eval-results');

    mkdirSync(join(projectPath, '.storybook'), { recursive: true });
    mkdirSync(resultsDir, { recursive: true });
    writeFileSync(
      join(projectPath, '.storybook', 'main.ts'),
      "export default { stories: ['../src/**/*.stories.tsx'] };"
    );

    await expect(
      publishTrialBranch({
        project: {
          name: 'mealdrop',
          repo: 'https://github.com/storybook-tmp/mealdrop',
          branch: 'main',
          githubSlug: 'storybook-tmp/mealdrop',
        },
        workspace: {
          trialDir: join(TMP, 'trial'),
          sourceDir: join(TMP, 'source'),
          repoRoot,
          projectPath,
          resultsDir,
          baselineCommit: 'deadbeef',
          trialBranch: 'trial/bar',
        },
        variant: {
          agent: 'codex',
          model: 'gpt-5.4',
          effort: 'high',
        },
        prompt: 'setup',
        trialId: 'trial-456',
        score: 1,
        screenshots: [],
        logger: createLogger(),
      })
    ).rejects.toThrow('Eval support is not configured for mealdrop');
  });

  it('does not recreate labels that already exist in the repo', async () => {
    const calls: Array<{ cmd: string; args: string[]; cwd?: string }> = [];

    vi.doMock('tinyexec', () => ({
      x: vi.fn(async (cmd: string, args: string[], options?: { nodeOptions?: { cwd?: string } }) => {
        calls.push({ cmd, args, cwd: options?.nodeOptions?.cwd });

        if (cmd === 'gh' && args[0] === 'label' && args[1] === 'list') {
          return createExecResult(
            [
              'eval\tAutomated eval label for eval\t#D93F0B',
              'project:mealdrop\tAutomated eval label for project:mealdrop\t#1D76DB',
              'agent:claude\tAutomated eval label for agent:claude\t#C5DEF5',
              'model:sonnet-4.6\tAutomated eval label for model:sonnet-4.6\t#FBCA04',
              'effort:high\tAutomated eval label for effort:high\t#0E8A16',
              'prompt:setup\tAutomated eval label for prompt:setup\t#BFDADC',
            ].join('\n')
          );
        }

        if (cmd === 'git' && args[0] === 'config' && args.length === 2) {
          return createExecResult('', 1);
        }

        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'create') {
          return createExecResult('https://github.com/storybook-tmp/mealdrop/pull/789\n');
        }

        return createExecResult();
      }),
    }));

    const { publishTrialBranch } = await import('./publish-trial.ts');
    const repoRoot = join(TMP, 'repo');
    const projectPath = join(repoRoot, 'packages', 'app');
    const resultsDir = join(repoRoot, 'eval-results');

    writeEvalSupportFixture(projectPath, repoRoot);

    await publishTrialBranch({
      project: {
        name: 'mealdrop',
        repo: 'https://github.com/storybook-tmp/mealdrop',
        branch: 'main',
        githubSlug: 'storybook-tmp/mealdrop',
      },
      workspace: {
        trialDir: join(TMP, 'trial'),
        sourceDir: join(TMP, 'source'),
        repoRoot,
        projectPath,
        resultsDir,
        baselineCommit: 'deadbeef',
        trialBranch: 'trial/baz',
      },
      variant: {
        agent: 'claude',
        model: 'sonnet-4.6',
        effort: 'high',
      },
      prompt: 'setup',
      trialId: 'trial-789',
      score: 1,
      screenshots: [],
      logger: createLogger(),
    });

    const labelCreateCalls = calls.filter(
      (call) => call.cmd === 'gh' && call.args[0] === 'label' && call.args[1] === 'create'
    );
    expect(labelCreateCalls).toHaveLength(0);
  });
});

import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TrialConfig, TrialReport } from './run-trial.ts';

// Mock external dependencies to avoid real git/storybook/vitest calls
vi.mock('./prepare-trial', () => ({
  prepareTrial: vi.fn(),
}));
vi.mock('./grade', () => ({
  grade: vi.fn(),
  collectGhostStoriesGrade: vi.fn(),
}));
vi.mock('./publish-trial', () => ({
  publishTrialBranch: vi.fn().mockResolvedValue({
    branch: 'trial/test-branch',
    labels: [
      'eval',
      'project:test-project',
      'agent:claude',
      'model:sonnet-4.6',
      'effort:high',
      'prompt:setup',
    ],
    url: 'https://github.com/storybook-tmp/test-project/pull/123',
  }),
}));
vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>();
  return {
    ...actual,
    captureEnvironment: vi.fn().mockResolvedValue({
      nodeVersion: 'v22.21.1',
      evalBranch: 'test-branch',
      evalCommit: 'abc123',
    }),
  };
});
vi.mock('./agents/claude-code', () => ({
  claudeAgent: { name: 'claude', execute: vi.fn() },
}));
vi.mock('./agents/codex', () => ({
  codexAgent: { name: 'codex', execute: vi.fn() },
}));
vi.mock('tinyexec', () => ({
  x: vi.fn().mockResolvedValue({
    exitCode: 0,
    stdout: '# Storybook Setup\n\nFull project-aware instructions...',
    stderr: '',
  }),
}));

import { x } from 'tinyexec';
import { claudeAgent } from './agents/claude-code.ts';
import { collectGhostStoriesGrade, grade } from './grade.ts';
import { prepareTrial } from './prepare-trial.ts';
import { publishTrialBranch } from './publish-trial.ts';
import { runTrial } from './run-trial.ts';
import { captureEnvironment } from './utils.ts';

let TMP: string;

beforeEach(() => {
  vi.clearAllMocks();
  TMP = join(tmpdir(), `eval-run-trial-${Date.now()}`);
  mkdirSync(join(TMP, '.storybook', 'eval-results'), { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

const baseConfig: TrialConfig = {
  project: {
    name: 'test-project',
    repo: 'https://github.com/storybook-tmp/test-project',
    branch: 'main',
    githubSlug: 'storybook-tmp/test-project',
  },
  variant: { agent: 'claude', model: 'sonnet-4.6', effort: 'high' },
  prompt: 'setup',
};

describe('runTrial pipeline', () => {
  it('assembles a complete TrialReport from pipeline steps', async () => {
    setupMocks();

    const result = await runTrial(baseConfig);

    expect(result).toMatchObject({
      schemaVersion: 4,
      id: expect.any(String),
      project: {
        name: 'test-project',
        repo: 'https://github.com/storybook-tmp/test-project',
        branch: 'main',
      },
      variant: { agent: 'claude', model: 'sonnet-4.6', effort: 'high' },
      prompt: {
        name: 'setup',
      },
      baselineCommit: 'deadbeef',
      execution: {
        cost: 0.42,
        duration: 45.2,
        turns: 12,
      },
      grade: {
        baselineGhostStories: {
          candidateCount: 5,
          total: 4,
          passed: 2,
          successRate: 0.5,
        },
        ghostStories: {
          candidateCount: 5,
          total: 4,
          passed: 3,
          successRate: 0.75,
        },
        baselinePreviewStories: {
          total: 6,
          passed: 2,
          storyFiles: 3,
        },
        buildSuccess: true,
      },
      score: {
        score: 0.5,
      },
      publish: {
        branch: 'trial/test-branch',
        url: 'https://github.com/storybook-tmp/test-project/pull/123',
      },
    });
    expect(result).not.toHaveProperty('screenshots');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('calls pipeline steps with correct arguments', async () => {
    setupMocks();

    const config: TrialConfig = {
      ...baseConfig,
      project: {
        name: 'mealdrop',
        repo: 'https://github.com/storybook-tmp/mealdrop',
        branch: 'main',
        githubSlug: 'storybook-tmp/mealdrop',
      },
    };

    await runTrial(config);

    expect(vi.mocked(prepareTrial).mock.calls[0][0]).toMatchObject({
      name: 'mealdrop',
      repo: 'https://github.com/storybook-tmp/mealdrop',
      branch: 'main',
    });
    expect(vi.mocked(prepareTrial).mock.calls[0][2]).toBeDefined();

    expect(vi.mocked(captureEnvironment)).toHaveBeenCalledWith();

    const params = vi.mocked(claudeAgent.execute).mock.calls[0][0];
    expect(params).toMatchObject({
      prompt: expect.stringContaining('npx storybook ai setup'),
      projectPath: TMP,
      variant: { agent: 'claude', model: 'sonnet-4.6', effort: 'high' },
      resultsDir: join(TMP, '.storybook', 'eval-results'),
      env: { EVAL_SETUP_PROMPT: 'setup' },
    });
    expect(params.logger).toBeDefined();

    expect(vi.mocked(x)).toHaveBeenCalledWith(
      'npx',
      ['storybook', 'ai', 'setup'],
      expect.objectContaining({
        nodeOptions: expect.objectContaining({
          cwd: TMP,
          env: expect.objectContaining({
            EVAL_SETUP_PROMPT: 'setup',
            STORYBOOK_DISABLE_TELEMETRY: '1',
          }),
        }),
      })
    );

    const gradeWorkspace = vi.mocked(grade).mock.calls[0][0];
    expect(gradeWorkspace).toMatchObject({
      baselineCommit: 'deadbeef',
      projectPath: TMP,
      resultsDir: join(TMP, '.storybook', 'eval-results'),
    });
    expect(vi.mocked(grade).mock.calls[0][1]).toBeDefined();
    expect(vi.mocked(collectGhostStoriesGrade)).toHaveBeenCalledWith(
      TMP,
      expect.anything(),
      'baseline ghost stories'
    );
    expect(vi.mocked(grade).mock.calls[0][2]).toMatchObject({
      candidateCount: 5,
      total: 4,
      passed: 2,
      successRate: 0.5,
    });
    expect(vi.mocked(publishTrialBranch).mock.calls[0][0]).toMatchObject({
      data: expect.objectContaining({
        id: expect.any(String),
        prompt: expect.objectContaining({ name: 'setup' }),
      }),
      workspace: expect.objectContaining({
        trialBranch: 'trial/test-branch',
      }),
    });
  });

  it('writes data.json and prompt.md to results dir', async () => {
    setupMocks();

    await runTrial(baseConfig);

    const resultsDir = join(TMP, '.storybook', 'eval-results');

    const data: TrialReport = JSON.parse(readFileSync(join(resultsDir, 'data.json'), 'utf-8'));
    expect(data).toMatchObject({
      schemaVersion: 4,
      id: expect.any(String),
      execution: { cost: 0.42 },
      grade: {
        buildSuccess: true,
        baselineGhostStories: {
          candidateCount: 5,
          total: 4,
          passed: 2,
          successRate: 0.5,
        },
      },
      prompt: {
        name: 'setup',
        content: expect.stringContaining('Full project-aware instructions'),
      },
      artifacts: {
        buildOutput: { path: '.storybook/eval-results/build-output.txt', success: true },
        typecheckOutput: {
          path: '.storybook/eval-results/typecheck-output.txt',
          errorCount: 0,
        },
      },
      docs: {
        transcript: {
          prompt: expect.stringContaining('Full project-aware instructions'),
        },
      },
    });
    expect(data).not.toHaveProperty('screenshots');
    expect(data).not.toHaveProperty('artifacts.screenshotOutput');

    const promptContent = readFileSync(join(resultsDir, 'prompt.md'), 'utf-8');
    expect(promptContent).toContain('npx storybook ai setup');
    expect(() => readFileSync(join(resultsDir, 'summary.json'), 'utf-8')).toThrow();
    expect(() => readFileSync(join(resultsDir, 'transcript.json'), 'utf-8')).toThrow();
  });

  it('propagates failed build into result', async () => {
    setupMocks({ buildSuccess: false, typeCheckErrors: 5 });

    await expect(runTrial(baseConfig)).resolves.toMatchObject({
      grade: { buildSuccess: false, typeCheckErrors: 5 },
      score: { score: 0 },
    });
  });

  it('does not include screenshot-era fields when the build fails', async () => {
    setupMocks({ buildSuccess: false, typeCheckErrors: 5 });

    await runTrial(baseConfig);

    expect(vi.mocked(publishTrialBranch)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          artifacts: expect.not.objectContaining({
            screenshotOutput: expect.anything(),
          }),
        }),
      })
    );
  });

  it('keeps play-prompt output on the no-screenshot schema', async () => {
    setupMocks();

    await runTrial({
      ...baseConfig,
      prompt: 'pattern-copy-play',
    });

    expect(vi.mocked(publishTrialBranch)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          prompt: expect.objectContaining({ name: 'pattern-copy-play' }),
          artifacts: expect.not.objectContaining({
            screenshotOutput: expect.anything(),
          }),
        }),
      })
    );
  });

  it('does not call grade before agent finishes', async () => {
    // Use execution order tracking to verify sequencing
    const callOrder: string[] = [];

    vi.mocked(prepareTrial).mockImplementation(async () => {
      callOrder.push('prepare');
      return {
        trialDir: TMP,
        sourceDir: join(TMP, 'source'),
        repoRoot: TMP,
        projectPath: TMP,
        resultsDir: join(TMP, '.storybook', 'eval-results'),
        baselineCommit: 'deadbeef',
        trialBranch: 'trial/test-branch',
      };
    });

    vi.mocked(claudeAgent.execute).mockImplementation(async () => {
      callOrder.push('agent');
      return {
        execution: { cost: 0.1, duration: 10, turns: 3 },
        transcript: [],
      };
    });

    vi.mocked(collectGhostStoriesGrade).mockImplementation(async () => {
      callOrder.push('baseline-ghost');
      return {
        candidateCount: 3,
        total: 2,
        passed: 1,
        successRate: 0.5,
      };
    });

    vi.mocked(grade).mockImplementation(async () => {
      callOrder.push('grade');
      return {
        grade: {
          buildSuccess: true,
          typeCheckErrors: 0,
          fileChanges: [],
          storybookChanges: [],
          hasCssCheckStory: false,
        },
        score: {
          score: 0,
          breakdown: {
            beforeRate: 0,
            afterRate: 0,
            gain: 0,
          },
        },
      };
    });

    await runTrial(baseConfig);

    expect(callOrder).toEqual(['prepare', 'baseline-ghost', 'agent', 'grade']);
  });
});

function setupMocks(overrides?: {
  buildSuccess?: boolean;
  typeCheckErrors?: number;
  cost?: number;
}) {
  const { buildSuccess = true, typeCheckErrors = 0, cost = 0.42 } = overrides ?? {};

  vi.mocked(prepareTrial).mockResolvedValue({
    trialDir: TMP,
    sourceDir: join(TMP, 'source'),
    repoRoot: TMP,
    projectPath: TMP,
    resultsDir: join(TMP, '.storybook', 'eval-results'),
    baselineCommit: 'deadbeef',
    trialBranch: 'trial/test-branch',
  });

  vi.mocked(claudeAgent.execute).mockResolvedValue({
    execution: {
      cost,
      duration: 45.2,
      turns: 12,
      terminalResultSubtype: 'success',
    },
    transcript: [
      {
        type: 'assistant',
        message: {
          content: [{ type: 'text', text: 'done' }],
          usage: { input_tokens: 1, output_tokens: 1 },
        },
      },
    ],
  });

  vi.mocked(collectGhostStoriesGrade).mockResolvedValue({
    candidateCount: 5,
    total: 4,
    passed: 2,
    successRate: 0.5,
  });

  vi.mocked(grade).mockResolvedValue({
    grade: {
      baselineGhostStories: {
        candidateCount: 5,
        total: 4,
        passed: 2,
        successRate: 0.5,
      },
      ghostStories: buildSuccess
        ? {
            candidateCount: 5,
            total: 4,
            passed: 3,
            successRate: 0.75,
          }
        : undefined,
      baselinePreviewStories: {
        total: 6,
        passed: 2,
        storyFiles: 3,
      },
      buildSuccess,
      typeCheckErrors,
      fileChanges: [
        { path: '.storybook/preview.tsx', gitStatus: 'A' },
        { path: 'src/Button.stories.tsx', gitStatus: 'A' },
      ],
      storybookChanges: [
        { path: '.storybook/preview.tsx', gitStatus: 'A' },
        { path: 'src/Button.stories.tsx', gitStatus: 'A' },
      ],
      hasCssCheckStory: true,
      ...(buildSuccess
        ? {
            storyRender: {
              total: 6,
              passed: 4,
              storyFiles: 3,
            },
          }
        : {}),
    },
    score: {
      score: buildSuccess ? 0.5 : 0,
      breakdown: {
        beforeRate: 2 / 6,
        afterRate: buildSuccess ? 4 / 6 : 0,
        gain: buildSuccess ? 0.5 : 0,
      },
    },
  });
}

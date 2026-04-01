import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TrialConfig, TrialReport } from './run-trial';

// Mock external dependencies to avoid real git/storybook/vitest calls
vi.mock('./prepare-trial', () => ({
  prepareTrial: vi.fn(),
}));
vi.mock('./grade', () => ({
  grade: vi.fn(),
}));
vi.mock('./publish-trial', () => ({
  buildTrialArtifactUrls: vi.fn().mockReturnValue({
    summaryUrl:
      'https://github.com/storybook-tmp/test-project/blob/trial/test/eval-results/summary.json',
    transcriptUrl:
      'https://github.com/storybook-tmp/test-project/blob/trial/test/eval-results/transcript.json',
  }),
  buildTrialLabels: vi
    .fn()
    .mockReturnValue([
      'eval',
      'project:test-project',
      'agent:claude',
      'model:sonnet-4.6',
      'effort:high',
      'prompt:setup',
    ]),
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
    prUrl: 'https://github.com/storybook-tmp/test-project/pull/1',
    summaryUrl:
      'https://github.com/storybook-tmp/test-project/blob/trial/test-branch/eval-results/summary.json',
    transcriptUrl:
      'https://github.com/storybook-tmp/test-project/blob/trial/test-branch/eval-results/transcript.json',
    screenshots: [
      {
        storyFilePath: 'src/Button.stories.tsx',
        exportName: 'Primary',
        imagePath: 'src/Button.stories.Primary.chromium.png',
      },
    ],
  }),
}));
vi.mock('./screenshots', () => ({
  runStorybookScreenshots: vi.fn().mockResolvedValue([
    {
      storyFilePath: 'src/Button.stories.tsx',
      exportName: 'Primary',
      imagePath: 'src/Button.stories.Primary.chromium.png',
    },
  ]),
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

import { claudeAgent } from './agents/claude-code';
import { grade } from './grade';
import { prepareTrial } from './prepare-trial';
import { publishTrialBranch } from './publish-trial';
import { runTrial } from './run-trial';
import { runStorybookScreenshots } from './screenshots';
import { captureEnvironment } from './utils';

let TMP: string;

beforeEach(() => {
  vi.clearAllMocks();
  TMP = join(tmpdir(), `eval-run-trial-${Date.now()}`);
  mkdirSync(join(TMP, 'eval-results'), { recursive: true });
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
      schemaVersion: 2,
      project: {
        name: 'test-project',
        repo: 'https://github.com/storybook-tmp/test-project',
        branch: 'main',
      },
      variant: { agent: 'claude', model: 'sonnet-4.6', effort: 'high' },
      prompt: 'setup',
      baselineCommit: 'deadbeef',
      execution: {
        cost: 0.42,
        duration: 45.2,
        turns: 12,
      },
      grade: {
        buildSuccess: true,
      },
      score: {
        score: 1,
      },
      publish: {
        branch: 'trial/test-branch',
        prUrl: 'https://github.com/storybook-tmp/test-project/pull/1',
      },
    });
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

    expect(vi.mocked(captureEnvironment).mock.calls[0][0]).toBe(join(TMP, 'eval-results'));

    const params = vi.mocked(claudeAgent.execute).mock.calls[0][0];
    expect(params).toMatchObject({
      prompt: expect.stringContaining('set up Storybook'),
      projectPath: TMP,
      variant: { agent: 'claude', model: 'sonnet-4.6', effort: 'high' },
      resultsDir: join(TMP, 'eval-results'),
    });
    expect(params.logger).toBeDefined();

    const gradeWorkspace = vi.mocked(grade).mock.calls[0][0];
    expect(gradeWorkspace).toMatchObject({
      baselineCommit: 'deadbeef',
      projectPath: TMP,
      resultsDir: join(TMP, 'eval-results'),
    });
    expect(vi.mocked(grade).mock.calls[0][1]).toBeDefined();
    expect(vi.mocked(runStorybookScreenshots).mock.calls[0][0]).toMatchObject({
      projectPath: TMP,
      repoRoot: TMP,
      resultsDir: join(TMP, 'eval-results'),
    });
    expect(vi.mocked(publishTrialBranch).mock.calls[0][0]).toMatchObject({
      prompt: 'setup',
      trialId: expect.any(String),
      score: 1,
      workspace: expect.objectContaining({
        trialBranch: 'trial/test-branch',
      }),
    });
  });

  it('writes summary.json and prompt.md to results dir', async () => {
    setupMocks();

    await runTrial(baseConfig);

    const resultsDir = join(TMP, 'eval-results');

    const summary: TrialReport = JSON.parse(
      readFileSync(join(resultsDir, 'summary.json'), 'utf-8')
    );
    expect(summary).toMatchObject({
      schemaVersion: 2,
      execution: { cost: 0.42 },
      grade: { buildSuccess: true },
      publish: {
        branch: 'trial/test-branch',
        labels: expect.arrayContaining(['prompt:setup']),
      },
    });

    const promptContent = readFileSync(join(resultsDir, 'prompt.md'), 'utf-8');
    expect(promptContent).toContain('set up Storybook');
    expect(() => readFileSync(join(resultsDir, 'summary.mdx'), 'utf-8')).toThrow();
    expect(() => readFileSync(join(resultsDir, 'transcript.mdx'), 'utf-8')).toThrow();
    expect(() => readFileSync(join(resultsDir, 'transcript-data.json'), 'utf-8')).toThrow();
  });

  it('propagates failed build into result', async () => {
    setupMocks({ buildSuccess: false, typeCheckErrors: 5 });

    await expect(runTrial(baseConfig)).resolves.toMatchObject({
      grade: { buildSuccess: false, typeCheckErrors: 5 },
      score: { score: 0.3 },
    });
  });

  it('skips screenshot generation when the build fails', async () => {
    setupMocks({ buildSuccess: false, typeCheckErrors: 5 });

    await runTrial(baseConfig);

    expect(vi.mocked(runStorybookScreenshots)).not.toHaveBeenCalled();
    expect(vi.mocked(publishTrialBranch)).toHaveBeenCalledWith(
      expect.objectContaining({
        screenshots: [],
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
        resultsDir: join(TMP, 'eval-results'),
        baselineCommit: 'deadbeef',
        trialBranch: 'trial/test-branch',
      };
    });

    vi.mocked(claudeAgent.execute).mockImplementation(async () => {
      callOrder.push('agent');
      return { cost: 0.1, duration: 10, turns: 3 };
    });

    vi.mocked(grade).mockImplementation(async () => {
      callOrder.push('grade');
      return {
        grade: {
          buildSuccess: true,
          typeCheckErrors: 0,
          fileChanges: [],
          storybookChanges: [],
        },
        score: { score: 1, breakdown: { build: 1, typecheck: 1, ghostStories: 0, performance: 0 } },
      };
    });

    await runTrial(baseConfig);

    expect(callOrder).toEqual(['prepare', 'agent', 'grade']);
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
    resultsDir: join(TMP, 'eval-results'),
    baselineCommit: 'deadbeef',
    trialBranch: 'trial/test-branch',
  });

  vi.mocked(claudeAgent.execute).mockResolvedValue({
    cost,
    duration: 45.2,
    turns: 12,
  });

  vi.mocked(grade).mockResolvedValue({
    grade: {
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
    },
    score: {
      score: buildSuccess ? 1 : 0.3,
      breakdown: { build: buildSuccess ? 1 : 0, typecheck: 1, ghostStories: 0, performance: 0 },
    },
  });
}

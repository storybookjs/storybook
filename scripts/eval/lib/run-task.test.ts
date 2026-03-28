import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TrialConfig, TrialResult } from '../types';

// Mock external dependencies to avoid real git/storybook/vitest calls
vi.mock('./prepare-trial', () => ({
  prepareTrial: vi.fn(),
}));
vi.mock('./grade', () => ({
  grade: vi.fn(),
}));
vi.mock('./save', () => ({
  captureEnvironment: vi.fn().mockResolvedValue({
    nodeVersion: 'v22.21.1',
    evalBranch: 'test-branch',
    evalCommit: 'abc123',
  }),
  saveToGoogleSheets: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./agents/claude-code', () => ({
  claudeAgent: { name: 'claude', execute: vi.fn() },
}));
vi.mock('./agents/codex', () => ({
  codexAgent: { name: 'codex', execute: vi.fn() },
}));

import { claudeAgent } from './agents/claude-code';
import { grade } from './grade';
import { prepareTrial } from './prepare-trial';
import { runTask } from './run-task';
import { captureEnvironment, saveToGoogleSheets } from './save';

let TMP: string;

beforeEach(() => {
  vi.clearAllMocks();
  TMP = join(tmpdir(), `eval-run-task-${Date.now()}`);
  mkdirSync(join(TMP, 'results'), { recursive: true });
});

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true });
});

function setupMocks(overrides?: {
  buildSuccess?: boolean;
  typeCheckErrors?: number;
  cost?: number;
}) {
  const { buildSuccess = true, typeCheckErrors = 0, cost = 0.42 } = overrides ?? {};

  vi.mocked(prepareTrial).mockResolvedValue({
    trialDir: TMP,
    repoRoot: TMP,
    projectPath: TMP,
    resultsDir: join(TMP, 'results'),
    baselineCommit: 'deadbeef',
  });

  vi.mocked(claudeAgent.execute).mockResolvedValue({
    agent: 'claude',
    model: 'sonnet-4.6',
    effort: 'high',
    cost,
    duration: 45.2,
    turns: 12,
  });

  vi.mocked(grade).mockResolvedValue({
    grading: {
      buildSuccess,
      typeCheckErrors,
      changedFiles: [
        { path: '.storybook/preview.tsx', status: 'A' },
        { path: 'src/Button.stories.tsx', status: 'A' },
      ],
      storybookFiles: [
        { path: '.storybook/preview.tsx', status: 'A' },
        { path: 'src/Button.stories.tsx', status: 'A' },
      ],
      setupPatterns: [{ id: 'tailwind', label: 'Tailwind CSS', sourceFiles: ['.storybook/preview.ts'] }],
    },
    quality: { score: buildSuccess ? 1 : 0.3, breakdown: { build: buildSuccess ? 1 : 0, typecheck: 1, ghostStories: 0, performance: 0 } },
  });
}

const baseConfig: TrialConfig = {
  project: { name: 'test-project', repo: 'https://github.com/test/repo', branch: 'main' },
  agent: 'claude',
  model: 'sonnet-4.6',
  effort: 'high',
  prompt: 'setup',
};

describe('runTask pipeline', () => {
  it('assembles a complete TrialResult from pipeline steps', async () => {
    setupMocks();

    const result = await runTask(baseConfig, 'run-123', 'upload-456');

    // Config fields mapped correctly
    expect(result.schemaVersion).toBe(1);
    expect(result.project).toBe('test-project');
    expect(result.agent).toBe('claude');
    expect(result.model).toBe('sonnet-4.6');
    expect(result.effort).toBe('high');
    expect(result.prompt).toBe('setup');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // prepareTrial output flows into result
    expect(result.baselineCommit).toBe('deadbeef');

    // Agent execution output flows into result
    expect(result.execution).toEqual({
      agent: 'claude',
      model: 'sonnet-4.6',
      effort: 'high',
      cost: 0.42,
      duration: 45.2,
      turns: 12,
    });

    // Grade output flows into result
    expect(result.grading.buildSuccess).toBe(true);
    expect(result.quality.score).toBe(1);
  });

  it('calls pipeline steps with correct arguments', async () => {
    setupMocks();

    const config: TrialConfig = {
      ...baseConfig,
      project: { name: 'mealdrop', repo: 'https://github.com/test/mealdrop', branch: 'eval-baseline' },
    };

    await runTask(config, 'run-1', 'upload-1');

    // prepareTrial receives the project and a logger
    expect(vi.mocked(prepareTrial).mock.calls[0][0].name).toBe('mealdrop');
    // Third arg is the logger
    expect(vi.mocked(prepareTrial).mock.calls[0][2]).toBeDefined();

    // captureEnvironment receives the results dir
    expect(vi.mocked(captureEnvironment).mock.calls[0][0]).toBe(join(TMP, 'results'));

    // Agent receives a params object with prompt, projectPath, model, effort, resultsDir, logger
    const params = vi.mocked(claudeAgent.execute).mock.calls[0][0] as Record<string, unknown>;
    expect(params.prompt).toContain('Storybook setup');
    expect(params.projectPath).toBe(TMP);
    expect(params.model).toBe('sonnet-4.6');
    expect(params.effort).toBe('high');
    expect(params.resultsDir).toBe(join(TMP, 'results'));
    expect(params.logger).toBeDefined();

    // grade receives the trial paths and a logger
    const gradePaths = vi.mocked(grade).mock.calls[0][0];
    expect(gradePaths.baselineCommit).toBe('deadbeef');
    expect(gradePaths.projectPath).toBe(TMP);
    // Second arg is the logger
    expect(vi.mocked(grade).mock.calls[0][1]).toBeDefined();

    // saveToGoogleSheets receives the assembled result + env + IDs + logger
    const [savedResult, savedEnv, savedRunId, savedUploadId] =
      vi.mocked(saveToGoogleSheets).mock.calls[0];
    expect(savedResult.project).toBe('mealdrop');
    expect(savedEnv.evalBranch).toBe('test-branch');
    expect(savedRunId).toBe('run-1');
    expect(savedUploadId).toBe('upload-1');
  });

  it('writes summary.json and prompt.md to results dir', async () => {
    setupMocks();

    await runTask(baseConfig, 'run-1', 'upload-1');

    const resultsDir = join(TMP, 'results');

    // summary.json is parseable and matches the returned result
    const summary: TrialResult = JSON.parse(readFileSync(join(resultsDir, 'summary.json'), 'utf-8'));
    expect(summary.schemaVersion).toBe(1);
    expect(summary.execution.cost).toBe(0.42);
    expect(summary.grading.buildSuccess).toBe(true);

    // prompt.md contains the real setup prompt
    const promptContent = readFileSync(join(resultsDir, 'prompt.md'), 'utf-8');
    expect(promptContent).toContain('Storybook setup');
  });

  it('propagates failed build into result', async () => {
    setupMocks({ buildSuccess: false, typeCheckErrors: 5 });

    const result = await runTask(baseConfig, 'run-1', 'upload-1');
    expect(result.grading.buildSuccess).toBe(false);
    expect(result.quality.score).toBe(0.3);
  });

  it('does not call grade before agent finishes', async () => {
    // Use execution order tracking to verify sequencing
    const callOrder: string[] = [];

    vi.mocked(prepareTrial).mockImplementation(async () => {
      callOrder.push('prepare');
      return {
        trialDir: TMP,
        repoRoot: TMP,
        projectPath: TMP,
        resultsDir: join(TMP, 'results'),
        baselineCommit: 'deadbeef',
      };
    });

    vi.mocked(claudeAgent.execute).mockImplementation(async () => {
      callOrder.push('agent');
      return { agent: 'claude', model: 'sonnet-4.6', effort: 'high', cost: 0.1, duration: 10, turns: 3 };
    });

    vi.mocked(grade).mockImplementation(async () => {
      callOrder.push('grade');
      return {
        grading: {
          buildSuccess: true,
          typeCheckErrors: 0,
          changedFiles: [],
          storybookFiles: [],
          setupPatterns: [],
        },
        quality: { score: 1, breakdown: { build: 1, typecheck: 1, ghostStories: 0, performance: 0 } },
      };
    });

    vi.mocked(saveToGoogleSheets).mockImplementation(async () => {
      callOrder.push('save');
    });

    await runTask(baseConfig, 'run-1', 'upload-1');

    expect(callOrder).toEqual(['prepare', 'agent', 'grade', 'save']);
  });
});

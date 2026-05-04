import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { NODE_EVAL_TRIAL_SCRIPT } from './lib/utils.ts';
import {
  BATCH_DEFAULT_CLAUDE_EFFORTS,
  BATCH_DEFAULT_EFFORTS,
  BATCH_DEFAULT_AGENT_IDS,
  BATCH_EXCLUDED_PROJECT_NAMES,
  BATCH_MATRIX_MODELS,
  BATCH_PROJECT_NAMES,
  BATCH_REPETITIONS,
  BATCH_VARIANTS,
  buildBatchRunDescriptors,
  buildBatchVariants,
  main,
  parseRunBatchArgs,
  runBatch,
  type SpawnedBatchChild,
} from './run-batch.ts';

const TEST_PROMPT = 'pattern-copy-play';

let TMP = '';

afterEach(() => {
  if (TMP) {
    rmSync(TMP, { recursive: true, force: true });
    TMP = '';
  }
});

describe('buildBatchRunDescriptors', () => {
  it('creates the default batch matrix with full repetition coverage', () => {
    const descriptors = buildBatchRunDescriptors({ prompt: TEST_PROMPT });
    const combinations = new Map<string, number[]>();

    expect(descriptors).toHaveLength(
      BATCH_PROJECT_NAMES.length * BATCH_VARIANTS.length * BATCH_REPETITIONS
    );
    expect(new Set(descriptors.map((descriptor) => descriptor.label)).size).toBe(
      descriptors.length
    );
    expect(new Set(descriptors.map((descriptor) => descriptor.project))).toEqual(
      new Set(BATCH_PROJECT_NAMES)
    );
    expect(new Set(descriptors.map((descriptor) => descriptor.prompt))).toEqual(
      new Set(['pattern-copy-play'])
    );
    expect(new Set(BATCH_PROJECT_NAMES)).not.toContain('baklava');

    for (const descriptor of descriptors) {
      const key = `${descriptor.project}:${descriptor.agent}:${descriptor.model}:${descriptor.effort}`;
      combinations.set(key, [...(combinations.get(key) ?? []), descriptor.repetition]);
      expect(descriptor.args).toEqual([
        NODE_EVAL_TRIAL_SCRIPT,
        '-p',
        descriptor.project,
        '-a',
        descriptor.agent,
        '-m',
        descriptor.model,
        '-e',
        descriptor.effort,
        '--prompt',
        descriptor.prompt,
      ]);
    }

    expect(combinations.size).toBe(BATCH_PROJECT_NAMES.length * BATCH_VARIANTS.length);

    for (const repetitions of combinations.values()) {
      expect([...repetitions].sort((a, b) => a - b)).toEqual(
        Array.from({ length: BATCH_REPETITIONS }, (_, index) => index + 1)
      );
    }
  });

  it('can restrict the batch to Claude only when explicitly requested', () => {
    const descriptors = buildBatchRunDescriptors({ prompt: TEST_PROMPT, agents: ['claude'] });

    expect(descriptors).toHaveLength(BATCH_PROJECT_NAMES.length * BATCH_REPETITIONS);
    expect(new Set(descriptors.map((descriptor) => descriptor.agent))).toEqual(new Set(['claude']));
  });

  it('uses the configured Claude effort override when building descriptors', () => {
    const descriptors = buildBatchRunDescriptors({ prompt: TEST_PROMPT, claudeEffort: 'high' });

    expect(
      new Set(
        descriptors
          .filter((descriptor) => descriptor.agent === 'claude')
          .map((descriptor) => descriptor.effort)
      )
    ).toEqual(new Set(['high']));
  });

  it('supports multiple Claude efforts in a single batch', () => {
    const descriptors = buildBatchRunDescriptors({
      prompt: TEST_PROMPT,
      agents: ['claude'],
      claudeEfforts: ['max', 'high'],
    });

    expect(descriptors).toHaveLength(BATCH_PROJECT_NAMES.length * 2 * BATCH_REPETITIONS);
    expect(
      new Set(
        descriptors
          .filter((descriptor) => descriptor.agent === 'claude')
          .map((descriptor) => descriptor.effort)
      )
    ).toEqual(new Set(['max', 'high']));
  });

  it('uses the configured codex effort override when codex is enabled', () => {
    const descriptors = buildBatchRunDescriptors({
      prompt: TEST_PROMPT,
      agents: ['claude', 'codex'],
      codexEffort: 'medium',
    });

    expect(
      new Set(
        descriptors
          .filter((descriptor) => descriptor.agent === 'codex')
          .map((descriptor) => descriptor.effort)
      )
    ).toEqual(new Set(['medium']));
  });

  it('uses a prompt override for every batch run descriptor', () => {
    const descriptors = buildBatchRunDescriptors({ prompt: TEST_PROMPT });

    expect(new Set(descriptors.map((descriptor) => descriptor.prompt))).toEqual(
      new Set(['pattern-copy-play'])
    );
    expect(descriptors[0]?.args).toContain('--prompt');
    expect(descriptors[0]?.args).toContain('pattern-copy-play');
    expect(descriptors[0]?.label).toContain('-pattern-copy-play-');
  });

  it('interleaves projects first so batch startup spreads across repos', () => {
    const descriptors = buildBatchRunDescriptors({ prompt: TEST_PROMPT });

    expect(
      descriptors
        .slice(0, BATCH_PROJECT_NAMES.length * BATCH_VARIANTS.length)
        .map((descriptor) => ({
          project: descriptor.project,
          agent: descriptor.agent,
          repetition: descriptor.repetition,
        }))
    ).toEqual([
      { project: 'mealdrop', agent: 'claude', repetition: 1 },
      { project: 'edgy', agent: 'claude', repetition: 1 },
      { project: 'wikitok', agent: 'claude', repetition: 1 },
      { project: 'echarts', agent: 'claude', repetition: 1 },
      { project: 'evergreen-ci', agent: 'claude', repetition: 1 },
      { project: 'excalidraw', agent: 'claude', repetition: 1 },
      { project: 'bluesky', agent: 'claude', repetition: 1 },
      { project: 'react-aria', agent: 'claude', repetition: 1 },
      { project: 'mealdrop', agent: 'codex', repetition: 1 },
      { project: 'edgy', agent: 'codex', repetition: 1 },
      { project: 'wikitok', agent: 'codex', repetition: 1 },
      { project: 'echarts', agent: 'codex', repetition: 1 },
      { project: 'evergreen-ci', agent: 'codex', repetition: 1 },
      { project: 'excalidraw', agent: 'codex', repetition: 1 },
      { project: 'bluesky', agent: 'codex', repetition: 1 },
      { project: 'react-aria', agent: 'codex', repetition: 1 },
    ]);
  });
});

describe('buildBatchVariants', () => {
  it('returns the default benchmark variants when no overrides are provided', () => {
    expect(buildBatchVariants()).toEqual(BATCH_VARIANTS);
    expect(BATCH_VARIANTS).toEqual([
      {
        agent: 'claude',
        model: BATCH_MATRIX_MODELS.claude,
        effort: BATCH_DEFAULT_CLAUDE_EFFORTS[0],
      },
      { agent: 'codex', model: BATCH_MATRIX_MODELS.codex, effort: BATCH_DEFAULT_EFFORTS.codex },
    ]);
  });

  it('enables both Claude and Codex by default', () => {
    expect(BATCH_DEFAULT_AGENT_IDS).toEqual(['claude', 'codex']);
  });

  it('excludes baklava from the default batch projects', () => {
    expect(BATCH_EXCLUDED_PROJECT_NAMES).toEqual(['baklava']);
    expect(BATCH_PROJECT_NAMES).toEqual([
      'mealdrop',
      'edgy',
      'wikitok',
      'echarts',
      'evergreen-ci',
      'excalidraw',
      'bluesky',
      'react-aria',
    ]);
  });

  it('supports Claude-only variants when requested', () => {
    expect(buildBatchVariants({ agents: ['claude'] })).toEqual([
      {
        agent: 'claude',
        model: BATCH_MATRIX_MODELS.claude,
        effort: BATCH_DEFAULT_CLAUDE_EFFORTS[0],
      },
    ]);
  });

  it('supports multiple Claude variants when multiple efforts are requested', () => {
    expect(buildBatchVariants({ agents: ['claude'], claudeEfforts: ['max', 'high'] })).toEqual([
      { agent: 'claude', model: BATCH_MATRIX_MODELS.claude, effort: 'max' },
      { agent: 'claude', model: BATCH_MATRIX_MODELS.claude, effort: 'high' },
    ]);
  });
});

describe('parseRunBatchArgs', () => {
  it('parses optional effort overrides, prompt, and concurrency from the CLI', () => {
    expect(
      parseRunBatchArgs([
        '--prompt',
        'pattern-copy-play',
        '--agents',
        'claude,codex',
        '--claude-effort',
        'high',
        '--codex-effort',
        'medium',
        '--concurrency',
        '3',
      ])
    ).toEqual({
      prompt: 'pattern-copy-play',
      agents: ['claude', 'codex'],
      claudeEffort: 'high',
      codexEffort: 'medium',
      concurrency: 3,
    });
  });

  it('parses multiple Claude efforts from the CLI', () => {
    expect(parseRunBatchArgs(['--prompt', TEST_PROMPT, '--claude-efforts', 'max,high'])).toEqual({
      prompt: TEST_PROMPT,
      claudeEfforts: ['max', 'high'],
    });
  });
});

describe('runBatch', () => {
  it('caps concurrency and keeps queued work moving as slots free up', async () => {
    TMP = mkdtempSync(join(tmpdir(), 'eval-run-batch-concurrency-'));
    const descriptors = buildBatchRunDescriptors({ prompt: TEST_PROMPT }).slice(0, 5);
    const controller = createControlledSpawn();

    const batchPromise = runBatch(
      {
        descriptors,
        concurrency: 2,
        evalRoot: TMP,
        batchTimestamp: '2026-04-03T04-05-06-789Z',
        log: () => {},
      },
      { spawn: controller.spawn }
    );

    await waitForCondition(
      () => controller.controllers.length === 2,
      'expected first two runs to start'
    );
    expect(controller.maxActive).toBe(2);

    controller.controllers[0].finish();
    await waitForCondition(
      () => controller.controllers.length === 3,
      'expected third run to start'
    );
    expect(controller.maxActive).toBe(2);

    controller.controllers[1].finish();
    await waitForCondition(
      () => controller.controllers.length === 4,
      'expected fourth run to start'
    );

    controller.controllers[2].finish();
    await waitForCondition(
      () => controller.controllers.length === 5,
      'expected fifth run to start'
    );

    controller.controllers[3].finish();
    controller.controllers[4].finish();

    const summary = await batchPromise;

    expect(summary.totalRuns).toBe(5);
    expect(summary.failed).toBe(0);
    expect(controller.maxActive).toBe(2);
  });

  it('continues after failures and returns a nonzero main result when any run fails', async () => {
    TMP = mkdtempSync(join(tmpdir(), 'eval-run-batch-failure-'));
    const descriptors = buildBatchRunDescriptors({ prompt: TEST_PROMPT }).slice(0, 3);
    const spawn = createAutoSpawn([0, 2, 0]);

    const exitCode = await main(
      {
        descriptors,
        concurrency: 3,
        evalRoot: TMP,
        batchTimestamp: '2026-04-03T06-07-08-999Z',
        log: () => {},
      },
      { spawn }
    );

    const summaryPath = join(TMP, 'batches', '2026-04-03T06-07-08-999Z', 'summary.json');
    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));

    expect(exitCode).toBe(1);
    expect(spawn).toHaveBeenCalledTimes(3);
    expect(summary.failed).toBe(1);
    expect(summary.succeeded).toBe(2);
    expect(summary.runs.map((run: { status: string }) => run.status)).toEqual([
      'success',
      'failed',
      'success',
    ]);
  });

  it('writes summary metadata and per-run logs under the batch directory', async () => {
    TMP = mkdtempSync(join(tmpdir(), 'eval-run-batch-summary-'));
    const descriptor = buildBatchRunDescriptors({ prompt: TEST_PROMPT })[0];
    const spawn = createAutoSpawn([0]);

    const summary = await runBatch(
      {
        descriptors: [descriptor],
        concurrency: 1,
        evalRoot: TMP,
        batchTimestamp: '2026-04-03T08-09-10-111Z',
        log: () => {},
      },
      { spawn }
    );

    const batchDir = join(TMP, 'batches', '2026-04-03T08-09-10-111Z');
    const logPath = join(batchDir, 'logs', `${descriptor.label}.log`);
    const persisted = JSON.parse(readFileSync(summary.summaryPath, 'utf-8'));

    expect(summary.batchDir).toBe(batchDir);
    expect(summary.logsDir).toBe(join(batchDir, 'logs'));
    expect(summary.summaryPath).toBe(join(batchDir, 'summary.json'));
    expect(summary.runs[0]).toMatchObject({
      ...descriptor,
      logPath,
      exitCode: 0,
      signal: null,
      status: 'success',
    });
    expect(persisted.runs[0].logPath).toBe(logPath);
    expect(existsSync(logPath)).toBe(true);

    const logContents = readFileSync(logPath, 'utf-8');
    expect(logContents).toContain(`$ node ${NODE_EVAL_TRIAL_SCRIPT}`);
    expect(logContents).toContain('--prompt pattern-copy-play');
    expect(logContents).toContain(`stdout:${descriptor.label}`);
    expect(logContents).toContain(`stderr:${descriptor.label}`);
  });
});

class MockChildProcess extends EventEmitter implements SpawnedBatchChild {
  pid?: number;
  stdout = new PassThrough();
  stderr = new PassThrough();

  constructor(pid: number) {
    super();
    this.pid = pid;
  }
}

function createControlledSpawn() {
  let active = 0;
  let maxActive = 0;
  let nextPid = 1000;
  const controllers: Array<{
    child: MockChildProcess;
    finish: (exitCode?: number | null, signal?: NodeJS.Signals | null) => void;
  }> = [];

  const spawn = vi.fn(() => {
    active += 1;
    maxActive = Math.max(maxActive, active);

    const child = new MockChildProcess(nextPid++);
    let settled = false;

    controllers.push({
      child,
      finish: (exitCode = 0, signal = null) => {
        if (settled) {
          return;
        }
        settled = true;
        child.stdout.end(`stdout:${child.pid}\n`);
        child.stderr.end(`stderr:${child.pid}\n`);
        active -= 1;
        child.emit('close', exitCode, signal);
      },
    });

    return child;
  });

  return {
    spawn,
    controllers,
    get maxActive() {
      return maxActive;
    },
  };
}

function createAutoSpawn(outcomes: Array<number | Error>) {
  let nextPid = 2000;

  return vi.fn((_command: string, args: string[]) => {
    const descriptor = getDescriptorFromArgs(args);
    const outcome = outcomes.shift() ?? 0;
    const child = new MockChildProcess(nextPid++);

    queueMicrotask(() => {
      child.stdout.end(`stdout:${descriptor.label}\n`);
      child.stderr.end(`stderr:${descriptor.label}\n`);

      if (outcome instanceof Error) {
        child.emit('error', outcome);
        return;
      }

      child.emit('close', outcome, null);
    });

    return child;
  });
}

function getDescriptorFromArgs(args: string[]) {
  const promptIndex = args.indexOf('--prompt');
  const prompt = promptIndex === -1 ? undefined : args[promptIndex + 1];
  const agentIndex = args.indexOf('-a');
  const agent = agentIndex === -1 ? undefined : args[agentIndex + 1];
  const effortIndex = args.indexOf('-e');
  const effort = effortIndex === -1 ? undefined : args[effortIndex + 1];
  const options: Parameters<typeof buildBatchRunDescriptors>[0] = {
    prompt: prompt ?? TEST_PROMPT,
  };

  if (agent === 'claude') {
    options.agents = ['claude'];
    if (effort === 'low' || effort === 'medium' || effort === 'high' || effort === 'max') {
      options.claudeEfforts = [effort];
    }
  }

  if (agent === 'codex') {
    options.agents = ['codex'];
    if (effort === 'low' || effort === 'medium' || effort === 'high' || effort === 'xhigh') {
      options.codexEffort = effort;
    }
  }

  const descriptors = buildBatchRunDescriptors(options);
  const descriptor = descriptors.find((candidate) => {
    return candidate.args.join('\0') === args.join('\0');
  });

  if (!descriptor) {
    throw new Error(`Unknown descriptor for args: ${args.join(' ')}`);
  }

  return descriptor;
}

async function waitForCondition(check: () => boolean, message: string) {
  const timeoutAt = Date.now() + 2_000;

  while (Date.now() < timeoutAt) {
    if (check()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  throw new Error(message);
}

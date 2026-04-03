import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BATCH_DEFAULT_EFFORTS,
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

let TMP = '';

afterEach(() => {
  if (TMP) {
    rmSync(TMP, { recursive: true, force: true });
    TMP = '';
  }
});

describe('buildBatchRunDescriptors', () => {
  it('creates the fixed 60-run matrix with full repetition coverage', () => {
    const descriptors = buildBatchRunDescriptors();
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

    for (const descriptor of descriptors) {
      const key = `${descriptor.project}:${descriptor.agent}:${descriptor.model}:${descriptor.effort}`;
      combinations.set(key, [...(combinations.get(key) ?? []), descriptor.repetition]);
      expect(descriptor.args).toEqual([
        './scripts/eval/eval.ts',
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

  it('uses configurable per-agent effort overrides when building descriptors', () => {
    const descriptors = buildBatchRunDescriptors({
      claudeEffort: 'high',
      codexEffort: 'medium',
    });

    expect(
      new Set(
        descriptors
          .filter((descriptor) => descriptor.agent === 'claude')
          .map((descriptor) => descriptor.effort)
      )
    ).toEqual(new Set(['high']));
    expect(
      new Set(
        descriptors
          .filter((descriptor) => descriptor.agent === 'codex')
          .map((descriptor) => descriptor.effort)
      )
    ).toEqual(new Set(['medium']));
  });

  it('uses a prompt override for every batch run descriptor', () => {
    const descriptors = buildBatchRunDescriptors({ prompt: 'pattern-copy' });

    expect(new Set(descriptors.map((descriptor) => descriptor.prompt))).toEqual(
      new Set(['pattern-copy'])
    );
    expect(descriptors[0]?.args).toContain('--prompt');
    expect(descriptors[0]?.args).toContain('pattern-copy');
    expect(descriptors[0]?.label).toContain('-pattern-copy-');
  });

  it('interleaves projects first so batch startup spreads across repos', () => {
    const descriptors = buildBatchRunDescriptors();

    expect(
      descriptors.slice(0, BATCH_PROJECT_NAMES.length * BATCH_VARIANTS.length).map((descriptor) => ({
        project: descriptor.project,
        agent: descriptor.agent,
        repetition: descriptor.repetition,
      }))
    ).toEqual([
      { project: 'edgy', agent: 'claude', repetition: 1 },
      { project: 'baklava', agent: 'claude', repetition: 1 },
      { project: 'wikitok', agent: 'claude', repetition: 1 },
      { project: 'edgy', agent: 'codex', repetition: 1 },
      { project: 'baklava', agent: 'codex', repetition: 1 },
      { project: 'wikitok', agent: 'codex', repetition: 1 },
    ]);
  });
});

describe('buildBatchVariants', () => {
  it('returns the default benchmark variants when no overrides are provided', () => {
    expect(buildBatchVariants()).toEqual(BATCH_VARIANTS);
    expect(BATCH_VARIANTS).toEqual([
      { agent: 'claude', model: 'opus-4.6', effort: BATCH_DEFAULT_EFFORTS.claude },
      { agent: 'codex', model: 'gpt-5.4', effort: BATCH_DEFAULT_EFFORTS.codex },
    ]);
  });
});

describe('parseRunBatchArgs', () => {
  it('parses optional effort overrides, prompt, and concurrency from the CLI', () => {
    expect(
      parseRunBatchArgs([
        '--prompt',
        'pattern-copy',
        '--claude-effort',
        'high',
        '--codex-effort',
        'medium',
        '--concurrency',
        '3',
      ])
    ).toEqual({
      prompt: 'pattern-copy',
      claudeEffort: 'high',
      codexEffort: 'medium',
      concurrency: 3,
    });
  });
});

describe('runBatch', () => {
  it('caps concurrency and keeps queued work moving as slots free up', async () => {
    TMP = mkdtempSync(join(tmpdir(), 'eval-run-batch-concurrency-'));
    const descriptors = buildBatchRunDescriptors().slice(0, 5);
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
    const descriptors = buildBatchRunDescriptors().slice(0, 3);
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
    const descriptor = buildBatchRunDescriptors({ prompt: 'pattern-copy' })[0];
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
    expect(logContents).toContain('$ node ./scripts/eval/eval.ts');
    expect(logContents).toContain('--prompt pattern-copy');
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
  const descriptors = buildBatchRunDescriptors(prompt ? { prompt } : undefined);
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

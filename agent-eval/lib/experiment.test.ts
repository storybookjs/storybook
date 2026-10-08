import { readdirSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ExperimentConfig, RunCompleteContext, Sandbox } from '@vercel/agent-eval';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_EXPERIMENT_CONFIG } from './experiment.ts';
import * as templates from './templates.ts';

vi.mock('./templates.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./templates.ts')>();
  return Object.fromEntries(
    Object.entries(actual).map(([name, value]) => [
      name,
      typeof value === 'function' ? vi.fn() : value,
    ])
  );
});

const EXPERIMENTS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'experiments'
);

describe('the run-complete hook', () => {
  it('records the checkout commit next to the existing metadata', async () => {
    const context = {
      runData: { result: { status: 'passed', duration: 1, metadata: { note: 'kept' } } },
    } as unknown as RunCompleteContext;

    const runData = await DEFAULT_EXPERIMENT_CONFIG.onRunComplete(context);

    expect(runData.result.metadata).toEqual({
      note: 'kept',
      checkout: { commit: expect.stringMatching(/^[0-9a-f]{40}$/), dirty: expect.any(Boolean) },
    });
  });
});

describe.each(readdirSync(EXPERIMENTS_DIR).filter((file) => file.endsWith('.ts')))(
  'the %s experiment',
  (file) => {
    it('commits the sandbox baseline after everything its setup writes', async () => {
      vi.clearAllMocks();
      const { default: experiment } = (await import(path.join(EXPERIMENTS_DIR, file))) as {
        default: ExperimentConfig;
      };

      const sandbox = { writeFiles: vi.fn(), runCommand: vi.fn(), readFile: vi.fn() };
      await experiment.setup?.(sandbox as unknown as Sandbox);

      const callOrders = [...Object.values(templates), ...Object.values(sandbox)].flatMap(
        (value) => (vi.isMockFunction(value) ? value.mock.invocationCallOrder : [])
      );
      expect(vi.mocked(templates.commitSandboxBaseline).mock.invocationCallOrder).toEqual([
        Math.max(...callOrders),
      ]);
    });
  }
);

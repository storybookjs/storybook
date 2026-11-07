import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { nxTaskResultsDirectory } from '../../utils/nx.ts';

const root = join(import.meta.dirname, '../../..');
const readJson = (file: string) => JSON.parse(readFileSync(join(root, file), 'utf8'));

type Target = { command?: string; options?: { command?: string }; outputs?: string[] };
const { targetDefaults } = readJson('nx.json') as { targetDefaults: Record<string, Target> };

const tasks = execFileSync('git', ['ls-files', '*project.json'], { cwd: root, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .flatMap((file) => {
    const { targets = {} } = readJson(file) as { targets?: Record<string, Target> };
    return Object.entries(targets).map(([target, own]) => {
      const defaults = targetDefaults[target] ?? {};
      return {
        id: `${file}:${target}`,
        target,
        command: own.options?.command ?? own.command ?? defaults.options?.command ?? defaults.command,
        outputs: own.outputs ?? defaults.outputs ?? [],
      };
    });
  });

const ownResults = (target: string) => [
  `{workspaceRoot}/test-results/{projectName}/${target}`,
  `{workspaceRoot}/code/playwright-results/{projectName}/${target}`,
];

describe('the results of the NX tasks', () => {
  it('go to a folder of each task, which only that task caches', () => {
    const writers = tasks.filter(({ command }) => /--junit|playwright/.test(command ?? ''));
    expect(writers.length).toBeGreaterThan(20);
    for (const { id, target, outputs } of writers) {
      expect(outputs, id).toEqual(ownResults(target));
    }
  });

  it('are never cached by a task they do not belong to', () => {
    for (const { id, target, outputs } of tasks) {
      const results = outputs.filter((output) => /test-results|playwright-results/.test(output));
      expect(ownResults(target), id).toEqual(expect.arrayContaining(results));
    }
  });

  it('are written where the outputs say', () => {
    const env = { NX_TASK_TARGET_PROJECT: 'react-vite/default-ts', NX_TASK_TARGET_TARGET: 'e2e-tests' };
    expect(nxTaskResultsDirectory('/repo/test-results', env)).toBe(
      '/repo/test-results/react-vite/default-ts/e2e-tests'
    );
    expect(nxTaskResultsDirectory('/repo/test-results', {})).toBe('/repo/test-results');
  });
});

import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { join } from 'pathe';
import { expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../../..');

// The setup job hashes every task before any of them runs (task-hashes.ts). A task whose inputs
// include the outputs of the tasks it depends on (`dependentTasksOutputFiles`) has a hash that is
// known only once those tasks ran, so the setup job would mistake it for cached or not: Nx says as
// much in https://github.com/nrwl/nx/discussions/23419. agent-sizing.ts needs that input to stay
// unused, or select.ts to count such tasks as ones that run.
it('no task hashes the outputs of the tasks it depends on', () => {
  // Every target as Nx resolves it, plugins' inferred ones included, and the named inputs.
  const file = join(mkdtempSync(join(tmpdir(), 'nx-graph-')), 'graph.json');
  execSync(`yarn nx graph --file=${file}`, { cwd: ROOT, stdio: 'ignore' });
  const { graph } = JSON.parse(readFileSync(file, 'utf8')) as {
    graph: { nodes: Record<string, { data: { targets?: Record<string, { inputs?: unknown }> } }> };
  };
  const using = Object.entries(graph.nodes).flatMap(([project, node]) =>
    Object.entries(node.data.targets ?? {})
      .filter(([, target]) =>
        JSON.stringify(target.inputs ?? []).includes('dependentTasksOutputFiles')
      )
      .map(([target]) => `${project}:${target}`)
  );
  const nxJson = readFileSync(join(ROOT, 'nx.json'), 'utf8');
  expect(using).toEqual([]);
  expect(nxJson).not.toContain('dependentTasksOutputFiles');
});

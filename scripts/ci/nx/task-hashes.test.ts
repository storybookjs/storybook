import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { join } from 'pathe';
import { expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../../..');

it('no task hashes the outputs of the tasks it depends on, so the setup job can hash every task before any runs', () => {
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

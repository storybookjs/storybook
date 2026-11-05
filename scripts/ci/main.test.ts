import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isBuiltin } from 'node:module';

import { dirname, join, relative } from 'pathe';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { workflows } from './utils/types.ts';

const repoRoot = join(import.meta.dirname, '../..');

const generate = (...args: string[]) =>
  spawnSync(process.execPath, ['--experimental-transform-types', './scripts/ci/main.ts', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

const readConfig = () =>
  JSON.parse(readFileSync(join(repoRoot, '.circleci/config.generated.yml'), 'utf8'));

const valueImportPattern = /^(?:import|export)(?!\s+type\b)\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]/gm;

const importSpecifiers = (file: string) =>
  [...readFileSync(file, 'utf8').matchAll(valueImportPattern)].map((match) => match[1]);

describe('main.ts under plain Node, as the CircleCI setup job runs it', () => {
  it('imports only Node built-ins, because the setup job runs before pnpm install', () => {
    const queue = [join(repoRoot, 'scripts/ci/main.ts')];
    const visited = new Set<string>();
    const external: string[] = [];

    while (queue.length > 0) {
      const file = queue.pop()!;
      if (visited.has(file)) {
        continue;
      }
      visited.add(file);
      for (const specifier of importSpecifiers(file)) {
        if (specifier.startsWith('.')) {
          queue.push(join(dirname(file), specifier));
        } else if (!isBuiltin(specifier)) {
          external.push(`${relative(repoRoot, file)} imports ${specifier}`);
        }
      }
    }

    expect(visited.size).toBeGreaterThan(5);
    expect(external).toEqual([]);
  });

  it.each(workflows)('generates the %s workflow', (workflow) => {
    // `HEAD` resolves on the `--depth 1` checkout `Tests (linux)` uses; `HEAD^` does not.
    const result = generate(`--workflow=${workflow}`, '--base-ref=HEAD');

    expect(result.status, result.stderr).toBe(0);
    const config = readConfig();
    expect(Object.keys(config.workflows)).toEqual([`${workflow}-generated`]);
  });

  it.each(workflows)('runs Yarn in the %s workflow only to generate sandboxes', (workflow) => {
    const result = generate(
      `--workflow=${workflow}`,
      '--base-ref=HEAD',
      '--gh-trusted-author=true'
    );

    expect(result.status, result.stderr).toBe(0);
    const { jobs } = readConfig();
    const yarnSteps = Object.entries<{ steps?: { run?: { name?: string } }[] }>(jobs).flatMap(
      ([id, { steps = [] }]) =>
        steps
          .filter((step) => /yarn/i.test(JSON.stringify(step)))
          .map((step) => `${id}: ${step.run?.name ?? JSON.stringify(step)}`)
    );
    expect(
      yarnSteps.filter((step) => !step.endsWith(': Enable Yarn for sandbox generation'))
    ).toEqual([]);
  });

  it('packs the node_modules of every workspace package', () => {
    const result = generate('--workflow=normal', '--base-ref=HEAD');

    expect(result.status, result.stderr).toBe(0);
    const steps: { run?: { name: string; command: string } }[] =
      readConfig().jobs['build--linux'].steps;
    const pack = steps.find((step) => step.run?.name.startsWith('Pack node_modules'));
    const packed = new Set(pack?.run?.command.split(/[\s;]+/));
    const importers = Object.keys(
      parse(readFileSync(join(repoRoot, 'pnpm-lock.yaml'), 'utf8')).importers
    ).map((importer) => (importer === '.' ? 'node_modules' : `${importer}/node_modules`));

    expect(importers).toContain('code/core/node_modules');
    expect(importers.filter((dir) => !packed.has(`project/${dir}`))).toEqual([]);
  });

  it.each([{ args: [] }, { args: ['--workflow=unknown'] }])('rejects $args', ({ args }) => {
    const result = generate(...args);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Expected a comma-separated list of');
  });
});

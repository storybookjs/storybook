import { existsSync, globSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { dirname, join, relative, resolve } from 'pathe';

import { esMain } from '../utils/esmain.ts';
import { OUTPUT_DIR, ROOT } from './paths.ts';

interface MutationReport {
  files: Record<string, { mutants: { coveredBy?: string[] }[] }>;
  testFiles: Record<string, { tests: { id: string; name: string }[] }>;
}

interface IdleTest {
  name: string;
  reachedMutants: number;
}

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8'));

// A test is idle when it passes on the original sources and fails for no mutant it reaches.
export function findIdleTests(packageDir: string) {
  const outputDir = join(OUTPUT_DIR, relative(ROOT, packageDir));
  const report = readJson<MutationReport>(join(outputDir, 'mutation.json'));
  const passing = new Set(readJson<string[]>(join(outputDir, 'passing-tests.json')));
  const failing = readJson<{ id: string }[]>(join(outputDir, 'failing-tests.json'));
  const killingTestsFile = join(outputDir, 'killing-tests.jsonl');
  const killing = new Set(
    existsSync(killingTestsFile)
      ? readFileSync(killingTestsFile, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line) as string)
      : []
  );

  const reachedMutants = new Map<string, number>();
  for (const { mutants } of Object.values(report.files)) {
    for (const id of mutants.flatMap(({ coveredBy = [] }) => coveredBy)) {
      reachedMutants.set(id, (reachedMutants.get(id) ?? 0) + 1);
    }
  }

  const idleTestsByFile = new Map<string, IdleTest[]>();
  for (const [file, { tests }] of Object.entries(report.testFiles)) {
    const idle = tests
      .filter(({ name }) => passing.has(`${file}#${name}`) && !killing.has(`${file}#${name}`))
      .map(({ id, name }) => ({ name, reachedMutants: reachedMutants.get(id) ?? 0 }));
    if (idle.length > 0) {
      idleTestsByFile.set(file, idle);
    }
  }

  return { passing: passing.size, killing: killing.size, failing, idleTestsByFile };
}

export function formatIdleTests(packageDir: string) {
  const { passing, killing, failing, idleTestsByFile } = findIdleTests(packageDir);
  const idle = [...idleTestsByFile.values()].flat();
  const lines = [
    `## ${relative(ROOT, packageDir)}`,
    '',
    `${passing} tests ran, ${killing} fail for at least one mutant, ${idle.length} fail for none.`,
    `${idle.filter((test) => test.reachedMutants === 0).length} of those reach no mutant at all.`,
    `${failing.length} tests failed on instrumented sources and were not assessed.`,
  ];
  for (const [file, tests] of idleTestsByFile) {
    lines.push('', `### ${file}`, '');
    for (const { name, reachedMutants } of tests) {
      lines.push(`- ${name} (reaches ${reachedMutants} mutants)`);
    }
  }
  if (failing.length > 0) {
    lines.push('', '### Not assessed', '', ...failing.map(({ id }) => `- ${id}`));
  }
  return lines.join('\n');
}

if (esMain(import.meta.url)) {
  const { positionals } = parseArgs({ allowPositionals: true });
  const packageDirs =
    positionals.length > 0
      ? positionals.map((dir) => resolve(dir))
      : globSync('**/mutation.json', { cwd: OUTPUT_DIR }).map((file) => join(ROOT, dirname(file)));

  console.log(packageDirs.sort().map(formatIdleTests).join('\n\n'));
}

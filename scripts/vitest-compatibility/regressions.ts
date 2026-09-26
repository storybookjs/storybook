import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const [vitest3, vitest4, vitest5, outputDirectory] = process.argv.slice(2);
assert(
  vitest3 && vitest4 && vitest5 && outputDirectory,
  'Usage: node scripts/vitest-compatibility/regressions.ts VITEST3_DIRECTORY VITEST4_DIRECTORY VITEST5_DIRECTORY OUTPUT_DIRECTORY'
);
const output = resolve(outputDirectory);
await mkdir(output, { recursive: true });
const probes = [
  {
    name: 'vitest5-init',
    directory: vitest5,
    file: 'node/vitest.js',
    pattern:
      /typeof this\.vitest\.standalone == "function" \? await this\.vitest\.standalone\(\) : await this\.vitest\.init\(\)/,
    replacement: 'await this.vitest.init()',
    expected: /Deprecated Vitest.init/,
  },
  {
    name: 'vitest5-separator',
    directory: vitest5,
    file: 'node/vitest.js',
    pattern: /this\.testNameSeparator = Number\.parseInt\(version, 10\) >= 5 \? " > " : " "/,
    replacement: 'this.testNameSeparator = " "',
    expected: /0 !== 1/,
  },
  {
    name: 'vitest5-default-export',
    directory: vitest5,
    file: 'node/coverage-reporter.js',
    pattern: /  coverage_reporter_default as default,\n/,
    replacement: '',
    expected: /not a constructor|default export|Could not load|Failed to run tests/,
  },
  {
    name: 'vitest4-commonjs-export',
    directory: vitest4,
    file: 'node/coverage-reporter.js',
    pattern: /  StorybookCoverageReporter as "module.exports"/,
    replacement: '',
    expected: /not a constructor|Failed to run tests/,
  },
  {
    name: 'vitest3-browser-alias',
    directory: vitest3,
    file: 'vitest-plugin/index.js',
    pattern: /replacement: "@vitest\/browser\/context"/,
    replacement: 'replacement: "vitest/browser"',
    expected:
      /Failed to resolve import "vitest\/browser"|Failed to fetch dynamically imported module/,
  },
];
const results = [];
for (const probe of probes) {
  const file = join(probe.directory, 'node_modules/@storybook/addon-vitest/dist', probe.file);
  const original = await readFile(file, 'utf8');
  assert(probe.pattern.test(original), `Build pattern missing: ${probe.name}`);
  try {
    await writeFile(file, original.replace(probe.pattern, probe.replacement));
    let failure: { code?: string | number; stdout?: string; stderr?: string } | undefined;
    try {
      await promisify(execFile)(process.execPath, ['run.ts'], {
        cwd: probe.directory,
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (error) {
      failure = error as typeof failure;
    }
    assert(failure, `Regression survived: ${probe.name}`);
    assert.equal(failure.code, 1, `Unexpected process failure: ${probe.name}`);
    const log = (failure.stdout ?? '') + (failure.stderr ?? '');
    await writeFile(join(output, `${probe.name}.log`), log);
    assert.match(log, probe.expected, `Unexpected failure: ${probe.name}`);
    results.push({ name: probe.name, status: 'caught', exitCode: failure.code });
    process.stdout.write(`PASS regression probe: ${probe.name}\n`);
  } finally {
    await writeFile(file, original);
  }
}
await writeFile(join(output, 'regressions.json'), JSON.stringify(results, null, 2));

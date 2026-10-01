import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

import ts from 'typescript';

const [toolsDirectory, outputDirectory] = process.argv.slice(2);
assert(
  toolsDirectory && outputDirectory,
  'Usage: node scripts/vitest-compatibility/mutation.ts TOOLS_DIRECTORY OUTPUT_DIRECTORY'
);
const root = resolve(import.meta.dirname, '../..');
const output = resolve(outputDirectory);
await mkdir(output, { recursive: true });
const targets = [
  ['code/addons/vitest/src/node/vitest-manager.ts', ['startVitest', 'buildStoryTestNamePattern']],
  ['code/addons/vitest/src/vitest-plugin/index.ts', ['config']],
  ['code/addons/vitest/src/node/coverage-reporter.ts', ['constructor', 'onSummary']],
] as const;
const mutate: string[] = [];
for (const [file, names] of targets) {
  const source = ts.createSourceFile(
    file,
    await readFile(join(root, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  function visit(node: ts.Node) {
    const name = ts.isConstructorDeclaration(node)
      ? 'constructor'
      : ts.isMethodDeclaration(node)
        ? node.name.getText(source)
        : undefined;
    if (name && (names as readonly string[]).includes(name)) {
      const start = source.getLineAndCharacterOfPosition(node.getStart());
      const end = source.getLineAndCharacterOfPosition(node.end);
      mutate.push(`${file}:${start.line + 1}:${start.character}-${end.line + 1}:${end.character}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
const configuration = {
  testRunner: 'command',
  plugins: [] as string[],
  coverageAnalysis: 'off',
  concurrency: 2,
  timeoutMS: 10000,
  commandRunner: {
    command:
      'node node_modules/vitest/vitest.mjs run --config scripts/vitest-compatibility/vitest.mutation.config.ts',
  },
  buildCommand: 'node scripts/vitest-compatibility/mutation-build.ts',
  mutate,
  reporters: ['clear-text', 'json'],
  jsonReporter: { fileName: join(output, 'mutation.json') },
  tempDirName: join(output, 'sandboxes'),
  ignorePatterns: [
    '**/dist/**',
    '**/node_modules/**',
    '.git/**',
    '.yarn/**',
    '.nx/**',
    'docs/**',
    'test-storybooks/**',
  ],
};
const configFile = join(output, 'stryker.config.json');
await writeFile(configFile, JSON.stringify(configuration, null, 2));
const log = createWriteStream(join(output, 'mutation.log'));
const child = spawn(
  process.execPath,
  [resolve(toolsDirectory, 'node_modules/@stryker-mutator/core/bin/stryker.js'), 'run', configFile],
  {
    cwd: root,
    env: { ...process.env, STORYBOOK_MUTATION_ROOT: root },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30 * 60 * 1000,
  }
);
child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });
const [code] = await once(child, 'close');
log.end();
await finished(log);
assert.equal(code, 0, `Mutation run failed; see ${join(output, 'mutation.log')}`);
process.stdout.write(`Mutation report: ${join(output, 'mutation.json')}\n`);

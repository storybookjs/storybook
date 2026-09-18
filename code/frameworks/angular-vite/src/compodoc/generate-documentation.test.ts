// Real temp directories and a real child process. What is under test is the shape of the spawn and
// the atomicity of the publish, neither of which memfs models: it has no processes, and a rename it
// performed would prove nothing about the rename Node performs on disk.
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateDocumentation, resolveCompodocCli } from './generate-documentation.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

/**
 * Stands in for the Compodoc binary, without the cost of a real scan. It keeps the two behaviours
 * that matter: the last `-d` decides where `documentation.json` lands, and the write is not atomic,
 * so the file is truncated and then grows. The env switches cover the failure paths.
 */
const STUB_CLI = `
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const outputDir = args[args.lastIndexOf('-d') + 1];
process.stdout.write('parsing ' + args.join(' ') + '\\n');

if (process.env.STUB_SLOW_MS) {
  await new Promise((resolve) => setTimeout(resolve, Number(process.env.STUB_SLOW_MS)));
}
if (process.env.STUB_EXIT_CODE) {
  process.stderr.write('compodoc could not parse the project\\n');
  process.exit(Number(process.env.STUB_EXIT_CODE));
}
if (!process.env.STUB_WRITE_NOTHING) {
  mkdirSync(outputDir, { recursive: true });
  const target = join(outputDir, 'documentation.json');
  const payload = JSON.stringify({ cwd: process.cwd(), args });
  writeFileSync(target, '');
  for (const chunk of payload.match(/[\\s\\S]{1,20}/g)) {
    appendFileSync(target, chunk);
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}
`;

let workDir: string;
let workspaceRoot: string;
let outputDir: string;
let stubCliPath: string;

const options = () => ({
  compodocArgs: ['-e', 'json', '-d', '.'],
  tsconfig: join(workspaceRoot, 'tsconfig.json'),
  workspaceRoot,
  outputDir,
});

const documentationJson = () => join(outputDir, 'documentation.json');
const readPublished = () => JSON.parse(readFileSync(documentationJson(), 'utf8'));

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'sb-compodoc-run-'));
  workspaceRoot = join(workDir, 'workspace');
  outputDir = join(workspaceRoot, 'dist', 'docs');
  // A real (fake) Compodoc install in the project, so the resolution the production code performs is
  // the one under test rather than a mock of it.
  const packageDir = join(workspaceRoot, 'node_modules', '@compodoc', 'compodoc');
  mkdirSync(join(packageDir, 'bin'), { recursive: true });
  writeFileSync(
    join(packageDir, 'package.json'),
    JSON.stringify({ bin: { compodoc: './bin/index.mjs' } })
  );
  stubCliPath = join(packageDir, 'bin', 'index.mjs');
  writeFileSync(stubCliPath, STUB_CLI);
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe('resolveCompodocCli', () => {
  it('prefers the Compodoc the project pinned over the one beside this framework', () => {
    expect(resolveCompodocCli(workspaceRoot)).toBe(realpathSync(stubCliPath));
  });
});

describe('generateDocumentation', () => {
  it('runs from the workspace root, names the tsconfig, and publishes only the JSON', async () => {
    await generateDocumentation(options());

    const { cwd, args } = readPublished();
    expect(cwd).toBe(realpathSync(workspaceRoot));
    expect(args).toEqual(expect.arrayContaining(['-e', 'json']));
    // Relative to the child's cwd, because Compodoc mishandles absolute paths on Windows.
    expect(args.filter((arg: string) => arg === '-p')).toHaveLength(1);
    expect(args[args.indexOf('-p') + 1]).toBe('tsconfig.json');
    // The caller's `-d .` is still on the command line; ours is last, and Compodoc takes the last.
    expect(args.at(-2)).toBe('-d');
    expect(args.at(-1)).not.toBe('.');
    expect(readdirSync(outputDir)).toEqual(['documentation.json']);
  });

  it('leaves the tsconfig alone when the caller already named one', async () => {
    await generateDocumentation({
      ...options(),
      compodocArgs: ['-p', 'tsconfig.doc.json', '-e', 'json'],
    });

    const { args } = readPublished();
    expect(args.filter((arg: string) => arg === '-p')).toHaveLength(1);
    expect(args).toContain('tsconfig.doc.json');
  });

  it('never exposes a half-written file to readers while the run is in flight', async () => {
    // Excluding concurrent writers does not cover this: Compodoc truncates the file and grows it, so
    // a reader parsing it mid-write gets a syntax error unless the publish is a rename.
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(documentationJson(), JSON.stringify({ generation: 'previous' }));

    const observations: Array<{ generation?: string } | string> = [];
    const poll = setInterval(() => {
      try {
        observations.push(readPublished());
      } catch (error) {
        observations.push(`unreadable: ${String(error)}`);
      }
    }, 1);

    await generateDocumentation(options());
    clearInterval(poll);

    expect(observations.length).toBeGreaterThan(5);
    expect(
      observations.every((entry) => (entry as { generation?: string })?.generation === 'previous')
    ).toBe(true);
    expect(readPublished().generation).toBeUndefined();
  });

  it('reports a failing run with the tail of its output', async () => {
    vi.stubEnv('STUB_EXIT_CODE', '2');

    await expect(generateDocumentation(options())).rejects.toThrow(
      /Compodoc exited with code 2[\s\S]*could not parse the project/
    );
    expect(existsSync(documentationJson())).toBe(false);
  });

  it('kills a run that hangs, since nothing above this has a timeout of its own', async () => {
    vi.stubEnv('STUB_SLOW_MS', '30000');

    await expect(generateDocumentation({ ...options(), timeoutMs: 200 })).rejects.toThrow(
      'Compodoc did not finish within 200ms'
    );
  });

  it('reports a run that succeeded without exporting any JSON', async () => {
    vi.stubEnv('STUB_WRITE_NOTHING', '1');

    await expect(generateDocumentation(options())).rejects.toThrow(
      /finished without writing documentation\.json/
    );
  });
});

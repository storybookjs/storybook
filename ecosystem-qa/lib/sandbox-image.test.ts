import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { delimiter, join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { playwrightProblem } from './sandbox-image.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('playwrightProblem', () => {
  it('accepts an image built for the installed Playwright', () => {
    expect(playwrightProblem('sb-ecosystem-qa', '1.58.2', '1.58.2')).toBeUndefined();
  });

  it('names both versions when the image has another Playwright', () => {
    expect(playwrightProblem('sb-ecosystem-qa', '1.57.0', '1.58.2')).toBe(
      'The image sb-ecosystem-qa has Playwright 1.57.0, and ecosystem-qa has Playwright 1.58.2. Build the image again as ecosystem-qa/README.md says.'
    );
  });

  it('names the missing label and the installed version when the image has no label', () => {
    expect(playwrightProblem('sb-ecosystem-qa', undefined, '1.58.2')).toBe(
      'The image sb-ecosystem-qa has no org.js.storybook.ecosystem-qa.playwright label, and ecosystem-qa has Playwright 1.58.2. Build the image again as ecosystem-qa/README.md says.'
    );
  });
});

// run.ts finds `docker` on PATH, so a shell script there stands in for the daemon.
describe.skipIf(process.platform === 'win32')('run.ts with --sandbox docker', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ecosystem-qa-image-'));
    // A run that gets past the image check stops here instead of cloning from GitHub.
    mkdirSync(join(dir, 'clone'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const runWith = (docker: string) => {
    writeFileSync(join(dir, 'docker'), `#!/bin/sh\n${docker}\n`, { mode: 0o755 });
    const run = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('../run.ts', import.meta.url)),
        ...['--repo', 'mealdrop', '--version', '11.0.0', '--engine', 'claude'],
        ...['--sandbox', 'docker', '--out', join(dir, 'out'), '--clone-dir', join(dir, 'clone')],
      ],
      { encoding: 'utf8', env: { ...process.env, PATH: `${dir}${delimiter}${process.env.PATH}` } }
    );
    return {
      status: run.status,
      message: run.stderr.split('\n')[0],
      wroteOutput: existsSync(join(dir, 'out')),
    };
  };
  const labels = (version: string) =>
    `echo '{"org.js.storybook.ecosystem-qa.playwright":"${version}"}'`;

  it('ends before the clone when the image has another Playwright', () => {
    expect(runWith(labels('1.57.0'))).toEqual({
      status: 1,
      message: expect.stringMatching(
        /^The image sb-ecosystem-qa has Playwright 1\.57\.0, and ecosystem-qa has Playwright /
      ),
      wroteOutput: false,
    });
  });

  it('ends before the clone when the image has no labels', () => {
    expect(runWith('echo null')).toEqual({
      status: 1,
      message: expect.stringContaining('has no org.js.storybook.ecosystem-qa.playwright label'),
      wroteOutput: false,
    });
  });

  it("ends with Docker's reason when Docker cannot read the image", () => {
    expect(runWith('echo "No such image: sb-ecosystem-qa" >&2; exit 1')).toEqual({
      status: 1,
      message:
        'Docker cannot read the image sb-ecosystem-qa (No such image: sb-ecosystem-qa). Build it as ecosystem-qa/README.md says.',
      wroteOutput: false,
    });
  });

  it('goes on to the clone when the image has the installed Playwright', () => {
    const installed = createRequire(import.meta.url)('playwright/package.json').version;
    expect(runWith(labels(installed)).message).toBe(
      `${join(dir, 'clone')} already exists. Delete it or pass another --clone-dir.`
    );
  });
});

describe('Dockerfile', () => {
  it('builds for the Playwright that package.json pins', () => {
    const pin = JSON.parse(read('../package.json')).dependencies.playwright;
    const [, buildArg] = read('../Dockerfile').match(/^ARG PLAYWRIGHT_VERSION=(\S+)$/m) ?? [];
    expect(buildArg).toBe(pin);
  });
});

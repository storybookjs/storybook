import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { compareCaptures } from './compare-captures.ts';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__/captures');
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function setup() {
  const report = mkdtempSync(join(tmpdir(), 'capture-report-'));
  directories.push(report);
  return {
    mode: 'compare' as const,
    framework: 'svelte' as const,
    before: join(fixtures, 'before'),
    after: join(fixtures, 'after'),
    report,
  };
}
const waivers = [
  {
    componentId: 'button',
    violation: 'lost-arg',
    arg: 'label',
    reason: 'Accepted fixture loss',
    approvedBy: 'Review Lead',
  },
  {
    componentId: 'button',
    violation: 'lost-arg',
    arg: 'size',
    reason: 'Accepted fixture loss',
    approvedBy: 'Review Lead',
  },
  {
    componentId: 'button',
    storyId: 'button--primary',
    violation: 'lost-attribute',
    arg: 'disabled',
    reason: 'Accepted fixture loss',
    approvedBy: 'Review Lead',
  },
];
describe('capture comparison', () => {
  it('reports lost arguments and snippet attributes, gains and timeout counts', () => {
    const options = setup();
    const result = compareCaptures(options);
    expect(result.passed).toBe(false);
    expect(result.violations.map((v) => [v.kind, v.arg])).toEqual([
      ['lost-arg', 'label'],
      ['lost-arg', 'size'],
      ['lost-attribute', 'disabled'],
    ]);
    expect(result.gains).toEqual(['gained']);
    expect(result.timeouts).toEqual({ before: 1, after: 0 });
    expect(JSON.parse(readFileSync(join(options.report, 'report.json'), 'utf8'))).toEqual(result);
    expect(readFileSync(join(options.report, 'report.md'), 'utf8')).toContain(
      '| fixture | abc123 | 1 / 2 |'
    );
  });
  it('allows approved violations and fails when a waiver no longer matches', () => {
    const options = setup();
    const file = join(options.report, 'waivers.json');
    writeFileSync(file, JSON.stringify(waivers));
    expect(compareCaptures({ ...options, waivers: file }).passed).toBe(true);
    const stale = {
      componentId: 'gained',
      violation: 'lost-arg',
      arg: 'label',
      reason: 'Obsolete',
      approvedBy: 'Review Lead',
    };
    writeFileSync(file, JSON.stringify([...waivers, stale]));
    const result = compareCaptures({ ...options, waivers: file });
    expect(result.unwaived).toEqual([]);
    expect(result.staleWaivers).toEqual([stale]);
    expect(result.passed).toBe(false);
  });
  it('waives only the named argument', () => {
    const options = setup();
    const file = join(options.report, 'waivers.json');
    writeFileSync(file, JSON.stringify(waivers.filter((waiver) => waiver.arg !== 'size')));
    const result = compareCaptures({ ...options, waivers: file });
    expect(result.unwaived.map((v) => [v.kind, v.arg])).toEqual([['lost-arg', 'size']]);
    expect(result.staleWaivers).toEqual([]);
    expect(result.passed).toBe(false);
  });
});

it('round-trips Unicode component ids without permitting path traversal', async () => {
  const { readCapture, writeCapture } = await import('./capture/files.ts');
  const options = setup();
  const directory = join(options.report, 'capture');
  const metadata = {
    engine: 'legacy' as const,
    storybookVersion: '10.3.2',
    repo: 'fixture',
    sha: 'abc123',
    capturedAt: '2026-10-13T00:00:00.000Z',
  };
  const component = { id: '😀', name: 'Emoji', argTypes: {}, stories: {} };
  writeCapture(directory, { '😀': component }, metadata, '/root');
  expect(readCapture(directory)).toEqual({ metadata, components: { '😀': component } });
  expect(() =>
    writeCapture(
      join(options.report, 'unsafe'),
      { '../outside': { ...component, id: '../outside' } },
      metadata,
      '/root'
    )
  ).toThrow(/Unsafe component id/);
});

it('rewrites native and POSIX absolute Windows paths before JSON encoding', async () => {
  const { readCapture, writeCapture } = await import('./capture/files.ts');
  const options = setup();
  const directory = join(options.report, 'windows');
  const metadata = {
    engine: 'legacy' as const,
    storybookVersion: '10.3.2',
    repo: 'fixture',
    sha: 'abc123',
    capturedAt: '2026-10-13T00:00:00.000Z',
  };
  writeCapture(
    directory,
    {
      button: {
        id: 'button',
        name: 'Button',
        description: 'C:\\project\\Button.svelte and C:/project/Button.svelte',
        argTypes: {},
        stories: {},
      },
    },
    metadata,
    'C:\\project'
  );
  expect(readCapture(directory).components.button.description).toBe(
    '<root>\\Button.svelte and <root>/Button.svelte'
  );
});

it('reads a legacy null component description as absent', async () => {
  const { readCapture } = await import('./capture/files.ts');
  const options = setup();
  writeFileSync(
    join(options.report, 'capture.json'),
    readFileSync(join(options.before, 'capture.json'))
  );
  writeFileSync(
    join(options.report, 'button.json'),
    JSON.stringify({ id: 'button', name: 'Button', description: null, argTypes: {}, stories: {} })
  );
  expect(readCapture(options.report).components.button.description).toBeUndefined();
});

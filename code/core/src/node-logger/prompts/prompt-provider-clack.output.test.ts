import { WriteStream } from 'node:tty';
import { stripVTControlCharacters } from 'node:util';

import { afterEach, beforeEach, expect, it, onTestFinished, vi } from 'vitest';

vi.mock('../logger/log-tracker.ts', { spy: true });

import { logTracker } from '../logger/log-tracker.ts';

import { ClackPromptProvider } from './prompt-provider-clack.ts';

const ORIGINAL_WRITE = process.stdout.write;
const ORIGINAL_IS_TTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
let chunks: string[];

beforeEach((): void => {
  chunks = [];
  vi.mocked(logTracker.addLog).mockImplementation((): void => {});
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk): boolean => {
    chunks.push(String(chunk));
    return true;
  });
  vi.stubGlobal('STORYBOOK_CURRENT_TASK_LOG_SESSION', null);
  // Clack skips task log redraws when CI is true.
  vi.stubEnv('CI', '');
  // Clack skips task log redraws when stdout is not a TTY.
  Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
});

afterEach((): void => {
  vi.restoreAllMocks();
  process.stdout.write = ORIGINAL_WRITE;
  if (ORIGINAL_IS_TTY) {
    Object.defineProperty(process.stdout, 'isTTY', ORIGINAL_IS_TTY);
  } else {
    Reflect.deleteProperty(process.stdout, 'isTTY');
  }
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  expect(process.stdout.write).toBe(ORIGINAL_WRITE);
});

it.each([
  {
    name: 'outside writes preserve later plain lines',
    outsideWrite: true,
    marker: 'OUTSIDE BOX',
    expected: { eraseAfterMarker: false, outputAfterMarker: ['three', 'done'] },
  },
  {
    name: 'uncontaminated task logs erase before later output',
    outsideWrite: false,
    marker: 'two',
    expected: { eraseAfterMarker: true, outputAfterMarker: [] },
  },
])('$name', ({ outsideWrite, marker, expected }): void => {
  const provider = new ClackPromptProvider();
  const log = provider.taskLog({ id: 'task', title: 'Task' });
  log.message('one');
  log.message('two');
  if (outsideWrite) {
    process.stdout.write('OUTSIDE BOX\n');
  }
  log.message('three');
  log.success('done');

  const markerIndex = chunks.findIndex((chunk): boolean => chunk.includes(marker));
  expect(markerIndex).toBeGreaterThanOrEqual(0);
  const laterChunks = chunks.slice(markerIndex + 1);
  expect(laterChunks.some((chunk): boolean => chunk.includes('\x1b[2K'))).toBe(
    expected.eraseAfterMarker
  );
  for (const text of expected.outputAfterMarker) {
    expect(laterChunks.some((chunk): boolean => chunk.includes(text))).toBe(true);
  }
});

const MIGRATION_URL =
  'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#parameterscomponentsubtitle-removed';

// With colors, Clack wraps option lines 10 columns early, as it counts its guide bar's color codes.
it.each([
  { columns: 50, FORCE_COLOR: '1', NO_COLOR: undefined, colored: true, rowWidth: 40 },
  { columns: 50, FORCE_COLOR: '0', NO_COLOR: undefined, colored: false, rowWidth: 40 },
  { columns: 50, FORCE_COLOR: undefined, NO_COLOR: '1', colored: false, rowWidth: 40 },
  { columns: 100, FORCE_COLOR: '1', NO_COLOR: undefined, colored: true, rowWidth: 90 },
  { columns: 100, FORCE_COLOR: '0', NO_COLOR: undefined, colored: false, rowWidth: 90 },
])(
  'a multiselect hint link keeps its own row at $columns columns (FORCE_COLOR=$FORCE_COLOR, NO_COLOR=$NO_COLOR)',
  async ({ columns, FORCE_COLOR, NO_COLOR, colored, rowWidth }): Promise<void> => {
    // Node reads NO_COLOR in tty.WriteStream#getColorDepth, which the worker's stdout lacks.
    Object.defineProperties(process.stdout, {
      columns: { configurable: true, value: columns },
      getColorDepth: { configurable: true, value: WriteStream.prototype.getColorDepth },
    });
    onTestFinished((): void => {
      Reflect.deleteProperty(process.stdout, 'columns');
      Reflect.deleteProperty(process.stdout, 'getColorDepth');
    });
    vi.stubEnv('TERM_PROGRAM', 'iTerm.app');
    vi.stubEnv('TERM_PROGRAM_VERSION', '3.4.0');
    vi.stubEnv('FORCE_COLOR', FORCE_COLOR);
    vi.stubEnv('NO_COLOR', NO_COLOR);

    const answer = new ClackPromptProvider().multiselect(
      {
        message: 'Select automigrations to run',
        options: [{ value: 'fix', label: 'fix', hint: `Move it\nMore info: ${MIGRATION_URL}` }],
      },
      { onCancel: (): void => {} }
    );
    process.stdin.emit('end');
    await expect(answer).rejects.toThrow('stdin ended');

    const frame = chunks.find((chunk): boolean => chunk.includes('More info')) ?? '';
    expect(frame.includes('\x1b[36m')).toBe(colored);
    expect(frame).toContain(`\x1b]8;;${MIGRATION_URL}\x07`);
    const linkRow = stripVTControlCharacters(frame)
      .split('\n')
      .find((row): boolean => row.includes('More info'));
    expect(linkRow).toMatch(/^│ {2}More info: https:\/\/github\.com\/\S+\.\.\.\)$/);
    expect(linkRow?.length).toBe(rowWidth);
  }
);

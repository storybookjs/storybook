import { afterEach, beforeEach, expect, it, vi } from 'vitest';

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

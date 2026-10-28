import { vi } from 'vitest';

/** The node-logger stub every unit test runs with: prompts and log calls become spies. */
export async function mockNodeLogger(importOriginal: () => Promise<object>): Promise<object> {
  return {
    ...(await importOriginal()),
    prompt: {
      select: vi.fn(),
      multiSelect: vi.fn(),
      confirm: vi.fn(),
      text: vi.fn(),
      getPreferredStdio: vi.fn(),
      executeTask: vi.fn(),
      executeTaskWithSpinner: vi.fn(),
      spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn(), message: vi.fn() })),
      taskLog: vi.fn(() => ({
        message: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
      })),
    },
    logger: {
      SYMBOLS: {
        success: '✓',
        error: '✗',
      },
      plain: vi.fn(),
      line: vi.fn(),
      error: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      trace: vi.fn(),
      debug: vi.fn(),
      box: vi.fn(),
      verbose: vi.fn(),
      logBox: vi.fn(),
      intro: vi.fn(),
      outro: vi.fn(),
      step: vi.fn(),
    },
  };
}

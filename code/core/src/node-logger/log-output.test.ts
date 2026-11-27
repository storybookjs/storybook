import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger, once } from './index.ts';
import type { LogLevel } from './logger/logger.ts';

// vitest-setup.ts stubs `storybook/internal/node-logger`, which resolves to this module.
vi.unmock('./index.ts');

const LEVELS: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'silent'];

// Strip ANSI colours, and drop the call stack that `debug` appends at the `trace` level.
const clean = (chunk: string) =>
  chunk
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split('\n')
    .filter((line) => !/(file:\/\/|\/node_modules\/|\.ts:\d+:\d+|^\s*│?\s*at\b)/.test(line))
    .join('\n');

describe('node-logger output', () => {
  let output: string[];

  beforeEach(() => {
    output = [];
    for (const stream of ['stdout', 'stderr'] as const) {
      vi.spyOn(process[stream], 'write').mockImplementation((chunk) => {
        output.push(`${stream}: ${clean(String(chunk))}`);
        return true;
      });
    }
    once.clear();
  });

  afterEach(() => {
    logger.setLevel('info');
    vi.mocked(process.stdout.write).mockRestore();
    vi.mocked(process.stderr.write).mockRestore();
  });

  it.each(LEVELS)('writes the same output to the same stream at level "%s"', (level) => {
    logger.setLevel(level);

    logger.trace({ message: 'trace', time: [1, 0] });
    logger.verbose('verbose');
    logger.debug('debug');
    logger.log('log');
    logger.info('info');
    logger.step('step');
    logger.warn('warn');
    logger.error('error');
    logger.intro('intro');
    logger.outro('outro');
    once.info('once info');
    once.info('once info');
    once.warn('once warn');
    once.error('once error');

    expect(output).toMatchSnapshot();
  });
});

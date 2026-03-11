import { describe, expect, it, vi } from 'vitest';

import npmlog from 'npmlog';

import { logger } from '.';
import * as loggerRaw from './logger/logger';

vi.mock('./logger/logger', () => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  setLogLevel: vi.fn(),
}));

const loggerMock = vi.mocked(loggerRaw);

vi.mock('npmlog', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    levels: {
      silly: -Infinity,
      verbose: 1000,
      info: 2000,
      timing: 2500,
      http: 3000,
      notice: 3500,
      warn: 4000,
      error: 5000,
      silent: Infinity,
    },
    level: 'info',
  },
}));

vi.mock('./prompts/prompt-config', () => ({
  isClackEnabled: vi.fn(() => false),
}));

//

describe('node-logger', () => {
  it('should have a warn method', () => {
    const message = 'warning message';
    logger.warn(message);
    expect(loggerMock.warn).toHaveBeenCalledWith(message);
  });

  it('should sync --loglevel with npmlog', () => {
    logger.setLogLevel('debug');
    expect(npmlog.level).toBe('verbose');
    expect(loggerMock.setLogLevel).toHaveBeenCalledWith('debug');

    logger.setLogLevel('trace');
    expect(npmlog.level).toBe('silly');
    expect(loggerMock.setLogLevel).toHaveBeenCalledWith('trace');
  });

  it('should keep setLevel and setLogLevel consistent', () => {
    logger.setLevel('warn');
    expect(npmlog.level).toBe('warn');
    expect(loggerMock.setLogLevel).toHaveBeenCalledWith('warn');
  });

  it('should have an error method', () => {
    const message = 'error message';
    logger.error(message);
    expect(loggerMock.error).toHaveBeenCalledWith(expect.stringMatching('message'));
  });
  it('should format errors', () => {
    const message = new Error('A complete disaster');
    logger.error(message);
    expect(loggerMock.error).toHaveBeenCalledWith(expect.stringMatching('A complete disaster'));
  });
});

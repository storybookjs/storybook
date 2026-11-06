import { describe, expect, it, vi } from 'vitest';

import { logger } from './index.ts';
import * as loggerRaw from './logger/logger.ts';

// vitest-setup.ts stubs `storybook/internal/node-logger`, which resolves to this module.
vi.unmock('./index.ts');

vi.mock('./logger/logger', () => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  setLogLevel: vi.fn(),
}));

const loggerMock = vi.mocked(loggerRaw);

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

  it('should forward --loglevel to the logger', () => {
    logger.setLogLevel('debug');
    expect(loggerMock.setLogLevel).toHaveBeenCalledWith('debug');

    logger.setLogLevel('trace');
    expect(loggerMock.setLogLevel).toHaveBeenCalledWith('trace');
  });

  it('should keep setLevel and setLogLevel consistent', () => {
    logger.setLevel('warn');
    expect(loggerMock.setLogLevel).toHaveBeenCalledWith('warn');

    logger.setLogLevel();
    expect(loggerMock.setLogLevel).toHaveBeenLastCalledWith('info');
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

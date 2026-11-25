import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from './index.ts';

describe('client-logger default LOGLEVEL', () => {
  beforeEach(() => {
    vi.stubGlobal('LOGLEVEL', 'debug');
    vi.stubGlobal('console', {
      ...globalThis.console,
      trace: vi.fn(),
      debug: vi.fn(),
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    });
  });
  it('should have an debug method that displays the message in red, with a trace', () => {
    const message = 'debug message';
    logger.debug(message);
    expect(globalThis.console.debug).toHaveBeenCalledWith(message);
  });
  it('should have an log method that displays the message in red, with a trace', () => {
    const message = 'log message';
    logger.log(message);
    expect(globalThis.console.log).toHaveBeenCalledWith(message);
  });
  it('should have an info method that displays the message', () => {
    const message = 'information';
    logger.info(message);
    expect(globalThis.console.info).toHaveBeenCalledWith(message);
  });
  it('should have a warning method that displays the message in yellow, with a trace', () => {
    const message = 'warning message';
    logger.warn(message);
    expect(globalThis.console.warn).toHaveBeenCalledWith(message);
  });
  it('should have an error method that displays the message in red, with a trace', () => {
    const message = 'error message';
    logger.error(message);
    expect(globalThis.console.error).toHaveBeenCalledWith(message);
  });
});

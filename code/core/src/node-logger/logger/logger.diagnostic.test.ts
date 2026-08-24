import { afterEach, describe, expect, it, vi } from 'vitest';

import { diagnostic, setLogLevel } from './logger.ts';

describe('diagnostic', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setLogLevel('info');
  });

  it('writes to stderr when the log level is silent', () => {
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
    setLogLevel('silent');

    diagnostic('Could not write tools output');

    expect(stderr).toHaveBeenCalledWith('Could not write tools output');
  });
});

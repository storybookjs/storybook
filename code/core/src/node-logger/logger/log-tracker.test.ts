import { beforeEach, describe, expect, it } from 'vitest';

import { logTracker } from './log-tracker.ts';

describe('logTracker', () => {
  beforeEach(() => {
    logTracker.clear();
  });

  it('stores messages without terminal color codes', () => {
    logTracker.addLog('info', '\x1b[36m✔ addon-mcp\x1b[39m installed');

    expect(logTracker.logs.map((log) => log.message)).toEqual(['✔ addon-mcp installed']);
  });
});

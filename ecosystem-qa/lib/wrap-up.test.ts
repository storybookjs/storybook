import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stopAfterSilence, stopAtTimeLimit, within, wrapUpPrompt } from './wrap-up.ts';

describe('within', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('hands over what the call returns when it comes back in time', async () => {
    await expect(within(60, 'Reading the sandbox', Promise.resolve('read'))).resolves.toBe('read');
  });

  it('gives up on a call that does not come back, and says which', async () => {
    const stuck = within(60, 'Closing the sandbox', new Promise(() => {}));
    const outcome = expect(stuck).rejects.toThrow(
      'Closing the sandbox did not finish within 60 seconds.'
    );

    await vi.advanceTimersByTimeAsync(60_000);

    await outcome;
  });

  it('passes on the failure of a call that fails in time', async () => {
    await expect(
      within(60, 'Reading the sandbox', Promise.reject(new Error('no such container')))
    ).rejects.toThrow('no such container');
  });
});

describe('wrapUpPrompt', () => {
  it('tells the agent why it was stopped and which note an unfinished check gets', () => {
    expect(wrapUpPrompt(stopAtTimeLimit(105))).toContain(
      'The run reached minute 105, its time limit, and was stopped.'
    );
    expect(wrapUpPrompt(stopAtTimeLimit(105))).toContain(
      '`skip` with the note `the run was stopped at its time limit`'
    );
    expect(wrapUpPrompt(stopAfterSilence(15))).toContain(
      'You printed nothing for 15 minutes, so the run was stopped.'
    );
    expect(wrapUpPrompt(stopAfterSilence(15))).toContain(
      '`skip` with the note `the run was stopped after 15 minutes without output`'
    );
  });
});

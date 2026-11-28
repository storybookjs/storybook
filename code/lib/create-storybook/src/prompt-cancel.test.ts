import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { createPromptCancelOptions } from './prompt-cancel.ts';

vi.mock('storybook/internal/node-logger', { spy: true });

describe('createPromptCancelOptions', () => {
  const trackPromptCancel = vi.fn(async (): Promise<void> => {});

  beforeEach(() => {
    vi.mocked(logger.error).mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits 1 with the abort message when stdin ends before an answer', async () => {
    const { onCancel } = createPromptCancelOptions(
      { trackPromptCancel },
      'new-user-ask-onboarding'
    );

    await expect(onCancel('stdin-ended')).rejects.toThrow('process.exit(1)');

    expect(logger.error).toHaveBeenCalledWith(
      'Prompt aborted: stdin ended before an answer was received.'
    );
    expect(trackPromptCancel).not.toHaveBeenCalled();
  });

  it('tracks the canceled prompt and exits 0 when the user cancels', async () => {
    const { onCancel } = createPromptCancelOptions(
      { trackPromptCancel },
      'new-user-ask-onboarding'
    );

    await expect(onCancel('cancel')).rejects.toThrow('process.exit(0)');

    expect(trackPromptCancel).toHaveBeenCalledWith('new-user-ask-onboarding');
    expect(logger.error).not.toHaveBeenCalled();
  });
});

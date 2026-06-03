import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel } from 'storybook/internal/channels';
import { getServiceChannel } from 'storybook/internal/preview-api';

import { type Task, initTransport, modifyErrorMessage } from './setup-file.ts';

describe('initTransport', () => {
  afterEach(() => {
    // Cleanup the global channel so each test can assert initialization behavior independently.
    (globalThis as { __STORYBOOK_ADDONS_CHANNEL__?: Channel }).__STORYBOOK_ADDONS_CHANNEL__ =
      undefined;
    (global as { __STORYBOOK_ADDONS_CHANNEL__?: Channel }).__STORYBOOK_ADDONS_CHANNEL__ = undefined;
  });

  it('should initialize the addons channel when missing', () => {
    (globalThis as { __STORYBOOK_ADDONS_CHANNEL__?: Channel }).__STORYBOOK_ADDONS_CHANNEL__ =
      undefined;
    (global as { __STORYBOOK_ADDONS_CHANNEL__?: Channel }).__STORYBOOK_ADDONS_CHANNEL__ = undefined;

    initTransport();

    expect(getServiceChannel()).toBeInstanceOf(Channel);
  });

  it('should not overwrite an existing addons channel', () => {
    const transport = { setHandler: vi.fn(), send: vi.fn() };
    const existingChannel = new Channel({ transport });
    globalThis.__STORYBOOK_ADDONS_CHANNEL__ = existingChannel;
    (global as { __STORYBOOK_ADDONS_CHANNEL__?: Channel }).__STORYBOOK_ADDONS_CHANNEL__ =
      existingChannel;

    initTransport();

    expect(getServiceChannel()).toBe(existingChannel);
  });
});

describe('modifyErrorMessage', () => {
  const originalUrl = import.meta.env.__STORYBOOK_URL__;
  beforeEach(() => {
    import.meta.env.__STORYBOOK_URL__ = 'http://localhost:6006';
  });

  afterEach(() => {
    import.meta.env.__STORYBOOK_URL__ = originalUrl;
  });

  it('should modify the error message if the test is failing and there is a storyId in the task meta', () => {
    const task: Task = {
      type: 'test',
      result: {
        state: 'fail',
        errors: [{ message: 'Original error message' }],
      },
      meta: { storyId: 'my-story' },
    };

    modifyErrorMessage({ task });

    expect(task.result?.errors?.[0].message).toMatchInlineSnapshot(`
      "
      [34mClick to debug the error directly in Storybook: http://localhost:6006/?path=/story/my-story&addonPanel=storybook/interactions/panel[39m

      Original error message"
    `);
    expect(task.result?.errors?.[0].message).toContain('Original error message');
  });

  it('should not modify the error message if task type is not "test"', () => {
    const task: Task = {
      type: 'suite',
      result: {
        state: 'fail',
        errors: [{ message: 'Original error message' }],
      },
      meta: { storyId: 'my-story' },
    };

    modifyErrorMessage({ task });

    expect(task.result?.errors?.[0].message).toBe('Original error message');
  });

  it('should not modify the error message if task result state is not "fail"', () => {
    const task: Task = {
      type: 'test',
      result: {
        state: 'pass',
      },
      meta: { storyId: 'my-story' },
    };

    modifyErrorMessage({ task });

    expect(task.result?.errors).toBeUndefined();
  });

  it('should not modify the error message if meta.storyId is not present', () => {
    const task: Task = {
      type: 'test',
      result: {
        state: 'fail',
        errors: [{ message: 'Non story test failure' }],
      },
      meta: {},
    };

    modifyErrorMessage({ task });

    expect(task.result?.errors?.[0].message).toBe('Non story test failure');
  });
});

describe('resetMousePositionBeforeTests', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.doUnmock('vitest/browser');
    vi.doUnmock('@vitest/browser/context');
  });

  it('should reset the mouse position when the browser command exists', async () => {
    const resetMousePosition = vi.fn().mockResolvedValue(undefined);

    vi.doMock('vitest/browser', () => ({
      commands: {
        resetMousePosition,
      },
    }));

    const { resetMousePositionBeforeTests } = await import('./setup-file.browser.4.ts');

    await resetMousePositionBeforeTests();

    expect(resetMousePosition).toHaveBeenCalledTimes(1);
  });

  it('should do nothing when resetMousePosition is not callable', async () => {
    vi.doMock('vitest/browser', () => ({
      commands: {
        resetMousePosition: 'not-a-function',
      },
    }));

    const { resetMousePositionBeforeTests } = await import('./setup-file.browser.4.ts');

    await expect(resetMousePositionBeforeTests()).resolves.toBeUndefined();
  });
});

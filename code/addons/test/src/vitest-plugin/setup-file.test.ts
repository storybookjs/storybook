/* eslint-disable no-underscore-dangle */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type Task, modifyErrorMessage } from './setup-file';

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
      [34mClick to debug the error directly in Storybook: http://localhost:6006/?path=/story/my-story&addonPanel=storybook/test/panel[39m

      Original error message"
    `);
    expect(task.result?.errors?.[0].message).toContain('Original error message');
  });

  it('should not modify the error message if task type is not "test"', () => {
    const task: Task = {
      type: 'custom',
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

import { describe, expect, it } from 'vitest';

import { StorybookError } from '../storybook-error';

describe('StorybookError', () => {
  class TestError extends StorybookError {
    constructor(documentation?: StorybookError['documentation']) {
      super({
        category: 'TEST_CATEGORY',
        code: 123,
        message: 'This is a test error.',
        documentation,
      });
    }
  }

  it('should generate the correct error name', () => {
    const error = new TestError();
    expect(error.name).toBe('SB_TEST_CATEGORY_0123 (TestError)');
  });

  it('should generate the correct message without documentation link', () => {
    const error = new TestError();
    const expectedMessage = 'This is a test error.';
    expect(error.message).toBe(expectedMessage);
  });

  it('should generate the correct message with internal documentation link', () => {
    const error = new TestError(true);
    const expectedMessage =
      'This is a test error.\n\nMore info: https://storybook.js.org/error/SB_TEST_CATEGORY_0123\n';
    expect(error.message).toBe(expectedMessage);
  });

  it('should generate the correct message with external documentation link', () => {
    const error = new TestError('https://example.com/docs/test-error');
    expect(error.message).toMatchInlineSnapshot(`
      "This is a test error.

      More info: https://example.com/docs/test-error
      "
    `);
  });

  it('should generate the correct message with multiple external documentation links', () => {
    const error = new TestError([
      'https://example.com/docs/first-error',
      'https://example.com/docs/second-error',
    ]);
    expect(error.message).toMatchInlineSnapshot(`
      "This is a test error.

      More info: 
      	- https://example.com/docs/first-error
      	- https://example.com/docs/second-error
      "
    `);
  });

  it('should have default documentation value of false', () => {
    const error = new TestError();
    expect(error.documentation).toBe(false);
  });
});

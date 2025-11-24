import { describe, expect, it } from 'vitest';

import { StorybookError, appendErrorRef } from '../storybook-error';

describe('StorybookError', () => {
  class TestError extends StorybookError {
    constructor(documentation?: StorybookError['documentation']) {
      super({
        name: 'TestError',
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
      'This is a test error.\n\nMore info: https://storybook.js.org/error/SB_TEST_CATEGORY_0123?ref=error\n';
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
      'https://storybook.js.org/docs/second-error/',
    ]);
    expect(error.message).toMatchInlineSnapshot(`
      "This is a test error.

      More info: 
      	- https://example.com/docs/first-error
      	- https://storybook.js.org/docs/second-error?ref=error
      "
    `);
  });

  it('should have default documentation value of false', () => {
    const error = new TestError();
    expect(error.documentation).toBe(false);
  });
});

describe('appendErrorRef', () => {
  it('should append ref=error to storybook.js.org URLs without query parameters', () => {
    const url = 'https://storybook.js.org/docs/example/';
    const result = appendErrorRef(url);
    expect(result).toBe('https://storybook.js.org/docs/example/?ref=error');
  });

  it('should append ref=error to storybook.js.org URLs with existing query parameters', () => {
    const url = 'https://storybook.js.org/docs/example?foo=bar';
    const result = appendErrorRef(url);
    expect(result).toBe('https://storybook.js.org/docs/example/?foo=bar&ref=error');
  });

  it('should append ref=error to storybook.js.org URLs with multiple existing query parameters', () => {
    const url = 'https://storybook.js.org/docs/example?foo=bar&baz=qux';
    const result = appendErrorRef(url);
    expect(result).toBe('https://storybook.js.org/docs/example/?foo=bar&baz=qux&ref=error');
  });

  it('should handle storybook.js.org URLs with hash fragments', () => {
    const url = 'https://storybook.js.org/docs/example#section';
    const result = appendErrorRef(url);
    expect(result).toBe('https://storybook.js.org/docs/example/?ref=error#section');
  });

  it('should handle storybook.js.org URLs with query parameters and hash fragments', () => {
    const url = 'https://storybook.js.org/docs/example?foo=bar#section';
    const result = appendErrorRef(url);
    expect(result).toBe('https://storybook.js.org/docs/example/?foo=bar&ref=error#section');
  });

  it('should not modify non-storybook.js.org URLs', () => {
    const url = 'https://example.com/docs/test-error';
    const result = appendErrorRef(url);
    expect(result).toBe('https://example.com/docs/test-error');
  });

  it('should not modify relative URLs', () => {
    const url = '/docs/example';
    const result = appendErrorRef(url);
    expect(result).toBe('/docs/example');
  });

  it('should not modify empty string URLs', () => {
    const url = '';
    const result = appendErrorRef(url);
    expect(result).toBe('');
  });

  it('should not modify other domain URLs', () => {
    const url = 'https://github.com/storybookjs/storybook/issues/123';
    const result = appendErrorRef(url);
    expect(result).toBe('https://github.com/storybookjs/storybook/issues/123');
  });

  it('should not append ref=error if it already exists in the URL', () => {
    const url = 'https://storybook.js.org/docs/example/?ref=error';
    const result = appendErrorRef(url);
    expect(result).toBe('https://storybook.js.org/docs/example/?ref=error');
  });

  it('should not append ref=error if it already exists with other parameters', () => {
    const url = 'https://storybook.js.org/docs/example/?foo=bar&ref=error&baz=qux';
    const result = appendErrorRef(url);
    expect(result).toBe('https://storybook.js.org/docs/example/?foo=bar&ref=error&baz=qux');
  });

  it('should not append ref=error if it already exists in URL with hash fragment', () => {
    const url = 'https://storybook.js.org/docs/example/?ref=error#target';
    const result = appendErrorRef(url);
    expect(result).toBe('https://storybook.js.org/docs/example/?ref=error#target');
  });

  it('should append ref=error before hash fragment when no existing ref parameter', () => {
    const url = 'https://storybook.js.org/docs/example/#target';
    const result = appendErrorRef(url);
    expect(result).toBe('https://storybook.js.org/docs/example/?ref=error#target');
  });
});

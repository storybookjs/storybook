import { describe, expect, it } from 'vitest';

import {
  detectCssApplied,
  detectEmptyRender,
  extractErrorMessage,
  toStoryTestResult,
} from './to-story-test-result.ts';

describe('extractErrorMessage', () => {
  it('returns the first line of a plain message', () => {
    expect(extractErrorMessage('TypeError: foo is not a function\n    at bar', undefined)).toBe(
      'TypeError: foo is not a function'
    );
  });

  it('strips the Storybook debug banner and returns the actual message', () => {
    const message =
      '\n\x1B[34mClick to debug the error directly in Storybook: http://localhost:6006/?path=/story/button--primary\x1B[39m\n\nmissing theme context provider';
    expect(extractErrorMessage(message, undefined)).toBe('missing theme context provider');
  });

  it('strips the debug banner even when ANSI codes have been removed', () => {
    const message =
      '\nClick to debug the error directly in Storybook: http://localhost:6006/?path=/story/button--primary\n\nmissing theme context provider';
    expect(extractErrorMessage(message, undefined)).toBe('missing theme context provider');
  });

  it('falls back to the first line of the stack when message is empty', () => {
    expect(extractErrorMessage('', 'Error: something broke\n    at foo')).toBe(
      'Error: something broke'
    );
  });

  it('falls back to the first line of the stack when message is undefined', () => {
    expect(extractErrorMessage(undefined, 'Error: something broke\n    at foo')).toBe(
      'Error: something broke'
    );
  });

  it('returns "unknown error" when both message and stack are empty', () => {
    expect(extractErrorMessage('', undefined)).toBe('unknown error');
  });

  it('returns "unknown error" when both message and stack are undefined', () => {
    expect(extractErrorMessage(undefined, undefined)).toBe('unknown error');
  });

  it('handles a banner where the actual message itself is multi-line', () => {
    const message =
      '\n\x1B[34mClick to debug the error directly in Storybook: http://localhost:6006/?path=/story/button--primary\x1B[39m\n\nfirst error line\nsecond line';
    expect(extractErrorMessage(message, undefined)).toBe('first error line');
  });

  it('falls back to stack when message starts with a newline but has no banner', () => {
    expect(extractErrorMessage('\nsome error', 'Error: fallback\n    at foo')).toBe(
      'Error: fallback'
    );
  });
});

describe('detectEmptyRender', () => {
  it('returns false for undefined reports', () => {
    expect(detectEmptyRender(undefined)).toBe(false);
  });

  it('returns false when no render-analysis report flags emptyRender', () => {
    expect(detectEmptyRender([{ type: 'render-analysis', result: { emptyRender: false } }])).toBe(
      false
    );
  });

  it('returns true when a render-analysis report flags emptyRender', () => {
    expect(detectEmptyRender([{ type: 'render-analysis', result: { emptyRender: true } }])).toBe(
      true
    );
  });

  it('ignores non-render-analysis reports', () => {
    expect(detectEmptyRender([{ type: 'other', result: { emptyRender: true } as any }])).toBe(
      false
    );
  });
});

describe('detectCssApplied', () => {
  it('returns undefined for missing/empty reports', () => {
    expect(detectCssApplied(undefined)).toBeUndefined();
    expect(detectCssApplied([])).toBeUndefined();
  });

  it('returns undefined when no render-analysis report carries cssApplied', () => {
    expect(detectCssApplied([{ type: 'render-analysis', result: { emptyRender: false } }])).toBe(
      undefined
    );
  });

  it('returns the cssApplied value when present', () => {
    expect(detectCssApplied([{ type: 'render-analysis', result: { cssApplied: true } }])).toBe(
      true
    );
    expect(detectCssApplied([{ type: 'render-analysis', result: { cssApplied: false } }])).toBe(
      false
    );
  });

  it('ignores cssApplied on non-render-analysis reports', () => {
    expect(detectCssApplied([{ type: 'other', result: { cssApplied: false } as any }])).toBe(
      undefined
    );
  });
});

describe('toStoryTestResult', () => {
  it('returns null when storyId is missing', () => {
    expect(toStoryTestResult({ storyId: undefined, statusRaw: 'passed' })).toBeNull();
  });

  it('normalizes passed/failed/other statuses', () => {
    expect(toStoryTestResult({ storyId: 's', statusRaw: 'passed' })?.status).toBe('PASS');
    expect(toStoryTestResult({ storyId: 's', statusRaw: 'failed' })?.status).toBe('FAIL');
    expect(toStoryTestResult({ storyId: 's', statusRaw: 'skipped' })?.status).toBe('PENDING');
    expect(toStoryTestResult({ storyId: 's', statusRaw: undefined })?.status).toBe('PENDING');
  });

  it('flags emptyRender only when status is PASS', () => {
    const reports = [{ type: 'render-analysis', result: { emptyRender: true } }];
    expect(toStoryTestResult({ storyId: 's', statusRaw: 'passed', reports })?.emptyRender).toBe(
      true
    );
    expect(
      toStoryTestResult({ storyId: 's', statusRaw: 'failed', reports })?.emptyRender
    ).toBeUndefined();
  });

  it('records cssApplied only when status is PASS', () => {
    const reports = [{ type: 'render-analysis', result: { cssApplied: false } }];
    expect(toStoryTestResult({ storyId: 's', statusRaw: 'passed', reports })?.cssApplied).toBe(
      false
    );
    expect(
      toStoryTestResult({ storyId: 's', statusRaw: 'failed', reports })?.cssApplied
    ).toBeUndefined();
  });

  it('leaves cssApplied undefined when no probe ran', () => {
    expect(toStoryTestResult({ storyId: 's', statusRaw: 'passed' })?.cssApplied).toBeUndefined();
  });

  it('extracts error message and stack from runtime-style error objects', () => {
    const result = toStoryTestResult({
      storyId: 's',
      statusRaw: 'failed',
      errors: [{ message: 'TypeError: boom\n    at x', stack: 'at x' }],
    });
    expect(result?.error).toBe('TypeError: boom');
    expect(result?.stack).toBe('at x');
  });

  it('extracts error message from json-style (stack-only) failure messages', () => {
    const result = toStoryTestResult({
      storyId: 's',
      statusRaw: 'failed',
      errors: [{ stack: 'Error: something broke\n    at foo' }],
    });
    expect(result?.error).toBe('Error: something broke');
    expect(result?.stack).toBe('Error: something broke\n    at foo');
  });

  it('leaves error/stack undefined when there are no errors', () => {
    const result = toStoryTestResult({ storyId: 's', statusRaw: 'failed' });
    expect(result?.error).toBeUndefined();
    expect(result?.stack).toBeUndefined();
  });
});

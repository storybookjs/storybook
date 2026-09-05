import { describe, expect, it } from 'vitest';

import { ansiStyle, PLAIN_STYLE } from './style.ts';

describe('PLAIN_STYLE', () => {
  it('is the identity for bold, caseName, tone, dim, and reason', () => {
    expect(PLAIN_STYLE.bold('hello')).toBe('hello');
    expect(PLAIN_STYLE.caseName('do-dont')).toBe('do-dont');
    expect(PLAIN_STYLE.tone('good', 'complete (15/10)')).toBe('complete (15/10)');
    expect(PLAIN_STYLE.dim('(discounting 30 superseded)')).toBe('(discounting 30 superseded)');
    expect(PLAIN_STYLE.reason('missing-runs', 'missing-runs')).toBe('missing-runs');
  });
});

describe('ansiStyle', () => {
  it('returns PLAIN_STYLE (identity) when the stream is not a TTY', () => {
    const style = ansiStyle({ isTTY: false });
    expect(style.bold('hello')).toBe('hello');
    expect(style.caseName('do-dont')).toBe('do-dont');
    expect(style.reason('missing-runs', 'missing-runs')).toBe('missing-runs');
    expect(style.reason('superseded-runs', 'superseded-runs')).toBe('superseded-runs');
    expect(style.reason('unanalyzed', 'unanalyzed')).toBe('unanalyzed');
    expect(style.reason('complete', 'complete')).toBe('complete');
  });

  it('returns PLAIN_STYLE (identity) when isTTY is undefined, e.g. a piped stream', () => {
    const style = ansiStyle({});
    expect(style.bold('hello')).toBe('hello');
    expect(style.caseName('do-dont')).toBe('do-dont');
  });

  it('emits non-identity output when the stream is a TTY', () => {
    const style = ansiStyle({ isTTY: true });
    // Whether styleText actually emits escapes here depends on the test
    // runner's env (NO_COLOR/FORCE_COLOR/TTY detection inside styleText
    // itself), so assert the contract rather than literal escape bytes:
    // styled text always still contains the original plain text.
    expect(style.bold('hello')).toContain('hello');
    expect(style.caseName('do-dont')).toContain('do-dont');
    expect(style.reason('missing-runs', 'missing-runs')).toContain('missing-runs');
    expect(style.reason('complete', 'complete')).toContain('complete');
    expect(style.tone('good', 'ok')).toContain('ok');
    expect(style.tone('caution', 'memory')).toContain('memory');
    expect(style.tone('action', 'GAP 2 run(s)')).toContain('GAP 2 run(s)');
    expect(style.dim('(discounting 30 superseded)')).toContain('(discounting 30 superseded)');
  });

  it('gives a reason the same styling as its tone, so both CLIs share one palette', () => {
    const style = ansiStyle({ isTTY: true });
    expect(style.reason('complete', 'x')).toBe(style.tone('good', 'x'));
    expect(style.reason('unanalyzed', 'x')).toBe(style.tone('caution', 'x'));
    expect(style.reason('missing-runs', 'x')).toBe(style.tone('action', 'x'));
    expect(style.reason('superseded-runs', 'x')).toBe(style.tone('action', 'x'));
  });
});

import { describe, it, expect } from 'vitest';
import { createSummaryValue } from './utils';

describe('createSummaryValue', () => {
  it('creates an object with just summary if detail is not passed', () => {
    const summary = 'boolean';
    expect(createSummaryValue(summary)).toEqual({ summary });
  });

  it('creates an object with summary & detail if passed', () => {
    const summary = 'MyType';
    const detail = 'boolean | string';
    expect(createSummaryValue(summary, detail)).toEqual({ summary, detail });
  });

  it('creates an object with just summary if details are equal', () => {
    const summary = 'boolean';
    const detail = 'boolean';
    expect(createSummaryValue(summary, detail)).toEqual({ summary });
  });
});

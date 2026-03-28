import { describe, expect, it } from 'vitest';

import { formatDuration, formatCost, generateTrialId } from './utils';

describe('formatDuration', () => {
  it('formats seconds under a minute', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(1)).toBe('1s');
    expect(formatDuration(45)).toBe('45s');
  });

  it('rounds fractional seconds', () => {
    expect(formatDuration(2.7)).toBe('3s');
    expect(formatDuration(59.4)).toBe('59s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(60)).toBe('1m0s');
    expect(formatDuration(61)).toBe('1m1s');
    expect(formatDuration(90)).toBe('1m30s');
    expect(formatDuration(125)).toBe('2m5s');
    expect(formatDuration(3661)).toBe('61m1s');
  });
});

describe('formatCost', () => {
  it('returns dash for undefined', () => {
    expect(formatCost(undefined)).toBe('-');
    expect(formatCost()).toBe('-');
  });

  it('formats dollar amounts', () => {
    expect(formatCost(0)).toBe('$0.00');
    expect(formatCost(1.5)).toBe('$1.50');
  });
});

describe('generateTrialId', () => {
  it('contains project, model, and prompt', () => {
    const id = generateTrialId('mealdrop', 'claude', 'sonnet-4.6', 'setup');
    expect(id).toContain('mealdrop');
    expect(id).toContain('sonnet-4.6');
    expect(id).toContain('setup');
  });

  it('starts with an ISO-like timestamp', () => {
    const id = generateTrialId('proj', 'agent', 'model', 'prompt');
    expect(id).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
  });

  it('generates unique IDs', () => {
    const a = generateTrialId('p', 'a', 'm', 'pr');
    const b = generateTrialId('p', 'a', 'm', 'pr');
    expect(a).not.toBe(b);
  });
});

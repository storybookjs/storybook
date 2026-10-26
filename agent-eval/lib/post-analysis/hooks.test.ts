import { describe, expect, it, vi } from 'vitest';

import { postAnalysisFrom } from './hooks.ts';

const COMPLETE = { analyzeRun: vi.fn(), summarize: vi.fn(), deltaToBaseline: vi.fn() };

function experiment(config: unknown) {
  return { default: config };
}

describe('postAnalysisFrom', () => {
  it('returns the module an experiment carries', () => {
    expect(postAnalysisFrom(experiment({ postAnalysis: COMPLETE }), 'arm-a')).toBe(COMPLETE);
  });

  it('accepts a module without the optional delta hook', () => {
    const minimal = { analyzeRun: vi.fn(), summarize: vi.fn() };
    expect(postAnalysisFrom(experiment({ postAnalysis: minimal }), 'arm-a')).toBe(minimal);
  });

  // Identity is what groups arms into one summary table, so two experiments
  // importing the same module must come back as the same object.
  it('preserves identity across experiments sharing a module', () => {
    expect(postAnalysisFrom(experiment({ postAnalysis: COMPLETE }), 'arm-a')).toBe(
      postAnalysisFrom(experiment({ postAnalysis: COMPLETE }), 'arm-b')
    );
  });

  it.each([
    ['an experiment carrying none', experiment({ evals: ['801'] })],
    ['an explicit undefined', experiment({ postAnalysis: undefined })],
    ['no default export', {}],
    ['a non-object default', experiment('nope')],
    ['nothing at all', undefined],
  ])('returns null for %s', (_label, module) => {
    expect(postAnalysisFrom(module, 'core')).toBeNull();
  });

  // Being skipped is indistinguishable from "not ours to measure", so anything
  // that was clearly meant to be a module has to fail loudly instead.
  it.each([
    ['a string', 'post-analysis.ts'],
    ['a number', 42],
  ])('throws on %s', (_label, value) => {
    expect(() => postAnalysisFrom(experiment({ postAnalysis: value }), 'arm-a')).toThrow(
      /experiments\/arm-a\.ts: postAnalysis must be an object/
    );
  });

  it.each([
    ['analyzeRun', { summarize: vi.fn() }, /must provide an analyzeRun function/],
    ['summarize', { analyzeRun: vi.fn() }, /must provide a summarize function/],
  ])('names the experiment when %s is missing', (_label, postAnalysis, message) => {
    expect(() => postAnalysisFrom(experiment({ postAnalysis }), 'arm-a')).toThrow(message);
  });

  // A typo'd key would otherwise read as "this module computes no delta".
  it('rejects a non-function deltaToBaseline', () => {
    expect(() =>
      postAnalysisFrom(
        experiment({ postAnalysis: { ...COMPLETE, deltaToBaseline: 'yes' } }),
        'arm-a'
      )
    ).toThrow(/deltaToBaseline that is not a function/);
  });

  it('accepts a numeric metricsVersion', () => {
    const versioned = { ...COMPLETE, metricsVersion: 2 };
    expect(postAnalysisFrom(experiment({ postAnalysis: versioned }), 'arm-a')).toBe(versioned);
  });

  // A malformed version would never match a committed baseline, quietly
  // re-measuring the pinned tree on every invocation.
  it('rejects a non-number metricsVersion', () => {
    expect(() =>
      postAnalysisFrom(experiment({ postAnalysis: { ...COMPLETE, metricsVersion: 'v2' } }), 'arm-a')
    ).toThrow(/metricsVersion that is not a number/);
  });
});

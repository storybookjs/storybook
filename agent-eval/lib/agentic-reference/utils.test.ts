import { describe, expect, it } from 'vitest';

import { formatCompactCount, shortCase, shortExperiment, shortNameOf } from './utils.ts';

describe('shortNameOf', () => {
  it('strips any agent prefix/suffix pair from a case name', () => {
    expect(shortNameOf('cc-do-dont-opus-high')).toBe('do-dont');
    expect(shortNameOf('codex-full-gpt-5.5-medium')).toBe('full');
  });

  it('passes a name matching no agent through unchanged', () => {
    expect(shortNameOf('unrelated-name')).toBe('unrelated-name');
  });
});

describe('shortExperiment', () => {
  it('strips the cc experiment prefix and model suffix for display', () => {
    expect(shortExperiment('agentic-ref-cc-do-dont-opus-high')).toBe('do-dont');
  });

  it('leaves non-cc experiment names alone', () => {
    expect(shortExperiment('agentic-ref-codex-full-gpt-5.5-medium')).toBe(
      'agentic-ref-codex-full-gpt-5.5-medium'
    );
  });
});

describe('shortCase', () => {
  it('shortens an eval name to its number', () => {
    expect(shortCase('703-fix-bug-flow')).toBe('703');
    expect(shortCase('703')).toBe('703');
  });
});

describe('formatCompactCount', () => {
  it('formats millions with one decimal', () => {
    expect(formatCompactCount(1_234_000)).toBe('1.2M');
  });

  it('formats thousands with one decimal', () => {
    expect(formatCompactCount(1234)).toBe('1.2k');
  });

  it('formats values below 1000 as a rounded integer', () => {
    expect(formatCompactCount(42)).toBe('42');
    expect(formatCompactCount(42.6)).toBe('43');
  });
});

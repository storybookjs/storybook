import { describe, expect, it } from 'vitest';

import {
  formatDuration,
  formatCost,
  formatScore,
  formatReadableUtcTimestamp,
  generateTrialId,
  loadPrompt,
  listPrompts,
  formatTable,
} from './utils.ts';

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

describe('formatScore', () => {
  it('keeps integer scores compact', () => {
    expect(formatScore(1)).toBe('1');
    expect(formatScore(0)).toBe('0');
  });

  it('formats gain scores without unnecessary trailing zeroes', () => {
    expect(formatScore(0.25)).toBe('0.25');
    expect(formatScore(1 / 3)).toBe('0.333');
    expect(formatScore(-0.125)).toBe('-0.125');
  });
});

describe('generateTrialId', () => {
  it('starts with a readable branch-safe UTC timestamp', () => {
    const id = generateTrialId();
    expect(id).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z-[a-f0-9]{8}$/);
  });

  it('generates unique IDs', () => {
    const a = generateTrialId();
    const b = generateTrialId();
    expect(a).not.toBe(b);
  });
});

describe('formatReadableUtcTimestamp', () => {
  it('formats ISO timestamps in UTC for PR output', () => {
    expect(formatReadableUtcTimestamp('2026-04-02T10:23:40.000Z')).toBe('Apr 2 2026 10:23:40 UTC');
  });

  it('falls back to the original value for invalid dates', () => {
    expect(formatReadableUtcTimestamp('not-a-date')).toBe('not-a-date');
  });
});

describe('listPrompts', () => {
  it('lists available prompt names', () => {
    const prompts = listPrompts();
    expect(prompts).toContain('pattern-copy-play');
    expect(prompts).not.toContain('pattern-copy');
    expect(prompts).toContain('setup');
  });

  it('returns only names without .md extension', () => {
    for (const name of listPrompts()) {
      expect(name).not.toContain('.md');
    }
  });
});

describe('loadPrompt', () => {
  it('loads pattern-copy-play prompt by default', () => {
    const prompt = loadPrompt();
    expect(prompt).toContain('play function');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('loads setup prompt by name', () => {
    const prompt = loadPrompt('setup');
    expect(prompt).toContain('Storybook');
    expect(prompt).toContain('### Step 1');
  });

  it('loads the play-driven pattern-copy prompt by name', () => {
    const prompt = loadPrompt('pattern-copy-play');
    expect(prompt).toContain('play function');
    expect(prompt).toContain('The purpose of the `play` function is to prove');
  });

  it('throws for unknown prompt', () => {
    expect(() => loadPrompt('nonexistent-prompt-xyz')).toThrow('Prompt not found');
  });

  it('returns trimmed content', () => {
    const prompt = loadPrompt('pattern-copy-play');
    expect(prompt).toBe(prompt.trim());
  });
});

describe('formatTable', () => {
  it('formats a simple table with aligned columns', () => {
    const result = formatTable(
      ['Name', 'Score'],
      [
        ['Alice', '100'],
        ['Bob', '95'],
      ]
    );
    const lines = result.split('\n');
    expect(lines).toHaveLength(4); // header + divider + 2 rows
    expect(lines[0]).toContain('Name');
    expect(lines[0]).toContain('Score');
    expect(lines[1]).toMatch(/^-+\+-+$/);
    expect(lines[2]).toContain('Alice');
    expect(lines[3]).toContain('Bob');
  });

  it('auto-sizes columns to fit content', () => {
    const result = formatTable(['X', 'Y'], [['short', 'a-much-longer-value']]);
    const lines = result.split('\n');
    // Header column for Y should be padded to match the data width
    const headerCols = lines[0].split(' | ');
    const dataCols = lines[2].split(' | ');
    expect(headerCols[1].trim().length).toBeLessThanOrEqual(dataCols[1].trim().length);
  });

  it('handles ANSI escape codes in cells', () => {
    const green = '\x1b[32mPASS\x1b[39m';
    const result = formatTable(['Status'], [[green], ['FAIL']]);
    const lines = result.split('\n');
    // Both rows should be the same visible width
    // The ANSI row has extra invisible chars but should still align
    expect(lines[2]).toContain('PASS');
    expect(lines[3]).toContain('FAIL');
  });

  it('handles empty rows', () => {
    const result = formatTable(['A', 'B'], []);
    const lines = result.split('\n');
    expect(lines).toHaveLength(2); // header + divider only
  });
});

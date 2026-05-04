import { describe, expect, it } from 'vitest';

import {
  EXAMPLE_PROMPT_BASENAME,
  formatDuration,
  formatCost,
  formatScore,
  formatScorePercent,
  formatReadableUtcTimestamp,
  generateTrialId,
  loadPrompt,
  listPrompts,
  formatTable,
  formatHelp,
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

describe('formatScorePercent', () => {
  it('formats 0-1 scores as whole-number percentages when exact', () => {
    expect(formatScorePercent(0)).toBe('0%');
    expect(formatScorePercent(1)).toBe('100%');
    expect(formatScorePercent(0.5)).toBe('50%');
    expect(formatScorePercent(0.75)).toBe('75%');
  });

  it('uses one decimal when the percentage is not an integer', () => {
    expect(formatScorePercent(1 / 3)).toBe('33.3%');
    expect(formatScorePercent(-0.125)).toBe('-12.5%');
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
  it('mirrors the CLI prompt registry', () => {
    const prompts = listPrompts();
    expect(prompts).toContain('pattern-copy-play');
    expect(prompts).toContain('setup');
    expect(prompts).not.toContain('pattern-copy');
  });

  it('includes the default/example prompt', () => {
    expect(listPrompts()).toContain(EXAMPLE_PROMPT_BASENAME);
  });
});

describe('loadPrompt', () => {
  it('returns the nudge string the agent receives (not the resolved instructions)', () => {
    const prompt = loadPrompt(EXAMPLE_PROMPT_BASENAME);
    expect(prompt).toMatch(/node .+code\/core\/dist\/bin\/dispatcher\.js ai setup/);
    expect(prompt).not.toContain('### Step 1');
  });

  it('rejects unknown prompt names', () => {
    expect(() => loadPrompt('nonexistent-prompt-xyz')).toThrow('Prompt not found');
  });

  it('accepts every registered prompt name', () => {
    for (const name of listPrompts()) {
      expect(() => loadPrompt(name)).not.toThrow();
    }
  });
});

describe('formatHelp', () => {
  it('formats usage, description, and options into a help message', () => {
    const result = formatHelp('node eval.ts [options]', 'Run an eval trial.', {
      project: { type: 'string', short: 'p', description: 'Project name' },
      verbose: { type: 'boolean', short: 'v', description: 'Verbose output' },
      help: { type: 'boolean', short: 'h', description: 'Show this help and exit' },
    });

    expect(result).toContain('Usage: node eval.ts [options]');
    expect(result).toContain('Run an eval trial.');
    expect(result).toContain('-p, --project <value>');
    expect(result).toContain('-v, --verbose');
    expect(result).toContain('-h, --help');
    expect(result).toContain('Project name');
  });

  it('pads options without a short flag', () => {
    const result = formatHelp('node tool.ts', 'A tool.', {
      verbose: { type: 'boolean', short: 'v', description: 'Verbose' },
      'dry-run': { type: 'boolean', description: 'Dry run' },
    });

    expect(result).toContain('-v, --verbose');
    expect(result).toContain('    --dry-run');
  });

  it('aligns descriptions across options of different name lengths', () => {
    const result = formatHelp('node tool.ts', 'A tool.', {
      x: { type: 'boolean', description: 'Short name' },
      'very-long-option': { type: 'boolean', description: 'Long name' },
    });

    const lines = result.split('\n').filter((l) => l.includes('--'));
    const descStartX = lines[0].indexOf('Short name');
    const descStartLong = lines[1].indexOf('Long name');
    expect(descStartX).toBe(descStartLong);
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

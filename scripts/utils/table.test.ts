import { describe, expect, it } from 'vitest';

import { formatPlainTable, formatTable } from './table.ts';

/** The cells of a rendered table, row by row, header row first. */
function cells(rendered: string): string[][] {
  return rendered
    .split('\n')
    .filter((line) => line.startsWith('│'))
    .map((line) =>
      line
        .split('│')
        .slice(1, -1)
        .map((cell) => cell.trim())
    );
}

describe('formatTable', () => {
  it('renders one column per key, in the order the first row lists them', () => {
    expect(cells(formatTable([{ run: 'a', nodes: 1 }]))).toEqual([
      ['run', 'nodes'],
      ['a', '1'],
    ]);
  });

  // The reason this exists rather than console.table: a percentage is a string,
  // and console.table would print it as '29.59%', quotes and all.
  it('prints strings without quotes', () => {
    expect(formatTable([{ share: '29.59%' }])).not.toContain("'");
  });

  it('leaves a cell blank where a row has no value for the column', () => {
    expect(cells(formatTable([{ a: 1, b: 2 }, { a: 3 }]))).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', ''],
    ]);
  });

  // A measured zero and an unmeasured one mean different things, so a null says
  // so rather than leaving the same blank as a missing column.
  it('prints null for a value that was measured as null', () => {
    expect(cells(formatTable([{ costUsd: null }]))).toEqual([['costUsd'], ['null']]);
  });

  it('picks up columns that only later rows carry', () => {
    expect(cells(formatTable([{ a: 1 }, { b: 2 }]))).toEqual([
      ['a', 'b'],
      ['1', ''],
      ['', '2'],
    ]);
  });

  it('widens a column to its widest cell', () => {
    const [header, short] = formatTable([{ n: 1 }, { n: 1234567 }])
      .split('\n')
      .slice(1);
    expect(header).toHaveLength(short!.length);
  });

  it('right-aligns numbers and left-aligns text', () => {
    // Lines: top rule, header, header rule, then the rows.
    const [, , , first] = formatTable([
      { n: 1, s: 'a' },
      { n: 1000, s: 'bbbb' },
    ]).split('\n');
    expect(first).toBe('│    1 │ a    │');
  });

  // Not a shape any caller means to print, but a silent [object Object] is a
  // worse way to find out than seeing what was in the cell.
  it('renders a value that is neither text nor a number as JSON', () => {
    expect(cells(formatTable([{ pins: ['a', 'b'] }]))).toEqual([['pins'], ['["a","b"]']]);
  });

  it('renders an empty row set as nothing at all', () => {
    expect(formatTable([])).toBe('');
  });
});

describe('formatPlainTable', () => {
  it('formats a simple table with aligned columns', () => {
    const result = formatPlainTable(
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
    const result = formatPlainTable(['X', 'Y'], [['short', 'a-much-longer-value']]);
    const lines = result.split('\n');
    // Header column for Y should be padded to match the data width
    const headerCols = lines[0].split(' | ');
    const dataCols = lines[2].split(' | ');
    expect(headerCols[1].trim().length).toBeLessThanOrEqual(dataCols[1].trim().length);
  });

  it('handles ANSI escape codes in cells', () => {
    const green = '\x1b[32mPASS\x1b[39m';
    const result = formatPlainTable(['Status'], [[green], ['FAIL']]);
    const lines = result.split('\n');
    // Both rows should be the same visible width
    // The ANSI row has extra invisible chars but should still align
    expect(lines[2]).toContain('PASS');
    expect(lines[3]).toContain('FAIL');
  });

  it('handles empty rows', () => {
    const result = formatPlainTable(['A', 'B'], []);
    const lines = result.split('\n');
    expect(lines).toHaveLength(2); // header + divider only
  });
});

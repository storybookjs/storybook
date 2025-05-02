import { describe, expect, it } from 'vitest';

import { dedent } from 'ts-dedent';

import { formatter } from './formatter';

describe('dedent', () => {
  it('handles empty string', async () => {
    const input = '';
    const result = formatter(true, input);

    await expect(result).resolves.toBe(input);
  });

  it('handles single line', async () => {
    const input = 'console.log("hello world")';
    const result = formatter(true, input);

    await expect(result).resolves.toBe(input);
  });

  it('does not transform correct code', async () => {
    const input = dedent`
    console.log("hello");
    console.log("world");
  `;
    const result = formatter(true, input);

    await expect(result).resolves.toBe(input);
  });

  it('does transform incorrect code', async () => {
    const input = `
    console.log("hello");
    console.log("world");
  `;
    const result = formatter(true, input);

    await expect(result).resolves.toBe(`console.log("hello");
console.log("world");`);
  });

  it('more indentations - skip first line', async () => {
    const input = `
    it('handles empty string', () => {
      const input = '';
      const result = formatter(input);
    
      expect(result).toBe(input);
    });
  `;
    const result = formatter(true, input);

    await expect(result).resolves.toBe(`it('handles empty string', () => {
  const input = '';
  const result = formatter(input);

  expect(result).toBe(input);
});`);
  });

  it('more indentations - code on first line', async () => {
    const input = `// some comment
    it('handles empty string', () => {
      const input = '';
      const result = formatter(input);
    
      expect(result).toBe(input);
    });
  `;
    const result = formatter(true, input);

    await expect(result).resolves.toBe(`// some comment
it('handles empty string', () => {
  const input = '';
  const result = formatter(input);

  expect(result).toBe(input);
});`);
  });

  it('removes whitespace in empty line completely', async () => {
    const input = `
    console.log("hello");

    console.log("world");
  `;
    const result = formatter(true, input);

    await expect(result).resolves.toBe(`console.log("hello");

console.log("world");`);
  });
});

describe('prettier (babel)', () => {
  it('handles empty string', async () => {
    const input = '';
    const result = formatter('angular', input);

    await expect(result).resolves.toBe(input);
  });

  it('handles single line', async () => {
    const input = 'console.log("hello world")';
    const result = formatter('angular', input);

    await expect(result).resolves.toBe(input);
  });
});

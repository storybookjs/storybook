import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parse } from '@babel/parser';
import { readFileSync } from 'fs';

import * as extractModule from './extract';
import * as resolveModule from './resolve';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    readFileSync: vi.fn(),
  };
});

vi.mock('./resolve', async () => {
  return {
    resolveMock: vi.fn((path) => {
      if (path === './bar/baz.js') {
        return { absolutePath: '/abs/path/bar/baz.js', redirectPath: null };
      }
      if (path === './bar/baz.utils') {
        return { absolutePath: '/abs/path/bar/baz.utils.ts', redirectPath: null };
      }
      if (path === './bar/baz.utils.ts') {
        return { absolutePath: '/abs/path/bar/baz.utils.ts', redirectPath: null };
      }
      return { absolutePath: '/abs/path', redirectPath: null };
    }),
  };
});

const parser = (input: string) =>
  parse(input, { sourceType: 'module', plugins: ['jsx', 'typescript'] });

describe('isModuleDirectory', () => {
  it('returns true for node_modules path', () => {
    expect(extractModule.isModuleDirectory('/foo/node_modules/bar')).toBe(true);
  });

  it('returns false for non-node_modules path', () => {
    expect(extractModule.isModuleDirectory('/foo/bar')).toBe(false);
  });
});

describe('extractMockCalls', () => {
  const previewConfigPath = '/project/.storybook/preview.tsx';
  const configDir = '/project/.storybook';
  const root = '/project';
  const coreOptions = { disableTelemetry: true };

  const extractMockCalls = (previewContent: string) => {
    vi.mocked(readFileSync).mockReturnValue(previewContent);
    return extractModule.extractMockCalls(
      { previewConfigPath, configDir, coreOptions },
      parser,
      root
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array if readFileSync throws', () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('fail');
    });
    const result = extractMockCalls('');
    expect(result).toEqual([]);
  });

  it('extracts mocks from preview file content with spy', () => {
    const previewContent = `
      sb.mock('foo', { spy: true });
    `;
    const result = extractMockCalls(previewContent);
    expect(result).toEqual([
      {
        path: 'foo',
        absolutePath: '/abs/path',
        redirectPath: null,
        spy: true,
      },
    ]);
    expect(resolveModule.resolveMock).toHaveBeenCalledWith('foo', root, previewConfigPath);
  });

  it('handles no sb.mock calls in preview file', () => {
    const previewContent = `
      // no mocks here
      const a = 1;
    `;
    const result = extractMockCalls(previewContent);
    expect(result).toEqual([]);
  });

  it('handles missing spy option in preview file', () => {
    const previewContent = `
      sb.mock('bar');
    `;
    const result = extractMockCalls(previewContent);
    expect(result).toEqual([
      {
        path: 'bar',
        absolutePath: '/abs/path',
        redirectPath: null,
        spy: false,
      },
    ]);
  });

  it('supports sb.mock(import("<xyz>"), { spy: true })', () => {
    const previewContent = `
      sb.mock(import('./bar/baz'), { spy: true });
    `;

    const result = extractMockCalls(previewContent);

    // The path should be the import argument value, if extractMockCalls supports this pattern
    expect(result).toEqual([
      {
        path: './bar/baz',
        absolutePath: '/abs/path',
        redirectPath: null,
        spy: true,
      },
    ]);
  });

  it('supports sb.mock(import("<xyz>.js"), { spy: true }) with extensions stripped out', () => {
    const previewContent = `
      sb.mock(import('./bar/baz.js'), { spy: true });
    `;

    const result = extractMockCalls(previewContent);

    // The path should be the import argument value, if extractMockCalls supports this pattern
    expect(result).toEqual([
      {
        path: './bar/baz',
        absolutePath: '/abs/path/bar/baz.js',
        redirectPath: null,
        spy: true,
      },
    ]);
  });

  it('supports sb.mock(import("<xyz>.js"), { spy: true }) with extensions stripped out - 2', () => {
    const previewContent = `
      sb.mock(import('./bar/baz.utils.ts'), { spy: true });
    `;

    const result = extractMockCalls(previewContent);

    // The path should be the import argument value, if extractMockCalls supports this pattern
    expect(result).toEqual([
      {
        path: './bar/baz.utils',
        absolutePath: '/abs/path/bar/baz.utils.ts',
        redirectPath: null,
        spy: true,
      },
    ]);
  });

  it('supports sb.mock(import("<xyz>"), { spy: true }) without extensions', () => {
    const previewContent = `
      sb.mock(import('./bar/baz.utils'), { spy: true });
    `;

    const result = extractMockCalls(previewContent);

    // The path should be the import argument value, if extractMockCalls supports this pattern
    expect(result).toEqual([
      {
        path: './bar/baz.utils',
        absolutePath: '/abs/path/bar/baz.utils.ts',
        redirectPath: null,
        spy: true,
      },
    ]);
  });

  describe('rewriteSbMockImportCalls', () => {
    it('rewrites sb.mock(import("<xyz>"), { spy: true }) to sb.mock("<xyz>", { spy: true })', () => {
      const code = `
        sb.mock(import('./bar/baz'), { spy: true });
      `;

      const result = extractModule.rewriteSbMockImportCalls(code);
      expect(result.code).toMatchInlineSnapshot(`
        "sb.mock("./bar/baz", {
          spy: true
        });"
      `);
    });

    it('rewrites sb.mock(import("<xyz>")) to sb.mock("<xyz>")', () => {
      const code = `
        sb.mock(import('./bar/baz'));
      `;

      const result = extractModule.rewriteSbMockImportCalls(code);
      expect(result.code).toMatchInlineSnapshot(`
        "sb.mock("./bar/baz");"
      `);
    });
  });
});

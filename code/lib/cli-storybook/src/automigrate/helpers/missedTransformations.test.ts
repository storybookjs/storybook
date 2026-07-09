import { promises as fs } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  detectMissedTransformations,
  formatMissedTransformationsMessage,
} from './missedTransformations.ts';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    promises: {
      ...actual.promises,
      stat: vi.fn(),
      readFile: vi.fn(),
    },
  };
});
vi.mock('globby', () => ({
  globby: vi.fn(),
}));
vi.mock('p-limit', () => ({
  default: vi.fn(() => vi.fn((fn) => fn())),
}));
vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal()),
  commonGlobOptions: () => ({}),
  getProjectRoot: () => '/project/root',
}));

const shortenPath = (path: string) => path;

describe('detectMissedTransformations', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(fs.stat).mockResolvedValue({ size: 100 } as any);
    vi.mocked(fs.readFile).mockResolvedValue('');
  });

  it('resolves to [] and never calls globby when there are no patterns', async () => {
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');

    const result = await detectMissedTransformations({
      patterns: [],
      safeFiles: [],
      safeDirs: [],
    });

    expect(result).toEqual([]);
    expect(globby).not.toHaveBeenCalled();
  });

  it('excludes files inside the safe set and only reports matches outside it', async () => {
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    vi.mocked(globby).mockResolvedValue([
      '/project/root/.storybook/main.ts',
      '/project/root/packages/other-app/src/Button.stories.ts',
    ]);
    vi.mocked(fs.readFile).mockResolvedValue("import x from '@storybook/old-package';");

    const result = await detectMissedTransformations({
      patterns: [
        {
          fixId: 'my-fix',
          label: '@storybook/old-package',
          regex: /@storybook\/old-package/,
          replacement: '@storybook/new-package',
        },
      ],
      safeFiles: [],
      safeDirs: ['/project/root/.storybook'],
    });

    expect(result).toEqual([
      {
        file: '/project/root/packages/other-app/src/Button.stories.ts',
        fixId: 'my-fix',
        label: '@storybook/old-package',
        replacement: '@storybook/new-package',
      },
    ]);
  });

  it('reports a match found in a file outside the safe set with correct file/fixId/label', async () => {
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    vi.mocked(globby).mockResolvedValue(['/project/root/packages/app/src/index.ts']);
    vi.mocked(fs.readFile).mockResolvedValue("import x from '@storybook/old-package';");

    const result = await detectMissedTransformations({
      patterns: [
        {
          fixId: 'my-fix',
          label: '@storybook/old-package',
          regex: /@storybook\/old-package/,
          replacement: '@storybook/new-package',
        },
      ],
      safeFiles: [],
      safeDirs: [],
    });

    expect(result).toEqual([
      {
        file: '/project/root/packages/app/src/index.ts',
        fixId: 'my-fix',
        label: '@storybook/old-package',
        replacement: '@storybook/new-package',
      },
    ]);
  });

  it('skips files whose size exceeds the 2MB limit without reading them or throwing', async () => {
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    vi.mocked(globby).mockResolvedValue(['/project/root/packages/app/src/huge.ts']);
    vi.mocked(fs.stat).mockResolvedValue({ size: 2 * 1024 * 1024 + 1 } as any);

    const result = await detectMissedTransformations({
      patterns: [
        {
          fixId: 'my-fix',
          label: '@storybook/old-package',
          regex: /@storybook\/old-package/,
          replacement: '@storybook/new-package',
        },
      ],
      safeFiles: [],
      safeDirs: [],
    });

    expect(result).toEqual([]);
    expect(fs.readFile).not.toHaveBeenCalled();
  });

  it('skips unreadable files without throwing and without preventing other files from being scanned', async () => {
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    vi.mocked(globby).mockResolvedValue([
      '/project/root/packages/app/src/broken.ts',
      '/project/root/packages/app/src/ok.ts',
    ]);
    vi.mocked(fs.readFile).mockImplementation((file: any) => {
      if (file === '/project/root/packages/app/src/broken.ts') {
        return Promise.reject(new Error('EACCES'));
      }
      return Promise.resolve("import x from '@storybook/old-package';");
    });

    const result = await detectMissedTransformations({
      patterns: [
        {
          fixId: 'my-fix',
          label: '@storybook/old-package',
          regex: /@storybook\/old-package/,
          replacement: '@storybook/new-package',
        },
      ],
      safeFiles: [],
      safeDirs: [],
    });

    expect(result).toEqual([
      {
        file: '/project/root/packages/app/src/ok.ts',
        fixId: 'my-fix',
        label: '@storybook/old-package',
        replacement: '@storybook/new-package',
      },
    ]);
  });
});

describe('formatMissedTransformationsMessage', () => {
  it('returns null for undefined', () => {
    expect(formatMissedTransformationsMessage(undefined, { shortenPath })).toBeNull();
  });

  it('returns null for an empty array', () => {
    expect(formatMissedTransformationsMessage([], { shortenPath })).toBeNull();
  });

  it('groups multiple matches by fixId+label and includes the expected heading', () => {
    const message = formatMissedTransformationsMessage(
      [
        { file: '/a.ts', fixId: 'fix-a', label: 'pattern-a', replacement: 'pattern-a-new' },
        { file: '/b.ts', fixId: 'fix-a', label: 'pattern-a', replacement: 'pattern-a-new' },
        { file: '/c.ts', fixId: 'fix-b', label: 'pattern-b', replacement: 'pattern-b-new' },
      ],
      { shortenPath }
    );

    expect(message).toContain('Possible missed transformations');
    expect(message).toContain('fix-a (still contains "pattern-a", replace with "pattern-a-new"):');
    expect(message).toContain('  - /a.ts');
    expect(message).toContain('  - /b.ts');
    expect(message).toContain('fix-b (still contains "pattern-b", replace with "pattern-b-new"):');
    expect(message).toContain('  - /c.ts');
  });

  it('caps displayed files at 20 with a "...and N more file(s)" tail', () => {
    const files = Array.from({ length: 25 }, (_, i) => `/file-${i}.ts`);
    const matches = files.map((file) => ({
      file,
      fixId: 'fix-a',
      label: 'pattern-a',
      replacement: 'pattern-a-new',
    }));

    const message = formatMissedTransformationsMessage(matches, { shortenPath });

    expect(message).toContain('...and 5 more file(s)');
    expect(message).not.toContain('/file-24.ts');
    expect(message).toContain('/file-19.ts');
  });
});

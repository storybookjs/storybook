import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MdxSourceChange } from '../runtime/source-transport.ts';
import { MDX_CHANGE_BATCH_MS, createMdxChangePublisher, docsMdxFiles } from './watch-mdx.ts';

const good =
  "import * as SB from '@storybook/experimental-addon-manager-docs/mdx';\nimport * as ButtonStories from './Button.stories';\n\n<SB.Story of={ButtonStories.Primary} />\n";

describe('createMdxChangePublisher', () => {
  let files: Record<string, string>;
  let published: MdxSourceChange[];

  beforeEach(() => {
    vi.useFakeTimers();
    files = { 'src/Button.mdx': good, 'src/Other.mdx': '# Other\n' };
    published = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function publisher(read = async (importPath: string) => files[importPath]!) {
    return createMdxChangePublisher({ read, publish: (change) => published.push(change) });
  }

  it('publishes one revision per file after events stop for 100ms', async () => {
    const changes = publisher();

    changes.queue('src/Button.mdx');
    await vi.advanceTimersByTimeAsync(MDX_CHANGE_BATCH_MS - 1);
    changes.queue('src/Button.mdx');
    changes.queue('src/Other.mdx');
    await vi.advanceTimersByTimeAsync(MDX_CHANGE_BATCH_MS - 1);
    expect(published).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(published).toEqual([
      { importPath: 'src/Button.mdx', revision: 1, source: good },
      { importPath: 'src/Other.mdx', revision: 1, source: '# Other\n' },
    ]);

    files['src/Button.mdx'] = `${good}\nMore prose.\n`;
    changes.queue('src/Button.mdx');
    await vi.advanceTimersByTimeAsync(MDX_CHANGE_BATCH_MS);
    expect(published.at(-1)).toEqual({
      importPath: 'src/Button.mdx',
      revision: 2,
      source: `${good}\nMore prose.\n`,
    });
  });

  it('publishes a located parse error under the next revision', async () => {
    const changes = publisher();
    files['src/Button.mdx'] =
      "import * as SB from '@storybook/experimental-addon-manager-docs/mdx';\n\n# Title\n\n<SB.Story of={ButtonStories.Primary}\n";

    changes.queue('src/Button.mdx');
    await vi.advanceTimersByTimeAsync(MDX_CHANGE_BATCH_MS);

    expect(published).toEqual([
      {
        importPath: 'src/Button.mdx',
        revision: 1,
        error: {
          file: 'src/Button.mdx',
          line: expect.any(Number),
          column: expect.any(Number),
          construct: expect.any(String),
          message: expect.any(String),
        },
      },
    ]);
    const [change] = published;
    expect(change && 'error' in change && change.error.message).not.toMatch(/^src\/Button\.mdx:/);
  });

  it('numbers revisions when the batch fires, so a slow earlier read cannot outrank a later one', async () => {
    let releaseFirst: (source: string) => void = () => {};
    let reads = 0;
    const changes = publisher((importPath) => {
      reads += 1;
      if (reads === 1) {
        return new Promise((resolve) => {
          releaseFirst = resolve;
        });
      }
      return Promise.resolve(files[importPath]!);
    });

    changes.queue('src/Other.mdx');
    await vi.advanceTimersByTimeAsync(MDX_CHANGE_BATCH_MS);
    changes.queue('src/Other.mdx');
    await vi.advanceTimersByTimeAsync(MDX_CHANGE_BATCH_MS);
    releaseFirst('# Stale\n');
    await vi.advanceTimersByTimeAsync(0);

    expect(published).toEqual([
      { importPath: 'src/Other.mdx', revision: 2, source: '# Other\n' },
      { importPath: 'src/Other.mdx', revision: 1, source: '# Stale\n' },
    ]);
  });

  it('skips a file that can no longer be read', async () => {
    const changes = publisher(async () => {
      throw new Error('ENOENT');
    });

    changes.queue('src/Button.mdx');
    await vi.advanceTimersByTimeAsync(MDX_CHANGE_BATCH_MS);

    expect(published).toEqual([]);
  });

  it('publishes nothing after close', async () => {
    const changes = publisher();

    changes.queue('src/Button.mdx');
    changes.close();
    await vi.advanceTimersByTimeAsync(MDX_CHANGE_BATCH_MS);

    expect(published).toEqual([]);
  });
});

describe('docsMdxFiles', () => {
  it('watches only MDX files indexed as docs entries', () => {
    expect(
      docsMdxFiles([
        { type: 'docs', id: 'button--docs', importPath: './src/Button.mdx' },
        { type: 'docs', id: 'button--more', importPath: './src/Button.mdx' },
        { type: 'docs', id: 'autodocs', importPath: './src/Button.stories.tsx' },
        { type: 'story', id: 'button--primary', importPath: './src/Notes.mdx' },
        { type: 'docs', id: 'upper', importPath: './src/README.MDX' },
      ])
    ).toEqual(['./src/Button.mdx', './src/README.MDX']);
  });
});

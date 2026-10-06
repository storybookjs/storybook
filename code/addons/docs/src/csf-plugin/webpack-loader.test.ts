import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import loader from './webpack-loader.ts';

const STORY = `export default { title: 'Example' };
export const Primary = { args: { label: 'Button' } };
`;

function runLoader(resourcePath: string, content: string) {
  return new Promise<{ err: Error | null; result?: string }>((resolve, reject) => {
    loader
      .call(
        {
          async: () => (err, result) => resolve({ err, result }),
          getOptions: () => ({}),
          resourcePath,
        },
        content,
        undefined
      )
      .catch(reject);
  });
}

describe('csf-plugin webpack loader', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'csf-plugin-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('adds the original source to stories', async () => {
    const file = join(dir, 'Button.stories.ts');
    await writeFile(file, STORY);

    const { err, result } = await runLoader(file, STORY);

    expect(err).toBeNull();
    expect(result).toContain('originalSource');
  });

  it('passes the content through when the story file was deleted during the build', async () => {
    const { err, result } = await runLoader(join(dir, 'Deleted.stories.ts'), STORY);

    expect(err).toBeNull();
    expect(result).toBe(STORY);
  });
});

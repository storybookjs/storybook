import { describe, it, expect } from 'vitest';
import { join } from 'path';

import { getPortableStoriesFiles } from './get-portable-stories-usage';

describe('getPortableStoriesFiles', () => {
  it('should ignores node_modules, non-source files', async () => {
    const base = join(__dirname, '__fixtures__');
    const usage = (await getPortableStoriesFiles(base)).map((f) => f.replace(base, ''));
    expect(usage).toMatchInlineSnapshot(`
      [
        "/b.js",
        "/a.js",
        "/foo/a.js",
        "/.storybook/a.js",
      ]
    `);
  });
});

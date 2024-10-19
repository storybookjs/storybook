import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getPortableStoriesFileCountUncached } from './get-portable-stories-usage';

const mocksDir = join(__dirname, '..', '__mocks__');

describe('getPortableStoriesFileCountUncached', () => {
  it('should ignores node_modules, non-source files', async () => {
    const usage = await getPortableStoriesFileCountUncached(mocksDir);
    // you can verify with: `git grep -l composeStor | wc -l`
    expect(usage).toMatchInlineSnapshot(`2`);
  });
});

import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

import { getPortableStoriesFileCountUncached } from './get-portable-stories-usage';

const mocksDir = join(__dirname, '..', '__mocks__');

describe('getPortableStoriesFileCountUncached', () => {
  it('should ignores node_modules, non-source files', async () => {
    const usage = await getPortableStoriesFileCountUncached(mocksDir);
    // you can verify with: `git grep -m1 -c composeStor | wc -l`
    expect(usage).toMatchInlineSnapshot(`2`);
  });
});

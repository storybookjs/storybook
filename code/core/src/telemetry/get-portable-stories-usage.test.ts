import { describe, it, expect } from 'vitest';

import { getPortableStoriesFileCountUncached } from './get-portable-stories-usage';

describe('getPortableStoriesFileCountUncached', () => {
  it('should ignores node_modules, non-source files', async () => {
    const usage = await getPortableStoriesFileCountUncached();
    // you can verify with: `git grep -m1 -c composeStor | wc -l`
    expect(usage).toMatchInlineSnapshot(`14`);
  });
});

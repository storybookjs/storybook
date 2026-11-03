import { join } from 'pathe';

import { describe, expect, it } from 'vitest';

import { getApplicationFilesCountUncached } from './get-application-file-count.ts';

const mocksDir = join(__dirname, '..', '__mocks__');

describe('getApplicationFilesCount', () => {
  it('should find files with correct names', async () => {
    const files = await getApplicationFilesCountUncached(mocksDir);
    expect(files).toMatchInlineSnapshot(`2`);
  });
});

import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getApplicationFilesCountUncached } from './get-application-file-count';

const mocksDir = join(__dirname, '..', '__mocks__');

describe('getApplicationFilesCount', () => {
  it('should find files with correct names', async () => {
    const files = await getApplicationFilesCountUncached(mocksDir);
    expect(files).toMatchInlineSnapshot(`2`);
  });
});

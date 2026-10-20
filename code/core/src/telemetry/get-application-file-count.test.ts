// eslint-disable-next-line no-restricted-imports -- passes the dir into git pathspecs joined with native path.sep
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { getApplicationFilesCountUncached } from './get-application-file-count.ts';

const mocksDir = join(__dirname, '..', '__mocks__');

describe('getApplicationFilesCount', () => {
  it('should find files with correct names', async () => {
    const files = await getApplicationFilesCountUncached(mocksDir);
    expect(files).toMatchInlineSnapshot(`2`);
  });
});

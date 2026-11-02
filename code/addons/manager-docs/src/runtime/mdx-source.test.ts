import { afterEach, describe, expect, it } from 'vitest';

import { clearRegistry } from '../../../../core/src/shared/open-service/server.ts';

import { registerMdxSourceService } from '../mdx-source-service/server.ts';
import { readMdxSourceFromService } from './mdx-source.ts';

afterEach(() => {
  clearRegistry();
});

describe('readMdxSourceFromService', () => {
  it('requests MDX source through the open service in development', async () => {
    const reads: string[] = [];
    registerMdxSourceService({
      read: async (importPath) => {
        reads.push(importPath);
        return `# ${importPath}`;
      },
    });

    await expect(readMdxSourceFromService('src/Button.mdx')).resolves.toBe('# src/Button.mdx');
    expect(reads).toEqual(['src/Button.mdx']);
  });
});

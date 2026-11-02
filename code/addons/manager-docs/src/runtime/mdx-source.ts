import { getService } from 'storybook/manager-api';

import { ManagerDocsError } from '../errors.ts';
import { MDX_SOURCE_SERVICE_ID, type MdxSourceService } from '../mdx-source-service/definition.ts';

export async function readMdxSourceFromService(importPath: string): Promise<string> {
  const service = getService<MdxSourceService>(MDX_SOURCE_SERVICE_ID, { internal: true });
  const result = await service.queries.mdxSource.loaded({ importPath });
  if (!result) {
    throw new ManagerDocsError(`No MDX source for "${importPath}".`);
  }
  return result.source;
}

import { getService } from 'storybook/manager-api';

import { ManagerDocsError } from '../errors.ts';
import {
  MDX_SOURCE_SERVICE_ID,
  type MdxSourceRecord,
  type MdxSourceService,
} from '../mdx-source-service/definition.ts';
import type { MdxSourceChange } from './source-transport.ts';

export async function readMdxSourceFromService(importPath: string): Promise<string> {
  const result = await loadMdxSourceRecord(importPath);
  if (!result?.source) {
    throw new ManagerDocsError(`No MDX source for "${importPath}".`);
  }
  return result.source;
}

export function subscribeMdxSource(
  importPath: string,
  onChange: (change: MdxSourceChange) => void
): () => void {
  const service = getService<MdxSourceService>(MDX_SOURCE_SERVICE_ID, { internal: true });
  return service.queries.mdxSource.subscribe({ importPath }, ({ data }) => {
    if (!data) {
      return;
    }
    onChange(mdxSourceChangeFromRecord(importPath, data));
  });
}

async function loadMdxSourceRecord(importPath: string): Promise<MdxSourceRecord | undefined> {
  const service = getService<MdxSourceService>(MDX_SOURCE_SERVICE_ID, { internal: true });
  return service.queries.mdxSource.loaded({ importPath });
}

function mdxSourceChangeFromRecord(importPath: string, record: MdxSourceRecord): MdxSourceChange {
  if (record.error) {
    return { importPath, revision: record.revision, error: record.error };
  }
  return { importPath, revision: record.revision, source: record.source };
}

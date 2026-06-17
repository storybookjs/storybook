import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const MCP_STORIES_ARRAY = 'stories: v.optional(v.array(Story)),';
const MCP_STORIES_RECORD = `stories: v.optional(v.union([
	v.array(Story),
	v.pipe(v.record(v.string(), Story), v.transform((stories) => Object.values(stories))),
])),`;

/**
 * Patches `@storybook/mcp` to accept component manifest `stories` as a Record keyed by story id
 * (manifest v1) in addition to the legacy array shape.
 *
 * Remove once `@storybook/mcp` ships native Record support.
 */
export async function patchMcpStoriesRecord(cwd: string): Promise<void> {
  const mcpPath = join(cwd, 'node_modules/@storybook/mcp/dist/index.js');

  let contents: string;
  try {
    contents = await readFile(mcpPath, 'utf8');
  } catch {
    return;
  }

  if (contents.includes(MCP_STORIES_RECORD)) {
    return;
  }

  if (!contents.includes(MCP_STORIES_ARRAY)) {
    throw new Error(
      `@storybook/mcp at ${mcpPath} does not match the expected stories schema; update scripts/patch-mcp-stories-record.ts`
    );
  }

  await writeFile(mcpPath, contents.replace(MCP_STORIES_ARRAY, MCP_STORIES_RECORD), 'utf8');
}

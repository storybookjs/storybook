import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

const payloadSchema = z.object({
  components: z.record(
    z.object({
      stories: z.record(z.object({ snippet: z.string().optional() })),
    })
  ),
});

export function readStaticStoryDocs(staticDir: string) {
  const directory = join(staticDir, 'services/core/story-docs');
  const components: Record<string, Record<string, { snippet: string | null }>> = {};
  for (const file of readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()) {
    const payload = payloadSchema.parse(JSON.parse(readFileSync(join(directory, file), 'utf8')));
    for (const [id, component] of Object.entries(payload.components)) {
      components[id] = {
        ...components[id],
        ...Object.fromEntries(
          Object.entries(component.stories).map(([storyId, story]) => [
            storyId,
            { snippet: story.snippet ?? null },
          ])
        ),
      };
    }
  }
  return components;
}

import { rewriteComponentImport } from 'storybook/internal/csf-tools';

import type { DocgenJsDocTags } from '../../services/docgen/types.ts';
import type { StoryDocsPayload } from '../../services/story-docs/types.ts';

export function composeComponentImport(
  jsDocTags: DocgenJsDocTags | undefined,
  storyDocs: Partial<Pick<StoryDocsPayload, 'name' | 'import'>> | null | undefined
): string | undefined {
  const imports = storyDocs?.import;
  const importOverride = jsDocTags?.import?.[0]?.trim();
  if (!imports || !importOverride || !storyDocs?.name) {
    return imports;
  }

  return rewriteComponentImport({
    imports,
    componentName: storyDocs.name,
    importOverride,
  });
}

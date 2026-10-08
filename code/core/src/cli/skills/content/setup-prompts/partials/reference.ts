import { dedent } from 'ts-dedent';

import type { SetupInstructionsContext } from '../types.ts';

export function referenceSection({ docsUrl }: SetupInstructionsContext): string {
  return dedent`
    ## Reference (fetch only if stuck)

    - Docs index: https://storybook.js.org/llms.txt
    - Writing stories: ${docsUrl('writing-stories')}
    - Decorators: ${docsUrl('writing-stories/decorators')}
    - Play functions: ${docsUrl('writing-stories/play-function')}
    - Vitest addon: ${docsUrl('writing-tests/integrations/vitest-addon')}

    Append \`?codeOnly=true\` to a docs URL for code-only snippets.
  `;
}

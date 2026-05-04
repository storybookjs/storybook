import { dedent } from 'ts-dedent';

import type { ProjectInfo, SetupInstructionsContext } from '../types.ts';
import { getDocsMarkdownUrl } from '../utils/docs-markdown-url.ts';
import { ext } from '../utils/ext.ts';
import { listRules, listSteps } from '../utils/markdown.ts';
import {
  buildPortalStep,
  buildSharedPreviewStep,
  cleanupStep,
  discoveryStepStrict,
  interactionPlayStep,
  mswStep,
  verifyStep,
  writeStoriesStep,
} from './partials/steps.ts';
import {
  batchTestsRule,
  editOverWriteRule,
  nodeModuleReadsRule,
  noPolishRule,
  onboardingContentRule,
  packageManagerRule,
  preferSharedFixesRule,
  readBudgetRule,
  toolsVsShellRule,
} from './partials/rules.ts';

export function instructions(projectInfo: ProjectInfo): string {
  const { configDir, language, needsUserOnboarding, packageManager, packageManagerName } =
    projectInfo;
  const tsx = ext(language, true);
  const ts = ext(language, false);
  const docsUrl = (path: string) => getDocsMarkdownUrl(path, projectInfo);
  const mswInstall = packageManager.getInstallCommand(
    ['msw', 'msw-storybook-addon', 'mockdate'],
    true
  );

  const ctx: SetupInstructionsContext = {
    configDir,
    docsUrl,
    mswInstall,
    needsUserOnboarding,
    packageManager,
    packageManagerName,
    tsx,
    ts,
  };

  return dedent`
    Your goal is to make Storybook fully functional in this project: configure \`${configDir}/preview.${tsx}\` with the right decorators, add MSW for data, and write up to 10 colocated \`*.stories.${tsx}\` files. Add \`play\` functions only where they prove something non-trivial.

    ## Rules of engagement (follow strictly — these are time budgets, not suggestions)

    ${listRules([
      toolsVsShellRule(ctx),
      nodeModuleReadsRule(ctx),
      readBudgetRule(ctx),
      editOverWriteRule(ctx),
      batchTestsRule(ctx),
      packageManagerRule(ctx),
      preferSharedFixesRule(ctx),
      onboardingContentRule(ctx),
      noPolishRule(ctx),
    ])}

    ## Plan (do not skip steps, but keep each step lean)

    ${listSteps(
      [
        discoveryStepStrict(projectInfo, ctx),
        buildSharedPreviewStep(projectInfo, ctx),
        buildPortalStep(projectInfo, ctx),
        mswStep(projectInfo, ctx),
        writeStoriesStep(projectInfo, ctx),
        interactionPlayStep(projectInfo, ctx),
        verifyStep(projectInfo, ctx),
        cleanupStep(projectInfo, ctx),
      ],
      { level: 3 }
    )}

    ## Done when

    - **Exactly one \`CssCheck\` story exists** somewhere in the new stories, asserting a concrete computed style value read from the component's source (added at the end of Step 5).
    - Every story file you wrote that vitest confirmed passing has had \`'needs-work'\` stripped, leaving \`tags: ['ai-generated']\`. Anything still failing keeps \`['ai-generated', 'needs-work']\`.
    - \`npx vitest --project storybook run\` passes for the new files.
    - The project's TypeScript check passes for changed files.
    - The shared preview is strong enough that stories don't need per-story fetch/provider workarounds.

    ## Reference (only fetch if stuck)

    - Docs index: https://storybook.js.org/llms.txt
    - Writing stories: ${docsUrl('writing-stories')}
    - Decorators: ${docsUrl('writing-stories/decorators')}
    - Play functions: ${docsUrl('writing-stories/play-function')}
    - Vitest integration: ${docsUrl('writing-tests/vitest-plugin')}

    Append \`?codeOnly=true\` to any docs URL for code-only snippets. Don't fetch unless a specific question can't be answered from this prompt.
  `;
}

import { dedent } from 'ts-dedent';

import type { ProjectInfo, SetupInstructionsContext } from '../types.ts';
import { getDocsMarkdownUrl } from '../utils/docs-markdown-url.ts';
import { ext } from '../utils/ext.ts';
import { listDOD, listRules, listSteps } from '../utils/markdown.ts';
import {
  buildPortalStep,
  buildSharedPreviewStep,
  cleanupStep,
  discoveryStepRelaxed,
  interactionPlayStep,
  monorepoStep,
  mswStep,
  verifyWithAllowedFailureStep,
  writeStoriesWithAllowedFailuresStep,
} from './partials/steps.ts';
import {
  batchTestsRule,
  editOverWriteRule,
  monorepoRule,
  nodeModuleReadsRule,
  noPolishRule,
  packageManagerRule,
  preferSharedFixesRule,
  readBudgetRuleRelaxed,
  toolsVsShellRule,
} from './partials/rules.ts';
import {
  cssCheckDOD,
  sharedPreviewDOD,
  storyTagsV2DOD,
  typeCheckPassesWhenExpectedDOD,
  vitestPassesWhenExpectedDOD,
} from './partials/dod.ts';

export function instructions(projectInfo: ProjectInfo): string {
  const { configDir, language, needsUserOnboarding, packageManager, packageManagerName } =
    projectInfo;
  const tsx = ext(language, true);
  const ts = ext(language, false);
  const docsUrl = (path: string) => getDocsMarkdownUrl(path, projectInfo);
  const mswInstall = packageManager.getInstallCommand(['msw', 'mockdate'], true);

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
      monorepoRule(ctx),
      readBudgetRuleRelaxed(ctx),
      editOverWriteRule(ctx),
      batchTestsRule(ctx),
      packageManagerRule(ctx),
      preferSharedFixesRule(ctx),
      noPolishRule(ctx),
    ])}

    ## Plan (do not skip steps, but keep each step lean)

    ${listSteps(
      [
        discoveryStepRelaxed(projectInfo, ctx),
        monorepoStep(projectInfo, ctx),
        buildSharedPreviewStep(projectInfo, ctx),
        buildPortalStep(projectInfo, ctx),
        mswStep(projectInfo, ctx),
        writeStoriesWithAllowedFailuresStep(projectInfo, ctx),
        interactionPlayStep(projectInfo, ctx),
        verifyWithAllowedFailureStep(projectInfo, ctx),
        cleanupStep(projectInfo, ctx),
      ],
      { level: 3 }
    )}

    ## Done when

    ${listDOD([
      cssCheckDOD(ctx),
      storyTagsV2DOD(ctx),
      vitestPassesWhenExpectedDOD(ctx),
      typeCheckPassesWhenExpectedDOD(ctx),
      sharedPreviewDOD(ctx),
    ])}

    ## Reference (only fetch if stuck)

    - Docs index: https://storybook.js.org/llms.txt
    - Writing stories: ${docsUrl('writing-stories')}
    - Decorators: ${docsUrl('writing-stories/decorators')}
    - Play functions: ${docsUrl('writing-stories/play-function')}
    - Vitest integration: ${docsUrl('writing-tests/vitest-plugin')}

    Append \`?codeOnly=true\` to any docs URL for code-only snippets. Don't fetch unless a specific question can't be answered from this prompt.
  `;
}

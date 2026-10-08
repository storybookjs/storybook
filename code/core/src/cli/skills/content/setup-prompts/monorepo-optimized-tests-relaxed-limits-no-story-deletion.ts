import { dedent } from 'ts-dedent';

import type { ProjectInfo } from '../../project-info.ts';
import { getDocsMarkdownUrl } from '../setup-utils/docs-markdown-url.ts';
import { ext } from '../setup-utils/ext.ts';
import { isReactProject } from '../setup-utils/is-react-project.ts';
import { listDOD, listRules, listSteps } from '../setup-utils/markdown.ts';
import {
  cssCheckDOD,
  optionalTestInfrastructureDOD,
  sharedPreviewDOD,
  storyTagsV2DOD,
  typeCheckPassesWhenExpectedDOD,
  vitestPassesWhenExpectedDOD,
} from './partials/dod.ts';
import {
  batchTestsRule,
  editOverWriteRule,
  keepUserWorkRule,
  monorepoRule,
  nodeModuleReadsRule,
  noPolishRule,
  packageManagerRule,
  preferSharedFixesRule,
  readBudgetRuleRelaxed,
} from './partials/rules.ts';
import {
  buildSharedPreviewStep,
  cleanupStep,
  discoveryStepRelaxed,
  monorepoStep,
  mswStep,
  verifyWithAllowedFailureStep,
  writeStoriesWithAllowedFailuresStep,
} from './partials/steps.ts';
import { referenceSection } from './partials/reference.ts';
import type { SetupInstructionsContext } from './types.ts';

export function instructions(projectInfo: ProjectInfo): string {
  const { configDir, language, needsUserOnboarding, packageManager, packageManagerName } =
    projectInfo;
  const tsx = ext(language, isReactProject(projectInfo));
  const ts = ext(language, false);
  const docsUrl = (path: string) => getDocsMarkdownUrl(path, projectInfo);
  const mswInstall = packageManager.getInstallCommand(['msw'], true);
  const mockDateInstall = packageManager.getInstallCommand(['mockdate'], true);

  const ctx: SetupInstructionsContext = {
    configDir,
    docsUrl,
    mockDateInstall,
    mswInstall,
    needsUserOnboarding,
    packageManager,
    packageManagerName,
    tsx,
    ts,
  };

  return dedent`
    Your goal is to make Storybook fully functional in this project: configure \`${configDir}/preview.${tsx}\` with the right decorators, add MSW or MockDate (when selected stories need them), and write up to 10 colocated \`*.stories.${tsx}\` files.

    ## Rules (follow strictly: they are time budgets, not suggestions)

    ${listRules([
      nodeModuleReadsRule(ctx),
      monorepoRule(projectInfo),
      readBudgetRuleRelaxed(ctx),
      editOverWriteRule(ctx),
      keepUserWorkRule(ctx),
      batchTestsRule(ctx),
      packageManagerRule(ctx),
      preferSharedFixesRule(ctx),
      noPolishRule(ctx),
    ])}

    ## Plan (don't skip steps, but keep each one lean)

    ${listSteps(
      [
        discoveryStepRelaxed(projectInfo, ctx),
        monorepoStep(projectInfo, ctx),
        buildSharedPreviewStep(projectInfo, ctx),
        mswStep(projectInfo, ctx),
        writeStoriesWithAllowedFailuresStep(projectInfo, ctx),
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
      optionalTestInfrastructureDOD(ctx),
    ])}

    ${referenceSection(ctx)}
  `;
}

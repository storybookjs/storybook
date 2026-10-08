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
  storyTagsV1DOD,
  typeCheckPassesStrictDOD,
  vitestPassesStrictDOD,
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
  readBudgetRule,
} from './partials/rules.ts';
import {
  buildSharedPreviewStep,
  cleanupStep,
  discoveryStepStrict,
  monorepoStep,
  mswStep,
  verifyStep,
  writeStoriesStep,
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
      readBudgetRule(ctx),
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
        discoveryStepStrict(projectInfo, ctx),
        monorepoStep(projectInfo, ctx),
        buildSharedPreviewStep(projectInfo, ctx),
        mswStep(projectInfo, ctx),
        writeStoriesStep(projectInfo, ctx),
        verifyStep(projectInfo, ctx),
        cleanupStep(projectInfo, ctx),
      ],
      { level: 3 }
    )}

    ## Done when
    
    ${listDOD([
      cssCheckDOD(ctx),
      storyTagsV1DOD(ctx),
      vitestPassesStrictDOD(ctx),
      typeCheckPassesStrictDOD(ctx),
      sharedPreviewDOD(ctx),
      optionalTestInfrastructureDOD(ctx),
    ])}

    ${referenceSection(ctx)}
  `;
}

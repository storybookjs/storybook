import { PackageManagerName } from 'storybook/internal/common';

import { dedent } from 'ts-dedent';

import type { ProjectInfo } from '../../../project-info.ts';
import type { SetupInstructionsContext } from '../types.ts';

export function nodeModuleReadsRule(ctx: SetupInstructionsContext): string {
  return dedent`**Read each file once, whole, and never inside \`node_modules\`.** The imports shown in this prompt are correct; don't verify them by introspecting installed packages.`;
}

export function monorepoRule({
  monorepoType,
}: Pick<ProjectInfo, 'monorepoType'>): string | undefined {
  if (monorepoType) {
    return `**${monorepoType} monorepo.** Don't initially look for config or existing Storybook content in other packages. Start exploring from config and tooling local to the package where you are asked to set up Storybook. If it uses local monorepo dependencies, build all dependencies found during discovery before writing stories or running tests.`;
  }
}

export function packageManagerRule({
  packageManager,
  packageManagerName,
}: SetupInstructionsContext): string {
  const storybookCmd = packageManager.getPackageCommand(['storybook']);
  if (!packageManagerName) {
    return dedent`**Detect the package manager once** from the lockfile (\`pnpm-lock.yaml\` → pnpm, \`yarn.lock\` → yarn, \`bun.lock\` or \`bun.lockb\` → bun, otherwise npm) and use it for every install and CLI command. Use \`npx\` only when the project uses npm.`;
  }
  if (packageManager.type === PackageManagerName.NPM) {
    return dedent`**Use npm** for installs and \`${storybookCmd}\` for Storybook CLI commands (detected from this project's lockfile).`;
  }
  return dedent`**Use ${packageManagerName}** for installs and \`${storybookCmd}\` for Storybook CLI commands (detected from this project's lockfile). Don't use \`npx\`: it runs npm, which fails when the project enforces another package manager.`;
}

export function editOverWriteRule({ configDir }: SetupInstructionsContext): string {
  return dedent`**Extend, don't overwrite.** Edit the existing \`${configDir}/preview\` and \`${configDir}/main\` files in place and add to their config objects.`;
}

export function keepUserWorkRule(ctx: SetupInstructionsContext): string {
  return dedent`**Keep the user's work.** Never delete or rewrite the stories, components, or config that existed before you started; add to them instead.`;
}

export function batchTestsRule(ctx: SetupInstructionsContext): string {
  return dedent`**Batch the test loop.** Write **all** stories first, then run the tests **once** across everything. No per-file runs until that first run reveals failures.`;
}

export function readBudgetRule(ctx: SetupInstructionsContext): string | undefined {
  return dedent`**Read budget: ~12 files for discovery** before writing any code (\`index.html\`, entry, App, providers, routing, root CSS, 2–3 representative components, 1–2 hooks). If you need more, summarize and move on.`;
}

export function readBudgetRuleRelaxed(ctx: SetupInstructionsContext): string | undefined {
  return dedent`**Read budget: ~40 files for discovery.** Before writing any code you may Read at most ~40 files: \`index.html\`, entry, App, providers, routing, root CSS, 1–2 hooks, 1 test, and spend the rest on components. You may read direct component dependencies essential to their understanding only after having read 20 components (or all components if fewer in the codebase).`;
}

export function preferSharedFixesRule({
  configDir,
  tsx,
}: SetupInstructionsContext): string | undefined {
  return dedent`**Prefer fixing the shared \`${configDir}/preview.${tsx}\`** over story-local workarounds when multiple stories fail the same way.`;
}

export function noPolishRule(ctx: SetupInstructionsContext): string | undefined {
  return dedent`**Stop when the "Done when" list is met.** Don't keep polishing.`;
}

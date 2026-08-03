import { dedent } from 'ts-dedent';
import { getMonorepoType } from '../../../../shared/utils/get-monorepo-type.ts';
import type { SetupInstructionsContext } from '../../types.ts';

export function toolsVsShellRule(ctx: SetupInstructionsContext): string {
  return dedent`**Discover with Glob/Grep/Read, not shell.** Never use \`ls\`, \`find\`, \`cat\`, \`head\`, \`tail\`, shell \`grep\`, \`sed\`, or \`node -e\` for discovery or for editing files in bulk — these are slower per call and violate caching. Substitute bash commands for the specific tool names listed below, or available tools with the closest semantics:
    - List a directory → \`Glob('src/components/*')\` (alt names: \`search_files\`, \`file_search\`), not \`ls src/components\`.
    - Search a string → \`Grep('pattern', { path: 'src' })\` (alt names: \`grep_search\`, \`search_files\`), not \`grep -rn ...\` or \`find ... | xargs grep\`.
    - Read a file → \`Read('path/to/file')\` (alt names: \`read_file\`), not \`cat\`/\`head\`/\`tail\`.
    - Bulk-edit many files → multiple \`Edit\` calls (alt names: \`apply_patch\`, \`replace_in_file\`, \`replace\`), or one \`Edit\` with \`replace_all\` (alt names: \`replace\` with \`allow_multiple\`), not \`sed -i\`.`;
}

export function nodeModuleReadsRule(ctx: SetupInstructionsContext): string {
  return dedent`**Never read or grep inside \`node_modules\`.** The imports shown in this prompt are correct — don't verify them by introspecting installed packages. If something seems off, re-read this prompt, not \`node_modules\`.`;
}

export function monorepoRule(ctx: SetupInstructionsContext): string | undefined {
  const monorepoType = getMonorepoType();
  if (monorepoType) {
    return `**${monorepoType} monorepo.** Don't initially look for config or existing Storybook content in other packages. Start exploring from config and tooling local to the package where you are asked to set up Storybook. If it uses local monorepo dependencies, build all dependencies found during discovery before writing stories or running tests.`;
  }
}

export function packageManagerRule({
  packageManager,
  packageManagerName,
}: SetupInstructionsContext): string {
  const storybookCmd = packageManager.getPackageCommand(['storybook']);
  if (packageManagerName) {
    return dedent`**Use \`${packageManagerName}\` for installs and \`${storybookCmd}\` for Storybook/Vitest CLI commands** (detected from this project's lockfile). Do not use \`npx\` — it invokes npm and fails when the repo enforces a different package manager.`;
  }
  return dedent`**Detect the package manager once** from the lockfile (\`pnpm-lock.yaml\` → pnpm, \`yarn.lock\` → yarn, \`bun.lockb\` → bun, otherwise npm) and use it for every install and CLI command in this trial. Do not use \`npx\` when the project uses pnpm, yarn, or bun.`;
}

export function editOverWriteRule({ configDir, tsx }: SetupInstructionsContext): string {
  return dedent`**Edit > Write.** For any file you've Read, use \`Edit\`. Use \`Write\` only for new files. The project already has a \`${configDir}/preview.${tsx}\` from \`storybook init\` — **Edit** it, do not overwrite.`;
}

export function batchTestsRule(ctx: SetupInstructionsContext): string {
  return dedent`**Batch the test loop.** Write **all** stories first, then run vitest **once** across everything. No per-file vitest runs until after that first batch run reveals failures.`;
}

export function readBudgetRule(ctx: SetupInstructionsContext): string | undefined {
  return dedent`**Read budget: ~12 files for discovery.** Before writing any code you may Read at most ~12 files (\`index.html\`, entry, App, providers, routing, root CSS, 2–3 representative pages/components, 1–2 hooks, 1 test). If you need more, summarize and move on.`;
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
  return dedent`**Stop when the success criteria are met** — don't keep polishing.`;
}

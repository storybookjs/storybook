import { getVitestStorybookRunCommand } from 'storybook/internal/common';

import { dedent } from 'ts-dedent';

import type { SetupInstructionsContext } from '../types.ts';

export function cssCheckDOD(ctx: SetupInstructionsContext): string {
  return dedent`Exactly one \`CssCheck\` story asserts a computed style value read from a component's source.`;
}

export function storyTagsV1DOD(ctx: SetupInstructionsContext): string {
  return dedent`Stories you added whose tests pass are tagged \`['ai-generated']\`; ones that still fail keep \`['ai-generated', 'needs-work']\`.`;
}

export function storyTagsV2DOD(ctx: SetupInstructionsContext): string {
  return dedent`Every story file that passes vitest tests has had \`'needs-work'\` stripped, leaving \`tags: ['ai-generated']\`. Story files with vitest failures keep \`['ai-generated', 'needs-work']\`.`;
}

function vitestFallback(packageManager: SetupInstructionsContext['packageManager']): string {
  return `if \`@storybook/addon-vitest\` could not be added, \`${packageManager.getPackageCommand(['storybook', 'build'])}\` succeeds instead`;
}

export function vitestPassesStrictDOD({ packageManager }: SetupInstructionsContext): string {
  return dedent`\`${getVitestStorybookRunCommand(packageManager)}\` passes for the new files (${vitestFallback(packageManager)}).`;
}

export function vitestPassesWhenExpectedDOD({ packageManager }: SetupInstructionsContext): string {
  return dedent`\`${getVitestStorybookRunCommand(packageManager)}\` passes for the new files that don't have \`'needs-work'\` in their tags (${vitestFallback(packageManager)}). Files with \`'needs-work'\` may still fail.`;
}

export function typeCheckPassesStrictDOD(ctx: SetupInstructionsContext): string {
  return dedent`The project's TypeScript check passes for changed files.`;
}

export function typeCheckPassesWhenExpectedDOD(ctx: SetupInstructionsContext): string {
  return dedent`The project's TypeScript check passes for the new files that don't have \`'needs-work'\` in their tags. Files with \`'needs-work'\` may still fail.`;
}

export function sharedPreviewDOD(ctx: SetupInstructionsContext): string {
  return dedent`The shared preview makes per-story provider or fetch workarounds unnecessary.`;
}

export function optionalTestInfrastructureDOD(_ctx: SetupInstructionsContext): string {
  return dedent`MSW and MockDate were added only if a verified story uses them; existing MSW or MockDate setup is left in place.`;
}

import { dedent } from 'ts-dedent';
import { getVitestStorybookRunCommand } from '../../../../common/js-package-manager/util.ts';
import type { SetupInstructionsContext } from '../../types.ts';

export function cssCheckDOD(ctx: SetupInstructionsContext): string {
  return dedent`**Exactly one \`CssCheck\` story exists** somewhere in the new stories, asserting a concrete computed style value read from the component's source.`;
}

export function storyTagsV1DOD(ctx: SetupInstructionsContext): string {
  return dedent`Every story file you wrote that vitest confirmed passing has had \`'needs-work'\` stripped, leaving \`tags: ['ai-generated']\`. Anything still failing keeps \`['ai-generated', 'needs-work']\`.`;
}

export function storyTagsV2DOD(ctx: SetupInstructionsContext): string {
  return dedent`Every story file that passes vitest tests has had \`'needs-work'\` stripped, leaving \`tags: ['ai-generated']\`. Story files with vitest failures keep \`['ai-generated', 'needs-work']\`.`;
}

export function vitestPassesStrictDOD({ packageManager }: SetupInstructionsContext): string {
  return dedent`\`${getVitestStorybookRunCommand(packageManager)}\` passes for the new files.`;
}

export function vitestPassesWhenExpectedDOD({ packageManager }: SetupInstructionsContext): string {
  return dedent`\`${getVitestStorybookRunCommand(packageManager)}\` passes for the new files that don't have \`'needs-work'\` in their tags. Files with \`'needs-work'\` may still fail.`;
}

export function typeCheckPassesStrictDOD(ctx: SetupInstructionsContext): string {
  return dedent`The project's TypeScript check passes for changed files.`;
}

export function typeCheckPassesWhenExpectedDOD(ctx: SetupInstructionsContext): string {
  return dedent`The project's TypeScript check passes for the new files that don't have \`'needs-work'\` in their tags. Files with \`'needs-work'\` may still fail.`;
}

export function sharedPreviewDOD(ctx: SetupInstructionsContext): string {
  return dedent`The shared preview is strong enough that stories don't need per-story fetch/provider workarounds.`;
}

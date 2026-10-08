import { getMswInitCommand, getVitestStorybookRunCommand } from 'storybook/internal/common';

import { dedent } from 'ts-dedent';

import type { ProjectInfo } from '../../../project-info.ts';
import { isReactProject } from '../../setup-utils/is-react-project.ts';
import type { SetupInstructionsContext as InstructionsContext } from '../types.ts';
import { getCssCheckExample, getPreviewExample, getStoryExample } from './examples.ts';

type Step = { title: string; body: string };

const VITEST_ADDON = '@storybook/addon-vitest';

function discoveryList(projectInfo: ProjectInfo, { tsx }: InstructionsContext, pages: string) {
  const isReact = isReactProject(projectInfo);

  return dedent`
    - \`index.html\`: stylesheets, fonts, and mount or portal roots not created by JS
    - ${isReact ? `entry file (\`main.${tsx}\` / \`index.${tsx}\`): providers wrapping \`<App />\`, root CSS imports` : 'application entry file: framework initialization, shared services or providers, root CSS imports'}
    - ${isReact ? `\`App.${tsx}\` and provider or context files: router, providers, what they expose` : 'root component and shared state or services: router, what they expose'}
    - root CSS: global styles, CSS variables, theme tokens
    - ${isReact ? 'data hooks (`fetch(...)`, `useQuery`, `axios`)' : 'data fetching (network clients, services, query utilities)'}: base URL and endpoints called during render
    - browser state read at render (\`localStorage\`, \`sessionStorage\`, cookies) and portal targets (${isReact ? '`createPortal(...)`' : 'content rendered outside the component root'})
    - ${pages} real page or feature components, your source of truth for ${isReact ? 'JSX' : 'component usage'} patterns
  `;
}

export function discoveryStepStrict(projectInfo: ProjectInfo, ctx: InstructionsContext): Step {
  return {
    title: 'Discover the runtime (≤12 reads)',
    body: dedent`
      Find, in this order:

      ${discoveryList(projectInfo, ctx, '1–2')}

      Stop once you know which providers, CSS, browser state, and network calls the preview must supply.
    `,
  };
}

export function discoveryStepRelaxed(projectInfo: ProjectInfo, ctx: InstructionsContext): Step {
  return {
    title: 'Discover the runtime (≤40 reads)',
    body: dedent`
      Find, in this order:

      ${discoveryList(projectInfo, ctx, '1–20')}

      Stop once you know which providers, CSS, browser state, and network calls the preview must supply, and what surrounding context components need to render.
    `,
  };
}

export function monorepoStep(projectInfo: ProjectInfo, ctx: InstructionsContext): Step {
  return {
    title: 'Monorepo preparation',
    body: dedent`Build any local monorepo dependencies identified during discovery, and keep track of existing errors in the codebase unrelated to the package changes you'll make.`,
  };
}

export function buildSharedPreviewStep(
  projectInfo: ProjectInfo,
  { configDir, tsx }: InstructionsContext
): Step {
  const isReact = isReactProject(projectInfo);

  return {
    title: 'Build the shared preview',
    body: dedent`
      Edit \`${configDir}/preview.${tsx}\` once so most stories work without per-story setup${isReact ? ` (rename \`preview.ts\` to \`preview.tsx\` when you add JSX)` : ''}. Merge in only what the selected stories need; this example shows every optional piece:

      ${getPreviewExample(projectInfo)}

      - ${isReact ? 'Use the **real** provider tree and the **real** root CSS import.' : "Use the **real** application setup and the **real** root CSS import, configured with the installed framework's setup APIs."} Don't invent providers. If the app's CSS is linked from \`index.html\`, import that file here.
      - Seed only the browser-state keys the app reads. Don't clear storage or reset Storybook's own state.
      - Don't mock \`window\`, \`document\`, \`navigator\`, observers, or \`fetch\` directly.
      - If components portal into elements such as \`#modal-root\`, add a decorator that creates those elements before the story renders (not \`preview-body.html\`).
    `,
  };
}

export function mswStep(
  projectInfo: ProjectInfo,
  { configDir, mockDateInstall, mswInstall, packageManager, ts }: InstructionsContext
): Step {
  const mswAddonAdd = packageManager.getPackageCommand([
    'storybook',
    'add',
    'msw-storybook-addon@3',
  ]);
  const csfNextNote = projectInfo.hasCsfFactoryPreview
    ? ` If \`storybook add\` puts \`import * as mswStorybookAddon from 'msw-storybook-addon/preview'\` into your \`definePreview\` \`addons\`, replace it with \`addonMsw()\` as in the preview example: that form breaks type inference for the whole preview.`
    : '';

  return {
    title: 'Add MSW or MockDate only if a selected story needs it',
    body: dedent`
      If a selected story makes network requests, register the addon, install MSW, and generate the worker script:

      \`\`\`bash
      ${mswAddonAdd}
      ${mswInstall}
      ${getMswInitCommand(packageManager)}
      \`\`\`

      Serve the worker with \`staticDirs: ['../public']\` in \`${configDir}/main.${ts}\`, and put handlers for only the endpoints your stories hit in \`${configDir}/msw-handlers.${ts}\` (\`export const mswHandlers = [http.get(url, () => HttpResponse.json(data))]\`, imported from \`msw\`).${csfNextNote}

      If a selected story's output depends on the current date or time, run \`${mockDateInstall}\` and set the date in \`beforeEach\`.

      Otherwise skip this step: don't install unused dependencies or create an empty handler file. Keep any MSW or MockDate setup the project already has.
    `,
  };
}

function writeStoriesBody(projectInfo: ProjectInfo, { tsx }: InstructionsContext, tagging: string) {
  const isReact = isReactProject(projectInfo);

  return dedent`
    Pick up to 10 meaningful components, from reusable components up to pages. Skip subcomponents, hooks, contexts, helpers, and \`App\` when real pages exist. If a component already has stories, extend that file instead of writing a second one, and put the tags below on the stories you add rather than on its meta. Write \`*.stories.${tsx}\` files next to the components: ~3 stories per file, more only when real usage warrants it, with ${isReact ? 'JSX' : 'component usage'} patterns copied from real pages, routes, or tests.

    ${tagging} Show all imports explicitly. Don't add a custom \`title\` or new app components, and don't build large story-specific harnesses: fix the preview instead.

    ${getStoryExample(projectInfo)}

    Add a \`play\` function only when it proves something the render doesn't: an interaction, async data arriving, a portal mounting, or state reflected in an aria attribute or a prop rendered as text. Variant-only stories get no \`play\`. Take \`canvas\`, \`userEvent\`, and \`canvasElement\` from the play arguments; import only \`expect\`, \`fn\`, and \`waitFor\` from \`storybook/test\`, plus \`within\` for portals, which you query through \`within(canvasElement.ownerDocument.body)\`.

    Add exactly **one** \`CssCheck\` story to the whole project. \`toBeVisible\` passes on an unstyled component, so assert a concrete computed style read from a component's source (a hex color, a Tailwind class, a theme variable) to prove the preview loaded the app's CSS:

    ${getCssCheckExample(projectInfo)}
  `;
}

export function writeStoriesStep(projectInfo: ProjectInfo, ctx: InstructionsContext): Step {
  return {
    title: 'Write up to 10 story files in one batch',
    body: writeStoriesBody(
      projectInfo,
      ctx,
      "Start every new meta with `tags: ['ai-generated', 'needs-work']`. You remove `'needs-work'` once the file's tests pass, so anything unverified stays marked."
    ),
  };
}

export function writeStoriesWithAllowedFailuresStep(
  projectInfo: ProjectInfo,
  ctx: InstructionsContext
): Step {
  return {
    title: 'Write up to 10 story files in one batch',
    body: writeStoriesBody(
      projectInfo,
      ctx,
      "Start every new meta with `tags: ['ai-generated', 'needs-work']`. You remove `'needs-work'` once the file's tests pass, and leave it on any file that is not fully functional at the end of your self-healing loop."
    ),
  };
}

function missingVitestAddonNote(
  { addons }: ProjectInfo,
  { configDir, packageManager }: InstructionsContext
): string | undefined {
  if (addons.includes(VITEST_ADDON)) {
    return undefined;
  }
  const addVitest = packageManager.getPackageCommand(['storybook', 'add', VITEST_ADDON, '--yes']);
  const build = packageManager.getPackageCommand(['storybook', 'build']);

  return dedent`
    This project doesn't have \`${VITEST_ADDON}\` yet, which runs stories as tests. Add it before running them; a request to set up Storybook covers this:

    \`\`\`bash
    ${addVitest}
    \`\`\`

    If adding it fails, undo what it added to \`package.json\` and \`${configDir}/main\`, run \`${build}\` instead to check that the stories compile, keep \`'needs-work'\` on every story file, and tell the user that story tests need \`${VITEST_ADDON}\`.
  `;
}

export function verifyStep(projectInfo: ProjectInfo, ctx: InstructionsContext): Step {
  const { packageManager, tsx } = ctx;
  const vitestRunFile = getVitestStorybookRunCommand(packageManager, `path/to/Foo.stories.${tsx}`);

  return {
    title: 'Verify in one batch, then iterate only on failures',
    body: [
      missingVitestAddonNote(projectInfo, ctx),
      dedent`
      Run all new stories together, then the project's TypeScript check (its \`package.json\` script, such as \`${packageManager.getRunCommand('typecheck')}\`, or \`tsc --noEmit\`). Read each output once, whole:

      \`\`\`bash
      ${getVitestStorybookRunCommand(packageManager)}
      \`\`\`

      For each failure, read the error; when several stories fail the same way, fix the shared preview. Re-run only the affected file (\`${vitestRunFile}\`) until it passes, at most ~5 times per file. Don't swap in easier stories that teach less about the codebase.

      When a file passes, remove \`'needs-work'\` from the tags you added. Files you couldn't fix keep it; move on.
    `,
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}

export function verifyWithAllowedFailureStep(
  projectInfo: ProjectInfo,
  ctx: InstructionsContext
): Step {
  const { packageManager, tsx } = ctx;
  const vitestRunFile = getVitestStorybookRunCommand(packageManager, `path/to/Foo.stories.${tsx}`);

  return {
    title: 'Verify in one batch, then iterate only on failures',
    body: [
      missingVitestAddonNote(projectInfo, ctx),
      dedent`
      Run all new stories together, then the project's TypeScript check (its \`package.json\` script, such as \`${packageManager.getRunCommand('typecheck')}\`, or \`tsc --noEmit\`). Read each output once, whole:

      \`\`\`bash
      ${getVitestStorybookRunCommand(packageManager)}
      \`\`\`

      For each failure, read the error; when several stories fail the same way, fix the shared preview. Re-run TypeScript and Vitest only for the affected file(s) (\`${vitestRunFile}\`) until they pass, at most 5 times. If a file still fails, keep \`'needs-work'\` on it and move on: don't chase project-wide TypeScript errors caused by those files, and don't swap in easier stories that teach less about the codebase.

      When a file passes, remove \`'needs-work'\` from the tags you added.
    `,
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}

export function cleanupStep({ needsUserOnboarding }: ProjectInfo, ctx: InstructionsContext): Step {
  const exampleFiles = needsUserOnboarding
    ? 'Keep the example components, CSS, stories, and MDX docs that `storybook init` generated: the onboarding in the Storybook UI needs them.'
    : "If the project has the examples `storybook init` generates (a `src/stories/` folder with `Configure.mdx` next to `Button`, `Header`, and `Page`), delete that folder once your own stories pass. Don't delete any other stories.";

  return {
    title: 'Clean up',
    body: `Remove debug code, mocks added during diagnosis, and dependencies you added but didn't use. ${exampleFiles}`,
  };
}

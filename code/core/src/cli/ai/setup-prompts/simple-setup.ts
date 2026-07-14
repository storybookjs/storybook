/**
 * Prompt for `npx storybook ai simple-setup`.
 *
 * Experimental command used only by the Storybook agent plugins/skills. It is
 * intentionally not referenced from docs or in-app nudges and emits no
 * telemetry. The invoking skill guarantees the preconditions:
 *
 * - Storybook is installed and running 10.5.2 or later
 * - `@storybook/addon-mcp` is installed
 * - the project has no user-written stories yet (only `storybook init` examples)
 *
 * The goal is the smallest possible first win: one story for one simple
 * component, verifiably styled, ending with an offer to build out more. The
 * build-out itself is `npx storybook ai setup` territory.
 */
import { dedent } from 'ts-dedent';

import type { ProjectInfo } from '../types.ts';
import { ext } from '../utils/ext.ts';
import { getProjectOverview } from '../utils/project-overview.ts';

function getPreviewCssExample(projectInfo: ProjectInfo): string {
  const { configDir, language, framework, rendererPackage } = projectInfo;
  const tsx = ext(language, true);
  const typeImport = framework || rendererPackage || '@storybook/react-vite';

  if (projectInfo.hasCsfFactoryPreview) {
    return dedent`
      \`\`\`${tsx}
      // ${configDir}/preview.${tsx}
      import '../src/index.css'; // the same global CSS the app loads

      import { definePreview } from 'storybook/preview';

      export default definePreview({
        // keep whatever is already configured here
      });
      \`\`\`
    `;
  }

  if (language === 'js') {
    return dedent`
      \`\`\`${tsx}
      // ${configDir}/preview.${tsx}
      import '../src/index.css'; // the same global CSS the app loads

      const preview = {
        // keep whatever is already configured here
      };

      export default preview;
      \`\`\`
    `;
  }

  return dedent`
    \`\`\`${tsx}
    // ${configDir}/preview.${tsx}
    import type { Preview } from '${typeImport}';
    import '../src/index.css'; // the same global CSS the app loads

    const preview: Preview = {
      // keep whatever is already configured here
    };

    export default preview;
    \`\`\`
  `;
}

function getStoryExample(projectInfo: ProjectInfo): string {
  const { language, framework, rendererPackage } = projectInfo;
  const tsx = ext(language, true);
  const typeImport = framework || rendererPackage || '@storybook/react-vite';

  if (projectInfo.hasCsfFactoryPreview) {
    return dedent`
      \`\`\`${tsx}
      // src/components/Button.stories.${tsx}
      import { expect } from 'storybook/test';

      import preview from '#.storybook/preview';
      import { Button } from './Button';

      const meta = preview.meta({
        component: Button,
        tags: ['ai-generated'],
      });

      export const Primary = meta.story({
        args: { children: 'Order now' },
      });

      export const Disabled = meta.story({
        args: { children: 'Order now', disabled: true },
      });

      // Proves the app's global CSS actually loaded: read a real styling value
      // from the component's source (hex color, Tailwind class, CSS variable)
      // and assert the resolved computed style.
      export const StyleCheck = meta.story({
        args: { children: 'Submit' },
        play: async ({ canvas }) => {
          const button = canvas.getByRole('button', { name: /submit/i });
          // Button uses bg-blue-600 — fails if Tailwind / global CSS did not load.
          await expect(getComputedStyle(button).backgroundColor).toBe('rgb(37, 99, 235)');
        },
      });
      \`\`\`
    `;
  }

  if (language === 'js') {
    return dedent`
      \`\`\`${tsx}
      // src/components/Button.stories.${tsx}
      import { expect } from 'storybook/test';

      import { Button } from './Button';

      const meta = {
        component: Button,
        tags: ['ai-generated'],
      };

      export default meta;

      export const Primary = {
        args: { children: 'Order now' },
      };

      export const Disabled = {
        args: { children: 'Order now', disabled: true },
      };

      // Proves the app's global CSS actually loaded: read a real styling value
      // from the component's source (hex color, Tailwind class, CSS variable)
      // and assert the resolved computed style.
      export const StyleCheck = {
        args: { children: 'Submit' },
        play: async ({ canvas }) => {
          const button = canvas.getByRole('button', { name: /submit/i });
          // Button uses bg-blue-600 — fails if Tailwind / global CSS did not load.
          await expect(getComputedStyle(button).backgroundColor).toBe('rgb(37, 99, 235)');
        },
      };
      \`\`\`
    `;
  }

  return dedent`
    \`\`\`${tsx}
    // src/components/Button.stories.${tsx}
    import type { Meta, StoryObj } from '${typeImport}';
    import { expect } from 'storybook/test';

    import { Button } from './Button';

    const meta = {
      component: Button,
      tags: ['ai-generated'],
    } satisfies Meta<typeof Button>;

    export default meta;
    type Story = StoryObj<typeof meta>;

    export const Primary: Story = {
      args: { children: 'Order now' },
    };

    export const Disabled: Story = {
      args: { children: 'Order now', disabled: true },
    };

    // Proves the app's global CSS actually loaded: read a real styling value
    // from the component's source (hex color, Tailwind class, CSS variable)
    // and assert the resolved computed style.
    export const StyleCheck: Story = {
      args: { children: 'Submit' },
      play: async ({ canvas }) => {
        const button = canvas.getByRole('button', { name: /submit/i });
        // Button uses bg-blue-600 — fails if Tailwind / global CSS did not load.
        await expect(getComputedStyle(button).backgroundColor).toBe('rgb(37, 99, 235)');
      },
    };
    \`\`\`
  `;
}

export function instructions(projectInfo: ProjectInfo): string {
  const { configDir, language } = projectInfo;
  const tsx = ext(language, true);
  const hasVitestAddon = projectInfo.addons.some((addon) =>
    addon.includes('@storybook/addon-vitest')
  );

  const verifyStep = hasVitestAddon
    ? dedent`
      ### Step 4 — Start Storybook and verify

      Start the Storybook dev server in the background (or reuse one that already serves this project, usually \`http://localhost:6006\`), using the project's existing \`package.json\` script. Leave it running when you are done — it is part of the deliverable.

      Then run the story tests for the new file through Storybook itself and self-heal until they pass. Read the command's help in its entirety before the first run — it documents the payload shape:

      \`\`\`bash
      STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai run-story-tests --help
      \`\`\`

      1. Run the tests for the new story file only (\`STORYBOOK_FEATURE_AI_CLI=1 npx storybook ai run-story-tests ...\`).
      2. If a test fails, read the error and fix the cause — prefer fixing \`${configDir}/preview.${tsx}\` (missing CSS import, missing provider) over story-local workarounds. If the \`StyleCheck\` assertion fails, the global CSS is not loading in the preview; fix that before anything else.
      3. Re-run the tests and repeat. Cap this loop at ~5 attempts — if the tests still fail, stop and explain to the user what went wrong and what the possible next steps are.
    `
    : dedent`
      ### Step 4 — Start Storybook and verify

      Start the Storybook dev server in the background (or reuse one that already serves this project, usually \`http://localhost:6006\`), using the project's existing \`package.json\` script. Leave it running when you are done — it is part of the deliverable.

      Confirm the new stories render styled — the component should look exactly like it does in the app.
    `;

  return dedent`
    Your goal is to write **one story file for one simple component**, so the user sees their own component rendered in Storybook. Keep it fast and minimal: no new addons, no data mocking, no refactors, no extra stories.

    ${renderSteps(projectInfo, verifyStep)}
  `;
}

function renderSteps(projectInfo: ProjectInfo, verifyStep: string): string {
  const { configDir, language } = projectInfo;
  const tsx = ext(language, true);

  return dedent`
    ### Step 1 — Pick one simple component (and note the runners-up)

    Look through the project's own components and pick the **simplest presentational leaf component** you can find — think Button, Badge, Tag, Avatar: a handful of props, no data fetching, no routing, no app-specific context. Skip anything created by \`storybook init\` (e.g. \`src/stories/\`).

    While scanning, note the 2–4 next-best candidates (a mix of simple and more interesting components). You will offer these to the user at the end — do **not** write stories for them now.

    ### Step 2 — Make sure global styling loads

    Find how the app loads its global CSS and theme: a CSS import in the entry file (\`main.${tsx}\` / \`index.${tsx}\`), a \`<link>\` or inline \`<style>\` in \`index.html\`, Tailwind, CSS variables, or a theme provider.

    **Edit the existing \`${configDir}/preview.${tsx}\`** (created by \`storybook init\`) so it loads the same global CSS the app uses — add to what is there, don't replace it:

    ${getPreviewCssExample(projectInfo)}

    - If the CSS is loaded via \`<link>\` in \`index.html\` rather than imported in JS, import that same file in the preview.
    - Only add a decorator (e.g. a ThemeProvider) if the chosen component actually needs it to render. Don't invent providers.

    ### Step 3 — Write the story file

    Write **one** colocated story file next to the chosen component: the default story, at most a couple of meaningful variants, and one \`StyleCheck\` story.

    ${getStoryExample(projectInfo)}

    - Tag the file with \`tags: ['ai-generated']\`.
    - Don't add a custom \`title\`.
    - Don't create new app components or story-specific harnesses.

    ${verifyStep}

    ### Step 5 — Wrap up

    Tell the user what you built and where. Then end with this offer, filling in the real component names you noted in Step 1:

    > Do you want me to build out stories for more components? For example **A**, **B** and **C**.

    If the user says yes, run \`npx storybook ai setup\` and follow its instructions to build out stories for the rest of the project.
  `;
}

export function getAiSimpleSetupMarkdownOutput(projectInfo: ProjectInfo): string {
  return dedent`
    # Storybook Simple Setup

    ${getProjectOverview(projectInfo)}

    ${instructions(projectInfo)}
  `;
}

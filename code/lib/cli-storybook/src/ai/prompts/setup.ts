import { dedent } from 'ts-dedent';

import type { ProjectInfo } from '../types.ts';

function getTypeImportSource(projectInfo: ProjectInfo): string {
  return projectInfo.framework || projectInfo.rendererPackage || '@storybook/react';
}

function getPreviewDecoratorExample(projectInfo: ProjectInfo): string {
  const configDir = projectInfo.configDir;

  if (projectInfo.hasCsfFactoryPreview) {
    return dedent`
      \`\`\`tsx
      // ${configDir}/preview.tsx
      import '../src/index.css'; // import global styles

      import { definePreview } from 'storybook/preview';

      export default definePreview({
        decorators: [
          (Story) => (
            <ThemeProvider theme={theme}>
              <MemoryRouter>
                <Story />
              </MemoryRouter>
            </ThemeProvider>
          ),
        ],
      });
      \`\`\`
    `;
  }

  const typeImport = getTypeImportSource(projectInfo);

  return dedent`
    \`\`\`tsx
    // ${configDir}/preview.tsx
    import type { Preview } from '${typeImport}';
    import '../src/index.css'; // import global styles

    const preview: Preview = {
      decorators: [
        (Story) => (
          <ThemeProvider theme={theme}>
            <MemoryRouter>
              <Story />
            </MemoryRouter>
          </ThemeProvider>
        ),
      ],
    };

    export default preview;
    \`\`\`
  `;
}

function getSimpleStoryExample(projectInfo: ProjectInfo): string {
  if (projectInfo.hasCsfFactoryPreview) {
    return dedent`
      \`\`\`tsx
      import preview from '#.storybook/preview';
      import { Button } from './Button';

      const meta = preview.meta({
        title: 'AI Generated/Simple/Button',
        component: Button,
        tags: ['ai-generated'],
      });

      export const Default = meta.story({
        args: {
          label: 'Click me',
        },
      });

      export const Disabled = meta.story({
        args: {
          label: 'Disabled',
          disabled: true,
        },
      });
      \`\`\`
    `;
  }

  const typeImport = getTypeImportSource(projectInfo);

  return dedent`
    \`\`\`tsx
    import type { Meta, StoryObj } from '${typeImport}';
    import { Button } from './Button';

    const meta = {
      title: 'AI Generated/Simple/Button',
      component: Button,
      tags: ['ai-generated'],
    } satisfies Meta<typeof Button>;

    export default meta;
    type Story = StoryObj<typeof meta>;

    export const Default: Story = {
      args: {
        label: 'Click me',
      },
    };

    export const Disabled: Story = {
      args: {
        label: 'Disabled',
        disabled: true,
      },
    };
    \`\`\`
  `;
}

function getNeedsWorkTagExample(projectInfo: ProjectInfo): string {
  if (projectInfo.hasCsfFactoryPreview) {
    return dedent`
      \`\`\`ts
      const meta = preview.meta({
        title: 'AI Generated/Simple/Button',
        component: Button,
        tags: ['ai-generated', 'needs-work'],
      });
      \`\`\`
    `;
  }

  return dedent`
    \`\`\`ts
    const meta = {
      title: 'AI Generated/Simple/Button',
      component: Button,
      tags: ['ai-generated', 'needs-work'],
    } satisfies Meta<typeof Button>;
    \`\`\`
  `;
}

export function instructions(projectInfo: ProjectInfo): string {
  const configDir = projectInfo.configDir;

  return dedent`
    Attention: The following instructions must be followed in order to successfully set up Storybook in this project. Do not skip steps or attempt to do them out of order.

    Your goal is to make Storybook fully functional in this project by analyzing the codebase,
    configuring the preview with the right decorators, and writing example stories for 9 components.

    Work through these steps in order. After each story file, run Vitest to verify it renders.
    If the test fails, read the error, fix the issue, and re-run until it passes before moving on.

    ### Step 1: Analyze the codebase

    Before writing any stories, understand what the components need to render:

    - Scan the project for context providers, theme systems, routers, stores, and i18n setups.
      Look at the app's entry point (e.g. \`App.tsx\`, \`main.tsx\`, \`layout.tsx\`) to see what
      providers wrap the component tree.
    - Identify global CSS or style imports required for components to look correct.
    - Note any path aliases configured in tsconfig or bundler config.
    - Read \`${configDir}/main.ts\` (or \`main.js\`) to find the \`stories\` glob patterns.
      Your story files must match those patterns to be picked up by Storybook.

    ### Step 2: Configure \`${configDir}/preview.tsx\` with decorators

    Add decorators that wrap every story with the providers your components need.
    Without this, most non-trivial components will crash.

    ${getPreviewDecoratorExample(projectInfo)}

    Common decorators to add:

    - **Theme providers** (e.g. ThemeProvider, MUI ThemeProvider, styled-components, Tailwind)
    - **Router** (e.g. MemoryRouter, BrowserRouter mock)
    - **State stores** (e.g. Redux Provider, Zustand, Jotai)
    - **i18n** (e.g. IntlProvider, I18nextProvider)
    - **Global CSS** — import global stylesheets at the top of \`preview.tsx\`

    ### Step 3: Write stories for 9 components

    Pick 9 real components from the codebase, 3 of each complexity level.
    Use the title prefix \`AI Generated/<Complexity>/<ComponentName>\` so they are grouped
    together in the Storybook sidebar.

    **Simple (3 components)** — Presentational with few props, no internal state.
    Examples: Button, Badge, Avatar, Icon, Label, Chip.
    Title format: \`AI Generated/Simple/<ComponentName>\`

    **Medium (3 components)** — Multiple visual variants or composed from simpler components.
    Examples: Card, Alert, Input, Select, Tooltip, Tabs.
    Title format: \`AI Generated/Medium/<ComponentName>\`

    **Complex (3 components)** — Internal state, side effects, or deep composition.
    Examples: Modal, DataTable, Form, Dropdown, Accordion, Sidebar.
    Title format: \`AI Generated/Complex/<ComponentName>\`

    For each component, create a \`<ComponentName>.stories.tsx\` file next to the component.
    Each file must have at least 2 story exports covering the component's main states.
    Make sure the file location and naming matches the \`stories\` patterns in \`${configDir}/main.ts\`.

    #### Story tags

    Every story meta must include the \`ai-generated\` tag to identify AI-created stories:

    ${getSimpleStoryExample(projectInfo)}

    If a story could not be fully fixed after the self-healing loop (the test still fails
    or the rendering is incomplete), add the \`needs-work\` tag alongside \`ai-generated\`:

    ${getNeedsWorkTagExample(projectInfo)}

    Rules:

    - Every named export is a story. Use \`args\` to set props.
    - Provide all required props via \`args\` — check the component's types.
    - If a component needs per-story decorators (beyond the global ones), add them in the meta.
    - Do NOT use \`any\` types. Use the component's prop types for type safety.

    Reference: https://storybook.js.org/docs/writing-stories

    ### Step 4: Verify each story with Vitest

    After writing each story file, immediately verify it:

    \`\`\`bash
    npx vitest --project storybook <path-to-story-file>
    \`\`\`

    **Self-healing loop — repeat for every story file:**

    1. Write/update the story file
    2. Run \`npx vitest --project storybook <path-to-story-file>\`
    3. If it fails: read the error output carefully
       - Missing provider → add a decorator in \`${configDir}/preview.tsx\` or in the story meta
       - Missing prop → add the required prop to \`args\`
       - Import error → fix the import path
       - CSS/asset error → add static dirs or import the stylesheet
    4. Fix the issue and go back to step 2
    5. Once the test passes, move to the next component

    After all 9 story files pass individually, run the full suite:

    \`\`\`bash
    npx vitest --project storybook
    \`\`\`

    Once all stories pass, run a full Storybook build as a final check:

    \`\`\`bash
    npx storybook build
    \`\`\`

    If the build fails, fix the issue before finishing.

    Finally, run \`npx storybook doctor\` to check for common issues
    (version mismatches, duplicated deps, etc.) and fix anything it reports.

    ### Checklist

    - [ ] Analyzed codebase for providers, global styles, and path aliases
    - [ ] Read story patterns from \`${configDir}/main.ts\`
    - [ ] Configured \`${configDir}/preview.tsx\` with necessary decorators
    - [ ] Simple component 1: story written and passing
    - [ ] Simple component 2: story written and passing
    - [ ] Simple component 3: story written and passing
    - [ ] Medium component 1: story written and passing
    - [ ] Medium component 2: story written and passing
    - [ ] Medium component 3: story written and passing
    - [ ] Complex component 1: story written and passing
    - [ ] Complex component 2: story written and passing
    - [ ] Complex component 3: story written and passing
    - [ ] Full Vitest suite passes: \`npx vitest --project storybook\`
    - [ ] \`npx storybook build\` succeeds
    - [ ] \`npx storybook doctor\` reports no remaining issues
    - [ ] All passing stories have \`tags: ['ai-generated']\` in their meta
    - [ ] Any stories that still need work have \`tags: ['ai-generated', 'needs-work']\` in their meta
  `;
}

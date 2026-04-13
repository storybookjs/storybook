import { dedent } from 'ts-dedent';

import type { ProjectInfo, AiPrompt } from './types.ts';

/**
 * Builds a markdown-format docs URL with renderer and language query parameters.
 * Appending .md to any Storybook docs URL returns clean markdown with code examples.
 */
export function getDocsMarkdownUrl(
  path: string,
  projectInfo?: Pick<ProjectInfo, 'majorVersion' | 'renderer' | 'language'>
): string {
  const { majorVersion, renderer = 'react', language = 'ts' } = projectInfo ?? {};
  const versionSegment = majorVersion ? `/${majorVersion}` : '';
  const params = new URLSearchParams();
  if (renderer) {
    params.set('renderer', renderer);
  }
  params.set('language', language);
  const query = params.toString();
  return `https://storybook.js.org/docs${versionSegment}/${path}.md${query ? `?${query}` : ''}`;
}

export function getPrompts(projectInfo: ProjectInfo): AiPrompt[] {
  const aiPrompts: AiPrompt[] = [];

  aiPrompts.push({
    name: 'setup',
    description: 'Set up Storybook for success',
    instructions: getSetupInstructions(projectInfo),
  });

  return aiPrompts;
}

function getTypeImportSource(projectInfo: ProjectInfo): string {
  return projectInfo.framework || projectInfo.rendererPackage || '@storybook/react';
}

function getSetupInstructions(projectInfo: ProjectInfo): string {
  const configDir = projectInfo.configDir;
  const typeImport = getTypeImportSource(projectInfo);

  return dedent`
    Attention: The following instructions must be followed in order to successfully set up Storybook in this project. Do not skip steps or attempt to do them out of order.

    Your goal is to make Storybook fully functional in this project by analyzing the codebase,
    configuring the preview with the right decorators, and writing stories for some components.

    After each created story, run Vitest to verify it renders.
    If the test fails, read the error, fix the issue, and re-run until it passes before moving on.

    - Copy real patterns from the codebase
    - Keep the app code unchanged
    - Put the default setup in \`${configDir}/preview.tsx\`
    - Keep app mocking and runtime setup in \`${configDir}/preview.tsx\`, not in the stories

    ${getDocsReferenceSection(projectInfo)}

    ### Step 1: Analyze the codebase

    Read enough of the app to understand the full runtime environment before writing any stories.

    Do not stop at \`main.tsx\` or \`App.tsx\`.
    Follow imports into providers, pages, hooks, and shared components until you know:

    - which providers exist
    - which CSS files are injected
    - which queries fetch data
    - which browser-state reads happen
    - which portals and portal roots exist
    - which pages and components show the real usage patterns

    Example of what to copy:

    \`\`\`tsx
    // src/main.tsx
    import "./index.css";
    import App from "./App";
    import { SessionProvider } from "./contexts/SessionContext";

    createRoot(document.getElementById("root")!).render(
      <SessionProvider>
        <App />
      </SessionProvider>,
    );
    \`\`\`

    That means Storybook should copy:

    - the \`index.css\` import
    - the \`SessionProvider\`
    - the same provider order

    Example of tracing the app deeper:

    \`\`\`tsx
    // src/App.tsx
    function App() {
      const { products, loadMoreProducts } = useProducts();
      const { currentUser, signOut } = useSession();
      // ...
    }
    \`\`\`

    \`\`\`ts
    // src/hooks/useProducts.ts
    const response = await fetch(apiBaseUrl + "/products?page=1");
    \`\`\`

    \`\`\`ts
    // src/hooks/useTheme.ts
    const savedTheme = localStorage.getItem("theme");
    \`\`\`

    That means the default Storybook setup should discover and prepare:

    - provider state
    - MSW handlers for queries
    - browser-state values that are actually read during render

    ### Step 2: Build one default app environment in preview

    Set up Storybook once so most stories work without story-specific setup.

    Start with the smallest faithful environment:

    - the real provider tree
    - the real root CSS
    - seeded browser state if the app reads it during render
    - MSW for network/data queries

    It is fine to seed browser state such as \`localStorage\`, \`sessionStorage\`, and cookies when the app reads them during render.
    Seed only the specific app-owned keys and values you need.
    Do not clear all \`localStorage\`, \`sessionStorage\`, or cookies, and do not reset Storybook's own state.
    Do not mock or redefine the browser runtime itself.
    The stories run in Vitest browser mode, so the real browser environment should already exist.

    ${getPreviewConfigExample(projectInfo)}

    Use this same idea for:

    - providers
    - root CSS
    - browser state
    - dates, and if the app logic depends on them during render then always use \`mockdate\`

    Example with the \`mockdate\` package:

    ${getMockDateExample(projectInfo)}

    ### Step 3: Support portals with preview-body.html

    If the app uses portals, copy that setup into Storybook too.

    Look for patterns like:

    - \`createPortal(...)\`
    - modal, dialog, drawer, popover, tooltip, toast, or dropdown portal components
    - hard-coded roots such as \`#portal-root\`, \`#modal-root\`, \`#drawer-root\`, or \`#toast-root\`

    Example of what to copy:

    \`\`\`tsx
    // real component
    return createPortal(<ModalContent />, document.getElementById("portal-root")!);
    \`\`\`

    That means Storybook should create the same portal root in \`${configDir}/preview-body.html\`:

    \`\`\`html
    <!-- ${configDir}/preview-body.html -->
    <div id="portal-root"></div>
    \`\`\`

    If the app uses multiple portal roots, create all of them there:

    \`\`\`html
    <!-- ${configDir}/preview-body.html -->
    <div id="modal-root"></div>
    <div id="drawer-root"></div>
    <div id="toast-root"></div>
    \`\`\`

    If a library portals directly to \`document.body\`, do not add extra roots for it.
    Make sure the copied page shell, CSS, and layout still allow overlays, fixed positioning, and z-index stacking to render correctly.

    ### Step 4: Mock side effects globally

    All network/data queries should be handled by the default Storybook environment.

    - Always use \`msw-storybook-addon\` for query mocking.
    - If you introduce MSW, run \`npx msw init ./public --save\` to create the worker file.
    - Make sure Storybook serves \`./public\` as a static dir so \`mockServiceWorker.js\` is available.
    - Do not mock \`fetch\` directly.
    - Network/data queries should return deterministic mock data.
    - If you need to change dependencies, first check the lockfile and use that package manager for the change.

    Example of copying a real fetch pattern into shared handlers:

    \`\`\`ts
    // real app hook
    const response = await fetch(
      apiBaseUrl +
        "/products?" +
        new URLSearchParams({
          page: "1",
          sort: "featured",
        }),
    );
    \`\`\`

    \`\`\`ts
    // ${configDir}/msw-handlers.ts
    import { http, HttpResponse } from "msw";

    export const mswHandlers = {
      products: [
        http.get("https://api.example.com/products", () =>
          HttpResponse.json({
            items: [
              {
                id: "product-1",
                name: "Example product",
                description: "Mock product description",
                imageUrl: "https://images.example.com/product.jpg",
                price: 42,
              },
            ],
          }),
        ),
      ],
    };
    \`\`\`

    ${getMswPreviewExample(projectInfo)}

    \`\`\`ts
    // ${configDir}/main.ts
    import type { StorybookConfig } from "${typeImport}";

    const config: StorybookConfig = {
      staticDirs: ["../public"],
    };

    export default config;
    \`\`\`

    Keep these mocks global.
    Do not put fetch mocks in individual stories.
    Only add handlers for requests that the shared preview setup or the stories actually use.
    Do not add catch-all handlers that can hide unrelated failures.
    If the defaults are not enough, improve the shared default setup instead.
    Seed browser state when needed, but do not mock \`window\`, \`document\`, \`navigator\`, observers, or similar runtime APIs.
    The only exception is \`mockdate\` when date-based rendering exists.

    ### Step 5: Write stories

    Try to find around 10 good candidate components for story files.
    Write colocated stories for top-level components, from low-level reusable components up to page components.
    Write up to 10 story files, or fewer only if the codebase clearly has fewer meaningful targets.

    The stories should use JSX copied from real usage patterns in:

    - pages
    - app shells
    - routes
    - tests
    - existing feature code

    As a rule of thumb, each story file should have around 3 story exports when the component or page has enough meaningful states.
    It can have more when the real usage supports it, up to 10 story exports in one file.

    Always show all imports explicitly in story and preview files.
    Do not rely on omitted or implied imports in examples or generated code.

    #### Story tags

    Every story meta must include the \`ai-generated\` tag to identify AI-created stories:

    ${getStoryExample(projectInfo)}

    If a story could not be fully fixed after the self-healing loop (the test still fails
    or the rendering is incomplete), add the \`needs-work\` tag alongside \`ai-generated\`:

    ${getNeedsWorkTagExample(projectInfo)}

    Keep app mocking and runtime setup in preview, not in the stories.
    Do not build large story-specific harnesses.
    Do not write story files for subcomponents, hooks, contexts, or helpers.
    Do not create new application components.
    Do not add a custom \`title\`.
    Do not stop after only a few easy targets if the codebase has more meaningful components or pages available.

    ### Step 6: Write a play function for every story

    Every named story export must have a \`play\` function.
    The \`play\` function is not optional, even for simple stories.

    The purpose of the \`play\` function is to prove that the story actually works in the copied Storybook environment:

    - the story renders something real and non-empty
    - the decorators provide the needed context
    - the CSS is applied well enough for the intended state to be visible
    - the MSW mocks or seeded browser state are actually being used
    - important interactions, async loading states, and portals behave correctly

    Use \`play\` functions to verify behavior, not just to click around.
    A story without assertions is incomplete.

    Use tools from \`storybook/test\` such as:

    - \`expect\`
    - \`waitFor\`

    Prefer \`canvas\` and \`userEvent\` from the \`play\` context.
    Do not destructure \`canvasElement\` just to create \`const canvas = within(canvasElement)\`.
    Do not import \`userEvent\` from \`storybook/test\`; use \`userEvent\` from the \`play\` context instead.
    Only use \`canvasElement.ownerDocument\` when you need to query outside the canvas, such as for portals.

    Example:

    \`\`\`tsx
    import type { StoryObj } from "${typeImport}";

    export const FilledForm: Story = {
      play: async ({ canvas, userEvent }) => {
        const emailInput = canvas.getByLabelText("email", {
          selector: "input",
        });

        await userEvent.type(emailInput, "example-email@email.com", {
          delay: 100,
        });

        const passwordInput = canvas.getByLabelText("password", {
          selector: "input",
        });

        await userEvent.type(passwordInput, "ExamplePassword", {
          delay: 100,
        });

        const submitButton = canvas.getByRole("button");
        await userEvent.click(submitButton);
      },
    };
    \`\`\`

    The assertions should match the real pattern you copied:

    - for provider-backed stories, assert the provider-dependent UI appears correctly
    - for mocked-data stories, wait for the mocked data to appear and assert on it
    - for CSS-sensitive states, assert on visibility, text layout, class-driven states, or meaningful computed styles
    - for routing or navigation stories, assert the routed state or navigation outcome
    - for portal stories, query from \`canvasElement.ownerDocument\` when the UI renders outside the canvas

    Examples of useful checks:

    - a themed button has the expected label and is visibly enabled or disabled
    - a modal opened through a decorator or provider is visible in the portal root
    - mocked API data appears in the page instead of a loading spinner forever
    - a selected tab actually shows the selected panel
    - a toast, alert, or badge has the expected accessible text and visual state
    - a CSS class or computed style confirms the real state that matters

    ### Step 7: Cover the patterns you found

    Write stories for the real patterns in the codebase, for example:

    - a low-level reusable component in real JSX usage
    - a provider-backed component
    - a browser-state-backed component
    - a fetched-data component
    - a real page component

    Use \`App.tsx\` to inspect the real provider tree and usage patterns, but do not make a story for \`App\` when the codebase has actual page components.

    Example page story:

    ${getPageStoryExample(projectInfo)}

    ### Step 8: Verify both rendering and types

    As you work, verify the stories with Vitest:

    \`\`\`bash
    npx vitest --project storybook <path-to-story-file>
    \`\`\`

    Also verify types so you catch missing required props, broken imports, and preview typing issues. Run the same TypeScript command the project itself uses.

    \`\`\`bash
    <project-specific-typescript-command>
    \`\`\`

    After verification passes, review every changed file and remove anything that is not needed for the final solution, especially debug fixes, overly broad mocks, unnecessary dependencies, and eval artifacts.

    Keep iterating until:

    - every story you wrote passes
    - every story you wrote has a meaningful passing \`play\` function
    - the changed stories and preview setup pass the project's real TypeScript check
    - the rendered output looks sensible
    - the default global mocked environment is strong enough that stories do not need manual fetch overrides
    - stories no longer fail because the shared preview setup and story JSX are fixed
    - all passing stories have \`tags: ['ai-generated']\` in their meta
    - any stories that still need work have \`tags: ['ai-generated', 'needs-work']\` in their meta
  `;
}

function getDocsReferenceSection(projectInfo: ProjectInfo): string {
  const docsUrl = (path: string) => getDocsMarkdownUrl(path, projectInfo);

  return dedent`
    ### Storybook Documentation Reference

    Use the following references to look up Storybook APIs, concepts, or examples:

    - Full docs index: https://storybook.js.org/llms.txt
    - See code snippets only with codeOnly=true param e.g. ${docsUrl('writing-stories')}&codeOnly=true

    Key documentation pages for this task:
    - Writing stories: ${docsUrl('writing-stories')}
    - Decorators: ${docsUrl('writing-stories/decorators')}
    - Args: ${docsUrl('writing-stories/args')}
    - Play functions: ${docsUrl('writing-stories/play-function')}
    - Vitest integration: ${docsUrl('writing-tests/vitest-plugin')}

    Fetch these URLs directly when you need guidance on Storybook APIs or patterns.
  `;
}

function getPreviewConfigExample(projectInfo: ProjectInfo): string {
  const configDir = projectInfo.configDir;
  const typeImport = getTypeImportSource(projectInfo);

  if (projectInfo.hasCsfFactoryPreview) {
    return dedent`
      \`\`\`tsx
      // ${configDir}/preview.tsx
      import '../src/index.css'; // import global styles
      import MockDate from 'mockdate';

      import { definePreview } from 'storybook/preview';
      import { SessionProvider } from '../src/contexts/SessionContext';

      export default definePreview({
        decorators: [
          (Story) => (
            <SessionProvider>
              <Story />
            </SessionProvider>
          ),
        ],
        async beforeEach() {
          localStorage.setItem('theme', 'dark');
          localStorage.setItem('sidebar:open', 'true');
          MockDate.set('2024-04-01T12:00:00Z');
        },
      });
      \`\`\`
    `;
  }

  return dedent`
    \`\`\`tsx
    // ${configDir}/preview.tsx
    import type { Preview } from '${typeImport}';
    import MockDate from 'mockdate';
    import '../src/index.css'; // import global styles
    import { SessionProvider } from '../src/contexts/SessionContext';

    const preview: Preview = {
      decorators: [
        (Story) => (
          <SessionProvider>
            <Story />
          </SessionProvider>
        ),
      ],
      async beforeEach() {
        localStorage.setItem('theme', 'dark');
        localStorage.setItem('sidebar:open', 'true');
        MockDate.set('2024-04-01T12:00:00Z');
      },
    };

    export default preview;
    \`\`\`
  `;
}

function getMockDateExample(projectInfo: ProjectInfo): string {
  const typeImport = getTypeImportSource(projectInfo);

  if (projectInfo.hasCsfFactoryPreview) {
    return dedent`
      \`\`\`tsx
      import MockDate from 'mockdate';
      import { definePreview } from 'storybook/preview';

      export default definePreview({
        async beforeEach() {
          MockDate.set('2024-04-01T12:00:00Z');
        },
      });
      \`\`\`
    `;
  }

  return dedent`
    \`\`\`tsx
    import type { Preview } from '${typeImport}';
    import MockDate from 'mockdate';

    const preview: Preview = {
      async beforeEach() {
        MockDate.set('2024-04-01T12:00:00Z');
      },
    };

    export default preview;
    \`\`\`
  `;
}

function getMswPreviewExample(projectInfo: ProjectInfo): string {
  const configDir = projectInfo.configDir;
  const typeImport = getTypeImportSource(projectInfo);

  if (projectInfo.hasCsfFactoryPreview) {
    return dedent`
      \`\`\`tsx
      // ${configDir}/preview.tsx
      import { definePreview } from 'storybook/preview';
      import { initialize, mswLoader } from 'msw-storybook-addon';
      import { mswHandlers } from './msw-handlers';

      initialize({
        onUnhandledRequest: 'bypass',
      });

      export default definePreview({
        loaders: [mswLoader],
        parameters: {
          msw: {
            handlers: mswHandlers,
          },
        },
      });
      \`\`\`
    `;
  }

  return dedent`
    \`\`\`tsx
    // ${configDir}/preview.tsx
    import type { Preview } from '${typeImport}';
    import { initialize, mswLoader } from 'msw-storybook-addon';
    import { mswHandlers } from './msw-handlers';

    initialize({
      onUnhandledRequest: 'bypass',
    });

    const preview: Preview = {
      loaders: [mswLoader],
      parameters: {
        msw: {
          handlers: mswHandlers,
        },
      },
    };

    export default preview;
    \`\`\`
  `;
}

function getStoryExample(projectInfo: ProjectInfo): string {
  if (projectInfo.hasCsfFactoryPreview) {
    return dedent`
      \`\`\`tsx
      import preview from '#.storybook/preview';
      import { expect } from 'storybook/test';
      import { SomeComponent } from './SomeComponent';

      const meta = preview.meta({
        component: SomeComponent,
        tags: ['ai-generated'],
      });

      export const Default = meta.story({
        render: () => <SomeComponent variant="primary" disabled={false} />,
        play: async ({ canvas }) => {
          await expect(canvas.getByRole('button')).toBeVisible();
        },
      });
      \`\`\`
    `;
  }

  const typeImport = getTypeImportSource(projectInfo);

  return dedent`
    \`\`\`tsx
    import type { Meta, StoryObj } from '${typeImport}';
    import { expect } from 'storybook/test';
    import { SomeComponent } from './SomeComponent';

    const meta = {
      component: SomeComponent,
      tags: ['ai-generated'],
    } satisfies Meta<typeof SomeComponent>;

    export default meta;
    type Story = StoryObj<typeof meta>;

    export const Default: Story = {
      render: () => <SomeComponent variant="primary" disabled={false} />,
      play: async ({ canvas }) => {
        await expect(canvas.getByRole('button')).toBeVisible();
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
        component: SomeComponent,
        tags: ['ai-generated', 'needs-work'],
      });
      \`\`\`
    `;
  }

  return dedent`
    \`\`\`ts
    const meta = {
      component: SomeComponent,
      tags: ['ai-generated', 'needs-work'],
    } satisfies Meta<typeof SomeComponent>;
    \`\`\`
  `;
}

function getPageStoryExample(projectInfo: ProjectInfo): string {
  if (projectInfo.hasCsfFactoryPreview) {
    return dedent`
      \`\`\`tsx
      import preview from '#.storybook/preview';
      import { expect } from 'storybook/test';
      import { ProductPage } from './ProductPage';

      const meta = preview.meta({
        component: ProductPage,
        tags: ['ai-generated'],
      });

      export const Default = meta.story({
        render: () => <ProductPage />,
        play: async ({ canvas }) => {
          await expect(
            canvas.getByRole('heading', { name: /products/i }),
          ).toBeVisible();
        },
      });
      \`\`\`
    `;
  }

  const typeImport = getTypeImportSource(projectInfo);

  return dedent`
    \`\`\`tsx
    import type { Meta, StoryObj } from '${typeImport}';
    import { expect } from 'storybook/test';
    import { ProductPage } from './ProductPage';

    const meta = {
      component: ProductPage,
      tags: ['ai-generated'],
    } satisfies Meta<typeof ProductPage>;

    export default meta;
    type Story = StoryObj<typeof meta>;

    export const Default: Story = {
      render: () => <ProductPage />,
      play: async ({ canvas }) => {
        await expect(
          canvas.getByRole('heading', { name: /products/i }),
        ).toBeVisible();
      },
    };
    \`\`\`
  `;
}

function getProjectOverview(projectInfo: ProjectInfo): string {
  return dedent`
    ## Project Info

    | Property | Value |
    |----------|-------|
    | Version | ${projectInfo.storybookVersion || 'unknown'} |
    | Renderer | ${projectInfo.rendererPackage || 'unknown'} |
    | Framework | ${projectInfo.framework || 'unknown'} |
    | Builder | ${projectInfo.builderPackage || 'unknown'} |
    | Config Dir | \`${projectInfo.configDir}\` |
    | CSF Format | ${projectInfo.hasCsfFactoryPreview ? 'CSF Factory' : 'CSF3'} |
    | Addons | ${projectInfo.addons.length > 0 ? projectInfo.addons.join(', ') : 'none'} |
  `;
}

export function generateMarkdownOutput(projectInfo: ProjectInfo): string {
  const aiPrompts = getPrompts(projectInfo);

  const sections: string[] = [];

  sections.push(dedent`
    # Storybook Setup
  `);

  sections.push(getProjectOverview(projectInfo));

  for (const aiPrompt of aiPrompts) {
    sections.push(aiPrompt.instructions);
  }

  return sections.join('\n\n');
}

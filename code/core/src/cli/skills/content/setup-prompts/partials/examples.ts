import { dedent } from 'ts-dedent';
import type { ProjectInfo } from '../../../project-info.ts';
import { ext } from '../../setup-utils/ext.ts';
import { isReactProject } from '../../setup-utils/is-react-project.ts';
import { getTypeImportSource } from '../../setup-utils/type-import-source.ts';

export function getPreviewExample(projectInfo: ProjectInfo): string {
  const { configDir, language, hasCsfFactoryPreview } = projectInfo;
  const tsx = ext(language, isReactProject(projectInfo));
  const typeImport = getTypeImportSource(projectInfo);

  const providerImport = isReactProject(projectInfo)
    ? "import { SessionProvider } from '../src/contexts/SessionContext';"
    : '';
  const decorators = isReactProject(projectInfo)
    ? dedent`
        decorators: [
          (Story) => (
            <SessionProvider>
              <Story />
            </SessionProvider>
          ),
        ],
      `
    : '';

  if (hasCsfFactoryPreview) {
    return dedent`
      \`\`\`${tsx}
      // ${configDir}/preview.${tsx}
      import { definePreview } from '${typeImport}';
      import '../src/index.css';
      import MockDate from 'mockdate';
      import addonMsw from 'msw-storybook-addon';
      ${providerImport}
      import { mswHandlers } from './msw-handlers';

      export default definePreview({
        addons: [addonMsw()],
        ${decorators}
        async beforeEach({ msw }) {
          msw.use(...mswHandlers);
          localStorage.setItem('theme', 'dark');
          MockDate.set('2024-04-01T12:00:00Z');
        },
      });
      \`\`\`
    `;
  }

  if (language === 'js') {
    return dedent`
      \`\`\`${tsx}
      // ${configDir}/preview.${tsx}
      import '../src/index.css';
      import MockDate from 'mockdate';
      import { mswLoader } from 'msw-storybook-addon/csf3';
      ${providerImport}
      import { mswHandlers } from './msw-handlers';

      const preview = {
        ${decorators}
        loaders: [mswLoader()],
        async beforeEach({ msw }) {
          msw.use(...mswHandlers);
          localStorage.setItem('theme', 'dark');
          MockDate.set('2024-04-01T12:00:00Z');
        },
      };

      export default preview;
      \`\`\`
    `;
  }

  return dedent`
    \`\`\`${tsx}
    // ${configDir}/preview.${tsx}
    import type { Preview } from '${typeImport}';
    import '../src/index.css';
    import MockDate from 'mockdate';
    import { mswLoader } from 'msw-storybook-addon/csf3';
    ${providerImport}
    import { mswHandlers } from './msw-handlers';

    const preview: Preview = {
      ${decorators}
      loaders: [mswLoader()],
      async beforeEach({ msw }) {
        msw.use(...mswHandlers);
        localStorage.setItem('theme', 'dark');
        MockDate.set('2024-04-01T12:00:00Z');
      },
    };

    export default preview;
    \`\`\`
  `;
}

export function getPortalDecoratorExample(projectInfo: ProjectInfo): string {
  const { language } = projectInfo;
  const tsx = ext(language, isReactProject(projectInfo));

  return dedent`
    \`\`\`${tsx}
    // Add this entry to the \`decorators\` array of your preview config:
    (Story) => {
      for (const id of ['modal-root', 'drawer-root', 'toast-root']) {
        if (!document.getElementById(id)) {
          const el = document.createElement('div');
          el.id = id;
          document.body.appendChild(el);
        }
      }
      return ${isReactProject(projectInfo) ? '<Story />' : 'Story()'};
    }
    \`\`\`
  `;
}

export function getMainConfigExample(projectInfo: ProjectInfo): string {
  const { configDir, language } = projectInfo;
  const ts = ext(language, false);
  const typeImport = getTypeImportSource(projectInfo);

  if (language === 'js') {
    return dedent`
      \`\`\`js
      // ${configDir}/main.js
      const config = { staticDirs: ['../public'] };
      export default config;
      \`\`\`
    `;
  }

  return dedent`
    \`\`\`${ts}
    // ${configDir}/main.${ts}
    import type { StorybookConfig } from '${typeImport}';

    const config: StorybookConfig = { staticDirs: ['../public'] };
    export default config;
    \`\`\`
  `;
}

export function getStoryExample(projectInfo: ProjectInfo): string {
  if (!isReactProject(projectInfo)) {
    return dedent`
      Follow existing stories and the installed framework's Component Story Format. Import the real component using the project's conventions and use its actual props or inputs as \`args\`. Use the framework's rendering syntax for composition, projected content, slots, and event bindings when needed.

      For TypeScript, import \`Meta\` and \`StoryObj\` from '${getTypeImportSource(projectInfo)}' and use the type parameters supported by that framework. Add \`tags: ['ai-generated', 'needs-work']\` to the meta, then export story objects for the component's meaningful states. Include a \`play\` function only when it verifies behavior.
    `;
  }

  const { language } = projectInfo;
  const tsx = ext(language, isReactProject(projectInfo));
  const typeImport = getTypeImportSource(projectInfo);

  if (language === 'js') {
    return dedent`
      \`\`\`${tsx}
      import { expect } from 'storybook/test';
      import { Button } from './Button';

      const meta = {
        component: Button,
        tags: ['ai-generated', 'needs-work'], // strip 'needs-work' once vitest passes
      };

      export default meta;

      // Smoke check — one is enough per file
      export const Primary = {
        args: { children: 'Order now' },
        play: async ({ canvas }) => {
          await expect(canvas.getByRole('button', { name: /order now/i })).toBeVisible();
        },
      };

      // Variant-only stories: no play needed
      export const Clear = { args: { children: 'Cancel', clear: true } };
      export const Large = { args: { children: 'Checkout', large: true } };
      export const WithIcon = { args: { icon: 'cart', 'aria-label': 'food cart' } };
      \`\`\`
    `;
  }

  return dedent`
    \`\`\`${tsx}
    import type { Meta, StoryObj } from '${typeImport}';
    import { expect } from 'storybook/test';
    import { Button } from './Button';

    const meta = {
      component: Button,
      tags: ['ai-generated', 'needs-work'], // strip 'needs-work' once vitest passes
    } satisfies Meta<typeof Button>;

    export default meta;
    type Story = StoryObj<typeof meta>;

    // Smoke check — one is enough per file
    export const Primary: Story = {
      args: { children: 'Order now' },
      play: async ({ canvas }) => {
        await expect(canvas.getByRole('button', { name: /order now/i })).toBeVisible();
      },
    };

    // Variant-only stories: no play needed
    export const Clear: Story = { args: { children: 'Cancel', clear: true } };
    export const Large: Story = { args: { children: 'Checkout', large: true } };
    export const WithIcon: Story = { args: { icon: 'cart', 'aria-label': 'food cart' } };
    \`\`\`
  `;
}

export function getInteractionPlayExample(projectInfo: ProjectInfo): string {
  const { language } = projectInfo;
  const tsx = ext(language, isReactProject(projectInfo));
  const typeAnnotation = language === 'ts' ? ': Story' : '';

  return dedent`
    \`\`\`${tsx}
    export const FilledForm${typeAnnotation} = {
      play: async ({ canvas, userEvent }) => {
        await userEvent.type(canvas.getByLabelText('email'), 'a@b.com', { delay: 50 });
        await userEvent.click(canvas.getByRole('button', { name: /submit/i }));
        await expect(await canvas.findByText(/welcome/i)).toBeVisible();
      },
    };
    \`\`\`
  `;
}

import type { AIInstructionContext, AIInstructionsPreset } from 'storybook/internal/types';
import { dedent } from 'ts-dedent';

export const experimental_aiInstructions: AIInstructionsPreset = (existing, { aiContext }) => ({
  ...existing,
  story: getStoryExample(aiContext),
  preview: getPreviewExample(aiContext),
});

function getPreviewExample(projectInfo: AIInstructionContext): string {
  const { configDir, language, hasCsfFactoryPreview } = projectInfo;
  const tsx = `${language}x`;
  const typeImport = projectInfo.framework;

  const providerImport = "import { SessionProvider } from '../src/contexts/SessionContext';";
  const decorators = dedent`
        decorators: [
          (Story) => (
            <SessionProvider>
              <Story />
            </SessionProvider>
          ),
        ],
      `;

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

function getStoryExample(projectInfo: AIInstructionContext): string {
  const { language } = projectInfo;
  const tsx = `${language}x`;
  const typeImport = projectInfo.framework;

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

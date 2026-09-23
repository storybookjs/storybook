import type { AIInstructionsPreset } from 'storybook/internal/types';
import { dedent } from 'ts-dedent';

export const experimental_aiInstructions: AIInstructionsPreset = (existing, { aiContext }) => {
  const { framework, language, configDir, hasCsfFactoryPreview } = aiContext;
  const typescript = language === 'ts';
  return {
    ...existing,
    story: dedent`
      \`\`\`${language}
      ${typescript ? `import type { Meta, StoryObj } from '${framework}';` : ''}
      import { ButtonComponent } from './button.component';

      const meta = {
        component: ButtonComponent,
        tags: ['ai-generated', 'needs-work'],
      }${typescript ? ' satisfies Meta<ButtonComponent>' : ''};

      export default meta;
      ${typescript ? 'type Story = StoryObj<ButtonComponent>;' : ''}
      export const Default${typescript ? ': Story' : ''} = {};
      \`\`\`
    `,
    preview: dedent`
      \`\`\`${language}
      // ${configDir}/preview.${language}
      ${hasCsfFactoryPreview ? `import { definePreview } from '${framework}';` : typescript ? `import type { Preview } from '${framework}';` : ''}
      import { moduleMetadata } from '${framework}';
      import '../src/index.css';
      ${hasCsfFactoryPreview ? "import addonMsw from 'msw-storybook-addon';" : "import { mswLoader } from 'msw-storybook-addon/csf3';"}
      import { mswHandlers } from './msw-handlers';

      ${hasCsfFactoryPreview ? 'export default definePreview({' : `const preview${typescript ? ': Preview' : ''} = {`}
        decorators: [moduleMetadata({ imports: [] })],
        ${hasCsfFactoryPreview ? 'addons: [addonMsw()],' : 'loaders: [mswLoader()],'}
        beforeEach({ msw }) {
          msw.use(...mswHandlers);
        },
      ${hasCsfFactoryPreview ? '});' : '};'}
      ${hasCsfFactoryPreview ? '' : 'export default preview;'}
      \`\`\`
    `,
  };
};

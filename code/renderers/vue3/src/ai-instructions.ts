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
      import Button from './Button.vue';

      const meta = {
        component: Button,
        tags: ['ai-generated', 'needs-work'],
      }${typescript ? ' satisfies Meta<typeof Button>' : ''};

      export default meta;
      ${typescript ? 'type Story = StoryObj<typeof meta>;' : ''}
      export const Default${typescript ? ': Story' : ''} = {};
      \`\`\`
    `,
    preview: dedent`
      \`\`\`${language}
      // ${configDir}/preview.${language}
      ${hasCsfFactoryPreview ? `import { definePreview } from '${framework}';` : typescript ? `import type { Preview } from '${framework}';` : ''}
      
      import '../src/index.css';
      ${hasCsfFactoryPreview ? "import addonMsw from 'msw-storybook-addon';" : "import { mswLoader } from 'msw-storybook-addon/csf3';"}
      import { mswHandlers } from './msw-handlers';

      ${hasCsfFactoryPreview ? 'export default definePreview({' : `const preview${typescript ? ': Preview' : ''} = {`}
        decorators: [() => ({ template: '<div style="padding: 1rem"><story /></div>' })],
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

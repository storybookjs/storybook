// The parity suite binding the Markdown every docs-tool consumer receives.
import { describe, it, expect } from 'vitest';
import type { AllManifests, ComponentManifest, ComponentManifestMap } from './manifest-types.ts';
import fullManifestFixture from './full-manifest.fixture.json' with { type: 'json' };
import {
  formatComponentManifest,
  formatManifestsToLists,
  formatMultiSourceManifestsToLists,
  formatStoryDocumentation,
} from './markdown.ts';

describe('MarkdownFormatter - formatComponentManifest', () => {
  it('formats all full fixtures', () => {
    expect(formatComponentManifest(fullManifestFixture.components.button)).toMatchSnapshot();
    expect(formatComponentManifest(fullManifestFixture.components.card)).toMatchSnapshot();
    expect(formatComponentManifest(fullManifestFixture.components.input)).toMatchSnapshot();
  });

  describe('component header', () => {
    it('should include component name and ID', () => {
      const manifest: ComponentManifest = {
        id: 'test-component',
        path: 'src/components/TestComponent.tsx',
        name: 'TestComponent',
      };

      const result = formatComponentManifest(manifest);

      expect(result).toMatchInlineSnapshot(`
				"# TestComponent

				ID: test-component"
			`);
    });
  });

  describe('description section', () => {
    it('should include description when provided', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        path: 'src/components/Button.tsx',
        name: 'Button',
        description: 'A simple button component',
      };

      const result = formatComponentManifest(manifest);

      expect(result).toMatchInlineSnapshot(`
				"# Button

				ID: button

				A simple button component"
			`);
    });

    it('should omit description section when not provided', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
      };

      const result = formatComponentManifest(manifest);

      expect(result).not.toContain('A simple button component');
      expect(result).toMatchInlineSnapshot(`
				"# Button

				ID: button"
			`);
    });
  });

  describe('JSDoc tags', () => {
    it('renders top-level deprecation tags after the component ID', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        path: 'src/components/Button.tsx',
        name: 'Button',
        description: 'A button component',
        jsDocTags: {
          deprecated: ['Use NewButton instead.'],
        },
        reactDocgenTypescript: {
          tags: {
            deprecated: 'Use LegacyButton instead.',
          },
          props: {},
        },
      };

      expect(formatComponentManifest(manifest)).toMatchInlineSnapshot(`
        "# Button

        ID: button

        > **Deprecated:** Use NewButton instead.

        A button component"
      `);
    });

    it('falls back to react-docgen-typescript component tags', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        path: 'src/components/Button.tsx',
        name: 'Button',
        description: 'A button component',
        reactDocgenTypescript: {
          tags: {
            deprecated: 'Use NewButton instead.',
          },
          props: {},
        },
      };

      expect(formatComponentManifest(manifest)).toMatchInlineSnapshot(`
        "# Button

        ID: button

        > **Deprecated:** Use NewButton instead.

        A button component"
      `);
    });

    it('renders bare deprecation tags without a colon', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        path: 'src/components/Button.tsx',
        name: 'Button',
        description: 'A button component',
        jsDocTags: {
          deprecated: ['   '],
        },
      };

      expect(formatComponentManifest(manifest)).toMatchInlineSnapshot(`
        "# Button

        ID: button

        > **Deprecated**

        A button component"
      `);
    });

    it('forwards generic tags after the description in object order', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        path: 'src/components/Button.tsx',
        name: 'Button',
        description: 'A button component',
        jsDocTags: {
          since: ['1.2.3'],
          see: ['ButtonGroup'],
          customTag: ['alpha', ''],
        },
      };

      expect(formatComponentManifest(manifest)).toMatchInlineSnapshot(`
        "# Button

        ID: button

        A button component

        > **Since:** 1.2.3
        > **See:** ButtonGroup
        > **CustomTag:** alpha"
      `);
    });

    it('does not render ignore or description-family tags', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        path: 'src/components/Button.tsx',
        name: 'Button',
        description: 'A button component',
        jsDocTags: {
          ignore: ['true'],
          desc: ['Short text'],
          description: ['Long text'],
          describe: ['More text'],
          since: ['1.2.3'],
        },
      };

      expect(formatComponentManifest(manifest)).toMatchInlineSnapshot(`
        "# Button

        ID: button

        A button component

        > **Since:** 1.2.3"
      `);
    });

    it('does not render tags Storybook consumes as structured fields', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        path: 'src/components/Button.tsx',
        name: 'Button',
        description: 'A button component',
        import: "import { Button } from '@my-org/ui';",
        summary: 'A customizable button.',
        jsDocTags: {
          import: ["import { Button } from '@my-org/ui';"],
          summary: ['A customizable button.'],
          since: ['1.2.3'],
        },
      };

      expect(formatComponentManifest(manifest)).toMatchInlineSnapshot(`
        "# Button

        ID: button

        A button component

        > **Since:** 1.2.3"
      `);
    });

    it('renders examples as fenced code blocks after generic tags', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        path: 'src/components/Button.tsx',
        name: 'Button',
        description: 'A button component',
        jsDocTags: {
          since: ['1.2.3'],
          example: ['<Button />', '<Button disabled />'],
        },
      };

      expect(formatComponentManifest(manifest)).toMatchInlineSnapshot(`
        "# Button

        ID: button

        A button component

        > **Since:** 1.2.3

        **Example:**
        \`\`\`
        <Button />
        \`\`\`

        **Example:**
        \`\`\`
        <Button disabled />
        \`\`\`"
      `);
    });

    it('renders subcomponent deprecation tags under the subcomponent heading', () => {
      const manifest: ComponentManifest = {
        id: 'combo-box',
        name: 'ComboBox',
        path: 'src/components/ComboBox.tsx',
        subcomponents: {
          Item: {
            name: 'ComboBoxItem',
            path: 'src/components/ComboBoxItem.tsx',
            summary: 'Use for individual list items.',
            jsDocTags: {
              deprecated: ['Use ListBoxItem instead.'],
            },
          },
        },
      };

      expect(formatComponentManifest(manifest)).toMatchInlineSnapshot(`
        "# ComboBox

        ID: combo-box

        ## Subcomponents

        ### ComboBoxItem

        > **Deprecated:** Use ListBoxItem instead.

        Use for individual list items."
      `);
    });

    it('does not change untagged component and subcomponent output', () => {
      const manifest: ComponentManifest = {
        id: 'combo-box',
        name: 'ComboBox',
        path: 'src/components/ComboBox.tsx',
        description: 'A combo box component',
        subcomponents: {
          Item: {
            name: 'ComboBoxItem',
            path: 'src/components/ComboBoxItem.tsx',
            summary: 'Item summary.',
            description: 'Item description.',
          },
        },
      };

      expect(formatComponentManifest(manifest)).toMatchInlineSnapshot(`
        "# ComboBox

        ID: combo-box

        A combo box component

        ## Subcomponents

        ### ComboBoxItem

        Item summary.

        Item description."
      `);
    });
  });

  describe('subcomponents section', () => {
    it('should include subcomponent docs and props before stories', () => {
      const manifest: ComponentManifest = {
        id: 'combo-box',
        name: 'ComboBox',
        path: 'src/components/ComboBox.tsx',
        description: 'A combo box component',
        subcomponents: {
          Item: {
            name: 'ComboBoxItem',
            path: 'src/components/ComboBoxItem.tsx',
            description: 'Use for individual list items.',
            import: 'import { ComboBoxItem } from "@/components";',
            reactComponentMeta: {
              displayName: 'ComboBoxItem',
              filePath: 'src/components/ComboBoxItem.tsx',
              description: '',
              exportName: 'ComboBoxItem',
              props: {
                textValue: {
                  name: 'textValue',
                  description: 'Required when the children are not plain text.',
                  required: false,
                  defaultValue: null,
                  type: {
                    name: 'string',
                  },
                },
              },
            },
          },
        },
        stories: [
          {
            name: 'Default',
            snippet: '<ComboBox />',
          },
        ],
      };

      const result = formatComponentManifest(manifest);

      expect(result).toContain('## Subcomponents');
      expect(result).toContain('### ComboBoxItem');
      expect(result).toContain('#### Props');
      expect(result).toContain('export type ComboBoxItemProps = {');
      expect(result.indexOf('## Subcomponents')).toBeLessThan(result.indexOf('## Stories'));
    });

    it('should include subcomponent errors when docgen is unavailable', () => {
      const manifest: ComponentManifest = {
        id: 'combo-box',
        name: 'ComboBox',
        path: 'src/components/ComboBox.tsx',
        subcomponents: {
          Item: {
            name: 'ComboBoxItem',
            path: 'src/components/ComboBoxItem.tsx',
            error: {
              name: 'No component import found',
              message: 'No component file found for ComboBoxItem.',
            },
          },
        },
      };

      const result = formatComponentManifest(manifest);

      expect(result).toContain('Error: No component import found');
      expect(result).toContain('No component file found for ComboBoxItem.');
    });
  });

  describe('stories section', () => {
    it('should include story ID in detailed story output', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        stories: [
          {
            id: 'button--default',
            name: 'Default',
            snippet: '<Button>Click me</Button>',
          },
        ],
      };

      const result = formatComponentManifest(manifest);

      expect(result).toContain('Story ID: button--default');
    });

    it('should format a single story', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        import: 'import { Button } from "@/components";',
        stories: [
          {
            name: 'Default',
            snippet: '<Button>Click me</Button>',
          },
        ],
      };

      const result = formatComponentManifest(manifest);

      expect(result).toMatchInlineSnapshot(`
				"# Button

				ID: button

				## Stories

				### Default

				\`\`\`
				import { Button } from "@/components";

				<Button>Click me</Button>
				\`\`\`"
			`);
    });

    it('should format multiple stories', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        import: 'import { Button } from "@/components";',
        stories: [
          {
            name: 'Default',
            snippet: '<Button>Click me</Button>',
          },
          {
            name: 'Primary',
            snippet: '<Button variant="primary">Primary</Button>',
          },
        ],
      };

      const result = formatComponentManifest(manifest);

      expect(result).toContain('### Default');
      expect(result).toContain('### Primary');
      expect(result).toMatchInlineSnapshot(`
				"# Button

				ID: button

				## Stories

				### Default

				\`\`\`
				import { Button } from "@/components";

				<Button>Click me</Button>
				\`\`\`

				### Primary

				\`\`\`
				import { Button } from "@/components";

				<Button variant="primary">Primary</Button>
				\`\`\`"
			`);
    });

    it('should handle stories with description', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        stories: [
          {
            name: 'Primary',
            description: 'The primary action button style',
            snippet: '<Button variant="primary">Click me</Button>',
          },
        ],
      };

      const result = formatComponentManifest(manifest);

      expect(result).toContain('The primary action button style');
      expect(result).toMatchInlineSnapshot(`
				"# Button

				ID: button

				## Stories

				### Primary

				The primary action button style

				\`\`\`
				<Button variant="primary">Click me</Button>
				\`\`\`"
			`);
    });

    it('should omit stories when no stories are provided', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
      };

      const result = formatComponentManifest(manifest);

      expect(result).not.toContain('## Stories');
    });

    it('should omit stories when stories array is empty', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        stories: [],
      };

      const result = formatComponentManifest(manifest);

      expect(result).not.toContain('## Stories');
    });

    it('should show first 3 stories in full and remaining 2 under Other Stories', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        import: 'import { Button } from "@/components";',
        stories: [
          {
            name: 'Default',
            snippet: '<Button>Default</Button>',
          },
          {
            name: 'Primary',
            snippet: '<Button variant="primary">Primary</Button>',
          },
          {
            name: 'Secondary',
            snippet: '<Button variant="secondary">Secondary</Button>',
          },
          {
            name: 'Disabled',
            id: 'button--disabled',
            summary: 'Button in disabled state',
            snippet: '<Button disabled>Disabled</Button>',
          },
          {
            name: 'WithIcon',
            id: 'button--with-icon',
            description: 'Button with an icon',
            snippet: '<Button icon="check">With Icon</Button>',
          },
        ],
        // Props are required to trigger the "Other Stories" section
        reactDocgen: {
          props: {
            variant: {
              type: { name: 'string' },
            },
          },
        },
      };

      const result = formatComponentManifest(manifest);

      expect(result).toMatchInlineSnapshot(`
				"# Button

				ID: button

				## Stories

				### Default

				\`\`\`
				import { Button } from "@/components";

				<Button>Default</Button>
				\`\`\`

				### Primary

				\`\`\`
				import { Button } from "@/components";

				<Button variant="primary">Primary</Button>
				\`\`\`

				### Secondary

				\`\`\`
				import { Button } from "@/components";

				<Button variant="secondary">Secondary</Button>
				\`\`\`

				### Other Stories

				- Disabled (button--disabled): Button in disabled state
				- WithIcon (button--with-icon): Button with an icon

				## Props

				\`\`\`
				export type Props = {
				  variant: string;
				}
				\`\`\`"
			`);
    });

    it('should show all stories fully when component has no props', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        import: 'import { Button } from "@/components";',
        stories: [
          {
            name: 'Default',
            snippet: '<Button>Default</Button>',
          },
          {
            name: 'Primary',
            snippet: '<Button variant="primary">Primary</Button>',
          },
          {
            name: 'Secondary',
            snippet: '<Button variant="secondary">Secondary</Button>',
          },
          {
            name: 'Disabled',
            snippet: '<Button disabled>Disabled</Button>',
          },
          {
            name: 'WithIcon',
            snippet: '<Button icon="check">With Icon</Button>',
          },
        ],
        // No reactDocgen means no props - all stories should be shown fully
      };

      const result = formatComponentManifest(manifest);

      expect(result).toMatchInlineSnapshot(`
				"# Button

				ID: button

				## Stories

				### Default

				\`\`\`
				import { Button } from "@/components";

				<Button>Default</Button>
				\`\`\`

				### Primary

				\`\`\`
				import { Button } from "@/components";

				<Button variant="primary">Primary</Button>
				\`\`\`

				### Secondary

				\`\`\`
				import { Button } from "@/components";

				<Button variant="secondary">Secondary</Button>
				\`\`\`

				### Disabled

				\`\`\`
				import { Button } from "@/components";

				<Button disabled>Disabled</Button>
				\`\`\`

				### WithIcon

				\`\`\`
				import { Button } from "@/components";

				<Button icon="check">With Icon</Button>
				\`\`\`"
			`);
    });

    it('should list stories that carry no snippet instead of dropping them', () => {
      const manifest: ComponentManifest = {
        id: 'abstractions-billboard',
        name: 'abstractions-billboard',
        stories: [
          { id: 'abstractions-billboard--default', name: 'Default' },
          { id: 'abstractions-billboard--text', name: 'Text' },
        ],
      };

      const result = formatComponentManifest(manifest);

      expect(result).toMatchInlineSnapshot(`
				"# abstractions-billboard

				ID: abstractions-billboard

				## Stories

				- Default (abstractions-billboard--default)
				- Text (abstractions-billboard--text)"
			`);
    });

    it('should list snippet-less stories under the ones it shows in full', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        import: 'import { Button } from "@/components";',
        stories: [
          { id: 'button--default', name: 'Default', snippet: '<Button>Default</Button>' },
          { id: 'button--primary', name: 'Primary' },
          { id: 'button--secondary', name: 'Secondary', summary: 'The quiet one' },
        ],
      };

      const result = formatComponentManifest(manifest);

      expect(result).toMatchInlineSnapshot(`
				"# Button

				ID: button

				## Stories

				### Default

				Story ID: button--default

				\`\`\`
				import { Button } from "@/components";

				<Button>Default</Button>
				\`\`\`

				### Other Stories

				- Primary (button--primary)
				- Secondary (button--secondary): The quiet one"
			`);
    });
  });

  describe('attached docs section', () => {
    it('should include attached docs', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        stories: [
          {
            name: 'Primary',
            snippet: '<Button>Primary</Button>',
          },
        ],
        docs: {
          'button--additional-information': {
            id: 'button--additional-information',
            name: 'Additional Information',
            title: 'Button',
            path: 'src/components/Button.mdx',
            content: 'Detailed docs content',
          },
        },
        reactDocgen: {
          props: {
            size: {
              type: { name: 'string' },
            },
          },
        },
      };

      const result = formatComponentManifest(manifest);

      expect(result).toMatchInlineSnapshot(`
				"# Button

				ID: button

				## Stories

				### Primary

				\`\`\`
				<Button>Primary</Button>
				\`\`\`

				## Props

				\`\`\`
				export type Props = {
				  size: string;
				}
				\`\`\`

				## Docs

				### Additional Information

				Detailed docs content"
			`);

      expect(result.indexOf('## Docs')).toBeGreaterThan(result.indexOf('## Stories'));
      expect(result.indexOf('## Docs')).toBeGreaterThan(result.indexOf('## Props'));
      expect(result).not.toContain('ID: button--additional-information');
    });

    it('should not include docs section when all attached docs have empty trimmed content', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        docs: {
          'button--blank': {
            id: 'button--blank',
            name: 'Blank Doc',
            title: 'Button',
            path: 'src/components/ButtonBlank.mdx',
            content: '   \n\t  ',
          },
        },
      };

      const result = formatComponentManifest(manifest);

      expect(result).not.toContain('## Docs');
      expect(result).not.toContain('### Blank Doc');
    });
  });

  describe('props section - table format', () => {
    it('should format props with rich metadata as table', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        reactDocgen: {
          props: {
            variant: {
              description: 'The visual style variant',
              type: { name: 'union', value: ['primary', 'secondary'] },
              required: false,
              defaultValue: { value: 'primary', computed: false },
            },
            disabled: {
              description: 'Whether the button is disabled',
              type: { name: 'bool' },
              required: false,
              defaultValue: { value: 'false', computed: false },
            },
          },
        },
      };

      const result = formatComponentManifest(manifest);

      expect(result).toMatchInlineSnapshot(`
				"# Button

				ID: button

				## Props

				\`\`\`
				export type Props = {
				  /**
				    The visual style variant
				  */
				  variant?: union = primary;
				  /**
				    Whether the button is disabled
				  */
				  disabled?: bool = false;
				}
				\`\`\`"
			`);
    });
  });

  describe('props section', () => {
    it('should format props from reactDocgenTypescript', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        reactDocgenTypescript: {
          displayName: 'Button',
          filePath: 'src/components/Button.tsx',
          description: '',
          exportName: 'Button',
          methods: [],
          props: {
            variant: {
              name: 'variant',
              description: 'The visual style variant',
              type: { name: 'enum', raw: '"primary" | "secondary"' },
              defaultValue: { value: 'primary' },
              required: false,
            },
            disabled: {
              name: 'disabled',
              description: 'Whether the button is disabled',
              type: { name: 'boolean' },
              defaultValue: { value: 'false' },
              required: false,
            },
            onClick: {
              name: 'onClick',
              description: 'Click handler',
              type: { name: '(event: MouseEvent) => void' },
              defaultValue: null,
              required: true,
            },
          },
        },
      };

      const result = formatComponentManifest(manifest);

      expect(result).toMatchInlineSnapshot(`
				"# Button

				ID: button

				## Props

				\`\`\`
				export type Props = {
				  /**
				    The visual style variant
				  */
				  variant?: "primary" | "secondary" = primary;
				  /**
				    Whether the button is disabled
				  */
				  disabled?: boolean = false;
				  /**
				    Click handler
				  */
				  onClick: (event: MouseEvent) => void;
				}
				\`\`\`"
			`);
    });

    it('should format props from reactComponentMeta', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        reactComponentMeta: {
          displayName: 'Button',
          filePath: 'src/components/Button.tsx',
          description: '',
          exportName: 'Button',
          props: {
            variant: {
              name: 'variant',
              description: 'The visual style variant',
              type: { name: 'enum', raw: '"primary" | "secondary"' },
              defaultValue: { value: '"primary"' },
              required: false,
            },
            onClick: {
              name: 'onClick',
              description: 'Click handler',
              type: { name: '(event: MouseEvent) => void' },
              defaultValue: null,
              required: true,
            },
          },
        },
      };

      const result = formatComponentManifest(manifest);

      expect(result).toMatchInlineSnapshot(`
				"# Button

				ID: button

				## Props

				\`\`\`
				export type Props = {
				  /**
				    The visual style variant
				  */
				  variant?: "primary" | "secondary" = "primary";
				  /**
				    Click handler
				  */
				  onClick: (event: MouseEvent) => void;
				}
				\`\`\`"
			`);
    });

    it('should prefer reactDocgen over reactDocgenTypescript when both are present', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        reactDocgen: {
          props: {
            label: {
              type: { name: 'string' },
              description: 'From react-docgen',
            },
          },
        },
        reactDocgenTypescript: {
          displayName: 'Button',
          filePath: 'src/components/Button.tsx',
          description: '',
          exportName: 'Button',
          methods: [],
          props: {
            label: {
              name: 'label',
              description: 'From react-docgen-typescript',
              type: { name: 'string' },
              defaultValue: null,
              required: true,
            },
          },
        },
      };

      const result = formatComponentManifest(manifest);

      expect(result).toContain('From react-docgen');
      expect(result).not.toContain('From react-docgen-typescript');
    });

    it('should prefer reactDocgenTypescript over reactComponentMeta when both are present', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        reactDocgenTypescript: {
          displayName: 'Button',
          filePath: 'src/components/Button.tsx',
          description: '',
          exportName: 'Button',
          methods: [],
          props: {
            label: {
              name: 'label',
              description: 'From react-docgen-typescript',
              type: { name: 'string' },
              defaultValue: null,
              required: true,
            },
          },
        },
        reactComponentMeta: {
          displayName: 'Button',
          filePath: 'src/components/Button.tsx',
          description: '',
          exportName: 'Button',
          props: {
            label: {
              name: 'label',
              description: 'From react-component-meta',
              type: { name: 'string' },
              defaultValue: null,
              required: true,
            },
          },
        },
      };

      const result = formatComponentManifest(manifest);

      expect(result).toContain('From react-docgen-typescript');
      expect(result).not.toContain('From react-component-meta');
    });

    it('should limit stories when reactDocgenTypescript has props', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        import: 'import { Button } from "@/components";',
        stories: [
          { name: 'Default', snippet: '<Button>Default</Button>' },
          { name: 'Primary', snippet: '<Button variant="primary">Primary</Button>' },
          { name: 'Secondary', snippet: '<Button variant="secondary">Secondary</Button>' },
          {
            name: 'Disabled',
            summary: 'Button in disabled state',
            snippet: '<Button disabled>Disabled</Button>',
          },
          {
            name: 'WithIcon',
            description: 'Button with an icon',
            snippet: '<Button icon="check">With Icon</Button>',
          },
        ],
        reactDocgenTypescript: {
          displayName: 'Button',
          filePath: 'src/components/Button.tsx',
          description: '',
          exportName: 'Button',
          methods: [],
          props: {
            variant: {
              name: 'variant',
              description: '',
              type: { name: 'string' },
              defaultValue: null,
              required: false,
            },
          },
        },
      };

      const result = formatComponentManifest(manifest);

      // Should show first 3 stories in full, then remaining under "Other Stories"
      expect(result).toContain('### Default');
      expect(result).toContain('### Primary');
      expect(result).toContain('### Secondary');
      expect(result).toContain('### Other Stories');
      expect(result).toContain('- Disabled: Button in disabled state');
      expect(result).toContain('- WithIcon: Button with an icon');
    });

    it('should limit stories when reactComponentMeta has props', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        import: 'import { Button } from "@/components";',
        stories: [
          { name: 'Default', snippet: '<Button>Default</Button>' },
          { name: 'Primary', snippet: '<Button variant="primary">Primary</Button>' },
          { name: 'Secondary', snippet: '<Button variant="secondary">Secondary</Button>' },
          {
            name: 'Disabled',
            summary: 'Button in disabled state',
            snippet: '<Button disabled>Disabled</Button>',
          },
          {
            name: 'WithIcon',
            description: 'Button with an icon',
            snippet: '<Button icon="check">With Icon</Button>',
          },
        ],
        reactComponentMeta: {
          displayName: 'Button',
          filePath: 'src/components/Button.tsx',
          description: '',
          exportName: 'Button',
          props: {
            variant: {
              name: 'variant',
              description: '',
              type: { name: 'string' },
              defaultValue: null,
              required: false,
            },
          },
        },
      };

      const result = formatComponentManifest(manifest);

      expect(result).toContain('### Default');
      expect(result).toContain('### Primary');
      expect(result).toContain('### Secondary');
      expect(result).toContain('### Other Stories');
      expect(result).toContain('- Disabled: Button in disabled state');
      expect(result).toContain('- WithIcon: Button with an icon');
    });

    it('should format props with only name and type as bullet list', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        reactDocgen: {
          props: {
            variant: {
              type: { name: 'union', value: ['primary', 'secondary'] },
            },
            size: {
              type: { name: 'union', value: ['small', 'medium', 'large'] },
            },
          },
        },
      };

      const result = formatComponentManifest(manifest);

      expect(result).toMatchInlineSnapshot(`
				"# Button

				ID: button

				## Props

				\`\`\`
				export type Props = {
				  variant: union;
				  size: union;
				}
				\`\`\`"
			`);
    });

    it('should format props with name, type, and description as bullet list', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        reactDocgen: {
          props: {
            variant: {
              type: { name: 'union', value: ['primary', 'secondary'] },
              description: 'The visual style variant',
            },
            size: {
              type: { name: 'union', value: ['small', 'medium', 'large'] },
              description: 'The size of the button',
            },
          },
        },
      };

      const result = formatComponentManifest(manifest);

      expect(result).toMatchInlineSnapshot(`
				"# Button

				ID: button

				## Props

				\`\`\`
				export type Props = {
				  /**
				    The visual style variant
				  */
				  variant: union;
				  /**
				    The size of the button
				  */
				  size: union;
				}
				\`\`\`"
			`);
    });

    it('should omit props section when reactDocgen is not present', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        description: 'A button component',
      };

      const result = formatComponentManifest(manifest);

      expect(result).not.toContain('## Props');
    });

    it('should omit props section when reactDocgen has no props', () => {
      const manifest: ComponentManifest = {
        id: 'button',
        name: 'Button',
        path: 'src/components/Button.tsx',
        reactDocgen: {
          props: {},
        },
      };

      const result = formatComponentManifest(manifest);

      expect(result).not.toContain('## Props');
    });
  });

  it('should use table when props have rich metadata', () => {
    const manifest: ComponentManifest = {
      id: 'button',
      name: 'Button',
      path: 'src/components/Button.tsx',
      reactDocgen: {
        props: {
          variant: {
            type: { name: 'string' },
            description: 'The button variant',
            required: false,
            defaultValue: { value: 'primary', computed: false },
          },
          disabled: {
            type: { name: 'bool' },
            required: true,
          },
          size: {
            type: { name: 'union', value: ['small', 'medium', 'large'] },
            defaultValue: { value: 'medium', computed: false },
          },
        },
      },
    };

    const result = formatComponentManifest(manifest);

    expect(result).toMatchInlineSnapshot(`
			"# Button

			ID: button

			## Props

			\`\`\`
			export type Props = {
			  /**
			    The button variant
			  */
			  variant?: string = primary;
			  disabled: bool;
			  size: union = medium;
			}
			\`\`\`"
		`);
  });

  describe('apiDescription section', () => {
    const angularApiDescription = [
      '## Inputs',
      '',
      '```',
      'export type ColorPickerComponentInputs = {',
      '  /**',
      '   * The currently selected colour',
      '   *',
      "   * @default '#345F92'",
      '   */',
      '  color?: string; // two-way: [(color)]',
      '}',
      '```',
      '',
      '## Outputs',
      '',
      '```',
      'export type ColorPickerComponentOutputs = {',
      '  colorChange: (e: string) => void;',
      '}',
      '```',
    ].join('\n');

    it('renders the framework-authored markdown in place of the props section', () => {
      const manifest: ComponentManifest = {
        id: 'color-picker',
        name: 'ColorPickerComponent',
        path: 'src/color-picker.stories.ts',
        apiDescription: angularApiDescription,
      };

      expect(formatComponentManifest(manifest)).toMatchInlineSnapshot(`
        "# ColorPickerComponent

        ID: color-picker

        ## Inputs

        \`\`\`
        export type ColorPickerComponentInputs = {
          /**
           * The currently selected colour
           *
           * @default '#345F92'
           */
          color?: string; // two-way: [(color)]
        }
        \`\`\`

        ## Outputs

        \`\`\`
        export type ColorPickerComponentOutputs = {
          colorChange: (e: string) => void;
        }
        \`\`\`"
      `);
    });

    it('wins over the react docgen fields, which then do not also render', () => {
      const manifest: ComponentManifest = {
        id: 'color-picker',
        name: 'ColorPickerComponent',
        path: 'src/color-picker.stories.ts',
        apiDescription: angularApiDescription,
        reactDocgen: {
          props: {
            label: { type: { name: 'string' }, description: 'From react-docgen' },
          },
        },
      };

      const result = formatComponentManifest(manifest);

      expect(result).toContain('## Inputs');
      expect(result).not.toContain('## Props');
      expect(result).not.toContain('From react-docgen');
    });

    it('limits the stories shown in full, as a react props table does', () => {
      const manifest: ComponentManifest = {
        id: 'color-picker',
        name: 'ColorPickerComponent',
        path: 'src/color-picker.stories.ts',
        apiDescription: angularApiDescription,
        stories: [
          { name: 'Default', snippet: '<app-color-picker />' },
          { name: 'Red', snippet: '<app-color-picker color="#f00" />' },
          { name: 'Green', snippet: '<app-color-picker color="#0f0" />' },
          { name: 'Blue', summary: 'A blue picker', snippet: '<app-color-picker color="#00f" />' },
        ],
      };

      const result = formatComponentManifest(manifest);

      expect(result).toContain('### Other Stories');
      expect(result).toContain('- Blue: A blue picker');
    });

    it('leads with the api sections, ahead of the stories that apply them', () => {
      const manifest: ComponentManifest = {
        id: 'color-picker',
        name: 'ColorPickerComponent',
        path: 'src/color-picker.stories.ts',
        apiDescription: angularApiDescription,
        stories: [{ name: 'Default', snippet: '<app-color-picker />' }],
      };

      const result = formatComponentManifest(manifest);

      expect(result.indexOf('## Inputs')).toBeLessThan(result.indexOf('## Stories'));
      expect(result.indexOf('## Outputs')).toBeLessThan(result.indexOf('## Stories'));
    });

    it('nests a subcomponent`s own sections under its heading', () => {
      const manifest: ComponentManifest = {
        id: 'color-picker',
        name: 'ColorPickerComponent',
        path: 'src/color-picker.stories.ts',
        subcomponents: {
          swatch: { name: 'SwatchComponent', apiDescription: angularApiDescription },
        },
      };

      expect(formatComponentManifest(manifest)).toMatchInlineSnapshot(`
        "# ColorPickerComponent

        ID: color-picker

        ## Subcomponents

        ### SwatchComponent

        #### Inputs

        \`\`\`
        export type ColorPickerComponentInputs = {
          /**
           * The currently selected colour
           *
           * @default '#345F92'
           */
          color?: string; // two-way: [(color)]
        }
        \`\`\`

        #### Outputs

        \`\`\`
        export type ColorPickerComponentOutputs = {
          colorChange: (e: string) => void;
        }
        \`\`\`"
      `);
    });
  });
});

describe('MarkdownFormatter - formatStoryDocumentation', () => {
  it('renders a story that has a snippet', () => {
    const manifest: ComponentManifest = {
      id: 'button',
      name: 'Button',
      import: 'import { Button } from "@/components";',
      stories: [
        {
          id: 'button--primary',
          name: 'Primary',
          description: 'The primary action',
          snippet: '<Button variant="primary" />',
        },
      ],
    };

    expect(formatStoryDocumentation(manifest, 'Primary')).toMatchInlineSnapshot(`
			"# Button - Primary

			The primary action

			\`\`\`
			import { Button } from "@/components";

			<Button variant="primary" />
			\`\`\`"
		`);
  });

  it('names a story that has no snippet instead of returning nothing', () => {
    const manifest: ComponentManifest = {
      id: 'abstractions-billboard',
      name: 'abstractions-billboard',
      stories: [{ id: 'abstractions-billboard--default', name: 'Default' }],
    };

    expect(formatStoryDocumentation(manifest, 'Default')).toMatchInlineSnapshot(`
			"# abstractions-billboard - Default

			Story ID: abstractions-billboard--default

			No code snippet was extracted for this story."
		`);
  });

  it('returns nothing for a story the component does not have', () => {
    const manifest: ComponentManifest = {
      id: 'button',
      name: 'Button',
      stories: [{ id: 'button--primary', name: 'Primary' }],
    };

    expect(formatStoryDocumentation(manifest, 'Missing')).toBe('');
  });
});

describe('MarkdownFormatter - formatManifestsToLists', () => {
  it('formats the full manifest fixture', () => {
    const result = formatManifestsToLists({
      componentManifest: fullManifestFixture as ComponentManifestMap,
    });
    expect(result).toMatchSnapshot();
  });

  describe('component list structure', () => {
    it('should format a single component', () => {
      const manifests: AllManifests = {
        componentManifest: {
          v: 0,
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: 'src/components/Button.tsx',
            },
          },
        },
      };

      const result = formatManifestsToLists(manifests);

      expect(result).toMatchInlineSnapshot(`
				"# Components

				- Button (button)"
			`);
    });

    it('should format multiple components', () => {
      const manifests: AllManifests = {
        componentManifest: {
          v: 0,
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: 'src/components/Button.tsx',
            },
            card: {
              id: 'card',
              name: 'Card',
              path: 'src/components/Card.tsx',
            },
            input: {
              id: 'input',
              name: 'Input',
              path: 'src/components/Input.tsx',
            },
          },
        },
      };

      const result = formatManifestsToLists(manifests);

      expect(result).toMatchInlineSnapshot(`
				"# Components

				- Button (button)
				- Card (card)
				- Input (input)"
			`);
    });

    it('should include story sub-bullets when withStoryIds is true', () => {
      const manifests: AllManifests = {
        componentManifest: {
          v: 0,
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: 'src/components/Button.tsx',
              stories: [
                { id: 'button--primary', name: 'Primary' },
                { id: 'button--secondary', name: 'Secondary' },
              ],
            },
          },
        },
      };

      const result = formatManifestsToLists(manifests, { withStoryIds: true });

      expect(result).toMatchInlineSnapshot(`
					"# Components

					- Button (button)
					  - Primary (button--primary)
					  - Secondary (button--secondary)"
				`);
    });
  });

  describe('summary section', () => {
    it('should include summary when provided', () => {
      const manifests: AllManifests = {
        componentManifest: {
          v: 0,
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: 'src/components/Button.tsx',
              summary: 'A versatile button component',
            },
          },
        },
      };

      const result = formatManifestsToLists(manifests);

      expect(result).toMatchInlineSnapshot(`
				"# Components

				- Button (button): A versatile button component"
			`);
    });

    it('should prefer summary over description', () => {
      const manifests: AllManifests = {
        componentManifest: {
          v: 0,
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: 'src/components/Button.tsx',
              summary: 'Button summary',
              description: 'Button description',
            },
          },
        },
      };

      const result = formatManifestsToLists(manifests);

      expect(result).toContain('Button summary');
      expect(result).not.toContain('Button description');
    });

    it('should use description when summary is not provided', () => {
      const manifests: AllManifests = {
        componentManifest: {
          v: 0,
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: 'src/components/Button.tsx',
              description: 'A simple button component',
            },
          },
        },
      };

      const result = formatManifestsToLists(manifests);

      expect(result).toMatchInlineSnapshot(`
				"# Components

				- Button (button): A simple button component"
			`);
    });

    it('should truncate long descriptions to 90 characters', () => {
      const manifests: AllManifests = {
        componentManifest: {
          v: 0,
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: 'src/components/Button.tsx',
              description:
                'This is a very long description that exceeds ninety characters and should be truncated with ellipsis',
            },
          },
        },
      };

      const result = formatManifestsToLists(manifests);

      expect(result).toContain('...');
      expect(result).toMatchInlineSnapshot(`
				"# Components

				- Button (button): This is a very long description that exceeds ninety characters and should be truncated wit..."
			`);
    });

    it('should not truncate descriptions under 90 characters', () => {
      const manifests: AllManifests = {
        componentManifest: {
          v: 0,
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: 'src/components/Button.tsx',
              description: 'A button component for user interactions',
            },
          },
        },
      };

      const result = formatManifestsToLists(manifests);

      expect(result).not.toContain('...');
      expect(result).toContain('A button component for user interactions');
    });

    it('should omit summary when neither summary nor description provided', () => {
      const manifests: AllManifests = {
        componentManifest: {
          v: 0,
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: 'src/components/Button.tsx',
            },
          },
        },
      };

      const result = formatManifestsToLists(manifests);

      expect(result).toMatchInlineSnapshot(`
				"# Components

				- Button (button)"
			`);
    });
  });

  describe('docs manifest section', () => {
    it('should include docs section when docsManifest is provided', () => {
      const manifests: AllManifests = {
        componentManifest: {
          v: 0,
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: 'src/components/Button.tsx',
            },
          },
        },
        docsManifest: {
          v: 0,
          docs: {
            'getting-started': {
              id: 'getting-started',
              name: 'Getting Started',
              title: 'Getting Started Guide',
              path: 'docs/getting-started.mdx',
              content: 'Welcome to our component library.',
            },
          },
        },
      };

      const result = formatManifestsToLists(manifests);

      expect(result).toMatchInlineSnapshot(`
				"# Components

				- Button (button)

				# Docs

				- Getting Started Guide (getting-started): Welcome to our component library."
			`);
    });

    it('should format multiple docs entries', () => {
      const manifests: AllManifests = {
        componentManifest: {
          v: 0,
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: 'src/components/Button.tsx',
            },
          },
        },
        docsManifest: {
          v: 0,
          docs: {
            'getting-started': {
              id: 'getting-started',
              name: 'Getting Started',
              title: 'Getting Started Guide',
              path: 'docs/getting-started.mdx',
              content: 'Welcome to our component library.',
            },
            theming: {
              id: 'theming',
              name: 'Theming',
              title: 'Theming Guide',
              path: 'docs/theming.mdx',
              content: 'Learn how to customize the theme.',
            },
          },
        },
      };

      const result = formatManifestsToLists(manifests);

      expect(result).toContain('# Components');
      expect(result).toContain('# Docs');
      expect(result).toContain('- Getting Started Guide (getting-started)');
      expect(result).toContain('- Theming Guide (theming)');
    });

    it('should omit docs section when docsManifest is not provided', () => {
      const manifests: AllManifests = {
        componentManifest: {
          v: 0,
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: 'src/components/Button.tsx',
            },
          },
        },
      };

      const result = formatManifestsToLists(manifests);

      expect(result).not.toContain('# Docs');
    });

    it('should use doc.summary when provided instead of extracting from content', () => {
      const manifests: AllManifests = {
        componentManifest: {
          v: 0,
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: 'src/components/Button.tsx',
            },
          },
        },
        docsManifest: {
          v: 0,
          docs: {
            'custom-summary': {
              id: 'custom-summary',
              name: 'Custom Summary',
              title: 'Custom Summary Doc',
              path: 'docs/custom-summary.mdx',
              content:
                'This is a very long content that would normally be extracted and truncated.',
              summary: 'This is a custom summary',
            },
          },
        },
      };

      const result = formatManifestsToLists(manifests);

      expect(result).toMatchInlineSnapshot(`
				"# Components

				- Button (button)

				# Docs

				- Custom Summary Doc (custom-summary): This is a custom summary"
			`);
    });

    it('should extract summary from content when doc.summary is not provided', () => {
      const manifests: AllManifests = {
        componentManifest: {
          v: 0,
          components: {
            button: {
              id: 'button',
              name: 'Button',
              path: 'src/components/Button.tsx',
            },
          },
        },
        docsManifest: {
          v: 0,
          docs: {
            'auto-summary': {
              id: 'auto-summary',
              name: 'Auto Summary',
              title: 'Auto Summary Doc',
              path: 'docs/auto-summary.mdx',
              content: 'This content will be extracted automatically.',
            },
          },
        },
      };

      const result = formatManifestsToLists(manifests);

      expect(result).toMatchInlineSnapshot(`
				"# Components

				- Button (button)

				# Docs

				- Auto Summary Doc (auto-summary): This content will be extracted automatically."
			`);
    });
  });
});

describe('MarkdownFormatter - formatMultiSourceManifestsToLists', () => {
  it('formats requires-own-mcp source notices without an error prefix', () => {
    const result = formatMultiSourceManifestsToLists([
      {
        source: { id: 'tetra', title: 'Tetra Design System', url: 'https://tetra.chromatic.com' },
        notice: {
          kind: 'requires-own-mcp',
          endpoint: 'https://tetra.chromatic.com/mcp',
        },
      },
    ]);

    expect(result).toMatchInlineSnapshot(`
			"# Tetra Design System
			id: tetra

			This composed Storybook is private and cannot be read through the local Storybook MCP proxy.

			Use this source's own MCP endpoint instead:
			https://tetra.chromatic.com/mcp"
		`);
    expect(result).not.toContain('error:');
  });
});

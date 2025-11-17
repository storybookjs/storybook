import { describe, it, expect } from 'vitest';
import {
	formatComponentManifest,
	formatComponentManifestMapToList,
} from './format-manifest';
import type { ComponentManifest, ComponentManifestMap } from '../types';
import fullManifestFixture from '../../fixtures/full-manifest.fixture.json' with { type: 'json' };
import withErrorsFixture from '../../fixtures/with-errors.fixture.json' with { type: 'json' };

describe('formatComponentManifest', () => {
	it('formats all full fixtures', () => {
		expect(
			formatComponentManifest(fullManifestFixture.components.button),
		).toMatchSnapshot();
		expect(
			formatComponentManifest(fullManifestFixture.components.card),
		).toMatchSnapshot();
		expect(
			formatComponentManifest(fullManifestFixture.components.input),
		).toMatchSnapshot();
	});

	describe('component name', () => {
		it('should include component name in component_name tag', () => {
			const manifest: ComponentManifest = {
				id: 'test-component',
				path: 'src/components/TestComponent.tsx',
				name: 'TestComponent',
			};

			const result = formatComponentManifest(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<component>
				<id>test-component</id>
				<name>TestComponent</name>
				</component>"
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
				"<component>
				<id>button</id>
				<name>Button</name>
				<description>
				A simple button component
				</description>
				</component>"
			`);
		});

		it('should handle multi-line descriptions', () => {
			const manifest: ComponentManifest = {
				id: 'button',
				path: 'src/components/Button.tsx',
				name: 'Button',
				description:
					'A versatile button component.\n\nSupports multiple variants and sizes.',
			};

			const result = formatComponentManifest(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<component>
				<id>button</id>
				<name>Button</name>
				<description>
				A versatile button component.

				Supports multiple variants and sizes.
				</description>
				</component>"
			`);
		});

		it('should omit description section when not provided', () => {
			const manifest: ComponentManifest = {
				id: 'button',
				name: 'Button',
				path: 'src/components/Button.tsx',
			};

			const result = formatComponentManifest(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<component>
				<id>button</id>
				<name>Button</name>
				</component>"
			`);
		});
	});

	describe('stories section', () => {
		it('should format a single story', () => {
			const manifest: ComponentManifest = {
				id: 'button',
				name: 'Button',
				path: 'src/components/Button.tsx',
				import: 'import { Button } from "@/components";',
				stories: [
					{
						name: 'Primary',
						description: 'A primary button variant',
						snippet: '<Button variant="primary">Click me</Button>',
					},
				],
			};

			const result = formatComponentManifest(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<component>
				<id>button</id>
				<name>Button</name>
				<story>
				<story_name>Primary</story_name>
				<story_description>
				A primary button variant
				</story_description>
				<story_code>
				import { Button } from "@/components";

				<Button variant="primary">Click me</Button>
				</story_code>
				</story>
				</component>"
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
						name: 'Primary',
						snippet: '<Button variant="primary">Primary</Button>',
					},
					{
						name: 'Secondary',
						snippet: '<Button variant="secondary">Secondary</Button>',
					},
				],
			};

			const result = formatComponentManifest(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<component>
				<id>button</id>
				<name>Button</name>
				<story>
				<story_name>Primary</story_name>
				<story_code>
				import { Button } from "@/components";

				<Button variant="primary">Primary</Button>
				</story_code>
				</story>
				<story>
				<story_name>Secondary</story_name>
				<story_code>
				import { Button } from "@/components";

				<Button variant="secondary">Secondary</Button>
				</story_code>
				</story>
				</component>"
			`);
		});

		it('should format PascalCase story names correctly', () => {
			const manifest: ComponentManifest = {
				id: 'button',
				name: 'Button',
				path: 'src/components/Button.tsx',
				stories: [
					{
						name: 'WithIcon',
						snippet: '<Button icon={<Icon />}>Click me</Button>',
					},
					{
						name: 'DisabledState',
						snippet: '<Button disabled>Disabled</Button>',
					},
				],
			};

			const result = formatComponentManifest(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<component>
				<id>button</id>
				<name>Button</name>
				<story>
				<story_name>With Icon</story_name>
				<story_code>
				<Button icon={<Icon />}>Click me</Button>
				</story_code>
				</story>
				<story>
				<story_name>Disabled State</story_name>
				<story_code>
				<Button disabled>Disabled</Button>
				</story_code>
				</story>
				</component>"
			`);
		});

		it('should handle stories without description', () => {
			const manifest: ComponentManifest = {
				id: 'button',
				name: 'Button',
				path: 'src/components/Button.tsx',
				stories: [
					{
						name: 'Simple',
						snippet: '<Button>Simple</Button>',
					},
				],
			};

			const result = formatComponentManifest(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<component>
				<id>button</id>
				<name>Button</name>
				<story>
				<story_name>Simple</story_name>
				<story_code>
				<Button>Simple</Button>
				</story_code>
				</story>
				</component>"
			`);
		});

		it('should handle stories without import', () => {
			const manifest: ComponentManifest = {
				id: 'button',
				name: 'Button',
				path: 'src/components/Button.tsx',
				stories: [
					{
						name: 'NoImport',
						snippet: '<Button>No Import</Button>',
					},
				],
			};

			const result = formatComponentManifest(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<component>
				<id>button</id>
				<name>Button</name>
				<story>
				<story_name>No Import</story_name>
				<story_code>
				<Button>No Import</Button>
				</story_code>
				</story>
				</component>"
			`);
		});

		it('should omit stories when no stories are provided', () => {
			const manifest: ComponentManifest = {
				id: 'button',
				name: 'Button',
				path: 'src/components/Button.tsx',
				description: 'A button component',
			};

			const result = formatComponentManifest(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<component>
				<id>button</id>
				<name>Button</name>
				<description>
				A button component
				</description>
				</component>"
			`);
		});

		it('should omit stories when stories array is empty', () => {
			const manifest: ComponentManifest = {
				id: 'button',
				name: 'Button',
				path: 'src/components/Button.tsx',
				stories: [],
			};

			const result = formatComponentManifest(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<component>
				<id>button</id>
				<name>Button</name>
				</component>"
			`);
		});
	});

	describe('complete component', () => {
		it('should format a complete component with description and multiple stories', () => {
			const manifest: ComponentManifest = {
				id: 'button',
				name: 'Button',
				path: 'src/components/Button.tsx',
				description:
					'A versatile button component.\n\nSupports multiple variants, sizes, and states.',
				summary: 'A button for user interactions',
				import: 'import { Button } from "@storybook/design-system";',
				stories: [
					{
						name: 'Primary',
						description: 'The primary button variant.',
						snippet:
							'const Primary = () => <Button variant="primary">Click Me</Button>',
					},
					{
						name: 'WithSizes',
						description: 'Buttons in different sizes.',
						snippet:
							'const Sizes = () => (\n  <>\n    <Button size="small">Small</Button>\n    <Button size="large">Large</Button>\n  </>\n)',
					},
				],
			};

			const result = formatComponentManifest(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<component>
				<id>button</id>
				<name>Button</name>
				<description>
				A versatile button component.

				Supports multiple variants, sizes, and states.
				</description>
				<story>
				<story_name>Primary</story_name>
				<story_description>
				The primary button variant.
				</story_description>
				<story_code>
				import { Button } from "@storybook/design-system";

				const Primary = () => <Button variant="primary">Click Me</Button>
				</story_code>
				</story>
				<story>
				<story_name>With Sizes</story_name>
				<story_description>
				Buttons in different sizes.
				</story_description>
				<story_code>
				import { Button } from "@storybook/design-system";

				const Sizes = () => (
				  <>
				    <Button size="small">Small</Button>
				    <Button size="large">Large</Button>
				  </>
				)
				</story_code>
				</story>
				</component>"
			`);
		});
	});

	describe('props section', () => {
		it('should format props from reactDocgen', () => {
			const manifest: ComponentManifest = {
				id: 'button',
				name: 'Button',
				path: 'src/components/Button.tsx',
				reactDocgen: {
					props: {
						variant: {
							description: 'The visual style variant',
							required: false,
							defaultValue: { value: '"primary"', computed: false },
							tsType: {
								name: 'union',
								raw: '"primary" | "secondary"',
								elements: [
									{ name: 'literal', value: '"primary"' },
									{ name: 'literal', value: '"secondary"' },
								],
							},
						},
						disabled: {
							description: 'Whether the button is disabled',
							required: false,
							defaultValue: { value: 'false', computed: false },
							tsType: {
								name: 'boolean',
							},
						},
						onClick: {
							description: 'Click handler',
							required: true,
							tsType: {
								name: 'signature',
								type: 'function',
								signature: {
									arguments: [{ name: 'event', type: { name: 'MouseEvent' } }],
									return: { name: 'void' },
								},
							},
						},
					},
				},
			};

			const result = formatComponentManifest(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<component>
				<id>button</id>
				<name>Button</name>
				<props>
				<prop>
				<prop_name>variant</prop_name>
				<prop_description>
				The visual style variant
				</prop_description>
				<prop_type>"primary" | "secondary"</prop_type>
				<prop_required>false</prop_required>
				<prop_default>"primary"</prop_default>
				</prop>
				<prop>
				<prop_name>disabled</prop_name>
				<prop_description>
				Whether the button is disabled
				</prop_description>
				<prop_type>boolean</prop_type>
				<prop_required>false</prop_required>
				<prop_default>false</prop_default>
				</prop>
				<prop>
				<prop_name>onClick</prop_name>
				<prop_description>
				Click handler
				</prop_description>
				<prop_type>(event: MouseEvent) => void</prop_type>
				<prop_required>true</prop_required>
				</prop>
				</props>
				</component>"
			`);
		});

		it('should handle props with minimal information', () => {
			const manifest: ComponentManifest = {
				id: 'button',
				name: 'Button',
				path: 'src/components/Button.tsx',
				reactDocgen: {
					props: {
						children: {
							tsType: {
								name: 'string',
							},
						},
					},
				},
			};

			const result = formatComponentManifest(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<component>
				<id>button</id>
				<name>Button</name>
				<props>
				<prop>
				<prop_name>children</prop_name>
				<prop_type>string</prop_type>
				</prop>
				</props>
				</component>"
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

			expect(result).toMatchInlineSnapshot(`
				"<component>
				<id>button</id>
				<name>Button</name>
				<description>
				A button component
				</description>
				</component>"
			`);
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

			expect(result).toMatchInlineSnapshot(`
				"<component>
				<id>button</id>
				<name>Button</name>
				</component>"
			`);
		});
	});
});

describe('formatComponentManifestMapToList', () => {
	it('formats the full manifest fixture', () => {
		const result = formatComponentManifestMapToList(fullManifestFixture);
		expect(result).toMatchSnapshot();
	});

	describe('component list structure', () => {
		it('should format a single component', () => {
			const manifest: ComponentManifestMap = {
				v: 1,
				components: {
					button: {
						id: 'button',
						name: 'Button',
						path: 'src/components/Button.tsx',
					},
				},
			};

			const result = formatComponentManifestMapToList(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<components>
				<component>
				<id>button</id>
				<name>Button</name>
				</component>
				</components>"
			`);
		});

		it('should format multiple components', () => {
			const manifest: ComponentManifestMap = {
				v: 1,
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
			};

			const result = formatComponentManifestMapToList(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<components>
				<component>
				<id>button</id>
				<name>Button</name>
				</component>
				<component>
				<id>card</id>
				<name>Card</name>
				</component>
				<component>
				<id>input</id>
				<name>Input</name>
				</component>
				</components>"
			`);
		});
	});

	describe('summary section', () => {
		it('should include summary when provided', () => {
			const manifest: ComponentManifestMap = {
				v: 1,
				components: {
					button: {
						id: 'button',
						name: 'Button',
						path: 'src/components/Button.tsx',
						summary: 'A versatile button component',
					},
				},
			};

			const result = formatComponentManifestMapToList(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<components>
				<component>
				<id>button</id>
				<name>Button</name>
				<summary>
				A versatile button component
				</summary>
				</component>
				</components>"
			`);
		});

		it('should prefer summary over description', () => {
			const manifest: ComponentManifestMap = {
				v: 1,
				components: {
					button: {
						id: 'button',
						name: 'Button',
						path: 'src/components/Button.tsx',
						summary: 'Short summary',
						description: 'This is a longer description that should be ignored',
					},
				},
			};

			const result = formatComponentManifestMapToList(manifest);

			expect(result).toContain('Short summary');
			expect(result).not.toContain('longer description');
		});

		it('should use description when summary is not provided', () => {
			const manifest: ComponentManifestMap = {
				v: 1,
				components: {
					button: {
						id: 'button',
						name: 'Button',
						path: 'src/components/Button.tsx',
						description: 'A simple button component',
					},
				},
			};

			const result = formatComponentManifestMapToList(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<components>
				<component>
				<id>button</id>
				<name>Button</name>
				<summary>
				A simple button component
				</summary>
				</component>
				</components>"
			`);
		});

		it('should truncate long descriptions to 90 characters', () => {
			const manifest: ComponentManifestMap = {
				v: 1,
				components: {
					button: {
						id: 'button',
						name: 'Button',
						path: 'src/components/Button.tsx',
						description:
							'This is a very long description that exceeds ninety characters and should be truncated with ellipsis',
					},
				},
			};

			const result = formatComponentManifestMapToList(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<components>
				<component>
				<id>button</id>
				<name>Button</name>
				<summary>
				This is a very long description that exceeds ninety characters and should be truncated wit...
				</summary>
				</component>
				</components>"
			`);
		});

		it('should not truncate descriptions under 90 characters', () => {
			const manifest: ComponentManifestMap = {
				v: 1,
				components: {
					button: {
						id: 'button',
						name: 'Button',
						path: 'src/components/Button.tsx',
						description:
							'A description with exactly eighty characters is fine and should not be truncated',
					},
				},
			};

			const result = formatComponentManifestMapToList(manifest);

			expect(result).toContain(
				'A description with exactly eighty characters is fine and should not be truncated',
			);
			expect(result).not.toContain('...');
		});

		it('should omit summary section when neither summary nor description provided', () => {
			const manifest: ComponentManifestMap = {
				v: 1,
				components: {
					button: {
						id: 'button',
						name: 'Button',
						path: 'src/components/Button.tsx',
					},
				},
			};

			const result = formatComponentManifestMapToList(manifest);

			expect(result).not.toContain('<summary>');
			expect(result).toMatchInlineSnapshot(`
				"<components>
				<component>
				<id>button</id>
				<name>Button</name>
				</component>
				</components>"
			`);
		});
	});

	describe('complete manifest', () => {
		it('should format a complete manifest with varied components', () => {
			const manifest: ComponentManifestMap = {
				v: 1,
				components: {
					button: {
						id: 'button',
						name: 'Button',
						path: 'src/components/Button.tsx',
						summary: 'A versatile button component',
					},
					card: {
						id: 'card',
						name: 'Card',
						path: 'src/components/Card.tsx',
						description: 'A flexible container for grouping content',
					},
					input: {
						id: 'input',
						name: 'Input',
						path: 'src/components/Input.tsx',
						summary: 'Text input with validation',
						description:
							'A comprehensive input component with validation, error states, and accessibility features',
					},
					modal: {
						id: 'modal',
						name: 'Modal',
						path: 'src/components/Modal.tsx',
					},
				},
			};

			const result = formatComponentManifestMapToList(manifest);

			expect(result).toMatchInlineSnapshot(`
				"<components>
				<component>
				<id>button</id>
				<name>Button</name>
				<summary>
				A versatile button component
				</summary>
				</component>
				<component>
				<id>card</id>
				<name>Card</name>
				<summary>
				A flexible container for grouping content
				</summary>
				</component>
				<component>
				<id>input</id>
				<name>Input</name>
				<summary>
				Text input with validation
				</summary>
				</component>
				<component>
				<id>modal</id>
				<name>Modal</name>
				</component>
				</components>"
			`);
		});
	});

	describe('with-errors fixture', () => {
		it('should format success component with mixed stories (only successful ones)', () => {
			const component =
				withErrorsFixture.components['success-component-with-mixed-stories'];
			const result = formatComponentManifest(component);
			expect(result).toMatchInlineSnapshot(`
				"<component>
				<id>success-component-with-mixed-stories</id>
				<name>SuccessWithMixedStories</name>
				<description>
				A component that loaded successfully but has some stories that failed to generate.
				</description>
				<story>
				<story_name>Working</story_name>
				<story_description>
				This story generated successfully.
				</story_description>
				<story_code>
				import { SuccessWithMixedStories } from '@storybook/design-system';

				const Working = () => <SuccessWithMixedStories text="Hello" />
				</story_code>
				</story>
				<props>
				<prop>
				<prop_name>text</prop_name>
				<prop_description>
				The text to display
				</prop_description>
				<prop_type>string</prop_type>
				<prop_required>true</prop_required>
				</prop>
				<prop>
				<prop_name>variant</prop_name>
				<prop_description>
				The visual variant
				</prop_description>
				<prop_type>"primary" | "secondary"</prop_type>
				<prop_required>false</prop_required>
				<prop_default>"primary"</prop_default>
				</prop>
				</props>
				</component>"
			`);
		});

		it('should format error component with success stories', () => {
			const component =
				withErrorsFixture.components['error-component-with-success-stories'];
			const result = formatComponentManifest(component);
			expect(result).toMatchInlineSnapshot(`
				"<component>
				<id>error-component-with-success-stories</id>
				<name>ErrorWithSuccessStories</name>
				<story>
				<story_name>Basic</story_name>
				<story_description>
				Even though the component parsing failed, this story's code snippet was generated.
				</story_description>
				<story_code>
				const Basic = () => <ErrorWithSuccessStories>Content</ErrorWithSuccessStories>
				</story_code>
				</story>
				<story>
				<story_name>Advanced</story_name>
				<story_description>
				Another successfully generated story despite component-level errors.
				</story_description>
				<story_code>
				const Advanced = () => (
				  <ErrorWithSuccessStories disabled>
				    Advanced Content
				  </ErrorWithSuccessStories>
				)
				</story_code>
				</story>
				</component>"
			`);
		});

		it('should format partial success component (skips failed story)', () => {
			const component = withErrorsFixture.components['partial-success'];
			const result = formatComponentManifest(component);
			expect(result).toMatchInlineSnapshot(`
				"<component>
				<id>partial-success</id>
				<name>PartialSuccess</name>
				<description>
				A component where everything worked except one story.
				</description>
				<story>
				<story_name>Default</story_name>
				<story_description>
				Default usage of the component.
				</story_description>
				<story_code>
				import { PartialSuccess } from '@storybook/design-system';

				const Default = () => <PartialSuccess title="Hello" />
				</story_code>
				</story>
				<story>
				<story_name>With Subtitle</story_name>
				<story_description>
				Component with both title and subtitle.
				</story_description>
				<story_code>
				import { PartialSuccess } from '@storybook/design-system';

				const WithSubtitle = () => <PartialSuccess title="Hello" subtitle="World" />
				</story_code>
				</story>
				<props>
				<prop>
				<prop_name>title</prop_name>
				<prop_description>
				The title text
				</prop_description>
				<prop_type>string</prop_type>
				<prop_required>true</prop_required>
				</prop>
				<prop>
				<prop_name>subtitle</prop_name>
				<prop_description>
				Optional subtitle
				</prop_description>
				<prop_type>string</prop_type>
				<prop_required>false</prop_required>
				</prop>
				</props>
				</component>"
			`);
		});

		it('should format list of components with errors', () => {
			const result = formatComponentManifestMapToList(
				withErrorsFixture as ComponentManifestMap,
			);
			expect(result).toMatchInlineSnapshot(`
				"<components>
				<component>
				<id>success-component-with-mixed-stories</id>
				<name>SuccessWithMixedStories</name>
				<summary>
				Success component with both working and failing stories
				</summary>
				</component>
				<component>
				<id>error-component-with-success-stories</id>
				<name>ErrorWithSuccessStories</name>
				</component>
				<component>
				<id>error-component-with-error-stories</id>
				<name>ErrorWithErrorStories</name>
				</component>
				<component>
				<id>complete-error-component</id>
				<name>CompleteError</name>
				</component>
				<component>
				<id>partial-success</id>
				<name>PartialSuccess</name>
				<summary>
				Mostly working component with one failing story
				</summary>
				</component>
				</components>"
			`);
		});
	});
});

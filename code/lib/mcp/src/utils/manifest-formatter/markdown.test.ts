import { describe, it, expect } from 'vitest';
import { markdownFormatter } from './markdown.ts';
import type {
	AllManifests,
	ComponentManifest,
	ComponentManifestMap,
} from '../../types.ts';
import fullManifestFixture from '../../../fixtures/full-manifest.fixture.json' with { type: 'json' };

describe('MarkdownFormatter - formatComponentManifest', () => {
	it('formats all full fixtures', () => {
		expect(
			markdownFormatter.formatComponentManifest(
				fullManifestFixture.components.button,
			),
		).toMatchSnapshot();
		expect(
			markdownFormatter.formatComponentManifest(
				fullManifestFixture.components.card,
			),
		).toMatchSnapshot();
		expect(
			markdownFormatter.formatComponentManifest(
				fullManifestFixture.components.input,
			),
		).toMatchSnapshot();
	});

	describe('component header', () => {
		it('should include component name and ID', () => {
			const manifest: ComponentManifest = {
				id: 'test-component',
				path: 'src/components/TestComponent.tsx',
				name: 'TestComponent',
			};

			const result = markdownFormatter.formatComponentManifest(manifest);

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

			const result = markdownFormatter.formatComponentManifest(manifest);

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

			const result = markdownFormatter.formatComponentManifest(manifest);

			expect(result).not.toContain('A simple button component');
			expect(result).toMatchInlineSnapshot(`
				"# Button

				ID: button"
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
						name: 'Default',
						snippet: '<Button>Click me</Button>',
					},
				],
			};

			const result = markdownFormatter.formatComponentManifest(manifest);

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

			const result = markdownFormatter.formatComponentManifest(manifest);

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

		it('should format PascalCase story names correctly', () => {
			const manifest: ComponentManifest = {
				id: 'button',
				name: 'Button',
				path: 'src/components/Button.tsx',
				stories: [
					{
						name: 'WithIcon',
						snippet: '<Button icon="check">Save</Button>',
					},
				],
			};

			const result = markdownFormatter.formatComponentManifest(manifest);

			expect(result).toContain('### With Icon');
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

			const result = markdownFormatter.formatComponentManifest(manifest);

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

			const result = markdownFormatter.formatComponentManifest(manifest);

			expect(result).not.toContain('## Stories');
		});

		it('should omit stories when stories array is empty', () => {
			const manifest: ComponentManifest = {
				id: 'button',
				name: 'Button',
				path: 'src/components/Button.tsx',
				stories: [],
			};

			const result = markdownFormatter.formatComponentManifest(manifest);

			expect(result).not.toContain('## Stories');
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

			const result = markdownFormatter.formatComponentManifest(manifest);

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

			const result = markdownFormatter.formatComponentManifest(manifest);

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

			const result = markdownFormatter.formatComponentManifest(manifest);

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

			const result = markdownFormatter.formatComponentManifest(manifest);

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

			const result = markdownFormatter.formatComponentManifest(manifest);

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

		const result = markdownFormatter.formatComponentManifest(manifest);

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
});

describe('MarkdownFormatter - formatManifestsToLists', () => {
	it('formats the full manifest fixture', () => {
		const result = markdownFormatter.formatManifestsToLists({
			componentManifest: fullManifestFixture as ComponentManifestMap,
		});
		expect(result).toMatchSnapshot();
	});

	describe('component list structure', () => {
		it('should format a single component', () => {
			const manifests: AllManifests = {
				componentManifest: {
					v: 1,
					components: {
						button: {
							id: 'button',
							name: 'Button',
							path: 'src/components/Button.tsx',
						},
					},
				},
			};

			const result = markdownFormatter.formatManifestsToLists(manifests);

			expect(result).toMatchInlineSnapshot(`
				"# Components

				- Button (button)"
			`);
		});

		it('should format multiple components', () => {
			const manifests: AllManifests = {
				componentManifest: {
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
				},
			};

			const result = markdownFormatter.formatManifestsToLists(manifests);

			expect(result).toMatchInlineSnapshot(`
				"# Components

				- Button (button)
				- Card (card)
				- Input (input)"
			`);
		});
	});

	describe('summary section', () => {
		it('should include summary when provided', () => {
			const manifests: AllManifests = {
				componentManifest: {
					v: 1,
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

			const result = markdownFormatter.formatManifestsToLists(manifests);

			expect(result).toMatchInlineSnapshot(`
				"# Components

				- Button (button): A versatile button component"
			`);
		});

		it('should prefer summary over description', () => {
			const manifests: AllManifests = {
				componentManifest: {
					v: 1,
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

			const result = markdownFormatter.formatManifestsToLists(manifests);

			expect(result).toContain('Button summary');
			expect(result).not.toContain('Button description');
		});

		it('should use description when summary is not provided', () => {
			const manifests: AllManifests = {
				componentManifest: {
					v: 1,
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

			const result = markdownFormatter.formatManifestsToLists(manifests);

			expect(result).toMatchInlineSnapshot(`
				"# Components

				- Button (button): A simple button component"
			`);
		});

		it('should truncate long descriptions to 90 characters', () => {
			const manifests: AllManifests = {
				componentManifest: {
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
				},
			};

			const result = markdownFormatter.formatManifestsToLists(manifests);

			expect(result).toContain('...');
			expect(result).toMatchInlineSnapshot(`
				"# Components

				- Button (button): This is a very long description that exceeds ninety characters and should be truncated wit..."
			`);
		});

		it('should not truncate descriptions under 90 characters', () => {
			const manifests: AllManifests = {
				componentManifest: {
					v: 1,
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

			const result = markdownFormatter.formatManifestsToLists(manifests);

			expect(result).not.toContain('...');
			expect(result).toContain('A button component for user interactions');
		});

		it('should omit summary when neither summary nor description provided', () => {
			const manifests: AllManifests = {
				componentManifest: {
					v: 1,
					components: {
						button: {
							id: 'button',
							name: 'Button',
							path: 'src/components/Button.tsx',
						},
					},
				},
			};

			const result = markdownFormatter.formatManifestsToLists(manifests);

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
					v: 1,
					components: {
						button: {
							id: 'button',
							name: 'Button',
							path: 'src/components/Button.tsx',
						},
					},
				},
				docsManifest: {
					v: 1,
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

			const result = markdownFormatter.formatManifestsToLists(manifests);

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
					v: 1,
					components: {
						button: {
							id: 'button',
							name: 'Button',
							path: 'src/components/Button.tsx',
						},
					},
				},
				docsManifest: {
					v: 1,
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

			const result = markdownFormatter.formatManifestsToLists(manifests);

			expect(result).toContain('# Components');
			expect(result).toContain('# Docs');
			expect(result).toContain('- Getting Started Guide (getting-started)');
			expect(result).toContain('- Theming Guide (theming)');
		});

		it('should omit docs section when docsManifest is not provided', () => {
			const manifests: AllManifests = {
				componentManifest: {
					v: 1,
					components: {
						button: {
							id: 'button',
							name: 'Button',
							path: 'src/components/Button.tsx',
						},
					},
				},
			};

			const result = markdownFormatter.formatManifestsToLists(manifests);

			expect(result).not.toContain('# Docs');
		});

		it('should use doc.summary when provided instead of extracting from content', () => {
			const manifests: AllManifests = {
				componentManifest: {
					v: 1,
					components: {
						button: {
							id: 'button',
							name: 'Button',
							path: 'src/components/Button.tsx',
						},
					},
				},
				docsManifest: {
					v: 1,
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

			const result = markdownFormatter.formatManifestsToLists(manifests);

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
					v: 1,
					components: {
						button: {
							id: 'button',
							name: 'Button',
							path: 'src/components/Button.tsx',
						},
					},
				},
				docsManifest: {
					v: 1,
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

			const result = markdownFormatter.formatManifestsToLists(manifests);

			expect(result).toMatchInlineSnapshot(`
				"# Components

				- Button (button)

				# Docs

				- Auto Summary Doc (auto-summary): This content will be extracted automatically."
			`);
		});
	});
});

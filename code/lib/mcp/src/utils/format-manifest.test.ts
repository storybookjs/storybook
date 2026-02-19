import { describe, it, expect } from 'vitest';
import {
	formatComponentManifest,
	formatManifestsToLists,
	formatMultiSourceManifestsToLists,
	formatStoryDocumentation,
} from './format-manifest';
import type { AllManifests, ComponentManifest, SourceManifests } from '../types';

describe('formatComponentManifest', () => {
	const manifest: ComponentManifest = {
		id: 'test-component',
		path: 'src/components/TestComponent.tsx',
		name: 'TestComponent',
	};

	it('should use markdown formatter by default', () => {
		expect(formatComponentManifest(manifest)).toMatchInlineSnapshot(`
			"# TestComponent

			ID: test-component"
		`);
	});

	it('should use xml formatter when format is "xml"', () => {
		expect(formatComponentManifest(manifest, 'xml')).toMatchInlineSnapshot(`
			"<component>
			<id>test-component</id>
			<name>TestComponent</name>
			</component>"
		`);
	});
});

describe('formatManifestsToLists', () => {
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

	it('should use markdown formatter by default', () => {
		expect(formatManifestsToLists(manifests)).toMatchInlineSnapshot(`
			"# Components

			- Button (button)"
		`);
	});

	it('should use xml formatter when format is "xml"', () => {
		expect(formatManifestsToLists(manifests, 'xml')).toMatchInlineSnapshot(`
			"<components>
			<component>
			<id>button</id>
			<name>Button</name>
			</component>
			</components>"
		`);
	});
});

describe('formatMultiSourceManifestsToLists', () => {
	const sources: SourceManifests[] = [
		{
			source: { id: 'local', title: 'Local' },
			componentManifest: {
				v: 1,
				components: {
					button: { id: 'button', name: 'Button', path: 'src/Button.tsx', summary: 'A button' },
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
						content: 'Welcome to the docs',
					},
				},
			},
		},
		{
			source: { id: 'remote', title: 'Remote', url: 'http://remote.example.com' },
			componentManifest: {
				v: 1,
				components: {
					badge: { id: 'badge', name: 'Badge', path: 'src/Badge.tsx', summary: 'A badge' },
				},
			},
		},
	];

	it('should format multi-source manifests as markdown', () => {
		expect(formatMultiSourceManifestsToLists(sources, 'markdown')).toMatchInlineSnapshot(`
			"# Local
			id: local

			## Components

			- Button (button): A button

			## Docs

			- Getting Started Guide (getting-started): Welcome to the docs

			# Remote
			id: remote

			## Components

			- Badge (badge): A badge"
		`);
	});

	it('should format multi-source manifests as xml', () => {
		expect(formatMultiSourceManifestsToLists(sources, 'xml')).toMatchInlineSnapshot(`
			"<sources>
			<source id="local" title="Local">
			<components>
			<component>
			<id>button</id>
			<name>Button</name>
			<summary>
			A button
			</summary>
			</component>
			</components>
			<docs>
			<doc>
			<id>getting-started</id>
			<title>Getting Started Guide</title>
			<summary>
			Welcome to the docs
			</summary>
			</doc>
			</docs>
			</source>
			<source id="remote" title="Remote">
			<components>
			<component>
			<id>badge</id>
			<name>Badge</name>
			<summary>
			A badge
			</summary>
			</component>
			</components>
			</source>
			</sources>"
		`);
	});

	it('should show errors for failed sources in xml', () => {
		const withError: SourceManifests[] = [
			{
				source: { id: 'broken', title: 'Broken', url: 'http://broken.example.com' },
				componentManifest: { v: 1, components: {} },
				error: 'Failed to fetch: 401 Unauthorized',
			},
		];
		expect(formatMultiSourceManifestsToLists(withError, 'xml')).toMatchInlineSnapshot(`
			"<sources>
			<source id="broken" title="Broken">
			<error>Failed to fetch: 401 Unauthorized</error>
			</source>
			</sources>"
		`);
	});
});

describe('formatStoryDocumentation', () => {
	const manifest: ComponentManifest = {
		id: 'button',
		name: 'Button',
		path: 'src/Button.tsx',
		import: 'import { Button } from "@my-lib/ui";',
		stories: [
			{
				name: 'Primary',
				description: 'The primary variant',
				snippet: 'const Primary = () => <Button variant="primary" />;',
			},
		],
	};

	it('should format story as xml', () => {
		expect(formatStoryDocumentation(manifest, 'Primary', 'xml')).toMatchInlineSnapshot(`
			"<story_documentation>
			<component_name>Button</component_name>
			<story_name>Primary</story_name>
			<story_description>
			The primary variant
			</story_description>
			<story_code>
			import { Button } from "@my-lib/ui";

			const Primary = () => <Button variant="primary" />;
			</story_code>
			</story_documentation>"
		`);
	});
});

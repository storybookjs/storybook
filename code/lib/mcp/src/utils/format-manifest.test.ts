import { describe, it, expect } from 'vitest';
import {
	formatComponentManifest,
	formatManifestsToLists,
} from './format-manifest';
import type { AllManifests, ComponentManifest } from '../types';

describe('formatComponentManifest', () => {
	const manifest: ComponentManifest = {
		id: 'test-component',
		path: 'src/components/TestComponent.tsx',
		name: 'TestComponent',
	};

	it('should use markdown formatter by default', () => {
		const result = formatComponentManifest(manifest);
		expect(result).toContain('# TestComponent');
		expect(result).toContain('ID: test-component');
	});

	it('should use markdown formatter when format is "markdown"', () => {
		const result = formatComponentManifest(manifest, 'markdown');
		expect(result).toContain('# TestComponent');
		expect(result).toContain('ID: test-component');
	});

	it('should use xml formatter when format is "xml"', () => {
		const result = formatComponentManifest(manifest, 'xml');
		expect(result).toContain('<component>');
		expect(result).toContain('<name>TestComponent</name>');
		expect(result).toContain('<id>test-component</id>');
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
		const result = formatManifestsToLists(manifests);
		expect(result).toContain('# Components');
		expect(result).toContain('- Button (button)');
	});

	it('should use markdown formatter when format is "markdown"', () => {
		const result = formatManifestsToLists(manifests, 'markdown');
		expect(result).toContain('# Components');
		expect(result).toContain('- Button (button)');
	});

	it('should use xml formatter when format is "xml"', () => {
		const result = formatManifestsToLists(manifests, 'xml');
		expect(result).toContain('<components>');
		expect(result).toContain('<name>Button</name>');
		expect(result).toContain('<id>button</id>');
	});
});

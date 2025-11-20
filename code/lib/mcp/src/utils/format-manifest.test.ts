import { describe, it, expect } from 'vitest';
import {
	formatComponentManifest,
	formatComponentManifestMapToList,
} from './format-manifest';
import type { ComponentManifest, ComponentManifestMap } from '../types';

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

describe('formatComponentManifestMapToList', () => {
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

	it('should use markdown formatter by default', () => {
		const result = formatComponentManifestMapToList(manifest);
		expect(result).toContain('# Components');
		expect(result).toContain('- Button (button)');
	});

	it('should use markdown formatter when format is "markdown"', () => {
		const result = formatComponentManifestMapToList(manifest, 'markdown');
		expect(result).toContain('# Components');
		expect(result).toContain('- Button (button)');
	});

	it('should use xml formatter when format is "xml"', () => {
		const result = formatComponentManifestMapToList(manifest, 'xml');
		expect(result).toContain('<components>');
		expect(result).toContain('<name>Button</name>');
		expect(result).toContain('<id>button</id>');
	});
});

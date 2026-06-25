import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Options, StoryIndex } from 'storybook/internal/types';

vi.mock('../utils/get-story-index.ts', () => ({ getStoryIndex: vi.fn() }));
vi.mock('./service-access.ts', () => ({
	getDocgenService: vi.fn(),
	getStoryDocsService: vi.fn(),
	getMdxService: vi.fn(),
}));

import { createDocgenServerManifestAccess } from './in-process-provider.ts';
import { getStoryIndex } from '../utils/get-story-index.ts';
import { getDocgenService, getMdxService, getStoryDocsService } from './service-access.ts';

const options = {} as Options;

/** Story index with one manifest component (`button`) and one unattached doc (`intro--docs`). */
const index: StoryIndex = {
	v: 5,
	entries: {
		'button--primary': {
			type: 'story',
			subtype: 'story',
			id: 'button--primary',
			name: 'Primary',
			title: 'Button',
			importPath: './Button.stories.tsx',
			tags: ['manifest'],
		},
		'intro--docs': {
			type: 'docs',
			id: 'intro--docs',
			name: 'Intro',
			title: 'Intro',
			importPath: './Intro.mdx',
			storiesImports: [],
			tags: ['manifest', 'unattached-mdx'],
		},
	},
} as unknown as StoryIndex;

const getDocgen = vi.fn();
const getDocgenForAllComponents = vi.fn();
const getStoryDocs = vi.fn();
const getMdxForComponent = vi.fn();
const getMdxForAllComponents = vi.fn();

function query<T extends (...args: any[]) => any>(loaded: T) {
	return { loaded, get: vi.fn() };
}

beforeEach(() => {
	vi.clearAllMocks();

	vi.mocked(getStoryIndex).mockResolvedValue(index);

	getDocgenForAllComponents.mockResolvedValue({
		button: { id: 'button', name: 'Button', description: 'A button' },
	});
	getDocgen.mockResolvedValue({
		id: 'button',
		name: 'Button',
		description: 'A button',
		reactComponentMeta: { props: {} },
	});
	getStoryDocs.mockResolvedValue({
		id: 'button',
		name: 'Button',
		path: 'src/Button.tsx',
		import: "import { Button } from './Button'",
		stories: {
			'button--primary': { id: 'button--primary', name: 'Primary', snippet: '<Button />' },
		},
	});
	getMdxForComponent.mockResolvedValue({
		id: 'intro--docs',
		name: 'Intro',
		docs: {
			'intro--docs': { id: 'intro--docs', name: 'Intro', title: 'Intro', content: '# Welcome' },
		},
	});
	getMdxForAllComponents.mockResolvedValue({
		'intro--docs': {
			id: 'intro--docs',
			name: 'Intro',
			docs: { 'intro--docs': { id: 'intro--docs', name: 'Intro' } },
		},
	});

	vi.mocked(getDocgenService).mockResolvedValue({
		queries: {
			getDocgen: query(getDocgen),
			getDocgenForAllComponents: query(getDocgenForAllComponents),
		},
	} as any);
	vi.mocked(getStoryDocsService).mockResolvedValue({
		queries: { getStoryDocs: query(getStoryDocs) },
	} as any);
	vi.mocked(getMdxService).mockResolvedValue({
		queries: {
			getMdxForComponent: query(getMdxForComponent),
			getMdxForAllComponents: query(getMdxForAllComponents),
		},
	} as any);
});

describe('createDocgenServerManifestAccess - manifestProvider', () => {
	it('builds the shallow components.json list surface from the live services', async () => {
		const { manifestProvider } = createDocgenServerManifestAccess(options);
		const json = JSON.parse(await manifestProvider(undefined, './manifests/components.json'));

		expect(json.v).toBe(1);
		expect(json.components.button).toEqual({
			id: 'button',
			name: 'Button',
			description: 'A button',
			stories: { $ref: '../services/core/story-docs/button.json#/components/button' },
		});
	});

	it('builds the shallow docs.json list surface for unattached docs', async () => {
		const { manifestProvider } = createDocgenServerManifestAccess(options);
		const json = JSON.parse(await manifestProvider(undefined, './manifests/docs.json'));

		expect(json.docs['intro--docs']).toEqual({
			id: 'intro--docs',
			name: 'Intro',
		});
	});

	it('serves a single story-docs service file wrapped under { components: { [id] } }', async () => {
		const { manifestProvider } = createDocgenServerManifestAccess(options);
		const json = JSON.parse(
			await manifestProvider(undefined, './services/core/story-docs/button.json'),
		);

		expect(getStoryDocs).toHaveBeenCalledWith({ id: 'button' });
		expect(json.components.button.stories['button--primary'].name).toBe('Primary');
	});

	it('does not expose docgen or mdx service files in dev', async () => {
		const { manifestProvider } = createDocgenServerManifestAccess(options);

		await expect(manifestProvider(undefined, './services/core/docgen/button.json')).rejects.toThrow(
			/Unsupported in-process manifest path/,
		);
		await expect(
			manifestProvider(undefined, './services/addon-docs/mdx/intro--docs.json'),
		).rejects.toThrow(/Unsupported in-process manifest path/);
	});

	it('throws for unsupported in-process paths', async () => {
		const { manifestProvider } = createDocgenServerManifestAccess(options);
		await expect(manifestProvider(undefined, './manifests/unknown.json')).rejects.toThrow(
			/Unsupported in-process manifest path/,
		);
	});
});

describe('createDocgenServerManifestAccess - resolveEntry', () => {
	it('resolves one component without triggering all-component docgen', async () => {
		const { resolveEntry } = createDocgenServerManifestAccess(options);
		const resolved = await resolveEntry('button');

		expect(resolved?.kind).toBe('component');
		expect(getDocgen).toHaveBeenCalledWith({ id: 'button' });
		// Crucially, the all-component extraction is never invoked for a single lookup.
		expect(getDocgenForAllComponents).not.toHaveBeenCalled();
		if (resolved?.kind === 'component') {
			expect(resolved.component.id).toBe('button');
			expect(resolved.component.stories).toEqual([
				{ id: 'button--primary', name: 'Primary', snippet: '<Button />' },
			]);
		}
	});

	it('resolves an unattached doc as a doc entry', async () => {
		const { resolveEntry } = createDocgenServerManifestAccess(options);
		const resolved = await resolveEntry('intro--docs');

		expect(resolved?.kind).toBe('doc');
		if (resolved?.kind === 'doc') {
			expect(resolved.doc).toMatchObject({ id: 'intro--docs', content: '# Welcome' });
		}
	});

	it('returns undefined for ids not present in the index', async () => {
		const { resolveEntry } = createDocgenServerManifestAccess(options);
		await expect(resolveEntry('missing')).resolves.toBeUndefined();
	});
});

describe('createDocgenServerManifestAccess - graceful fallback', () => {
	it('still lists components (name = id, no $refs) when services are unavailable', async () => {
		vi.mocked(getDocgenService).mockResolvedValue(undefined);
		vi.mocked(getStoryDocsService).mockResolvedValue(undefined);
		vi.mocked(getMdxService).mockResolvedValue(undefined);

		const { manifestProvider, resolveEntry } = createDocgenServerManifestAccess(options);
		const json = JSON.parse(await manifestProvider(undefined, './manifests/components.json'));

		// Without a docgen payload the index entry falls back to id-as-name and omits docgen $ref.
		expect(json.components.button).toMatchObject({ id: 'button', name: 'button' });
		expect(json.components.button.docgen).toBeUndefined();
		// stories ref still present because the entry is story-backed.
		expect(json.components.button.stories).toEqual({
			$ref: '../services/core/story-docs/button.json#/components/button',
		});

		const resolved = await resolveEntry('button');
		expect(resolved?.kind).toBe('component');
	});
});

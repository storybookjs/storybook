import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import type { StoryIndex } from 'storybook/internal/types';

// Static import would freeze the mock target before each test gets a chance
// to swap the underlying core-server module. We dynamically `import()` after
// `vi.doMock` instead — see each test below.

// The resolver canonicalises every input path with `fs.realpathSync.native` and probes
// barrel candidates with `fs.existsSync`. These unit tests operate on synthetic paths that
// don't exist on disk, so we stub `node:fs`: realpath is identity (the path is its own
// canonical form) and existsSync is false (no barrel siblings — barrel expansion is covered
// by the live-endpoint eval probe noted below).
vi.mock('node:fs', () => {
	const realpathSync: any = (p: string) => p;
	realpathSync.native = (p: string) => p;
	const fs = { realpathSync, existsSync: () => false };
	return { ...fs, default: fs };
});

const FAKE_WORKING_DIR = '/repo';
const BADGE_ABS = path.join(FAKE_WORKING_DIR, 'src/components/Badge/Badge.tsx');
const BADGE_BARREL = path.join(FAKE_WORKING_DIR, 'src/components/Badge/index.ts');

function setupService(opts: { storiesByDep: Record<string, Record<string, number>> }) {
	const stub = {
		hasGraph: () => true,
		lookup(dep: string): Map<string, number> {
			const m = opts.storiesByDep[dep];
			if (!m) return new Map();
			return new Map(Object.entries(m));
		},
	};
	vi.doMock('storybook/internal/core-server', () => ({
		experimental_getDependencyGraphService: () => stub,
	}));
}

function buildStoryIndex(byFile: Record<string, string[]>): StoryIndex {
	const entries: StoryIndex['entries'] = {};
	for (const [absStoryFile, ids] of Object.entries(byFile)) {
		const relative = path.relative(FAKE_WORKING_DIR, absStoryFile);
		for (const id of ids) {
			entries[id] = {
				type: 'story',
				subtype: 'story',
				id,
				name: id,
				title: id,
				importPath: relative,
				tags: [],
			} as StoryIndex['entries'][string];
		}
	}
	return { v: 5, entries };
}

function depsFor(byFile: Record<string, string[]> = {}, workingDir = FAKE_WORKING_DIR) {
	const index = buildStoryIndex(byFile);
	return { getStoryIndex: async () => index, workingDir };
}

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	vi.resetModules();
	vi.doUnmock('storybook/internal/core-server');
});

describe('resolveComponentStories', () => {
	it('strips trailing slashes so `Badge.tsx/` queries the file, not the parent-name barrel', async () => {
		// Regression for the silent-corruption bug: when a caller pastes
		// `Badge/Badge.tsx/`, the trailing slash flipped `basename === dirname`
		// in the barrel-expansion heuristic and we returned stories that
		// consumed the *barrel* (`Badge/index.ts`) instead of `Badge.tsx`.
		setupService({
			storiesByDep: {
				[BADGE_ABS]: {
					'/repo/src/A.stories.tsx': 1,
					'/repo/src/B.stories.tsx': 2,
				},
				[BADGE_BARREL]: {
					'/repo/src/C.stories.tsx': 1, // wholly unrelated barrel consumer
				},
			},
		});
		const { resolveComponentStories } = await import('./resolve-component-stories.ts');
		const res = await resolveComponentStories(
			{ componentPaths: [`${BADGE_ABS}/`] },
			depsFor({
				'/repo/src/A.stories.tsx': ['a--default'],
				'/repo/src/B.stories.tsx': ['b--default'],
				'/repo/src/C.stories.tsx': ['c--default'],
			}),
		);
		expect(res.available).toBe(true);
		expect(res.results?.[0]?.matches.map((m) => m.storyId).sort()).toEqual([
			'a--default',
			'b--default',
		]);
		// And critically does NOT include the barrel-only consumer:
		expect(res.results?.[0]?.matches.map((m) => m.storyId)).not.toContain('c--default');
	});

	it('resolves relative paths against the workingDir', async () => {
		setupService({
			storiesByDep: {
				[BADGE_ABS]: { '/repo/src/A.stories.tsx': 1 },
			},
		});
		const { resolveComponentStories } = await import('./resolve-component-stories.ts');
		const res = await resolveComponentStories(
			{ componentPaths: ['src/components/Badge/Badge.tsx'] },
			depsFor({ '/repo/src/A.stories.tsx': ['a--default'] }),
		);
		expect(res.results?.[0]?.matches.map((m) => m.storyId)).toEqual(['a--default']);
	});

	it('normalizes redundant slashes (`/services//webapp/`)', async () => {
		setupService({
			storiesByDep: { [BADGE_ABS]: { '/repo/src/A.stories.tsx': 1 } },
		});
		const { resolveComponentStories } = await import('./resolve-component-stories.ts');
		const res = await resolveComponentStories(
			{ componentPaths: ['/repo/src//components/Badge/Badge.tsx'] },
			depsFor({ '/repo/src/A.stories.tsx': ['a--default'] }),
		);
		expect(res.results?.[0]?.matches.map((m) => m.storyId)).toEqual(['a--default']);
	});

	it('skips virtual: importPath entries when building the file→storyIds map', async () => {
		setupService({
			storiesByDep: { [BADGE_ABS]: { '/repo/src/A.stories.tsx': 1 } },
		});
		const { resolveComponentStories } = await import('./resolve-component-stories.ts');
		const indexWithVirtual: StoryIndex = {
			v: 5,
			entries: {
				'a--default': {
					type: 'story',
					subtype: 'story',
					id: 'a--default',
					name: 'Default',
					title: 'A',
					importPath: 'src/A.stories.tsx',
					tags: [],
				} as StoryIndex['entries'][string],
				'virtual--page': {
					type: 'story',
					subtype: 'story',
					id: 'virtual--page',
					name: 'Virtual',
					title: 'V',
					importPath: 'virtual:storybook/auto-docs',
					tags: [],
				} as StoryIndex['entries'][string],
			},
		};
		const res = await resolveComponentStories(
			{ componentPaths: [BADGE_ABS] },
			{ getStoryIndex: async () => indexWithVirtual, workingDir: FAKE_WORKING_DIR },
		);
		expect(res.results?.[0]?.matches.map((m) => m.storyId)).toEqual(['a--default']);
	});

	// Note: `expandBarrelTargets` uses `fs.existsSync` to validate candidate barrel
	// paths before adding them, so a pure-mock unit test would need fake files on
	// disk to exercise the barrel branch. End-to-end barrel behaviour is covered
	// by the live-endpoint probe `eval/get-stories-by-component/edge-case-probe.ts`
	// (P9: `ShoppingCart/index.ts`).

	it('returns available:false when the service is not active', async () => {
		vi.doMock('storybook/internal/core-server', () => ({
			experimental_getDependencyGraphService: () => undefined,
		}));
		const { resolveComponentStories } = await import('./resolve-component-stories.ts');
		const res = await resolveComponentStories({ componentPaths: [BADGE_ABS] }, depsFor());
		expect(res.available).toBe(false);
		expect(res.reason).toMatch(/dependency graph is unavailable/);
	});

	it('returns available:false on older Storybook versions that lack the export', async () => {
		// Backwards-compat path: the module loads but the named export is
		// undefined (older Storybook). The dynamic-import probe must treat
		// this identically to "service inactive".
		vi.doMock('storybook/internal/core-server', () => ({}));
		const { resolveComponentStories } = await import('./resolve-component-stories.ts');
		const res = await resolveComponentStories({ componentPaths: [BADGE_ABS] }, depsFor());
		expect(res.available).toBe(false);
		expect(res.reason).toMatch(/dependency graph is unavailable/);
	});

	it('returns available:false when the graph build has not finished', async () => {
		vi.doMock('storybook/internal/core-server', () => ({
			experimental_getDependencyGraphService: () => ({
				hasGraph: () => false,
				lookup: () => new Map(),
			}),
		}));
		const { resolveComponentStories } = await import('./resolve-component-stories.ts');
		const res = await resolveComponentStories({ componentPaths: [BADGE_ABS] }, depsFor());
		expect(res.available).toBe(false);
		expect(res.reason).toMatch(/hasn't built/);
	});
});

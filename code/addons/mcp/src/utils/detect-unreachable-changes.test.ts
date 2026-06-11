import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	formatPartialCoverageBanner,
	formatPartialCoverageHint,
	formatUnreachableHint,
} from './detect-unreachable-changes.ts';

describe('formatUnreachableHint', () => {
	it('returns empty string when there are no unreachable files', () => {
		expect(formatUnreachableHint([])).toBe('');
	});

	it('lists files and tells the agent what to do next', () => {
		const out = formatUnreachableHint(['src/styles/theme.ts', 'src/utils/format.ts']);
		expect(out).toContain('src/styles/theme.ts');
		expect(out).toContain('src/utils/format.ts');
		expect(out).toMatch(/unreachable/i);
		expect(out).toContain('get-stories-by-component');
		expect(out).toMatch(/grep/i);
	});
});

describe('formatPartialCoverageHint', () => {
	it('returns empty string when there are no unreachable files', () => {
		expect(formatPartialCoverageHint([])).toBe('');
	});

	it('warns about partial coverage and points at get-stories-by-component', () => {
		const out = formatPartialCoverageHint(['src/styles/theme.ts']);
		expect(out).toContain('src/styles/theme.ts');
		expect(out).toMatch(/coverage sanity check/i);
		expect(out).toContain('get-stories-by-component');
		expect(out).toMatch(/never invent/i);
	});

	it('uses different framing from the empty-response hint', () => {
		const partial = formatPartialCoverageHint(['src/styles/theme.ts']);
		const empty = formatUnreachableHint(['src/styles/theme.ts']);
		// The partial-coverage case is specifically about stale-but-non-empty
		// responses; the empty-response case is about no results at all. The
		// hints must be distinguishable so the agent reacts differently.
		expect(partial).not.toBe(empty);
		expect(partial).toMatch(/stale/i);
	});
});

describe('formatPartialCoverageBanner', () => {
	it('returns empty string when there are no unreachable files', () => {
		expect(formatPartialCoverageBanner([])).toBe('');
	});

	it('inlines the file list when 3 or fewer files are flagged', () => {
		const out = formatPartialCoverageBanner(['.storybook/main.ts', 'src/server.ts']);
		expect(out).toMatch(/^⚠ Coverage gap:/);
		expect(out).toContain('2 modified files');
		expect(out).toContain('.storybook/main.ts');
		expect(out).toContain('src/server.ts');
		expect(out).toContain('full sanity-check note at end');
		expect(out.endsWith('\n\n')).toBe(true);
	});

	it('summarises overflow as `+N more` past the inline limit', () => {
		const out = formatPartialCoverageBanner(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts']);
		// First three inlined, remainder collapsed.
		expect(out).toContain('a.ts, b.ts, c.ts, +2 more');
		expect(out).toContain('5 modified files');
	});

	it('singularises when exactly one file is unreachable', () => {
		const out = formatPartialCoverageBanner(['src/server.ts']);
		expect(out).toContain('1 modified file unreachable');
	});

	it('is short enough to survive realistic tool-output truncation', () => {
		// The whole point of the banner is to outlast aggressive truncation /
		// compaction passes. Five-file case with realistic-length paths is the
		// upper bound we care about; cap at 250 chars so the leading line stays
		// in the "definitely-not-dropped" budget of every host we've seen.
		const out = formatPartialCoverageBanner([
			'.storybook/main.ts',
			'services/webapp/server.ts',
			'services/webapp/lib/auth.ts',
			'services/webapp/lib/cache.ts',
			'services/webapp/lib/feature-flags.ts',
		]);
		expect(out.length).toBeLessThanOrEqual(250);
	});
});

describe('detectUnreachableChanges', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.resetModules();
		vi.doUnmock('storybook/internal/core-server');
		vi.doUnmock('node:child_process');
	});

	function mockService(opts: {
		status?: import('./module-graph.ts').ModuleGraphStatus;
		/** Maps the batched input files to positional hit lists. */
		getStoriesForFiles: (files: string[]) => import('./module-graph.ts').ModuleGraphStoryHit[][];
	}) {
		const status = opts.status ?? { value: 'ready' };
		vi.doMock('storybook/internal/core-server', () => ({
			getService: () => ({
				queries: {
					getStatus: { loaded: async () => status },
					getStoriesForFiles: {
						loaded: async ({ files }: { files: string[] }) => opts.getStoriesForFiles(files),
					},
				},
			}),
		}));
	}

	function mockGit(porcelain: string) {
		vi.doMock('node:child_process', () => ({
			execSync: () => porcelain,
		}));
	}

	it('lists working-tree files that the reverse-graph does not reach', async () => {
		mockService({
			// reverse-graph knows about Badge.tsx but NOT theme.ts
			getStoriesForFiles: (files) =>
				files.map((f) =>
					f.endsWith('Badge.tsx') ? [{ storyFile: './src/Badge.stories.tsx', depth: 1 }] : [],
				),
		});
		mockGit(' M src/styles/theme.ts\n M src/components/Badge/Badge.tsx\n');
		const { detectUnreachableChanges } = await import('./detect-unreachable-changes.ts');
		expect(await detectUnreachableChanges()).toEqual(['src/styles/theme.ts']);
	});

	it('returns [] when every modified file IS in the graph', async () => {
		mockService({
			getStoriesForFiles: (files) =>
				files.map(() => [{ storyFile: './src/x.stories.tsx', depth: 1 }]),
		});
		mockGit(' M src/components/Badge/Badge.tsx\n');
		const { detectUnreachableChanges } = await import('./detect-unreachable-changes.ts');
		expect(await detectUnreachableChanges()).toEqual([]);
	});

	it('returns [] when the service is not active', async () => {
		vi.doMock('storybook/internal/core-server', () => ({
			getService: () => undefined,
		}));
		mockGit(' M src/styles/theme.ts\n');
		const { detectUnreachableChanges } = await import('./detect-unreachable-changes.ts');
		expect(await detectUnreachableChanges()).toEqual([]);
	});

	it('returns [] on older Storybook versions that lack the open-service API', async () => {
		// Backwards-compat: the `getService` export is missing entirely.
		vi.doMock('storybook/internal/core-server', () => ({}));
		mockGit(' M src/styles/theme.ts\n');
		const { detectUnreachableChanges } = await import('./detect-unreachable-changes.ts');
		expect(await detectUnreachableChanges()).toEqual([]);
	});

	it('returns [] when the module graph is not ready', async () => {
		mockService({
			status: { value: 'booting' },
			getStoriesForFiles: (files) => files.map(() => []),
		});
		mockGit(' M src/styles/theme.ts\n');
		const { detectUnreachableChanges } = await import('./detect-unreachable-changes.ts');
		expect(await detectUnreachableChanges()).toEqual([]);
	});

	it('returns [] when the working tree is clean', async () => {
		mockService({ getStoriesForFiles: (files) => files.map(() => []) });
		mockGit('');
		const { detectUnreachableChanges } = await import('./detect-unreachable-changes.ts');
		expect(await detectUnreachableChanges()).toEqual([]);
	});

	it('ignores non-source files (css, json, lockfiles, …)', async () => {
		mockService({ getStoriesForFiles: (files) => files.map(() => []) });
		mockGit(' M src/styles/theme.css\n M package-lock.json\n M src/styles/theme.ts\n');
		const { detectUnreachableChanges } = await import('./detect-unreachable-changes.ts');
		expect(await detectUnreachableChanges()).toEqual(['src/styles/theme.ts']);
	});

	it('handles rename lines (`R  old -> new`) by keeping the new path', async () => {
		mockService({ getStoriesForFiles: (files) => files.map(() => []) });
		mockGit('R  src/old.ts -> src/new.ts\n');
		const { detectUnreachableChanges } = await import('./detect-unreachable-changes.ts');
		expect(await detectUnreachableChanges()).toEqual(['src/new.ts']);
	});

	it('returns [] gracefully when git fails (not a repo, etc.)', async () => {
		mockService({ getStoriesForFiles: (files) => files.map(() => []) });
		vi.doMock('node:child_process', () => ({
			execSync: () => {
				throw new Error('not a git repository');
			},
		}));
		const { detectUnreachableChanges } = await import('./detect-unreachable-changes.ts');
		expect(await detectUnreachableChanges()).toEqual([]);
	});

	it('caps the list at maxFiles to keep the agent response small', async () => {
		mockService({ getStoriesForFiles: (files) => files.map(() => []) });
		const many = Array.from({ length: 50 }, (_, i) => ` M src/f${i}.ts\n`).join('');
		mockGit(many);
		const { detectUnreachableChanges } = await import('./detect-unreachable-changes.ts');
		expect(await detectUnreachableChanges(5)).toHaveLength(5);
	});

	it('queries in chunks and stops early once maxFiles unreachable files are found', async () => {
		// 200 modified files, all unreachable. With a chunk size of 50 and maxFiles=5, the very
		// first chunk already satisfies the cap, so we must not query the remaining ~150 files.
		const queried: string[] = [];
		mockService({
			getStoriesForFiles: (files) => {
				queried.push(...files);
				return files.map(() => []);
			},
		});
		const many = Array.from({ length: 200 }, (_, i) => ` M src/f${i}.ts\n`).join('');
		mockGit(many);
		const { detectUnreachableChanges } = await import('./detect-unreachable-changes.ts');
		expect(await detectUnreachableChanges(5)).toHaveLength(5);
		// Only the first chunk should have been queried, not the whole working tree.
		expect(queried.length).toBeLessThanOrEqual(50);
	});
});

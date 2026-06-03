import fs from 'node:fs';
import path from 'node:path';
import type { StoryIndex } from 'storybook/internal/types';
import { getDependencyGraphService } from './change-detection.ts';
import { slash } from './slash.ts';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'] as const;
const INDEX_BASENAMES = SOURCE_EXTENSIONS.map((ext) => `index${ext}`);

/**
 * Expands `Foo/Foo.tsx` ↔ `Foo/index.tsx` so a query against either form hits stories that
 * imported the other. Only expands when filename or dirname clearly names the directory's
 * main export.
 */
function expandBarrelTargets(absoluteComponentPath: string): string[] {
	const targets = new Set<string>([absoluteComponentPath]);
	const dir = path.dirname(absoluteComponentPath);
	const ext = path.extname(absoluteComponentPath);
	const base = path.basename(absoluteComponentPath, ext);
	const dirName = path.basename(dir);

	if (base.toLowerCase() === 'index') {
		for (const candidateExt of SOURCE_EXTENSIONS) {
			const candidate = path.join(dir, `${dirName}${candidateExt}`);
			if (fs.existsSync(candidate)) targets.add(candidate);
		}
	} else if (base.toLowerCase() === dirName.toLowerCase()) {
		for (const indexBasename of INDEX_BASENAMES) {
			const candidate = path.join(dir, indexBasename);
			if (fs.existsSync(candidate)) targets.add(candidate);
		}
	}

	// Storybook's reverse index keys paths via `pathe.normalize` (forward slashes), so emit
	// forward slashes even on Windows where `path.normalize` would produce backslashes.
	return [...targets].map((p) => slash(path.normalize(p)));
}

/**
 * Canonicalises a path via `realpath`. Fixes silent misses on case-insensitive filesystems
 * (macOS APFS) where `BUTTON/Button.tsx` and `Button/Button.tsx` resolve to the same file but
 * only the canonical form is in the reverse-index keyset.
 *
 * Returns `undefined` if the path doesn't exist on disk — the caller surfaces that as a
 * distinct "path not found" outcome rather than a generic "no stories".
 */
function canonicalise(absolutePath: string): string | undefined {
	try {
		return fs.realpathSync.native(absolutePath);
	} catch {
		return undefined;
	}
}

/** Map absolute story-file path → story IDs declared in that file. Skips virtual entries. */
function buildStoryIdsByFile(storyIndex: StoryIndex, workingDir: string): Map<string, Set<string>> {
	const storyIdsByFile = new Map<string, Set<string>>();
	for (const entry of Object.values(storyIndex.entries)) {
		if (entry.type !== 'story' || entry.importPath.startsWith('virtual:')) continue;
		// Keys must match `service.lookup`'s forward-slash-normalized keys; `path.join` emits
		// backslashes on Windows, so normalize the separators here.
		const filePath = slash(path.join(workingDir, entry.importPath));
		let ids = storyIdsByFile.get(filePath);
		if (!ids) {
			ids = new Set<string>();
			storyIdsByFile.set(filePath, ids);
		}
		ids.add(entry.id);
	}
	return storyIdsByFile;
}

export interface ComponentStoriesRequest {
	componentPaths: string[];
}

export interface ComponentStoryDepth {
	storyId: string;
	depth: number;
}

export interface ComponentStoriesResult {
	/** Echoes the caller's input path, lightly normalized (trailing slashes etc. stripped). */
	componentPath: string;
	matches: ComponentStoryDepth[];
	/** `true` when no file exists at the resolved absolute path — distinguishes "typo" from "no stories yet". */
	pathNotFound?: boolean;
}

export interface ComponentStoriesResponse {
	available: boolean;
	reason?: string;
	results?: ComponentStoriesResult[];
}

export interface ResolveComponentStoriesDeps {
	/** Live story index; injectable so tests can pin a fixed value. */
	getStoryIndex: () => Promise<StoryIndex>;
	/** Defaults to `process.cwd()`, matching the dev server. */
	workingDir?: string;
}

/**
 * Looks up stories that consume each component path via Storybook's reverse dependency index.
 * Returns `{ available: false }` when the graph isn't reachable; otherwise per-path results.
 */
export async function resolveComponentStories(
	request: ComponentStoriesRequest,
	deps: ResolveComponentStoriesDeps,
): Promise<ComponentStoriesResponse> {
	const service = await getDependencyGraphService();
	if (!service) {
		return {
			available: false,
			reason:
				"Storybook's story dependency graph is unavailable. This Storybook version may not ship the API, or the dev server is not running.",
		};
	}

	if (!service.hasGraph()) {
		return {
			available: false,
			reason:
				"Storybook's story dependency graph hasn't built. Confirm your builder supports change detection (e.g. Vite) and check Storybook startup logs.",
		};
	}

	const workingDir = deps.workingDir ?? process.cwd();
	const storyIndex = await deps.getStoryIndex();
	const storyIdsByFile = buildStoryIdsByFile(storyIndex, workingDir);

	// Dedupe inputs so an agent that grep'd loosely doesn't get the same component echoed back twice.
	const deduped = [...new Set(request.componentPaths)];

	const results: ComponentStoriesResult[] = deduped.map((componentPath) => {
		// Normalize first: a trailing slash on `/abs/Badge/Badge.tsx/` would otherwise flip the
		// barrel-expansion heuristic and silently return barrel consumers instead of the file.
		const absolute = path.resolve(workingDir, componentPath);
		const canonical = canonicalise(absolute);

		// Echo a cleaned-up form of the input (no trailing slash / `..` segments) rather than the raw
		// string. Keeps relative paths relative and absolute paths absolute.
		const echo = path.normalize(componentPath);

		if (!canonical) {
			return { componentPath: echo, matches: [], pathNotFound: true };
		}

		// Include both the input's normalized form and the canonical form. On case-insensitive
		// filesystems they differ when the caller passed a wrong-case path; using both means we hit
		// the graph regardless of which form the caller supplied.
		const targets = new Set<string>(expandBarrelTargets(absolute));
		if (canonical !== absolute) {
			for (const t of expandBarrelTargets(canonical)) targets.add(t);
		}

		// Merge hits across expanded targets; keep the minimum depth per storyId.
		const byStoryId = new Map<string, number>();
		for (const target of targets) {
			const hits = service.lookup(target);
			for (const [storyFile, depth] of hits.entries()) {
				const storyIds = storyIdsByFile.get(storyFile);
				if (!storyIds) continue;
				for (const storyId of storyIds) {
					const existing = byStoryId.get(storyId);
					if (existing === undefined || depth < existing) byStoryId.set(storyId, depth);
				}
			}
		}

		const matches: ComponentStoryDepth[] = [...byStoryId.entries()]
			.map(([storyId, depth]) => ({ storyId, depth }))
			.sort((a, b) => {
				if (a.depth !== b.depth) return a.depth - b.depth;
				return a.storyId.localeCompare(b.storyId);
			});

		return { componentPath: echo, matches };
	});

	return { available: true, results };
}

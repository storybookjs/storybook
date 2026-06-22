import { execSync } from 'node:child_process';
import path from 'node:path';
import { getModuleGraphService } from './module-graph.ts';
import { slash } from './slash.ts';

const SOURCE_EXT_RE = /\.(?:tsx?|jsx?|mjs|cjs)$/i;

/**
 * Module-graph query batch size. Bounds the per-call file list so a large working tree doesn't
 * issue one oversized reverse-index query; we early-exit between chunks once `maxFiles` is reached.
 */
const CHUNK_SIZE = 50;

/**
 * git status --porcelain produces lines like `XY filename`, where XY are two
 * status characters (M, A, ?, etc). The pattern is rigid; we slice the prefix.
 * Rename lines are formatted as `R  old -> new` — keep only the new path.
 */
function parsePorcelain(output: string): string[] {
	return output
		.split('\n')
		.filter(Boolean)
		.map((line) => {
			const rest = line.slice(3); // strip "XY "
			const arrow = rest.indexOf(' -> ');
			return arrow >= 0 ? rest.slice(arrow + 4).trim() : rest.trim();
		});
}

/**
 * Lists working-tree modified files that are NOT reached from any story file
 * via Storybook's reverse dependency graph. This is the "your edit isn't in
 * the graph; you'll need to grep" case — typical for theme tokens, decorator
 * config, and other infrastructure files consumed via Storybook's preview
 * runtime rather than story-file imports.
 *
 * Returns workspace-relative paths, suitable for inlining into a tool
 * response. Empty when:
 *   - change detection is inactive,
 *   - the working tree is clean,
 *   - or every modified file IS in the graph (the caller should use the
 *     status-store result directly).
 */
export async function detectUnreachableChanges(maxFiles = 10): Promise<string[]> {
	const moduleGraph = await getModuleGraphService();
	if (!moduleGraph) return [];
	const status = await moduleGraph.queries.getStatus.loaded(undefined);
	if (status.value !== 'ready') return [];
	// Matches what the dev server uses, so paths line up with the reverse-index keys.
	const workingDir = process.cwd();

	let porcelain: string;
	try {
		porcelain = execSync('git status --porcelain', {
			cwd: workingDir,
			encoding: 'utf-8',
			stdio: ['ignore', 'pipe', 'ignore'],
		});
	} catch {
		return [];
	}

	const relFiles = parsePorcelain(porcelain).filter((f) => SOURCE_EXT_RE.test(f));
	if (relFiles.length === 0) return [];

	// Query in chunks and stop once we've collected `maxFiles` unreachable files, so a huge working
	// tree doesn't build an oversized module-graph query for results we'd discard anyway.
	const unreachable: string[] = [];
	for (
		let start = 0;
		start < relFiles.length && unreachable.length < maxFiles;
		start += CHUNK_SIZE
	) {
		const chunk = relFiles.slice(start, start + CHUNK_SIZE);
		// The module graph accepts absolute paths but normalizes them with forward slashes;
		// `path.resolve` emits backslashes on Windows, which would miss every key and wrongly flag
		// reachable files.
		const absChunk = chunk.map((rel) => slash(path.resolve(workingDir, rel)));
		// One batched lookup per chunk; output is positional (result `i` corresponds to `absChunk[i]`).
		const hits = await moduleGraph.queries.getStoriesForFiles.loaded({ files: absChunk });
		for (const [i, rel] of chunk.entries()) {
			if (unreachable.length >= maxFiles) break;
			if ((hits[i]?.length ?? 0) === 0) unreachable.push(rel);
		}
	}
	return unreachable;
}

/**
 * Maximum unreachable files listed inline in the short header banner. Beyond
 * this we summarise the overflow as `+N more` to keep the banner one-line-ish.
 */
const BANNER_INLINE_LIMIT = 3;

/**
 * Short "front-loaded" version of {@link formatPartialCoverageHint}, designed
 * to survive truncation and compaction. The full hint still trails the
 * response body unchanged — this banner is purely a salience aid for the
 * non-empty case where 1000+ story bullets would otherwise bury the tail.
 *
 * Empty when no unreachable files were detected.
 */
export function formatPartialCoverageBanner(unreachable: string[]): string {
	if (unreachable.length === 0) return '';
	const fileList =
		unreachable.length <= BANNER_INLINE_LIMIT
			? unreachable.join(', ')
			: `${unreachable.slice(0, BANNER_INLINE_LIMIT).join(', ')}, +${unreachable.length - BANNER_INLINE_LIMIT} more`;
	const noun = unreachable.length === 1 ? 'file' : 'files';
	return `⚠ Coverage gap: ${unreachable.length} modified ${noun} unreachable from any story (${fileList}) — full sanity-check note at end of this response.\n\n`;
}

/**
 * Formats the unreachable-files list into a hint appended to
 * `get-changed-stories`' empty response. Empty string when no hint applies.
 */
export function formatUnreachableHint(unreachable: string[]): string {
	if (unreachable.length === 0) return '';
	const lines = unreachable.map((f) => `- ${f}`).join('\n');
	return `\n\nThe following working-tree file(s) are modified but unreachable from any story (no static import path connects them — they are likely theme tokens, decorators, or other Storybook-preview-runtime files):\n${lines}\n\nFor these, grep the codebase for their exports (e.g. specific tokens or symbols) to find runtime consumers, then call \`get-stories-by-component\` with those consumer file paths.`;
}

/**
 * Formats a sanity-check hint for the *non-empty* response case: there ARE
 * changed stories, but the working tree also contains modified files that
 * aren't reachable from any story (typically because the diff bundles a prior
 * sub-change on a component with a follow-up edit to shared infrastructure).
 * In that situation, the changed-stories list is real but incomplete w.r.t.
 * the agent's most recent sub-edit — the agent has to actively check coverage
 * rather than trust the list.
 *
 * Empty string when no hint applies.
 */
export function formatPartialCoverageHint(unreachable: string[]): string {
	if (unreachable.length === 0) return '';
	const lines = unreachable.map((f) => `- ${f}`).join('\n');
	return `\n\nCoverage sanity check: the working tree also contains modified file(s) that aren't reachable from any story above (no static import path connects them — typically theme tokens, decorators, or other preview-runtime files):\n${lines}\n\nThe list above is real but may be stale w.r.t. these files — they're often left over from an earlier sub-change in the same diff. Before composing a review, grep the codebase for their exports and call \`get-stories-by-component\` with the runtime consumers' file paths. Do not assume the list above already covers them, and never invent story IDs to fill the gap.`;
}

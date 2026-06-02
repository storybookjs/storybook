import type { McpServer } from 'tmcp';
import * as v from 'valibot';
import { collectTelemetry } from '../telemetry.ts';
import { errorToMCPContent } from '../utils/errors.ts';
import { getStoryIndex } from '../utils/get-story-index.ts';
import {
	resolveComponentStories,
	type ComponentStoryDepth,
} from '../utils/resolve-component-stories.ts';
import type { AddonContext } from '../types.ts';
import {
	GET_CHANGED_STORIES_TOOL_NAME,
	GET_STORIES_BY_COMPONENT_TOOL_NAME,
	PREVIEW_STORIES_TOOL_NAME,
} from './tool-names.ts';

/** When omitted by the caller, applied internally to keep result sets actionable on real codebases. */
const DEFAULT_MAX_DISTANCE = 3;

const GetStoriesByComponentInput = v.object({
	componentPaths: v.pipe(
		v.array(v.string()),
		v.minLength(1),
		v.description(
			`Absolute paths to component source files (e.g. "/repo/src/Button.tsx").
Pass the components you actually want stories for — typically files you just read, edited, or that the user mentioned.
Relative paths are also accepted and resolved against the Storybook working directory, but absolute paths are preferred for unambiguous results.
Story files (\`*.stories.*\`) are accepted too: they appear at distance 0 as self-matches, plus any reverse-graph hits (other stories that import them).`,
		),
	),
	maxDistance: v.pipe(
		v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
		v.description(
			`Ceiling on the import depth to include in results. Must be a positive integer.
- 1: only stories that directly import the component.
- 2+: also include stories that reach the component through N hops.
Defaults to ${DEFAULT_MAX_DISTANCE}; raise it to widen recall, lower it to tighten precision. Shared components (Button, Icon, …) accumulate noisy indirect matches at distance ≥ 3, so the default cap protects against runaway results.`,
		),
	),
});

const StoryMatch = v.object({
	storyId: v.string(),
	title: v.string(),
	name: v.string(),
	importPath: v.string(),
	distance: v.pipe(
		v.number(),
		v.description(
			'Import-graph depth from the story file to the component (lower = stronger). 0: the path you passed is itself a story file (self-match). 1: story file directly imports the component. 2+: reached through N hops.',
		),
	),
});

const ClippedByMaxDistanceSchema = v.pipe(
	v.object({
		count: v.number(),
		distances: v.array(v.number()),
	}),
	v.description(
		'Present only when `maxDistance` filtered out one or more matches. `count` is how many were dropped; `distances` lists the (sorted, distinct) distances those dropped matches sat at — widen `maxDistance` to include them.',
	),
);

const GetStoriesByComponentOutput = v.object({
	results: v.array(
		v.object({
			componentPath: v.string(),
			matches: v.array(StoryMatch),
			clipped: v.optional(ClippedByMaxDistanceSchema),
			pathNotFound: v.pipe(
				v.optional(v.boolean()),
				v.description(
					'`true` when no file exists at the resolved absolute path. Distinguishes a typo from "this component has no stories yet". The agent should re-check the path it sent.',
				),
			),
		}),
	),
});

export type GetStoriesByComponentOutput = v.InferOutput<typeof GetStoriesByComponentOutput>;

export interface ComponentStoryMatch {
	storyId: string;
	title: string;
	name: string;
	importPath: string;
	distance: number;
}

export interface ClippedByMaxDistance {
	count: number;
	distances: number[];
}

interface ComponentMatchResult {
	componentPath: string;
	matches: ComponentStoryMatch[];
	clipped?: ClippedByMaxDistance;
	pathNotFound?: boolean;
}

function serializeMatch(match: ComponentStoryMatch) {
	return `  - \`${match.storyId}\`: ${match.title} / ${match.name} (\`${match.importPath}\`)`;
}

function pluralize(n: number, singular: string, plural = `${singular}s`): string {
	return n === 1 ? singular : plural;
}

export interface SerializeOptions {
	maxDistance?: number;
	clipped?: ClippedByMaxDistance;
	pathNotFound?: boolean;
}

function formatClippedTail(clipped: ClippedByMaxDistance, maxDistance: number): string {
	const dists = clipped.distances;
	const rangeText =
		dists.length === 1
			? `distance ${dists[0]}`
			: `distances ${dists[0]}..${dists[dists.length - 1]}`;
	return `+${clipped.count} more ${pluralize(clipped.count, 'story', 'stories')} at ${rangeText} hidden by \`maxDistance: ${maxDistance}\``;
}

export function serializeComponentSection(
	componentPath: string,
	matches: ComponentStoryMatch[],
	options: SerializeOptions = {},
): string {
	const { maxDistance, clipped, pathNotFound } = options;

	if (pathNotFound) {
		return `${componentPath}: path does not exist on disk — re-check the path you sent.`;
	}

	// Distinguish "genuinely no stories" from "the cap filtered everything out".
	// Same surface text either way, but readers must be able to act on it.
	if (matches.length === 0) {
		if (clipped && clipped.count > 0 && maxDistance !== undefined) {
			return `${componentPath}: no stories within \`maxDistance: ${maxDistance}\` — ${formatClippedTail(clipped, maxDistance)}.`;
		}
		return `${componentPath}: no stories found`;
	}

	const byDistance = new Map<number, ComponentStoryMatch[]>();
	for (const m of matches) {
		const bucket = byDistance.get(m.distance) ?? [];
		bucket.push(m);
		byDistance.set(m.distance, bucket);
	}

	const distances = [...byDistance.keys()].sort((a, b) => a - b);
	const minDist = distances[0]!;
	const maxDist = distances[distances.length - 1]!;
	const componentCount = new Set(matches.map((m) => m.title)).size;
	const bucketSummary = distances.map((d) => `d${d}=${byDistance.get(d)!.length}`).join(', ');
	const summary = `→ ${matches.length} ${pluralize(matches.length, 'story', 'stories')} across ${componentCount} ${pluralize(componentCount, 'component')}, distances ${minDist}..${maxDist} (${bucketSummary})`;

	const lines: string[] = [`${componentPath}:`, summary];
	for (const d of distances) {
		lines.push(`distance ${d}:`);
		for (const m of byDistance.get(d)!) lines.push(serializeMatch(m));
	}

	if (clipped && clipped.count > 0 && maxDistance !== undefined) {
		lines.push(`  (${formatClippedTail(clipped, maxDistance)}.)`);
	}

	return lines.join('\n');
}

function applyMaxDistance(
	depths: ComponentStoryDepth[],
	maxDistance: number | undefined,
): { kept: ComponentStoryDepth[]; clipped?: ClippedByMaxDistance } {
	if (maxDistance === undefined) return { kept: depths };
	const kept: ComponentStoryDepth[] = [];
	const clippedDistances = new Set<number>();
	let clippedCount = 0;
	for (const d of depths) {
		if (d.depth <= maxDistance) kept.push(d);
		else {
			clippedCount++;
			clippedDistances.add(d.depth);
		}
	}
	const clipped =
		clippedCount > 0
			? {
					count: clippedCount,
					distances: [...clippedDistances].sort((a, b) => a - b),
				}
			: undefined;
	return { kept, clipped };
}

export async function addGetStoriesByComponentTool(server: McpServer<any, AddonContext>) {
	server.tool(
		{
			name: GET_STORIES_BY_COMPONENT_TOOL_NAME,
			title: 'Get stories for component files',
			description: `Map component source files to the stories that render them, so you can hand real story IDs to ${PREVIEW_STORIES_TOOL_NAME} instead of guessing.

**When to use this vs \`${GET_CHANGED_STORIES_TOOL_NAME}\`:** if the user just edited code, call \`${GET_CHANGED_STORIES_TOOL_NAME}\` first — it reads Storybook's live git-diff signal for free. Only call this tool when you need to map specific file paths to stories: the user described a feature/area by name, \`${GET_CHANGED_STORIES_TOOL_NAME}\` returned nothing (the change is outside the story graph and you need to find runtime consumers yourself), or it returned too much and you need to narrow.

**Use this whenever the user describes a part of the UI by feature, area, or topic** ("review the credit-card components", "preview every checkout story", "show me what cart looks like", "stories related to authentication") — first locate the relevant component files in the repo (grep/Glob), then pass their absolute paths here. The tool returns grounded \`storyId\` values from the live Storybook index; never invent IDs from file names, feature names, or memory.

Returns sorted results from the Storybook index — if a component has no matches here, it likely has no stories yet (say so, don't fabricate).

Backed by Storybook's live reverse dependency graph: distance is the import-graph hop count from the story file to the component (0 = the path you passed is itself a story file, 1 = directly imported, 2+ = transitively). Available when the Storybook dev server is running with a builder that supports change detection (e.g. Vite); otherwise the tool returns a typed error.

Results are sorted by \`distance\` (lower = stronger signal). Prefer the lowest-distance results first; widen only when needed. For shared components like Button or Icon, expect many indirect (\`distance\` ≥ 2) matches — pass \`maxDistance\` to cap noise.`,
			schema: GetStoriesByComponentInput,
			outputSchema: GetStoriesByComponentOutput,
			enabled: () => server.ctx.custom?.toolsets?.dev ?? true,
		},
		async (input) => {
			try {
				const { options, disableTelemetry } = server.ctx.custom ?? {};
				if (!options) {
					throw new Error('Storybook options are required in addon context');
				}

				const index = await getStoryIndex(options);
				const lookup = await resolveComponentStories(
					{ componentPaths: input.componentPaths },
					{ getStoryIndex: async () => index },
				);

				if (!lookup.available) {
					return {
						content: [
							{
								type: 'text' as const,
								text:
									lookup.reason ??
									"Storybook's story dependency graph is unavailable. Make sure the dev server is running with a builder that supports change detection.",
							},
						],
						isError: true,
					};
				}

				const effectiveMaxDistance = input.maxDistance ?? DEFAULT_MAX_DISTANCE;

				const results: ComponentMatchResult[] = (lookup.results ?? []).map((entry) => {
					if (entry.pathNotFound) {
						return { componentPath: entry.componentPath, matches: [], pathNotFound: true };
					}
					const { kept, clipped } = applyMaxDistance(entry.matches, effectiveMaxDistance);
					const matches: ComponentStoryMatch[] = [];
					for (const { storyId, depth } of kept) {
						const indexEntry = index.entries[storyId];
						if (!indexEntry || indexEntry.type !== 'story') continue;
						matches.push({
							storyId: indexEntry.id,
							title: indexEntry.title,
							name: indexEntry.name,
							importPath: indexEntry.importPath,
							distance: depth,
						});
					}
					return { componentPath: entry.componentPath, matches, clipped };
				});

				const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);
				const unmatchedCount = results.filter(
					(r) => !r.pathNotFound && r.matches.length === 0,
				).length;

				const textSections = results.map(({ componentPath, matches, clipped, pathNotFound }) =>
					serializeComponentSection(componentPath, matches, {
						maxDistance: effectiveMaxDistance,
						clipped,
						pathNotFound,
					}),
				);

				const text =
					textSections.length > 0 ? textSections.join('\n\n') : 'No component paths provided.';

				if (!disableTelemetry) {
					await collectTelemetry({
						event: 'tool:getStoriesByComponent',
						server,
						toolset: 'dev',
						componentCount: input.componentPaths.length,
						matchedComponentCount: input.componentPaths.length - unmatchedCount,
						totalMatchCount: totalMatches,
						maxDistance: effectiveMaxDistance,
					});
				}

				return {
					content: [{ type: 'text' as const, text }],
					structuredContent: { results },
				};
			} catch (error) {
				return errorToMCPContent(error);
			}
		},
	);
}

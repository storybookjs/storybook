import type { McpServer } from 'tmcp';
import { experimental_getStatusStore } from 'storybook/internal/core-server';
import { collectTelemetry } from '../telemetry.ts';
import type { AddonContext } from '../types.ts';
import { errorToMCPContent } from '../utils/errors.ts';
import { fetchStoryIndex } from '../utils/fetch-story-index.ts';
import { GET_CHANGED_STORIES_TOOL_NAME } from './tool-names.ts';

const CHANGE_DETECTION_TYPE = 'storybook/change-detection';
const INCLUDED_STATUS_VALUES = new Set([
	'status-value:new',
	'status-value:modified',
	'status-value:affected',
]);

type ChangeDetectionStatus = {
	value?: string;
	data?: {
		changedFiles?: string[];
	};
};

type StoryStatusByType = Record<string, ChangeDetectionStatus | undefined>;
type StoryStatusMap = Record<string, StoryStatusByType>;

type ChangedStory = {
	storyId: string;
	title?: string;
	name?: string;
	importPath?: string;
	statusValue: string;
};

function readAllStatuses(statusStore: unknown): unknown {
	if (statusStore && typeof statusStore === 'object') {
		const candidate = statusStore as Record<string, unknown>;
		if (typeof candidate.getAllStatuses === 'function') {
			return (candidate.getAllStatuses as () => unknown)();
		}

		if (typeof candidate.getAll === 'function') {
			return (candidate.getAll as () => unknown)();
		}

		if (candidate.allStatuses) {
			return candidate.allStatuses;
		}
	}
	throw new Error('Storybook status store does not expose a readable all-statuses API');
}

function normalizeStoryStatusMap(rawStatuses: unknown): StoryStatusMap {
	if (!rawStatuses || typeof rawStatuses !== 'object') {
		return {};
	}

	const normalized: StoryStatusMap = {};
	for (const [storyId, value] of Object.entries(rawStatuses as Record<string, unknown>)) {
		if (!value || typeof value !== 'object') {
			continue;
		}

		const maybeSingleStatus = value as ChangeDetectionStatus;
		if (typeof maybeSingleStatus.value === 'string') {
			normalized[storyId] = { [CHANGE_DETECTION_TYPE]: maybeSingleStatus };
			continue;
		}

		normalized[storyId] = value as StoryStatusByType;
	}

	return normalized;
}

function statusPriority(statusValue: string): number {
	if (statusValue === 'status-value:new') return 0;
	if (statusValue === 'status-value:modified') return 1;
	return 2;
}

function getStatusStore(): unknown {
	const getter = experimental_getStatusStore as unknown as (...args: unknown[]) => unknown;
	try {
		return getter();
	} catch {
		return getter(CHANGE_DETECTION_TYPE);
	}
}

export async function addGetChangedStoriesTool(server: McpServer<unknown, AddonContext>) {
	server.tool(
		{
			name: GET_CHANGED_STORIES_TOOL_NAME,
			title: 'Get changed stories metadata',
			description: `Get Storybook stories marked as new, modified, or affected.
Returns story metadata only (no URLs).`,
			enabled: () => server.ctx.custom?.toolsets?.dev ?? true,
		},
		async () => {
			try {
				const { origin, disableTelemetry } = server.ctx.custom ?? {};
				if (!origin) {
					throw new Error('Origin is required in addon context');
				}

				const statusStore = getStatusStore();
				const allStatuses = normalizeStoryStatusMap(readAllStatuses(statusStore));
				const index = await fetchStoryIndex(origin);

				const stories: ChangedStory[] = [];
				for (const [storyId, byType] of Object.entries(allStatuses)) {
					const status = byType?.[CHANGE_DETECTION_TYPE];
					const statusValue = status?.value;
					if (!statusValue || !INCLUDED_STATUS_VALUES.has(statusValue)) {
						continue;
					}

					const entry = index.entries[storyId];
					stories.push({
						storyId,
						title: entry?.title,
						name: entry?.name,
						importPath: entry?.importPath,
						statusValue,
					});
				}

				stories.sort((a, b) => {
					const priorityDelta = statusPriority(a.statusValue) - statusPriority(b.statusValue);
					return priorityDelta !== 0 ? priorityDelta : a.storyId.localeCompare(b.storyId);
				});

				const buckets = {
					new: stories.filter((story) => story.statusValue === 'status-value:new'),
					modified: stories.filter((story) => story.statusValue === 'status-value:modified'),
					affected: stories.filter((story) => story.statusValue === 'status-value:affected'),
				};
				const counts = {
					new: buckets.new.length,
					modified: buckets.modified.length,
					affected: buckets.affected.length,
				};

				if (!disableTelemetry) {
					await collectTelemetry({
						event: 'tool:getChangedStories',
						server,
						toolset: 'dev',
						storyCount: stories.length,
						newStoryCount: counts.new,
						modifiedStoryCount: counts.modified,
						affectedStoryCount: counts.affected,
					});
				}

				let text =
					stories.length === 0
						? 'No new, modified, or affected stories detected.'
						: `Detected ${stories.length} changed stor${stories.length === 1 ? 'y' : 'ies'} (${counts.new} new, ${counts.modified} modified, ${counts.affected} affected).`;

				const serializeStory = (story: ChangedStory) =>
					story.title && story.name && story.importPath
						? `- \`${story.storyId}\`: ${story.title} / ${story.name} (\`${story.importPath}\`)`
						: `- \`${story.storyId}\``;

				if (buckets.new.length > 0) {
					text += `\n\nNew stories:\n`;
					text += buckets.new.map(serializeStory).join('\n');
				}
				if (buckets.modified.length > 0) {
					text += `\n\nModified stories:\n`;
					text += buckets.modified.map(serializeStory).join('\n');
				}
				if (buckets.affected.length > 0) {
					text += `\n\nAffected stories:\n`;
					text += buckets.affected.map(serializeStory).join('\n');
				}

				return { content: [{ type: 'text' as const, text }] };
			} catch (error) {
				return errorToMCPContent(error);
			}
		},
	);
}

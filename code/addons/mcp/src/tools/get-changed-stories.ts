import type { McpServer } from 'tmcp';
import { experimental_getStatusStore } from 'storybook/internal/core-server';
import { collectTelemetry } from '../telemetry.ts';
import type { AddonContext } from '../types.ts';
import { errorToMCPContent } from '../utils/errors.ts';
import { fetchStoryIndex } from '../utils/fetch-story-index.ts';
import { GET_CHANGED_STORIES_TOOL_NAME } from './tool-names.ts';

const CHANGE_DETECTION_TYPE = 'storybook/change-detection';
const INCLUDED_STATUS_VALUES = new Set<StatusValue>([
	'status-value:new',
	'status-value:modified',
	'status-value:affected',
]);

type StatusValue =
	| 'status-value:pending'
	| 'status-value:success'
	| 'status-value:new'
	| 'status-value:modified'
	| 'status-value:affected'
	| 'status-value:warning'
	| 'status-value:error'
	| 'status-value:unknown';

type StatusesByStoryIdAndTypeId = Record<string, Record<string, Status>>;

interface Status {
	value: StatusValue;
	typeId: string;
	storyId: string;
	title: string;
	description: string;
	data?: any;
	sidebarContextMenu?: boolean;
}

interface ChangedStory {
	storyId: string;
	statusValue: StatusValue;
	title: string;
	name: string;
	importPath: string;
}

function statusPriority(statusValue: StatusValue): number {
	if (statusValue === 'status-value:new') return 0;
	if (statusValue === 'status-value:modified') return 1;
	return 2;
}

export async function addGetChangedStoriesTool(server: McpServer<any, AddonContext>) {
	server.tool(
		{
			name: GET_CHANGED_STORIES_TOOL_NAME,
			title: 'Get changed stories metadata',
			description: `Get Storybook stories marked as new, modified, or related. Returns story metadata only (no URLs).`,
			enabled: () => server.ctx.custom?.toolsets?.dev ?? true,
		},
		async () => {
			try {
				const { origin, disableTelemetry } = server.ctx.custom ?? {};
				if (!origin) {
					throw new Error('Origin is required in addon context');
				}

				const statusStore = experimental_getStatusStore(CHANGE_DETECTION_TYPE);
				const allStatuses = statusStore.getAll() as StatusesByStoryIdAndTypeId;
				const changedStoriesFromStatusStore: Status[] = [];
				for (const byType of Object.values(allStatuses)) {
					const status = byType?.[CHANGE_DETECTION_TYPE];
					if (status?.value && INCLUDED_STATUS_VALUES.has(status.value)) {
						changedStoriesFromStatusStore.push(status);
					}
				}

				if (changedStoriesFromStatusStore.length === 0) {
					if (!disableTelemetry) {
						await collectTelemetry({
							event: 'tool:getChangedStories',
							server,
							toolset: 'dev',
							storyCount: 0,
							newStoryCount: 0,
							modifiedStoryCount: 0,
							affectedStoryCount: 0,
						});
					}

					return {
						content: [
							{ type: 'text' as const, text: 'No new, modified, or related stories detected.' },
						],
					};
				}

				const index = await fetchStoryIndex(origin);
				const stories = changedStoriesFromStatusStore.flatMap<ChangedStory>(
					({ storyId, value }) => {
						const entry = index.entries[storyId];
						if (!entry) {
							return [];
						}
						return [
							{
								storyId,
								statusValue: value,
								title: entry.title,
								name: entry.name,
								importPath: entry.importPath,
							},
						];
					},
				);

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

				let text = `Detected ${stories.length} changed stor${stories.length === 1 ? 'y' : 'ies'} (${counts.new} new, ${counts.modified} modified, ${counts.affected} related).`;

				const serializeStory = ({ storyId, title, name, importPath }: ChangedStory) =>
					`- \`${storyId}\`: ${title} / ${name} (\`${importPath}\`)`;

				if (buckets.new.length > 0) {
					text += `\n\nNew stories:\n`;
					text += buckets.new.map(serializeStory).join('\n');
				}
				if (buckets.modified.length > 0) {
					text += `\n\nModified stories:\n`;
					text += buckets.modified.map(serializeStory).join('\n');
				}
				if (buckets.affected.length > 0) {
					text += `\n\nRelated stories:\n`;
					text += buckets.affected.map(serializeStory).join('\n');
				}

				return { content: [{ type: 'text' as const, text }] };
			} catch (error) {
				return errorToMCPContent(error);
			}
		},
	);
}

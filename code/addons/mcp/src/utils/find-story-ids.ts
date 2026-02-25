import path from 'node:path';
import { normalizeStoryPath } from 'storybook/internal/common';
import { storyNameFromExport } from 'storybook/internal/csf';
import { logger } from 'storybook/internal/node-logger';
import type { StoryIndex } from 'storybook/internal/types';
import type { StoryInput } from '../types.ts';
import { slash } from './slash.ts';

export interface FoundStory {
	id: string;
	input: StoryInput;
}

export interface NotFoundStory {
	input: StoryInput;
	errorMessage: string;
}

export type FindStoryIdsResult = FoundStory | NotFoundStory;

function isStoryIdInput(input: StoryInput): input is StoryInput & { storyId: string } {
	return 'storyId' in input;
}

// Keep normalization consistent with Storybook core importPath handling:
// https://github.com/storybookjs/storybook/blob/next/code/core/src/core-server/utils/StoryIndexGenerator.ts#L403
// https://github.com/storybookjs/storybook/blob/next/code/core/src/core-server/utils/StoryIndexGenerator.ts#L434-L441
function normalizeImportPath(importPath: string): string {
	const normalized = path.posix.normalize(slash(importPath));
	return slash(normalizeStoryPath(normalized));
}

/**
 * Finds story IDs in the story index that match the given story inputs.
 *
 * @param index - The Storybook story index
 * @param stories - Array of story inputs to search for
 * @returns Array of per-input lookup results in the exact same order as the input stories
 */
export function findStoryIds(index: StoryIndex, stories: StoryInput[]): FindStoryIdsResult[] {
	const entriesList = Object.values(index.entries);
	const result: FindStoryIdsResult[] = [];

	for (const storyInput of stories) {
		if (isStoryIdInput(storyInput)) {
			const foundEntry = index.entries[storyInput.storyId];

			if (foundEntry) {
				logger.debug(`Found story ID: ${foundEntry.id}`);
				result.push({
					id: foundEntry.id,
					input: storyInput,
				});
			} else {
				logger.debug('No story found');
				result.push({
					input: storyInput,
					errorMessage: `No story found for story ID "${storyInput.storyId}"`,
				});
			}

			continue;
		}

		const { exportName, explicitStoryName, absoluteStoryPath } = storyInput;
		const normalizedCwd = slash(process.cwd());
		const normalizedAbsolutePath = slash(absoluteStoryPath);
		const relativePath = normalizeImportPath(
			path.posix.relative(normalizedCwd, normalizedAbsolutePath),
		);

		logger.debug('Searching for:');
		logger.debug({
			exportName,
			explicitStoryName,
			absoluteStoryPath,
			relativePath,
		});

		const foundEntry = entriesList.find(
			(entry) =>
				normalizeImportPath(entry.importPath) === relativePath &&
				[explicitStoryName, storyNameFromExport(exportName)].includes(entry.name),
		);

		if (foundEntry) {
			logger.debug(`Found story ID: ${foundEntry.id}`);
			result.push({
				id: foundEntry.id,
				input: storyInput,
			});
		} else {
			logger.debug('No story found');
			let errorMessage = `No story found for export name "${exportName}" with absolute file path "${absoluteStoryPath}"`;
			if (!explicitStoryName) {
				errorMessage += ` (did you forget to pass the explicit story name?)`;
			}
			result.push({
				input: storyInput,
				errorMessage,
			});
		}
	}

	return result;
}

import path from 'node:path';
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

export interface FindStoryIdsResult {
	found: FoundStory[];
	notFound: NotFoundStory[];
}

/**
 * Finds story IDs in the story index that match the given story inputs.
 *
 * @param index - The Storybook story index
 * @param stories - Array of story inputs to search for
 * @returns Object containing found stories with their IDs and not-found stories with error messages
 */
export function findStoryIds(index: StoryIndex, stories: StoryInput[]): FindStoryIdsResult {
	const entriesList = Object.values(index.entries);
	const result: FindStoryIdsResult = {
		found: [],
		notFound: [],
	};

	for (const storyInput of stories) {
		const { exportName, explicitStoryName, absoluteStoryPath } = storyInput;
		const normalizedCwd = slash(process.cwd());
		const normalizedAbsolutePath = slash(absoluteStoryPath);
		const relativePath = `./${path.posix.relative(normalizedCwd, normalizedAbsolutePath)}`;

		logger.debug('Searching for:');
		logger.debug({
			exportName,
			explicitStoryName,
			absoluteStoryPath,
			relativePath,
		});

		const foundEntry = entriesList.find(
			(entry) =>
				entry.importPath === relativePath &&
				[explicitStoryName, storyNameFromExport(exportName)].includes(entry.name),
		);

		if (foundEntry) {
			logger.debug(`Found story ID: ${foundEntry.id}`);
			result.found.push({
				id: foundEntry.id,
				input: storyInput,
			});
		} else {
			logger.debug('No story found');
			let errorMessage = `No story found for export name "${exportName}" with absolute file path "${absoluteStoryPath}"`;
			if (!explicitStoryName) {
				errorMessage += ` (did you forget to pass the explicit story name?)`;
			}
			result.notFound.push({
				input: storyInput,
				errorMessage,
			});
		}
	}

	return result;
}

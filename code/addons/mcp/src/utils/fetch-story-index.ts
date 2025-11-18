import type { StoryIndex } from 'storybook/internal/types';
import { logger } from 'storybook/internal/node-logger';

/**
 * Fetches the Storybook story index from the running Storybook instance.
 *
 * @param origin - The origin URL of the Storybook instance (e.g., http://localhost:6006)
 * @returns A promise that resolves to the StoryIndex
 * @throws If the fetch fails or returns invalid data
 */
export async function fetchStoryIndex(origin: string): Promise<StoryIndex> {
	const indexUrl = `${origin}/index.json`;

	logger.debug('Fetching story index from:', indexUrl);

	const response = await fetch(indexUrl);

	if (!response.ok) {
		throw new Error(
			`Failed to fetch story index: ${response.status} ${response.statusText}`,
		);
	}

	const index = (await response.json()) as StoryIndex;

	logger.debug('Story index entries found:', Object.keys(index.entries).length);

	return index;
}

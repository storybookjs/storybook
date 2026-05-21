import type { StoryIndex } from 'storybook/internal/types';
import { logger } from 'storybook/internal/node-logger';

/**
 * Fetches the Storybook story index from the running Storybook instance.
 *
 * Retries transient 5xx responses with a short backoff — these are common
 * right after a story or preview file is edited because Vite is mid-
 * recompile and the dev server hasn't repopulated the index yet. We don't
 * want to give up after one shot when waiting a second would have worked.
 *
 * On failure (after retries), throws an Error whose message includes
 * status + statusText + a truncated snippet of the response body so the
 * caller has something actionable instead of a bare `500 Internal Server
 * Error`.
 *
 * @param origin - The origin URL of the Storybook instance (e.g., http://localhost:6006)
 * @param options - Optional retry tuning. Defaults: 3 attempts total, 500ms base backoff.
 * @returns A promise that resolves to the StoryIndex
 * @throws If the fetch fails or returns invalid data after all retries
 */
export interface FetchStoryIndexOptions {
	/** Total attempts including the first. Default 3. */
	maxAttempts?: number;
	/** Base backoff in ms; each attempt waits `attempt * baseBackoffMs`. Default 500. */
	baseBackoffMs?: number;
	/**
	 * Injected for tests so we don't sleep for real. Defaults to setTimeout.
	 */
	sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_BACKOFF_MS = 500;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function isTransientStatus(status: number): boolean {
	// 5xx are usually transient (server mid-recompile, restarting, etc).
	// 408 (timeout) and 429 (too many requests) are also worth retrying.
	return status >= 500 || status === 408 || status === 429;
}

async function readBodySnippet(response: Response, maxChars = 200): Promise<string> {
	try {
		const text = await response.text();
		const collapsed = text.replace(/\s+/g, ' ').trim();
		if (collapsed.length === 0) return '';
		return collapsed.length <= maxChars ? collapsed : collapsed.slice(0, maxChars - 1) + '…';
	} catch {
		return '';
	}
}

export async function fetchStoryIndex(
	origin: string,
	options: FetchStoryIndexOptions = {},
): Promise<StoryIndex> {
	const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
	const baseBackoffMs = options.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
	const sleep = options.sleep ?? defaultSleep;
	const indexUrl = `${origin}/index.json`;

	logger.debug(`Fetching story index from: ${indexUrl}`);

	let lastErrorMessage = '';
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const response = await fetch(indexUrl);

		if (response.ok) {
			const index = (await response.json()) as StoryIndex;
			logger.debug(`Story index entries found: ${Object.keys(index.entries).length}`);
			return index;
		}

		const snippet = await readBodySnippet(response);
		const transient = isTransientStatus(response.status);
		const baseMsg =
			`Failed to fetch story index: ${response.status} ${response.statusText}` +
			(snippet ? ` — ${snippet}` : '');
		lastErrorMessage =
			`${baseMsg} (attempt ${attempt}/${maxAttempts}` +
			(transient ? ', transient — Storybook may be mid-recompile' : ', non-transient — giving up') +
			')';
		logger.debug(lastErrorMessage);

		if (!transient || attempt === maxAttempts) break;

		await sleep(attempt * baseBackoffMs);
	}

	throw new Error(lastErrorMessage || `Failed to fetch story index after ${maxAttempts} attempts`);
}

import { ComponentManifestMap } from '../types.ts';
import * as v from 'valibot';

/**
 * Error thrown when fetching or parsing a manifest fails
 */
export class ManifestFetchError extends Error {
	public readonly url: string;
	public readonly cause?: Error;

	constructor(message: string, url?: string, cause?: Error) {
		super(message);
		this.name = 'ManifestFetchError';
		this.url = url ?? 'No source URL provided';
		this.cause = cause;
	}
}

/**
 * MCP tool result type for error responses
 */
type MCPErrorResult = {
	content: Array<{ type: 'text'; text: string }>;
	isError: true;
};

/**
 * Converts an error to MCP-compatible content format
 *
 * @param error - The error to convert (can be any type)
 * @returns A tool result with error content and isError flag
 */
export const errorToMCPContent = (error: unknown): MCPErrorResult => {
	const errorPrefix =
		error instanceof ManifestFetchError
			? 'Error fetching manifest'
			: 'Unexpected error';
	const errorMessage = error instanceof Error ? error.message : String(error);

	// Include cause information if available
	let fullMessage = `${errorPrefix}: ${errorMessage}`;
	if (error instanceof ManifestFetchError && error.cause) {
		const causeMessage =
			error.cause instanceof Error ? error.cause.message : String(error.cause);
		fullMessage += `\nCaused by: ${causeMessage}`;
	}

	return {
		content: [
			{
				type: 'text',
				text: fullMessage,
			},
		],
		isError: true,
	};
};

/**
 * Fetches a component manifest from a remote URL
 *
 * @param url - The URL to fetch the manifest from
 * @returns A promise that resolves to the parsed ComponentManifestMap
 * @throws {ManifestFetchError} If the fetch fails or the response is invalid
 */
export async function fetchManifest(
	url?: string,
): Promise<ComponentManifestMap> {
	try {
		if (!url) {
			throw new ManifestFetchError(
				'The source URL is required, but was not part of the request context nor was a default source for the server set',
			);
		}

		const response = await fetch(url);

		if (!response.ok) {
			throw new ManifestFetchError(
				`Failed to fetch manifest: ${response.status} ${response.statusText}`,
				url,
			);
		}

		const contentType = response.headers.get('content-type');
		if (!contentType?.includes('application/json')) {
			throw new ManifestFetchError(
				`Invalid content type: expected application/json, got ${contentType}`,
				url,
			);
		}

		const data: unknown = await response.json();
		const manifest = v.parse(ComponentManifestMap, data);

		if (Object.keys(manifest.components).length === 0) {
			throw new ManifestFetchError(`No components found in the manifest`, url);
		}

		return manifest;
	} catch (error) {
		if (error instanceof ManifestFetchError) {
			throw error;
		}

		// Wrap network errors and other unexpected errors
		throw new ManifestFetchError(
			`Failed to fetch manifest: ${error instanceof Error ? error.message : String(error)}`,
			url,
			error instanceof Error ? error : undefined,
		);
	}
}

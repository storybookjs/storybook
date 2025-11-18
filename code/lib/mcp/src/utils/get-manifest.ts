import { ComponentManifestMap } from '../types.ts';
import * as v from 'valibot';

/**
 * Error thrown when getting or parsing a manifest fails
 */
export class ManifestGetError extends Error {
	public readonly url: string;
	public override readonly cause?: Error;

	constructor(message: string, url?: string, cause?: Error) {
		super(message);
		this.name = 'ManifestGetError';
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
		error instanceof ManifestGetError
			? 'Error getting manifest'
			: 'Unexpected error';
	const errorMessage = error instanceof Error ? error.message : String(error);

	// Include cause information if available
	let fullMessage = `${errorPrefix}: ${errorMessage}`;
	if (error instanceof ManifestGetError && error.cause) {
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
 * Gets a component manifest from a remote URL or using a custom provider
 *
 * @param url - The URL to get the manifest from
 * @param manifestProvider - Optional custom function to get the manifest
 * @returns A promise that resolves to the parsed ComponentManifestMap
 * @throws {ManifestGetError} If getting the manifest fails or the response is invalid
 */
export async function getManifest(
	url?: string,
	manifestProvider?: (source: string) => Promise<string>,
): Promise<ComponentManifestMap> {
	try {
		if (!url) {
			throw new ManifestGetError(
				'The source URL is required, but was not part of the request context nor was a default source for the server set',
			);
		}

		// Use custom manifestProvider if provided, otherwise fallback to fetch
		const manifestString = await (
			manifestProvider ?? defaultFetchManifestProvider
		)(url);
		const manifestData: unknown = JSON.parse(manifestString);

		const manifest = v.parse(ComponentManifestMap, manifestData);

		if (Object.keys(manifest.components).length === 0) {
			throw new ManifestGetError(`No components found in the manifest`, url);
		}

		return manifest;
	} catch (error) {
		if (error instanceof ManifestGetError) {
			throw error;
		}

		// Wrap network errors and other unexpected errors
		throw new ManifestGetError(
			`Failed to get manifest: ${error instanceof Error ? error.message : String(error)}`,
			url,
			error instanceof Error ? error : undefined,
		);
	}
}

async function defaultFetchManifestProvider(source: string): Promise<string> {
	const response = await fetch(source);

	if (!response.ok) {
		throw new ManifestGetError(
			`Failed to fetch manifest: ${response.status} ${response.statusText}`,
			source,
		);
	}

	const contentType = response.headers.get('content-type');
	if (!contentType?.includes('application/json')) {
		throw new ManifestGetError(
			`Invalid content type: expected application/json, got ${contentType}`,
			source,
		);
	}
	return response.text();
}

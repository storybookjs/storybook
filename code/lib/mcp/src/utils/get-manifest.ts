import {
	ComponentManifestMap,
	DocsManifestMap,
	type AllManifests,
} from '../types.ts';
import * as v from 'valibot';

/**
 * The paths to the manifest files relative to the Storybook build
 */
export const COMPONENT_MANIFEST_PATH = './manifests/components.json';
export const DOCS_MANIFEST_PATH = './manifests/docs.json';

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
 * Parses a JSON string and validates it against a Valibot schema
 */
function parseManifest<
	T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
>({
	jsonString,
	schema,
	name,
	url,
}: {
	jsonString: string;
	schema: T;
	name: string;
	url: string;
}): v.InferOutput<T> {
	try {
		return v.parse(v.pipe(v.string(), v.parseJson(), schema), jsonString);
	} catch (error) {
		throw new ManifestGetError(
			`Failed to parse ${name} manifest:
${error instanceof v.ValiError ? error.issues.map((i) => i.message).join('\n') : String(error)}`,
			url,
		);
	}
}

/**
 * Gets component and docs manifest from a request or using a custom provider
 *
 * @param request - The HTTP request to get the manifest for (optional when using custom manifestProvider)
 * @param manifestProvider - Optional custom function to get the manifest
 * @returns A promise that resolves to the parsed ComponentManifestMap
 * @throws {ManifestGetError} If getting the manifest fails or the response is invalid
 */
export async function getManifests(
	request?: Request,
	manifestProvider?: (
		request: Request | undefined,
		path: string,
	) => Promise<string>,
): Promise<AllManifests> {
	const provider = manifestProvider ?? defaultManifestProvider;

	// Fetch both component and docs manifests in parallel
	const [componentResult, docsResult] = await Promise.allSettled([
		provider(request, COMPONENT_MANIFEST_PATH),
		provider(request, DOCS_MANIFEST_PATH),
	]);

	const getUrl = (path: string) =>
		request
			? getManifestUrlFromRequest(request, path)
			: 'Unknown manifest source';

	if (componentResult.status === 'rejected') {
		throw new ManifestGetError(
			`Failed to get component manifest: ${componentResult.reason instanceof Error ? componentResult.reason.message : String(componentResult.reason)}`,
			getUrl(COMPONENT_MANIFEST_PATH),
			componentResult.reason instanceof Error
				? componentResult.reason
				: undefined,
		);
	}

	const componentManifest = parseManifest({
		jsonString: componentResult.value,
		schema: ComponentManifestMap,
		name: 'component',
		url: getUrl(COMPONENT_MANIFEST_PATH),
	});

	if (Object.keys(componentManifest.components).length === 0) {
		throw new ManifestGetError(
			`No components found in the manifest`,
			getUrl(COMPONENT_MANIFEST_PATH),
		);
	}

	if (docsResult.status === 'rejected') {
		return { componentManifest };
	}

	// Handle docs manifest result (optional - only exists when addon-docs is used)
	const docsManifest = parseManifest({
		jsonString: docsResult.value,
		schema: DocsManifestMap,
		name: 'docs',
		url: getUrl(DOCS_MANIFEST_PATH),
	});

	return { componentManifest, docsManifest };
}

/**
 * Constructs the manifest URL from a request by replacing /mcp with the provided path
 */
function getManifestUrlFromRequest(request: Request, path: string): string {
	const url = new URL(request.url);
	// Replace /mcp endpoint with the provided path (e.g., './manifests/components.json')
	// Remove leading './' from path if present
	const normalizedPath = path.replace(/^\.\//, '');
	url.pathname = url.pathname.replace(/\/mcp\/?$/, `/${normalizedPath}`);
	return url.toString();
}

/**
 * Default manifest provider that fetches from the same origin as the request,
 * replacing /mcp with the provided path
 */
async function defaultManifestProvider(
	request: Request | undefined,
	path: string,
): Promise<string> {
	if (!request) {
		throw new ManifestGetError(
			"Request is required when using the default manifest provider. You must either pass the original request forward to the server context, or set a custom manifestProvider that doesn't need the request.",
		);
	}
	const manifestUrl = getManifestUrlFromRequest(request, path);
	const response = await fetch(manifestUrl);

	if (!response.ok) {
		throw new ManifestGetError(
			`Failed to fetch manifest: ${response.status} ${response.statusText}`,
			manifestUrl,
		);
	}

	const contentType = response.headers.get('content-type');
	if (!contentType?.includes('application/json')) {
		throw new ManifestGetError(
			`Invalid content type: expected application/json, got ${contentType}`,
			manifestUrl,
		);
	}
	return response.text();
}

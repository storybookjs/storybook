import {
	ComponentManifest,
	ComponentManifestMap,
	DocsManifestMap,
	type AllManifests,
	type Source,
	type SourceManifests,
} from '../types.ts';
import * as v from 'valibot';
import { formatRequiresOwnMcpNotice, getSourceMcpEndpoint } from './requires-own-mcp.ts';

type SourceWithUrl = Source & { url: string };

type ManifestProvider = (
	request: Request | undefined,
	path: string,
	source?: Source,
) => Promise<string>;

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

export class RequiresOwnMcpError extends Error {
	public readonly source: SourceWithUrl;
	public readonly endpoint: string;

	constructor(source: SourceWithUrl) {
		const endpoint = getSourceMcpEndpoint(source);
		super(`Composed Storybook "${source.title}" requires its own MCP endpoint: ${endpoint}`);
		this.name = 'RequiresOwnMcpError';
		this.source = source;
		this.endpoint = endpoint;
	}
}

/**
 * MCP tool result type for text responses
 */
type MCPTextResult = {
	content: Array<{ type: 'text'; text: string }>;
	isError?: true;
};

/**
 * Converts an error to MCP-compatible content format
 *
 * @param error - The error to convert (can be any type)
 * @returns A tool result with error content and isError flag
 */
export const errorToMCPContent = (error: unknown): MCPTextResult => {
	if (error instanceof RequiresOwnMcpError) {
		return {
			content: [
				{
					type: 'text',
					text: formatRequiresOwnMcpNotice(error.source, error.endpoint),
				},
			],
		};
	}

	const errorPrefix =
		error instanceof ManifestGetError ? 'Error getting manifest' : 'Unexpected error';
	const errorMessage = error instanceof Error ? error.message : String(error);

	// Include cause information if available
	let fullMessage = `${errorPrefix}: ${errorMessage}`;
	if (error instanceof ManifestGetError && error.cause) {
		const causeMessage = error.cause instanceof Error ? error.cause.message : String(error.cause);
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
function parseManifest<T extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>({
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
 * @param source - Optional source for multi-source mode
 * @returns A promise that resolves to the parsed ComponentManifestMap
 * @throws {ManifestGetError} If getting the manifest fails or the response is invalid
 */
export async function getManifests(
	request?: Request,
	manifestProvider?: (
		request: Request | undefined,
		path: string,
		source?: Source,
	) => Promise<string>,
	source?: Source,
): Promise<AllManifests> {
	const provider = manifestProvider ?? defaultManifestProvider;

	// Fetch both component and docs manifests in parallel
	const [componentResult, docsResult] = await Promise.allSettled([
		provider(request, COMPONENT_MANIFEST_PATH, source),
		provider(request, DOCS_MANIFEST_PATH, source),
	]);

	const getUrl = (path: string) =>
		request ? getManifestUrlFromRequest(request, path) : 'Unknown manifest source';

	if (componentResult.status === 'rejected') {
		const reason = componentResult.reason;
		if (reason instanceof RequiresOwnMcpError) {
			throw reason;
		}
		const is404 = reason instanceof ManifestGetError && reason.message.includes('404');
		const hint = is404
			? `\nHint: The Storybook at this URL may not have the component manifest enabled. Add \`features: { componentsManifest: true }\` (or \`features: { experimentalComponentsManifest: true }\` for older Storybook versions) to its main.ts config.`
			: '';
		throw new ManifestGetError(
			`Failed to get component manifest: ${reason instanceof Error ? reason.message : String(reason)}${hint}`,
			getUrl(COMPONENT_MANIFEST_PATH),
			reason instanceof Error ? reason : undefined,
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
 * Resolves a docgen `$ref` into the provider path of the referenced file and the
 * JSON-pointer segments into it.
 *
 * The `$ref` file path is relative to the component manifest's location, e.g.
 * `"../services/core/docgen/button.json#/components/button"` from
 * `./manifests/components.json` resolves to `./services/core/docgen/button.json`
 * with pointer `["components", "button"]`.
 */
export function parseDocgenRef(ref: string): { path: string; pointer: string[] } {
	const [filePath = '', hash = ''] = ref.split('#');

	// Directory of the component manifest (e.g. "manifests/"), used as the base for
	// resolving the (possibly `../`-prefixed) relative file path.
	const manifestDir = COMPONENT_MANIFEST_PATH.replace(/^\.\//, '').replace(/[^/]+$/, '');
	const resolved = new URL(filePath, `https://localhost/${manifestDir}`).pathname.replace(/^\//, '');

	const pointer = hash
		.split('/')
		.filter(Boolean)
		.map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));

	return { path: `./${resolved}`, pointer };
}

/**
 * Resolves a stub component (externalized-docgen manifest format) into a full
 * component manifest by fetching the referenced docgen file and reading the
 * pointed-to entry. Components without a `docgen.$ref` are returned unchanged.
 */
export async function resolveComponentDocgen(
	component: ComponentManifest,
	request?: Request,
	manifestProvider?: ManifestProvider,
	source?: Source,
): Promise<ComponentManifest> {
	const ref = component.docgen?.$ref;
	if (!ref) {
		return component;
	}

	const { path, pointer } = parseDocgenRef(ref);
	const provider = manifestProvider ?? defaultManifestProvider;
	const jsonString = await provider(request, path, source);

	let target: unknown;
	try {
		target = JSON.parse(jsonString);
	} catch (error) {
		throw new ManifestGetError(
			`Failed to parse externalized docgen referenced by "${ref}"`,
			path,
			error instanceof Error ? error : undefined,
		);
	}

	for (const key of pointer) {
		if (target && typeof target === 'object' && key in (target as Record<string, unknown>)) {
			target = (target as Record<string, unknown>)[key];
		} else {
			throw new ManifestGetError(
				`Docgen reference "${ref}" could not be resolved: missing "${key}".`,
				path,
			);
		}
	}

	const resolved = parseManifest({
		jsonString: JSON.stringify(target),
		schema: ComponentManifest,
		name: 'component docgen',
		url: path,
	});

	// Stub fields (id/name/description) are authoritative for identity; the resolved
	// entry supplies path/stories/docgen data.
	return { ...component, ...resolved };
}

/**
 * Constructs the manifest URL from the request origin and the top-level manifest path.
 */
function getManifestUrlFromRequest(request: Request, path: string): string {
	const normalizedPath = path.replace(/^\.\//, '');
	return new URL(`/${normalizedPath}`, request.url).toString();
}

/**
 * Default manifest provider that fetches from the same origin as the request,
 * using Storybook's top-level manifest path.
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

/**
 * Gets manifests from multiple sources.
 * Returns an array of source manifests, each containing the source info and its manifests.
 * Failures for individual sources are captured as errors rather than failing the entire request.
 *
 * @param sources - Array of source configurations
 * @param request - The HTTP request (used for local source)
 * @param manifestProvider - Function to fetch manifests, receives source as third parameter
 * @returns Promise resolving to array of source manifests
 * @throws {ManifestGetError} If no sources could be fetched successfully
 */
export async function getMultiSourceManifests(
	sources: Source[],
	request?: Request,
	manifestProvider?: (
		request: Request | undefined,
		path: string,
		source?: Source,
	) => Promise<string>,
): Promise<SourceManifests[]> {
	// Fetch all sources in parallel
	const results = await Promise.all(
		sources.map(async (source) => {
			try {
				const manifests = await getManifests(request, manifestProvider, source);
				return {
					source,
					componentManifest: manifests.componentManifest,
					docsManifest: manifests.docsManifest,
				};
			} catch (error) {
				// Capture error but don't fail the entire request
				if (error instanceof RequiresOwnMcpError) {
					return {
						source,
						componentManifest: { v: 1, components: {} },
						notice: {
							kind: 'requires-own-mcp' as const,
							endpoint: error.endpoint,
						},
					};
				}
				const errorMessage = error instanceof Error ? error.message : String(error);
				return {
					source,
					componentManifest: { v: 1, components: {} },
					error: errorMessage,
				};
			}
		}),
	);

	// Check if at least one source produced useful tool output.
	const successCount = results.filter((r) => !r.error && !r.notice).length;
	const noticeCount = results.filter((r) => r.notice).length;
	if (successCount === 0 && noticeCount === 0) {
		throw new ManifestGetError(
			`Failed to fetch manifests from any source. Errors:\n${results.map((r) => `- ${r.source.title}: ${r.error}`).join('\n')}`,
		);
	}

	return results;
}

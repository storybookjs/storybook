import {
  ComponentManifestMap,
  DocsManifestMap,
  type AllManifests,
  type ComponentManifest,
  type ComponentManifestEntry,
  type CoreDocgenComponent,
  type CoreDocgenPayload,
  type CoreMdxDoc,
  type CoreStoryDocsPayload,
  type Doc,
  type DocEntry,
  type Source,
  type SourceManifests,
} from '../types.ts';
import * as v from 'valibot';
import { adaptCoreComponent, adaptCoreDoc, adaptCoreStories } from './adapt-core-manifest.ts';
import { formatRequiresOwnMcpNotice, getSourceMcpEndpoint } from './requires-own-mcp.ts';

type SourceWithUrl = Source & { url: string };

type ManifestProvider = (
  request: Request | undefined,
  path: string,
  source?: Source
) => Promise<string>;

/**
 * The paths to the manifest files relative to the Storybook build
 */
export const COMPONENT_MANIFEST_PATH = './manifests/components.json';
export const DOCS_MANIFEST_PATH = './manifests/docs.json';

/** Empty placeholder manifest used for sources that errored or need their own MCP endpoint. */
const EMPTY_COMPONENT_MANIFEST: ComponentManifestMap = { v: 1, components: {} };

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
      url
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
    source?: Source
  ) => Promise<string>,
  source?: Source
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
      reason instanceof Error ? reason : undefined
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
      getUrl(COMPONENT_MANIFEST_PATH)
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
 * Resolves a `$ref` into the provider path of the referenced file and the
 * JSON-pointer segments into it.
 *
 * The `$ref` file path is relative to the component manifest's location, e.g.
 * `"../services/core/docgen/button.json#/components/button"` from
 * `./manifests/components.json` resolves to `./services/core/docgen/button.json`
 * with pointer `["components", "button"]`. The same base (`manifests/`) applies to
 * docgen, story-docs and MDX refs.
 */
export function parseManifestRef(ref: string): { path: string; pointer: string[] } {
  const [filePath = '', hash = ''] = ref.split('#');

  // Directory of the component manifest (e.g. "manifests/"), used as the base for
  // resolving the (possibly `../`-prefixed) relative file path.
  const manifestDir = COMPONENT_MANIFEST_PATH.replace(/^\.\//, '').replace(/[^/]+$/, '');
  const resolved = new URL(filePath, `https://localhost/${manifestDir}`).pathname.replace(
    /^\//,
    ''
  );

  const pointer = hash
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));

  return { path: `./${resolved}`, pointer };
}

/**
 * Fetches the file a `$ref` points at (verbatim — never a fabricated path) and
 * walks its JSON pointer, returning the pointed-to value.
 */
async function fetchRefValue<T>(
  ref: string,
  request: Request | undefined,
  provider: ManifestProvider,
  source: Source | undefined
): Promise<T> {
  const { path, pointer } = parseManifestRef(ref);
  const jsonString = await provider(request, path, source);

  let target: unknown;
  try {
    target = JSON.parse(jsonString);
  } catch (error) {
    throw new ManifestGetError(
      `Failed to parse externalized payload referenced by "${ref}"`,
      path,
      error instanceof Error ? error : undefined
    );
  }

  for (const key of pointer) {
    if (target && typeof target === 'object' && key in (target as Record<string, unknown>)) {
      target = (target as Record<string, unknown>)[key];
    } else {
      throw new ManifestGetError(
        `Reference "${ref}" could not be resolved: missing "${key}".`,
        path
      );
    }
  }

  return target as T;
}

/**
 * Resolves a component index entry into a full component manifest by following any
 * `$ref`s it carries (docgen, story-docs, attached MDX docs), then adapting the
 * core-format payloads into `@storybook/mcp`'s internal shape.
 *
 * Refs are read verbatim from the entry — never fabricated from an id — so a
 * provider is only ever asked for top-level manifest paths or paths a manifest
 * already pointed at. Components without any `$ref` (inline/v0 format, or entries
 * already resolved in-process) are returned unchanged.
 */
export async function resolveComponentEntry(
  component: ComponentManifestEntry,
  request?: Request,
  manifestProvider?: ManifestProvider,
  source?: Source
): Promise<ComponentManifest> {
  const docgenRef = 'docgen' in component ? component.docgen?.$ref : undefined;
  const storiesRef =
    component.stories && !Array.isArray(component.stories) ? component.stories.$ref : undefined;
  const docEntries: [string, DocEntry][] = component.docs ? Object.entries(component.docs) : [];
  const docRefs = docEntries.filter(([, doc]) => 'mdx' in doc && !!doc.mdx?.$ref);

  if (!docgenRef && !storiesRef && docRefs.length === 0) {
    // No `$ref`s to follow: this is an inline (v0) entry already in resolved form
    // (or a v1 row with nothing to resolve).
    return component as ComponentManifest;
  }

  const provider = manifestProvider ?? defaultManifestProvider;

  // Identity fields from the index entry are authoritative; the docgen payload
  // supplies path/props/jsDocTags/subcomponents.
  let core: CoreDocgenComponent = {
    id: component.id,
    name: component.name,
    ...(component.description !== undefined ? { description: component.description } : {}),
    ...(component.summary !== undefined ? { summary: component.summary } : {}),
    ...(component.error !== undefined ? { error: component.error } : {}),
  };

  if (docgenRef) {
    const payload = await fetchRefValue<CoreDocgenPayload>(docgenRef, request, provider, source);
    core = {
      ...core,
      ...payload,
      id: component.id,
      name: component.name,
      ...(component.description !== undefined ? { description: component.description } : {}),
      ...(component.summary !== undefined ? { summary: component.summary } : {}),
      ...(component.error !== undefined ? { error: component.error } : {}),
    };
  }

  // Preserve inline stories (mixed/v0) when there's no story-docs ref to follow.
  if (Array.isArray(component.stories)) {
    core.stories = component.stories;
  }

  if (storiesRef) {
    const storyDocs = await fetchRefValue<CoreStoryDocsPayload | null>(
      storiesRef,
      request,
      provider,
      source
    );
    if (storyDocs?.stories) {
      core.stories = storyDocs.stories;
    }
    if (storyDocs?.import) {
      core.import = storyDocs.import;
    }
  }

  if (docEntries.length > 0) {
    const docs: Record<string, CoreMdxDoc> = {};
    for (const [docId, doc] of docEntries) {
      const mdxRef = 'mdx' in doc ? doc.mdx?.$ref : undefined;
      docs[docId] = mdxRef
        ? await fetchRefValue<CoreMdxDoc>(mdxRef, request, provider, source)
        : (doc as CoreMdxDoc);
    }
    core.docs = docs;
  }

  return adaptCoreComponent(core);
}

/**
 * Resolves only a component's stories `$ref` (story-docs payload) into a `Story[]`,
 * leaving docgen/docs refs untouched. Used by `list-all-documentation` when story
 * ids are requested, so listing doesn't pay for docgen/MDX resolution it won't show.
 */
export async function resolveComponentStories(
  component: ComponentManifestEntry,
  request?: Request,
  manifestProvider?: ManifestProvider,
  source?: Source
): Promise<ComponentManifest> {
  if (!component.stories || Array.isArray(component.stories)) {
    // Already inline (v0) or no stories: nothing to follow.
    return component as ComponentManifest;
  }

  const provider = manifestProvider ?? defaultManifestProvider;
  const storyDocs = await fetchRefValue<CoreStoryDocsPayload | null>(
    component.stories.$ref,
    request,
    provider,
    source
  );

  return {
    ...component,
    stories: storyDocs?.stories ? adaptCoreStories(storyDocs.stories) : [],
  } as ComponentManifest;
}

/**
 * Resolves a standalone docs entry, following its `mdx.$ref` when present.
 * Inline docs (v0) are returned unchanged.
 */
export async function resolveDoc(
  doc: DocEntry,
  request?: Request,
  manifestProvider?: ManifestProvider,
  source?: Source
): Promise<Doc> {
  const ref = 'mdx' in doc ? doc.mdx?.$ref : undefined;
  if (!ref) {
    // Inline (v0) doc, already in resolved form.
    return doc as Doc;
  }

  const provider = manifestProvider ?? defaultManifestProvider;
  const payload = await fetchRefValue<CoreMdxDoc>(ref, request, provider, source);

  return adaptCoreDoc({
    ...payload,
    id: payload.id ?? doc.id,
    name: payload.name ?? doc.name,
  });
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
  path: string
): Promise<string> {
  if (!request) {
    throw new ManifestGetError(
      "Request is required when using the default manifest provider. You must either pass the original request forward to the server context, or set a custom manifestProvider that doesn't need the request."
    );
  }
  const manifestUrl = getManifestUrlFromRequest(request, path);
  const response = await fetch(manifestUrl);

  if (!response.ok) {
    throw new ManifestGetError(
      `Failed to fetch manifest: ${response.status} ${response.statusText}`,
      manifestUrl
    );
  }

  const contentType = response.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new ManifestGetError(
      `Invalid content type: expected application/json, got ${contentType}`,
      manifestUrl
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
    source?: Source
  ) => Promise<string>
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
            componentManifest: EMPTY_COMPONENT_MANIFEST,
            notice: {
              kind: 'requires-own-mcp' as const,
              endpoint: error.endpoint,
            },
          };
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          source,
          componentManifest: EMPTY_COMPONENT_MANIFEST,
          error: errorMessage,
        };
      }
    })
  );

  // Check if at least one source produced useful tool output.
  const successCount = results.filter((r) => !r.error && !r.notice).length;
  const noticeCount = results.filter((r) => r.notice).length;
  if (successCount === 0 && noticeCount === 0) {
    throw new ManifestGetError(
      `Failed to fetch manifests from any source. Errors:\n${results.map((r) => `- ${r.source.title}: ${r.error}`).join('\n')}`
    );
  }

  return results;
}

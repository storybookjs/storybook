/**
 * Docs access backed by manifest files, wherever they are served from.
 *
 * This is the access a hosted Storybook uses: the manifests arrive as JSON over a provider (HTTP by
 * default, but the caller can supply any fetcher — S3, a static bundle, an authenticated proxy), so
 * they are untrusted input and are validated on arrival. In the split/ref (v1) format the index
 * rows only carry `$ref`s to externalized payloads, which are followed here so the toolset always
 * receives fully-assembled entries.
 *
 * Refs are read verbatim from the entry and never fabricated from an id, so a provider is only ever
 * asked for a top-level manifest path or a path a manifest already pointed at.
 */

import * as v from 'valibot';

import {
  adaptCoreComponent,
  adaptCoreDoc,
  adaptCoreStories,
  type CoreDocgenComponent,
} from './manifest-formatter/adapt-core-manifest.ts';
import {
  ComponentManifestMap,
  DocsManifestMap,
  type AllManifests,
  type ComponentManifest,
  type ComponentManifestEntry,
  type Doc,
  type DocEntry,
} from './manifest-formatter/manifest-types.ts';
import { emptyManifests, type DocsAccess, type ResolvedDocsEntry } from './access.ts';
import { mapWithConcurrency } from './map-with-concurrency.ts';
import { ManifestGetError, RequiresOwnMcpError, type Source } from './sources.ts';

/** Cap on in-flight story `$ref` fetches while expanding one source's listing. */
const STORY_REF_CONCURRENCY = 16;

/** Where the top-level manifests live, relative to the Storybook build. */
export const COMPONENT_MANIFEST_PATH = './manifests/components.json';
export const DOCS_MANIFEST_PATH = './manifests/docs.json';

/**
 * Fetches one manifest file by path. `request` is the incoming MCP request, which the default
 * provider uses to derive the origin; custom providers may ignore it.
 */
export type ManifestProvider = (
  request: Request | undefined,
  path: string,
  source?: Source
) => Promise<string>;

export type ProviderDocsAccessOptions = {
  manifestProvider?: ManifestProvider;
  /** The in-flight request. Read per call, because the access outlives any single request. */
  getRequest?: () => Request | undefined;
  /** The composed source this access reads, when part of a composition. */
  source?: Source;
  /**
   * Resolves a single entry in-process, bypassing the manifest index. The dev server passes this
   * for its local source when `experimentalDocgenServer` is on, so one lookup never triggers
   * docgen extraction for every component.
   */
  resolveEntry?: (id: string, source?: Source) => Promise<ResolvedDocsEntry | undefined>;
};

function getManifestUrlFromRequest(request: Request, path: string): string {
  return new URL(`/${path.replace(/^\.\//, '')}`, request.url).toString();
}

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

/** Fetches and validates the component and docs manifests for one source. */
export async function fetchManifests(
  request?: Request,
  manifestProvider?: ManifestProvider,
  source?: Source
): Promise<AllManifests> {
  const provider = manifestProvider ?? defaultManifestProvider;

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

  const docsManifest = parseManifest({
    jsonString: docsResult.value,
    schema: DocsManifestMap,
    name: 'docs',
    url: getUrl(DOCS_MANIFEST_PATH),
  });

  return { componentManifest, docsManifest };
}

/**
 * Resolves a `$ref` into the provider path of the referenced file and the JSON-pointer segments
 * into it.
 *
 * The path is relative to the component manifest's location, e.g.
 * `"../services/core/docgen/button.json#/components/button"` resolves to
 * `./services/core/docgen/button.json` with pointer `["components", "button"]`.
 */
export function parseManifestRef(ref: string): { path: string; pointer: string[] } {
  const [filePath = '', hash = ''] = ref.split('#');

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
 * Envelopes for the three kinds of payload a `$ref` can point at.
 *
 * These check the shape the adapters actually read, not the full docgen format: the payloads carry
 * renderer-specific fields that core must pass through untouched, so a strict schema here would
 * reject valid manifests. What matters is that a hosted Storybook cannot hand the adapters a string
 * or an array where they expect a record.
 */
/**
 * A JSON object. `looseObject` alone would let an array through, since arrays are objects, and the
 * adapters then read `.name` / `.stories` off it and silently produce an empty component.
 */
const jsonObject = <TSchema extends v.GenericSchema>(schema: TSchema) =>
  v.pipe(
    // Checked on the raw input: `looseObject` copies an array's entries into a plain object, so by
    // the time it has run there is nothing left to recognise.
    v.custom<unknown>((input) => !Array.isArray(input), 'Expected a JSON object'),
    schema
  );

const DocgenRefPayload = jsonObject(v.looseObject({}));
const StoryDocsRefPayload = v.nullable(
  jsonObject(
    v.looseObject({
      // A record keyed by story id, or an already-resolved array — `adaptCoreStories` accepts both.
      stories: v.optional(
        v.union([v.record(v.string(), v.looseObject({})), v.array(v.looseObject({}))])
      ),
      import: v.optional(v.string()),
    })
  )
);
const MdxRefPayload = jsonObject(
  v.looseObject({ id: v.optional(v.string()), name: v.optional(v.string()) })
);

/** Fetches the file a `$ref` points at, walks its JSON pointer and validates what it lands on. */
async function fetchRefValue<T>(
  ref: string,
  request: Request | undefined,
  provider: ManifestProvider,
  source: Source | undefined,
  schema: v.GenericSchema
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
    // Own properties only: the pointer comes from a fetched manifest, so `constructor` or
    // `__proto__` would otherwise walk into the prototype instead of failing as unresolvable.
    if (target && typeof target === 'object' && Object.hasOwn(target, key)) {
      target = (target as Record<string, unknown>)[key];
    } else {
      throw new ManifestGetError(
        `Reference "${ref}" could not be resolved: missing "${key}".`,
        path
      );
    }
  }

  const parsed = v.safeParse(schema, target);
  if (!parsed.success) {
    throw new ManifestGetError(
      `Payload referenced by "${ref}" is not a valid manifest payload.`,
      path
    );
  }

  return parsed.output as T;
}

/**
 * Resolves a component index row into a full component manifest by following any `$ref`s it carries
 * (docgen, story-docs, attached MDX), then adapting the payloads into the formatter's shape. Rows
 * without any `$ref` are already in resolved (inline/v0) form and are returned unchanged.
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
    return component as ComponentManifest;
  }

  const provider = manifestProvider ?? defaultManifestProvider;

  // Identity fields from the index row are authoritative; the docgen payload supplies
  // path/props/jsDocTags/subcomponents.
  const identity = {
    id: component.id,
    name: component.name,
    ...(component.description !== undefined ? { description: component.description } : {}),
    ...(component.summary !== undefined ? { summary: component.summary } : {}),
    ...(component.error !== undefined ? { error: component.error } : {}),
  };

  let core: CoreDocgenComponent = identity;

  if (docgenRef) {
    const payload = await fetchRefValue<CoreDocgenComponent>(
      docgenRef,
      request,
      provider,
      source,
      DocgenRefPayload
    );
    core = { ...core, ...payload, ...identity };
  }

  // Preserve inline stories (mixed/v0) when there's no story-docs ref to follow.
  if (Array.isArray(component.stories)) {
    core.stories = component.stories;
  }

  if (storiesRef) {
    const storyDocs = await fetchRefValue<{
      stories?: CoreDocgenComponent['stories'];
      import?: string;
    } | null>(storiesRef, request, provider, source, StoryDocsRefPayload);
    if (storyDocs?.stories) {
      core.stories = storyDocs.stories;
    }
    if (storyDocs?.import) {
      core.import = storyDocs.import;
    }
  }

  if (docEntries.length > 0) {
    const docs: Record<string, Doc> = {};
    for (const [docId, doc] of docEntries) {
      const mdxRef = 'mdx' in doc ? doc.mdx?.$ref : undefined;
      docs[docId] = mdxRef
        ? await fetchRefValue<Doc>(mdxRef, request, provider, source, MdxRefPayload)
        : (doc as Doc);
    }
    core.docs = docs;
  }

  return adaptCoreComponent(core);
}

/**
 * Resolves only a component's stories `$ref`, leaving docgen and docs refs untouched. Listing with
 * story ids uses this so it doesn't pay for docgen and MDX resolution it won't show.
 */
export async function resolveComponentStories(
  component: ComponentManifestEntry,
  request?: Request,
  manifestProvider?: ManifestProvider,
  source?: Source
): Promise<ComponentManifestEntry> {
  if (!component.stories || Array.isArray(component.stories)) {
    return component;
  }

  const provider = manifestProvider ?? defaultManifestProvider;
  const storyDocs = await fetchRefValue<{ stories?: CoreDocgenComponent['stories'] } | null>(
    component.stories.$ref,
    request,
    provider,
    source,
    StoryDocsRefPayload
  );

  return {
    ...component,
    stories: storyDocs?.stories ? (adaptCoreStories(storyDocs.stories) ?? []) : [],
  };
}

/** Resolves a standalone docs row, following its `mdx.$ref` when present. */
export async function resolveDocEntry(
  doc: DocEntry,
  request?: Request,
  manifestProvider?: ManifestProvider,
  source?: Source
): Promise<Doc> {
  const ref = 'mdx' in doc ? doc.mdx?.$ref : undefined;
  if (!ref) {
    return doc as Doc;
  }

  const provider = manifestProvider ?? defaultManifestProvider;
  const payload = await fetchRefValue<Doc>(ref, request, provider, source, MdxRefPayload);

  return adaptCoreDoc({
    ...payload,
    id: payload.id ?? doc.id,
    name: payload.name ?? doc.name,
  });
}

/** Docs access over manifest files served by a provider. */
export function createProviderDocsAccess({
  manifestProvider,
  getRequest,
  source,
  resolveEntry,
}: ProviderDocsAccessOptions = {}): DocsAccess {
  const request = () => getRequest?.();

  return {
    async list({ withStoryIds }): Promise<AllManifests> {
      const manifests = await fetchManifests(request(), manifestProvider, source);

      // The split/ref format keeps stories behind a `$ref`, so resolve them only when story ids
      // were asked for and plain listing stays cheap. One `$ref` per component means a large
      // Storybook would otherwise open hundreds of connections to the host at once.
      if (withStoryIds) {
        const components = manifests.componentManifest.components as Record<
          string,
          ComponentManifestEntry
        >;
        try {
          const resolved = await mapWithConcurrency(
            Object.entries(components),
            STORY_REF_CONCURRENCY,
            async ([id, component]) =>
              [
                id,
                await resolveComponentStories(component, request(), manifestProvider, source),
              ] as const
          );
          for (const [id, component] of resolved) {
            components[id] = component;
          }
        } catch (error) {
          // One composed source must not lose its whole listing because a single story `$ref` was
          // unreachable: leave its rows unresolved instead. A single Storybook has no other source
          // to fall back on, so there the failure is the answer.
          if (!source) {
            throw error;
          }
        }
      }

      return { ...emptyManifests(), ...manifests };
    },

    async resolve(id): Promise<ResolvedDocsEntry | undefined> {
      // The in-process services back the local Storybook only, so a source with a URL always goes
      // through the fetch path below.
      if (resolveEntry && !source?.url) {
        return resolveEntry(id, source);
      }

      const { componentManifest, docsManifest } = await fetchManifests(
        request(),
        manifestProvider,
        source
      );

      // Own-property guards: ids come straight from the agent, and a prototype member like
      // `constructor` must answer "not found" rather than render as a component.
      const components = componentManifest.components as Record<string, ComponentManifestEntry>;
      const componentEntry = Object.hasOwn(components, id) ? components[id] : undefined;
      if (componentEntry) {
        return {
          kind: 'component',
          component: await resolveComponentEntry(
            componentEntry,
            request(),
            manifestProvider,
            source
          ),
        };
      }

      const docs = docsManifest?.docs as Record<string, DocEntry> | undefined;
      const docEntry = docs && Object.hasOwn(docs, id) ? docs[id] : undefined;
      if (docEntry) {
        return {
          kind: 'doc',
          doc: await resolveDocEntry(docEntry, request(), manifestProvider, source),
        };
      }

      return undefined;
    },
  };
}

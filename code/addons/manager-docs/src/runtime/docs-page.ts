import type { ChannelLike } from 'storybook/internal/channels';
import { dirname, join, normalize } from 'pathe';

import { ManagerDocsError, ManagerDocsParseError } from '../errors.ts';
import { parseManagerDocs } from '../parser/parse-mdx.ts';
import type { DocsPage } from '../parser/types.ts';
import { createChannelState, registerInstance, type ChannelState } from './channel-router.ts';
import { planViewportPool, type PoolAssignment } from './iframe-pool.ts';
import {
  mountInstance,
  resetSession,
  reuseInstance,
  updateArgs,
  updateGlobals,
  type IframeHost,
  type OccupantSpec,
} from './iframe-session.ts';
import {
  createArticleModel,
  reconcileArticleModel,
  type DocsArticleModel,
  type ResolvedStory,
  type StoryArgs,
  type StoryInstance,
  type StoryReference,
} from './page-model.ts';
import {
  mdxSourceError,
  requestMdxSource,
  type MdxSourceChange,
  type MdxSourceError,
} from './source-transport.ts';

export type IndexedEntry = {
  type: string;
  id: string;
  importPath?: string;
  exportName?: string;
  storiesImports?: string[];
  args?: StoryArgs;
};

const STORY_EXTENSION = /\.(?:[cm]?[jt]sx?)$/;

// Story ids come from the index. The CSF modules named by the MDX imports are not executed.
export async function openDocsPage(input: {
  file: string;
  channel: ChannelLike;
  entries: IndexedEntry[];
  globals: StoryArgs;
}): Promise<{ model: DocsArticleModel; channelState: ChannelState; source: string }> {
  const source = await requestMdxSource(input.channel, input.file);
  return openDocsPageFromSource({
    file: input.file,
    source,
    entries: input.entries,
    globals: input.globals,
  });
}

export function buildDocsModel(input: {
  file: string;
  source: string;
  entries: IndexedEntry[];
  globals: StoryArgs;
}): DocsArticleModel {
  return createArticleModel(
    parseManagerDocs(input.source, input.file),
    (reference) => resolveIndexedStory(input.file, reference, input.entries),
    input.globals,
    input.file
  );
}

export function openDocsPageFromSource(input: {
  file: string;
  source: string;
  entries: IndexedEntry[];
  globals: StoryArgs;
}): { model: DocsArticleModel; channelState: ChannelState; source: string } {
  const model = buildDocsModel(input);
  const channelState = model.instances.reduce(
    (state, instance) =>
      registerInstance(
        state,
        instance.instanceId,
        instance.storyId,
        instance.args,
        instance.globals
      ),
    createChannelState()
  );
  return { model, channelState, source: input.source };
}

export type LiveDocsPage = {
  model: DocsArticleModel;
  source: string;
  // Null while the newest revision on disk is a syntax error and carries no source.
  latest: string | null;
  revision: number;
  error: MdxSourceError | null;
};

export type LiveDocsUpdate = {
  live: LiveDocsPage;
  added: StoryInstance[];
  removed: StoryInstance[];
};

/**
 * Rebuild the shown page from new source and reconcile it with the live instances.
 *
 * A parse failure keeps the last good model and records the located error.
 */
export function reviseDocsPage(
  live: LiveDocsPage,
  source: string,
  build: (source: string) => DocsArticleModel
): LiveDocsUpdate {
  let next: DocsArticleModel;
  try {
    next = build(source);
  } catch (error) {
    if (!(error instanceof ManagerDocsParseError)) {
      throw error;
    }
    return {
      live: { ...live, latest: source, error: mdxSourceError(error) },
      added: [],
      removed: [],
    };
  }
  const { model, added, removed } = reconcileArticleModel(live.model, next);
  return { live: { ...live, model, source, latest: source, error: null }, added, removed };
}

/**
 * Rebuild the newest pushed source against a refreshed story index.
 *
 * When the newest revision is a syntax error, the last good source is rebuilt and the error stays.
 */
export function refreshDocsPage(
  live: LiveDocsPage,
  build: (source: string) => DocsArticleModel
): LiveDocsUpdate {
  if (live.latest !== null) {
    return reviseDocsPage(live, live.latest, build);
  }
  const update = reviseDocsPage(live, live.source, build);
  return {
    ...update,
    live: { ...update.live, latest: null, error: update.live.error ?? live.error },
  };
}

/**
 * Apply a pushed MDX change. Revisions at or below the last applied one are dropped.
 */
export function acceptMdxSourceChange(
  live: LiveDocsPage,
  change: MdxSourceChange,
  build: (source: string) => DocsArticleModel
): LiveDocsUpdate {
  if (change.revision <= live.revision) {
    return { live, added: [], removed: [] };
  }
  if ('error' in change) {
    return {
      live: { ...live, latest: null, revision: change.revision, error: change.error },
      added: [],
      removed: [],
    };
  }
  const update = reviseDocsPage(live, change.source, build);
  return { ...update, live: { ...update.live, revision: change.revision } };
}

export function staticStoryBindings(
  docsFile: string,
  page: DocsPage,
  entries: IndexedEntry[]
): IndexedEntry[] {
  const sources = new Set(
    page.imports.map((statement) => storyPathKey(resolveSpecifier(docsFile, statement.source)))
  );
  return entries.filter(
    (entry) =>
      entry.type === 'story' &&
      entry.importPath !== undefined &&
      entry.exportName !== undefined &&
      sources.has(storyPathKey(entry.importPath))
  );
}

export function resolveIndexedStory(
  docsFile: string,
  reference: StoryReference,
  entries: IndexedEntry[]
): ResolvedStory | undefined {
  const imported = storyPathKey(resolveSpecifier(docsFile, reference.importSource));
  const match = entries.find(
    (entry) =>
      entry.type === 'story' &&
      entry.exportName === reference.exportName &&
      entry.importPath !== undefined &&
      storyPathKey(entry.importPath) === imported
  );
  if (!match) {
    return undefined;
  }
  return match.args === undefined ? { storyId: match.id } : { storyId: match.id, args: match.args };
}

export function occupantSpec(instance: StoryInstance): OccupantSpec {
  return {
    instanceId: instance.instanceId,
    storyId: instance.storyId,
    args: instance.args,
    argsFromIndex: instance.argsFromIndex,
    globals: instance.globals,
  };
}

export function mountDocsInstances(host: IframeHost, instances: StoryInstance[]): IframeHost {
  return instances.reduce((current, instance) => {
    if (current.sessions.some((session) => session.frameId === instance.instanceId)) {
      return current;
    }
    return mountInstance(current, instance.instanceId, occupantSpec(instance));
  }, host);
}

export function syncDocsPool(
  host: IframeHost,
  visible: readonly string[],
  instances: readonly StoryInstance[]
): { host: IframeHost; seats: PoolAssignment[] } {
  const plan = planViewportPool(
    host.sessions.map((session) => ({
      frameId: session.frameId,
      occupantId: session.occupant?.instanceId ?? null,
    })),
    visible
  );
  const byId = new Map(instances.map((instance) => [instance.instanceId, instance]));
  let next = dropDocsFrames(host, plan.dropFrameIds);
  const seats: PoolAssignment[] = [];
  for (const assignment of plan.assignments) {
    const instance = byId.get(assignment.instanceId);
    if (!instance) {
      continue;
    }
    const session = next.sessions.find((candidate) => candidate.frameId === assignment.frameId);
    if (!session) {
      next = mountInstance(next, assignment.frameId, occupantSpec(instance));
      seats.push({ ...assignment, reused: false });
      continue;
    }
    if (session.occupant?.instanceId !== instance.instanceId) {
      next = reuseInstance(next, assignment.frameId, occupantSpec(instance));
      seats.push({ ...assignment, reused: true });
      continue;
    }
    seats.push({ ...assignment, reused: false });
  }
  return { host: next, seats };
}

export function dropDocsFrames(host: IframeHost, frameIds: readonly string[]): IframeHost {
  const removed = new Set(frameIds);
  return {
    sessions: host.sessions
      .map((session) => (removed.has(session.frameId) ? resetSession(session) : session))
      .filter((session) => !removed.has(session.frameId)),
  };
}

export function releaseDocsFrames(host: IframeHost): IframeHost {
  return { sessions: host.sessions.map((session) => resetSession(session)) };
}

// A released frame leaves the host so the same instance id can mount again later.
export function unmountDocsInstances(host: IframeHost, instanceIds: readonly string[]): IframeHost {
  const removed = new Set(instanceIds);
  const drop = host.sessions
    .filter(
      (session) =>
        removed.has(session.frameId) ||
        (session.occupant !== null && removed.has(session.occupant.instanceId))
    )
    .map((session) => session.frameId);
  return dropDocsFrames(host, drop);
}

export function writeDocsInstanceArgs(
  host: IframeHost,
  instanceId: string,
  args: StoryArgs
): IframeHost {
  return writeSession(host, instanceId, (session) => updateArgs(session, instanceId, args));
}

export function writeDocsInstanceGlobals(
  host: IframeHost,
  instanceId: string,
  globals: StoryArgs
): IframeHost {
  return writeSession(host, instanceId, (session) => updateGlobals(session, instanceId, globals));
}

export function withInstanceArgs(
  model: DocsArticleModel,
  instanceId: string,
  args: StoryArgs
): DocsArticleModel {
  return {
    ...model,
    instances: model.instances.map((instance) =>
      instance.instanceId === instanceId ? { ...instance, args: structuredClone(args) } : instance
    ),
  };
}

export function withInstanceGlobals(
  model: DocsArticleModel,
  instanceId: string,
  globals: StoryArgs
): DocsArticleModel {
  return {
    ...model,
    instances: model.instances.map((instance) =>
      instance.instanceId === instanceId
        ? { ...instance, globals: structuredClone(globals) }
        : instance
    ),
  };
}

function writeSession(
  host: IframeHost,
  instanceId: string,
  update: (session: IframeHost['sessions'][number]) => IframeHost['sessions'][number]
): IframeHost {
  const index = host.sessions.findIndex((session) => session.occupant?.instanceId === instanceId);
  if (index === -1) {
    throw new ManagerDocsError(`No mounted frame for "${instanceId}".`);
  }
  const sessions = host.sessions.slice();
  sessions[index] = update(sessions[index]!);
  return { sessions };
}

function resolveSpecifier(docsFile: string, specifier: string): string {
  if (specifier.startsWith('.')) {
    return normalize(join(dirname(docsFile), specifier));
  }
  return specifier;
}

function storyPathKey(importPath: string): string {
  // The index stores "./src/Button.stories.tsx". pathe.join drops the leading "./".
  return importPath.replace(/^\.\//, '').replace(STORY_EXTENSION, '');
}

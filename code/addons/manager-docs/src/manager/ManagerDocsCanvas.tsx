import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { FORCE_REMOUNT, SET_CURRENT_STORY } from 'storybook/internal/core-events';
import { addons, useStorybookApi } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { createChannelState } from '../runtime/channel-router.ts';
import {
  acceptMdxSourceChange,
  buildDocsModel,
  refreshDocsPage,
  releaseDocsFrames,
  syncDocsPool,
  withInstanceGlobals,
  writeDocsInstanceGlobals,
  type IndexedEntry,
  type LiveDocsPage,
  type LiveDocsUpdate,
} from '../runtime/docs-page.ts';
import {
  applyReportedHeight,
  DOCS_ARTICLE_ALIGN,
  displayedFrameHeight,
  stablePaneHeight,
  storyFrameStyle,
  type FrameHeightState,
} from '../runtime/frame-height.ts';
import {
  docsFrameStyle,
  docsFrameWidth,
  type DocsViewportParameter,
} from '../runtime/frame-viewport.ts';
import {
  connectDocsPlays,
  createIframePlayQueue,
  type IframePlayQueue,
} from '../runtime/iframe-plays.ts';
import { hasComponentBlocks, loadComponentBlocks } from '../runtime/component-blocks.ts';
import { fetchStaticMdxManifest, loadDocsArticle } from '../runtime/static-manifest.ts';
import { createIframeHost, type IframeHost } from '../runtime/iframe-session.ts';
import {
  clearInstanceActions,
  createActionsRegistry,
  withActionMessage,
  withoutActionsInstance,
  type ActionsRegistry,
} from '../runtime/instance-actions.ts';
import {
  createInteractionsRegistry,
  withInteractionMessage,
  withoutInteractionsInstance,
  type InteractionsRegistry,
} from '../runtime/instance-interactions.ts';
import { instanceParameter } from '../runtime/instance-manager-api.ts';
import { connectInstanceTransport, type InstanceTransport } from '../runtime/instance-transport.ts';
import type { DocsArticleModel, StoryInstance } from '../runtime/page-model.ts';
import {
  createPlayPanelRegistry,
  withoutPlayPanelInstance,
  withPlayPanelPhase,
  type PlayPanelRegistry,
} from '../runtime/play-panel.ts';
import {
  MDX_SOURCE_CHANGED,
  type MdxSourceChange,
  type MdxSourceError,
} from '../runtime/source-transport.ts';
import { ManagerDocsView } from './ManagerDocsView.tsx';

const DocsColumn = styled.div(DOCS_ARTICLE_ALIGN);

const SourceErrorBanner = styled.div(({ theme }) => ({
  margin: '16px 32px 0',
  padding: '8px 12px',
  borderRadius: theme.appBorderRadius,
  background: theme.background.negative,
  color: theme.color.negativeText,
  fontFamily: theme.fontBase,
  fontSize: theme.typography.size.s2,
}));

type DocsSession = {
  apply: (update: LiveDocsUpdate) => void;
  build: (source: string) => DocsArticleModel;
};

type PoolSeat = {
  frameId: string;
  instanceId: string;
};

export function ManagerDocsCanvas({
  baseUrl,
  entry,
}: {
  storyId?: string;
  viewMode?: string;
  baseUrl: string;
  entry?: { id?: string; type?: string; importPath?: string };
}) {
  const api = useStorybookApi();
  const index = api.getIndex();
  const [model, setModel] = useState<DocsArticleModel | null>(null);
  const [sourceError, setSourceError] = useState<MdxSourceError | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeights, setContentHeights] = useState<Record<string, number>>({});
  const [playPanels, setPlayPanels] = useState<PlayPanelRegistry>(createPlayPanelRegistry());
  const [interactions, setInteractions] = useState<InteractionsRegistry>(
    createInteractionsRegistry()
  );
  const [actions, setActions] = useState<ActionsRegistry>(createActionsRegistry());
  const [seats, setSeats] = useState<PoolSeat[]>([]);
  const hostRef = useRef<IframeHost>(createIframeHost());
  const transportRef = useRef<InstanceTransport | null>(null);
  const playsRef = useRef<IframePlayQueue | null>(null);
  const viewportRef = useRef(0);
  const heightsRef = useRef(new Map<string, FrameHeightState>());
  const liveRef = useRef<LiveDocsPage | null>(null);
  const sessionRef = useRef<DocsSession | null>(null);
  const placeholdersRef = useRef(new Map<string, HTMLElement>());
  const framesRef = useRef(new Map<string, HTMLIFrameElement>());
  const initialSearchRef = useRef(new Map<string, string>());
  const visibleRef = useRef(new Set<string>());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const syncVisibleRef = useRef<() => void>(() => {});
  const indexRef = useRef(index);
  indexRef.current = index;
  const rendersComponents = model ? hasComponentBlocks(model.blocks) : false;
  const production = (globalThis as { CONFIG_TYPE?: string }).CONFIG_TYPE === 'PRODUCTION';

  useEffect(() => {
    if (!rendersComponents) {
      return undefined;
    }
    return loadComponentBlocks(addons.getChannel(), document, production);
  }, [rendersComponents, production]);

  useLayoutEffect(() => {
    const read = () => {
      const next = stablePaneHeight(readPaneHeights());
      if (!next || next === viewportRef.current) {
        return;
      }
      viewportRef.current = next;
      setViewportHeight(next);
    };
    read();
    const wrapper = document.getElementById('storybook-preview-wrapper');
    if (!wrapper || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(read);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  const file = entry?.type === 'docs' ? entry.importPath : undefined;
  const mdxFile = file && /\.mdx$/i.test(file) ? file : undefined;

  useEffect(() => {
    if (!mdxFile) {
      setModel(null);
      setFailure(
        entry?.type === 'docs'
          ? 'This docs entry does not point at an MDX file.'
          : 'No MDX docs entry is selected.'
      );
      return;
    }

    const channel = addons.getChannel();
    let cancelled = false;
    let pending: MdxSourceChange | null = null;
    const productionBuild = (globalThis as { CONFIG_TYPE?: string }).CONFIG_TYPE === 'PRODUCTION';
    const transport = connectInstanceTransport(channel, createChannelState());
    const listeners = new Map<string, () => void>();
    transportRef.current = transport;
    hostRef.current = createIframeHost();
    heightsRef.current = new Map();
    playsRef.current = null;
    liveRef.current = null;
    visibleRef.current = new Set();
    setSeats([]);
    setPlayPanels(createPlayPanelRegistry());
    setInteractions(createInteractionsRegistry());
    setActions(createActionsRegistry());

    const applyHeight = (instance: StoryInstance, reported: number) => {
      if (
        instance.ratio !== undefined ||
        instance.height === '100vh' ||
        typeof instance.height === 'number'
      ) {
        return;
      }
      const previous = heightsRef.current.get(instance.instanceId) ?? {
        applied: displayedFrameHeight(undefined, undefined, viewportRef.current),
        reported: null,
        growth: 0,
      };
      const result = applyReportedHeight(previous, instance.height, reported, viewportRef.current);
      heightsRef.current.set(instance.instanceId, result.state);
      if (!result.changed) {
        return;
      }
      setContentHeights((current) =>
        current[instance.instanceId] === result.state.applied
          ? current
          : { ...current, [instance.instanceId]: result.state.applied }
      );
    };

    const attach = (instance: StoryInstance) => {
      if (listeners.has(instance.instanceId)) {
        return;
      }
      transport.register(instance.instanceId, instance.storyId, instance.args, instance.globals);
      const play = {
        instanceId: instance.instanceId,
        focus: instance.focus,
        documentOrder: instance.documentOrder,
      };
      if (playsRef.current) {
        playsRef.current.enter(play);
      } else {
        playsRef.current = createIframePlayQueue([play]);
      }
      const stopPlays = connectDocsPlays(playsRef.current, [instance], transport);
      const stopHeight = transport.listen(instance.instanceId, (event) => {
        const current = liveRef.current?.model.instances.find(
          (candidate) => candidate.instanceId === instance.instanceId
        );
        if (current && event.kind === 'height' && typeof event.height === 'number') {
          applyHeight(current, event.height);
        }
      });
      const stopPlayPanel = transport.listen(instance.instanceId, (event) => {
        if (event.kind === 'play') {
          setPlayPanels((current) =>
            withPlayPanelPhase(current, instance.instanceId, event.phase ?? null)
          );
        }
        const message = event.message;
        if (event.kind === 'interactions' && message) {
          setInteractions((current) =>
            withInteractionMessage(current, instance.instanceId, instance.storyId, message)
          );
        }
        if (event.kind === 'actions' && message) {
          setActions((current) => withActionMessage(current, instance.instanceId, message));
        }
      });
      listeners.set(instance.instanceId, () => {
        stopPlays();
        stopHeight();
        stopPlayPanel();
      });
    };

    const detach = (instanceId: string) => {
      setPlayPanels((current) => withoutPlayPanelInstance(current, instanceId));
      setInteractions((current) => withoutInteractionsInstance(current, instanceId));
      setActions((current) => withoutActionsInstance(current, instanceId));
      listeners.get(instanceId)?.();
      listeners.delete(instanceId);
      transport.unregister(instanceId);
      playsRef.current?.leave(instanceId);
      heightsRef.current.delete(instanceId);
    };

    const resize = (before: StoryInstance[], after: StoryInstance[]) => {
      const previous = new Map(before.map((instance) => [instance.instanceId, instance]));
      const stale = new Set<string>();
      for (const instance of after) {
        const old = previous.get(instance.instanceId);
        if (old && (old.height !== instance.height || old.ratio !== instance.ratio)) {
          stale.add(instance.instanceId);
        }
      }
      setContentHeights((current) => {
        const gone = Object.keys(current).filter(
          (instanceId) => stale.has(instanceId) || !after.some((i) => i.instanceId === instanceId)
        );
        if (gone.length === 0) {
          return current;
        }
        const next = { ...current };
        for (const instanceId of gone) {
          delete next[instanceId];
        }
        return next;
      });
      for (const instance of after) {
        if (!stale.has(instance.instanceId)) {
          continue;
        }
        heightsRef.current.delete(instance.instanceId);
        const reported = transport.getState().instances[instance.instanceId]?.height;
        if (typeof reported === 'number') {
          applyHeight(instance, reported);
        }
      }
    };

    const syncVisible = () => {
      const live = liveRef.current;
      if (!live) {
        return;
      }
      const order = new Map(
        live.model.instances.map((instance) => [instance.instanceId, instance.documentOrder])
      );
      const visible = [...visibleRef.current].sort(
        (left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0)
      );
      const previous = new Map(
        hostRef.current.sessions.flatMap((session) =>
          session.occupant ? [[session.frameId, session.occupant.instanceId] as const] : []
        )
      );
      const synced = syncDocsPool(hostRef.current, visible, live.model.instances);
      hostRef.current = synced.host;
      for (const seat of synced.seats) {
        const instance = live.model.instances.find(
          (candidate) => candidate.instanceId === seat.instanceId
        );
        if (!instance) {
          continue;
        }
        const prior = previous.get(seat.frameId);
        if (!prior) {
          attach(instance);
          continue;
        }
        if (prior === seat.instanceId) {
          continue;
        }
        detach(prior);
        attach(instance);
        channel.emit(SET_CURRENT_STORY, {
          storyId: instance.storyId,
          viewMode: 'story',
          managerDocsInstance: instance.instanceId,
          args: instance.args,
          globals: instance.globals,
          options: { target: prior },
        });
      }
      for (const [frameId, instanceId] of previous) {
        if (!synced.seats.some((seat) => seat.frameId === frameId)) {
          detach(instanceId);
        }
      }
      setSeats(
        synced.seats.map((seat) => ({ frameId: seat.frameId, instanceId: seat.instanceId }))
      );
    };
    syncVisibleRef.current = syncVisible;

    const apply = (update: LiveDocsUpdate) => {
      const before = liveRef.current?.model.instances ?? [];
      for (const instance of update.removed) {
        detach(instance.instanceId);
        visibleRef.current.delete(instance.instanceId);
      }
      liveRef.current = update.live;
      resize(before, update.live.model.instances);
      setModel(update.live.model);
      setSourceError(update.live.error);
    };

    const build = (source: string) =>
      buildDocsModel({
        file: mdxFile,
        source,
        entries: indexedEntries(indexRef.current),
        globals: api.getGlobals() ?? {},
      });

    const onSourceChange = (change: MdxSourceChange) => {
      if (change.importPath !== mdxFile) {
        return;
      }
      if (!liveRef.current) {
        pending = pending && pending.revision >= change.revision ? pending : change;
        return;
      }
      apply(acceptMdxSourceChange(liveRef.current, change, build));
    };
    if (!productionBuild) {
      channel.on(MDX_SOURCE_CHANGED, onSourceChange);
    }

    const root = document.getElementById('storybook-preview-wrapper');
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              let changed = false;
              for (const entry of entries) {
                const instanceId = (entry.target as HTMLElement).dataset.storyPlaceholder;
                if (!instanceId) {
                  continue;
                }
                if (entry.isIntersecting) {
                  if (!visibleRef.current.has(instanceId)) {
                    visibleRef.current.add(instanceId);
                    changed = true;
                  }
                } else if (visibleRef.current.delete(instanceId)) {
                  changed = true;
                }
              }
              if (changed) {
                syncVisible();
              }
            },
            { root: root ?? undefined, threshold: 0 }
          );
    observerRef.current = observer;

    loadDocsArticle({
      file: mdxFile,
      channel,
      entries: indexedEntries(indexRef.current),
      globals: api.getGlobals() ?? {},
      production: productionBuild,
      readManifest: fetchStaticMdxManifest,
    })
      .then((opened) => {
        if (cancelled) {
          return;
        }
        setContentHeights({});
        setFailure(null);
        apply({
          live: {
            model: opened.model,
            source: opened.source,
            latest: opened.source,
            revision: 0,
            error: null,
          },
          added: opened.model.instances,
          removed: [],
        });
        if (!productionBuild) {
          sessionRef.current = { apply, build };
        }
        if (pending && liveRef.current) {
          apply(acceptMdxSourceChange(liveRef.current, pending, build));
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setModel(null);
        setFailure(error instanceof Error ? error.message : String(error));
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      observerRef.current = null;
      channel.off(MDX_SOURCE_CHANGED, onSourceChange);
      for (const stop of listeners.values()) {
        stop();
      }
      for (const frame of framesRef.current.values()) {
        frame.remove();
      }
      framesRef.current.clear();
      initialSearchRef.current.clear();
      placeholdersRef.current.clear();
      transport.disconnect();
      transportRef.current = null;
      playsRef.current = null;
      liveRef.current = null;
      sessionRef.current = null;
      hostRef.current = releaseDocsFrames(hostRef.current);
      hostRef.current = createIframeHost();
    };
  }, [api, mdxFile, entry?.type]);

  useEffect(() => {
    const live = liveRef.current;
    const session = sessionRef.current;
    if (live && session) {
      session.apply(refreshDocsPage(live, session.build));
    }
  }, [index]);

  useLayoutEffect(() => {
    if (!model) {
      return;
    }
    for (const node of placeholdersRef.current.values()) {
      observerRef.current?.observe(node);
    }
    if (visibleRef.current.size === 0) {
      for (const [instanceId, node] of placeholdersRef.current) {
        if (intersectsPane(node)) {
          visibleRef.current.add(instanceId);
        }
      }
      const first = model.instances[0];
      if (visibleRef.current.size === 0 && first) {
        visibleRef.current.add(first.instanceId);
      }
    }
    syncVisibleRef.current();
  }, [model]);

  useLayoutEffect(() => {
    if (!model) {
      return;
    }
    const byId = new Map(model.instances.map((instance) => [instance.instanceId, instance]));
    for (const seat of seats) {
      const instance = byId.get(seat.instanceId);
      const placeholder = placeholdersRef.current.get(seat.instanceId);
      const occupant = hostRef.current.sessions.find(
        (session) => session.frameId === seat.frameId
      )?.occupant;
      if (!instance || !placeholder || !occupant) {
        continue;
      }
      let frame = framesRef.current.get(seat.frameId);
      if (!frame) {
        const search = initialSearchRef.current.get(seat.frameId) ?? occupant.search;
        initialSearchRef.current.set(seat.frameId, search);
        frame = document.createElement('iframe');
        frame.src = `${baseUrl}?${search}`;
        frame.setAttribute('data-manager-docs-frame', seat.frameId);
        frame.addEventListener('load', () => {
          const current = hostRef.current.sessions.find(
            (session) => session.frameId === seat.frameId
          )?.occupant;
          if (current) {
            pushInstanceState(hostRef.current, transportRef.current, current.instanceId);
          }
        });
        framesRef.current.set(seat.frameId, frame);
      }
      const width = docsFrameWidth(
        instance.globals,
        instanceParameter<DocsViewportParameter>(api, instance.storyId, 'viewport')
      );
      frame.dataset.instanceId = occupant.instanceId;
      frame.dataset.managerDocsInstance = occupant.instanceId;
      frame.title = occupant.storyId;
      frame.setAttribute('data-docs-viewport-width', width);
      Object.assign(frame.style, {
        ...docsFrameStyle(width),
        ...storyFrameStyle(
          instance.height,
          instance.ratio,
          contentHeights[instance.instanceId],
          viewportHeight
        ),
        border: '0',
      });
      if (frame.parentElement !== placeholder) {
        placeholder.appendChild(frame);
      }
    }
    for (const [frameId, frame] of framesRef.current) {
      if (!seats.some((seat) => seat.frameId === frameId)) {
        frame.remove();
        framesRef.current.delete(frameId);
        initialSearchRef.current.delete(frameId);
      }
    }
  }, [api, baseUrl, contentHeights, model, seats, viewportHeight]);

  if (!model) {
    return <p>{failure ?? 'Loading documentation.'}</p>;
  }

  const updateLiveModel = (update: (current: DocsArticleModel) => DocsArticleModel) => {
    const live = liveRef.current;
    if (!live) {
      return;
    }
    liveRef.current = { ...live, model: update(live.model) };
    setModel(liveRef.current.model);
  };

  return (
    <DocsColumn>
      {sourceError && (
        <SourceErrorBanner role="alert">
          <strong>
            {sourceError.file}:{sourceError.line}:{sourceError.column}
          </strong>{' '}
          {sourceError.message} Showing the last version that parsed.
        </SourceErrorBanner>
      )}
      <ManagerDocsView
        model={model}
        playPanels={playPanels}
        interactions={interactions}
        actions={actions}
        renderFrame={(instance) => {
          const width = docsFrameWidth(
            instance.globals,
            instanceParameter<DocsViewportParameter>(api, instance.storyId, 'viewport')
          );
          return (
            <div
              data-story-placeholder={instance.instanceId}
              ref={(node) => {
                const current = placeholdersRef.current.get(instance.instanceId);
                if (current && current !== node) {
                  observerRef.current?.unobserve(current);
                }
                if (node) {
                  placeholdersRef.current.set(instance.instanceId, node);
                  observerRef.current?.observe(node);
                } else {
                  placeholdersRef.current.delete(instance.instanceId);
                }
              }}
              style={{
                ...docsFrameStyle(width),
                ...storyFrameStyle(
                  instance.height,
                  instance.ratio,
                  contentHeights[instance.instanceId],
                  viewportHeight
                ),
              }}
            />
          );
        }}
        onClearActions={(instanceId) => {
          setActions((current) => clearInstanceActions(current, instanceId));
        }}
        onGlobalsChange={(instanceId, globals) => {
          if (!transportRef.current) {
            return;
          }
          updateLiveModel((current) => withInstanceGlobals(current, instanceId, globals));
          if (
            !hostRef.current.sessions.some((session) => session.occupant?.instanceId === instanceId)
          ) {
            return;
          }
          transportRef.current.updateGlobals(instanceId, globals);
          hostRef.current = writeDocsInstanceGlobals(hostRef.current, instanceId, globals);
        }}
        onRerun={(instanceId) => {
          const instance = liveRef.current?.model.instances.find(
            (candidate) => candidate.instanceId === instanceId
          );
          if (!instance || !playsRef.current) {
            return;
          }
          // Re-queuing through the scheduler (not a fresh queue) lets a rerun of a focus play
          // pause whatever else is running, exactly as the first run did.
          playsRef.current.leave(instanceId);
          playsRef.current.enter({
            instanceId,
            focus: instance.focus,
            documentOrder: instance.documentOrder,
          });
          addons.getChannel().emit(FORCE_REMOUNT, {
            storyId: instance.storyId,
            options: { target: instanceId },
          });
        }}
        onDebugger={(instanceId, type, payload) => {
          const storyId = liveRef.current?.model.instances.find(
            (instance) => instance.instanceId === instanceId
          )?.storyId;
          if (storyId) {
            transportRef.current?.sendDebugger(instanceId, storyId, type, payload);
          }
        }}
      />
    </DocsColumn>
  );
}

function intersectsPane(node: Element): boolean {
  const root = document.getElementById('storybook-preview-wrapper');
  const bounds = (root ?? document.documentElement).getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  return (
    rect.bottom > bounds.top &&
    rect.top < bounds.bottom &&
    rect.right > bounds.left &&
    rect.left < bounds.right
  );
}

function readPaneHeights(): number[] {
  const wrapper = document.getElementById('storybook-preview-wrapper');
  if (!wrapper) {
    return [];
  }
  const heights = [wrapper.clientHeight];
  let node = wrapper.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    heights.push(node.clientHeight);
    node = node.parentElement;
  }
  return heights;
}

function pushInstanceState(
  host: IframeHost,
  transport: InstanceTransport | null,
  instanceId: string
) {
  const occupant = host.sessions.find(
    (session) => session.occupant?.instanceId === instanceId
  )?.occupant;
  if (!occupant || !transport) {
    return;
  }
  if (occupant.argsFromIndex) {
    transport.updateArgs(occupant.instanceId, occupant.storyId, occupant.args);
  }
  if (Object.keys(occupant.globals).length > 0) {
    transport.updateGlobals(occupant.instanceId, occupant.globals);
  }
}

function indexedEntries(
  index: { entries: Record<string, IndexedEntry> } | undefined
): IndexedEntry[] {
  return index ? Object.values(index.entries) : [];
}

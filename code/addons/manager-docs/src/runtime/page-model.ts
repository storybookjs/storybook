import { parseFailure } from '../errors.ts';
import {
  STORY_PANEL_IDS,
  type Block,
  type DocsPage,
  type SourcePosition,
  type StoryFrameHeight,
  type StoryPanel,
  type StoryPanelId,
} from '../parser/types.ts';

export type StoryArgs = Record<string, unknown>;

export type StoryReference = {
  importSource: string;
  exportName: string;
};

export type ResolvedStory = {
  storyId: string;
  args?: StoryArgs;
};

export type StoryResolver = (reference: StoryReference) => ResolvedStory | undefined;

export type StoryInstance = {
  instanceId: string;
  storyId: string;
  importSource: string;
  exportName: string;
  focus: boolean;
  height?: StoryFrameHeight;
  ratio?: number;
  toolbar?: boolean;
  panel?: StoryPanel;
  documentOrder: number;
  position: SourcePosition;
  args: StoryArgs;
  argsFromIndex: boolean;
  globals: StoryArgs;
};

export type DocsArticleModel = {
  blocks: Block[];
  instances: StoryInstance[];
};

export function showsStoryToolbar(toolbar: boolean | undefined): boolean {
  return toolbar !== false;
}

export function displayedStoryPanel(
  panel: boolean | readonly StoryPanelId[] | undefined
): readonly StoryPanelId[] {
  if (panel === undefined || panel === true) {
    return STORY_PANEL_IDS;
  }
  if (panel === false) {
    return [];
  }
  return panel;
}

/**
 * Turn a parsed page into document-ordered story instances.
 *
 * Each `<Alias.Story>` becomes its own instance, even when two blocks reference the same story.
 * Args and globals are copies, so later control edits do not change the CSF args or another instance.
 *
 * @throws {ManagerDocsParseError} When `of` does not name an imported CSF export the resolver knows.
 */
export function createArticleModel(
  page: DocsPage,
  resolveStory: StoryResolver,
  globals: StoryArgs,
  file: string
): DocsArticleModel {
  const instances: StoryInstance[] = [];
  for (const block of page.blocks) {
    collectStories(block, page, resolveStory, globals, file, instances);
  }
  return { blocks: page.blocks, instances };
}

export type ArticleReconciliation = {
  model: DocsArticleModel;
  added: StoryInstance[];
  removed: StoryInstance[];
};

/**
 * Carry live instance state from the shown page into a newly parsed one.
 *
 * Instances match on story id and occurrence. A matched instance keeps its args and globals and takes
 * the new block's focus, sizing, toolbar, and panel. Unmatched instances are reported as added or
 * removed so the caller can mount or release their frames.
 */
export function reconcileArticleModel(
  previous: DocsArticleModel | null,
  next: DocsArticleModel
): ArticleReconciliation {
  const live = new Map(previous?.instances.map((instance) => [instance.instanceId, instance]));
  const added: StoryInstance[] = [];
  const instances = next.instances.map((instance) => {
    const current = live.get(instance.instanceId);
    if (!current) {
      added.push(instance);
      return instance;
    }
    return {
      ...instance,
      args: current.args,
      argsFromIndex: current.argsFromIndex,
      globals: current.globals,
    };
  });
  const kept = new Set(instances.map((instance) => instance.instanceId));
  return {
    model: { blocks: next.blocks, instances },
    added,
    removed: [...live.values()].filter((instance) => !kept.has(instance.instanceId)),
  };
}

function collectStories(
  block: Block,
  page: DocsPage,
  resolveStory: StoryResolver,
  globals: StoryArgs,
  file: string,
  instances: StoryInstance[]
) {
  if (block.type === 'story') {
    instances.push(createInstance(block, page, resolveStory, globals, file, instances));
    return;
  }
  if (block.type === 'blockquote') {
    for (const child of block.children) {
      collectStories(child, page, resolveStory, globals, file, instances);
    }
  }
  if (block.type === 'list') {
    for (const item of block.items) {
      for (const child of item.children) {
        collectStories(child, page, resolveStory, globals, file, instances);
      }
    }
  }
}

function createInstance(
  block: Extract<Block, { type: 'story' }>,
  page: DocsPage,
  resolveStory: StoryResolver,
  globals: StoryArgs,
  file: string,
  instances: readonly StoryInstance[]
): StoryInstance {
  const importSource = sourceForBinding(page, block.moduleName);
  if (!importSource) {
    parseFailure(
      file,
      block.position.line,
      block.position.column,
      'unresolved-story',
      `No CSF import is bound to "${block.moduleName}".`
    );
  }
  const resolved = resolveStory({ importSource, exportName: block.exportName });
  if (!resolved) {
    parseFailure(
      file,
      block.position.line,
      block.position.column,
      'unresolved-story',
      `Cannot resolve ${block.moduleName}.${block.exportName} from "${importSource}".`
    );
  }
  const occurrence =
    instances.filter((instance) => instance.storyId === resolved.storyId).length + 1;
  return {
    instanceId: `${resolved.storyId}#${occurrence}`,
    storyId: resolved.storyId,
    importSource,
    exportName: block.exportName,
    focus: block.focus,
    ...(block.height !== undefined ? { height: block.height } : {}),
    ...(block.ratio !== undefined ? { ratio: block.ratio } : {}),
    ...(block.toolbar !== undefined ? { toolbar: block.toolbar } : {}),
    ...(block.panel !== undefined ? { panel: block.panel } : {}),
    documentOrder: instances.length,
    position: block.position,
    args: structuredClone(resolved.args ?? {}),
    argsFromIndex: resolved.args !== undefined,
    globals: structuredClone(globals),
  };
}

function sourceForBinding(page: DocsPage, binding: string): string | undefined {
  return page.imports.find((statement) => statement.bindings.includes(binding))?.source;
}

import React, { useState, type ReactNode } from 'react';

import {
  StatelessTab,
  StatelessTabList,
  StatelessTabPanel,
  StatelessTabsView,
} from 'storybook/internal/components';

import { styled } from 'storybook/theming';

import { ActionLogger } from '../../../../core/src/actions/components/ActionLogger/index.tsx';
import type { ActionDisplay } from '../../../../core/src/actions/models/index.ts';
import { DOCS_ARTICLE_ALIGN } from '../runtime/frame-height.ts';
import { DOCS_FRAME_ALIGN } from '../runtime/frame-viewport.ts';
import type { Block, Inline, ListItem, StoryPanelId } from '../parser/types.ts';
import { instanceActions, type ActionsRegistry } from '../runtime/instance-actions.ts';
import {
  instanceInteractions,
  type InstanceInteractions,
  type InteractionsRegistry,
} from '../runtime/instance-interactions.ts';
import {
  displayedStoryPanel,
  showsStoryToolbar,
  type DocsArticleModel,
  type StoryArgs,
  type StoryInstance,
} from '../runtime/page-model.ts';
import {
  playPanelState,
  type PlayPanelRegistry,
  type PlayPanelState,
} from '../runtime/play-panel.ts';
import { ComponentBlockHost } from './ComponentBlockHost.tsx';
import { InstanceInteractionsPanel } from './InstanceInteractionsPanel.tsx';
import { InstanceToolbar } from './InstanceToolbar.tsx';

const Article = styled.article(({ theme }) => ({
  ...DOCS_ARTICLE_ALIGN,
  background: theme.appContentBg,
  color: theme.textColor,
  fontFamily: theme.fontBase,
  fontSize: theme.typography.size.s2,
  lineHeight: '1.6',
  padding: '24px 32px 48px',
  maxWidth: 960,
  boxSizing: 'border-box',
}));

const StoryCard = styled.section(({ theme }) => ({
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: theme.appBorderRadius,
  margin: '16px 0 24px',
  overflow: 'visible',
  background: theme.appBg,
}));

const FrameSlot = styled.div({
  ...DOCS_FRAME_ALIGN,
  width: '100%',
  minHeight: 48,
});

const CanvasRow = styled.div({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
});

const PanelAside = styled.aside(({ theme }) => ({
  flex: '0 0 380px',
  width: 380,
  height: 480,
  minWidth: 0,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  border: `1px solid ${theme.appBorderColor}`,
  borderRadius: theme.appBorderRadius,
  background: theme.background.content,
}));

const ActionsBody = styled.div({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  '& > :first-child': {
    flex: 1,
    minHeight: 0,
  },
});

const QuietNote = styled.p(({ theme }) => ({
  margin: 0,
  padding: 12,
  color: theme.textMutedColor,
  fontSize: theme.typography.size.s1,
}));

const Code = styled.code(({ theme }) => ({
  fontFamily: theme.fontCode,
  background: theme.appBg,
  padding: '1px 4px',
  borderRadius: theme.appBorderRadius,
}));

const Pre = styled.pre(({ theme }) => ({
  fontFamily: theme.fontCode,
  background: theme.appBg,
  padding: 12,
  overflow: 'auto',
  borderRadius: theme.appBorderRadius,
}));

const Quote = styled.blockquote(({ theme }) => ({
  margin: '16px 0',
  paddingLeft: 12,
  borderLeft: `3px solid ${theme.colorSecondary}`,
  color: theme.textMutedColor,
}));

const PANEL_LABEL: Record<StoryPanelId, string> = {
  actions: 'Actions',
  interactions: 'Interactions',
};

export type ManagerDocsViewProps = {
  model: DocsArticleModel;
  playPanels: PlayPanelRegistry;
  interactions: InteractionsRegistry;
  actions: ActionsRegistry;
  renderFrame: (instance: StoryInstance) => ReactNode;
  onClearActions: (instanceId: string) => void;
  onGlobalsChange: (instanceId: string, globals: StoryArgs) => void;
  onRerun: (instanceId: string) => void;
  onDebugger: (instanceId: string, type: string, payload?: Record<string, unknown>) => void;
};

/**
 * Render a parsed docs page in the manager theme, one frame per story.
 *
 * Omitted `toolbar` shows the manager's registered toolbar tools, scoped to that story's frame.
 * `toolbar={false}` and `toolbar={[]}` hide it. Omitted `panel` and `panel={true}` show Actions
 * and Interactions. `panel={false}` and `panel={[]}` show no panel.
 */
export function ManagerDocsView({
  model,
  playPanels,
  interactions,
  actions,
  renderFrame,
  onClearActions,
  onGlobalsChange,
  onRerun,
  onDebugger,
}: ManagerDocsViewProps) {
  return (
    <Article aria-label="Documentation">
      {keyedBlocks(model.blocks, model.instances).map(({ key, item, instances }) => (
        <BlockView
          key={key}
          block={item}
          instances={instances}
          playPanels={playPanels}
          interactions={interactions}
          actions={actions}
          renderFrame={renderFrame}
          onClearActions={onClearActions}
          onGlobalsChange={onGlobalsChange}
          onRerun={onRerun}
          onDebugger={onDebugger}
        />
      ))}
    </Article>
  );
}

function BlockView({
  block,
  instances,
  playPanels,
  interactions,
  actions,
  renderFrame,
  onClearActions,
  onGlobalsChange,
  onRerun,
  onDebugger,
}: {
  block: Block;
  instances: StoryInstance[];
  playPanels: ManagerDocsViewProps['playPanels'];
  interactions: ManagerDocsViewProps['interactions'];
  actions: ManagerDocsViewProps['actions'];
  renderFrame: (instance: StoryInstance) => ReactNode;
  onClearActions: ManagerDocsViewProps['onClearActions'];
  onGlobalsChange: ManagerDocsViewProps['onGlobalsChange'];
  onRerun: ManagerDocsViewProps['onRerun'];
  onDebugger: ManagerDocsViewProps['onDebugger'];
}) {
  if (block.type === 'story') {
    const instance = instances[0];
    if (!instance) {
      return null;
    }
    return (
      <StoryFrame
        instance={instance}
        iframe={renderFrame(instance)}
        playPanel={playPanelState(playPanels, instance.instanceId)}
        interactions={instanceInteractions(interactions, instance.instanceId, instance.storyId)}
        actions={instanceActions(actions, instance.instanceId)}
        onClearActions={onClearActions}
        onGlobalsChange={onGlobalsChange}
        onRerun={onRerun}
        onDebugger={onDebugger}
      />
    );
  }
  if (block.type === 'component') {
    return <ComponentBlockHost block={block} />;
  }
  if (block.type === 'heading') {
    return <Heading depth={block.depth}>{renderInlines(block.children)}</Heading>;
  }
  if (block.type === 'paragraph') {
    return <p>{renderInlines(block.children)}</p>;
  }
  if (block.type === 'code') {
    return (
      <Pre>
        <code>{block.value}</code>
      </Pre>
    );
  }
  if (block.type === 'thematicBreak') {
    return <hr />;
  }
  if (block.type === 'blockquote') {
    return (
      <Quote>
        {keyedBlocks(block.children, instances).map(({ key, item, instances: own }) => (
          <BlockView
            key={key}
            block={item}
            instances={own}
            playPanels={playPanels}
            interactions={interactions}
            actions={actions}
            renderFrame={renderFrame}
            onClearActions={onClearActions}
            onGlobalsChange={onGlobalsChange}
            onRerun={onRerun}
            onDebugger={onDebugger}
          />
        ))}
      </Quote>
    );
  }
  if (block.type === 'list') {
    const ListTag = block.ordered ? 'ol' : 'ul';
    return (
      <ListTag start={block.ordered ? block.start : undefined}>
        {keyedItems(block.items, instances).map(({ key, item, instances: own }) => (
          <li key={key}>
            <ListItemView
              item={item}
              instances={own}
              playPanels={playPanels}
              interactions={interactions}
              actions={actions}
              renderFrame={renderFrame}
              onClearActions={onClearActions}
              onGlobalsChange={onGlobalsChange}
              onRerun={onRerun}
              onDebugger={onDebugger}
            />
          </li>
        ))}
      </ListTag>
    );
  }
  return (
    <table>
      <thead>
        <tr>
          {block.header.map((cell, index) => (
            <th key={index} style={{ textAlign: block.align[index] ?? undefined }}>
              {renderInlines(cell)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {block.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} style={{ textAlign: block.align[cellIndex] ?? undefined }}>
                {renderInlines(cell)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ListItemView({
  item,
  instances,
  playPanels,
  interactions,
  actions,
  renderFrame,
  onClearActions,
  onGlobalsChange,
  onRerun,
  onDebugger,
}: {
  item: ListItem;
  instances: StoryInstance[];
  playPanels: ManagerDocsViewProps['playPanels'];
  interactions: ManagerDocsViewProps['interactions'];
  actions: ManagerDocsViewProps['actions'];
  renderFrame: (instance: StoryInstance) => ReactNode;
  onClearActions: ManagerDocsViewProps['onClearActions'];
  onGlobalsChange: ManagerDocsViewProps['onGlobalsChange'];
  onRerun: ManagerDocsViewProps['onRerun'];
  onDebugger: ManagerDocsViewProps['onDebugger'];
}) {
  return (
    <>
      {keyedBlocks(item.children, instances).map(({ key, item: child, instances: own }) => (
        <BlockView
          key={key}
          block={child}
          instances={own}
          playPanels={playPanels}
          interactions={interactions}
          actions={actions}
          renderFrame={renderFrame}
          onClearActions={onClearActions}
          onGlobalsChange={onGlobalsChange}
          onRerun={onRerun}
          onDebugger={onDebugger}
        />
      ))}
    </>
  );
}

function StoryFrame({
  instance,
  iframe,
  playPanel,
  interactions,
  actions,
  onClearActions,
  onGlobalsChange,
  onRerun,
  onDebugger,
}: {
  instance: StoryInstance;
  iframe: ReactNode;
  playPanel: PlayPanelState;
  interactions: InstanceInteractions;
  actions: ActionDisplay[];
  onClearActions: ManagerDocsViewProps['onClearActions'];
  onGlobalsChange: ManagerDocsViewProps['onGlobalsChange'];
  onRerun: ManagerDocsViewProps['onRerun'];
  onDebugger: ManagerDocsViewProps['onDebugger'];
}) {
  const tabs = displayedStoryPanel(instance.panel);
  return (
    <StoryCard
      aria-label={instance.storyId}
      data-instance-id={instance.instanceId}
      data-story-id={instance.storyId}
    >
      {showsStoryToolbar(instance.toolbar) && (
        <InstanceToolbar
          label={`Toolbar for ${instance.storyId}`}
          instanceId={instance.instanceId}
          storyId={instance.storyId}
          globals={instance.globals}
          onGlobalsChange={onGlobalsChange}
        />
      )}
      <CanvasRow>
        <FrameSlot>{iframe}</FrameSlot>
        {tabs.length > 0 && (
          <StoryPanel
            instance={instance}
            tabs={tabs}
            playPanel={playPanel}
            interactions={interactions}
            actions={actions}
            onClearActions={onClearActions}
            onRerun={onRerun}
            onDebugger={onDebugger}
          />
        )}
      </CanvasRow>
    </StoryCard>
  );
}

function StoryPanel({
  instance,
  tabs,
  playPanel,
  interactions,
  actions,
  onClearActions,
  onRerun,
  onDebugger,
}: {
  instance: StoryInstance;
  tabs: readonly StoryPanelId[];
  playPanel: PlayPanelState;
  interactions: InstanceInteractions;
  actions: ActionDisplay[];
  onClearActions: ManagerDocsViewProps['onClearActions'];
  onRerun: ManagerDocsViewProps['onRerun'];
  onDebugger: ManagerDocsViewProps['onDebugger'];
}) {
  const [selected, setSelected] = useState<StoryPanelId>(tabs[0] ?? 'actions');
  const active = tabs.includes(selected) ? selected : (tabs[0] ?? 'actions');
  const label = `Panel for ${instance.storyId}`;
  return (
    <PanelAside aria-label={label}>
      <StatelessTabsView
        selected={active}
        onSelectionChange={(id) => {
          if (tabs.includes(id as StoryPanelId)) {
            setSelected(id as StoryPanelId);
          }
        }}
      >
        <StatelessTabList aria-label={label}>
          {tabs.map((id) => (
            <StatelessTab key={id} name={id}>
              {PANEL_LABEL[id]}
            </StatelessTab>
          ))}
        </StatelessTabList>
        {tabs.map((id) => (
          <StatelessTabPanel key={id} name={id} hasScrollbar={false}>
            {id === 'actions' ? (
              <ActionsBody>
                <ActionLogger
                  actions={actions}
                  expandLevel={1}
                  onClear={() => onClearActions(instance.instanceId)}
                />
              </ActionsBody>
            ) : (
              <InteractionsTab
                instance={instance}
                playPanel={playPanel}
                interactions={interactions}
                onRerun={onRerun}
                onDebugger={onDebugger}
              />
            )}
          </StatelessTabPanel>
        ))}
      </StatelessTabsView>
    </PanelAside>
  );
}

function InteractionsTab({
  instance,
  playPanel,
  interactions,
  onRerun,
  onDebugger,
}: {
  instance: StoryInstance;
  playPanel: PlayPanelState;
  interactions: InstanceInteractions;
  onRerun: ManagerDocsViewProps['onRerun'];
  onDebugger: ManagerDocsViewProps['onDebugger'];
}) {
  if (!playPanel.hasPlayFunction) {
    return <QuietNote>No play function</QuietNote>;
  }
  return (
    <InstanceInteractionsPanel
      storyId={instance.storyId}
      label={`Interactions for ${instance.storyId}`}
      state={interactions}
      onDebugger={(type, payload) => onDebugger(instance.instanceId, type, payload)}
      onRerun={() => onRerun(instance.instanceId)}
    />
  );
}

function Heading({ depth, children }: { depth: 1 | 2 | 3 | 4 | 5 | 6; children: ReactNode }) {
  if (depth === 1) {
    return <h1>{children}</h1>;
  }
  if (depth === 2) {
    return <h2>{children}</h2>;
  }
  if (depth === 3) {
    return <h3>{children}</h3>;
  }
  if (depth === 4) {
    return <h4>{children}</h4>;
  }
  if (depth === 5) {
    return <h5>{children}</h5>;
  }
  return <h6>{children}</h6>;
}

function renderInlines(nodes: Inline[]): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.type === 'text') {
      return <React.Fragment key={index}>{node.value}</React.Fragment>;
    }
    if (node.type === 'emphasis') {
      return <em key={index}>{renderInlines(node.children)}</em>;
    }
    if (node.type === 'strong') {
      return <strong key={index}>{renderInlines(node.children)}</strong>;
    }
    if (node.type === 'inlineCode') {
      return <Code key={index}>{node.value}</Code>;
    }
    if (node.type === 'image') {
      return <img key={index} alt={node.alt} src={node.url} title={node.title} />;
    }
    return (
      <a key={index} href={node.url} title={node.title}>
        {renderInlines(node.children)}
      </a>
    );
  });
}

type Keyed<Item> = { key: string; item: Item; instances: StoryInstance[] };

// Keys anchor on the preceding story, so inserted prose never makes React move a story frame.
function keyed<Item>(
  items: readonly Item[],
  instances: readonly StoryInstance[],
  stories: (item: Item) => number,
  kind: (item: Item) => string
): Keyed<Item>[] {
  let cursor = 0;
  let anchor = 'start';
  let offset = 0;
  return items.map((item) => {
    const own = instances.slice(cursor, cursor + stories(item));
    cursor += own.length;
    if (own[0]) {
      anchor = own[0].instanceId;
      offset = 0;
      return { key: `story:${anchor}`, item, instances: own };
    }
    offset += 1;
    return { key: `${anchor}/${kind(item)}:${offset}`, item, instances: own };
  });
}

function keyedBlocks(blocks: readonly Block[], instances: readonly StoryInstance[]) {
  return keyed(blocks, instances, blockStories, (block) => block.type);
}

function keyedItems(items: readonly ListItem[], instances: readonly StoryInstance[]) {
  return keyed(items, instances, itemStories, () => 'item');
}

function blockStories(block: Block): number {
  if (block.type === 'story') {
    return 1;
  }
  if (block.type === 'blockquote') {
    return block.children.reduce((total, child) => total + blockStories(child), 0);
  }
  if (block.type === 'list') {
    return block.items.reduce((total, item) => total + itemStories(item), 0);
  }
  return 0;
}

function itemStories(item: ListItem): number {
  return item.children.reduce((total, child) => total + blockStories(child), 0);
}

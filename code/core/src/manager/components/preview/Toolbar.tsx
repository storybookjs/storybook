import React from 'react';

import { AbstractToolbar, Button, Separator, TabList } from 'storybook/internal/components';
import { type Addon_BaseType, Addon_TypesEnum } from 'storybook/internal/types';

import { CloseIcon, ExpandIcon } from '@storybook/icons';

import type { TabListState } from '@react-stately/tabs';
import {
  type API,
  type Combo,
  Consumer,
  type LeafEntry,
  type State,
  addons,
  merge,
  types,
} from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { useLayout } from '../layout/LayoutProvider';
import type { PreviewProps } from './utils/types';

export const getTools = (getFn: API['getElements']) => Object.values(getFn(types.TOOL));
export const getToolsExtra = (getFn: API['getElements']) => Object.values(getFn(types.TOOLEXTRA));

const fullScreenMapper = ({ api, state }: Combo) => {
  return {
    toggle: api.toggleFullscreen,
    isFullscreen: api.getIsFullscreen(),
    shortcut: api.getShortcutKeys().fullScreen,
    hasPanel: Object.keys(api.getElements(Addon_TypesEnum.PANEL)).length > 0,
    singleStory: state.singleStory,
  };
};

export const fullScreenTool: Addon_BaseType = {
  title: 'fullscreen',
  id: 'fullscreen',
  type: types.TOOL,
  // @ts-expect-error (non strict)
  match: (p) => ['story', 'docs'].includes(p.viewMode),
  render: () => {
    const { isMobile } = useLayout();

    if (isMobile) {
      return null;
    }

    return (
      <Consumer filter={fullScreenMapper}>
        {({ toggle, isFullscreen, shortcut, hasPanel, singleStory }) =>
          (!singleStory || (singleStory && hasPanel)) && (
            <Button
              key="full"
              padding="small"
              variant="ghost"
              onClick={() => toggle()}
              ariaLabel={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
              shortcut={shortcut}
            >
              {isFullscreen ? <CloseIcon /> : <ExpandIcon />}
            </Button>
          )
        }
      </Consumer>
    );
  },
};

export interface ToolData {
  isShown: boolean;
  tabs: Addon_BaseType[];
  tabState: TabListState<object>;
  tools: Addon_BaseType[];
  toolsExtra: Addon_BaseType[];
}

export const ToolbarComp = React.memo<ToolData>(function ToolbarComp({
  isShown,
  tools,
  toolsExtra,
  tabs,
  tabState,
}) {
  return isShown && (tabs || tools || toolsExtra) ? (
    <StyledSection
      className="sb-bar"
      key="toolbar"
      data-testid="sb-preview-toolbar"
      aria-labelledby="sb-preview-toolbar-title"
    >
      <h2 id="sb-preview-toolbar-title" className="sb-sr-only">
        Toolbar
      </h2>
      {tabs.length > 1 ? (
        <>
          <TabList state={tabState} />
          <Separator />
        </>
      ) : null}
      <StyledToolbar>
        <Tools key="left" list={tools} />
        <Tools key="right" list={toolsExtra} />
      </StyledToolbar>
    </StyledSection>
  ) : null;
});

export const Tools = React.memo<{ list: Addon_BaseType[] }>(function Tools({ list }) {
  return (
    <ToolGroup>
      {list.filter(Boolean).map(({ render: Render, id, ...t }, index) => (
        // @ts-expect-error (Converted from ts-ignore)
        <Render key={id || t.key || `f-${index}`} />
      ))}
    </ToolGroup>
  );
});

function toolbarItemHasBeenExcluded(item: Partial<Addon_BaseType>, entry: LeafEntry | undefined) {
  const parameters = entry?.type === 'story' && entry?.prepared ? entry?.parameters : {};
  // @ts-expect-error (non strict)
  const toolbarItemsFromStoryParameters = 'toolbar' in parameters ? parameters.toolbar : undefined;
  const { toolbar: toolbarItemsFromAddonsConfig } = addons.getConfig();

  const toolbarItems = merge(
    toolbarItemsFromAddonsConfig || {},
    toolbarItemsFromStoryParameters || {}
  );

  // @ts-expect-error (non strict)
  return toolbarItems ? !!toolbarItems[item?.id]?.hidden : false;
}

export function filterToolsSide(
  tools: Addon_BaseType[],
  entry: PreviewProps['entry'],
  viewMode: State['viewMode'],
  location: State['location'],
  path: State['path'],
  tabId: string
) {
  const filter = (item: Partial<Addon_BaseType>) =>
    item &&
    (!item.match ||
      item.match({
        storyId: entry?.id,
        refId: entry?.refId,
        viewMode,
        location,
        path,
        tabId,
      })) &&
    !toolbarItemHasBeenExcluded(item, entry);

  return tools.filter(filter);
}

const StyledSection = styled.section(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  color: theme.barTextColor,
  width: '100%',
  flexShrink: 0,
  overflowX: 'auto',
  overflowY: 'hidden',
  boxShadow: `${theme.appBorderColor}  0 -1px 0 0 inset`,
  background: theme.barBg,
  scrollbarColor: `${theme.barTextColor} ${theme.barBg}`,
  scrollbarWidth: 'thin',
  zIndex: 4,
}));

const StyledToolbar = styled(AbstractToolbar)({
  flex: 1,
  display: 'flex',
  justifyContent: 'space-between',
  flexWrap: 'nowrap',
  flexShrink: 0,
  height: 40,
  marginInline: 10,
  gap: 30,
});

const ToolGroup = styled.div({
  display: 'flex',
  whiteSpace: 'nowrap',
  flexBasis: 'auto',
  gap: 6,
  alignItems: 'center',
});

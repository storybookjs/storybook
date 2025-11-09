import React, { Fragment, useId } from 'react';

import { IconButton, Separator, TabBar, TabButton } from 'storybook/internal/components';
import { type Addon_BaseType, Addon_TypesEnum } from 'storybook/internal/types';

import { CloseIcon, ExpandIcon } from '@storybook/icons';

import {
  type API,
  type Combo,
  Consumer,
  type LeafEntry,
  type State,
  addons,
  merge,
  shortcutToHumanString,
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
    shortcut: shortcutToHumanString(api.getShortcutKeys().fullScreen),
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
            <IconButton
              key="full"
              onClick={toggle as any}
              title={`${isFullscreen ? 'Exit full screen' : 'Go full screen'} [${shortcut}]`}
              aria-label={isFullscreen ? 'Exit full screen' : 'Go full screen'}
            >
              {isFullscreen ? <CloseIcon /> : <ExpandIcon />}
            </IconButton>
          )
        }
      </Consumer>
    );
  },
};

const tabsMapper = ({ api, state }: Combo) => ({
  navigate: api.navigate,
  path: state.path,
  applyQueryParams: api.applyQueryParams,
});

export const createTabsTool = (tabs: Addon_BaseType[]): Addon_BaseType => ({
  title: 'title',
  id: 'title',
  type: types.TOOL,
  render: () => (
    <Consumer filter={tabsMapper}>
      {(rp) => (
        <Fragment>
          <TabBar key="tabs">
            {tabs
              .filter(({ hidden }) => !hidden)
              .map((tab, index) => {
                const tabIdToApply = tab.id === 'canvas' ? undefined : tab.id;
                const isActive = rp.path.includes(`tab=${tab.id}`);
                return (
                  <TabButton
                    disabled={!!tab.disabled}
                    active={isActive}
                    onClick={() => {
                      rp.applyQueryParams({ tab: tabIdToApply });
                    }}
                    key={tab.id || `tab-${index}`}
                  >
                    {tab.title as any}
                  </TabButton>
                );
              })}
          </TabBar>
          <Separator />
        </Fragment>
      )}
    </Consumer>
  ),
});

export interface ToolData {
  isShown: boolean;
  tabs: Addon_BaseType[];
  tools: Addon_BaseType[];
  tabId: string;
  toolsExtra: Addon_BaseType[];
  api: API;
}

export const ToolbarComp = React.memo<ToolData>(function ToolbarComp({
  isShown,
  tools,
  toolsExtra,
  tabs,
  tabId,
  api,
}) {
  const id = useId();
  return tabs || tools || toolsExtra ? (
    <Toolbar
      className="sb-bar"
      key="toolbar"
      shown={isShown}
      data-test-id="sb-preview-toolbar"
      aria-labelledby={id}
    >
      <span className="sb-sr-only" id={id}>
        Toolbar
      </span>
      <ToolbarInner>
        <ToolbarLeft>
          {tabs.length > 1 ? (
            <Fragment>
              <TabBar key="tabs">
                {tabs.map((tab, index) => {
                  return (
                    <TabButton
                      disabled={!!tab.disabled}
                      active={tab.id === tabId || (tab.id === 'canvas' && !tabId)}
                      onClick={() => {
                        api.applyQueryParams({ tab: tab.id === 'canvas' ? undefined : tab.id });
                      }}
                      key={tab.id || `tab-${index}`}
                    >
                      {tab.title as any}
                    </TabButton>
                  );
                })}
              </TabBar>
              <Separator />
            </Fragment>
          ) : null}
          <Tools key="left" list={tools} />
        </ToolbarLeft>
        <ToolbarRight>
          <Tools key="right" list={toolsExtra} />
        </ToolbarRight>
      </ToolbarInner>
    </Toolbar>
  ) : null;
});

export const Tools = React.memo<{ list: Addon_BaseType[] }>(function Tools({ list }) {
  return (
    <>
      {list.filter(Boolean).map(({ render: Render, id, ...t }, index) => (
        // @ts-expect-error (Converted from ts-ignore)
        <Render key={id || t.key || `f-${index}`} />
      ))}
    </>
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

const Toolbar = styled.section<{ shown: boolean }>(({ theme, shown }) => ({
  position: 'relative',
  color: theme.barTextColor,
  width: '100%',
  flexShrink: 0,
  overflowX: 'auto',
  overflowY: 'hidden',
  marginTop: shown ? 0 : -40,
  boxShadow: `${theme.appBorderColor}  0 -1px 0 0 inset`,
  background: theme.barBg,
  scrollbarColor: `${theme.barTextColor} ${theme.barBg}`,
  scrollbarWidth: 'thin',
  zIndex: 4,
}));

const ToolbarInner = styled.div({
  width: 'calc(100% - 20px)',
  display: 'flex',
  justifyContent: 'space-between',
  flexWrap: 'nowrap',
  flexShrink: 0,
  height: 40,
  marginLeft: 10,
  marginRight: 10,
});

const ToolbarLeft = styled.div({
  display: 'flex',
  whiteSpace: 'nowrap',
  flexBasis: 'auto',
  gap: 6,
  alignItems: 'center',
});

const ToolbarRight = styled(ToolbarLeft)({
  marginLeft: 30,
});

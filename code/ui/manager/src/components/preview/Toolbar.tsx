import type { FunctionComponent } from 'react';
import React, { Fragment, useMemo } from 'react';

import { styled } from '@storybook/theming';

import { IconButton, Separator, TabButton, TabBar } from '@storybook/components';
import {
  shortcutToHumanString,
  Consumer,
  type Combo,
  type API,
  type State,
  merge,
  type LeafEntry,
  addons,
  types,
} from '@storybook/manager-api';

import { Location, type RenderData } from '@storybook/router';
import { Addon_TypesEnum, type Addon_BaseType } from '@storybook/types';
import { CloseIcon, ExpandIcon } from '@storybook/icons';
import { zoomTool } from './tools/zoom';

import * as S from './utils/components';

import type { PreviewProps } from './utils/types';
import { copyTool } from './tools/copy';
import { ejectTool } from './tools/eject';
import { menuTool } from './tools/menu';
import { addonsTool } from './tools/addons';
import { remountTool } from './tools/remount';
import { useLayout } from '../layout/LayoutProvider';

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
  match: (p) => ['story', 'docs'].includes(p.viewMode),
  render: () => {
    const { isMobile } = useLayout();

    if (isMobile) return null;

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

const tabsMapper = ({ state }: Combo) => ({
  viewMode: state.docsOnly,
  storyId: state.storyId,
  path: state.path,
  location: state.location,
  refId: state.refId,
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
              .filter((p) => !p.hidden)
              .map((t, index) => {
                const to = t.route(rp);
                const isActive = rp.path === to;
                return (
                  <S.UnstyledLink key={t.id || `l${index}`} to={to}>
                    <TabButton disabled={t.disabled} active={isActive}>
                      {t.title as any}
                    </TabButton>
                  </S.UnstyledLink>
                );
              })}
          </TabBar>
          <Separator />
        </Fragment>
      )}
    </Consumer>
  ),
});

export const defaultTools: Addon_BaseType[] = [remountTool, zoomTool];
export const defaultToolsExtra: Addon_BaseType[] = [
  addonsTool,
  fullScreenTool,
  ejectTool,
  copyTool,
];

const useTools = (
  getElements: API['getElements'],
  tabs: Addon_BaseType[],
  viewMode: PreviewProps['viewMode'],
  entry: PreviewProps['entry'],
  location: PreviewProps['location'],
  path: PreviewProps['path']
) => {
  const toolsFromConfig = useMemo(
    () => getTools(getElements),
    [getElements, getTools(getElements).length]
  );
  const toolsExtraFromConfig = useMemo(() => getToolsExtra(getElements), [getElements]);

  const tools = useMemo(
    () => [...defaultTools, ...toolsFromConfig],
    [defaultTools, toolsFromConfig]
  );
  const toolsExtra = useMemo(
    () => [...defaultToolsExtra, ...toolsExtraFromConfig],
    [defaultToolsExtra, toolsExtraFromConfig]
  );

  return useMemo(() => {
    return ['story', 'docs'].includes(entry?.type)
      ? filterTools(tools, toolsExtra, tabs, {
          viewMode,
          entry,
          location,
          path,
        })
      : { left: tools, right: toolsExtra };
  }, [viewMode, entry, location, path, tools, toolsExtra, tabs]);
};

export interface ToolData {
  isShown: boolean;
  tabs: Addon_BaseType[];
  api: API;
  entry: LeafEntry;
}

export const ToolRes: FunctionComponent<ToolData & RenderData> = React.memo<ToolData & RenderData>(
  function ToolRes({ api, entry, tabs, isShown, location, path, viewMode }) {
    const { left, right } = useTools(api.getElements, tabs, viewMode, entry, location, path);

    return left || right ? (
      <Toolbar key="toolbar" shown={isShown} data-test-id="sb-preview-toolbar">
        <ToolbarInner>
          <ToolbarLeft>
            <Tools key="left" list={left} />
          </ToolbarLeft>
          <ToolbarRight>
            <Tools key="right" list={right} />
          </ToolbarRight>
        </ToolbarInner>
      </Toolbar>
    ) : null;
  }
);

export const ToolbarComp = React.memo<ToolData>(function ToolbarComp(props) {
  return (
    <Location>
      {({ location, path, viewMode }) => <ToolRes {...props} {...{ location, path, viewMode }} />}
    </Location>
  );
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

function toolbarItemHasBeenExcluded(item: Partial<Addon_BaseType>, entry: LeafEntry) {
  const parameters = entry.type === 'story' && entry.prepared ? entry.parameters : {};
  const toolbarItemsFromStoryParameters = 'toolbar' in parameters ? parameters.toolbar : undefined;
  const { toolbar: toolbarItemsFromAddonsConfig } = addons.getConfig();

  const toolbarItems = merge(toolbarItemsFromAddonsConfig, toolbarItemsFromStoryParameters);

  return toolbarItems ? !!toolbarItems[item.id]?.hidden : false;
}

export function filterTools(
  tools: Addon_BaseType[],
  toolsExtra: Addon_BaseType[],
  tabs: Addon_BaseType[],
  {
    viewMode,
    entry,
    location,
    path,
  }: {
    viewMode: State['viewMode'];
    entry: PreviewProps['entry'];
    location: State['location'];
    path: State['path'];
  }
) {
  const toolsLeft = [
    menuTool,
    tabs.filter((p) => !p.hidden).length > 1 && createTabsTool(tabs),
    ...tools,
  ];
  const toolsRight = [...toolsExtra];

  const filter = (item: Partial<Addon_BaseType>) =>
    item &&
    (!item.match ||
      item.match({
        storyId: entry.id,
        refId: entry.refId,
        viewMode,
        location,
        path,
      })) &&
    !toolbarItemHasBeenExcluded(item, entry);

  const left = toolsLeft.filter(filter);
  const right = toolsRight.filter(filter);

  return { left, right };
}

const Toolbar = styled.div<{ shown: boolean }>(({ shown }) => ({
  position: 'relative',
  width: '100%',
  height: 40,
  flexShrink: 0,
  overflowX: 'auto',
  overflowY: 'hidden',
  marginTop: shown ? 0 : -40,
  boxShadow: 'var(--sb-addonsToolbar-borderBottom) 0 -1px 0 0 inset',
  background: 'var(--sb-addonsToolbar-background)',
  zIndex: 4,
}));

const ToolbarInner = styled.div({
  position: 'absolute',
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

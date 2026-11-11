import type { ComponentProps } from 'react';
import React from 'react';

import type { Addon_BaseType, Addon_Collection, Addon_WrapperType } from 'storybook/internal/types';
import { Addon_TypesEnum } from 'storybook/internal/types';

import memoizerific from 'memoizerific';
import type { IndexHash, State } from 'storybook/manager-api';
import { Consumer } from 'storybook/manager-api';

import { Preview } from '../components/preview/Preview.tsx';
import { filterToolsSide, fullScreenTool } from '../components/preview/Toolbar.tsx';
import { defaultWrappers } from '../components/preview/Wrappers.tsx';
import { addonsTool } from '../components/preview/tools/addons.tsx';
import { menuTool } from '../components/preview/tools/menu.tsx';
import { openInEditorTool } from '../components/preview/tools/open-in-editor.tsx';
import { remountTool } from '../components/preview/tools/remount.tsx';
import { isolationModeTool } from '../components/preview/tools/share.tsx';
import { zoomTool } from '../components/preview/tools/zoom.tsx';
import type { PreviewProps } from '../components/preview/utils/types.tsx';

const defaultTools = [menuTool, remountTool];
const defaultToolsExtra = [
  isolationModeTool,
  zoomTool,
  addonsTool,
  fullScreenTool,
  openInEditorTool,
];

type FilterProps = [
  entry: PreviewProps['entry'],
  viewMode: State['viewMode'],
  location: State['location'],
  path: State['path'],
];

const memoizedTools = memoizerific(1)(
  (_, toolElements: Addon_Collection<Addon_BaseType>, filterProps: FilterProps) =>
    filterToolsSide([...defaultTools, ...Object.values(toolElements)], ...filterProps)
);
const memoizedExtra = memoizerific(1)(
  (_, extraElements: Addon_Collection<Addon_BaseType>, filterProps: FilterProps) =>
    filterToolsSide([...defaultToolsExtra, ...Object.values(extraElements)], ...filterProps)
);
const memoizedWrapper = memoizerific(1)((_, previewElements: Addon_Collection) => [
  ...defaultWrappers,
  ...Object.values(previewElements),
]);

export type Item = IndexHash[keyof IndexHash];

const splitTitleAddExtraSpace = (input: string) =>
  input.split('/').join(' / ').replace(/\s\s/, ' ');

const getDescription = (item: Item) => {
  if (item?.type === 'story' || item?.type === 'docs') {
    const { title, name } = item;
    return title && name ? splitTitleAddExtraSpace(`${title} - ${name} ⋅ Storybook`) : 'Storybook';
  }

  return item?.name ? `${item.name} ⋅ Storybook` : 'Storybook';
};

const mapper = ({
  api,
  state,
  // @ts-expect-error (non strict)
}: Parameters<ComponentProps<typeof Consumer>['filter']>[0]): Omit<
  ComponentProps<typeof Preview>,
  'withLoader' | 'id'
> => {
  const { layout, location, customQueryParams, storyId, refs, viewMode, path, refId } = state;
  const entry = api.getData(storyId, refId);

  const wrapperList = Object.values(api.getElements(Addon_TypesEnum.PREVIEW));
  const toolsList = Object.values(api.getElements(Addon_TypesEnum.TOOL));
  const toolsExtraList = Object.values(api.getElements(Addon_TypesEnum.TOOLEXTRA));

  const tools = memoizedTools(toolsList.length, api.getElements(Addon_TypesEnum.TOOL), [
    entry,
    viewMode,
    location,
    path,
  ]) as Addon_BaseType[];
  const toolsExtra = memoizedExtra(
    toolsExtraList.length,
    api.getElements(Addon_TypesEnum.TOOLEXTRA),
    [entry, viewMode, location, path]
  ) as Addon_BaseType[];

  return {
    api,
    entry,
    options: layout,
    description: getDescription(entry),
    viewMode,
    refs,
    storyId,
    baseUrl: 'iframe.html',
    path,
    queryParams: customQueryParams,
    tools: tools,
    toolsExtra: toolsExtra,
    wrappers: memoizedWrapper(
      wrapperList.length,
      api.getElements(Addon_TypesEnum.PREVIEW)
    ) as Addon_WrapperType[],
  };
};

const PreviewConnected = React.memo(function PreviewConnected(props: {
  id: string;
  withLoader: boolean;
}) {
  return (
    <Consumer filter={mapper}>{(fromState) => <Preview {...props} {...fromState} />}</Consumer>
  );
});

export default PreviewConnected;

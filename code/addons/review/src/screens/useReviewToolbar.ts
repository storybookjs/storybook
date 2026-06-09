import { useMemo } from 'react';

import { Addon_TypesEnum, type Addon_BaseType } from 'storybook/internal/types';

import memoizerific from 'memoizerific';
import type { API, State } from 'storybook/manager-api';

import { filterToolsSide } from '../../../../core/src/manager/components/preview/Toolbar.tsx';
import type { PreviewProps } from '../../../../core/src/manager/components/preview/utils/types.tsx';
import { fullScreenTool } from '../../../../core/src/manager/components/preview/Toolbar.tsx';
import { openInEditorTool } from '../../../../core/src/manager/components/preview/tools/open-in-editor.tsx';
import { remountTool } from '../../../../core/src/manager/components/preview/tools/remount.tsx';
import { isolationModeTool } from '../../../../core/src/manager/components/preview/tools/share.tsx';
import { zoomTool } from '../../../../core/src/manager/components/preview/tools/zoom.tsx';
import { reviewAddonsTool } from './reviewAddonsTool.tsx';

const defaultTools = [remountTool];
const defaultToolsExtra = [
  isolationModeTool,
  zoomTool,
  reviewAddonsTool,
  fullScreenTool,
  openInEditorTool,
];

type FilterProps = [
  entry: PreviewProps['entry'],
  viewMode: State['viewMode'],
  location: State['location'],
  path: State['path'],
  tabId: string,
];

const memoizedTools = memoizerific(1)(
  (_, toolElements: ReturnType<API['getElements']>, filterProps: FilterProps) =>
    filterToolsSide(
      [...defaultTools, ...Object.values(toolElements)] as Addon_BaseType[],
      ...filterProps
    )
);

const memoizedExtra = memoizerific(1)(
  (_, extraElements: ReturnType<API['getElements']>, filterProps: FilterProps) =>
    filterToolsSide(
      [...defaultToolsExtra, ...Object.values(extraElements)] as Addon_BaseType[],
      ...filterProps
    )
);

export const useReviewToolbar = (storyId: string, api: API, state: State) => {
  const entry = api.getData(storyId) as PreviewProps['entry'];
  const filterProps = useMemo<FilterProps>(
    () => [entry, 'story', state.location, state.path, ''],
    [entry, state.location, state.path]
  );

  const toolsList = Object.values(api.getElements(Addon_TypesEnum.TOOL));
  const toolsExtraList = Object.values(api.getElements(Addon_TypesEnum.TOOLEXTRA));

  const tools = memoizedTools(toolsList.length, api.getElements(Addon_TypesEnum.TOOL), filterProps);
  const toolsExtra = memoizedExtra(
    toolsExtraList.length,
    api.getElements(Addon_TypesEnum.TOOLEXTRA),
    filterProps
  );

  return { tools, toolsExtra, showToolbar: state.layout.showToolbar };
};

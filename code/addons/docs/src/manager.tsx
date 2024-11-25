import React from 'react';

import { AddonPanel, type SyntaxHighlighterFormatTypes } from 'storybook/internal/components';
import { FORCE_RE_RENDER, PRELOAD_ENTRIES } from 'storybook/internal/core-events';
import { ADDON_ID, PANEL_ID, PARAM_KEY, SNIPPET_RENDERED } from 'storybook/internal/docs-tools';
import { addons, types, useAddonState, useChannel } from 'storybook/internal/manager-api';

import { Source } from '@storybook/blocks';

addons.register(ADDON_ID, async (api) => {
  // at this point, the parameters are not yet defined so we can not check whether the addon panel should
  // be added or not. The "PRELOAD_ENTRIES" event seems to be the earliest point in time where the parameters
  // are available
  const isDisabled = await new Promise<boolean>((resolve) => {
    api.once(PRELOAD_ENTRIES, () => {
      const parameter = api.getCurrentParameter(PARAM_KEY);
      resolve(shouldDisableAddonPanel(parameter));
    });
  });

  if (isDisabled) {
    return;
  }

  addons.add(PANEL_ID, {
    title: 'Code',
    type: types.PANEL,
    paramKey: PARAM_KEY,
    match: ({ viewMode }) => viewMode === 'story',
    render: ({ active }) => {
      const [codeSnippet, setSourceCode] = useAddonState<{
        source: string;
        format: SyntaxHighlighterFormatTypes;
      }>(ADDON_ID, {
        source: '',
        format: 'html',
      });

      useChannel({
        [SNIPPET_RENDERED]: ({ source, format }) => {
          setSourceCode({ source, format: format ?? 'html' });
        },
      });

      return (
        <AddonPanel active={!!active}>
          <Source code={codeSnippet.source} format={codeSnippet.format} dark />
        </AddonPanel>
      );
    },
  });

  api.emit(FORCE_RE_RENDER);
});

const isObject = (value: unknown): value is object => {
  return value != null && typeof value === 'object';
};

/**
 * Checks whether the addon panel should be disabled by checking the parameter.source.addonPanel
 * property.
 */
const shouldDisableAddonPanel = (parameter: unknown) => {
  return (
    isObject(parameter) &&
    'source' in parameter &&
    isObject(parameter.source) &&
    'addonPanel' in parameter.source &&
    parameter.source.addonPanel === false
  );
};

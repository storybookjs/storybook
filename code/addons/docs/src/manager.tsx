import React from 'react';

import { AddonPanel, type SyntaxHighlighterFormatTypes } from 'storybook/internal/components';
import { ADDON_ID, PANEL_ID, PARAM_KEY, SNIPPET_RENDERED } from 'storybook/internal/docs-tools';
import { addons, types, useAddonState, useChannel } from 'storybook/internal/manager-api';

import { Source } from '@storybook/blocks';

addons.register(ADDON_ID, (api) => {
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
          <Source code={codeSnippet.source} format={codeSnippet.format} />
        </AddonPanel>
      );
    },
  });
});

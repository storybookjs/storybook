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
    /**
     * This code panel can be disabled by the user by adding this parameter:
     *
     * @example
     *
     * ```ts
     *  parameters: {
     *    docs: {
     *      codePanel: false,
     *    },
     *  },
     * ```
     */
    disabled: (parameters) => {
      return (
        !!parameters &&
        typeof parameters[PARAM_KEY] === 'object' &&
        parameters[PARAM_KEY].codePanel === false
      );
    },
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
          setSourceCode({ source, format });
        },
      });

      return (
        <AddonPanel active={!!active}>
          <Source code={codeSnippet.source} format={codeSnippet.format} dark />
        </AddonPanel>
      );
    },
  });
});

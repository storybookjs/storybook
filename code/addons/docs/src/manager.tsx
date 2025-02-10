import React, { useState } from 'react';

import { AddonPanel, type SyntaxHighlighterFormatTypes } from 'storybook/internal/components';
import { ADDON_ID, PANEL_ID, PARAM_KEY, SNIPPET_RENDERED } from 'storybook/internal/docs-tools';
import { addons, types, useChannel } from 'storybook/internal/manager-api';

import { Source } from '@storybook/blocks';

addons.register(ADDON_ID, (api) => {
  addons.add(PANEL_ID, {
    title: 'Code',
    type: types.PANEL,
    paramKey: PARAM_KEY,
    /**
     * This code panel can be enabled by adding this parameter:
     *
     * @example
     *
     * ```ts
     *  parameters: {
     *    docs: {
     *      codePanel: true,
     *    },
     *  },
     * ```
     */
    disabled: (parameters) => !parameters?.docs?.codePanel,
    match: ({ viewMode }) => viewMode === 'story',
    render: ({ active }) => {
      const channel = api.getChannel();

      const lastEvent = channel?.last(SNIPPET_RENDERED)?.[0];

      const [codeSnippet, setSourceCode] = useState<{
        source: string;
        format: SyntaxHighlighterFormatTypes;
      }>({
        source: lastEvent?.source ?? '',
        format: lastEvent?.format ?? undefined,
      });

      useChannel({
        [SNIPPET_RENDERED]: ({ source, format }) => {
          setSourceCode({ source, format: format ?? undefined });
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

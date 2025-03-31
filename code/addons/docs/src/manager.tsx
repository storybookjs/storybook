import React, { useState } from 'react';

import { AddonPanel, type SyntaxHighlighterFormatTypes } from 'storybook/internal/components';

import { addons, types, useChannel, useParameter } from 'storybook/manager-api';
import { ignoreSsrWarning, styled, useTheme } from 'storybook/theming';

import {
  ADDON_ID,
  PANEL_ID,
  PARAM_KEY,
  SNIPPET_RENDERED,
} from '../../../core/src/docs-tools/shared';
import type { SourceParameters } from '../../../lib/blocks/src';
import { Source } from '../../../lib/blocks/src/components/Source';

addons.register(ADDON_ID, (api) => {
  addons.add(PANEL_ID, {
    title: 'Code',
    type: types.PANEL,
    paramKey: PARAM_KEY,
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

      const parameter = useParameter(PARAM_KEY, {
        source: { code: '' } as SourceParameters,
        theme: 'dark',
      });

      useChannel({
        [SNIPPET_RENDERED]: ({ source, format }) => {
          setSourceCode({ source, format });
        },
      });

      const theme = useTheme();
      const isDark = theme.base !== 'light';

      return (
        <AddonPanel active={!!active}>
          <SourceStyles>
            <Source
              {...parameter.source}
              code={parameter.source?.code || codeSnippet.source}
              format={codeSnippet.format}
              dark={isDark}
            />
          </SourceStyles>
        </AddonPanel>
      );
    },
  });
});

const SourceStyles = styled.div(() => ({
  height: '100%',
  [`> :first-child${ignoreSsrWarning}`]: {
    margin: 0,
    height: '100%',
    boxShadow: 'none',
  },
}));

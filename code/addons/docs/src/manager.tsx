import React from 'react';

import { AddonPanel, type SyntaxHighlighterFormatTypes } from 'storybook/internal/components';
import { ADDON_ID, PANEL_ID, PARAM_KEY, SNIPPET_RENDERED } from 'storybook/internal/docs-tools';
import { addons, types, useChannel, useParameter } from 'storybook/internal/manager-api';
import { ignoreSsrWarning, styled, useTheme } from 'storybook/internal/theming';

import { Source, type SourceParameters } from '@storybook/blocks';

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
      const parameter = useParameter(PARAM_KEY, {
        source: { code: '' } as SourceParameters,
        theme: 'dark',
      });

      const [codeSnippet, setSourceCode] = React.useState<{
        source?: string;
        format?: SyntaxHighlighterFormatTypes;
      }>({});

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
              code={parameter.source.code || codeSnippet.source}
              format={parameter.source.format || codeSnippet.format}
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

import React, { useState } from 'react';

import { AddonPanel, type SyntaxHighlighterFormatTypes } from 'storybook/internal/components';
import { ADDON_ID, PANEL_ID, PARAM_KEY, SNIPPET_RENDERED } from 'storybook/internal/docs-tools';
import { addons, types, useChannel, useParameter } from 'storybook/internal/manager-api';
import { ignoreSsrWarning, styled } from 'storybook/internal/theming';

import { Source, type SourceParameters } from '@storybook/blocks';

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
      const parameter = useParameter(PARAM_KEY, {
        source: { code: '' } as SourceParameters,
      });

      const [codeSnippet, setSourceCode] = useState<{
        source?: string;
        format?: SyntaxHighlighterFormatTypes;
      }>({});

      useChannel({
        [SNIPPET_RENDERED]: ({ source, format }) => {
          setSourceCode({ source, format });
        },
      });

      return (
        <AddonPanel active={!!active}>
          <SourceStyles>
            <Source
              {...parameter.source}
              code={parameter.source.code || codeSnippet.source}
              format={parameter.source.format || codeSnippet.format}
              dark
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

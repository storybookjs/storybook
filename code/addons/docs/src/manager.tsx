import React, { useEffect, useState } from 'react';

import { AddonPanel, type SyntaxHighlighterFormatTypes } from 'storybook/internal/components';

import { addons, types, useChannel, useParameter } from 'storybook/manager-api';
import { ignoreSsrWarning, styled, useTheme } from 'storybook/theming';

import {
  ADDON_ID,
  PANEL_ID,
  PARAM_KEY,
  SNIPPET_RENDERED,
} from '../../../core/src/docs-tools/shared';
import type { SourceParameters } from './blocks/blocks';
import { Source } from './blocks/components/Source';

addons.register(ADDON_ID, (api) => {
  const CodePanel: React.FC<{ active?: boolean }> = ({ active }) => {
    const channel = api.getChannel();
    const currentStory = api.getCurrentStoryData();

    const lastEvent = channel?.last(SNIPPET_RENDERED)?.[0];

    const [codeSnippet, setSourceCode] = useState<{
      source: string | undefined;
      format: SyntaxHighlighterFormatTypes | undefined;
    }>({
      source: lastEvent?.source,
      format: lastEvent?.format ?? undefined,
    });

    const parameter = useParameter(PARAM_KEY, {
      source: { code: '' } as SourceParameters,
      theme: 'dark',
    });

    useEffect(() => {
      setSourceCode({
        source: undefined,
        format: undefined,
      });
    }, [currentStory?.id]);

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
            code={parameter.source?.code || codeSnippet.source || parameter.source?.originalSource}
            format={codeSnippet.format}
            dark={isDark}
          />
        </SourceStyles>
      </AddonPanel>
    );
  };

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
    render: ({ active }) => <CodePanel active={active} />,
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

import type { FC, Context, PropsWithChildren } from 'react';
import React, { createContext, useEffect, useState } from 'react';

import { SNIPPET_RENDERED } from 'storybook/internal/docs-tools';
import type { SyntaxHighlighterFormatTypes } from 'storybook/internal/components';
import type { StoryId, Args, DocsContextProps } from 'storybook/internal/types';

import { stringify } from 'telejson';

type ArgsHash = string;
export function argsHash(args: Args): ArgsHash {
  return stringify(args, { allowFunction: false });
}

export interface SourceItem {
  code: string;
  format?: SyntaxHighlighterFormatTypes;
}

export type StorySources = Record<StoryId, Record<ArgsHash, SourceItem>>;

export interface SourceContextProps {
  sources: StorySources;
  setSource?: (id: StoryId, item: SourceItem) => void;
}

export const SourceContext: Context<SourceContextProps> = createContext({ sources: {} });

type SnippetRenderedEvent = {
  id: StoryId;
  source: string;
  args?: Args;
  format?: SyntaxHighlighterFormatTypes;
};

export const UNKNOWN_ARGS_HASH = '--unknown--';

export const SourceContainer: FC<PropsWithChildren<{ channel: DocsContextProps['channel'] }>> = ({
  children,
  channel,
}) => {
  const [sources, setSources] = useState<StorySources>({});

  useEffect(() => {
    const handleSnippetRendered = (
      idOrEvent: StoryId | SnippetRenderedEvent,
      inputSource: string = null,
      inputFormat: SyntaxHighlighterFormatTypes = false
    ) => {
      const {
        id,
        args = undefined,
        source,
        format,
      } = typeof idOrEvent === 'string'
        ? {
            id: idOrEvent,
            source: inputSource,
            format: inputFormat,
          }
        : idOrEvent;

      const hash = args ? argsHash(args) : UNKNOWN_ARGS_HASH;
      // FIXME: In SB8.0 when we remove the Source block deprecations,
      // we should restore this optimizationand make the Source block
      // smarter about understanding when its args change.
      //
      // See https://github.com/storybookjs/storybook/pull/22807
      //
      // optimization: don't update if the source is the same
      // if (deepEqual(currentSource, { code: source, format })) return;

      setSources((current) => {
        const newSources = {
          ...current,
          [id]: {
            ...current[id],
            [hash]: { code: source, format },
          },
        };

        return newSources;
      });
    };

    channel.on(SNIPPET_RENDERED, handleSnippetRendered);

    return () => channel.off(SNIPPET_RENDERED, handleSnippetRendered);
  }, []);

  return <SourceContext.Provider value={{ sources }}>{children}</SourceContext.Provider>;
};

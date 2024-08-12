import React from 'react';

import {
  SyntaxHighlighter,
  type SyntaxHighlighterProps,
  type SyntaxHighlighterRendererProps,
} from 'storybook/internal/components';
import { type API, useParameter } from 'storybook/internal/manager-api';
import { Link } from 'storybook/internal/router';
import { styled } from 'storybook/internal/theming';

import type { LocationsMap, SourceBlock } from '@storybook/source-loader';

// @ts-expect-error Typedefs don't currently expose `createElement` even though it exists
import { createElement as createSyntaxHighlighterElement } from 'react-syntax-highlighter';
import invariant from 'tiny-invariant';

const StyledStoryLink = styled(Link)<{ to: string; key: string }>(({ theme }) => ({
  display: 'block',
  textDecoration: 'none',
  borderRadius: theme.appBorderRadius,
  color: 'inherit',

  '&:hover': {
    background: theme.background.hoverable,
  },
}));

const SelectedStoryHighlight = styled.div(({ theme }) => ({
  background: theme.background.hoverable,
  borderRadius: theme.appBorderRadius,
}));

const StyledSyntaxHighlighter = styled(SyntaxHighlighter)<SyntaxHighlighterProps>(({ theme }) => ({
  fontSize: theme.typography.size.s2 - 1,
}));

const areLocationsEqual = (a: SourceBlock, b: SourceBlock): boolean =>
  a.startLoc.line === b.startLoc.line &&
  a.startLoc.col === b.startLoc.col &&
  a.endLoc.line === b.endLoc.line &&
  a.endLoc.col === b.endLoc.col;

interface StoryPanelProps {
  api: API;
}

interface SourceParams {
  source?: string;
  locationsMap?: LocationsMap;
}
interface DocsParams {
  source?: { originalSource?: string };
}
export const StoryPanel: React.FC<StoryPanelProps> = ({ api }) => {
  const story = api.getCurrentStoryData();
  const selectedStoryRef = React.useRef<HTMLDivElement>(null);
  const { source: loaderSource, locationsMap }: SourceParams = useParameter('storySource', {});
  const { source: { originalSource: docsSource } = {} }: DocsParams = useParameter('docs', {});
  // prefer to use the source from source-loader, but fallback to
  // source provided by csf-plugin for vite usage
  const source = loaderSource || docsSource || 'loading source...';
  const currentLocationIndex = locationsMap
    ? Object.keys(locationsMap).find((key: string) => {
        const sourceLoaderId = key.split('--');
        return story.id.endsWith(sourceLoaderId[sourceLoaderId.length - 1]);
      })
    : undefined;
  const currentLocation =
    locationsMap && currentLocationIndex ? locationsMap[currentLocationIndex] : undefined;
  React.useEffect(() => {
    if (selectedStoryRef.current) {
      selectedStoryRef.current.scrollIntoView();
    }
  }, [selectedStoryRef.current]);

  const createPart = ({
    rows,
    stylesheet,
    useInlineStyles,
  }: SyntaxHighlighterRendererProps): React.ReactNode[] =>
    rows.map((node, i) =>
      createSyntaxHighlighterElement({
        node,
        stylesheet,
        useInlineStyles,
        key: `code-segment${i}`,
      })
    );

  const createStoryPart = ({
    rows,
    stylesheet,
    useInlineStyles,
    location,
    id,
    refId,
  }: SyntaxHighlighterRendererProps & { location: SourceBlock; id: string; refId?: string }) => {
    const first = location.startLoc.line - 1;
    const last = location.endLoc.line;

    const storyRows = rows.slice(first, last);
    const storySource = createPart({ rows: storyRows, stylesheet, useInlineStyles });
    const storyKey = `${first}-${last}`;

    if (currentLocation && areLocationsEqual(location, currentLocation)) {
      return (
        <SelectedStoryHighlight key={storyKey} ref={selectedStoryRef}>
          {storySource}
        </SelectedStoryHighlight>
      );
    }
    return (
      <StyledStoryLink to={refId ? `/story/${refId}_${id}` : `/story/${id}`} key={storyKey}>
        {storySource}
      </StyledStoryLink>
    );
  };

  const createParts = ({ rows, stylesheet, useInlineStyles }: SyntaxHighlighterRendererProps) => {
    const parts: React.ReactNode[] = [];
    let lastRow = 0;

    invariant(locationsMap, 'locationsMap should be defined while creating parts');

    Object.keys(locationsMap).forEach((key) => {
      const location = locationsMap[key];
      const first = location.startLoc.line - 1;
      const last = location.endLoc.line;
      const { title, refId } = story;
      // source loader ids are different from story id
      const sourceIdParts = key.split('--');
      const id = api.storyId(title, sourceIdParts[sourceIdParts.length - 1]);
      const start = createPart({ rows: rows.slice(lastRow, first), stylesheet, useInlineStyles });
      const storyPart = createStoryPart({ rows, stylesheet, useInlineStyles, location, id, refId });

      parts.push(...start);
      parts.push(storyPart);

      lastRow = last;
    });

    const lastPart = createPart({ rows: rows.slice(lastRow), stylesheet, useInlineStyles });

    parts.push(...lastPart);

    return parts;
  };

  const lineRenderer = ({
    rows,
    stylesheet,
    useInlineStyles,
  }: SyntaxHighlighterRendererProps): React.ReactNode => {
    // because of the usage of lineRenderer, all lines will be wrapped in a span
    // these spans will receive all classes on them for some reason
    // which makes colours cascade incorrectly
    // this removed that list of classnames
    const myrows = rows.map(({ properties, ...rest }) => ({
      ...rest,
      properties: { className: [] },
    }));

    if (!locationsMap || !Object.keys(locationsMap).length) {
      return createPart({ rows: myrows, stylesheet, useInlineStyles });
    }

    const parts = createParts({ rows: myrows, stylesheet, useInlineStyles });

    return <span>{parts}</span>;
  };
  return story ? (
    <StyledSyntaxHighlighter
      language="jsx"
      showLineNumbers
      renderer={lineRenderer}
      format={false}
      copyable={false}
      padded
      wrapLongLines
      lineProps={{ style: { whiteSpace: 'pre' } }}
    >
      {source}
    </StyledSyntaxHighlighter>
  ) : null;
};

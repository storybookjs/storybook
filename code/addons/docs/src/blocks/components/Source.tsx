import type { ComponentProps, FunctionComponent } from 'react';
import React, { useState } from 'react';

import type { SupportedLanguage, SyntaxHighlighterProps } from 'storybook/internal/components';
import { SyntaxHighlighter } from 'storybook/internal/components';

import {
  ThemeProvider,
  convert,
  ignoreSsrWarning,
  styled,
  themes,
  useTheme,
} from 'storybook/theming';

import { EmptyBlock } from './EmptyBlock';

const StyledSyntaxHighlighter: React.FunctionComponent<SyntaxHighlighterProps> = styled(
  SyntaxHighlighter
)(({ theme }) => ({
  // DocBlocks-specific styling and overrides
  fontSize: `${theme.typography.size.s2 - 1}px`,
  lineHeight: '19px',
  margin: '25px 0 40px',
  borderRadius: theme.appBorderRadius,
  boxShadow:
    theme.base === 'light' ? 'rgba(0, 0, 0, 0.10) 0 1px 3px 0' : 'rgba(0, 0, 0, 0.20) 0 2px 5px 0',
  'pre.prismjs': {
    padding: 20,
    background: 'inherit',
  },
}));

export enum SourceError {
  NO_STORY = 'There\u2019s no story here.',
  SOURCE_UNAVAILABLE = 'Oh no! The source is not available.',
}

export interface SourceCodeProps {
  /** The language the syntax highlighter uses for your story’s code */
  language?: SupportedLanguage;
  /** Use this to override the content of the source block. */
  code?: string;
  /** The formatter the syntax highlighter uses for your story’s code. */
  format?: ComponentProps<typeof SyntaxHighlighter>['format'];
  /** Display the source snippet in a dark mode. */
  dark?: boolean;
}

export interface SourceProps extends SourceCodeProps {
  isLoading?: boolean;
  error?: SourceError;
  simplifiedCode?: string;
}

const SourceToggleWrapper = styled.div({
  position: 'relative',
});

const SourceToggleButton = styled.button(({ theme }) => ({
  position: 'absolute',
  top: 10,
  right: 10,
  zIndex: 1,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 600,
  lineHeight: '16px',
  color: theme.color.lightest,
  background: 'rgba(255, 255, 255, 0.1)',
  border: `1px solid rgba(255, 255, 255, 0.2)`,
  borderRadius: theme.appBorderRadius,
  cursor: 'pointer',
  transition: 'all 150ms ease-out',
  '&:hover': {
    background: 'rgba(255, 255, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  '&:focus': {
    outline: 'none',
    boxShadow: `0 0 0 1px ${theme.color.secondary}`,
  },
}));

const SourceSkeletonWrapper = styled.div(({ theme }) => ({
  background: theme.background.content,
  borderRadius: theme.appBorderRadius,
  border: `1px solid ${theme.appBorderColor}`,
  boxShadow:
    theme.base === 'light' ? 'rgba(0, 0, 0, 0.10) 0 1px 3px 0' : 'rgba(0, 0, 0, 0.20) 0 2px 5px 0',
  margin: '25px 0 40px',
  padding: '20px 20px 20px 22px',
}));

const SourceSkeletonPlaceholder = styled.div(({ theme }) => ({
  animation: `${theme.animation.glow} 1.5s ease-in-out infinite`,
  background: theme.appBorderColor,
  height: 17,
  marginTop: 1,
  width: '60%',

  [`&:first-child${ignoreSsrWarning}`]: {
    margin: 0,
  },
}));

const SourceSkeleton = () => (
  <SourceSkeletonWrapper>
    <SourceSkeletonPlaceholder />
    <SourceSkeletonPlaceholder style={{ width: '80%' }} />
    <SourceSkeletonPlaceholder style={{ width: '30%' }} />
    <SourceSkeletonPlaceholder style={{ width: '80%' }} />
  </SourceSkeletonWrapper>
);

/** Syntax-highlighted source code for a component (or anything!) */
const Source: FunctionComponent<SourceProps> = ({
  isLoading,
  error,
  language,
  code,
  dark,
  format = true,
  simplifiedCode,
  ...rest
}) => {
  const { typography } = useTheme();
  const [showSimplified, setShowSimplified] = useState(true);

  if (isLoading) {
    return <SourceSkeleton />;
  }
  if (error) {
    return <EmptyBlock>{error}</EmptyBlock>;
  }

  // Determine which code to display based on toggle state
  const displayCode = showSimplified && simplifiedCode ? simplifiedCode : code;

  // Only show toggle if we have both versions and they're different
  const showToggle = simplifiedCode && simplifiedCode !== code;

  const syntaxHighlighter = (
    <SourceToggleWrapper>
      {showToggle && (
        <SourceToggleButton
          onClick={() => setShowSimplified(!showSimplified)}
          title={
            showSimplified
              ? 'Expand to show full component names (e.g., Card.Header)'
              : 'Collapse to show simplified names (e.g., CardHeader)'
          }
        >
          {showSimplified ? 'Expand code' : 'Collapse code'}
        </SourceToggleButton>
      )}
      <StyledSyntaxHighlighter
        bordered
        copyable
        format={format}
        language={language ?? 'jsx'}
        className="docblock-source sb-unstyled"
        {...rest}
      >
        {displayCode}
      </StyledSyntaxHighlighter>
    </SourceToggleWrapper>
  );
  if (typeof dark === 'undefined') {
    return syntaxHighlighter;
  }
  const overrideTheme = dark ? themes.dark : themes.light;
  return (
    <ThemeProvider
      theme={convert({
        ...overrideTheme,
        fontCode: typography.fonts.mono,
        fontBase: typography.fonts.base,
      })}
    >
      {syntaxHighlighter}
    </ThemeProvider>
  );
};

export { Source, StyledSyntaxHighlighter };

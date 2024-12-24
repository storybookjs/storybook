import type { ComponentProps } from 'react';
import React, { Children } from 'react';

import { styled } from '@storybook/core/theming';

import { SyntaxHighlighter } from '../../syntaxhighlighter/syntaxhighlighter';
import type { SupportedLanguage } from '../../syntaxhighlighter/syntaxhighlighter-types';
import { codeCommon } from '../lib/common';
import { isReactChildString } from '../lib/isReactChildString';

const isInlineCodeRegex = /[\n\r]/g;

const DefaultCodeBlock = styled.code(
  ({ theme }) => ({
    // from reset
    fontFamily: theme.typography.fonts.mono,
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    display: 'inline-block',
    paddingLeft: 2,
    paddingRight: 2,
    verticalAlign: 'baseline',
    color: 'inherit',
  }),
  codeCommon
);

const StyledSyntaxHighlighter = styled(SyntaxHighlighter)(({ theme }) => ({
  // DocBlocks-specific styling and overrides
  fontFamily: theme.typography.fonts.mono,
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

export const Code = ({
  className,
  children,
  ...props
}: ComponentProps<typeof DefaultCodeBlock>) => {
  const language = (className || '').match(/lang-(\S+)/);
  const childrenArray = Children.toArray(children);
  const isInlineCode = !childrenArray
    .filter(isReactChildString)
    .some((child) => child.match(isInlineCodeRegex));

  if (isInlineCode) {
    return (
      <DefaultCodeBlock {...props} className={className}>
        {childrenArray}
      </DefaultCodeBlock>
    );
  }

  return (
    <StyledSyntaxHighlighter
      bordered
      copyable
      language={(language?.[1] as SupportedLanguage) ?? 'text'}
      format={false}
      {...props}
    >
      {children}
    </StyledSyntaxHighlighter>
  );
};

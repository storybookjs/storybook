import type { MouseEvent } from 'react';
import React, { useCallback, useEffect, useState } from 'react';

import { styled } from '@storybook/core/theming';
import { global } from '@storybook/global';

import { logger } from '@storybook/core/client-logger';

import memoize from 'memoizerific';
// @ts-expect-error (Converted from ts-ignore)
import { createElement } from 'react-syntax-highlighter/dist/esm/index';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import graphql from 'react-syntax-highlighter/dist/esm/languages/prism/graphql';
// @ts-expect-error (Converted from ts-ignore)
import jsExtras from 'react-syntax-highlighter/dist/esm/languages/prism/js-extras';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import md from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import html from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import yml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import ReactSyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-light';

import { ActionBar } from '../ActionBar/ActionBar';
import type { ScrollAreaProps } from '../ScrollArea/ScrollArea';
import { ScrollArea } from '../ScrollArea/ScrollArea';
import type {
  SyntaxHighlighterProps,
  SyntaxHighlighterRenderer,
  SyntaxHighlighterRendererProps,
} from './syntaxhighlighter-types';

const { navigator, document, window: globalWindow } = global;

export const supportedLanguages = {
  jsextra: jsExtras,
  jsx,
  json,
  yml,
  md,
  bash,
  css,
  html,
  tsx,
  typescript,
  graphql,
};

Object.entries(supportedLanguages).forEach(([key, val]) => {
  ReactSyntaxHighlighter.registerLanguage(key, val);
});

const themedSyntax = memoize(2)((theme) =>
  Object.entries(theme.code || {}).reduce((acc, [key, val]) => ({ ...acc, [`* .${key}`]: val }), {})
);

const copyToClipboard: (text: string) => Promise<void> = createCopyToClipboardFunction();

export function createCopyToClipboardFunction() {
  if (navigator?.clipboard) {
    return (text: string) => navigator.clipboard.writeText(text);
  }
  return async (text: string) => {
    const tmp = document.createElement('TEXTAREA') as HTMLTextAreaElement;
    const focus = document.activeElement as HTMLTextAreaElement;

    tmp.value = text;

    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    document.body.removeChild(tmp);
    focus.focus();
  };
}

export interface WrapperProps {
  bordered?: boolean;
  padded?: boolean;
  showLineNumbers?: boolean;
}

const Wrapper = styled.div<WrapperProps>(
  ({ theme }) => ({
    position: 'relative',
    overflow: 'hidden',
    color: theme.color.defaultText,
  }),
  ({ theme, bordered }) =>
    bordered
      ? {
          border: `1px solid ${theme.appBorderColor}`,
          borderRadius: theme.borderRadius,
          background: theme.background.content,
        }
      : {},
  ({ showLineNumbers }) =>
    showLineNumbers
      ? {
          // use the before pseudo element to display line numbers
          '.react-syntax-highlighter-line-number::before': {
            content: 'attr(data-line-number)',
          },
        }
      : {}
);

const UnstyledScroller = ({ children, className }: ScrollAreaProps) => (
  <ScrollArea horizontal vertical className={className}>
    {children}
  </ScrollArea>
);
const Scroller = styled(UnstyledScroller)(
  {
    position: 'relative',
  },
  ({ theme }) => themedSyntax(theme)
);

export interface PreProps {
  padded?: boolean;
}

const Pre = styled.pre<PreProps>(({ theme, padded }) => ({
  display: 'flex',
  justifyContent: 'flex-start',
  margin: 0,
  padding: padded ? theme.layoutMargin : 0,
}));

/*
We can't use `code` since PrismJS races for it.
See https://github.com/storybookjs/storybook/issues/18090
 */
const Code = styled.div(({ theme }) => ({
  flex: 1,
  paddingLeft: 2, // TODO: To match theming/global.ts for now
  paddingRight: theme.layoutMargin,
  opacity: 1,
  fontFamily: theme.typography.fonts.mono,
}));

const processLineNumber = (row: any) => {
  const children = [...row.children];
  const lineNumberNode = children[0];
  const lineNumber = lineNumberNode.children[0].value;
  const processedLineNumberNode = {
    ...lineNumberNode,
    // empty the line-number element
    children: [],
    properties: {
      ...lineNumberNode.properties,
      // add a data-line-number attribute to line-number element, so we can access the line number with `content: attr(data-line-number)`
      'data-line-number': lineNumber,
      // remove the 'userSelect: none' style, which will produce extra empty lines when copy-pasting in firefox
      style: { ...lineNumberNode.properties.style, userSelect: 'auto' },
    },
  };
  children[0] = processedLineNumberNode;
  return { ...row, children };
};

/**
 * A custom renderer for handling `span.linenumber` element in each line of code,
 * which is enabled by default if no renderer is passed in from the parent component
 */
const defaultRenderer: SyntaxHighlighterRenderer = ({ rows, stylesheet, useInlineStyles }) => {
  return rows.map((node: any, i: number) => {
    return createElement({
      node: processLineNumber(node),
      stylesheet,
      useInlineStyles,
      key: `code-segement${i}`,
    });
  });
};

const wrapRenderer = (
  renderer: SyntaxHighlighterRenderer | undefined,
  showLineNumbers: boolean
) => {
  if (!showLineNumbers) {
    return renderer;
  }
  if (renderer) {
    return ({ rows, ...rest }: SyntaxHighlighterRendererProps) =>
      renderer({ rows: rows.map((row) => processLineNumber(row)), ...rest });
  }
  return defaultRenderer;
};

export interface SyntaxHighlighterState {
  copied: boolean;
}

// copied from @types/react-syntax-highlighter/index.d.ts

export const SyntaxHighlighter = ({
  children,
  language = 'jsx',
  copyable = false,
  bordered = false,
  padded = false,
  format = true,
  formatter = undefined,
  className = undefined,
  showLineNumbers = false,
  ...rest
}: SyntaxHighlighterProps) => {
  if (typeof children !== 'string' || !children.trim()) {
    return null;
  }

  const [highlightableCode, setHighlightableCode] = useState('');

  useEffect(() => {
    if (formatter) {
      formatter(format, children).then(setHighlightableCode);
    } else {
      setHighlightableCode(children.trim());
    }
  }, [children, format, formatter]);

  const [copied, setCopied] = useState(false);

  const onClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      copyToClipboard(highlightableCode)
        .then(() => {
          setCopied(true);
          globalWindow.setTimeout(() => setCopied(false), 1500);
        })
        .catch(logger.error);
    },
    [highlightableCode]
  );
  const renderer = wrapRenderer(rest.renderer, showLineNumbers);

  return (
    <Wrapper
      bordered={bordered}
      padded={padded}
      showLineNumbers={showLineNumbers}
      className={className}
    >
      <Scroller>
        <ReactSyntaxHighlighter
          padded={padded || bordered}
          language={language}
          showLineNumbers={showLineNumbers}
          showInlineLineNumbers={showLineNumbers}
          useInlineStyles={false}
          PreTag={Pre}
          CodeTag={Code}
          lineNumberContainerStyle={{}}
          {...rest}
          renderer={renderer}
        >
          {highlightableCode}
        </ReactSyntaxHighlighter>
      </Scroller>

      {copyable ? (
        <ActionBar actionItems={[{ title: copied ? 'Copied' : 'Copy', onClick }]} />
      ) : null}
    </Wrapper>
  );
};

SyntaxHighlighter.registerLanguage = (
  ...args: Parameters<typeof ReactSyntaxHighlighter.registerLanguage>
) => ReactSyntaxHighlighter.registerLanguage(...args);

export default SyntaxHighlighter;

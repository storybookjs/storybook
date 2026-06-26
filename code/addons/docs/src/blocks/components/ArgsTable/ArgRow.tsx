import type { FC } from 'react';
import React from 'react';

import { codeCommon } from 'storybook/internal/components';

import Markdown from 'markdown-to-jsx';
import { transparentize } from 'polished';
import type { CSSObject } from 'storybook/theming';
import { styled } from 'storybook/theming';

import type { ArgControlProps } from './ArgControl';
import { ArgControl } from './ArgControl';
import { ArgJsDoc } from './ArgJsDoc';
import { ArgValue } from './ArgValue';
import type { ArgType, Args, TableAnnotation } from './types';

interface ArgRowProps {
  row: ArgType;
  arg: any;
  updateArgs?: (args: Args) => void;
  compact?: boolean;
  expandable?: boolean;
  initialExpandedArgs?: boolean;
  storyId?: string;
  controlsId?: string;
}

const Name = styled.span({ fontWeight: 'bold' });

const Required = styled.span(({ theme }) => ({
  color: theme.color.negative,
  fontFamily: theme.typography.fonts.mono,
  cursor: 'help',
}));

const Description = styled.div(({ theme }) => ({
  '&&': {
    p: {
      margin: '0 0 10px 0',
    },
    a: {
      color: theme.color.secondary,
    },
  },

  code: {
    ...(codeCommon({ theme }) as CSSObject),
    fontSize: 12,
    fontFamily: theme.typography.fonts.mono,
  } as CSSObject,

  '& code': {
    margin: 0,
    display: 'inline-block',
  },

  '& pre > code': {
    whiteSpace: 'pre-wrap',
  },
}));

const Type = styled.div<{ hasDescription: boolean }>(({ theme, hasDescription }) => ({
  color:
    theme.base === 'light'
      ? transparentize(0.1, theme.color.defaultText)
      : transparentize(0.2, theme.color.defaultText),
  marginTop: hasDescription ? 4 : 0,
}));

const TypeWithJsDoc = styled.div<{ hasDescription: boolean }>(({ theme, hasDescription }) => ({
  color:
    theme.base === 'light'
      ? transparentize(0.1, theme.color.defaultText)
      : transparentize(0.2, theme.color.defaultText),
  marginTop: hasDescription ? 12 : 0,
  marginBottom: 12,
}));

const StyledTd = styled.td<{ expandable: boolean }>(({ expandable }) => ({
  paddingLeft: expandable ? '40px !important' : '20px !important',
}));

// When a row has no usable control, the "Setup controls" link is hidden and a placeholder dash is
// shown. Hovering or focusing within the row swaps them, so keyboard users reach the link too.
const StyledTr = styled.tr({
  [`span.sbdocs-argcontrol-placeholder`]: {
    display: 'none',
  },
  '&:hover, &:focus-within': {
    [`span.sbdocs-argcontrol-placeholder`]: {
      display: 'inline',
    },
    [`span:not(.sbdocs-argcontrol-placeholder)`]: {
      display: 'none',
    },
  },
});

const toSummary = (value: any) => {
  if (!value) {
    return value;
  }
  const val = typeof value === 'string' ? value : value.name;
  return { summary: val };
};

export const ArgRow: FC<ArgRowProps> = (props) => {
  const { row, updateArgs, compact, expandable, initialExpandedArgs } = props;
  const { name, description } = row;
  const table = (row.table || {}) as TableAnnotation;
  const type = table.type || toSummary(row.type);
  const defaultValue = table.defaultValue || row.defaultValue;
  const required = row.type?.required;
  const hasDescription = description != null && description !== '';

  return (
    <StyledTr>
      <StyledTd expandable={expandable ?? false}>
        <Name>{name}</Name>
        {required ? (
          <Required aria-hidden title="Required">
            *
          </Required>
        ) : null}
      </StyledTd>
      {compact ? null : (
        <td>
          {hasDescription && (
            <Description>
              <Markdown>{description}</Markdown>
            </Description>
          )}
          {table.jsDocTags != null ? (
            <>
              <TypeWithJsDoc hasDescription={hasDescription}>
                <ArgValue value={type} initialExpandedArgs={initialExpandedArgs} />
              </TypeWithJsDoc>
              <ArgJsDoc tags={table.jsDocTags} />
            </>
          ) : (
            <Type hasDescription={hasDescription}>
              <ArgValue value={type} initialExpandedArgs={initialExpandedArgs} />
            </Type>
          )}
        </td>
      )}
      {compact ? null : (
        <td>
          <ArgValue value={defaultValue} initialExpandedArgs={initialExpandedArgs} />
        </td>
      )}
      {updateArgs ? (
        <td>
          <ArgControl {...(props as ArgControlProps)} isRequired={required} />
        </td>
      ) : null}
    </StyledTr>
  );
};

import type { FC } from 'react';
import React, { useState } from 'react';

import { codeCommon } from 'storybook/internal/components';
import type { CSSObject } from 'storybook/internal/theming';
import { styled, transparentize } from 'storybook/internal/theming';

import Markdown from 'markdown-to-jsx';

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

const StyledTd = styled.td<{ expandable: boolean }>(({ theme, expandable }) => ({
  paddingLeft: expandable ? '40px !important' : '20px !important',
}));

const toSummary = (value: any) => {
  if (!value) {
    return value;
  }
  const val = typeof value === 'string' ? value : value.name;
  return { summary: val };
};

export const ArgRow: FC<ArgRowProps> = (props) => {
  const [isHovered, setIsHovered] = useState(false);
  const { row, updateArgs, compact, expandable, initialExpandedArgs } = props;
  const { name, description } = row;
  const table = (row.table || {}) as TableAnnotation;
  const type = table.type || toSummary(row.type);
  const defaultValue = table.defaultValue || row.defaultValue;
  const required = row.type?.required;
  const hasDescription = description != null && description !== '';

  return (
    <tr onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <StyledTd expandable={expandable}>
        <Name>{name}</Name>
        {required ? <Required title="Required">*</Required> : null}
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
          <ArgControl {...(props as ArgControlProps)} isHovered={isHovered} />
        </td>
      ) : null}
    </tr>
  );
};

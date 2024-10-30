import type { FC } from 'react';
import React from 'react';

import { codeCommon } from 'storybook/internal/components';
import type { CSSObject } from 'storybook/internal/theming';
import { styled } from 'storybook/internal/theming';

import type { JsDocTags } from './types';

interface ArgJsDocArgs {
  tags: JsDocTags;
}

export const Table = styled.table(({ theme }) => ({
  '&&': {
    // Escape default table styles
    borderCollapse: 'collapse',
    borderSpacing: 0,
    border: 'none',

    tr: {
      border: 'none !important',
      background: 'none',
    },

    'td, th': {
      padding: 0,
      border: 'none',
      width: 'auto!important',
    },
    // End escape

    marginTop: 0,
    marginBottom: 0,

    'th:first-of-type, td:first-of-type': {
      paddingLeft: 0,
    },

    'th:last-of-type, td:last-of-type': {
      paddingRight: 0,
    },

    td: {
      paddingTop: 0,
      paddingBottom: 4,

      '&:not(:first-of-type)': {
        paddingLeft: 10,
        paddingRight: 0,
      },
    },

    tbody: {
      boxShadow: 'none',
      border: 'none',
    },

    code: codeCommon({ theme }) as CSSObject,

    div: {
      span: {
        fontWeight: 'bold',
      },
    },

    '& code': {
      margin: 0,
      display: 'inline-block',
      fontSize: theme.typography.size.s1,
    },
  },
}));

export const ArgJsDoc: FC<ArgJsDocArgs> = ({ tags }) => {
  const params = (tags.params || []).filter((x) => x.description);
  const hasDisplayableParams = params.length !== 0;
  const hasDisplayableDeprecated = tags.deprecated != null;
  const hasDisplayableReturns = tags.returns != null && tags.returns.description != null;

  if (!hasDisplayableParams && !hasDisplayableReturns && !hasDisplayableDeprecated) {
    return null;
  }

  return (
    <>
      <Table>
        <tbody>
          {hasDisplayableDeprecated && (
            <tr key="deprecated">
              <td colSpan={2}>
                <strong>Deprecated</strong>: {tags.deprecated.toString()}
              </td>
            </tr>
          )}
          {hasDisplayableParams &&
            params.map((x) => {
              return (
                <tr key={x.name}>
                  <td>
                    <code>{x.name}</code>
                  </td>
                  <td>{x.description}</td>
                </tr>
              );
            })}
          {hasDisplayableReturns && (
            <tr key="returns">
              <td>
                <code>Returns</code>
              </td>
              <td>{tags.returns.description}</td>
            </tr>
          )}
        </tbody>
      </Table>
    </>
  );
};

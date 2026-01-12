import React, { Fragment } from 'react';

import { styled } from 'storybook/theming';

export interface SeparatorProps {
  force?: boolean;
}

export const Separator = styled.span<SeparatorProps>(
  {
    display: 'inline-block',
    width: 1,
    height: 20,
    background: 'var(--sb-appBorderColor)',
    marginLeft: 2,
    marginRight: 2,
  },
  ({ force }) =>
    force
      ? {}
      : {
          '& + &': {
            display: 'none',
          },
        }
);
Separator.displayName = 'Separator';

export const interleaveSeparators = (list: any[]) =>
  list.reduce(
    (acc, item, index) =>
      item ? (
        <Fragment key={item.id || item.key || `f-${index}`}>
          {acc}
          {}
          {index > 0 ? <Separator key={`s-${index}`} /> : null}
          {item.render() || item}
        </Fragment>
      ) : (
        acc
      ),
    null
  );

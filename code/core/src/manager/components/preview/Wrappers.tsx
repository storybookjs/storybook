import type { FC, PropsWithChildren } from 'react';
import React, { Fragment } from 'react';
import type { Addon_WrapperType } from '@storybook/core/types';
import { Addon_TypesEnum } from '@storybook/core/types';
import type { ApplyWrappersProps } from './utils/types';
import { IframeWrapper } from './utils/components';

export const ApplyWrappers: FC<PropsWithChildren<ApplyWrappersProps>> = ({
  wrappers,
  id,
  storyId,
  children,
}) => {
  return (
    <Fragment>
      {wrappers.reduceRight(
        (acc, wrapper, index) => (
          <wrapper.render {...{ index, children: acc, id, storyId }} />
        ),
        children
      )}
    </Fragment>
  );
};

export const defaultWrappers: Addon_WrapperType[] = [
  {
    id: 'iframe-wrapper',
    type: Addon_TypesEnum.PREVIEW,
    render: (p) => <IframeWrapper id="storybook-preview-wrapper">{p.children}</IframeWrapper>,
  },
];

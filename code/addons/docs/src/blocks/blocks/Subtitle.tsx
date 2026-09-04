import type { FunctionComponent, ReactNode } from 'react';
import React from 'react';

import { InvalidBlockOfPropError } from 'storybook/internal/preview-errors';

import { Subtitle as PureSubtitle } from '../components';
import type { Of } from './useOf';
import { useOf } from './useOf';
import { withMdxComponentOverride } from './with-mdx-component-override';

interface SubtitleProps {
  children?: ReactNode;
  /**
   * Specify where to get the subtitle from. If not specified, the subtitle will be extracted from
   * the meta of the attached CSF file.
   */
  of?: Of;
}

const SubtitleImpl: FunctionComponent<SubtitleProps> = (props) => {
  const { of, children } = props;

  if ('of' in props && of === undefined) {
    throw new InvalidBlockOfPropError();
  }

  let preparedMeta;
  try {
    preparedMeta = useOf(of || 'meta', ['meta']).preparedMeta;
  } catch (error: unknown) {
    if (children && !(error as Error).message.includes('did you forget to use <Meta of={} />?')) {
      // ignore error about unattached CSF since we can still render children
      throw error;
    }
  }

  const content = children || preparedMeta?.parameters?.docs?.subtitle;

  return content ? (
    <PureSubtitle className="sbdocs-subtitle sb-unstyled">{content}</PureSubtitle>
  ) : null;
};

export const Subtitle = withMdxComponentOverride('Subtitle', SubtitleImpl);

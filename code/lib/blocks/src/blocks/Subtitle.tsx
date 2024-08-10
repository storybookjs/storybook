import type { FunctionComponent, ReactNode } from 'react';
import React from 'react';

import { deprecate } from 'storybook/internal/client-logger';

import { Subtitle as PureSubtitle } from '../components';
import type { Of } from './useOf';
import { useOf } from './useOf';

interface SubtitleProps {
  children?: ReactNode;
  /**
   * Specify where to get the subtitle from.
   * If not specified, the subtitle will be extracted from the meta of the attached CSF file.
   */
  of?: Of;
}

const DEPRECATION_MIGRATION_LINK =
  'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#subtitle-block-and-parameterscomponentsubtitle';

export const Subtitle: FunctionComponent<SubtitleProps> = (props) => {
  const { of, children } = props;

  if ('of' in props && of === undefined) {
    throw new Error('Unexpected `of={undefined}`, did you mistype a CSF file reference?');
  }

  let preparedMeta;
  try {
    preparedMeta = useOf(of || 'meta', ['meta']).preparedMeta;
  } catch (error) {
    if (children && !error.message.includes('did you forget to use <Meta of={} />?')) {
      // ignore error about unattached CSF since we can still render children
      throw error;
    }
  }

  const { componentSubtitle, docs } = preparedMeta?.parameters || {};

  if (componentSubtitle) {
    deprecate(
      `Using 'parameters.componentSubtitle' property to subtitle stories is deprecated. See ${DEPRECATION_MIGRATION_LINK}`
    );
  }

  const content = children || docs?.subtitle || componentSubtitle;

  return content ? (
    <PureSubtitle className="sbdocs-subtitle sb-unstyled">{content}</PureSubtitle>
  ) : null;
};

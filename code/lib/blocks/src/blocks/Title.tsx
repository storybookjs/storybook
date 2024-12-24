import type { FunctionComponent, ReactNode } from 'react';
import React from 'react';

import type { ComponentTitle } from 'storybook/internal/types';

import { Title as PureTitle } from '../components';
import type { Of } from './useOf';
import { useOf } from './useOf';

interface TitleProps {
  /**
   * Specify where to get the title from. Must be a CSF file's default export. If not specified, the
   * title will be read from children, or extracted from the meta of the attached CSF file.
   */
  of?: Of;

  /** Specify content to display as the title. */
  children?: ReactNode;
}

const STORY_KIND_PATH_SEPARATOR = /\s*\/\s*/;

export const extractTitle = (title: ComponentTitle) => {
  const groups = title.trim().split(STORY_KIND_PATH_SEPARATOR);
  return groups?.[groups?.length - 1] || title;
};

export const Title: FunctionComponent<TitleProps> = (props) => {
  const { children, of } = props;

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

  const content = children || extractTitle(preparedMeta?.title);

  return content ? <PureTitle className="sbdocs-title sb-unstyled">{content}</PureTitle> : null;
};

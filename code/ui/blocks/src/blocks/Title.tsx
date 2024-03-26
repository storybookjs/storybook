import type { ComponentTitle } from '@storybook/types';
import type { FunctionComponent, ReactNode } from 'react';
import React, { useContext } from 'react';
import { Title as PureTitle } from '../components';
import { DocsContext } from './DocsContext';
import type { Of } from './useOf';
import { useOf } from './useOf';

interface TitleProps {
  /**
   * Specify where to get the title from. Must be a CSF file's default export.
   * If not specified, the title will be read from children, or extracted from the meta of the attached CSF file.
   */
  of?: Of;

  /**
   * Specify content to display as the title.
   */
  children?: ReactNode;
}

const STORY_KIND_PATH_SEPARATOR = /\s*\/\s*/;

export const extractTitle = (title: ComponentTitle) => {
  const groups = title.trim().split(STORY_KIND_PATH_SEPARATOR);
  return (groups && groups[groups.length - 1]) || title;
};

const getTitleFromResolvedOf = (resolvedOf: ReturnType<typeof useOf>): string | null => {
  switch (resolvedOf.type) {
    case 'meta': {
      return resolvedOf.preparedMeta.title || null;
    }
    case 'story':
    case 'component': {
      throw new Error(
        `Unsupported module type. Title's \`of\` prop only supports \`meta\`, got: ${
          (resolvedOf as any).type
        }`
      );
    }
    default: {
      throw new Error(
        `Unrecognized module type resolved from 'useOf', got: ${(resolvedOf as any).type}`
      );
    }
  }
};

export const Title: FunctionComponent<TitleProps> = (props) => {
  const { children, of } = props;

  if ('of' in props && of === undefined) {
    throw new Error('Unexpected `of={undefined}`, did you mistype a CSF file reference?');
  }

  const context = useContext(DocsContext);

  let content;
  if (of) {
    const resolvedOf = useOf(of || 'meta');
    content = getTitleFromResolvedOf(resolvedOf);
  }

  if (!content) {
    content = children;
  }

  if (!content) {
    content = extractTitle(context.storyById().title);
  }

  return content ? <PureTitle className="sbdocs-title sb-unstyled">{content}</PureTitle> : null;
};

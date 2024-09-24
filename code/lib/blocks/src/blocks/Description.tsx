import type { FC } from 'react';
import React from 'react';

import { Markdown } from './Markdown';
import type { Of } from './useOf';
import { useOf } from './useOf';

export enum DescriptionType {
  INFO = 'info',
  NOTES = 'notes',
  DOCGEN = 'docgen',
  AUTO = 'auto',
}

interface DescriptionProps {
  /**
   * Specify where to get the description from. Can be a component, a CSF file or a story. If not
   * specified, the description will be extracted from the meta of the attached CSF file.
   */
  of?: Of;
}

const getDescriptionFromResolvedOf = (resolvedOf: ReturnType<typeof useOf>): string | null => {
  switch (resolvedOf.type) {
    case 'story': {
      return resolvedOf.story.parameters.docs?.description?.story || null;
    }
    case 'meta': {
      const { parameters, component } = resolvedOf.preparedMeta;
      const metaDescription = parameters.docs?.description?.component;
      if (metaDescription) {
        return metaDescription;
      }
      return (
        parameters.docs?.extractComponentDescription?.(component, {
          component,
          parameters,
        }) || null
      );
    }
    case 'component': {
      const {
        component,
        projectAnnotations: { parameters },
      } = resolvedOf;
      return (
        parameters.docs?.extractComponentDescription?.(component, {
          component,
          parameters,
        }) || null
      );
    }
    default: {
      throw new Error(
        `Unrecognized module type resolved from 'useOf', got: ${(resolvedOf as any).type}`
      );
    }
  }
};

const DescriptionContainer: FC<DescriptionProps> = (props) => {
  const { of } = props;

  if ('of' in props && of === undefined) {
    throw new Error('Unexpected `of={undefined}`, did you mistype a CSF file reference?');
  }
  const resolvedOf = useOf(of || 'meta');
  const markdown = getDescriptionFromResolvedOf(resolvedOf);

  return markdown ? <Markdown>{markdown}</Markdown> : null;
};

export { DescriptionContainer as Description };

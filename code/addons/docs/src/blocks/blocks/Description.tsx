import type { FC } from 'react';
import React, { useContext } from 'react';

import { InvalidBlockOfPropError } from 'storybook/internal/preview-errors';

import { DocsContext } from './DocsContext';
import { Markdown } from './Markdown';
import type { Of } from './useOf';
import { useOf } from './useOf';
import { useServiceDocgen } from './useServiceDocgen';
import { useServiceStoryDoc } from './use-service-story-docs.ts';
import { withMdxComponentOverride } from './with-mdx-component-override';

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

const getDescriptionFromResolvedOf = (
  resolvedOf: ReturnType<typeof useOf>,
  serviceComponentDescription?: string,
  storyDocsDescription?: string | null
): string | null => {
  switch (resolvedOf.type) {
    case 'story': {
      const storyDescription = resolvedOf.story.parameters.docs?.description?.story;
      return storyDescription !== undefined ? storyDescription : (storyDocsDescription ?? null);
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
        }) ||
        serviceComponentDescription ||
        null
      );
    }
    case 'component': {
      const {
        component,
        projectAnnotations: { parameters },
      } = resolvedOf;
      return (
        parameters?.docs?.extractComponentDescription?.(component, {
          component,
          parameters,
        }) ||
        serviceComponentDescription ||
        null
      );
    }
    default: {
      throw new Error(
        `Unrecognized module type resolved from 'useOf', got: ${(resolvedOf as any).type}`
      );
    }
  }
};

/**
 * Resolves the component-level description from the `core/docgen` service when
 * `experimentalDocgenServer` is enabled. In that mode the renderer no longer injects `__docgenInfo`,
 * so `extractComponentDescription` can't read the component's leading comment — the service payload
 * carries it instead. Story- and meta-parameter descriptions are unaffected and keep their sources.
 */
const useServiceComponentDescription = (
  resolvedOf: ReturnType<typeof useOf>
): string | undefined => {
  const context = useContext(DocsContext);

  let componentId: string | undefined;
  if (globalThis.FEATURES?.experimentalDocgenServer) {
    if (resolvedOf.type === 'meta') {
      componentId = resolvedOf.preparedMeta.componentId;
    } else if (resolvedOf.type === 'component') {
      componentId = context.getComponentId(resolvedOf.component);
    }
  }

  return useServiceDocgen(componentId)?.description || undefined;
};

const DescriptionImpl: FC<DescriptionProps> = (props) => {
  const { of } = props;

  if ('of' in props && of === undefined) {
    throw new InvalidBlockOfPropError();
  }
  const resolvedOf = useOf(of || 'meta');
  const serviceComponentDescription = useServiceComponentDescription(resolvedOf);
  const storyDocsDescription = useServiceStoryDoc(
    resolvedOf.type === 'story' ? resolvedOf.story.id : undefined
  )?.description;
  const markdown = getDescriptionFromResolvedOf(
    resolvedOf,
    serviceComponentDescription,
    storyDocsDescription
  );

  return markdown ? <Markdown>{markdown}</Markdown> : null;
};

export const Description = withMdxComponentOverride('Description', DescriptionImpl);

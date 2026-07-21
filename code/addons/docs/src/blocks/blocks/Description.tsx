import type { FC } from 'react';
import React, { useContext } from 'react';

import { InvalidBlockOfPropError } from 'storybook/internal/preview-errors';

import { DocsContext } from './DocsContext';
import { Markdown } from './Markdown';
import { useServiceDocgen } from './use-service-docgen.ts';
import { useServiceStoryDoc } from './use-service-story-docs.ts';
import type { Of } from './useOf';
import { useOf } from './useOf';
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

type ResolvedOf = ReturnType<typeof useOf>;

const DescriptionBody: FC<{
  resolvedOf: ResolvedOf;
  serviceComponentDescription?: string;
  lang?: string;
  storyDocsDescription?: string | null;
}> = ({ resolvedOf, serviceComponentDescription, lang, storyDocsDescription }) => {
  const markdown = getDescriptionFromResolvedOf(
    resolvedOf,
    serviceComponentDescription,
    storyDocsDescription
  );

  return markdown ? <Markdown lang={lang}>{markdown}</Markdown> : null;
};

const DescriptionStoryWithServices: FC<{
  resolvedOf: Extract<ResolvedOf, { type: 'story' }>;
}> = ({ resolvedOf }) => {
  const storyDocsDescription = useServiceStoryDoc(resolvedOf.story.id).data?.description;
  const lang = resolvedOf.story.parameters.docs?.lang || 'en';
  return (
    <DescriptionBody
      resolvedOf={resolvedOf}
      storyDocsDescription={storyDocsDescription}
      lang={lang}
    />
  );
};

const DescriptionComponentWithServices: FC<{
  resolvedOf: Extract<ResolvedOf, { type: 'meta' | 'component' }>;
  componentId: string;
}> = ({ resolvedOf, componentId }) => {
  const serviceComponentDescription = useServiceDocgen(componentId).data?.description || undefined;
  const lang =
    resolvedOf.type === 'meta'
      ? resolvedOf.preparedMeta.parameters.docs?.lang || 'en'
      : resolvedOf.projectAnnotations.parameters?.docs?.lang || 'en';
  return (
    <DescriptionBody
      resolvedOf={resolvedOf}
      serviceComponentDescription={serviceComponentDescription}
      lang={lang}
    />
  );
};

const DescriptionImpl: FC<DescriptionProps> = (props) => {
  const { of } = props;
  const context = useContext(DocsContext);

  if ('of' in props && of === undefined) {
    throw new InvalidBlockOfPropError();
  }
  const resolvedOf = useOf(of || 'meta');

  // The docgen service contributes a fallback description, but its two sources need different hooks
  // (story-docs by story id, docgen by component id), so each lives in its own child component to
  // keep the hook call unconditional. When the feature is off — or a bare `of={Component}` has no
  // resolvable component id — render without a service fallback.
  if (globalThis.FEATURES?.experimentalDocgenServer) {
    if (resolvedOf.type === 'story') {
      return <DescriptionStoryWithServices resolvedOf={resolvedOf} />;
    }

    const componentId =
      resolvedOf.type === 'meta'
        ? resolvedOf.preparedMeta.componentId
        : context.getComponentId(resolvedOf.component);

    if (componentId) {
      return <DescriptionComponentWithServices resolvedOf={resolvedOf} componentId={componentId} />;
    }
  }

  const parameters =
    resolvedOf.type === 'story'
      ? resolvedOf.story.parameters
      : resolvedOf.type === 'meta'
        ? resolvedOf.preparedMeta.parameters
        : resolvedOf.projectAnnotations.parameters;
  const lang = parameters?.docs?.lang || 'en';
  return <DescriptionBody resolvedOf={resolvedOf} lang={lang} />;
};

export const Description = withMdxComponentOverride('Description', DescriptionImpl);

import type { PropsWithChildren } from 'react';
import React, { useRef } from 'react';

import { composeConfigs } from 'storybook/internal/preview-api';
import type { ProjectAnnotations, Renderer } from 'storybook/internal/types';

import { Docs } from '../Docs';
import { ExternalPreview } from './ExternalPreview';

export type ExternalDocsProps<TRenderer extends Renderer = Renderer> = {
  projectAnnotationsList: ProjectAnnotations<TRenderer>[];
};

function usePreview<TRenderer extends Renderer = Renderer>(
  projectAnnotations: ProjectAnnotations<TRenderer>
) {
  const previewRef = useRef<ExternalPreview<TRenderer>>();
  if (!previewRef.current) previewRef.current = new ExternalPreview<TRenderer>(projectAnnotations);
  return previewRef.current;
}

export function ExternalDocs<TRenderer extends Renderer = Renderer>({
  projectAnnotationsList,
  children,
}: PropsWithChildren<ExternalDocsProps<TRenderer>>) {
  const projectAnnotations = composeConfigs<TRenderer>(projectAnnotationsList);
  const preview = usePreview<TRenderer>(projectAnnotations);
  const docsParameter = {
    ...projectAnnotations.parameters?.docs,
    page: () => children,
  };

  const TDocs = Docs as typeof Docs<TRenderer>;

  return <TDocs docsParameter={docsParameter} context={preview.docsContext()} />;
}

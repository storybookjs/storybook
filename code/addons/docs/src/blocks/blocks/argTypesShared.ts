import type { Args, Parameters, Renderer, StrictArgTypes } from 'storybook/internal/csf';
import type { ArgTypesExtractor } from 'storybook/internal/docs-tools';
import {
  getServiceSubcomponentArgTypes,
  mergeServiceArgTypes,
} from 'storybook/internal/docs-tools';

import { ArgsTableError } from '../components';
import { useServiceDocgen } from './useServiceDocgen';

/** Runs the renderer's docgen extractor against a component, throwing when it is unavailable. */
export function extractComponentArgTypes(
  component: Renderer['component'],
  parameters: Parameters
): StrictArgTypes {
  const { extractArgTypes }: { extractArgTypes: ArgTypesExtractor } = parameters.docs || {};
  if (!extractArgTypes) {
    throw new Error(ArgsTableError.ARGS_UNSUPPORTED);
  }
  return extractArgTypes(component) as StrictArgTypes;
}

/** Extracts argTypes for each declared subcomponent via the renderer's docgen extractor. */
export function extractSubcomponentArgTypes(
  subcomponents: Record<string, Renderer['component']> | undefined,
  parameters: Parameters
): Record<string, StrictArgTypes> {
  return Object.fromEntries(
    Object.entries(subcomponents || {}).map(([key, comp]) => [
      key,
      extractComponentArgTypes(comp, parameters),
    ])
  );
}

export type DocgenServiceRows = {
  /** The component name reported by the service, used as a fallback table title. */
  serviceComponentName: string;
  mainRows: StrictArgTypes;
  subcomponentRows: Record<string, StrictArgTypes>;
};

/**
 * Shared docgen-service recipe for the ArgTypes and Controls blocks behind
 * `experimentalDocgenServer`.
 *
 * Subscribes to the `core/docgen` service for the component's server-extracted argTypes and merges
 * them with the locally-prepared `customArgTypes` (the service only carries extracted component
 * docgen, so the block works regardless of whether the story rendered). Returns `null` until the
 * service payload is available, so callers render nothing while docgen is still resolving.
 */
export function useDocgenServiceRows({
  componentId,
  storyId,
  parameters,
  initialArgs,
  customArgTypes,
}: {
  componentId?: string;
  storyId?: string;
  parameters?: Parameters;
  initialArgs?: Args;
  customArgTypes?: StrictArgTypes;
}): DocgenServiceRows | null {
  const servicePayload = useServiceDocgen(componentId);

  if (!servicePayload || !componentId) {
    return null;
  }

  return {
    serviceComponentName: servicePayload.name,
    mainRows: mergeServiceArgTypes({
      payload: servicePayload,
      storyId: storyId ?? componentId,
      parameters,
      initialArgs,
      customArgTypes,
    }),
    subcomponentRows: getServiceSubcomponentArgTypes(servicePayload),
  };
}

import type { Args, DocgenPayload, Parameters, StrictArgTypes, StoryId } from 'storybook/internal/types';

import { inferArgTypes } from '../../preview-api/modules/store/inferArgTypes.ts';
import { inferControls } from '../../preview-api/modules/store/inferControls.ts';
import { combineParameters } from '../../preview-api/modules/store/parameters.ts';

/**
 * Builds the Controls/ArgTypes table shape from service docgen and author argTypes.
 *
 * `inferArgTypes` fills in rows for args that only exist in `initialArgs`, and `inferControls`
 * assigns the default control widget from each final argType's type/options. That mirrors the
 * second-pass enhancers that run in `prepareStory`, but runs after the UI has merged service docgen
 * with synced custom argTypes.
 */
export function mergeServiceArgTypes({
  payload,
  storyId,
  parameters,
  initialArgs,
}: {
  payload: DocgenPayload;
  storyId: StoryId;
  parameters: Parameters;
  initialArgs?: Args;
}): StrictArgTypes {
  const merged = combineParameters(
    payload.argTypes ?? {},
    payload.customArgTypes?.project ?? {},
    payload.customArgTypes?.meta ?? {},
    payload.customArgTypes?.stories?.[storyId] ?? {}
  ) as StrictArgTypes;

  const withInferredTypes = inferArgTypes({
    id: storyId,
    argTypes: merged,
    initialArgs: initialArgs ?? {},
  } as any) as StrictArgTypes;

  return inferControls({
    id: storyId,
    argTypes: withInferredTypes,
    parameters,
  } as any) as StrictArgTypes;
}

/** Returns subcomponent argTypes that were converted by the renderer provider at write time. */
export function getServiceSubcomponentArgTypes(payload: DocgenPayload) {
  return Object.fromEntries(
    Object.entries(payload.subcomponents ?? {}).flatMap(([name, subcomponent]) =>
      subcomponent.argTypes ? [[name, subcomponent.argTypes]] : []
    )
  ) as Record<string, StrictArgTypes>;
}

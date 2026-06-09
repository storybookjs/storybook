import type {
  Args,
  DocgenPayload,
  Parameters,
  StrictArgTypes,
  StoryId,
} from 'storybook/internal/types';

import { inferArgTypes } from '../../preview-api/modules/store/inferArgTypes.ts';
import { inferControls } from '../../preview-api/modules/store/inferControls.ts';
import { combineParameters } from '../../preview-api/modules/store/parameters.ts';

/**
 * Builds the Controls/ArgTypes table shape from server docgen and custom argTypes.
 *
 * The server payload contributes component prop extraction (`payload.argTypes`); custom argTypes
 * (project + meta + story annotations, already inferred by `prepareStory`) are layered on top via
 * `customArgTypes`. Callers source those from the prepared meta/story they already hold — the docs
 * blocks resolve it locally through `useOf`, the manager Controls panel reads it from the
 * `STORY_PREPARED` channel.
 *
 * `inferArgTypes` fills in rows for args that only exist in `initialArgs`, and `inferControls`
 * assigns the default control widget from each final argType's type/options — mirroring the
 * second-pass enhancers that run in `prepareStory`.
 */
export function mergeServiceArgTypes({
  payload,
  storyId,
  parameters,
  initialArgs,
  customArgTypes,
}: {
  payload: DocgenPayload;
  storyId: StoryId;
  /** May be undefined when the manager renders before the preview reports `storyPrepared`. */
  parameters?: Parameters;
  initialArgs?: Args;
  customArgTypes?: StrictArgTypes;
}): StrictArgTypes {
  const merged = combineParameters(payload.argTypes ?? {}, customArgTypes ?? {}) as StrictArgTypes;

  const withInferredTypes = inferArgTypes({
    id: storyId,
    argTypes: merged,
    initialArgs: initialArgs ?? {},
  } as any) as StrictArgTypes;

  return inferControls({
    id: storyId,
    argTypes: withInferredTypes,
    // The manager can render this before the preview reports `storyPrepared`, so `parameters` may be
    // undefined; `inferControls` reads `parameters.__isArgsStory` and would throw. An empty object
    // makes it a no-op until prepared parameters arrive and trigger a re-render.
    parameters: parameters ?? {},
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

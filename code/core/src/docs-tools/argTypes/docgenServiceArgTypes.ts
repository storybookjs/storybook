import type {
  ArgTypes,
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
 * (project + meta + story annotations, already inferred by `prepareStory`) are merged so extracted
 * prop types win over arg-inferred types from `prepareStory`. Callers source custom argTypes from
 * the prepared meta/story they already hold — the docs blocks resolve it locally through `useOf`
 * (as `StrictArgTypes`), the manager Controls panel reads it from the `STORY_PREPARED` channel via
 * `useArgTypes` (as the looser `ArgTypes`); both are accepted here and normalized by the inference
 * passes below.
 *
 * `inferArgTypes` fills in rows for args that only exist in `initialArgs`, and `inferControls`
 * assigns the default control widget from each final argType's type/options — mirroring the
 * second-pass enhancers that run in `prepareStory`.
 */
function stripPrepareStoryInference(
  customArgTypes: ArgTypes | undefined,
  docgenArgTypes: ArgTypes | undefined
): ArgTypes | undefined {
  if (!customArgTypes) {
    return customArgTypes;
  }

  return Object.fromEntries(
    Object.entries(customArgTypes).flatMap(([key, argType]) => {
      if (!argType || !docgenArgTypes?.[key]?.type || !argType.type) {
        return [[key, argType]];
      }

      const userOverrides = { ...argType };
      delete userOverrides.type;
      delete userOverrides.control;
      delete userOverrides.options;
      return Object.keys(userOverrides).length > 0 ? [[key, userOverrides]] : [];
    })
  );
}

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
  customArgTypes?: ArgTypes;
}): StrictArgTypes {
  const merged = combineParameters(
    stripPrepareStoryInference(customArgTypes, payload.argTypes) ?? {},
    payload.argTypes ?? {}
  ) as StrictArgTypes;

  const withInferredTypes = inferArgTypes({
    id: storyId,
    argTypes: merged,
    initialArgs: initialArgs ?? {},
  });

  return inferControls({
    argTypes: withInferredTypes,
    // The manager can render this before the preview reports `storyPrepared`, so `parameters` may be
    // undefined; `inferControls` reads `parameters.__isArgsStory` and would throw. An empty object
    // makes it a no-op until prepared parameters arrive and trigger a re-render.
    parameters: parameters ?? {},
  });
}

/** Returns subcomponent argTypes that were converted by the renderer provider at write time. */
export function getServiceSubcomponentArgTypes(payload: DocgenPayload) {
  return Object.fromEntries(
    Object.entries(payload.subcomponents ?? {}).flatMap(([name, subcomponent]) =>
      subcomponent.argTypes ? [[name, subcomponent.argTypes]] : []
    )
  ) as Record<string, StrictArgTypes>;
}

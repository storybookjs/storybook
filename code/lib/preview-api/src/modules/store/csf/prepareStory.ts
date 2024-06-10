/* eslint-disable @typescript-eslint/no-loop-func,no-underscore-dangle */
import { global } from '@storybook/global';
import type {
  Args,
  ArgsStoryFn,
  ModuleExport,
  NormalizedComponentAnnotations,
  NormalizedProjectAnnotations,
  NormalizedStoryAnnotations,
  Parameters,
  PlayFunction,
  PlayFunctionContext,
  PreparedMeta,
  PreparedStory,
  Renderer,
  StepLabel,
  StoryContext,
  StoryContextForEnhancers,
  StoryContextForLoaders,
  StrictArgTypes,
} from '@storybook/types';
import { type CleanupCallback, includeConditionalArg, combineTags } from '@storybook/csf';
import { global as globalThis } from '@storybook/global';

import { applyHooks } from '../../addons';
import { combineParameters } from '../parameters';
import { defaultDecorateStory } from '../decorators';
import { groupArgsByTarget, UNTARGETED } from '../args';
import { normalizeArrays } from './normalizeArrays';

// Combine all the metadata about a story (both direct and inherited from the component/global scope)
// into a "renderable" story function, with all decorators applied, parameters passed as context etc
//
// Note that this story function is *stateless* in the sense that it does not track args or globals
// Instead, it is expected these are tracked separately (if necessary) and are passed into each invocation.
export function prepareStory<TRenderer extends Renderer>(
  storyAnnotations: NormalizedStoryAnnotations<TRenderer>,
  componentAnnotations: NormalizedComponentAnnotations<TRenderer>,
  projectAnnotations: NormalizedProjectAnnotations<TRenderer>
): PreparedStory<TRenderer> {
  // NOTE: in the current implementation we are doing everything once, up front, rather than doing
  // anything at render time. The assumption is that as we don't load all the stories at once, this
  // will have a limited cost. If this proves misguided, we can refactor it.
  const { moduleExport, id, name } = storyAnnotations || {};

  const partialAnnotations = preparePartialAnnotations(
    storyAnnotations,
    componentAnnotations,
    projectAnnotations
  );

  const applyLoaders = async (
    context: StoryContextForLoaders<TRenderer>
  ): Promise<StoryContextForLoaders<TRenderer> & { loaded: StoryContext<TRenderer>['loaded'] }> => {
    let updatedContext = { ...context, loaded: {} };
    for (const loaders of [
      ...('__STORYBOOK_TEST_LOADERS__' in global && Array.isArray(global.__STORYBOOK_TEST_LOADERS__)
        ? [global.__STORYBOOK_TEST_LOADERS__]
        : []),
      normalizeArrays(projectAnnotations.loaders),
      normalizeArrays(componentAnnotations.loaders),
      normalizeArrays(storyAnnotations.loaders),
    ]) {
      const loadResults = await Promise.all(loaders.map((loader) => loader(updatedContext)));
      const loaded: Record<string, any> = Object.assign({}, ...loadResults);
      updatedContext = { ...updatedContext, loaded: { ...updatedContext.loaded, ...loaded } };
    }

    return updatedContext;
  };

  const applyBeforeEach = async (context: StoryContext<TRenderer>): Promise<CleanupCallback[]> => {
    const cleanupCallbacks = new Array<() => unknown>();
    for (const beforeEach of [
      ...normalizeArrays(projectAnnotations.beforeEach),
      ...normalizeArrays(componentAnnotations.beforeEach),
      ...normalizeArrays(storyAnnotations.beforeEach),
    ]) {
      const cleanup = await beforeEach(context);
      if (cleanup) cleanupCallbacks.push(cleanup);
    }
    return cleanupCallbacks;
  };

  const undecoratedStoryFn = (context: StoryContext<TRenderer>) =>
    (render as ArgsStoryFn<TRenderer>)(context.args, context);

  // Currently it is only possible to set these globally
  const { applyDecorators = defaultDecorateStory, runStep } = projectAnnotations;

  const decorators = [
    ...normalizeArrays(storyAnnotations?.decorators),
    ...normalizeArrays(componentAnnotations?.decorators),
    ...normalizeArrays(projectAnnotations?.decorators),
  ];

  // The render function on annotations *has* to be an `ArgsStoryFn`, so when we normalize
  // CSFv1/2, we use a new field called `userStoryFn` so we know that it can be a LegacyStoryFn
  const render =
    storyAnnotations?.userStoryFn ||
    storyAnnotations?.render ||
    componentAnnotations.render ||
    projectAnnotations.render;
  if (!render) throw new Error(`No render function available for storyId '${id}'`);

  const decoratedStoryFn = applyHooks<TRenderer>(applyDecorators)(undecoratedStoryFn, decorators);
  const unboundStoryFn = (context: StoryContext<TRenderer>) => decoratedStoryFn(context);

  const play = storyAnnotations?.play || componentAnnotations.play;

  const playFunction =
    play &&
    (async (storyContext: StoryContext<TRenderer>) => {
      const playFunctionContext: PlayFunctionContext<TRenderer> = {
        ...storyContext,
        // eslint-disable-next-line @typescript-eslint/no-shadow
        step: (label: StepLabel, play: PlayFunction<TRenderer>) =>
          // TODO: We know runStep is defined, we need a proper normalized annotations type
          runStep!(label, play, playFunctionContext),
      };
      return play(playFunctionContext);
    });

  return {
    ...partialAnnotations,
    moduleExport,
    id,
    name,
    story: name,
    originalStoryFn: render,
    undecoratedStoryFn,
    unboundStoryFn,
    applyLoaders,
    applyBeforeEach,
    playFunction,
  };
}
export function prepareMeta<TRenderer extends Renderer>(
  componentAnnotations: NormalizedComponentAnnotations<TRenderer>,
  projectAnnotations: NormalizedProjectAnnotations<TRenderer>,
  moduleExport: ModuleExport
): PreparedMeta<TRenderer> {
  return {
    ...preparePartialAnnotations(undefined, componentAnnotations, projectAnnotations),
    moduleExport,
  };
}

function preparePartialAnnotations<TRenderer extends Renderer>(
  storyAnnotations: NormalizedStoryAnnotations<TRenderer> | undefined,
  componentAnnotations: NormalizedComponentAnnotations<TRenderer>,
  projectAnnotations: NormalizedProjectAnnotations<TRenderer>
): Omit<StoryContextForEnhancers<TRenderer>, 'name' | 'story'> {
  // NOTE: in the current implementation we are doing everything once, up front, rather than doing
  // anything at render time. The assumption is that as we don't load all the stories at once, this
  // will have a limited cost. If this proves misguided, we can refactor it.

  const defaultTags = ['dev', 'test'];
  const extraTags = globalThis.DOCS_OPTIONS?.autodocs === true ? ['autodocs'] : [];

  const tags = combineTags(
    ...defaultTags,
    ...extraTags,
    ...(projectAnnotations.tags ?? []),
    ...(componentAnnotations.tags ?? []),
    ...(storyAnnotations?.tags ?? [])
  );

  const parameters: Parameters = combineParameters(
    projectAnnotations.parameters,
    componentAnnotations.parameters,
    storyAnnotations?.parameters
  );

  // Currently it is only possible to set these globally
  const { argTypesEnhancers = [], argsEnhancers = [] } = projectAnnotations;

  const passedArgTypes: StrictArgTypes = combineParameters(
    projectAnnotations.argTypes,
    componentAnnotations.argTypes,
    storyAnnotations?.argTypes
  ) as StrictArgTypes;

  if (storyAnnotations) {
    // The render function on annotations *has* to be an `ArgsStoryFn`, so when we normalize
    // CSFv1/2, we use a new field called `userStoryFn` so we know that it can be a LegacyStoryFn
    const render =
      storyAnnotations?.userStoryFn ||
      storyAnnotations?.render ||
      componentAnnotations.render ||
      projectAnnotations.render;

    parameters.__isArgsStory = render && render.length > 0;
  }

  // Pull out args[X] into initialArgs for argTypes enhancers
  const passedArgs: Args = {
    ...projectAnnotations.args,
    ...componentAnnotations.args,
    ...storyAnnotations?.args,
  } as Args;

  const contextForEnhancers: StoryContextForEnhancers<TRenderer> = {
    componentId: componentAnnotations.id,
    title: componentAnnotations.title,
    kind: componentAnnotations.title, // Back compat
    id: storyAnnotations?.id || componentAnnotations.id,
    // if there's no story name, we create a fake one since enhancers expect a name
    name: storyAnnotations?.name || '__meta',
    story: storyAnnotations?.name || '__meta', // Back compat
    component: componentAnnotations.component,
    subcomponents: componentAnnotations.subcomponents,
    tags,
    parameters,
    initialArgs: passedArgs,
    argTypes: passedArgTypes,
  };

  contextForEnhancers.argTypes = argTypesEnhancers.reduce(
    (accumulatedArgTypes, enhancer) =>
      enhancer({ ...contextForEnhancers, argTypes: accumulatedArgTypes }),
    contextForEnhancers.argTypes
  );

  const initialArgsBeforeEnhancers = { ...passedArgs };

  contextForEnhancers.initialArgs = argsEnhancers.reduce(
    (accumulatedArgs: Args, enhancer) => ({
      ...accumulatedArgs,
      ...enhancer({
        ...contextForEnhancers,
        initialArgs: accumulatedArgs,
      }),
    }),
    initialArgsBeforeEnhancers
  );

  const { name, story, ...withoutStoryIdentifiers } = contextForEnhancers;

  return withoutStoryIdentifiers;
}

// the context is prepared before invoking the render function, instead of here directly
// to ensure args don't loose there special properties set by the renderer
// eg. reactive proxies set by frameworks like SolidJS or Vue
export function prepareContext<
  TRenderer extends Renderer,
  TContext extends Pick<StoryContextForLoaders<TRenderer>, 'args' | 'argTypes' | 'globals'>,
>(
  context: TContext
): TContext & Pick<StoryContextForLoaders<TRenderer>, 'allArgs' | 'argsByTarget' | 'unmappedArgs'> {
  const { args: unmappedArgs } = context;

  let targetedContext: TContext &
    Pick<StoryContextForLoaders<TRenderer>, 'allArgs' | 'argsByTarget'> = {
    ...context,
    allArgs: undefined,
    argsByTarget: undefined,
  };
  if (global.FEATURES?.argTypeTargetsV7) {
    const argsByTarget = groupArgsByTarget(context);
    targetedContext = {
      ...context,
      allArgs: context.args,
      argsByTarget,
      args: argsByTarget[UNTARGETED] || {},
    };
  }

  const mappedArgs = Object.entries(targetedContext.args).reduce((acc, [key, val]) => {
    if (!targetedContext.argTypes[key]?.mapping) {
      acc[key] = val;

      return acc;
    }

    const mappingFn = (originalValue: any) => {
      const mapping = targetedContext.argTypes[key].mapping;
      return mapping && originalValue in mapping ? mapping[originalValue] : originalValue;
    };

    acc[key] = Array.isArray(val) ? val.map(mappingFn) : mappingFn(val);

    return acc;
  }, {} as Args);

  const includedArgs = Object.entries(mappedArgs).reduce((acc, [key, val]) => {
    const argType = targetedContext.argTypes[key] || {};
    if (includeConditionalArg(argType, mappedArgs, targetedContext.globals)) acc[key] = val;
    return acc;
  }, {} as Args);

  return { ...targetedContext, unmappedArgs, args: includedArgs };
}

/* eslint-disable react/destructuring-assignment */
import type { FC } from 'react';
import React, { useContext } from 'react';

import { useId } from '@react-aria/utils';

import type { Args, Globals, Parameters, Renderer, StrictArgTypes } from 'storybook/internal/csf';
import type { ArgTypesExtractor } from 'storybook/internal/docs-tools';
import {
  getServiceSubcomponentArgTypes,
  mergeServiceArgTypes,
} from 'storybook/internal/docs-tools';
import type { DocsContextProps, ModuleExports, PreparedStory } from 'storybook/internal/types';

import { filterArgTypes } from 'storybook/preview-api';
import type { PropDescriptor } from 'storybook/preview-api';

import type { SortType } from '../components';
import { ArgsTableError, ArgsTable as PureArgsTable, TabbedArgsTable } from '../components';
import { DocsContext } from './DocsContext';
import { useArgs } from './useArgs';
import { useGlobals } from './useGlobals';
import { usePrimaryStory } from './usePrimaryStory';
import { useServiceDocgen } from './useServiceDocgen';
import { getComponentName } from './utils';
import { withMdxComponentOverride } from './with-mdx-component-override';

type ControlsParameters = {
  include?: PropDescriptor;
  exclude?: PropDescriptor;
  sort?: SortType;
};

type ControlsProps = ControlsParameters & {
  of?: Renderer['component'] | ModuleExports;
};

type ControlsStoryProps = ControlsProps & {
  story: PreparedStory;
  context: DocsContextProps;
};

type ControlsInteractiveState = {
  controlsId: string;
  args: Args;
  globals: Globals;
  updateArgs: ReturnType<typeof useArgs>[1];
  resetArgs: ReturnType<typeof useArgs>[2];
};

function extractComponentArgTypes(
  component: Renderer['component'],
  parameters: Parameters
): StrictArgTypes {
  const { extractArgTypes }: { extractArgTypes: ArgTypesExtractor } = parameters.docs || {};
  if (!extractArgTypes) {
    throw new Error(ArgsTableError.ARGS_UNSUPPORTED);
  }
  return extractArgTypes(component) as StrictArgTypes;
}

function useResolveControlsStory(props: ControlsProps): PreparedStory | null {
  const { of } = props;
  const context = useContext(DocsContext);
  const primaryStory = usePrimaryStory();

  return of ? context.resolveOf(of, ['story']).story : primaryStory;
}

function getControlsFilterProps(story: PreparedStory, props: ControlsProps): ControlsParameters {
  const controlsParameters = story.parameters.docs?.controls || ({} as ControlsParameters);

  return {
    include: props.include ?? controlsParameters.include,
    exclude: props.exclude ?? controlsParameters.exclude,
    sort: props.sort ?? controlsParameters.sort,
  };
}

function useControlsInteractiveState(
  story: PreparedStory,
  context: DocsContextProps
): ControlsInteractiveState {
  // Disambiguate multiple <Controls /> blocks rendered for the same story on a single page.
  // React Aria's useId gives a stable id per component instance, with a polyfill for
  // React versions that lack the built-in useId.
  const controlsId = useId();
  const [args, updateArgs, resetArgs] = useArgs(story, context);
  const [globals] = useGlobals(story, context);

  return { controlsId, args, globals, updateArgs, resetArgs };
}

function renderControlsTables({
  mainName = 'Story',
  mainRows,
  subcomponentRows,
  include,
  exclude,
  sort,
  storyId,
  controlsId,
  args,
  globals,
  updateArgs,
  resetArgs,
}: {
  mainName?: string;
  mainRows: StrictArgTypes;
  subcomponentRows: Record<string, StrictArgTypes>;
  include?: PropDescriptor;
  exclude?: PropDescriptor;
  sort?: SortType;
  storyId: string;
  controlsId: string;
  args: Args;
  globals: Globals;
  updateArgs: ControlsInteractiveState['updateArgs'];
  resetArgs: ControlsInteractiveState['resetArgs'];
}) {
  const filteredMainRows = filterArgTypes(mainRows, include, exclude);

  if (Object.keys(subcomponentRows).length === 0) {
    if (!(Object.keys(filteredMainRows).length > 0 || Object.keys(args).length > 0)) {
      return null;
    }

    return (
      <PureArgsTable
        storyId={storyId}
        controlsId={controlsId}
        rows={filteredMainRows as any}
        sort={sort}
        args={args}
        globals={globals}
        updateArgs={updateArgs}
        resetArgs={resetArgs}
      />
    );
  }

  const tabs = {
    [mainName]: { rows: filteredMainRows, sort },
    ...Object.fromEntries(
      Object.entries(subcomponentRows).map(([key, rows]) => [
        key,
        {
          rows: filterArgTypes(rows, include, exclude),
          sort,
        },
      ])
    ),
  };

  return (
    <TabbedArgsTable
      tabs={tabs as any}
      sort={sort}
      args={args}
      globals={globals}
      updateArgs={updateArgs}
      resetArgs={resetArgs}
      storyId={storyId}
      controlsId={controlsId}
    />
  );
}

const LegacyControls: FC<ControlsStoryProps> = ({ story, context, ...props }) => {
  const { parameters, argTypes, component, subcomponents } = story;
  const filterProps = getControlsFilterProps(story, props);
  const interactiveState = useControlsInteractiveState(story, context);

  if (!argTypes) {
    return null;
  }

  const subcomponentRows = Object.fromEntries(
    Object.entries(subcomponents || {}).map(([key, comp]) => [
      key,
      extractComponentArgTypes(comp, parameters),
    ])
  );

  return renderControlsTables({
    mainName: getComponentName(component) || 'Story',
    mainRows: argTypes,
    subcomponentRows,
    ...filterProps,
    storyId: story.id,
    ...interactiveState,
  });
};

const DocgenServiceControls: FC<ControlsStoryProps> = ({ story, context, ...props }) => {
  const { parameters, argTypes, component } = story;
  const componentId = story.id.split('--')[0];
  const servicePayload = useServiceDocgen(componentId);
  const filterProps = getControlsFilterProps(story, props);
  const interactiveState = useControlsInteractiveState(story, context);

  if (!servicePayload || !componentId) {
    return null;
  }

  const serviceSubcomponentRows = getServiceSubcomponentArgTypes(servicePayload);

  return renderControlsTables({
    mainName: getComponentName(component) ?? servicePayload.name,
    mainRows: mergeServiceArgTypes({
      payload: servicePayload,
      storyId: story.id,
      parameters,
      initialArgs: story.initialArgs,
      // Custom argTypes come from the locally-prepared story (the service only carries extracted
      // component docgen), so the block works regardless of whether the story rendered.
      customArgTypes: argTypes,
    }),
    subcomponentRows: serviceSubcomponentRows,
    ...filterProps,
    storyId: story.id,
    ...interactiveState,
  });
};

const ControlsImpl: FC<ControlsProps> = (props) => {
  const context = useContext(DocsContext);
  const story = useResolveControlsStory(props);

  if (!story) {
    return null;
  }

  const storyProps = { ...props, story, context };

  return globalThis.FEATURES?.experimentalDocgenServer ? (
    <DocgenServiceControls {...storyProps} />
  ) : (
    <LegacyControls {...storyProps} />
  );
};

export const Controls = withMdxComponentOverride('Controls', ControlsImpl);

import type { FC } from 'react';
import React, { useContext } from 'react';

import { useId } from 'react-aria/useId';

import type { Args, Globals, Renderer, StrictArgTypes } from 'storybook/internal/csf';
import type { DocsContextProps, ModuleExports, PreparedStory } from 'storybook/internal/types';

import type { PropDescriptor } from 'storybook/preview-api';
import { filterArgTypes } from 'storybook/preview-api';

import type { SortType } from '../components';
import { ArgsTable as PureArgsTable, TabbedArgsTable } from '../components';
import { extractSubcomponentArgTypes, useDocgenServiceRows } from './argTypesShared';
import { DocsContext } from './DocsContext';
import { useArgs } from './useArgs';
import { useGlobals } from './useGlobals';
import { usePrimaryStory } from './usePrimaryStory';
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

type ControlsTablesProps = ControlsInteractiveState & {
  mainName?: string;
  mainRows: StrictArgTypes;
  subcomponentRows: Record<string, StrictArgTypes>;
  include?: PropDescriptor;
  exclude?: PropDescriptor;
  sort?: SortType;
  storyId: string;
  docsLang?: string;
};

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

const ControlsTables: FC<ControlsTablesProps> = ({
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
  docsLang,
}) => {
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
        docsLang={docsLang}
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
      docsLang={docsLang}
    />
  );
};

const LegacyControls: FC<ControlsStoryProps> = ({ story, context, ...props }) => {
  const { parameters, argTypes, component, subcomponents } = story;
  const filterProps = getControlsFilterProps(story, props);
  const interactiveState = useControlsInteractiveState(story, context);

  if (!argTypes) {
    return null;
  }

  return (
    <ControlsTables
      mainName={getComponentName(component) || 'Story'}
      mainRows={argTypes}
      subcomponentRows={extractSubcomponentArgTypes(subcomponents, parameters)}
      {...filterProps}
      storyId={story.id}
      {...interactiveState}
      docsLang={parameters?.docs?.lang}
    />
  );
};

const DocgenServiceControls: FC<ControlsStoryProps> = ({ story, context, ...props }) => {
  const { parameters, argTypes, component } = story;
  const filterProps = getControlsFilterProps(story, props);
  const interactiveState = useControlsInteractiveState(story, context);
  const { rows: serviceRows, isInitialLoading } = useDocgenServiceRows({
    componentId: story.id.split('--')[0],
    storyId: story.id,
    parameters,
    initialArgs: story.initialArgs,
    customArgTypes: argTypes,
  });

  if (isInitialLoading) {
    return <PureArgsTable isLoading />;
  }

  if (!serviceRows) {
    return null;
  }

  return (
    <ControlsTables
      mainName={getComponentName(component) ?? serviceRows.serviceComponentName}
      mainRows={serviceRows.mainRows}
      subcomponentRows={serviceRows.subcomponentRows}
      {...filterProps}
      storyId={story.id}
      {...interactiveState}
      docsLang={parameters?.docs?.lang}
    />
  );
};

const ControlsImpl: FC<ControlsProps> = (props) => {
  const { of } = props;
  const context = useContext(DocsContext);
  const primaryStory = usePrimaryStory();

  const story = of ? context.resolveOf(of, ['story']).story : primaryStory;

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

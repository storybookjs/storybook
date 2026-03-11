/* eslint-disable react/destructuring-assignment */
import type { FC } from 'react';
import React, { useContext } from 'react';

import type { Parameters, Renderer, StrictArgTypes } from 'storybook/internal/csf';
import type { ArgTypesExtractor } from 'storybook/internal/docs-tools';
import type { ModuleExports } from 'storybook/internal/types';

import { filterArgTypes } from 'storybook/preview-api';
import type { PropDescriptor } from 'storybook/preview-api';

import type { SortType } from '../components';
import { ArgsTableError, ArgsTable as PureArgsTable, TabbedArgsTable } from '../components';
import { DocsContext } from './DocsContext';
import { useArgs } from './useArgs';
import { useGlobals } from './useGlobals';
import { usePrimaryStory } from './usePrimaryStory';
import { getComponentName } from './utils';

type ControlsParameters = {
  include?: PropDescriptor;
  exclude?: PropDescriptor;
  sort?: SortType;
};

type ControlsProps = ControlsParameters & {
  of?: Renderer['component'] | ModuleExports;
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

export const Controls: FC<ControlsProps> = (props) => {
  const { of } = props;
  const context = useContext(DocsContext);
  const primaryStory = usePrimaryStory();

  const story = of ? context.resolveOf(of, ['story']).story : primaryStory;

  if (!story) {
    return null;
  }

  const { parameters, argTypes, component, subcomponents } = story;
  const controlsParameters = parameters.docs?.controls || ({} as ControlsParameters);

  const include = props.include ?? controlsParameters.include;
  const exclude = props.exclude ?? controlsParameters.exclude;
  const sort = props.sort ?? controlsParameters.sort;

  const [args, updateArgs, resetArgs] = useArgs(story, context);
  const [globals] = useGlobals(story, context);

  const filteredArgTypes = filterArgTypes(argTypes, include, exclude);

  const hasSubcomponents = Boolean(subcomponents) && Object.keys(subcomponents || {}).length > 0;

  if (!hasSubcomponents) {
    if (!(Object.keys(filteredArgTypes).length > 0 || Object.keys(args).length > 0)) {
      return null;
    }
    return (
      <PureArgsTable
        rows={filteredArgTypes as any}
        sort={sort}
        args={args}
        globals={globals}
        updateArgs={updateArgs}
        resetArgs={resetArgs}
      />
    );
  }

  const mainComponentName = getComponentName(component) || 'Story';
  const subcomponentTabs = Object.fromEntries(
    Object.entries(subcomponents || {}).map(([key, comp]) => [
      key,
      {
        rows: filterArgTypes(extractComponentArgTypes(comp, parameters), include, exclude),
        sort,
      },
    ])
  );
  const tabs = {
    [mainComponentName]: { rows: filteredArgTypes, sort },
    ...subcomponentTabs,
  };
  return (
    <TabbedArgsTable
      tabs={tabs as any}
      sort={sort}
      args={args}
      globals={globals}
      updateArgs={updateArgs}
      resetArgs={resetArgs}
    />
  );
};

/* eslint-disable react/destructuring-assignment */
import type { FC } from 'react';
import React, { useContext } from 'react';

import { useId } from '@react-aria/utils';

import type { Parameters, Renderer, StrictArgTypes } from 'storybook/internal/csf';
import type { ArgTypesExtractor } from 'storybook/internal/docs-tools';
import { getServiceSubcomponentArgTypes, mergeServiceArgTypes } from 'storybook/internal/docs-tools';
import type { ModuleExports } from 'storybook/internal/types';

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

const ControlsForStory: FC<ControlsProps & { story: any; context: any }> = ({
  story,
  context,
  ...props
}) => {
  // Disambiguate multiple <Controls /> blocks rendered for the same story on a single page.
  // React Aria's useId gives a stable id per component instance, with a polyfill for
  // React versions that lack the built-in useId.
  const controlsId = useId();

  const { parameters, argTypes, component, subcomponents } = story;
  const servicePayload = useServiceDocgen(story.id.split('--')[0]);
  const controlsParameters = parameters.docs?.controls || ({} as ControlsParameters);

  const include = props.include ?? controlsParameters.include;
  const exclude = props.exclude ?? controlsParameters.exclude;
  const sort = props.sort ?? controlsParameters.sort;

  const [args, updateArgs, resetArgs] = useArgs(story, context);
  const [globals] = useGlobals(story, context);
  const serviceRows = servicePayload
    ? mergeServiceArgTypes({
        payload: servicePayload,
        storyId: story.id,
        parameters,
        initialArgs: story.initialArgs,
      })
    : undefined;
  const rows = serviceRows ?? argTypes;

  if (!rows) {
    return null;
  }

  const filteredArgTypes = filterArgTypes(rows, include, exclude);
  const serviceSubcomponentArgTypes = servicePayload
    ? getServiceSubcomponentArgTypes(servicePayload)
    : {};

  const hasSubcomponents =
    globalThis.FEATURES?.experimentalDocgenServer && servicePayload
      ? Object.keys(serviceSubcomponentArgTypes).length > 0
      : Boolean(subcomponents) && Object.keys(subcomponents || {}).length > 0;

  if (!hasSubcomponents) {
    if (!(Object.keys(filteredArgTypes).length > 0 || Object.keys(args).length > 0)) {
      return null;
    }
    return (
      <PureArgsTable
        storyId={story.id}
        controlsId={controlsId}
        rows={filteredArgTypes as any}
        sort={sort}
        args={args}
        globals={globals}
        updateArgs={updateArgs}
        resetArgs={resetArgs}
      />
    );
  }

  const mainComponentName = servicePayload?.name || getComponentName(component) || 'Story';
  const subcomponentTabs = globalThis.FEATURES?.experimentalDocgenServer
    ? Object.fromEntries(
        Object.entries(serviceSubcomponentArgTypes).map(([key, subcomponentArgTypes]) => [
          key,
          {
            rows: filterArgTypes(subcomponentArgTypes, include, exclude),
            sort,
          },
        ])
      )
    : Object.fromEntries(
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
      storyId={story.id}
      controlsId={controlsId}
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

  return <ControlsForStory {...props} story={story} context={context} />;
};

export const Controls = withMdxComponentOverride('Controls', ControlsImpl);

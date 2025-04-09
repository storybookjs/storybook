/* eslint-disable react/destructuring-assignment */
import type { FC } from 'react';
import React from 'react';

import type { Parameters, Renderer, StrictArgTypes } from 'storybook/internal/csf';
import type { ArgTypesExtractor } from 'storybook/internal/docs-tools';
import type { ModuleExports } from 'storybook/internal/types';

import type { PropDescriptor } from 'storybook/preview-api';
import { filterArgTypes } from 'storybook/preview-api';

import type { SortType } from '../components';
import { ArgsTableError, ArgsTable as PureArgsTable, TabbedArgsTable } from '../components';
import { useOf } from './useOf';
import { getComponentName } from './utils';

type ArgTypesParameters = {
  include?: PropDescriptor;
  exclude?: PropDescriptor;
  sort?: SortType;
};

type ArgTypesProps = ArgTypesParameters & {
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

function getArgTypesFromResolved(resolved: ReturnType<typeof useOf>) {
  if (resolved.type === 'component') {
    const {
      component,
      projectAnnotations: { parameters },
    } = resolved;
    return {
      argTypes: extractComponentArgTypes(component, parameters as Parameters),
      parameters,
      component,
    };
  }

  if (resolved.type === 'meta') {
    const {
      preparedMeta: { argTypes, parameters, component, subcomponents },
    } = resolved;
    return { argTypes, parameters, component, subcomponents };
  }

  // In the case of the story, the enhanceArgs argTypeEnhancer has already added the extracted
  // arg types from the component to the prepared story.
  const {
    story: { argTypes, parameters, component, subcomponents },
  } = resolved;
  return { argTypes, parameters, component, subcomponents };
}

export const ArgTypes: FC<ArgTypesProps> = (props) => {
  const { of } = props;
  if ('of' in props && of === undefined) {
    throw new Error('Unexpected `of={undefined}`, did you mistype a CSF file reference?');
  }
  const resolved = useOf(of || 'meta');
  const { argTypes, parameters, component, subcomponents } = getArgTypesFromResolved(resolved);
  const argTypesParameters = parameters?.docs?.argTypes || ({} as ArgTypesParameters);

  const include = props.include ?? argTypesParameters.include;
  const exclude = props.exclude ?? argTypesParameters.exclude;
  const sort = props.sort ?? argTypesParameters.sort;

  const filteredArgTypes = filterArgTypes(argTypes, include, exclude);

  const hasSubcomponents = Boolean(subcomponents) && Object.keys(subcomponents || {}).length > 0;

  if (!hasSubcomponents) {
    return <PureArgsTable rows={filteredArgTypes as any} sort={sort} />;
  }

  const mainComponentName = getComponentName(component) || 'Main';
  const subcomponentTabs = Object.fromEntries(
    Object.entries(subcomponents || {}).map(([key, comp]) => [
      key,
      {
        rows: filterArgTypes(
          extractComponentArgTypes(comp, parameters as Parameters),
          include,
          exclude
        ),
        sort,
      },
    ])
  );
  const tabs = {
    [mainComponentName]: { rows: filteredArgTypes, sort },
    ...subcomponentTabs,
  };
  return <TabbedArgsTable tabs={tabs as any} sort={sort} />;
};

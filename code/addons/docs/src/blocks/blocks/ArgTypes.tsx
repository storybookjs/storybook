import type { FC } from 'react';
import React, { useContext } from 'react';

import type { Args, Parameters, Renderer, StrictArgTypes } from 'storybook/internal/csf';
import type { ArgTypesExtractor } from 'storybook/internal/docs-tools';
import {
  getServiceSubcomponentArgTypes,
  mergeServiceArgTypes,
} from 'storybook/internal/docs-tools';
import { InvalidBlockOfPropError } from 'storybook/internal/preview-errors';
import type { ModuleExports } from 'storybook/internal/types';

import type { PropDescriptor } from 'storybook/preview-api';
import { filterArgTypes } from 'storybook/preview-api';

import type { SortType } from '../components';
import { ArgsTableError, ArgsTable as PureArgsTable, TabbedArgsTable } from '../components';
import { DocsContext } from './DocsContext';
import { useOf } from './useOf';
import { useServiceDocgen } from './useServiceDocgen';
import { getComponentName } from './utils';
import { withMdxComponentOverride } from './with-mdx-component-override';

type ArgTypesParameters = {
  include?: PropDescriptor;
  exclude?: PropDescriptor;
  sort?: SortType;
};

type ArgTypesProps = ArgTypesParameters & {
  of?: Renderer['component'] | ModuleExports;
};

type ResolvedArgTypes = {
  parameters: Parameters;
  componentId?: string;
  storyId?: string;
  initialArgs?: Args;
  argTypes?: StrictArgTypes;
  component?: Renderer['component'];
  subcomponents?: Record<string, Renderer['component']>;
  filterProps: ArgTypesParameters;
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

function useResolveArgTypes(props: ArgTypesProps): ResolvedArgTypes {
  const { of } = props;
  if ('of' in props && of === undefined) {
    throw new InvalidBlockOfPropError();
  }
  const context = useContext(DocsContext);
  const resolved = useOf(of || 'meta');

  let resolvedArgTypes: Omit<ResolvedArgTypes, 'filterProps'>;
  if (resolved.type === 'component') {
    const {
      component,
      projectAnnotations: { parameters },
    } = resolved;
    resolvedArgTypes = {
      parameters: parameters as Parameters,
      // Bare `of={Component}` has no story/meta annotations; the docgen service is addressed by
      // component id, recovered from the CSF file that declares this component.
      componentId: context.getComponentId(component),
      argTypes: extractComponentArgTypes(component, parameters as Parameters),
      component,
    };
  } else if (resolved.type === 'meta') {
    const { id, argTypes, parameters, initialArgs, component, subcomponents } =
      resolved.preparedMeta;
    resolvedArgTypes = {
      parameters,
      componentId: id.split('--')[0],
      initialArgs,
      argTypes,
      component,
      subcomponents,
    };
  } else {
    const { id, argTypes, parameters, initialArgs, component, subcomponents } = resolved.story;
    resolvedArgTypes = {
      parameters,
      componentId: id.split('--')[0],
      storyId: id,
      initialArgs,
      argTypes,
      component,
      subcomponents,
    };
  }

  const argTypesParameters =
    resolvedArgTypes.parameters?.docs?.argTypes || ({} as ArgTypesParameters);

  return {
    ...resolvedArgTypes,
    filterProps: {
      include: props.include ?? argTypesParameters.include,
      exclude: props.exclude ?? argTypesParameters.exclude,
      sort: props.sort ?? argTypesParameters.sort,
    },
  };
}

function renderArgTypesTables({
  mainName = 'Main',
  mainRows,
  subcomponentRows,
  include,
  exclude,
  sort,
}: {
  mainName?: string;
  mainRows: StrictArgTypes;
  subcomponentRows: Record<string, StrictArgTypes>;
  include?: PropDescriptor;
  exclude?: PropDescriptor;
  sort?: SortType;
}) {
  const filteredMainRows = filterArgTypes(mainRows, include, exclude);

  if (Object.keys(subcomponentRows).length === 0) {
    return <PureArgsTable rows={filteredMainRows as any} sort={sort} />;
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

  return <TabbedArgsTable tabs={tabs as any} sort={sort} />;
}

const LegacyArgTypes: FC<ArgTypesProps> = (props) => {
  const { argTypes, parameters, component, subcomponents, filterProps } = useResolveArgTypes(props);

  if (!argTypes) {
    return null;
  }

  const subcomponentRows = Object.fromEntries(
    Object.entries(subcomponents || {}).map(([key, comp]) => [
      key,
      extractComponentArgTypes(comp, parameters),
    ])
  );

  return renderArgTypesTables({
    mainName: getComponentName(component),
    mainRows: argTypes,
    subcomponentRows,
    ...filterProps,
  });
};

const DocgenServiceArgTypes: FC<ArgTypesProps> = (props) => {
  const { argTypes, parameters, componentId, storyId, initialArgs, filterProps, component } =
    useResolveArgTypes(props);
  const servicePayload = useServiceDocgen(componentId);

  if (!servicePayload || !componentId) {
    return null;
  }

  const serviceSubcomponentRows = getServiceSubcomponentArgTypes(servicePayload);

  return renderArgTypesTables({
    mainName: getComponentName(component) ?? servicePayload.name,
    mainRows: mergeServiceArgTypes({
      payload: servicePayload,
      storyId: storyId ?? componentId,
      parameters,
      initialArgs,
      // Custom argTypes come from the locally-prepared meta/story (the service only carries
      // extracted component docgen), so the block works regardless of whether the story rendered.
      customArgTypes: argTypes,
    }),
    subcomponentRows: serviceSubcomponentRows,
    ...filterProps,
  });
};

const ArgTypesImpl: FC<ArgTypesProps> = (props) => {
  return globalThis.FEATURES?.experimentalDocgenServer ? (
    <DocgenServiceArgTypes {...props} />
  ) : (
    <LegacyArgTypes {...props} />
  );
};

export const ArgTypes = withMdxComponentOverride('ArgTypes', ArgTypesImpl);

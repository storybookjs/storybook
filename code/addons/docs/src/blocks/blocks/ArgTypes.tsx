import type { FC } from 'react';
import React, { useContext } from 'react';

import type { Args, Parameters, Renderer, StrictArgTypes } from 'storybook/internal/csf';
import { InvalidBlockOfPropError } from 'storybook/internal/preview-errors';
import type { ModuleExports } from 'storybook/internal/types';

import type { PropDescriptor } from 'storybook/preview-api';
import { filterArgTypes } from 'storybook/preview-api';

import type { SortType } from '../components';
import { ArgsTable as PureArgsTable, TabbedArgsTable } from '../components';
import {
  extractComponentArgTypes,
  extractSubcomponentArgTypes,
  useDocgenServiceRows,
} from './argTypesShared';
import { DocsContext } from './DocsContext.ts';
import { useOf } from './useOf.ts';
import { getComponentName } from './utils.ts';
import { withMdxComponentOverride } from './with-mdx-component-override.tsx';

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
  componentId: string;
  storyId?: string;
  initialArgs?: Args;
  argTypes?: StrictArgTypes;
  component?: Renderer['component'];
  subcomponents?: Record<string, Renderer['component']>;
  filterProps: ArgTypesParameters;
};

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
      componentId: context.getComponentId(component)!,
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

  return renderArgTypesTables({
    mainName: getComponentName(component),
    mainRows: argTypes,
    subcomponentRows: extractSubcomponentArgTypes(subcomponents, parameters),
    ...filterProps,
  });
};

const DocgenServiceArgTypes: FC<ArgTypesProps> = (props) => {
  const { argTypes, parameters, componentId, storyId, initialArgs, filterProps, component } =
    useResolveArgTypes(props);
  const { rows: serviceRows, isInitialLoading } = useDocgenServiceRows({
    componentId,
    storyId,
    parameters,
    initialArgs,
    customArgTypes: argTypes,
  });

  if (isInitialLoading) {
    return <PureArgsTable isLoading />;
  }

  if (!serviceRows) {
    return null;
  }

  return renderArgTypesTables({
    mainName: getComponentName(component) ?? serviceRows.serviceComponentName,
    mainRows: serviceRows.mainRows,
    subcomponentRows: serviceRows.subcomponentRows,
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

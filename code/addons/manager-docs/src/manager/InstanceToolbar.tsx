import React, { useMemo } from 'react';

import { AbstractToolbar } from 'storybook/internal/components';
import { Addon_TypesEnum, type Addon_BaseType } from 'storybook/internal/types';

import { ManagerContext, useStorybookApi, useStorybookState } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import {
  instanceTools,
  scopeManagerApi,
  scopeManagerState,
  type InstanceScope,
} from '../runtime/instance-manager-api.ts';

const Bar = styled.section(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  color: theme.barTextColor,
  background: theme.barBg,
  borderBottom: `1px solid ${theme.appBorderColor}`,
  overflowX: 'auto',
  overflowY: 'hidden',
}));

const ToolRow = styled(AbstractToolbar)({
  flex: 1,
  display: 'flex',
  justifyContent: 'space-between',
  flexWrap: 'nowrap',
  height: 40,
  marginInline: 10,
  gap: 30,
});

const ToolGroup = styled.div({
  display: 'flex',
  whiteSpace: 'nowrap',
  gap: 6,
  alignItems: 'center',
});

/** The manager's registered toolbar tools, bound to one docs instance's globals and parameters. */
export function InstanceToolbar({ label, ...scope }: InstanceScope & { label: string }) {
  const api = useStorybookApi();
  const state = useStorybookState();
  const { instanceId, storyId, globals, onGlobalsChange } = scope;

  const value = useMemo(() => {
    const own = { instanceId, storyId, globals, onGlobalsChange };
    return { api: scopeManagerApi(api, own), state: scopeManagerState(state, own) };
  }, [api, state, instanceId, storyId, globals, onGlobalsChange]);

  const tools = instanceTools(
    Object.values(api.getElements(Addon_TypesEnum.TOOL)),
    { storyId },
    state
  );
  const toolsExtra = instanceTools(
    Object.values(api.getElements(Addon_TypesEnum.TOOLEXTRA)),
    { storyId },
    state
  );
  if (tools.length === 0 && toolsExtra.length === 0) {
    return null;
  }

  return (
    <Bar aria-label={label} data-instance-toolbar={instanceId}>
      <ManagerContext.Provider value={value}>
        <ToolRow>
          <Tools list={tools} />
          <Tools list={toolsExtra} />
        </ToolRow>
      </ManagerContext.Provider>
    </Bar>
  );
}

function Tools({ list }: { list: Addon_BaseType[] }) {
  return (
    <ToolGroup>
      {list.map(({ render: Render, id }) => (
        <Render key={id} />
      ))}
    </ToolGroup>
  );
}

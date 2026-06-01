/**
 * Manager-side registration and toolbar tool for the example background-color service.
 *
 * Service registration is deferred into the addons.register callback so it runs after the
 * Storybook manager channel is ready. registerService auto-wires the channel internally —
 * no manual setServiceChannel call is needed.
 *
 * Clicking a color swatch calls `setColor`, which propagates to the preview via the
 * channel sync protocol.
 */

import React, { memo } from 'react';

import { addons, types } from 'storybook/manager-api';

import {
  registerService,
  useServiceCommand,
  useServiceQuery,
} from '../../core/src/shared/open-service/manager.ts';
import type { ServiceInstanceOf } from '../../core/src/shared/open-service/manager.ts';
import { BACKGROUND_COLORS, backgroundServiceDef } from './definition.ts';

const ADDON_ID = 'storybook/internal/example-background';

type BackgroundService = ServiceInstanceOf<typeof backgroundServiceDef>;

const Swatch = memo(function Swatch({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: value,
        border: `2px solid ${active ? '#1ea7fd' : 'rgba(0,0,0,0.15)'}`,
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
      }}
    />
  );
});

function BackgroundServiceTool({ service }: { service: BackgroundService }) {
  const color = useServiceQuery(service, 'getColor');
  const setColor = useServiceCommand(service, 'setColor');

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '0 8px' }}>
      {BACKGROUND_COLORS.map(({ label, value }) => (
        <Swatch
          key={value}
          label={label}
          value={value}
          active={color === value}
          onClick={() => setColor({ color: value })}
        />
      ))}
    </div>
  );
}

addons.register(ADDON_ID, () => {
  const service = registerService(backgroundServiceDef);

  addons.add(ADDON_ID, {
    title: 'Background (service)',
    type: types.TOOL,
    match: ({ viewMode, tabId }) => !!viewMode?.match(/^(story|docs)$/) && !tabId,
    render: () => <BackgroundServiceTool service={service} />,
  });
});

import React from 'react';

import { useServiceCommand, useServiceQuery } from 'storybook/manager-api';

import type {
  LocalCommandSyncService,
  OpenServiceDemoServices,
  RemoteCommandSyncService,
  StaticLoadSyncService,
} from '../services.ts';

type Props = {
  services: OpenServiceDemoServices;
};

type CommandDemoSectionProps = {
  service: LocalCommandSyncService | RemoteCommandSyncService;
  title: string;
  description: React.ReactNode;
  inputLabel: string;
  rawValueTestId: string;
};

function ValueBlock({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 style={{ fontSize: 13, margin: '0 0 6px' }}>{title}</h3>
      <pre
        data-testid={testId}
        style={{
          background: 'rgba(0, 0, 0, 0.06)',
          borderRadius: 4,
          margin: 0,
          padding: 12,
        }}
      >
        {children}
      </pre>
    </div>
  );
}

function DemoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: 'rgba(0, 0, 0, 0.03)',
        border: '1px solid rgba(0, 0, 0, 0.12)',
        borderRadius: 8,
        display: 'grid',
        gap: 12,
        fontFamily: 'sans-serif',
        padding: 16,
      }}
    >
      <h2 style={{ fontSize: 16, margin: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

function CommandDemoSection({
  service,
  title,
  description,
  inputLabel,
  rawValueTestId,
}: CommandDemoSectionProps) {
  const value = useServiceQuery(service, 'getValue');
  const setValue = useServiceCommand(service, 'setValue');

  return (
    <DemoSection title={title}>
      <p style={{ lineHeight: 1.5, margin: 0 }}>{description}</p>
      <label style={{ display: 'grid', gap: 6 }}>
        <span>Manager panel input</span>
        <input
          aria-label={inputLabel}
          type="text"
          value={value}
          placeholder="Type to sync with the story"
          onChange={(event) => {
            void setValue({ value: event.currentTarget.value });
          }}
          style={{ font: 'inherit', padding: '6px 8px', width: '100%' }}
        />
      </label>
      <ValueBlock title="Raw service value" testId={rawValueTestId}>
        {JSON.stringify(value)}
      </ValueBlock>
    </DemoSection>
  );
}

function StaticLoadDemoSection({ service }: { service: StaticLoadSyncService }) {
  const alpha = useServiceQuery(service, 'getEntry', { id: 'alpha' });
  const beta = useServiceQuery(service, 'getEntry', { id: 'beta' });
  const unbacked = useServiceQuery(service, 'getUnbacked');
  const [unbackedError, setUnbackedError] = React.useState<string | null>(null);

  // TODO: The useServiceQuery hook doesn't expose errors from queries that fail to load.
  // It should of course support that, but it doesn't yet.
  // So we have this manual effect to track the error.
  React.useEffect(() => {
    let active = true;

    void service.queries.getUnbacked
      .loaded()
      .then(() => {
        if (active) {
          setUnbackedError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setUnbackedError(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      active = false;
    };
  }, [service]);

  const unbackedStatus =
    unbackedError ?? (unbacked === null ? 'pending' : JSON.stringify(unbacked));

  return (
    <DemoSection title="Static Load">
      <p style={{ lineHeight: 1.5, margin: 0 }}>
        Static load demo — <code>getEntry</code> reads prebuilt JSON in production builds;
        <code>getUnbacked</code> has no static snapshot.
      </p>
      <ValueBlock title="Entry alpha" testId="static-load-manager-panel-entry-alpha-value">
        {JSON.stringify(alpha ?? null)}
      </ValueBlock>
      <ValueBlock title="Entry beta" testId="static-load-manager-panel-entry-beta-value">
        {JSON.stringify(beta ?? null)}
      </ValueBlock>
      <ValueBlock title="Unbacked load" testId="static-load-manager-panel-unbacked-status">
        {unbackedStatus}
      </ValueBlock>
    </DemoSection>
  );
}

export function OpenServiceDemoPanel({ services }: Props) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <CommandDemoSection
        service={services.localCommand}
        title="Local Command"
        description={
          <>
            Local command demo — <code>setValue</code> runs in each runtime and syncs over the
            channel.
          </>
        }
        inputLabel="Local command manager panel sync input"
        rawValueTestId="local-command-manager-panel-raw-service-state-value"
      />
      <CommandDemoSection
        service={services.remoteCommand}
        title="Remote Command"
        description={
          <>
            Remote command demo — <code>setValue</code> is implemented on the dev server only.
          </>
        }
        inputLabel="Remote command manager panel sync input"
        rawValueTestId="remote-command-manager-panel-raw-service-state-value"
      />
      <StaticLoadDemoSection service={services.staticLoad} />
    </div>
  );
}

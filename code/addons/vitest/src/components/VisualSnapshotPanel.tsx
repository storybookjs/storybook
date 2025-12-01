import React from 'react';

import { Addon_TypesEnum } from 'storybook/internal/types';

import { addons, useStorybookApi, useStorybookState } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

const Container = styled.div(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  color: theme.color.defaultText,
}));

const Image = styled.img({
  display: 'block',
  maxWidth: '100%',
  borderRadius: 4,
});

export const VISUAL_SNAPSHOT_PANEL_ID = 'storybook/test/visual-snapshot';
export const VISUAL_SNAPSHOT_EVENT = 'storybook/test:visual-screenshot';

type SnapshotMeta = {
  storyId: string;
  testName: string;
  url: string;
  browserName?: string;
  platform?: string;
  timestamp?: number;
};

export const VisualSnapshotPanel = () => {
  const state = useStorybookState();
  const api = useStorybookApi();
  const [snapshots, setSnapshots] = React.useState<SnapshotMeta[]>([]);
  const [fallbackSnapshot, setFallbackSnapshot] = React.useState<SnapshotMeta | null>(null);

  React.useEffect(() => {
    const channel = addons.getChannel();
    const handler = (payload: SnapshotMeta) => {
      if (!payload) {
        return;
      }
      if (payload.storyId === state.storyId) {
        setSnapshots((prev) =>
          [{ ...payload, timestamp: payload.timestamp ?? Date.now() }, ...prev].slice(0, 20)
        );
      }
    };
    channel.on(VISUAL_SNAPSHOT_EVENT, handler);
    return () => channel.off(VISUAL_SNAPSHOT_EVENT, handler);
  }, [state.storyId]);

  // Dev-only API: fetch latest screenshot from vite middleware and use as fallback.
  React.useEffect(() => {
    let cancelled = false;
    const story = state.storyId ? (api.getData(state.storyId) as any) : undefined;
    const testFilePath =
      story?.importPath || story?.parameters?.fileName || story?.parameters?.__STORYBOOK_FILE__;
    const qs = new URLSearchParams();

    if (state.storyId) {
      qs.set('storyId', state.storyId);
    }

    if (testFilePath) {
      qs.set('testFilePath', testFilePath);
    }

    fetch(`/__storybook_test__/api/visual-snapshot/latest?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.dataUri) {
          setFallbackSnapshot({
            storyId: state.storyId!,
            testName: 'latest',
            url: data.dataUri as string,
            timestamp: Date.now(),
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [state.storyId, api]);

  // Reset snapshots when switching stories
  React.useEffect(() => {
    setSnapshots([]);
    setFallbackSnapshot(null);
  }, [state.storyId]);

  if (snapshots.length === 0 && !fallbackSnapshot) {
    return (
      <Container>
        <p>No snapshot available. Run tests to capture a screenshot.</p>
      </Container>
    );
  }

  const items = snapshots.length > 0 ? snapshots : fallbackSnapshot ? [fallbackSnapshot] : [];

  return (
    <Container>
      {items.map((shot, idx) => {
        const when = shot.timestamp ? new Date(shot.timestamp).toLocaleString() : '';
        return (
          <div key={`${shot.testName}-${shot.timestamp}-${idx}`}>
            <div>
              <strong>{shot.testName}</strong>
              <div>
                {shot.browserName && <span>{shot.browserName}</span>}
                {shot.platform && <span> · {shot.platform}</span>}
                {when && <span> · {when}</span>}
              </div>
            </div>
            <Image src={shot.url} alt={shot.testName || 'visual-snapshot'} />
          </div>
        );
      })}
    </Container>
  );
};

export function registerVisualSnapshotPanel() {
  addons.add(VISUAL_SNAPSHOT_PANEL_ID, {
    type: Addon_TypesEnum.PANEL,
    title: 'Visual Snapshot',
    render: VisualSnapshotPanel,
  });
}

import type { Builder } from 'storybook/internal/types';

type PreviewBuilder = Pick<Builder<unknown>, 'start'>;
type ClosePreview = () => Promise<void>;
type PreviewLifecycle = {
  pending: Promise<void>;
  close?: ClosePreview;
};

const PREVIEW_LIFECYCLES = new WeakMap<PreviewBuilder['start'], PreviewLifecycle>();

/** Close the previous preview before the builder can replace the server used by `bail`. */
export function startPreview(
  builder: PreviewBuilder,
  options: Parameters<PreviewBuilder['start']>[0]
): Promise<ClosePreview> {
  const lifecycle: PreviewLifecycle = PREVIEW_LIFECYCLES.get(builder.start) ?? {
    pending: Promise.resolve(),
  };
  PREVIEW_LIFECYCLES.set(builder.start, lifecycle);

  const pending = lifecycle.pending.then(async (): Promise<ClosePreview> => {
    await lifecycle.close?.();
    lifecycle.close = undefined;

    const preview = await builder.start(options);
    let closing: Promise<void> | undefined;
    const close = (): Promise<void> => (closing ??= Promise.resolve().then(() => preview?.bail()));
    lifecycle.close = close;
    return close;
  });

  // A failed start can be retried; a failed cleanup remains attached to its preview.
  lifecycle.pending = pending.then(
    () => undefined,
    () => undefined
  );
  return pending;
}

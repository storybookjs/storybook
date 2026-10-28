// `storybook` no longer ships a copy of the manager globals runtime; fail loudly on the old key.
throw new Error(
  'storybook/internal/manager/globals-runtime moved to @storybook/manager. ' +
    'Resolve @storybook/manager/internal/manager/globals-runtime instead: ' +
    'the manager builder serves it from @storybook/manager/dist/ui.'
);

export {};

const component = {};
export default {
  title: 'TagLeak/Widget',
  component,
};

// Declared first on purpose: the docs entry attached via `<Meta of={}>` must not pick up
// this story's own tag, only tags shared by the whole component (see #35968).
export const Anatomy = {
  tags: ['anatomy'],
};

export const Default = {
  tags: ['showcase'],
};

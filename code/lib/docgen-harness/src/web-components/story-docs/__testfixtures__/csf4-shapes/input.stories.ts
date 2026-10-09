import preview from './preview.ts';

const meta = preview.meta({
  title: 'WebComponentsStoryDocs/Csf4Shapes',
  component: 'csf-shapes',
  args: { label: 'Factory' },
});

export const Primary = meta.story({ args: { count: 3 } });
export const Bare = meta.story();

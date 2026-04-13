import preview from '../../../../../.storybook/preview.tsx';
import { Particles } from './Particles.tsx';

const SomeComponent = (props: React.ComponentProps<'div'>) => {
  return <div {...props}>Cool</div>;
};

const meta = preview.meta({
  component: Particles,
  parameters: {
    layout: 'centered',
    chromatic: {
      disableSnapshot: true,
    },
  },
  args: {
    anchor: SomeComponent,
  },
});

export const Default = meta.story({});

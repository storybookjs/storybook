import { Button } from '../..';
import preview from '../../../../../.storybook/preview';
import { HighlightElement } from './HighlightElement';

const meta = preview.meta({
  component: HighlightElement,
  parameters: {
    layout: 'centered',
  },
});

export const Default = meta.story({
  args: {
    targetSelector: '#highlighted',
  },
  render: (args: { targetSelector: string; pulsating?: boolean }) => (
    <div style={{ overflow: 'hidden' }}>
      <Button variant="ghost" id="highlighted">
        I'm highlighted
      </Button>
      <HighlightElement {...args} />
    </div>
  ),
});

export const Pulsating = meta.story({
  args: {
    targetSelector: '#highlighted',
    pulsating: true,
  },
  render: (args: { targetSelector: string; pulsating?: boolean }) => (
    <>
      <Button variant="ghost" id="highlighted">
        I'm pulsating
      </Button>
      <HighlightElement {...args} />
    </>
  ),
});

export const PulsatingOverflow = meta.story({
  args: {
    targetSelector: '#highlighted',
    pulsating: true,
  },
  render: (args: { targetSelector: string; pulsating?: boolean }) => (
    <div style={{ overflow: 'hidden' }}>
      <Button variant="ghost" id="highlighted">
        I'm pulsating despite being contained by overflow:hidden
      </Button>
      <HighlightElement {...args} />
    </div>
  ),
});

export const WithScrollableContainer = meta.story({
  args: {
    targetSelector: '#highlighted-in-scroll',
    pulsating: true,
  },
  render: (args: { targetSelector: string; pulsating?: boolean }) => (
    <div
      style={{
        width: '290px',
        height: '360px',
        overflow: 'scroll',
        border: '1px solid #ccc',
        padding: '15px',
      }}
    >
      <div style={{ height: 300 }}></div>
      <Button variant="ghost" id="highlighted-in-scroll">
        Scroll down to see the highlight follow me
      </Button>
      <div style={{ height: 300 }}></div>
      <HighlightElement {...args} />
    </div>
  ),
});

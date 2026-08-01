import { JSX } from 'react';
import preview from '../../../../../.storybook/preview.tsx';
import { Card } from './Card.tsx';

const meta = preview.meta({
  component: Card,
});

const Contents = ({ children }: { children: React.ReactNode }) => (
  <div style={{ padding: 16 }}>{children}</div>
);

export const Default = meta.story(
  (): JSX.Element => (
    <Card>
      <Contents>Default</Contents>
    </Card>
  )
);

export const Rainbow = meta.story(
  (): JSX.Element => (
    <Card outlineAnimation="rainbow">
      <Contents>Rainbow</Contents>
    </Card>
  )
);

export const Spinning = meta.story(
  (): JSX.Element => (
    <Card outlineAnimation="spin">
      <Contents>Spinning</Contents>
    </Card>
  )
);

export const SpinningAgentic = meta.story(
  (): JSX.Element => (
    <Card outlineAnimation="spin" outlineColor="agentic">
      <Contents>Spinning agentic</Contents>
    </Card>
  )
);

// Filled agentic card with a spinning outline (as used by ReviewWidget). The
// `agentic` content background is translucent in dark mode, so this guards
// against the spinning gradient bleeding through the content instead of the ring.
export const SpinningAgenticFilled = meta.story(
  (): JSX.Element => (
    <Card outlineAnimation="spin" color="agentic">
      <Contents>Spinning agentic filled</Contents>
    </Card>
  )
);

export const Agentic = meta.story(
  (): JSX.Element => (
    <Card color="agentic">
      <Contents>Agentic</Contents>
    </Card>
  )
);

export const Positive = meta.story(
  (): JSX.Element => (
    <Card color="positive">
      <Contents>Positive</Contents>
    </Card>
  )
);

export const Warning = meta.story(
  (): JSX.Element => (
    <Card color="warning">
      <Contents>Warning</Contents>
    </Card>
  )
);

export const Negative = meta.story(
  (): JSX.Element => (
    <Card color="negative">
      <Contents>Negative</Contents>
    </Card>
  )
);

export const PositiveOutline = meta.story(
  (): JSX.Element => (
    <Card outlineColor="positive">
      <Contents>Positive</Contents>
    </Card>
  )
);

export const WarningOutline = meta.story(
  (): JSX.Element => (
    <Card outlineColor="warning">
      <Contents>Warning</Contents>
    </Card>
  )
);

export const NegativeOutline = meta.story(
  (): JSX.Element => (
    <Card outlineColor="negative">
      <Contents>Negative</Contents>
    </Card>
  )
);

export const Primary = meta.story(
  (): JSX.Element => (
    <Card outlineColor="primary">
      <Contents>Primary</Contents>
    </Card>
  )
);

export const Secondary = meta.story(
  (): JSX.Element => (
    <Card outlineColor="secondary">
      <Contents>Secondary</Contents>
    </Card>
  )
);

export const Ancillary = meta.story(
  (): JSX.Element => (
    <Card outlineColor="ancillary">
      <Contents>Ancillary</Contents>
    </Card>
  )
);

export const Orange = meta.story(
  (): JSX.Element => (
    <Card outlineColor="orange">
      <Contents>Orange</Contents>
    </Card>
  )
);

export const Gold = meta.story(
  (): JSX.Element => (
    <Card outlineColor="gold">
      <Contents>Gold</Contents>
    </Card>
  )
);

export const Green = meta.story(
  (): JSX.Element => (
    <Card outlineColor="green">
      <Contents>Green</Contents>
    </Card>
  )
);

export const Seafoam = meta.story(
  (): JSX.Element => (
    <Card outlineColor="seafoam">
      <Contents>Seafoam</Contents>
    </Card>
  )
);

export const Purple = meta.story(
  (): JSX.Element => (
    <Card outlineColor="purple">
      <Contents>Purple</Contents>
    </Card>
  )
);

export const Ultraviolet = meta.story(
  (): JSX.Element => (
    <Card outlineColor="ultraviolet">
      <Contents>Ultraviolet</Contents>
    </Card>
  )
);

export const Mediumdark = meta.story(
  (): JSX.Element => (
    <Card outlineColor="mediumdark">
      <Contents>Mediumdark</Contents>
    </Card>
  )
);

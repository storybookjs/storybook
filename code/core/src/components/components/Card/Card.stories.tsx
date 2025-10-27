import preview from '../../../../../.storybook/preview';
import { Card } from './Card';

const meta = preview.meta({
  component: Card,
});

const Contents = ({ children }: { children: React.ReactNode }) => (
  <div style={{ padding: 16 }}>{children}</div>
);

export const Default = meta.story(() => (
  <Card>
    <Contents>Default</Contents>
  </Card>
));

export const Rainbow = meta.story(() => (
  <Card outlineAnimation="rainbow">
    <Contents>Rainbow</Contents>
  </Card>
));

export const Spinning = meta.story(() => (
  <Card outlineAnimation="spin">
    <Contents>Spinning</Contents>
  </Card>
));

export const Positive = meta.story(() => (
  <Card outlineColor="positive">
    <Contents>Positive</Contents>
  </Card>
));

export const Warning = meta.story(() => (
  <Card outlineColor="warning">
    <Contents>Warning</Contents>
  </Card>
));

export const Negative = meta.story(() => (
  <Card outlineColor="negative">
    <Contents>Negative</Contents>
  </Card>
));

export const Primary = meta.story(() => (
  <Card outlineColor="primary">
    <Contents>Primary</Contents>
  </Card>
));

export const Secondary = meta.story(() => (
  <Card outlineColor="secondary">
    <Contents>Secondary</Contents>
  </Card>
));

export const Ancillary = meta.story(() => (
  <Card outlineColor="ancillary">
    <Contents>Ancillary</Contents>
  </Card>
));

export const Orange = meta.story(() => (
  <Card outlineColor="orange">
    <Contents>Orange</Contents>
  </Card>
));

export const Gold = meta.story(() => (
  <Card outlineColor="gold">
    <Contents>Gold</Contents>
  </Card>
));

export const Green = meta.story(() => (
  <Card outlineColor="green">
    <Contents>Green</Contents>
  </Card>
));

export const Seafoam = meta.story(() => (
  <Card outlineColor="seafoam">
    <Contents>Seafoam</Contents>
  </Card>
));

export const Purple = meta.story(() => (
  <Card outlineColor="purple">
    <Contents>Purple</Contents>
  </Card>
));

export const Ultraviolet = meta.story(() => (
  <Card outlineColor="ultraviolet">
    <Contents>Ultraviolet</Contents>
  </Card>
));

export const Mediumdark = meta.story(() => (
  <Card outlineColor="mediumdark">
    <Contents>Mediumdark</Contents>
  </Card>
));

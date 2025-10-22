import preview from '../../../../../.storybook/preview';
import { Card } from './Card';

const meta = preview.meta({
  component: Card,
});

const Contents = ({ children }: { children: React.ReactNode }) => (
  <div style={{ padding: 16 }}>{children}</div>
);

export const All = meta.story(() => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 30 }}>
    <Card>
      <Contents>Default</Contents>
    </Card>
    <Card outlineAnimation="rainbow">
      <Contents>Rainbow</Contents>
    </Card>
    <Card outlineAnimation="spin">
      <Contents>Spinning</Contents>
    </Card>
    <Card outlineColor="positive">
      <Contents>Positive</Contents>
    </Card>
    <Card outlineColor="warning">
      <Contents>Warning</Contents>
    </Card>
    <Card outlineColor="negative">
      <Contents>Negative</Contents>
    </Card>
    <Card outlineColor="primary">
      <Contents>Primary</Contents>
    </Card>
    <Card outlineColor="secondary">
      <Contents>Secondary</Contents>
    </Card>
    <Card outlineColor="ancillary">
      <Contents>Ancillary</Contents>
    </Card>
    <Card outlineColor="orange">
      <Contents>Orange</Contents>
    </Card>
    <Card outlineColor="gold">
      <Contents>Gold</Contents>
    </Card>
    <Card outlineColor="green">
      <Contents>Green</Contents>
    </Card>
    <Card outlineColor="seafoam">
      <Contents>Seafoam</Contents>
    </Card>
    <Card outlineColor="purple">
      <Contents>Purple</Contents>
    </Card>
    <Card outlineColor="ultraviolet">
      <Contents>Ultraviolet</Contents>
    </Card>
    <Card outlineColor="mediumdark">
      <Contents>Mediumdark</Contents>
    </Card>
  </div>
));

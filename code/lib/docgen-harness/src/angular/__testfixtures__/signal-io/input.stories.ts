import type { Meta, StoryObj } from '../../csf-types.ts';

import { SignalIoComponent } from './signal-io.component.ts';

const meta = {
  title: 'AngularFixtures/SignalIo',
  component: SignalIoComponent,
} satisfies Meta<SignalIoComponent>;

export default meta;

// Args are keyed by BINDING names (the aliased `step` binds as `increment`), matching
// what the legacy argTypes surface as controls; the class-derived StoryObj typing would
// key by property name instead.
type SignalIoArgs = {
  label: string;
  count: number;
  increment: number;
  disabled: boolean;
  toggled: (checked: boolean) => void;
};

export const PropsAsWritten: StoryObj<SignalIoArgs> = {
  args: { label: 'Quantity', count: 2, increment: 5, disabled: true },
};

export const EventHandlerArg: StoryObj<SignalIoArgs> = {
  args: { label: 'Quantity', count: 2, toggled: () => {} },
};

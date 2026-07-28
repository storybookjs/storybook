import type { Meta, StoryObj } from '../../csf-types.ts';

import { SignalAliasedImportComponent } from './signal-aliased-import.component.ts';

const meta = {
  title: 'AngularFixtures/SignalAliasedImport',
  component: SignalAliasedImportComponent,
} satisfies Meta<SignalAliasedImportComponent>;

export default meta;

export const PropsAsWritten: StoryObj<SignalAliasedImportComponent> = {
  args: { aliased: 'Quantity' },
};

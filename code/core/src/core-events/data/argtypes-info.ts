import type { ArgTypes } from '@storybook/csf';

export interface ArgTypesRequestPayload {
  storyId: string;
}

export interface ArgTypesResponsePayload {
  argTypes: ArgTypes;
}

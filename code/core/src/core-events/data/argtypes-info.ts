import type { ArgTypes } from '@storybook/core/csf';

export interface ArgTypesRequestPayload {
  storyId: string;
}

export interface ArgTypesResponsePayload {
  argTypes: ArgTypes;
}

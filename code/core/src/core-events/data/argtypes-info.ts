import type { ArgTypes } from 'storybook/internal/csf';

export interface ArgTypesRequestPayload {
  storyId: string;
}

export interface ArgTypesResponsePayload {
  argTypes: ArgTypes;
}

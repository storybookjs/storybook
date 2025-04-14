import type { ArgTypes } from '../../csf';

export interface ArgTypesRequestPayload {
  storyId: string;
}

export interface ArgTypesResponsePayload {
  argTypes: ArgTypes;
}

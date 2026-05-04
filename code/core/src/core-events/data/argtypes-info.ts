import type { ArgTypes } from '../../csf/index.ts';

export interface ArgTypesRequestPayload {
  storyId: string;
}

export interface ArgTypesResponsePayload {
  argTypes: ArgTypes;
}

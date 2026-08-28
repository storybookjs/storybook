import type { SerializedError } from '../../../shared/open-service/service-error-serialization.ts';
import type {
  CreateToolsOptions,
  ToolsClientInfo,
  ToolsDescribeOptions,
  ToolsStorybookInfo,
} from './types.ts';

export const CHILD_HOST_PROTOCOL_VERSION = 1;

export type ChildHelloMessage = {
  type: 'hello';
  version: number;
  storybook: ToolsStorybookInfo;
  clientInfo: Required<ToolsClientInfo>;
};

export type ChildResultMessage = {
  type: 'result';
  id: string;
  value: unknown;
};

export type ChildErrorMessage = {
  type: 'error';
  id: string;
  error: SerializedError;
};

export type ChildTelemetryMessage = {
  type: 'telemetry';
  id: string;
  event: string;
  payload: Record<string, unknown>;
};

export type ChildMessage =
  | ChildHelloMessage
  | ChildResultMessage
  | ChildErrorMessage
  | ChildTelemetryMessage;

export type ParentInitMessage = {
  type: 'init';
  options: CreateToolsOptions & { mode: 'local' | 'attached'; autoSpawn: false };
};

export type ParentDescribeMessage = {
  type: 'describe';
  id: string;
  options?: ToolsDescribeOptions;
};

export type ParentCallMessage = {
  type: 'call';
  id: string;
  ref: string;
  input: Record<string, unknown>;
};

export type ParentCancelMessage = {
  type: 'cancel';
  id: string;
};

export type ParentCloseMessage = {
  type: 'close';
};

export type ParentMessage =
  | ParentInitMessage
  | ParentDescribeMessage
  | ParentCallMessage
  | ParentCancelMessage
  | ParentCloseMessage;

export function isChildMessage(value: unknown): value is ChildMessage {
  return typeof value === 'object' && value !== null && 'type' in value;
}

import type { Channel } from '@storybook/core/channels';

import type { RequestData, ResponseData } from '@storybook/core/core-events';

export class RequestResponseError<Payload extends Record<string, any> | void> extends Error {
  payload: Payload | undefined = undefined;

  constructor(message: string, payload?: Payload) {
    super(message);
    this.payload = payload;
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const experimental_requestResponse = <
  RequestPayload,
  ResponsePayload = void,
  CreateNewStoryErrorPayload extends Record<string, any> | void = void,
>(
  channel: Channel,
  requestEvent: string,
  responseEvent: string,
  payload: RequestPayload,
  timeout = 5000
): Promise<ResponsePayload> => {
  let timeoutId: ReturnType<typeof setTimeout>;

  return new Promise((resolve, reject) => {
    const request: RequestData<typeof payload> = {
      id: Math.random().toString(16).slice(2),
      payload,
    };

    const responseHandler = (
      response: ResponseData<ResponsePayload, CreateNewStoryErrorPayload>
    ) => {
      if (response.id !== request.id) return;
      clearTimeout(timeoutId);
      channel.off(responseEvent, responseHandler);
      if (response.success) resolve(response.payload);
      else reject(new RequestResponseError(response.error, response.payload));
    };

    channel.emit(requestEvent, request);
    channel.on(responseEvent, responseHandler);

    timeoutId = setTimeout(() => {
      channel.off(responseEvent, responseHandler);
      reject(new RequestResponseError('Timed out waiting for response'));
    }, timeout);
  });
};

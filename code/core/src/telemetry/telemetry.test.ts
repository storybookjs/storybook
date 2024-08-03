import { fetch } from './fetch';

import { beforeEach, it, expect, vi } from 'vitest';

import { sendTelemetry } from './telemetry';

vi.mock('./fetch');
vi.mock('./event-cache', () => {
  return { set: vi.fn() };
});

vi.mock('./session-id', () => {
  return {
    getSessionId: async () => {
      return 'session-id';
    },
  };
});

const fetchMock = vi.mocked(fetch);

beforeEach(() => {
  fetchMock.mockResolvedValue({ status: 200 } as any);
});

it('makes a fetch request with name and data', async () => {
  await sendTelemetry({ eventType: 'dev', payload: { foo: 'bar' } });

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const body = JSON.parse(fetchMock?.mock?.calls?.[0]?.[1]?.body as any);
  expect(body).toMatchObject({
    eventType: 'dev',
    payload: { foo: 'bar' },
  });
});

it('retries if fetch fails with a 503', async () => {
  fetchMock.mockResolvedValueOnce({ status: 503 } as any);
  await sendTelemetry(
    {
      eventType: 'dev',
      payload: { foo: 'bar' },
    },
    { retryDelay: 0 }
  );

  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('gives up if fetch repeatedly fails', async () => {
  fetchMock.mockResolvedValue({ status: 503 } as any);
  await sendTelemetry(
    {
      eventType: 'dev',
      payload: { foo: 'bar' },
    },
    { retryDelay: 0 }
  );

  expect(fetchMock).toHaveBeenCalledTimes(4);
});

it('await all pending telemetry when passing in immediate = true', async () => {
  let numberOfResolvedTasks = 0;

  fetchMock.mockImplementation(async () => {
    // wait 10ms so that the "fetch" is still running while
    // getSessionId resolves immediately below. tricky!
    await new Promise((resolve) => {
      setTimeout(resolve, 10);
    });
    numberOfResolvedTasks += 1;
    return { status: 200 } as any;
  });

  // when we call sendTelemetry with immediate = true
  // all pending tasks will be awaited
  // to test this we add a few telemetry tasks that will be in the 'queue'
  // we do NOT await these tasks!
  sendTelemetry({
    eventType: 'init',
    payload: { foo: 'bar' },
  });
  sendTelemetry({
    eventType: 'dev',
    payload: { foo: 'bar' },
  });

  // wait for getSessionId to finish, but not for fetches
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(numberOfResolvedTasks).toBe(0);

  // here we await
  await sendTelemetry(
    {
      eventType: 'error',
      payload: { foo: 'bar' },
    },
    { retryDelay: 0, immediate: true }
  );

  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(numberOfResolvedTasks).toBe(3);
});

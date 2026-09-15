/**
 * Client capture transport: POST a CapturePayload to the dev-server
 * middleware. The middleware itself is a stage-0 stub (see vite-plugin.ts);
 * this module is the stable contract the stage-1 panel Generate button calls.
 */

import type { CapturePayload } from '../types.ts';

export const CAPTURE_ENDPOINT = '/__sb-devtools/capture';

export type CapturePoster = (
  endpoint: string,
  payload: CapturePayload
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const defaultPost: CapturePoster = (endpoint, payload) =>
  fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

/**
 * Sends the capture payload. Throws with the HTTP status on failure so the
 * panel can surface the error — capture never fails silently.
 */
export async function captureComponent(
  payload: CapturePayload,
  post: CapturePoster = defaultPost
): Promise<unknown> {
  const response = await post(CAPTURE_ENDPOINT, payload);
  if (!response.ok) {
    throw new Error(`capture failed: ${response.status}`);
  }
  return response.json();
}

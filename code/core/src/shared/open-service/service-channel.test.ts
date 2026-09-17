import { describe, expect, it } from 'vitest';

import {
  SERVICE_PROTOCOL_VERSION,
  commandAckSchema,
  commandErrorSchema,
  commandInvokeSchema,
  commandResultSchema,
  commandUnhandledSchema,
  stampedSnapshotSchema,
  syncStartSchema,
} from './service-channel.ts';

const envelopes = {
  syncStartSchema,
  stampedSnapshotSchema,
  commandInvokeSchema,
  commandAckSchema,
  commandUnhandledSchema,
  commandResultSchema,
  commandErrorSchema,
};

/** Field name → valibot schema type, for every `services:*` envelope. */
function envelopeShapes() {
  return Object.fromEntries(
    Object.entries(envelopes).map(([name, schema]) => [
      name,
      Object.fromEntries(
        Object.entries(schema.entries).map(([field, entry]) => [field, entry.type])
      ),
    ])
  );
}

describe('SERVICE_PROTOCOL_VERSION', () => {
  // A peer on another build fails `safeParse` and drops the envelope in silence; the version in the
  // instance record is what lets attach refuse instead. Changing a shape below without bumping the
  // version recreates that silent drop, so the two are pinned together: when this snapshot changes,
  // bump `SERVICE_PROTOCOL_VERSION` in the same commit and update the snapshot.
  it('is bumped together with the envelope shapes', () => {
    expect({ version: SERVICE_PROTOCOL_VERSION, envelopes: envelopeShapes() })
      .toMatchInlineSnapshot(`
      {
        "envelopes": {
          "commandAckSchema": {
            "callId": "string",
            "clientId": "string",
            "serviceId": "string",
          },
          "commandErrorSchema": {
            "callId": "string",
            "clientId": "string",
            "error": "custom",
            "serviceId": "string",
          },
          "commandInvokeSchema": {
            "callId": "string",
            "clientId": "string",
            "commandName": "string",
            "input": "optional",
            "serviceId": "string",
          },
          "commandResultSchema": {
            "callId": "string",
            "clientId": "string",
            "result": "optional",
            "serviceId": "string",
          },
          "commandUnhandledSchema": {
            "callId": "string",
            "clientId": "string",
            "serviceId": "string",
          },
          "stampedSnapshotSchema": {
            "clientId": "string",
            "serviceId": "string",
            "state": "custom",
            "version": "number",
          },
          "syncStartSchema": {
            "clientId": "string",
            "serviceId": "string",
          },
        },
        "version": 1,
      }
    `);
  });
});

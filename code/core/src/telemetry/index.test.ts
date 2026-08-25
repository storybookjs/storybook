import { beforeEach, describe, expect, it, vi } from 'vitest';

// We need to reset module state between tests
let telemetryModule: typeof import('./index.ts');

// Mock the dependencies that telemetry() calls internally
vi.mock('storybook/internal/node-logger', () => ({
  logger: { info: vi.fn() },
}));

vi.mock('./notify.ts', () => ({
  notify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./storybook-metadata.ts', () => ({
  getStorybookMetadata: vi.fn().mockResolvedValue({}),
}));

vi.mock('./telemetry.ts', () => ({
  sendTelemetry: vi.fn().mockResolvedValue(undefined),
  addToGlobalContext: vi.fn(),
}));

beforeEach(async () => {
  vi.resetModules();
  // The state machine globals deliberately survive module re-loads, so reset them explicitly
  delete (globalThis as any).SB_TELEMETRY_STATE;
  delete (globalThis as any).SB_TELEMETRY_QUEUE;
  delete (globalThis as any).PAYLOAD_ERROR_HANDLER;
  telemetryModule = await import('./index.ts');
}, 30_000);

describe('telemetry state machine', () => {
  it('starts in uninitialized state and queues events', async () => {
    const { sendTelemetry } = await import('./telemetry.ts');

    await telemetryModule.telemetry('boot', { eventType: 'dev' }, { stripMetadata: true });

    // Event should be queued, not sent
    expect(sendTelemetry).not.toHaveBeenCalled();
  });

  it('flushes queued events when setTelemetryEnabled(true) is called', async () => {
    const { sendTelemetry } = await import('./telemetry.ts');

    await telemetryModule.telemetry('boot', { eventType: 'dev' }, { stripMetadata: true });
    expect(sendTelemetry).not.toHaveBeenCalled();

    await telemetryModule.setTelemetryEnabled(true);

    expect(sendTelemetry).toHaveBeenCalledTimes(1);
    expect(sendTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'boot', payload: { eventType: 'dev' } }),
      expect.objectContaining({ stripMetadata: true, timestamp: expect.any(Number) })
    );
  });

  it('clears queue when setTelemetryEnabled(false) is called', async () => {
    const { sendTelemetry } = await import('./telemetry.ts');

    await telemetryModule.telemetry('boot', { eventType: 'dev' }, { stripMetadata: true });
    expect(sendTelemetry).not.toHaveBeenCalled();

    await telemetryModule.setTelemetryEnabled(false);

    // Queue cleared, nothing sent
    expect(sendTelemetry).not.toHaveBeenCalled();
  });

  it('sends events immediately after state is resolved to enabled', async () => {
    const { sendTelemetry } = await import('./telemetry.ts');

    await telemetryModule.setTelemetryEnabled(true);
    expect(telemetryModule.isTelemetryModuleEnabled()).toBe(true);

    await telemetryModule.telemetry('dev', { foo: 'bar' });

    // Sent immediately, not queued
    expect(sendTelemetry).toHaveBeenCalledTimes(1);
  });

  it('drops events after state is resolved to disabled', async () => {
    const { sendTelemetry } = await import('./telemetry.ts');

    await telemetryModule.setTelemetryEnabled(false);
    expect(telemetryModule.isTelemetryModuleEnabled()).toBe(false);

    await telemetryModule.telemetry('dev', { foo: 'bar' });

    expect(sendTelemetry).not.toHaveBeenCalled();
  });

  it('sends events with force:true even when disabled', async () => {
    const { sendTelemetry } = await import('./telemetry.ts');

    await telemetryModule.setTelemetryEnabled(false);
    await telemetryModule.telemetry('error', { eventType: 'dev' }, { force: true });

    expect(sendTelemetry).toHaveBeenCalledTimes(1);
  });

  it('does not evaluate payload factory when disabled', async () => {
    const { sendTelemetry } = await import('./telemetry.ts');
    const payloadFactory = vi.fn().mockReturnValue({ eventType: 'dev' });

    await telemetryModule.setTelemetryEnabled(false);
    await telemetryModule.telemetry('dev', payloadFactory);

    expect(payloadFactory).not.toHaveBeenCalled();
    expect(sendTelemetry).not.toHaveBeenCalled();
  });

  it('evaluates payload factory when queued event is flushed', async () => {
    const { sendTelemetry } = await import('./telemetry.ts');
    const payloadFactory = vi.fn().mockReturnValue({ eventType: 'dev' });

    await telemetryModule.telemetry('boot', payloadFactory, { stripMetadata: true });

    expect(payloadFactory).not.toHaveBeenCalled();
    expect(sendTelemetry).not.toHaveBeenCalled();

    await telemetryModule.setTelemetryEnabled(true);

    expect(payloadFactory).toHaveBeenCalledTimes(1);
    expect(sendTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'boot', payload: { eventType: 'dev' } }),
      expect.objectContaining({ stripMetadata: true, timestamp: expect.any(Number) })
    );
  });

  it('preserves timestamps when flushing queued events', async () => {
    const { sendTelemetry } = await import('./telemetry.ts');

    const before = Date.now();
    await telemetryModule.telemetry('boot', { eventType: 'dev' }, { stripMetadata: true });
    const after = Date.now();

    await telemetryModule.setTelemetryEnabled(true);

    const call = vi.mocked(sendTelemetry).mock.calls[0];
    const timestamp = (call[1] as any).timestamp;
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('double setTelemetryEnabled(true) is idempotent', async () => {
    const { sendTelemetry } = await import('./telemetry.ts');

    await telemetryModule.telemetry('boot', { eventType: 'dev' }, { stripMetadata: true });

    await telemetryModule.setTelemetryEnabled(true);
    await telemetryModule.setTelemetryEnabled(true);

    // Only flushed once
    expect(sendTelemetry).toHaveBeenCalledTimes(1);
  });

  it('double setTelemetryEnabled(false) is idempotent', async () => {
    const { sendTelemetry } = await import('./telemetry.ts');

    await telemetryModule.telemetry('boot', { eventType: 'dev' }, { stripMetadata: true });

    await telemetryModule.setTelemetryEnabled(false);
    await telemetryModule.setTelemetryEnabled(false);

    expect(sendTelemetry).not.toHaveBeenCalled();
  });

  it('isTelemetryModuleEnabled returns correct state', async () => {
    expect(telemetryModule.isTelemetryModuleEnabled()).toBe(false);

    await telemetryModule.setTelemetryEnabled(false);
    expect(telemetryModule.isTelemetryModuleEnabled()).toBe(false);

    await telemetryModule.setTelemetryEnabled(true);
    expect(telemetryModule.isTelemetryModuleEnabled()).toBe(true);
  });
});

describe('second module load (e.g. addon resolving its own copy of the storybook package)', () => {
  it('preserves resolved state when the module loads a second time', async () => {
    await telemetryModule.setTelemetryEnabled(true);

    vi.resetModules();
    const secondInstance = await import('./index.ts');

    expect(secondInstance.isTelemetryStateResolved()).toBe(true);
    expect(secondInstance.isTelemetryModuleEnabled()).toBe(true);
  });

  it('sends events from a second module instance after the first one resolved state', async () => {
    await telemetryModule.setTelemetryEnabled(true);

    vi.resetModules();
    const secondInstance = await import('./index.ts');
    const { sendTelemetry } = await import('./telemetry.ts');

    await secondInstance.telemetry('dev', { foo: 'bar' }, { stripMetadata: true });

    expect(sendTelemetry).toHaveBeenCalledTimes(1);
  });

  it('flushes events queued by the first instance when a second instance resolves state', async () => {
    await telemetryModule.telemetry('boot', { eventType: 'dev' }, { stripMetadata: true });

    vi.resetModules();
    const secondInstance = await import('./index.ts');
    const { sendTelemetry } = await import('./telemetry.ts');

    await secondInstance.setTelemetryEnabled(true);

    expect(sendTelemetry).toHaveBeenCalledTimes(1);
    expect(sendTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'boot', payload: { eventType: 'dev' } }),
      expect.anything()
    );
  });

  it('preserves disabled state when the module loads a second time', async () => {
    await telemetryModule.setTelemetryEnabled(false);

    vi.resetModules();
    const secondInstance = await import('./index.ts');
    const { sendTelemetry } = await import('./telemetry.ts');

    await secondInstance.telemetry('dev', { foo: 'bar' });

    expect(secondInstance.isTelemetryStateResolved()).toBe(true);
    expect(secondInstance.isTelemetryModuleEnabled()).toBe(false);
    expect(sendTelemetry).not.toHaveBeenCalled();
  });

  it('keeps a payload error handler registered through the first instance', async () => {
    const errorHandler = vi.fn().mockResolvedValue(undefined);
    await telemetryModule.setTelemetryEnabled(true);
    telemetryModule.onPayloadError(errorHandler);

    vi.resetModules();
    const secondInstance = await import('./index.ts');

    const testError = new Error('payload failed');
    await secondInstance.telemetry('dev', async () => ({ error: testError }));

    expect(errorHandler).toHaveBeenCalledWith(testError, 'dev');
  });
});

describe('payload error handler (onPayloadError)', () => {
  it('calls registered handler when payload factory returns { error }', async () => {
    const { sendTelemetry } = await import('./telemetry.ts');
    const errorHandler = vi.fn().mockResolvedValue(undefined);

    await telemetryModule.setTelemetryEnabled(true);
    telemetryModule.onPayloadError(errorHandler);

    const testError = new Error('index generation failed');
    await telemetryModule.telemetry('dev', async () => ({ error: testError }));

    // Handler should be called with the error and original event type
    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler).toHaveBeenCalledWith(testError, 'dev');
    // Normal telemetry should NOT be sent
    expect(sendTelemetry).not.toHaveBeenCalled();

    telemetryModule.onPayloadError(undefined);
  });

  it('calls registered handler when payload factory throws', async () => {
    const { sendTelemetry } = await import('./telemetry.ts');
    const errorHandler = vi.fn().mockResolvedValue(undefined);

    await telemetryModule.setTelemetryEnabled(true);
    telemetryModule.onPayloadError(errorHandler);

    const testError = new Error('something broke');
    await telemetryModule.telemetry('dev', async () => {
      throw testError;
    });

    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler).toHaveBeenCalledWith(testError, 'dev');
    expect(sendTelemetry).not.toHaveBeenCalled();

    telemetryModule.onPayloadError(undefined);
  });

  it('does not call handler for error event type (prevents recursion)', async () => {
    const { sendTelemetry } = await import('./telemetry.ts');
    const errorHandler = vi.fn().mockResolvedValue(undefined);

    await telemetryModule.setTelemetryEnabled(true);
    telemetryModule.onPayloadError(errorHandler);

    // An 'error' event with error in payload should be sent normally, not intercepted
    await telemetryModule.telemetry(
      'error',
      { eventType: 'dev', error: new Error('test') },
      { enableCrashReports: true, force: true }
    );

    expect(errorHandler).not.toHaveBeenCalled();
    expect(sendTelemetry).toHaveBeenCalledTimes(1);
    expect(sendTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'error' }),
      expect.anything()
    );

    telemetryModule.onPayloadError(undefined);
  });

  it('sends normal telemetry when no handler is registered and factory returns { error }', async () => {
    const { sendTelemetry } = await import('./telemetry.ts');

    await telemetryModule.setTelemetryEnabled(true);
    // No handler registered — falls through to existing behavior

    const testError = new Error('unhandled error');
    await telemetryModule.telemetry('dev', async () => ({ error: testError }));

    // Without a handler, the existing finally-block logic applies
    // (error gets sanitized, event suppressed unless enableCrashReports)
    expect(sendTelemetry).not.toHaveBeenCalled();
  });

  it('clears handler when undefined is passed', async () => {
    const errorHandler = vi.fn().mockResolvedValue(undefined);

    await telemetryModule.setTelemetryEnabled(true);
    telemetryModule.onPayloadError(errorHandler);
    telemetryModule.onPayloadError(undefined);

    await telemetryModule.telemetry('dev', async () => ({ error: new Error('test') }));

    expect(errorHandler).not.toHaveBeenCalled();
  });
});

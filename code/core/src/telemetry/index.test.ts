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

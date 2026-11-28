import * as fs from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';

import { strFromU8, strToU8, unzipSync } from 'fflate';
import { fs as memory, vol } from 'memfs';
import { resolve } from 'pathe';

import { writeArchive } from './run.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

beforeEach(() => {
  vol.reset();
  vol.mkdirSync(resolve('/exports'), { recursive: true });
  vi.mocked(fs.mkdtemp).mockImplementation(memory.promises.mkdtemp as typeof fs.mkdtemp);
  vi.mocked(fs.writeFile).mockImplementation(memory.promises.writeFile as typeof fs.writeFile);
  vi.mocked(fs.link).mockImplementation(memory.promises.link as typeof fs.link);
  vi.mocked(fs.rm).mockImplementation(memory.promises.rm as typeof fs.rm);
});

describe('writeArchive', () => {
  const output = resolve('/exports/library.zip');
  const files = {
    'canvas.json': strToU8('{"artboards":[]}'),
    'assets/image.bin': new Uint8Array([0, 255]),
  };

  it('publishes a complete ZIP and removes temporary files', async () => {
    await writeArchive(output, files);
    const zip = unzipSync(new Uint8Array(vol.readFileSync(output) as Buffer));
    expect(strFromU8(zip['canvas.json'])).toBe('{"artboards":[]}');
    expect(zip['assets/image.bin']).toEqual(new Uint8Array([0, 255]));
    expect(vol.readdirSync(resolve('/exports'))).toEqual(['library.zip']);
  });

  it('preserves output created by another exporter before publication', async () => {
    vol.writeFileSync(output, 'existing archive');
    await expect(writeArchive(output, files)).rejects.toMatchObject({ code: 'EEXIST' });
    expect(vol.readFileSync(output, 'utf8')).toBe('existing archive');
    expect(vol.readdirSync(resolve('/exports'))).toEqual(['library.zip']);
  });

  it('reports cleanup failure without rejecting a published archive', async () => {
    vi.mocked(fs.rm).mockRejectedValueOnce(new Error('Cleanup failed'));
    await expect(writeArchive(output, files)).resolves.toBeUndefined();
    const zip = unzipSync(new Uint8Array(vol.readFileSync(output) as Buffer));
    expect(zip['assets/image.bin']).toEqual(new Uint8Array([0, 255]));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Cleanup failed'));
  });

  it('leaves no output after an interrupted write', async () => {
    vi.mocked(fs.writeFile).mockImplementationOnce(async (path) => {
      await memory.promises.writeFile(path as string, 'partial');
      throw new Error('Disk write failed');
    });
    await expect(writeArchive(output, files)).rejects.toThrow('Disk write failed');
    expect(vol.readdirSync(resolve('/exports'))).toEqual([]);
  });

  it('does not publish when cancelled while writing', async () => {
    const controller = new AbortController();
    vi.mocked(fs.writeFile).mockImplementationOnce(async (path, contents) => {
      await memory.promises.writeFile(path as string, contents as Uint8Array);
      controller.abort(new Error('Cancelled'));
    });
    await expect(writeArchive(output, files, controller.signal)).rejects.toThrow('Cancelled');
    expect(vol.readdirSync(resolve('/exports'))).toEqual([]);
  });

  it('finishes a complete archive when cancellation arrives after publication starts', async () => {
    const controller = new AbortController();
    vi.mocked(fs.link).mockImplementationOnce(async (source, destination) => {
      controller.abort();
      await memory.promises.link(source as string, destination as string);
    });
    await expect(writeArchive(output, files, controller.signal)).resolves.toBeUndefined();
    const zip = unzipSync(new Uint8Array(vol.readFileSync(output) as Buffer));
    expect(zip['assets/image.bin']).toEqual(new Uint8Array([0, 255]));
    expect(vol.readdirSync(resolve('/exports'))).toEqual(['library.zip']);
  });
});

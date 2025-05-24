// eslint-disable-next-line depend/ban-dependencies
import { execa } from 'execa';

/**
 * This code is derived from the library `kill-port` by Tiaan du Plessis. Original repository:
 * https://github.com/tiaanduplessis/kill-port
 *
 * The MIT License (MIT)
 *
 * Copyright (c) Tiaan du Plessis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 * associated documentation files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
 * NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
const killProcessInPort = async (port: number, method: 'tcp' | 'udp' = 'tcp') => {
  if (!port || isNaN(port)) {
    throw new Error('Invalid argument provided for port');
  }
  let args: string[] = [];
  let command: string;

  if (process.platform === 'win32') {
    try {
      const { stdout } = await execa('netstat', ['-nao']);

      if (!stdout) {
        return;
      }

      const lines = stdout.split('\n');
      const lineWithLocalPortRegEx = new RegExp(`^ *${method.toUpperCase()} *[^ ]*:${port}`, 'gm');
      const linesWithLocalPort = lines.filter((line) => line.match(lineWithLocalPortRegEx));

      const pids = linesWithLocalPort.reduce<string[]>((acc, line) => {
        const match = line.match(/\d+/gm);
        if (match && match[0] && !acc.includes(match[0])) {
          acc.push(match[0]);
        }
        return acc;
      }, []);

      if (pids.length > 0) {
        args = ['/F', ...pids.flatMap((pid) => ['/PID', pid])];
        command = 'TaskKill';
      }
    } catch (error) {
      throw new Error(`Failed to detect process on port ${port}: ${(error as Error).message}`);
    }
  } else {
    const protocol = method === 'udp' ? 'udp' : 'tcp';
    args = [
      '-c',
      `lsof -i ${protocol}:${port} | grep ${method === 'udp' ? 'UDP' : 'LISTEN'} | awk '{print $2}' | xargs kill -9`,
    ];
    command = 'sh';
  }

  try {
    if (command) {
      await execa(command, args);
    } else {
      throw new Error('No command to kill process found');
    }
  } catch (error: any) {
    if (!error.message.includes('No such process')) {
      console.error(`Failed to kill process on port ${port}`);
      throw error;
    }
  }
};

export const killPort = async (ports: number | number[], method: 'tcp' | 'udp' = 'tcp') => {
  const allPorts = Array.isArray(ports) ? ports : [ports];

  console.log(`🚮 cleaning up process in ports: ${allPorts.join(', ')}`);
  await Promise.all(allPorts.map((port) => killProcessInPort(port, method)));
};

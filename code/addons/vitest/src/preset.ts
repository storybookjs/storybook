import { watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import type { Channel } from 'storybook/internal/channels';
import type { Options } from 'storybook/internal/types';

import type { TestReport } from './types';
import { SharedState } from './utils/shared-state';

async function getTestReport(reportFile: string): Promise<TestReport> {
  const data = await readFile(reportFile, 'utf8');
  // TODO: Streaming and parsing large files
  return JSON.parse(data);
}

const watchTestReportDirectory = async (
  reportFile: string | undefined,
  onChange: (results: Awaited<ReturnType<typeof getTestReport>>) => Promise<void>
) => {
  if (!reportFile) return;

  const directory = dirname(reportFile);
  const targetFile = basename(reportFile);

  const handleFileChange = async (eventType: string, filename: string | null) => {
    if (filename && filename === targetFile) {
      try {
        await onChange(await getTestReport(reportFile));
      } catch(err: any) {
        if(err.code === 'ENOENT') {
          console.log('File got deleted/renamed. What should we do?');
          return;
        }

        throw err;
      }
    }
  };

  watch(directory, handleFileChange);

  try {
    const initialResults = await getTestReport(reportFile);
    await onChange(initialResults);
  } catch(err: any) {
    if(err.code === 'ENOENT') {
      return;
    }

    throw err;
  }
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export async function experimental_serverChannel(
  channel: Channel,
  options: Options & { reportFile?: string }
) {
  const { reportFile = join(process.cwd(), '.storybook', 'test-results.json') } = options;

  const testReportState = SharedState.subscribe<TestReport>('TEST_RESULTS', channel);

  watchTestReportDirectory(reportFile, async (results) => {
    console.log('Updating test results:', Object.keys(results.testResults).length);
    testReportState.value = results;
  });
}

import { readFile } from 'node:fs/promises';

import { logger } from '@storybook/core/node-logger';

import type { Express } from 'express';
import http from 'http';
import https from 'https';

export async function getServer(
  app: Express,
  options: {
    https?: boolean;
    sslCert?: string;
    sslKey?: string;
    sslCa?: string[];
  }
) {
  if (!options.https) {
    return http.createServer(app);
  }

  if (!options.sslCert) {
    logger.error('Error: --ssl-cert is required with --https');
    process.exit(-1);
  }

  if (!options.sslKey) {
    logger.error('Error: --ssl-key is required with --https');
    process.exit(-1);
  }

  const sslOptions = {
    ca: await Promise.all((options.sslCa || []).map((ca) => readFile(ca, { encoding: 'utf8' }))),
    cert: await readFile(options.sslCert, { encoding: 'utf8' }),
    key: await readFile(options.sslKey, { encoding: 'utf8' }),
  };

  return https.createServer(sslOptions, app);
}

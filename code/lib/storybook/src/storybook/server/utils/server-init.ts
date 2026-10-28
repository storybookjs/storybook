import { readFile } from 'node:fs/promises';

import http from 'http';
import https from 'https';

export async function getServer(options: {
  https?: boolean;
  sslCert?: string;
  sslKey?: string;
  sslCa?: string[];
}): Promise<http.Server | https.Server> {
  if (!options.https) {
    return http.createServer();
  }

  if (!options.sslCert) {
    throw new Error('--ssl-cert is required with --https');
  }

  if (!options.sslKey) {
    throw new Error('--ssl-key is required with --https');
  }

  const sslOptions = {
    ca: await Promise.all((options.sslCa || []).map((ca) => readFile(ca, { encoding: 'utf8' }))),
    cert: await readFile(options.sslCert, { encoding: 'utf8' }),
    key: await readFile(options.sslKey, { encoding: 'utf8' }),
  };

  return https.createServer(sslOptions);
}

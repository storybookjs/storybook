// Point the sandbox's agent at an externally hosted Storybook MCP — e.g. a
// published Chromatic build, which serves `@storybook/mcp` at `<build-url>/mcp`.
// Nothing boots in the sandbox; pin a build URL per experiment for reproducible
// runs (Chromatic build URLs are immutable).
//
// Registered under the same server name the stock templates use, so every
// #test-utils workflow helper applies unchanged.
import type { Sandbox } from '@vercel/agent-eval';

import { type EvalAgent, writeStorybookMcpConfig } from '../templates.ts';

/** Accept a Storybook build URL with or without the /mcp suffix. */
function normalizeMcpUrl(storybookUrl: string): string {
  const trimmed = storybookUrl.replace(/\/+$/, '');
  return trimmed.endsWith('/mcp') ? trimmed : `${trimmed}/mcp`;
}

/**
 * Fail fast (host-side, before any agent tokens are spent) if the endpoint
 * does not answer an MCP initialize request.
 */
async function probeMcpEndpoint(url: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'agent-eval-probe', version: '0' },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new Error(`registerExternalStorybookMcp: ${url} is unreachable: ${String(error)}`);
  }
  if (!response.ok) {
    throw new Error(
      `registerExternalStorybookMcp: ${url} answered HTTP ${response.status} to an MCP initialize request`
    );
  }
}

/**
 * Register an externally hosted Storybook MCP in the sandbox, in whichever
 * config format the agent reads. Call in an experiment's setup(), any time
 * after setupSandbox().
 */
export async function registerExternalStorybookMcp(
  sandbox: Sandbox,
  storybookUrl: string,
  agent: EvalAgent
): Promise<void> {
  const url = normalizeMcpUrl(storybookUrl);
  await probeMcpEndpoint(url);
  await writeStorybookMcpConfig(sandbox, agent, url);
}

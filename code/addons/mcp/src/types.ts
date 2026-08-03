import * as v from 'valibot';
import type { Options } from 'storybook/internal/types';
import type { StorybookContext } from '@storybook/mcp';

const isLiteralEndpointPathname = (endpoint: string) => {
  try {
    const { pathname } = new URL(endpoint, 'http://storybook.local');
    return pathname === endpoint && pathname !== '/';
  } catch {
    return false;
  }
};

export const AddonOptions = v.object({
  endpoint: v.optional(
    v.pipe(
      v.string(),
      v.check(isLiteralEndpointPathname, 'Endpoint must be a literal URL pathname')
    )
  ),
  toolsets: v.optional(
    v.object({
      dev: v.exactOptional(v.boolean(), true),
      docs: v.exactOptional(v.boolean(), true),
      test: v.exactOptional(v.boolean(), true),
    }),
    {
      // Default values for toolsets
      dev: true,
      docs: true,
      test: true,
    }
  ),
});

export type AddonOptionsInput = v.InferInput<typeof AddonOptions>;
export type AddonOptionsOutput = v.InferOutput<typeof AddonOptions>;
/**
 * Custom context passed to MCP server and tools.
 * Contains Storybook-specific configuration and runtime information.
 * Extends StorybookContext to be compatible with @storybook/mcp tools.
 */
export type AddonContext = StorybookContext & {
  /**
   * The Storybook options object containing configuration,
   * port, presets, and other runtime information.
   */
  options: Options;

  /**
   * The resolved MCP endpoint pathname for this Storybook instance.
   */
  endpoint?: string;

  /**
   * The origin URL of the running Storybook instance.
   * Typically http://localhost:{port}
   */
  origin: string;

  /**
   * Whether telemetry collection is disabled.
   */
  disableTelemetry: boolean;

  /**
   * Whether @storybook/addon-a11y is enabled.
   * Used to dynamically tailor tool descriptions and guidance.
   */
  a11yEnabled?: boolean;

  toolsets?: NonNullable<AddonOptionsOutput>['toolsets'];

  /**
   * Effective review gate for the current request: the explicit
   * `experimentalReview` feature flag, or the CLI default when the request
   * carries the trusted local-client header (`storybook ai` / the plugins).
   * Gates the `display-review` tool and the instruction variant.
   */
  reviewEnabled?: boolean;

  /**
   * Whether this request came through the `storybook ai` CLI channel (marked by
   * {@link STORYBOOK_MCP_PROXY_HEADER}) rather than from a direct MCP client. Telemetry reports it
   * as the `consumer` field.
   */
  cliClient?: boolean;
};

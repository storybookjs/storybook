import { mcpServerHandler } from './mcp-handler.ts';
import type { PresetProperty } from 'storybook/internal/types';
import { AddonOptions, type AddonOptionsInput } from './types.ts';
import * as v from 'valibot';
import { isManifestAvailable } from './tools/is-manifest-available.ts';

export const experimental_devServer: PresetProperty<
	'experimental_devServer'
> = async (app, options) => {
	const addonOptions = v.parse(AddonOptions, {
		toolsets: (options as AddonOptionsInput).toolsets ?? {},
	});

	app!.post('/mcp', (req, res, next) =>
		mcpServerHandler({
			req,
			res,
			next,
			options,
			addonOptions,
		}),
	);

	const shouldRedirect = await isManifestAvailable(options);

	app!.get('/mcp', async (req, res) => {
		const acceptHeader = req.headers['accept'] || '';

		if (acceptHeader.includes('text/html')) {
			// Browser request - send HTML with redirect
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end(`
        <!DOCTYPE html>
        <html>
					<head>
						${shouldRedirect ? '<meta http-equiv="refresh" content="10;url=/manifests/components.html" />' : ''}
						<style>
							@font-face {
								font-family: 'Nunito Sans';
								font-style: normal;
								font-weight: 400;
								font-display: swap;
								src: url('./sb-common-assets/nunito-sans-regular.woff2') format('woff2');
							}
							
							* {
								margin: 0;
								padding: 0;
								box-sizing: border-box;
							}
							
							html, body {
								height: 100%;
								font-family: 'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
							}
							
							body {
								display: flex;
								flex-direction: column;
								justify-content: center;
								align-items: center;
								text-align: center;
								padding: 2rem;
								background-color: #ffffff;
								color: rgb(46, 52, 56);
								line-height: 1.6;
							}
							
							p {
								margin-bottom: 1rem;
							}
							
							code {
								font-family: 'Monaco', 'Courier New', monospace;
								background: #f5f5f5;
								padding: 0.2em 0.4em;
								border-radius: 3px;
							}
							
							a {
								color: #1ea7fd;
							}
							
							@media (prefers-color-scheme: dark) {
								body {
									background-color: rgb(34, 36, 37);
									color: rgb(201, 205, 207);
								}
								
								code {
									background: rgba(255, 255, 255, 0.1);
								}
							}
						</style>
					</head>
					<body>
						<div>
							<p>
								Storybook MCP server successfully running via
								<code>@storybook/addon-mcp</code>.
							</p>
							<p>
								See how to connect to it from your coding agent in <a target="_blank" href="https://github.com/storybookjs/mcp/tree/main/packages/addon-mcp#configuring-your-agent">the addon's README</a>.
							</p>
							${
								shouldRedirect
									? `
									<p>
										Automatically redirecting to
										<a href="/manifests/components.html">component manifest</a>
										in <span id="countdown">10</span> seconds...
									</p>`
									: ''
							}
						</div>
						${
							shouldRedirect
								? `
							<script>
								let countdown = 10;
								const countdownElement = document.getElementById('countdown');
								setInterval(() => {
									countdown -= 1;
									countdownElement.textContent = countdown.toString();
								}, 1000);
							</script>
							`
								: ''
						}
					</body>
        </html>
      `);
		} else {
			// Non-browser request (API, curl, etc.) - send plain text
			res.writeHead(200, { 'Content-Type': 'text/plain' });
			res.end(
				'Storybook MCP server successfully running via @storybook/addon-mcp',
			);
		}
	});
	return app;
};

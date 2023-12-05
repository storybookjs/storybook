---
title: 'CLI options'
---

The Storybook command line interface (CLI) is the main tool you use to build and develop Storybook.

<Callout variant="info">

Storybook collects completely anonymous data to help us improve user experience. Participation is optional, and you may [opt-out](../configure/telemetry.md#how-to-opt-out) if you'd not like to share any information.

</Callout>

## API commands

All of the following documentation is available in the CLI by running `storybook --help`.

### `dev`

Compiles and serves a development build of your Storybook that reflects your source code changes in the browser in real time. Should be run from the root of your project.

```shell
storybook dev [options]
```

Options include:

| Option                          | Description                                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--help`                        | Output usage information <br/>`storybook dev --help`                                                                                                                      |
| `-V`, `--version`               | Output the version number <br/>`storybook dev -V`                                                                                                                         |
| `-p`, `--port [number]`         | Port to run Storybook <br/>`storybook dev -p 9009`                                                                                                                        |
| `-h`, `--host [string]`         | Host to run Storybook <br/>`storybook dev -h my-host.com`                                                                                                                 |
| `-s`, `--static-dir`            | **Deprecated** [see note](#static-dir-deprecation). Directory where to load static files from, comma-separated list<br/>`storybook dev -s public`                         |
| `-c`, `--config-dir [dir-name]` | Directory where to load Storybook configurations from <br/>`storybook dev -c .storybook`                                                                                  |
| `--https`                       | Serve Storybook over HTTPS. Note: You must provide your own certificate information<br/>`storybook dev --https`                                                           |
| `--ssl-ca`                      | Provide an SSL certificate authority. (Optional with --https, required if using a self-signed certificate)<br/>`storybook dev --ssl-ca my-certificate`                    |
| `--ssl-cert`                    | Provide an SSL certificate. (Required with --https)<br/>`storybook dev --ssl-cert my-ssl-certificate`                                                                     |
| `--ssl-key`                     | Provide an SSL key. (Required with --https)<br/>`storybook dev --ssl-key my-ssl-key`                                                                                      |
| `--smoke-test`                  | Exit after successful start<br/>`storybook dev --smoke-test`                                                                                                              |
| `--ci`                          | CI mode (skip interactive prompts, don't open browser)<br/>`storybook dev --ci`                                                                                           |
| `--no-open`                     | Do not open Storybook automatically in the browser<br/>`storybook dev --no-open`                                                                                          |
| `--quiet`                       | Suppress verbose build output<br/>`storybook dev --quiet`                                                                                                                 |
| `--debug-webpack`               | Display final webpack configurations for debugging purposes<br/>`storybook dev --debug-webpack`                                                                           |
| `--webpack-stats-json`          | Write Webpack Stats JSON to disk<br/>`storybook dev --webpack-stats-json /tmp/webpack-stats`                                                                              |
| `--docs`                        | Starts Storybook in documentation mode. Learn more about it in [here](../writing-docs/build-documentation.md#preview-storybooks-documentation)<br/>`storybook dev --docs` |
| `--disable-telemetry`           | Disables Storybook's telemetry. Learn more about it [here](../configure/telemetry.md)<br/>`storybook dev --disable-telemetry`                                             |

<Callout variant="warning" id="static-dir-deprecation">

Starting in 6.4 the `-s` flag is deprecated. Instead, use a configuration object in your `.storybook/main.js` file. See the [images and assets documentation](../configure/images-and-assets.md#serving-static-files-via-storybook) for more information.

</Callout>

### `build`

Compiles your Storybook instance so it can be [deployed](../sharing/publish-storybook.md). Should be run from the root of your project.

```shell
storybook build [options]
```

Options include:

| Option                          | Description                                                                                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-h`, `--help`                  | Output usage information<br/>`storybook build --help`                                                                                                                                                 |
| `-V`, `--version`               | Output the version number<br/>`storybook build -V`                                                                                                                                                    |
| `-s`, `--static-dir`            | **Deprecated** [see note](#static-dir-deprecation).<br/> Directory where to load static files from, comma-separated list<br/>`storybook build -s public`                                              |
| `-o`, `--output-dir [dir-name]` | Directory where to store built files<br/>`storybook build -o /my-deployed-storybook`                                                                                                                  |
| `-c`, `--config-dir [dir-name]` | Directory where to load Storybook configurations from<br/>`storybook build -c .storybook`                                                                                                             |
| `--loglevel [level]`            | Controls level of logging during build.<br/> Available options: `silly`, `verbose`, `info` (default), `warn`, `error`, `silent`<br/>`storybook build --loglevel warn`                                 |
| `--quiet`                       | Suppress verbose build output<br/>`storybook build --quiet`                                                                                                                                           |
| `--debug-webpack`               | Display final webpack configurations for debugging purposes<br/>`storybook build --debug-webpack`                                                                                                     |
| `--webpack-stats-json`          | Write Webpack Stats JSON to disk<br/>`storybook build --webpack-stats-json /my-storybook/webpack-stats`                                                                                               |
| `--docs`                        | Builds Storybook in documentation mode. Learn more about it in [here](../writing-docs/build-documentation.md#publish-storybooks-documentation)<br/>`storybook build --docs`                           |
| `--disable-telemetry`           | Disables Storybook's telemetry. Learn more about it [here](../configure/telemetry.md).<br/>`storybook build --disable-telemetry`                                                                      |
| `--test`                        | Optimize Storybook's production build for performance and tests by removing unnecessary features with the `test` option. Learn more [here](../api/main-config-build.md).<br/>`storybook build --test` |

<Callout variant="info" icon="💡">

If you're using npm instead of yarn to publish Storybook, the commands work slightly different. For example, `npm run storybook build -- -o ./path/to/build`.

</Callout>

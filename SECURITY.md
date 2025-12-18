# Security Policy

## Supported Versions

We release patches for fixing security vulnerabilities, primarily focusing on the latest release only. 

In the event of a high-risk vulnerability, we may backport the security fixes to the minor versions of the software, starting from the latest minor version up to the latest major release. The decision to backport security fixes to older versions will be made based on a risk assessment and the feasibility of implementing the patch in those versions.

## Reporting a Vulnerability

To report a vulnerability, you can reach out to the maintainers directly on [X](https://x.com/storybookjs) or [Bluesky](https://bsky.app/profile/storybook.js.org).

When we fix a security issue, we will post a security advisory on GitHub and/or npm, describe the change in the [release notes](https://github.com/storybookjs/storybook/releases), and also announce notify the community on [our Discord](https://discord.gg/storybook).

## Security advisories

GitHub provides the option for you to privately report a vulnerability through a [security advisory](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/about-repository-security-advisories). These provide a secure and private channel between the reporter and the Storybook core team to discuss and address a security vulnerability. However, as a general rule, you should get in touch with us through other channels before creating a security advisory.

Please do not use security advisories to report dependencies with known vulnerabilities unless it poses a significant threat to Storybook users. There are many packages we depend on, either directly or indirectly. A security issue in one of these packages does not necessarily mean the vulnerability can be exploited through Storybook, or that the exploit can be used with malicious intent. For example, a weak random hash generator is not a problem if Storybook only uses it to generate unique identifiers for HTML elements. We expect a security advisory to include information on how to exploit the vulnerability through Storybook, specifically. If there is a security patch available for a downstream dependency, please open a bug report or a pull request to address it.

# Security Policy

## Supported Versions

We release patches for security vulnerabilities, primarily focusing on the latest major version.

Security fixes are backported to the previous two major versions only for vulnerabilities with High or Critical CVSS scores (7.0+). The decision to backport is made based on severity assessment and the feasibility of implementing the patch in those versions.

- Latest major version: All security vulnerabilities
- Previous two major versions: High or Critical CVSS scores only
- Older versions: Not supported (Users should upgrade to a supported version)

## Reporting a Vulnerability

To report a vulnerability, you can reach out to the maintainers directly on [X](https://x.com/storybookjs) or [Bluesky](https://bsky.app/profile/storybook.js.org), or file a security advisory.

When we fix a critical security issue, we will post a security advisory on GitHub and/or npm, describe the change in the [release notes](https://github.com/storybookjs/storybook/releases), and also notify the community through appropriate means.

## Security advisories

GitHub provides the option for you to privately report a vulnerability through a [security advisory](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/about-repository-security-advisories). These provide a secure and private channel between the reporter and the Storybook core team to discuss and address a security vulnerability.

### Dependency related advisories

Please do not open security advisories solely to report vulnerabilities in downstream dependencies unless they pose a realistic security risk to Storybook users.

Storybook depends on many packages, both directly and indirectly. A vulnerability in one of these dependencies does not automatically imply that Storybook is vulnerable, exploitable, or usable for malicious purposes. Security reports should clearly explain how the vulnerability can be exploited through Storybook itself. Reports that only cite a dependency advisory, without demonstrating impact in Storybook, are unlikely to be actionable. For example, a weak random hash generator is not a security issue if Storybook only uses it to generate non sensitive HTML element identifiers.

If a security patch is available for a downstream dependency and upgrading it meaningfully improves Storybook’s security posture, please open a bug report or pull request instead of a security advisory.

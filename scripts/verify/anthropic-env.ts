const ANTHROPIC_BASE_URL_RE = /^https:\/\/([^.]+\.)?anthropic\.com\//;

export function assertAnthropicBaseUrl(): void {
  const baseURL = process.env.ANTHROPIC_BASE_URL;
  if (!baseURL) {
    return;
  }
  if (!ANTHROPIC_BASE_URL_RE.test(baseURL)) {
    throw new Error(
      'ANTHROPIC_BASE_URL must match https://anthropic.com/ or https://<subdomain>.anthropic.com/ when set.'
    );
  }
}

// TODO(W5): Import this helper from W5-owned Anthropic dispatch modules that read ANTHROPIC_BASE_URL.

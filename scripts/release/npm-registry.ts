import picocolors from 'picocolors';

const NPM_REGISTRY = 'https://registry.npmjs.org';

export const isPackageVersionPublished = async ({
  packageName,
  version,
  verbose,
}: {
  packageName: string;
  version: string;
  verbose?: boolean;
}) => {
  const prettyPackage = `${picocolors.blue(packageName)}@${picocolors.green(version)}`;
  const url = `${NPM_REGISTRY}/${packageName}/${version}`;

  if (verbose) {
    console.log(`Fetching from npm: ${url}`);
  }

  const response = await fetch(url);
  if (response.status === 404) {
    console.log(`🌤️ ${prettyPackage} is not published`);
    return false;
  }
  if (response.status !== 200) {
    const body = await response.text();
    console.error(
      `Unexpected status code when checking the current version on npm: ${response.status}`
    );
    console.error(body);
    throw new Error(
      `Unexpected status code when checking the current version on npm: ${response.status}`
    );
  }

  const data: { version?: string } = await response.json();
  if (verbose) {
    console.log(`Response from npm:`, data);
  }
  if (data.version !== version) {
    console.error(
      `Unexpected version received when checking the current version on npm: ${data.version}`
    );
    console.error(JSON.stringify(data, null, 2));
    throw new Error(
      `Unexpected version received when checking the current version on npm: ${data.version}`
    );
  }

  console.log(`⛈️ ${prettyPackage} is published`);
  return true;
};

export const listUnpublishedPackages = async ({
  packageNames,
  version,
  verbose,
}: {
  packageNames: string[];
  version: string;
  verbose?: boolean;
}) => {
  const published = await Promise.all(
    packageNames.map((packageName) =>
      isPackageVersionPublished({ packageName, version, verbose }).then((isPublished) =>
        isPublished ? null : packageName
      )
    )
  );
  return published.filter((name): name is string => name !== null);
};

export const waitForPackagesToBePublished = async ({
  packageNames,
  version,
  timeoutMs,
  intervalMs,
  verbose,
  now = Date.now,
  sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
}: {
  packageNames: string[];
  version: string;
  timeoutMs: number;
  intervalMs: number;
  verbose?: boolean;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}) => {
  const deadline = now() + timeoutMs;
  let missing = [...packageNames];

  while (missing.length > 0 && now() < deadline) {
    console.log(
      `⏳ Waiting ${intervalMs / 1000}s for ${missing.length} package(s) to appear on npm: ${missing.join(', ')}`
    );
    await sleep(intervalMs);
    missing = await listUnpublishedPackages({ packageNames: missing, version, verbose });
  }

  return missing;
};

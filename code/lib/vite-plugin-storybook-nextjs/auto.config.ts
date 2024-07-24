import type { AutoRc } from "auto";

/** Auto configuration */
export default function rc(): AutoRc {
  return {
    onlyPublishWithReleaseLabel: true,
  };
}

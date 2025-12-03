import { cacheLife, cacheTag } from "next/cache";

interface CacheComponentProps {
  profile?:
    | "default"
    | "seconds"
    | "minutes"
    | "hours"
    | "days"
    | "weeks"
    | "max";
  tags?: string[];
}

export default function CacheComponent({
  profile = "default",
  tags = ["my-tag"],
}: CacheComponentProps) {
  // Apply cache life profile
  cacheLife(profile);

  // Apply cache tags
  for (const tag of tags) {
    cacheTag(tag);
  }

  return (
    <div>
      <h3>Cache Component</h3>
      <p>
        <strong>Cache Life Profile:</strong> {profile}
      </p>
      <p>
        <strong>Cache Tags:</strong> {tags.join(", ")}
      </p>
    </div>
  );
}

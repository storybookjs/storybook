import { unstable_rethrow } from "next/navigation";

interface UnstableRethrowProps {
  shouldCatch?: boolean;
}

export default function UnstableRethrow({
  shouldCatch = false,
}: UnstableRethrowProps) {
  if (shouldCatch) {
    try {
      throw new Error("test error");
    } catch (error) {
      unstable_rethrow(error);
    }
  }

  return (
    <div>
      <h3>Unstable Rethrow Component</h3>
      <p>
        This component uses <code>unstable_rethrow</code> from next/navigation.
      </p>
    </div>
  );
}

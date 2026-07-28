/**
 * Strict command-line parsing for the docgen bench harnesses.
 *
 * Every harness used to carry its own `get(flag, fallback)` helper that returned `argv[idx + 1]`
 * without checking it. `--saves --json out.json` therefore parsed as `saves = "--json"`, and
 * `Number()` turned that into `NaN`, which reached the generators as a silently wrong project size.
 * Values are validated here instead, once.
 */

export class Args {
  // A plain field, not a constructor parameter property: these harnesses run on Node's strip-only
  // TypeScript support, which rejects parameter properties outright.
  private readonly argv: string[];

  constructor(argv: string[]) {
    this.argv = argv;
  }

  /** True when `--name` is present. */
  flag(name: string): boolean {
    return this.argv.includes(`--${name}`);
  }

  /**
   * The value after `--name`. Throws when the flag is present but its value is missing or is
   * itself a flag, so a typo fails at the boundary instead of becoming a bad measurement.
   */
  private valueAt(name: string, at: number): string {
    const value = this.argv[at + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`--${name} requires a value`);
    }
    return value;
  }

  /** The value after `--name`, or undefined when the flag is absent. */
  optional(name: string): string | undefined {
    const at = this.argv.indexOf(`--${name}`);
    return at < 0 ? undefined : this.valueAt(name, at);
  }

  string(name: string, fallback: string): string {
    return this.optional(name) ?? fallback;
  }

  /** Every value of a repeatable flag, in the order given. */
  all(name: string): string[] {
    const values: string[] = [];
    for (let i = 0; i < this.argv.length; i++) {
      if (this.argv[i] === `--${name}`) {
        values.push(this.valueAt(name, i));
      }
    }
    return values;
  }

  /** A non-negative integer. Rejects `NaN`, fractions and negatives rather than passing them on. */
  count(name: string, fallback: number): number {
    const raw = this.optional(name);
    if (raw === undefined) {
      return fallback;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`--${name} must be a non-negative integer, got "${raw}"`);
    }
    return value;
  }

  /** One of `allowed`. The error names the whole set, so a typo is self-correcting. */
  choice<const T extends string>(name: string, allowed: readonly T[], fallback: T): T {
    const raw = this.optional(name);
    if (raw === undefined) {
      return fallback;
    }
    if (!(allowed as readonly string[]).includes(raw)) {
      throw new Error(`--${name} must be one of ${allowed.join(', ')}, got "${raw}"`);
    }
    return raw as T;
  }
}
